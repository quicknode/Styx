# Elysium Settlement Monitor

A live, visual view of how Elysium settles to HyperEVM. Blocks tick into batches, batches land on HyperEVM as AnyTrust certificates, assertions get created and confirmed, deposits and withdrawals cross the bridge, and a health strip says whether the sequencer is up, batches are current, data is available, and assertions are confirming. Paste any Elysium transaction hash and watch it climb the ladder: included, batched, confirmed on HyperEVM, asserted.

Everything is read from the rollup contracts on HyperEVM and from Elysium block headers over Quicknode endpoints. Nothing is self-reported.

## How it reads the chain

| Signal | Source |
|---|---|
| Elysium blocks, block interval, parent-block lag | `eth_subscribe newHeads` on the Elysium endpoint, plus a periodic full header for `l1BlockNumber` |
| Batches, cadence, posting delay, blocks per batch | `SequencerBatchDelivered` on the SequencerInbox; the batch call's `prevMessageCount` / `newMessageCount` give the Elysium block range `[prev, new-1]` |
| Data-availability mode | First byte of the batch payload: `0x88` is an AnyTrust certificate, `0x50` a blob header, `0x00/0x01` full data (committee fallback) |
| Assertions | BoLD `AssertionCreated` / `AssertionConfirmed` on the Rollup contract (24 h lookback) |
| Deposits | `MessageDelivered` on the Bridge: kind 12 native HYPE, kind 9 retryable tickets, kind 3 L2 messages |
| Withdrawals | `OutBoxTransactionExecuted` on the Outbox |
| Forced inclusion pressure | `InboxMessageDelivered` on the SequencerInbox (delayed messages read) |
| Transaction ladder | Elysium receipt → batch range from the store → HyperEVM confirmations from the parent head → the first assertion created after the batch |

The Arbitrum RPC methods (`arb_findBatchContainingBlock`, `arb_getL1Confirmations`) are used only as a fallback for blocks older than the backfill window. They are available on Quicknode Elysium endpoints.

## Run it

```sh
cp .env.example .env   # fill in Quicknode Elysium + HyperEVM endpoints
npm install
npm run dev            # server on :8787, UI on :5173
```

Switch networks with `NETWORK=mainnet` or `NETWORK=testnet` in `.env`. Production: `npm run build && npm start` serves the built UI and the API from one port.

Contract addresses for both networks live in `server/networks.ts` and come from [Kinetiq's contract-addresses page](https://elysium.kinetiq.xyz/docs/contract-addresses).

## Design

The visual language is the Elysium explainer's printed field manual: warm paper, black ink, Newsreader titles with one italic accent word, Geist Mono labels, one spot color per entity (Elysium cyan, Hyperliquid mint), dimension lines and hatching instead of glow. The deck is a fixed 1920 x 1080 stage scaled to the window, like the explainer.

Built on Elysium. Not affiliated with or endorsed by Kinetiq or Hyperliquid.
