import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { Rpc, RpcError, hexToNum, word, type Log } from './rpc.js'
import { TOPICS, type NetworkConfig } from './networks.js'
import type { Assertion, Batch, BridgeMsg, DaMode, Event, Head, Health, Snapshot, Withdrawal } from './types.js'

const KIND_LABEL: Record<number, string> = {
  3: 'L2 message', 7: 'Batch posting report', 9: 'Retryable ticket', 11: 'Initialization', 12: 'HYPE deposit', 13: 'Rollup event',
}
const DEPOSIT_KINDS = new Set([3, 9, 12])
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

export class Collector extends EventEmitter {
  l2: Rpc
  l1: Rpc
  heads: Head[] = []
  l1Head = 0
  l1HeadTime = 0
  batches = new Map<number, Batch>()
  assertions = new Map<string, Assertion>()
  deposits: BridgeMsg[] = []
  withdrawals: Withdrawal[] = []
  delayed: number[] = [] // unix seconds of delayed-inbox messages read by the sequencer
  /** minute bucket (unix minutes) -> counts; exact hourly totals independent of the recent-list buffer */
  hist = new Map<number, { hype: number; retryable: number; other: number; withdrawals: number }>()
  private bump(t: number, k: 'hype' | 'retryable' | 'other' | 'withdrawals') {
    const m = Math.floor(t / 60); const e = this.hist.get(m) ?? { hype: 0, retryable: 0, other: 0, withdrawals: 0 }; e[k]++; this.hist.set(m, e)
    if (this.hist.size > 1500) for (const key of [...this.hist.keys()].sort((a, b) => a - b).slice(0, this.hist.size - 1500)) this.hist.delete(key)
  }
  lastHour() {
    const nowM = Math.floor(Date.now() / 60000); const o = { hype: 0, retryable: 0, other: 0, withdrawals: 0 }
    for (const [m, e] of this.hist) if (nowM - m < 60) { o.hype += e.hype; o.retryable += e.retryable; o.other += e.other; o.withdrawals += e.withdrawals }
    return o
  }
  private tsCache = new Map<number, number>()
  private lastProcessedL1 = 0
  private ws?: WebSocket
  private detailQueue: number[] = []
  private detailBusy = false
  ready = false

  constructor(public net: NetworkConfig, private backfillBlocks: number) {
    super()
    this.l2 = new Rpc(net.elysiumHttp)
    this.l1 = new Rpc(net.hyperevmHttp)
  }

  emitEvent(e: Event) { this.emit('event', e) }

  async start() {
    this.l1Head = await this.l1.blockNumber()
    const from = Math.max(1, this.l1Head - this.backfillBlocks)
    console.log(`[collector] ${this.net.name}: backfilling HyperEVM ${from}..${this.l1Head}`)
    await this.ingestRange(from, this.l1Head, true)
    this.lastProcessedL1 = this.l1Head
    this.ready = true
    console.log(`[collector] backfill done: ${this.batches.size} batches, ${this.assertions.size} assertions, ${this.deposits.length} deposits, ${this.withdrawals.length} withdrawals`)
    // schedule L2 range detail for the most recent batches first
    const seqs = [...this.batches.keys()].sort((a, b) => b - a).slice(0, 12)
    this.detailQueue.push(...seqs)
    void this.drainDetail()
    this.connectHeads()
    void this.pollL1()
    void this.refreshHeadL1()
    await this.backfillRollupDeep()
  }

  /** newHeads payloads omit l1BlockNumber; refresh it from a full header. */
  private async refreshHeadL1() {
    for (;;) {
      try {
        const b = await this.l2.getBlock('latest')
        const n = hexToNum(b.number); const l1 = b.l1BlockNumber ? hexToNum(b.l1BlockNumber) : 0
        this.lastL1Ref = { number: n, l1 }
        const h = this.heads.at(-1); if (h && !h.l1BlockNumber) h.l1BlockNumber = l1
      } catch { /* ignore */ }
      await sleep(3000)
    }
  }
  lastL1Ref = { number: 0, l1: 0 }

  /** Assertions are rare; look back a full day for the Rollup contract only so cadence can be learned. */
  private async backfillRollupDeep() {
    const to = Math.max(1, this.l1Head - this.backfillBlocks)
    const from = Math.max(1, this.l1Head - 86400)
    if (to <= from) return
    try {
      for (let a = from; a < to; a += 1000) {
        const b = Math.min(a + 999, to - 1)
        const logs = await this.fetchLogs(this.net.contracts.rollup, [[TOPICS.AssertionCreated, TOPICS.AssertionConfirmed] as any], a, b)
        if (logs.length) { await this.ensureTimestamps([...new Set(logs.map((l) => hexToNum(l.blockNumber)))]); for (const l of logs) await this.handleLog(l, true) }
      }
      console.log(`[collector] rollup deep backfill: ${this.assertions.size} assertions over 24 h`)
    } catch (e) { console.warn('[rollup deep backfill]', (e as Error).message) }
  }

  // ---------- HyperEVM side ----------
  private async pollL1() {
    for (;;) {
      try {
        const head = await this.l1.blockNumber()
        if (head > this.l1Head) {
          this.l1Head = head
          const blk = await this.l1.getBlock(head)
          this.l1HeadTime = hexToNum(blk.timestamp)
          this.tsCache.set(head, this.l1HeadTime)
          this.emitEvent({ type: 'l1head', number: head, timestamp: this.l1HeadTime })
        }
        if (head > this.lastProcessedL1) {
          await this.ingestRange(this.lastProcessedL1 + 1, head, false)
          this.lastProcessedL1 = head
        }
      } catch (e) { console.warn('[l1 poll]', (e as Error).message) }
      await sleep(2000)
    }
  }

  private async fetchLogs(address: string, topics: (string | null)[] | undefined, from: number, to: number): Promise<Log[]> {
    try {
      return await this.l1.getLogs({ fromBlock: from, toBlock: to, address, topics })
    } catch (e) {
      const msg = (e as Error).message
      if (to > from && /too big|limit|range|exceed/i.test(msg)) {
        const mid = Math.floor((from + to) / 2)
        return [...(await this.fetchLogs(address, topics, from, mid)), ...(await this.fetchLogs(address, topics, mid + 1, to))]
      }
      throw e
    }
  }

  private async ingestRange(from: number, to: number, backfill: boolean) {
    const c = this.net.contracts
    const step = 1000
    for (let a = from; a <= to; a += step) {
      const b = Math.min(a + step - 1, to)
      const [seq, roll, bridge, outbox] = await Promise.all([
        this.fetchLogs(c.sequencerInbox, [[TOPICS.SequencerBatchDelivered, TOPICS.InboxMessageDelivered] as any], a, b),
        this.fetchLogs(c.rollup, [[TOPICS.AssertionCreated, TOPICS.AssertionConfirmed] as any], a, b),
        this.fetchLogs(c.bridge, [TOPICS.MessageDelivered], a, b),
        this.fetchLogs(c.outbox, [TOPICS.OutBoxTransactionExecuted], a, b),
      ])
      const logs = [...seq, ...roll, ...bridge, ...outbox].sort((x, y) => hexToNum(x.blockNumber) - hexToNum(y.blockNumber) || hexToNum(x.logIndex) - hexToNum(y.logIndex))
      await this.ensureTimestamps([...new Set(logs.map((l) => hexToNum(l.blockNumber)))])
      for (const log of logs) await this.handleLog(log, backfill)
    }
  }

  private async ensureTimestamps(blocks: number[]) {
    const missing = blocks.filter((n) => !this.tsCache.has(n))
    for (let i = 0; i < missing.length; i += 40) {
      const chunk = missing.slice(i, i + 40)
      const res = await this.l1.batch(chunk.map((n) => ({ method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), false] })))
      chunk.forEach((n, j) => { const r = res[j]; if (r && r.timestamp) this.tsCache.set(n, hexToNum(r.timestamp)) })
    }
  }

  private ts(block: number) { return this.tsCache.get(block) ?? 0 }

  private async handleLog(log: Log, backfill: boolean) {
    const t0 = log.topics[0]
    const l1Block = hexToNum(log.blockNumber)
    const l1Time = this.ts(l1Block)
    if (t0 === TOPICS.SequencerBatchDelivered) {
      const seq = hexToNum(log.topics[1])
      if (this.batches.has(seq)) return
      const dataLocation = hexToNum(word(log.data, Math.floor((log.data.length - 2) / 64) - 1))
      const batch: Batch = { seq, l1Block, l1Time, txHash: log.transactionHash, daMode: 'unknown', daHeader: '0x', dataBytes: 0 }
      try {
        const tx = await this.l1.call<any>('eth_getTransactionByHash', [log.transactionHash])
        const d = decodeBatchData(tx.input)
        batch.daHeader = d.header; batch.dataBytes = d.length; batch.daMode = d.mode
        if (dataLocation !== 0 && d.mode === 'unknown') batch.daMode = dataLocation === 3 ? 'blob' : 'unknown'
        // addSequencerL2BatchFromOrigin(seq, data, afterDelayedMessagesRead, gasRefunder, prevMessageCount, newMessageCount):
        // Nitro message counts map 1:1 to Elysium block numbers, so the batch covers blocks [prev, new-1].
        const raw = tx.input.slice(10)
        const w = (i: number) => Number(BigInt('0x' + raw.slice(i * 64, i * 64 + 64)))
        const prev = w(4), next = w(5)
        if (next > prev && next < 1e12) { batch.l2FirstBlock = prev; batch.l2LastBlock = next - 1; batch.l2Blocks = next - prev }
      } catch (e) { console.warn('[batch data]', (e as Error).message) }
      this.batches.set(seq, batch)
      this.trimBatches()
      if (!backfill) { this.emitEvent({ type: 'batch', batch }); this.detailQueue.unshift(seq); void this.drainDetail() }
    } else if (t0 === TOPICS.InboxMessageDelivered) {
      this.delayed.push(l1Time); if (this.delayed.length > 2000) this.delayed.shift()
    } else if (t0 === TOPICS.AssertionCreated) {
      const hash = log.topics[1]
      const a = this.assertions.get(hash) ?? { hash }
      a.createdBlock = l1Block; a.createdTime = l1Time; a.createTx = log.transactionHash
      this.assertions.set(hash, a); this.trimAssertions()
      if (!backfill) this.emitEvent({ type: 'assertion_created', assertion: a })
    } else if (t0 === TOPICS.AssertionConfirmed) {
      const hash = log.topics[1]
      const a = this.assertions.get(hash) ?? { hash }
      a.confirmedBlock = l1Block; a.confirmedTime = l1Time; a.confirmTx = log.transactionHash
      this.assertions.set(hash, a); this.trimAssertions()
      if (!backfill) this.emitEvent({ type: 'assertion_confirmed', assertion: a })
    } else if (t0 === TOPICS.MessageDelivered) {
      const kind = hexToNum(word(log.data, 1))
      if (!DEPOSIT_KINDS.has(kind)) return
      const msg: BridgeMsg = { index: hexToNum(log.topics[1]), kind, kindLabel: KIND_LABEL[kind] ?? `kind ${kind}`, l1Block, l1Time, txHash: log.transactionHash }
      this.deposits.push(msg); if (this.deposits.length > 3000) this.deposits.splice(0, this.deposits.length - 3000)
      this.bump(l1Time, kind === 12 ? 'hype' : kind === 9 ? 'retryable' : 'other')
      if (!backfill) this.emitEvent({ type: 'deposit', msg })
    } else if (t0 === TOPICS.OutBoxTransactionExecuted) {
      const w: Withdrawal = { l1Block, l1Time, txHash: log.transactionHash }
      this.withdrawals.push(w); if (this.withdrawals.length > 1000) this.withdrawals.splice(0, this.withdrawals.length - 1000)
      this.bump(l1Time, 'withdrawals')
      if (!backfill) this.emitEvent({ type: 'withdrawal', w })
    }
  }

  private trimBatches() {
    if (this.batches.size <= 400) return
    const seqs = [...this.batches.keys()].sort((a, b) => a - b)
    for (const s of seqs.slice(0, this.batches.size - 400)) this.batches.delete(s)
  }
  private trimAssertions() {
    if (this.assertions.size <= 400) return
    const arr = [...this.assertions.values()].sort((a, b) => (a.createdBlock ?? a.confirmedBlock ?? 0) - (b.createdBlock ?? b.confirmedBlock ?? 0))
    for (const a of arr.slice(0, this.assertions.size - 400)) this.assertions.delete(a.hash)
  }

  // ---------- Elysium side ----------
  private connectHeads() {
    let gotMessage = false
    try {
      const ws = new WebSocket(this.net.elysiumWs)
      this.ws = ws
      ws.on('open', () => ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['newHeads'] })))
      ws.on('message', (buf) => {
        const m = JSON.parse(buf.toString())
        const h = m?.params?.result
        if (!h) return
        gotMessage = true
        this.pushHead(h)
      })
      ws.on('close', () => { console.warn('[l2 ws] closed, reconnecting'); setTimeout(() => this.connectHeads(), 1500) })
      ws.on('error', (e) => { console.warn('[l2 ws]', e.message); ws.close() })
      setTimeout(() => { if (!gotMessage) { console.warn('[l2 ws] no heads in 8s, polling as well'); void this.pollHeads() } }, 8000)
    } catch (e) { console.warn('[l2 ws] failed, polling', (e as Error).message); void this.pollHeads() }
  }
  private polling = false
  private async pollHeads() {
    if (this.polling) return
    this.polling = true
    for (;;) {
      try { const b = await this.l2.getBlock('latest'); if (!this.heads.length || hexToNum(b.number) > this.heads[this.heads.length - 1].number) this.pushHead(b) } catch (e) { /* ignore */ }
      await sleep(250)
    }
  }
  private pushHead(h: any) {
    const head: Head = { number: hexToNum(h.number), timestamp: hexToNum(h.timestamp), receivedAt: Date.now(), l1BlockNumber: h.l1BlockNumber ? hexToNum(h.l1BlockNumber) : 0 }
    if (this.heads.length && head.number <= this.heads[this.heads.length - 1].number) return
    this.heads.push(head); if (this.heads.length > 600) this.heads.shift()
    this.emitEvent({ type: 'head', head })
  }

  /** Fill in posting delay: time between the newest Elysium block in the batch and its HyperEVM inclusion. */
  private async drainDetail() {
    if (this.detailBusy) return
    this.detailBusy = true
    try {
      while (this.detailQueue.length) {
        const seq = this.detailQueue.shift()!
        const b = this.batches.get(seq); if (!b || b.l2LastTime) continue
        try { await this.resolveBatchRange(b) } catch (e) { console.warn('[batch range]', seq, (e as Error).message) }
      }
    } finally { this.detailBusy = false }
  }
  private async resolveBatchRange(b: Batch) {
    if (!b.l2LastBlock) return
    const blk = await this.l2.getBlock(b.l2LastBlock)
    b.l2LastTime = hexToNum(blk.timestamp)
    b.postingDelay = Math.max(0, b.l1Time - b.l2LastTime)
    this.emitEvent({ type: 'batch_detail', batch: b })
  }

  // ---------- derived ----------
  lastBatch(): Batch | undefined { let m: Batch | undefined; for (const b of this.batches.values()) if (!m || b.seq > m.seq) m = b; return m }
  unbatched(): number { const h = this.heads.at(-1); const b = this.lastBatch(); return h && b?.l2LastBlock ? Math.max(0, h.number - b.l2LastBlock) : 0 }
  unbatchedSeconds(): number { const h = this.heads.at(-1); const b = this.lastBatch(); return h && b?.l2LastTime ? Math.max(0, h.timestamp - b.l2LastTime) : 0 }
  blockIntervalMs(): number {
    const hs = this.heads.slice(-120)
    if (hs.length < 3) return 0
    return (hs[hs.length - 1].receivedAt - hs[0].receivedAt) / (hs.length - 1)
  }

  health(): Health {
    const now = Math.floor(Date.now() / 1000)
    const head = this.heads.at(-1)
    const headAge = head ? now - head.timestamp : 1e9
    const interval = this.blockIntervalMs()
    const seqState = !head ? 'unknown' : headAge < 4 ? 'live' : headAge < 20 ? 'pending' : 'failure'

    const bs = [...this.batches.values()].sort((a, b) => a.seq - b.seq)
    const last = bs.at(-1)
    const gaps = bs.slice(-12).map((b, i, arr) => (i ? b.l1Time - arr[i - 1].l1Time : 0)).filter(Boolean)
    const med = gaps.length ? median(gaps) : this.net.seedBatchInterval
    const lastBatchAge = last ? now - last.l1Time : 1e9
    const batchState = !last ? 'unknown' : lastBatchAge < med * 2 ? 'live' : lastBatchAge < med * 4 ? 'pending' : 'failure'

    const mode: DaMode = last?.daMode ?? 'unknown'
    const dataState = mode === 'anytrust' ? 'live' : mode === 'fulldata' ? 'pending' : mode === 'blob' ? 'live' : 'unknown'
    const dataDetail = mode === 'anytrust' ? 'AnyTrust certificate (0x88) posted as calldata' : mode === 'fulldata' ? 'Full batch data posted to HyperEVM: committee fallback is active' : mode === 'blob' ? 'Blob data' : 'No batch seen yet'

    const as = [...this.assertions.values()]
    const confirmed = as.filter((a) => a.confirmedTime).sort((a, b) => a.confirmedTime! - b.confirmedTime!)
    const lastConf = confirmed.at(-1)
    const lastConfirmedAge = lastConf ? now - lastConf.confirmedTime! : 1e9
    const created = as.filter((a) => a.createdTime).sort((a, b) => a.createdTime! - b.createdTime!)
    const cgaps = created.slice(-10).map((a, i, arr) => (i ? a.createdTime! - arr[i - 1].createdTime! : 0)).filter(Boolean)
    const cmed = Math.max(3600, cgaps.length >= 2 ? median(cgaps) : 3600)
    const open = as.filter((a) => a.createdTime && !a.confirmedTime).length
    const aState = !confirmed.length && !created.length ? 'unknown' : lastConfirmedAge < cmed * 2 ? 'live' : lastConfirmedAge < cmed * 4 ? 'pending' : 'failure'

    const lh = this.lastHour(); const hour = lh.hype + lh.retryable + lh.other; const whour = lh.withdrawals
    const sentence = [
      head ? `Elysium is producing a block every ${Math.round(interval)} ms.` : 'Waiting for Elysium blocks.',
      last ? `The last batch landed on HyperEVM ${fmtAge(lastBatchAge)} ago${mode === 'anytrust' ? ' carrying an AnyTrust certificate' : mode === 'fulldata' ? ' with full data, the committee fallback' : ''}${this.unbatchedSeconds() > 300 ? `, and batching is running ${fmtAge(this.unbatchedSeconds())} behind the chain head` : ''}.` : '',
      lastConf ? `The last assertion was confirmed ${fmtAge(lastConfirmedAge)} ago.` : '',
      `${hour} deposit${hour === 1 ? '' : 's'} and ${whour} withdrawal${whour === 1 ? '' : 's'} in the last hour.`,
    ].filter(Boolean).join(' ')

    return {
      sequencer: { state: seqState, headAge, blockInterval: interval, detail: head ? `block ${head.number.toLocaleString('en-US')} · ${Math.round(interval)} ms` : 'no heads' },
      batches: { state: batchState, lastBatchAge, medianInterval: med, detail: last ? `#${last.seq} · ${fmtAge(lastBatchAge)} ago · every ${fmtAge(med)}` : 'none yet' },
      data: { state: dataState, mode, detail: dataDetail },
      assertions: { state: aState, lastConfirmedAge, openCount: open, detail: lastConf ? `confirmed ${fmtAge(lastConfirmedAge)} ago · ${open} open` : `${open} open` },
      sentence,
    }
  }

  snapshot(): Snapshot {
    const now = Math.floor(Date.now() / 1000)
    const head = this.heads.at(-1) ?? null
    const l1Ref = head?.l1BlockNumber || this.lastL1Ref.l1
    const l1Lag = l1Ref && this.l1Head ? Math.max(0, this.l1Head - l1Ref) : 0
    const deposits = this.deposits.slice(-200)
    const lh = this.lastHour()
    return {
      network: { name: this.net.name, elysiumChainId: this.net.elysiumChainId, hyperevmChainId: this.net.hyperevmChainId, explorer: this.net.explorer, contracts: this.net.contracts },
      now,
      elysium: { head, blockInterval: this.blockIntervalMs(), l1Lag, recentHeads: this.heads.slice(-60), unbatchedBlocks: this.unbatched(), unbatchedSeconds: this.unbatchedSeconds() },
      hyperevm: { head: this.l1Head, headTime: this.l1HeadTime },
      batches: [...this.batches.values()].sort((a, b) => a.seq - b.seq).slice(-60),
      assertions: [...this.assertions.values()].sort((a, b) => (a.createdBlock ?? a.confirmedBlock ?? 0) - (b.createdBlock ?? b.confirmedBlock ?? 0)).slice(-40),
      bridge: {
        deposits, withdrawals: this.withdrawals.slice(-100),
        perHour: lh,
      },
      delayedMessages: { lastHour: this.delayed.filter((t) => now - t < 3600).length },
      health: this.health(),
    }
  }
}

/** Locate the `bytes data` argument in a sequencer batch call and classify its header byte. */
export function decodeBatchData(input: string): { header: string; length: number; mode: DaMode } {
  const raw = input.slice(10) // drop selector
  const wordAt = (i: number) => BigInt('0x' + raw.slice(i * 64, i * 64 + 64))
  const nWords = Math.floor(raw.length / 64)
  for (let i = 0; i < Math.min(nWords, 8); i++) {
    const off = Number(wordAt(i))
    if (off % 32 === 0 && off >= 32 && off * 2 + 64 <= raw.length) {
      const len = Number(BigInt('0x' + raw.slice(off * 2, off * 2 + 64)))
      if (len > 0 && off * 2 + 64 + len * 2 <= raw.length + 64) {
        const headerByte = parseInt(raw.slice(off * 2 + 64, off * 2 + 66), 16)
        return { header: '0x' + headerByte.toString(16).padStart(2, '0'), length: len, mode: classify(headerByte) }
      }
    }
  }
  return { header: '0x', length: 0, mode: 'unknown' }
}
function classify(h: number): DaMode {
  if (h & 0x80) return 'anytrust'          // DAS certificate flag
  if (h === 0x50) return 'blob'            // blob hashes header
  if (h === 0x00 || h === 0x01 || h === 0x20 || h === 0x40) return 'fulldata' // brotli / zlib / zeroheavy / l1-authenticated
  return 'unknown'
}
export function fmtAge(s: number) {
  if (s < 60) return `${Math.max(0, Math.round(s))} s`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  return `${(s / 3600).toFixed(1)} h`
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
