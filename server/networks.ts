import 'dotenv/config'

export type NetworkName = 'testnet' | 'mainnet'

export interface NetworkConfig {
  name: NetworkName
  elysiumChainId: number
  hyperevmChainId: number
  elysiumHttp: string
  elysiumWs: string
  hyperevmHttp: string
  contracts: {
    rollup: string
    bridge: string
    inbox: string
    outbox: string
    sequencerInbox: string
  }
  explorer: { elysium: string; hyperevm: string }
}

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env ${k}. Copy .env.example to .env and fill it in.`)
  return v
}

export const NETWORKS: Record<NetworkName, () => NetworkConfig> = {
  mainnet: () => ({
    name: 'mainnet',
    elysiumChainId: 99901,
    hyperevmChainId: 999,
    elysiumHttp: env('ELYSIUM_MAINNET_HTTP'),
    elysiumWs: env('ELYSIUM_MAINNET_WS'),
    hyperevmHttp: env('HYPEREVM_MAINNET_HTTP'),
    contracts: {
      rollup: '0x508C173dFe5F737B3493195Bf785d71fA76fD217',
      bridge: '0x503D572157113fAaaD4DbeD2647Bb10b949216B6',
      inbox: '0xce59f8B65ad41C9DAE4c07A0571a39824bD92cff',
      outbox: '0xeC6B106DfA14428FE5Eec2a4065a7be599f02728',
      sequencerInbox: '0x7f3Ff53aecB87261206ad3bDc27A88b6D8420fa6',
    },
    explorer: { elysium: 'https://elysium.kinetiq.xyz/explorer', hyperevm: 'https://hyperevmscan.io' },
  }),
  testnet: () => ({
    name: 'testnet',
    elysiumChainId: 99801,
    hyperevmChainId: 998,
    elysiumHttp: env('ELYSIUM_TESTNET_HTTP'),
    elysiumWs: env('ELYSIUM_TESTNET_WS'),
    hyperevmHttp: env('HYPEREVM_TESTNET_HTTP'),
    contracts: {
      rollup: '0xEbf08e34941fd93a0Fc1cD89dbBF7447267039Df',
      bridge: '0x36dAbc3CEE2E1084B7d04c8015Ef68Cac78f4f37',
      inbox: '0x11178Df40CBf87a4343f4B3F8B09B366ceFA8Ec0',
      outbox: '0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060',
      sequencerInbox: '0xb5B1a0AebfFeF819Ec3F8c39a17b5C4E70A001E3',
    },
    explorer: { elysium: 'https://elysium.kinetiq.xyz/testnet-explorer', hyperevm: 'https://testnet.purrsec.com' },
  }),
}

export function loadNetwork(): NetworkConfig {
  const n = (process.env.NETWORK ?? 'mainnet') as NetworkName
  if (!NETWORKS[n]) throw new Error(`Unknown NETWORK ${n}`)
  return NETWORKS[n]()
}

/** Event topics emitted by the Nitro rollup contracts on the parent chain. */
export const TOPICS = {
  SequencerBatchDelivered: '0x7394f4a19a13c7b92b5bb71033245305946ef78452f7b4986ac1390b5df4ebd7',
  InboxMessageDelivered: '0xff64905f73a67fb594e0f940a8075a860db489ad991e032f48c81123eb52d60b',
  AssertionCreated: '0x901c3aee23cf4478825462caaab375c606ab83516060388344f0650340753630',
  AssertionConfirmed: '0xfc42829b29c259a7370ab56c8f69fce23b5f351a9ce151da453281993ec0090c',
  MessageDelivered: '0x5e3c1311ea442664e8b1611bfabef659120ea7a0a2cfc0667700bebc69cbffe1',
  OutBoxTransactionExecuted: '0x20af7f3bbfe38132b8900ae295cd9c8d1914be7052d061a511f3f728dab18964',
} as const
