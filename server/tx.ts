import { hexToNum } from './rpc.js'
import type { Collector } from './collector.js'

export interface TxLadder {
  hash: string
  status: 'not_found' | 'pending' | 'included' | 'batched' | 'l1_confirmed' | 'assertion_confirmed'
  included?: { block: number; timestamp: number; success: boolean; explorer: string }
  batched?: { seq: number; l1Block: number; l1Time: number; l1Tx: string; daMode: string; postingDelay?: number; explorer: string }
  l1?: { confirmations: number }
  assertion?: { hash: string; createdTime?: number; confirmedTime?: number; confirmTx?: string; explorer?: string }
  nextEta?: string
  error?: string
}

export async function lookupTx(c: Collector, hash: string): Promise<TxLadder> {
  const out: TxLadder = { hash, status: 'not_found' }
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return { ...out, error: 'That is not a transaction hash.' }
  const receipt = await c.l2.call<any>('eth_getTransactionReceipt', [hash])
  if (!receipt) {
    const tx = await c.l2.call<any>('eth_getTransactionByHash', [hash])
    if (tx) return { ...out, status: 'pending' }
    return out
  }
  const block = hexToNum(receipt.blockNumber)
  const blk = await c.l2.getBlock(block)
  out.included = { block, timestamp: hexToNum(blk.timestamp), success: receipt.status === '0x1', explorer: `${c.net.explorer.elysium}/tx/${hash}` }
  out.status = 'included'

  let seq: number | null = null
  for (const b of c.batches.values()) if (b.l2FirstBlock !== undefined && b.l2LastBlock !== undefined && block >= b.l2FirstBlock && block <= b.l2LastBlock) { seq = b.seq; break }
  if (seq === null) { try { const s = await c.l2.call<number>('arb_findBatchContainingBlock', [block]); if (c.batches.has(s)) seq = s } catch { seq = null } }
  const head = c.heads.at(-1)
  if (seq !== null && c.batches.has(seq)) {
    const b = c.batches.get(seq)!
    out.batched = { seq, l1Block: b.l1Block, l1Time: b.l1Time, l1Tx: b.txHash, daMode: b.daMode, postingDelay: b.postingDelay, explorer: `${c.net.explorer.hyperevm}/tx/${b.txHash}` }
    out.status = 'batched'
    const confs = Math.max(0, c.l1Head - b.l1Block + 1)
    out.l1 = { confirmations: confs }; if (confs > 0) out.status = 'l1_confirmed'
    const after = [...c.assertions.values()].filter((a) => a.createdBlock && a.createdBlock > b.l1Block).sort((a, x) => a.createdBlock! - x.createdBlock!)
    const a = after[0]
    if (a) {
      out.assertion = { hash: a.hash, createdTime: a.createdTime, confirmedTime: a.confirmedTime, confirmTx: a.confirmTx, explorer: a.confirmTx ? `${c.net.explorer.hyperevm}/tx/${a.confirmTx}` : undefined }
      if (a.confirmedTime) out.status = 'assertion_confirmed'
      else out.nextEta = 'Waiting for the assertion covering this batch to be confirmed on HyperEVM.'
    } else out.nextEta = 'Waiting for the next assertion to be created on HyperEVM.'
  } else {
    const behind = c.unbatchedSeconds()
    out.nextEta = behind > 120 ? `Not yet in a batch. Batching is running about ${Math.round(behind / 60)} min behind the chain head.` : 'Not yet in a batch. The next batch is due within a couple of minutes.'
  }
  return out
}
