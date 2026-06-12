# Resolution Architecture: Dual-Path Design

Status: **ratified 2026-06-13** · implementation: with the ownership-indexing build

## Why two paths

Name resolution has two irreconcilable consumers:

- **Money movement** (wallet send-to-name, marketplace settlement): a stale answer
  misdirects funds. Correctness beats latency, always.
- **Display** (showing `~alice` instead of an address, profiles, reverse lookup at
  wallet scale): latency beats perfect freshness, and events/history are required.

One path cannot serve both honestly. So we run two, and the docs are opinionated
about which to use:

> **If a wrong answer costs money, use `verified`. If it costs a re-render, use `fast`.**

## The paths

| | `verified` | `fast` (indexed) |
|---|---|---|
| Source | Chain state at query time (node/explorer UTXO) | ErgoNames ownership index |
| Latency | 200 ms – 2 s | ~ms |
| Freshness | Current as of the query | `asOfHeight` (seconds–minutes behind tip) |
| Events / history | No | Yes — transfer webhooks, provenance |
| Maturity | Battle-tested (the original resolution path) | Ships as **beta** until reconciliation stats prove it |
| Rate limits | Strict (expensive) | Generous |

Both return the **same response schema**, plus:

```json
{ "source": "indexed" | "live", "asOfHeight": 1806125, ... }
```

## The reconciler is the verified path on a loop

A background sweep continuously re-derives every name's owner via the verified
path and compares it to the index — healing and alerting on any drift. One
mechanism is therefore both the user-facing verified tier and the index's
immune system, and its drift log is the public evidence of how trustworthy the
fast path is.

## SDK semantics (v0.2.0)

Use case is encoded in method defaults so integrators can't pick wrong by accident:

```ts
await sdk.resolveAddress("~alice");              // VERIFIED by default — this call moves money
await sdk.primaryName(addr);                     // INDEXED by default — display decoration
await sdk.resolveAddress("~alice", { fast: true });   // explicit override
await sdk.primaryName(addr, { verified: true });      // explicit override
```

## The trust ladder (docs framing)

1. **fast** — trust ErgoNames' index. Instant, evented.
2. **verified** — trust the chain via a node/explorer. ~1 s.
3. **proof** — trust nobody: fetch an AVL membership proof and check it against
   the on-chain registry digest yourself. (Planned endpoint; see the
   ErgoGames-spec R-6 requirement.)

## Implementation notes

- The verified path is a relabel of the current live-lookup code — nothing is
  rewritten or thrown away; the index is purely additive.
- Indexed responses must never be silently stale: `asOfHeight` and the index's
  `lastReconciledAt` are part of the contract.
- Ownership semantics to make explicit in the index: owner = holder of the
  P2PK unit of the name token (the second unit lives permanently in the
  subname-registry box); contract-held names report `ownerType: "contract"`;
  burned-unit names report ownerless.
- Reorg handling: per-height deltas with rollback; initial backfill from
  registration history (trivial at current registry size — build early).
