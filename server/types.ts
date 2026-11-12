export type DaMode = 'anytrust' | 'blob' | 'fulldata' | 'unknown'

export interface Batch {
  seq: number
  l1Block: number
  l1Time: number          // unix seconds
  txHash: string
  daMode: DaMode
  daHeader: string        // first byte of the batch data, hex
  dataBytes: number
  /** Filled in asynchronously by the Elysium side. */
  l2FirstBlock?: number
  l2LastBlock?: number
  l2LastTime?: number
  l2Blocks?: number
  postingDelay?: number   // seconds between the newest Elysium block in the batch and the HyperEVM inclusion
  gasUsed?: number
  gasPriceGwei?: number
  feeHype?: number
  delayedRead?: number    // afterDelayedMessagesRead from the batch call
  forced?: boolean        // posted via forceInclusion, not by the batch poster
  poster?: string
}

export interface Assertion {
  hash: string
  createdBlock?: number
  createdTime?: number
  confirmedBlock?: number
  confirmedTime?: number
  createTx?: string
  confirmTx?: string
}

export interface BridgeMsg {
  index: number
  kind: number
  kindLabel: string
  l1Block: number
  l1Time: number
  txHash: string
}

export interface Withdrawal {
  l1Block: number
  l1Time: number
  txHash: string
}

export interface Head {
  number: number
  timestamp: number      // unix seconds (Elysium header timestamp)
  receivedAt: number     // ms, local wallclock
  l1BlockNumber: number
}

export type HealthState = 'live' | 'pending' | 'failure' | 'unknown'

export interface Health {
  sequencer: { state: HealthState; headAge: number; blockInterval: number; detail: string }
  batches: { state: HealthState; lastBatchAge: number; medianInterval: number; detail: string }
  data: { state: HealthState; mode: DaMode; detail: string }
  assertions: { state: HealthState; lastConfirmedAge: number; openCount: number; confirmPeriod: number; detail: string }
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
  histogram: { minute: number; hype: number; retryable: number; other: number; withdrawals: number }[]
  withdrawals24h: number
  costs: { last: { seq: number; gasUsed: number; gasPriceGwei: number; feeHype: number } | null; day: { batches: number; feeHype: number; elysiumBlocks: number; gasUsed: number }; perBlockHype: number; perBatchMedianHype: number }
  inclusion: { submitted: number; read: number; backlog: number; oldestWaitingSec: number; forceWindowSec: number; forcedLast24h: number; submitted24h: number; absorbedLast: number }
  health: Health
}

export type Event =
  | { type: 'head'; head: Head }
  | { type: 'batch'; batch: Batch }
  | { type: 'batch_detail'; batch: Batch }
  | { type: 'assertion_created'; assertion: Assertion }
  | { type: 'assertion_confirmed'; assertion: Assertion }
  | { type: 'deposit'; msg: BridgeMsg }
  | { type: 'withdrawal'; w: Withdrawal }
  | { type: 'l1head'; number: number; timestamp: number }
  | { type: 'snapshot'; snapshot: Snapshot }
