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

## The launch venue: Pons

The token launches on [Pons](https://ponsfamily.com), which deploys a fixed-supply ERC-20
together with its pool in a single transaction and locks the liquidity permanently.

| Contract | Address |
|---|---|
| Swap router | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| V2 fee escrow | `0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e` |
| V2 factory | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` |
| V2 meme hook | `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044` |
| V2 launch locker | `0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952` |
| V1 factory | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` |
| V1 locker | `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| V1 position manager | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |

The swap router is a genuine Uniswap V3 `SwapRouter`: `factory()` and `WETH9()` both
resolve to the addresses in the table above. The adapters trade through it.

### Fees, and why the loop stays permissionless

Pons charges **1%** on trades for a V1 launch, split 70% to the launch creator and 30% to
Pons. So this protocol receives **0.7% of trade value**, not the 1% headline and certainly
not the 3% the original build handoff assumed. That is roughly a quarter of the revenue
the handoff's economics were sketched against. It changes nothing mechanically, and it
changes the size of everything.

Fees do not arrive by themselves. They accrue in a pull-based escrow, and the escrow's
`claim()` and `claimToken(address)` pay `msg.sender`. Verified against the deployed
bytecode: both selectors are present, and there is no `owner()`.

That shape is what keeps the reward loop open to anyone despite the venue naming a single
recipient. The fee router is registered as that recipient; anyone may call the router; the
router is what calls the escrow. No operator's cadence sits between a trade and a holder's
reward.

**This depends on a deployment step, not on code.** The token has to be launched with the
deployed `FeeRouter` as its fee recipient. Until that is done, trading fees accrue to
whatever address was named instead and never reach card holders.

## Still open

1. **V1 or V2.** V1 is a direct Uniswap V3 pool against WETH at a documented 1%/70%. V2
   runs a bonding curve that graduates into a locked Uniswap V4 pool, charges a base fee
   plus an optional creator tax, and allows a wider choice of pairing asset. The escrow
   address above is V2's. The numbers in this document are V1's.
2. **Whether a creator tax is set on a V2 launch, and at what rate.** Fixed at launch,
   unchangeable afterwards.
3. **The ticker.** `TOWN` already trades on this chain and on seven other tokens
   elsewhere. Noted and accepted; it is a discoverability and impersonation matter, not a
   technical one.
