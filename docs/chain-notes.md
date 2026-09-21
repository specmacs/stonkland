# Robinhood Chain: what was verified, and how

Everything here was read off the chain and is re-checked by `test/fork/RobinhoodChain.t.sol`.
Re-run that before deploying:

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path 'test/fork/*' -vv
```

## The chain

| | |
|---|---|
| Chain id | 4663 |
| Native asset | ETH |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinscan.io` |
| Testnet chain id | 46630 |

The public RPC keeps recent state only. Pinning a fork to an old block needs an archive
node; without one the fork tests run at the head and say so.

## Addresses

| What | Address | Decimals |
|---|---|---|
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | 18 |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | **6** |
| NVDA — NVIDIA, Robinhood token | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | 18 |
| GOOGL — Alphabet Class A | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | 18 |
| AAPL — Apple | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | 18 |
| META — Meta Platforms | `0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35` | 18 |
| Uniswap V3 factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | |

**Impostor tokens carrying these exact symbols trade on this chain**, including ones with
names built to be mistaken for the real thing and one pair showing an absurd headline
liquidity figure. Never resolve a reward asset by ticker. Resolve it by address, and
check the address against this table.

The canonical Ethereum addresses for the Uniswap factory and router have *something*
deployed at them here, but it is not Uniswap — `factory()` and `getPool()` do not decode.
The real factory is the one in the table, found by asking a live pool what created it.

## Deepest WETH pools

One hop from WETH is possible for all four assets, which is why the routes are single-hop.

| Asset | Fee tier | Pool |
|---|---|---|
| NVDA | 0.05% | `0x62AB521f71431f78ac374CdbadC6cda3c8916b6C` |
| GOOGL | 1% | `0x8c2B4303fA0B99d07A5D3E9411497A277e65b673` |
| AAPL | 0.05% | `0x8bb3514e2204E1cDF3Ac149EFEe7Ff04D91B719f` |
| META | 0.3% | `0xa4BdB396a69617eb7F70E2cc1EF526f7340b1B0d` |

Liquidity is deeper against USDG than against WETH for every asset — roughly $6.2M vs
$1.2M for NVDA, and the gap is wider for the others. A two-hop `WETH → USDG → asset`
route would fill larger conversions better, and the adapter supports multi-hop paths. It
is worth measuring before choosing, and USDG's 6 decimals need respecting either way.

## Transfer restrictions: clear

The one finding that could have ended the design. Tokenized equities are frequently
permissioned, and a token that only verified holders may receive cannot be held by the
distributor or paid to a card owner.

The fork test moves a real balance from a real holder into a fresh contract, then out of
that contract into another. All four pass. A contract can hold these and pass them on.

That is the mechanical question only. Whether the issuer's terms *permit* a protocol to
acquire and redistribute them is a question for Robinhood and for counsel, and it is
still open.

## No price feeds, so the pools price themselves

There is no Pyth deployment at the standard address and no Chainlink feeds were found.
`UniswapV3Adapter`, which prices against an external feed, therefore cannot be used here.

`UniswapV3TwapAdapter` prices against the route's own 30-minute average instead. Observed
at the head:

| Pool | Cardinality | Deviation from its 30m average |
|---|---|---|
| NVDA | 6000 | 9 ticks |
| GOOGL | 1801 | 7 ticks |
| AAPL | 1801 | 7 ticks |
| META | 1400 | 20 ticks |

One tick is about one basis point. A 200-tick band is therefore roughly ten times the
normal wobble — tight enough to catch a pool being set up, loose enough not to block
ordinary trading. Re-measure before committing to it.

An external feed is strictly better evidence than a venue's own history. If Chainlink or
Pyth ever deploy here, switch back to `UniswapV3Adapter`; the vault can swap an adapter
without touching any accounting.

## Still open

1. **The swap router.** Nothing implementing the usual `exactInput` interface was found.
   The addresses appearing as swap senders expose something else. The adapter needs a
   router, or needs rewriting to call pools directly through a swap callback.
2. **How the TOWN pool's fee is collected, and who may claim it.** The reward loop hangs
   off this.
3. **The ticker.** `TOWN` already trades on this chain, and on seven other tokens
   elsewhere. Nothing breaks technically; it is a discoverability and impersonation
   problem.
