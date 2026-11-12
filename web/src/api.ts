export type DaMode = 'anytrust' | 'blob' | 'fulldata' | 'unknown'
export interface Batch { seq: number; l1Block: number; l1Time: number; txHash: string; daMode: DaMode; daHeader: string; dataBytes: number; l2FirstBlock?: number; l2LastBlock?: number; l2LastTime?: number; l2Blocks?: number; postingDelay?: number }
export interface Assertion { hash: string; createdBlock?: number; createdTime?: number; confirmedBlock?: number; confirmedTime?: number; createTx?: string; confirmTx?: string }
export interface BridgeMsg { index: number; kind: number; kindLabel: string; l1Block: number; l1Time: number; txHash: string }
export interface Withdrawal { l1Block: number; l1Time: number; txHash: string }
export interface Head { number: number; timestamp: number; receivedAt: number; l1BlockNumber: number }
export type HealthState = 'live' | 'pending' | 'failure' | 'unknown'
export interface Health {
  sequencer: { state: HealthState; headAge: number; blockInterval: number; detail: string }
  batches: { state: HealthState; lastBatchAge: number; medianInterval: number; detail: string }
  data: { state: HealthState; mode: DaMode; detail: string }
  assertions: { state: HealthState; lastConfirmedAge: number; openCount: number; detail: string }
  sentence: string
}
export interface Snapshot {
  network: { name: string; elysiumChainId: number; hyperevmChainId: number; explorer: { elysium: string; hyperevm: string }; contracts: Record<string, string> }
  now: number
  elysium: { head: Head | null; blockInterval: number; l1Lag: number; recentHeads: Head[]; unbatchedBlocks: number; unbatchedSeconds: number }
  hyperevm: { head: number; headTime: number }
  batches: Batch[]
  assertions: Assertion[]
  bridge: { deposits: BridgeMsg[]; withdrawals: Withdrawal[]; perHour: { hype: number; retryable: number; other: number; withdrawals: number } }
  delayedMessages: { lastHour: number }
  health: Health
}
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

type Handlers = {
  head?: (h: Head) => void
  l1head?: (n: number, t: number) => void
  batch?: (b: Batch) => void
  batch_detail?: (b: Batch) => void
  assertion_created?: (a: Assertion) => void
  assertion_confirmed?: (a: Assertion) => void
  deposit?: (m: BridgeMsg) => void
  withdrawal?: (w: Withdrawal) => void
  snapshot?: (s: Snapshot) => void
  status?: (connected: boolean) => void
}

export function connect(h: Handlers) {
  let es: EventSource | null = null
  const open = () => {
    es = new EventSource('/api/events')
    es.onopen = () => h.status?.(true)
    es.onerror = () => { h.status?.(false); es?.close(); setTimeout(open, 2000) }
    es.addEventListener('head', (e) => h.head?.(JSON.parse((e as MessageEvent).data).head))
    es.addEventListener('l1head', (e) => { const d = JSON.parse((e as MessageEvent).data); h.l1head?.(d.number, d.timestamp) })
    es.addEventListener('batch', (e) => h.batch?.(JSON.parse((e as MessageEvent).data).batch))
    es.addEventListener('batch_detail', (e) => h.batch_detail?.(JSON.parse((e as MessageEvent).data).batch))
    es.addEventListener('assertion_created', (e) => h.assertion_created?.(JSON.parse((e as MessageEvent).data).assertion))
    es.addEventListener('assertion_confirmed', (e) => h.assertion_confirmed?.(JSON.parse((e as MessageEvent).data).assertion))
    es.addEventListener('deposit', (e) => h.deposit?.(JSON.parse((e as MessageEvent).data).msg))
    es.addEventListener('withdrawal', (e) => h.withdrawal?.(JSON.parse((e as MessageEvent).data).w))
    es.addEventListener('snapshot', (e) => h.snapshot?.(JSON.parse((e as MessageEvent).data).snapshot))
  }
  open()
  return () => es?.close()
}

export const fetchSnapshot = () => fetch('/api/snapshot').then((r) => r.json() as Promise<Snapshot>)
export const fetchTx = (hash: string) => fetch(`/api/tx/${hash}`).then((r) => r.json() as Promise<TxLadder>)

export const fmtAge = (s: number) => (s < 60 ? `${Math.max(0, Math.round(s))} s` : s < 3600 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${(s / 3600).toFixed(1)} h`)
export const short = (h: string) => h.slice(0, 6) + '…' + h.slice(-4)
