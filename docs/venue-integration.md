# Launch venue integration

**For the launchpad / infrastructure team.** This is what StonkTown's contracts require
from the venue the token launches on, what we deploy ourselves, and the order it has to
happen in.

Protocol repo: `specmacs/stonkland`. Target chain: Robinhood Chain (4663), native ETH.
Everything below was read off the Solidity in `contracts/`, not from documentation.

---

## Summary — what we need from you

| # | Requirement | Fixable later? |
|---|---|---|
| 1 | Launch **our** ERC-20, not one you deploy | **No** — wrong token, no game |
| 2 | Name our `FeeRouter` as the launch's creator / fee recipient | **No** — revenue is lost permanently |
| 3 | A pull-based fee escrow exposing `claim()` / `claimToken(address)` that pay `msg.sender` | Yes — optional, see §3 |
| 4 | A Uniswap V3 `SwapRouter`, and V3 pools for the four reward assets | Yes |
| 5 | A tradeable TOWN pool (V3, or V4 + the PoolKey) | Yes — buyback idles until then |

Items 1 and 2 are the ones that cannot be undone. Everything else degrades gracefully.

---

## 1. The token — read this before anything else

**We deploy the token.** `SystemDeployer.deploy()` step 1 constructs `Token.sol` and mints
the entire fixed supply of 1,000,000,000 TOWN to `TOKEN_RECIPIENT` at construction. There
is no mint path afterwards.

The token the venue lists **must be that contract**. It is not interchangeable with a
launchpad-deployed token, because the game burns it:

```solidity
// contracts/src/Minter.sol:110
token.burnFrom(msg.sender, MINT_BURN);            // claiming a card

// contracts/src/ProgressionManager.sol:72
token.burnFrom(msg.sender, burnAmount);           // building a level

// contracts/src/TreasuryBuyback.sol:198
IBurnableERC20(address(token)).burn(bought);      // treasury buyback
```

So the token must implement, at minimum:

```solidity
function burn(uint256 amount) external;
function burnFrom(address account, uint256 amount) external;
function permit(address owner, address spender, uint256 value,
                uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

`Token.sol` is `ERC20 + ERC20Burnable + ERC20Permit`. It deliberately has **no transfer
tax, no fee-on-transfer branch, no blocklist, no pause and no owner**. Those absences are
load-bearing — the burn amounts are exact figures published on the site, and a
fee-on-transfer token would make every one of them a lie.

> ### The question we need answered
>
> **Can your launchpad run a curve and a pool for a token that already exists, with the
> creator tax applied to it?**
>
> Pons V2's normal flow deploys the ERC-20 and the pool in one transaction. If that is the
> only path, it does not work here: a venue-deployed token would not expose `burnFrom`, so
> minting and building would revert and there is no game. We need a bring-your-own-token
> path, or an agreed equivalent.
>
> If you deploy the token instead, it must be byte-identical in behaviour to `Token.sol`
> and we need to review it before launch.

The 3% trading fee is charged by the venue in the pair's quote asset. It has nothing to do
with this contract, and the token has no mechanism for it.

---

## 2. The fee recipient — the one that cannot be fixed

**The deployed `FeeRouter` must be the launch's creator address.**

The protocol's entire trading revenue is the creator tax — set at launch, capped by the
venue at 10% (`maxCreatorTaxBps()` returns `1000`), and **unchangeable by anyone
afterwards, including our owner key**. We set it to 300 bps (3%), and it reaches the
creator in full.

Get the creator address wrong and that revenue accrues to whatever address was named,
forever. There is no recovery path, in our contracts or yours.

This is a deployment step, not code. Order matters: **deploy the protocol first, then
launch the token naming `FeeRouter` as creator.** `FeeRouter`'s address is in the manifest
`Deploy.s.sol` writes out.

The venue's own fee is yours to set and change. We build nothing on it and quote no figure
for it anywhere a user can see.

---

## 3. The fee escrow

Fees do not need to be pushed. We expect a pull-based escrow:

```solidity
interface IFeeEscrow {
    function claim() external;                      // pays msg.sender its native balance
    function claimToken(address token) external;    // pays msg.sender its balance of token
    function balanceOf(address account) external view returns (uint256);
}
```

**Both claims must pay `msg.sender`.** That single property is what keeps our reward loop
permissionless: the router is registered as your named recipient, anyone may call the
router, and the router calls you. No operator's cadence sits between a trade and a card
holder's reward.

`FeeRouter.distribute()` is `external` with no access control. It calls both claims in
`try/catch` and emits `FeeClaimSkipped(what, reason)` on failure rather than reverting —
we expect reverts in normal operation, because a venue with nothing credited reverts rather
than returning zero.

**This is optional.** `feeEscrow` may be the zero address; the constructor allows it. If
your venue pushes fees straight to the recipient, leave it unset and the router works on
whatever lands in it. Native value is accepted via `receive()` and wrapped to WETH.

Both native and WETH are claimed, so a pair quoted in either works.

---

## 4. Swap infrastructure

Two independent routes with different requirements.

### Reward assets (four of them) — Uniswap V3

Each district pays in a tokenized equity. The vault converts WETH → asset through an
adapter implementing:

```solidity
interface IAcquisitionAdapter {
    function asset() external view returns (address);
    function inputToken() external view returns (address);
    function convert(uint256 amountIn, uint256 minOut, uint256 deadline, address recipient)
        external returns (uint256 received);
}
```

Requires a genuine Uniswap V3 `SwapRouter` — we check `factory()` and `WETH9()` resolve
correctly — plus a V3 pool per asset. Current router:
`0xCaf681a66D020601342297493863E78C959E5cb2`.

There are **no price feeds on this chain**, so `UniswapV3TwapAdapter` prices against the
route's own 30-minute average and bounds both the pool's deviation from it and the trade's
own impact. If a real feed ever exists, `UniswapV3Adapter` is the better choice and the
vault swaps between them without touching accounting.

### Buyback (TOWN) — V3 or V4

20% of treasury revenue buys TOWN and burns it. If TOWN graduates into a **Uniswap V4**
pool, the V3 adapters cannot reach it, and there is no usable V4 router on this chain —
the deployed universal router points `poolManager()` at an address with no code. So
`UniswapV4Adapter` talks to the singleton directly and needs TOWN's full `PoolKey`.

**What we need from you at graduation:** the `PoolKey` — `currency0`, `currency1`, `fee`,
`tickSpacing`, `hooks`. We can recover it by searching the singleton
(`script/dev/FindPoolKey.s.sol`), but being told is faster and less error-prone.

Until an adapter is wired, the buyback **forwards everything to the treasury sink rather
than reverting**. Nothing stalls; it simply does not buy back yet.

---

## 5. Deployment order

`SystemDeployer.deploy()` is a library so the script and the tests run identical code.
Order is constrained by immutables — several contracts take another's address at
construction and will accept deposits from nothing else.

1. `Token` — full supply minted to `TOKEN_RECIPIENT`
2. `RevenueVault` → `Distributor` → `EditionRegistry` (vault first; the distributor's
   depositor is immutable), then `setRegistry` / `linkDistributor` / `linkRegistry`
3. `AllocationController` — 2,500 bps per district, frozen, no setter anywhere
4. `TreasuryBuyback` → `StreamVault` → `FeeRouter`. Note the router's treasury leg points
   at the **buyback**, not at `TREASURY_SINK` — the buyback takes its share and forwards
   the remainder to the sink.
5. `PropertyNFT`, `TransferHook`, `Minter`, `ProgressionManager`, `RoyaltyRouter`,
   `MetadataRenderer`
6. One-time links, each reverting on a second attempt: `linkSettlementHook`, `linkMinter`,
   `linkProgressionManager`, `linkRoyaltyReceiver`, `setRenderer`
7. `registerEdition(1, …)` — freezes the edition's asset set
8. `transferOwnership` on all seven ownable contracts to `OWNER`

**The system is left with the minter paused. Unpausing the minter is the launch.**

Required env (`vm.envUint` / `vm.envAddress` — no defaults, deploy fails without them):
`OWNER`, `TREASURY_SINK`, `TOKEN_RECIPIENT`, `WETH`, `BUYBACK_BPS`,
`WEIGHT_MULTIPLIER_BPS`, `IMAGE_BASE_URI`, `EXTERNAL_BASE_URI`,
`REWARD_ASSET_Q1`…`Q4`.

Optional: `FEE_ESCROW` (defaults to zero), `BUYBACK_RECIPIENT` (must be zero when
`BUYBACK_BURNS` is true), `TOKEN_NAME`/`TOKEN_SYMBOL`/`NFT_NAME`/`NFT_SYMBOL`.

Rehearse with `--fork-url` and diff the manifest before broadcasting.
`script/DeploymentChecks.sol` verifies every published number against what actually
landed, and can be re-run later by somebody who did not do the deploying.

---

## 6. Post-launch wiring — currently unscripted

These steps are **not** covered by `Deploy.s.sol`. Someone has to do them by hand, and
the reward pipeline does not complete until the first group is done.

**Reward adapters — four, required.** Deploy one `UniswapV3TwapAdapter` per reward asset
and call `revenueVault.setAdapter(1, quarter, asset, adapter)` for each. `onlyOwner`. The
vault checks the adapter's `asset()` against the registry's frozen list and rejects a
mismatch.

Until these exist, WETH accumulates in the vault and converts to nothing. Everything
upstream (fee claim, split, streams) keeps working.

> **Gap worth closing:** the only non-test code that constructs these adapters is
> `DeployLocal.s.sol`, which refuses to run anywhere but a local chain. There is no
> mainnet script for this step. Worth writing one before launch rather than doing it by
> hand on the day.

**Buyback, after graduation.** `script/DeployV4Buyback.s.sol` recovers the PoolKey,
deploys `UniswapV4Adapter`, and calls `buyback.setAdapter`. Then `setKeeper` and
`setLimits`. All `onlyOwner`.

**Buyback guards.** V4 core keeps no observations and the venue's hook exposes none, so
the 30-minute average guarding the reward routes has no equivalent for TOWN. Two controls
stand in, both on `TreasuryBuyback`:

- `setKeeper(address)` — only that address may trigger a buyback, passing a `minOut` it
  worked out by looking at the pool first. Removes an attacker's ability to choose the
  moment, which is what a sandwich depends on. Set to zero and the trigger is open to
  anyone again.
- `setLimits(maxSpendPerCall, cooldown)` — applies to everyone, keeper included. Bounds
  what one badly-timed call can cost.

Start with a keyed keeper while the pool is thin. Standing it down later is one
transaction and adds no new trust.

---

## 7. Two defects in our own config, before anyone follows it

Both found while writing this. Neither is in deployed code; both would bite during launch.

**`contracts/.env.example` names the wrong variable for the fee escrow.** It documents
`FEE_SOURCE`; `Deploy.s.sol:50` reads `vm.envOr("FEE_ESCROW", address(0))`. Nothing reads
`FEE_SOURCE`. Set it and the router deploys with no escrow — silently, no revert — and
trading fees accrue in the venue's escrow and are never pulled. `distribute()` still
appears to work on anything that arrives directly, which is what makes it dangerous.

**`SWAP_ROUTER` in `.env.example` is read by nothing.** Only the fork test uses the literal
address. It is a note to a human, not configuration, and reads as though setting it wires
something up. Related to the missing adapter script in §6.

---

## 8. Open questions for you

1. **Bring-your-own-token.** §1. Blocks everything else.
2. **Creator tax mechanics.** We set 300 bps. Confirm it is settable at launch on a token
   we deployed, goes to the creator in full, and cannot be changed afterwards by anyone.
3. **Fee escrow address** for this launch, or confirmation that fees are pushed to the
   creator directly — in which case we leave `FEE_ESCROW` unset.
4. **Graduation.** What triggers it, and will you give us TOWN's `PoolKey` at that moment
   or should we read it off the singleton's `Initialize` event?
5. **Curve denomination.** We understand the curve is priced in native ETH and the
   graduated pool's own fee is zero, with the hook charging instead. Confirm.

---

## Reference

- [`docs/chain-notes.md`](chain-notes.md) — every venue address, how each was established,
  and what was verified against deployed bytecode rather than documentation
- [`contracts/.env.example`](../contracts/.env.example) — annotated deployment config
- [`contracts/script/SystemDeployer.sol`](../contracts/script/SystemDeployer.sol) — the
  deployment sequence, as code
- [`contracts/test/fork/`](../contracts/test/fork/) — the fork tests that verified the
  venue addresses, the reward assets' lack of transfer restrictions, and the escrow's
  `msg.sender` behaviour

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
  forge test --match-path 'test/fork/*' -vv
```
