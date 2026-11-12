import type { Assertion, Batch, BridgeMsg, Head, Net, Snapshot, Withdrawal } from './api'

type Listener<T> = (v: T) => void
class Signal<T> { private ls = new Set<Listener<T>>(); on(l: Listener<T>) { this.ls.add(l); return () => this.ls.delete(l) } emit(v: T) { for (const l of this.ls) l(v) } }

/** Shared app state: the current network, the latest snapshot, and typed live events every tab can subscribe to. */
export const state = {
  net: ((location.hash.match(/net=(mainnet|testnet)/)?.[1]) ?? localStorage.getItem('esm.net') ?? 'mainnet') as Net,
  snapshot: null as Snapshot | null,
  selectedBatch: null as number | null,
  selectedAssertion: null as string | null,
  paused: false,
  onSnapshot: new Signal<Snapshot>(),
  onHead: new Signal<Head>(),
  onL1Head: new Signal<{ number: number; timestamp: number }>(),
  onBatch: new Signal<Batch>(),
  onBatchDetail: new Signal<Batch>(),
  onAssertion: new Signal<{ a: Assertion; confirmed: boolean }>(),
  onDeposit: new Signal<BridgeMsg>(),
  onWithdrawal: new Signal<Withdrawal>(),
  onSelectBatch: new Signal<number | null>(),
  onSelectAssertion: new Signal<string | null>(),
  onNet: new Signal<Net>(),
}
export function selectBatch(seq: number | null) { state.selectedBatch = seq; state.onSelectBatch.emit(seq) }
export function selectAssertion(hash: string | null) { state.selectedAssertion = hash; state.onSelectAssertion.emit(hash) }
