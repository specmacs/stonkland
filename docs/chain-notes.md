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

## Transfer restrictions: none

All four are permissionless ERC-20s. No whitelist, no blocklist, no admitted-holder list.

The fork test moves a real balance from a real holder into a fresh contract, then out of
that contract into another. All four pass. A contract can hold these and pass them on,
which is the whole of the question and the chain is the authority on it.

Worth keeping the test anyway: it is cheap, it runs against the live chain, and it would
catch the day one of these is replaced by something that does gate transfers.

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
| Uniswap V4 pool manager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| V1 factory | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` |
| V1 locker | `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| V1 position manager | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |

The V4 pool manager and the fee escrow were read off the V2 factory and the hook rather
than copied from documentation, and they agree with each other.

The swap router is a genuine Uniswap V3 `SwapRouter`: `factory()` and `WETH9()` both
resolve to the addresses in the table above. The adapters trade through it.

### The V2 launch shape

The launch runs a bonding curve priced in **native ETH**, and graduates into a Uniswap
**V4** pool once the curve is bought out. The graduated pool's own fee is zero; the Pons
hook charges the swap fee instead. Liquidity is locked permanently.

Two consequences worth holding on to:

- The four **reward-asset routes are unaffected**. Those pools are Uniswap V3, verified,
  and the V3 swap router trades them.
- The **buyback route is affected**. It buys TOWN, which lives in a V4 pool, so the V3
  adapters cannot reach it. `UniswapV4Adapter` handles that, talking to the singleton
  directly: there is no usable V4 router here, since the deployed universal router points
  its `poolManager()` at an address with no code on this chain. Until a pool exists the
  buyback forwards everything to the treasury sink rather than reverting.

### Guarding a buyback with no price history

V4 core keeps no observations and the venue's hook exposes none, so the thirty-minute
average that guards the reward-asset routes has no equivalent for TOWN. Two controls stand
in for it, both on `TreasuryBuyback`:

- **A keeper.** Name one address and only it may trigger a buyback, passing a `minOut` it
  worked out by looking at the pool first. This takes away an attacker's ability to choose
  the moment, which is what a buyback sandwich depends on. Clear the keeper and the
  trigger is open to anyone again.
- **A ceiling and a cooldown.** Most that may be spent in one call, and the least time
  between calls. These apply to everybody, keeper included, and they are what bounds the
  cost of a single badly-timed call when no keeper is named.

Start with a keeper while the pool is thin. Standing it down later is one transaction and
adds no new trust.

### Fees, and why the loop stays permissionless

The protocol's trading revenue is the **3% creator tax** this launch sets. It goes to the
launch creator in full, and the launch creator is the fee router.

The venue charges a fee of its own and keeps a share of it, passing the rest to the
creator. That is upside, not budget: the venue sets those terms, can change them, and
does not publish the division. Size the project on the 3%.

A V2 launch adds an **optional creator tax**, set at launch and unchangeable afterwards,
capped at 10% (`maxCreatorTaxBps()` on the factory returns `1000`). It goes to the creator
in full.

**This launch sets it to 3%**, which reaches the fee router in full and is the only fee
figure that appears anywhere a reader sees. It is ours, we set it, and it cannot change.

The venue's own fee is deliberately absent from every user-facing surface. A live V2
curve reads `feeBps() == 100`, but that is one other launch's curve at one moment, not a
commitment about ours, and the venue can change its terms whenever it likes. An inference
of that shape does not belong in a rulebook, and a total trade cost derived from it would
be a claim nobody can stand behind. A share of the venue's fee may well reach the protocol
as the creator's cut; nothing is built on it and nothing promises it.

The creator tax only reaches the protocol if **the fee router is the launch's creator
address**. Get that wrong at launch and the revenue goes somewhere else, permanently.

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

A live V2 launch was inspected to confirm the shape: its token exposes `curve()`, the
curve exposes `feeEscrow()` pointing at the same escrow, `graduated()` reads false while
it is still on the curve, and `creatorTaxBps()` reads zero for a launch that set no tax.
Note that `sweepFees()`, which the documentation mentions, is not present on the deployed
curve under that name — so nothing here is built against it.

## Still open

1. **The creator tax rate**, fixed at launch and unchangeable. See above; it is the
   largest lever on holder revenue.
2. **TOWN's PoolKey**, once the launch graduates. The shape is already known from live
   pools on this venue: `currency0` is the zero address (native ETH), `currency1` is the
   token, `fee` is 0, `tickSpacing` is 60, and `hooks` is the hook the graduation names.
   Read it off the singleton's `Initialize` event and pass it to `UniswapV4Adapter`, then
   `TreasuryBuyback.setAdapter`. Nothing else is touched.
3. **The ticker.** `TOWN` already trades on this chain and on seven other tokens
   elsewhere. Noted and accepted; a discoverability matter, not a technical one.
