import { hexToNum, hexToBig, word } from './rpc.js'
import type { Collector } from './collector.js'

/** Everything the Track tab needs for one Elysium transaction, read straight from both chains. */
export interface TxLadder {
  hash: string
  status: 'not_found' | 'hyperevm' | 'pending' | 'included' | 'batched' | 'l1_confirmed' | 'claimed' | 'final'
  /** Identity: who sent it, to whom, how much, what call. */
  tx?: { from: string; to: string | null; valueHype: string; method: string; gasUsed: number; success: boolean; nonce: number }
  included?: { block: number; timestamp: number; success: boolean; explorer: string }
  batched?: { seq: number; l1Block: number; l1Time: number; l1Tx: string; daMode: string; postingDelay?: number; explorer: string }
  l1?: { confirmations: number; head: number }
  claim?: { hash: string; createdTime?: number; confirmedTime?: number; createTx?: string; confirmTx?: string; windowEnd?: number; explorer?: string; confirmExplorer?: string }
  /** For an L2 to L1 message (a withdrawal): its outbox position and, once executed, the HyperEVM tx. */
  withdrawal?: { position: number; executedTime?: number; executedTx?: string; explorer?: string }
  /** Expected unix times for stages not reached yet, from cadences measured on chain. */
  expect: { batchAt?: number; claimAt?: number; windowEndAt?: number; finalAt?: number }
  cadence: { batchEvery: number; claimEvery: number; period: number; confirmLag: number; l1BlockSec: number }
  hyperevmExplorer?: string
  error?: string
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const L2_TO_L1_TX = '0x3e7aafa77dbf186b7fd488006beff893744caa3c4f6f299e8a709fa2087374fc'
const ARBSYS = '0x0000000000000000000000000000000000000064'
const METHODS: Record<string, string> = {
  '0xa9059cbb': 'transfer', '0x095ea7b3': 'approve', '0x23b872dd': 'transferFrom', '0x2e1a7d4d': 'withdraw', '0xd0e30db0': 'deposit',
  '0x25e16063': 'withdrawEth', '0x7b3a3c8b': 'outboundTransfer', '0x38ed1739': 'swapExactTokensForTokens', '0x7ff36ab5': 'swapExactETHForTokens',
  '0x18cbafe5': 'swapExactTokensForETH', '0x5ae401dc': 'multicall', '0xac9650d8': 'multicall', '0x3593564c': 'execute', '0x40c10f19': 'mint', '0x42842e0e': 'safeTransferFrom',
}
function fmtHype(wei: bigint): string {
  if (wei === 0n) return '0'
  const whole = wei / 10n ** 18n; const frac = wei % 10n ** 18n
  const f = frac.toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '')
  return whole.toLocaleString('en-US') + (f ? '.' + f : '')
}

/** Cadences measured from the last day or two of events, never assumed. */
export function cadence(c: Collector) {
  const batches = [...c.batches.values()].sort((a, b) => a.l1Time - b.l1Time)
  const bg: number[] = []; for (let i = 1; i < batches.length; i++) bg.push(batches[i].l1Time - batches[i - 1].l1Time)
  const claims = [...c.assertions.values()].filter((a) => a.createdTime).sort((a, b) => a.createdTime! - b.createdTime!)
  const cg: number[] = []; for (let i = 1; i < claims.length; i++) cg.push(claims[i].createdTime! - claims[i - 1].createdTime!)
  const last = batches.at(-1)
  const l1BlockSec = last && c.l1Head - last.l1Block > 100 && c.l1HeadTime > last.l1Time ? (c.l1HeadTime - last.l1Time) / (c.l1Head - last.l1Block) : 1
  const period = Math.round(c.confirmPeriodBlocks * l1BlockSec)
  const lags = claims.filter((a) => a.confirmedTime).map((a) => Math.max(0, a.confirmedTime! - (a.createdTime! + period)))
  return { batchEvery: median(bg), claimEvery: median(cg), period, confirmLag: median(lags), l1BlockSec }
}

export async function lookupTx(c: Collector, hash: string): Promise<TxLadder> {
  const cad = cadence(c)
  const out: TxLadder = { hash, status: 'not_found', expect: {}, cadence: cad }
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return { ...out, error: 'That is not a transaction hash.' }
  const [receipt, tx] = await Promise.all([c.l2.call<any>('eth_getTransactionReceipt', [hash]), c.l2.call<any>('eth_getTransactionByHash', [hash])])
  if (!receipt) {
    if (tx) return { ...out, status: 'pending' }
    // not on Elysium: is it a HyperEVM transaction?
    try { const l1r = await c.l1.call<any>('eth_getTransactionReceipt', [hash]); if (l1r) return { ...out, status: 'hyperevm', hyperevmExplorer: `${c.net.explorer.hyperevm}/tx/${hash}` } } catch { /* fine */ }
    return out
  }
  const block = hexToNum(receipt.blockNumber)
  const blk = await c.l2.getBlock(block)
  const now = Math.floor(Date.now() / 1000)
  const success = receipt.status === '0x1'
  const input: string = tx?.input ?? '0x'
  const sel = input.length >= 10 ? input.slice(0, 10).toLowerCase() : ''
  out.tx = {
    from: tx?.from ?? receipt.from, to: tx?.to ?? receipt.to ?? null, valueHype: fmtHype(hexToBig(tx?.value ?? '0x0')),
    method: !tx?.to ? 'contract creation' : input === '0x' || input === '' ? 'HYPE transfer' : (METHODS[sel] ?? sel),
    gasUsed: hexToNum(receipt.gasUsed), success, nonce: hexToNum(tx?.nonce ?? '0x0'),
  }
  out.included = { block, timestamp: hexToNum(blk.timestamp), success, explorer: `${c.net.explorer.elysium}/tx/${hash}` }
  out.status = 'included'
  // an L2 to L1 message shows up as ArbSys.L2ToL1Tx; its position is what the outbox executes later
  const l2l1 = (receipt.logs as any[]).find((l) => l.address?.toLowerCase() === ARBSYS && l.topics?.[0] === L2_TO_L1_TX)
  if (l2l1) out.withdrawal = { position: hexToNum(l2l1.topics[3]) }

  let seq: number | null = null
  for (const b of c.batches.values()) if (b.l2FirstBlock !== undefined && b.l2LastBlock !== undefined && block >= b.l2FirstBlock && block <= b.l2LastBlock) { seq = b.seq; break }
  if (seq === null) { try { const s = await c.l2.call<number>('arb_findBatchContainingBlock', [block]); if (c.batches.has(s)) seq = s } catch { seq = null } }
  if (seq !== null && c.batches.has(seq)) {
    const b = c.batches.get(seq)!
    out.batched = { seq, l1Block: b.l1Block, l1Time: b.l1Time, l1Tx: b.txHash, daMode: b.daMode, postingDelay: b.postingDelay, explorer: `${c.net.explorer.hyperevm}/tx/${b.txHash}` }
    out.status = 'batched'
    const confs = Math.max(0, c.l1Head - b.l1Block + 1)
    out.l1 = { confirmations: confs, head: c.l1Head }; if (confs > 0) out.status = 'l1_confirmed'
    const after = [...c.assertions.values()].filter((a) => a.createdBlock && a.createdBlock > b.l1Block).sort((a, x) => a.createdBlock! - x.createdBlock!)
    const a = after[0]
    if (a) {
      out.claim = {
        hash: a.hash, createdTime: a.createdTime, confirmedTime: a.confirmedTime, createTx: a.createTx, confirmTx: a.confirmTx,
        windowEnd: a.createdTime ? a.createdTime + cad.period : undefined,
        explorer: a.createTx ? `${c.net.explorer.hyperevm}/tx/${a.createTx}` : undefined, confirmExplorer: a.confirmTx ? `${c.net.explorer.hyperevm}/tx/${a.confirmTx}` : undefined,
      }
      out.status = a.confirmedTime ? 'final' : 'claimed'
      if (!a.confirmedTime && a.createdTime) { out.expect.windowEndAt = a.createdTime + cad.period; out.expect.finalAt = Math.max(now, out.expect.windowEndAt + cad.confirmLag) }
    } else {
      // next claim: continue the measured claim cadence from the last one posted
      const lastClaim = [...c.assertions.values()].filter((x) => x.createdTime).sort((x, y) => y.createdTime! - x.createdTime!)[0]
      let claimAt = lastClaim?.createdTime && cad.claimEvery ? lastClaim.createdTime + cad.claimEvery : now + (cad.claimEvery || 3600)
      while (claimAt < now) claimAt += cad.claimEvery || 3600
      out.expect.claimAt = claimAt; out.expect.windowEndAt = claimAt + cad.period; out.expect.finalAt = out.expect.windowEndAt + cad.confirmLag
    }
    if (out.withdrawal) {
      const w = c.withdrawals.find((x) => x.index === out.withdrawal!.position)
      if (w) Object.assign(out.withdrawal, { executedTime: w.l1Time, executedTx: w.txHash, explorer: `${c.net.explorer.hyperevm}/tx/${w.txHash}` })
    }
  } else {
    const last = c.lastBatch()
    let batchAt = last && cad.batchEvery ? last.l1Time + cad.batchEvery : now + 600
    if (batchAt < now) batchAt = now + 60
    out.expect.batchAt = batchAt
    const lastClaim = [...c.assertions.values()].filter((x) => x.createdTime).sort((x, y) => y.createdTime! - x.createdTime!)[0]
    let claimAt = lastClaim?.createdTime && cad.claimEvery ? lastClaim.createdTime + cad.claimEvery : batchAt + (cad.claimEvery || 3600)
    while (claimAt < batchAt) claimAt += cad.claimEvery || 3600
    out.expect.claimAt = claimAt; out.expect.windowEndAt = claimAt + cad.period; out.expect.finalAt = out.expect.windowEndAt + cad.confirmLag
  }
  return out
}
