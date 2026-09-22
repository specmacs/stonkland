# Data sources

Every figure the interface shows, where it comes from, and what happens when it cannot be
obtained.

There are exactly three kinds of number on this site and they are never mixed:

| Kind | Where it comes from | When it is unavailable |
| --- | --- | --- |
| **Reading** | A contract call made when the page loads | The figure is withheld and the page says the read did not succeed. It never falls back to a cached, estimated or default value. |
| **Parameter** | A constant compiled into a contract, mirrored in `web/lib/brand.ts` | Always available. Every block of them carries a `Parameters` marker saying it is not a reading. `web/scripts/check-parameters.mjs` fails the build if any has drifted from the contract it mirrors. |
| **Venue parameter** | Set on the launch venue when the token is created, outside these contracts | Marked separately, with a note saying it is checkable against the token itself. There is exactly one: the trade tax. |

No figure on this site is a projection, an annualisation, a rate, or an estimate. There is
no code path that produces one.

---

## Readings, by hook

Each hook batches its calls through multicall and returns a `ReadState` discriminated
union — `unconfigured` / `loading` / `error` / `ready`. `ReadGate` is the only component
that unwraps one, so there is structurally no way to render a figure from a read that did
not succeed.

### `useBoardCounts` — the board, the mint picker

| Field | Call | Contract |
| --- | --- | --- |
| `total` | `totalSupply()` | PropertyNFT |
| `cardSupply` | `MAX_SUPPLY()` | PropertyNFT |
| `quarterCap` | `QUARTER_CAP()` | PropertyNFT |
| `perQuarter[q]` | `mintedInQuarter(q)` | PropertyNFT |

The caps are read rather than taken from config so that `3 / 400` is one claim, not two.
Half of a fraction arriving from a build-time constant is the seam where a page starts
describing a system other than the one deployed.

### `useQuarterCards` — the board grid

Per minted id only. An unminted plot is never read and never given a placeholder.

| Field | Call | Contract |
| --- | --- | --- |
| `quarter`, `level`, `weight`, `burned` | `propertyOf(id)` | PropertyNFT |
| `owner` | `ownerOf(id)` | PropertyNFT |

A card whose read fails is omitted from the grid rather than drawn half-known.

### `useCard` — `/board/[id]`

Same two calls for one id, returning `CardState | null`. The `null` is load-bearing: a
token that has never been minted reverts **both** calls, and that is an answer. A batch
that fails is a read failure, and that is not. Collapsing the two would let the page tell
somebody a card had never been minted at the exact moment it had no way of knowing. If
exactly one of the two calls comes back, nothing sensible can be said about a card that
half exists, and the page reports rather than guesses.

### `useMintState` — the mint control

| Field | Call | Contract |
| --- | --- | --- |
| `open` | `mintOpen()` | Minter |
| `paused` | `paused()` | Minter |
| `remainingForWallet` | `remainingMints(wallet)` | Minter |
| `walletBalance` | `balanceOf(wallet)` | Token |
| `allowance` | `allowance(wallet, minter)` | Token |
| `mintBurn`, `mintsPerWallet` | `MINT_BURN()`, `MINTS_PER_WALLET()` | Minter |

Fails closed: if launch and pause state cannot be verified, the mint button is disabled and
says so. It is never enabled on the assumption that minting is probably open.

### `useOwnedCards` — `/cards`

| Field | Call | Contract |
| --- | --- | --- |
| card count | `balanceOf(wallet)` | PropertyNFT |
| each id | `tokenOfOwnerByIndex(wallet, i)` | PropertyNFT |
| level, weight, burn | `propertyOf(id)` | PropertyNFT |
| next level cost | `nextUpgrade(id)` | ProgressionManager |
| pending rewards | `pendingOf(edition, asset, id)` | Distributor |

### `useQuarterStandings` — `/rent`

| Field | Call | Contract |
| --- | --- | --- |
| `walletWeight`, `quarterWeight` | `quarterWeight(edition, q)` + owned cards | Distributor |
| `totalDeposited` | `totalDeposited(edition, asset, q)` | Distributor |
| `totalClaimed` | `totalClaimed(edition, asset, q)` | Distributor |
| `reserve` | `reserveOf(edition, asset, q)` | Distributor |
| `creditedToWallet` | `creditedOf(edition, asset, q, wallet)` | Distributor |
| `pendingOnCards` | summed `pendingOf` over the wallet's cards | Distributor |

A row that did not fully read back is marked incomplete rather than shown as though it were.

### `useRewardAssets` — everywhere an asset is named beside a live figure

`symbol()` and `decimals()` on each configured reward asset. The **symbol displayed beside
any live amount is always this read**, never the name in config. An asset with no
configured address shows "not configured", and every amount that would have been
denominated in it shows an em dash — which means the figure has no asset behind it or its
read did not succeed, and never means zero.

### `useProtocolStats` — `/stats`

| Field | Call | Contract |
| --- | --- | --- |
| `tokenSupply` | `totalSupply()` | Token |
| `tokenMaxSupply` | `MAX_SUPPLY()` | Token |
| `cardsMinted` | `totalSupply()` | PropertyNFT |
| `cardSupply`, `quarterCap` | `MAX_SUPPLY()`, `QUARTER_CAP()` | PropertyNFT |
| `perQuarterMinted[q]` | `mintedInQuarter(q)` | PropertyNFT |
| `perQuarterWeight[q]` | `quarterWeight(edition, q)` | Distributor |
| `editionWeight` | `editionWeight(edition)` | Distributor |
| `protocolWeight` | `protocolWeight()` | Distributor |
| `feeRouterPending` | `distributable()` | FeeRouter (ether **and** wrapped ether) |
| `treasuryLiability` | `treasuryLiability()` | FeeRouter (ether) |
| `streamReleasable` | `releasable()` | StreamVault |
| `streamUnmatured` | `unmatured()` | StreamVault |
| `vaultUnallocated` | `unallocated()` | RevenueVault (ether **and** wrapped ether) |
| `vaultPerQuarterPending[q]` | `quarterPending(edition, q)` | RevenueVault |
| `depositedPerQuarter[q]` | `totalDeposited(edition, asset, q)` | Distributor |
| `claimedPerQuarter[q]` | `totalClaimed(edition, asset, q)` | Distributor |

Supply, max supply, cards minted, edition weight and protocol weight are load-bearing: if
any of the five fails, the whole page reports the failure rather than rendering a partial
picture as though it were whole. The pipeline figures are individually optional and each
shows "not read" on its own.

### `useBuybackState` — the treasury buyback panel

| Field | Call | Contract |
| --- | --- | --- |
| `bps` | `buybackBps()` | TreasuryBuyback |
| `burns` | `burnsBought()` | TreasuryBuyback |
| `keeper` | `keeper()` | TreasuryBuyback |
| `maxSpendPerCall`, `cooldown` | `maxSpendPerCall()`, `cooldown()` | TreasuryBuyback |
| `lastExecutedAt` | `lastExecutedAt()` | TreasuryBuyback |
| `available` | `available()` | TreasuryBuyback |
| `callerMayExecute` | `canExecute(wallet)` | TreasuryBuyback |

The interface makes claims about the buyback — the share spent, that what it buys is
destroyed, who may trigger it — and until this hook existed every one of them was copy
with nothing behind it. A claim the reader cannot check against the chain is one this
interface should not be making.

### `useBuildState` — the build control

| Field | Call | Contract |
| --- | --- | --- |
| `paused` | `paused()` | ProgressionManager |
| `walletBalance` | `balanceOf(wallet)` | Token |
| `allowance` | `allowance(wallet, manager)` | Token |

The same three questions the mint asks, for the same reason: a build destroys up to two
million tokens, and finding out in the wallet that the allowance was short is worse than a
button that says so beforehand. If `paused` cannot be read, building is disabled — the
control is never enabled on the assumption that it is probably not paused.

### Royalty router pending — pipeline stage 5

`pending()` on RoyaltyRouter, read separately because it is the one stage not already in
the stats batch. Counts ether and wrapped ether alike.

### A note on units

The pipeline wraps as it goes, so different stages hold ether, wrapped ether, or both.
Every stage figure is labelled **ETH** and the section says it counts both, because a
stage holding either is holding the same value and labelling half the column WETH would
imply a distinction that does not exist. Reward amounts after conversion are denominated
in the reward asset, whose symbol is always read from that asset's own contract.

---

## Writes

Every write goes through `TxButton`, which refuses to fire unless it has an address, the
wallet is connected, and the wallet is on the configured chain. A control that cannot be
used says why, in place, rather than failing in the wallet.

| Control | Call | Contract | Disabled when |
| --- | --- | --- | --- |
| Approve (mint) | `approve(minter, max)` | Token | Minter address absent |
| Mint card | `mint(quarter)` | Minter | Not open onchain · wallet out of primary mints · balance below the burn · allowance below the burn · any of those reads failed |
| Approve (build) | `approve(manager, max)` | Token | Manager address absent |
| Build | `build(tokenId)` | ProgressionManager | Card at max level · building paused onchain · pause state unreadable · balance below the burn · allowance below the burn |
| Claim quarter | `claimQuarter(edition, q, 0, 0)` | Distributor | Nothing pending **and** nothing credited · **or** either of those figures failed to read, in which case it says the answer is unknown rather than that the answer is no |
| Claim and split | `distribute()` | FeeRouter | Nothing waiting · state unreadable |
| Release | `release()` | StreamVault | Nothing matured · state unreadable |
| Allocate | `allocate()` | RevenueVault | Nothing unallocated · state unreadable |
| Convert | `processQuarter(edition, q, [0], deadline)` | RevenueVault | Nothing waiting in that quarter · state unreadable · **vault paused** (processor only) · pause state unreadable |
| Forward | `forward()` | RoyaltyRouter | Nothing waiting · state unreadable |

### Who may actually call these

Not uniform, and the interface must not imply that it is.

| Stage | Contract | Who |
| --- | --- | --- |
| Claim and split, retry treasury | FeeRouter | Anyone, always. No owner, no pause. |
| Release | StreamVault | Anyone, always. No owner, no pause. |
| Forward royalties | RoyaltyRouter | Anyone, always. No owner, no pause. |
| Allocate, Convert | RevenueVault | Anyone while running; the named `processor` only while paused. |
| Mint | Minter | Anyone while open and unpaused. |
| Build | ProgressionManager | The card's owner, while unpaused. |
| Claim | Distributor | The wallet being claimed for. |

`RevenueVault.paused()` is read into `vaultPaused` and disables Allocate and Convert with
a reason, rather than letting the wallet deliver the refusal.

The mint and the build both carry an explicit confirmation naming the exact burn, because
both are irreversible. The approve control appears only while an approval is actually
needed.

Zero minimums on `processQuarter` are safe: the adapter enforces its own floor underneath
whatever a caller passes, and a caller can only tighten it.

Every one of these is permissionless on chain. They are in the interface because a
protocol whose rewards move only when its team runs a script has an operator whether it
admits to one or not.

---

## Links

| Link | Target | Behaviour |
| --- | --- | --- |
| Nav, footer, in-page | Internal routes | Always available |
| Buy TOKEN | `NEXT_PUBLIC_POOL_URL` | Renders **disabled** with a reason when unset. Never guesses a market URL. |
| X | `NEXT_PUBLIC_X_URL` | Omitted entirely when unset |
| Board cell | `/board/[id]` via the detail dialog | Only minted cells are clickable |
| Rulebook contents | Same-page anchors | Always available |

---

## Parameters

Mirrored in `web/lib/brand.ts`, checked against the Solidity by
`web/scripts/check-parameters.mjs`, which runs on every build.

| Parameter | Contract constant |
| --- | --- |
| Fixed supply | `Token.MAX_SUPPLY` |
| Cards, ever | `PropertyNFT.MAX_SUPPLY` |
| Cards per quarter | `PropertyNFT.QUARTER_CAP` |
| Quarters | `PropertyNFT.QUARTER_COUNT` |
| Primary mints per wallet | `Minter.MINTS_PER_WALLET` |
| Mint burn | `Minter.MINT_BURN` |
| Level weights | `ProgressionLib.baseWeight` × the edition multiplier |
| Build burns | `ProgressionLib.burnToReach` |
| Form names | `ProgressionLib.formName` |

Also checked, and previously miscategorised here as deployment arguments when they are
compiled constants:

| Parameter | Contract constant |
| --- | --- |
| Fee split, treasury leg | `FeeRouter.TREASURY_BPS` |
| Fee split, rewards leg | `FeeRouter.REWARDS_BPS` (and the two must total 10,000) |
| Stream epoch | `StreamVault.EPOCH` |
| Card resale royalty | `PropertyNFT.ROYALTY_BPS` |
| Owner-restricted function count | counted across all of `src/` |

Genuinely deployment arguments, set by `SystemDeployer` from required environment
variables and verifiable against the deployed contracts:

- Quarter allocation, 25% each
- Treasury buyback share — **read live** on the protocol page
- Edition weight multiplier, 1.25×

`BUYBACK_BPS` and `WEIGHT_MULTIPLIER_BPS` have no defaults in the deploy script. Both are
figures the interface publishes, and a deploy that silently fell back to a different
number would leave the copy describing a system nobody deployed.

## Configuration that is not a figure

- **Quarter reward asset names** (NVIDIA, Alphabet, Apple, Meta) are written in
  `brand.ts` and used **only** in explanatory copy about the design. Anywhere a live
  amount is shown, the symbol beside it is read from the asset contract. A name in config
  dressed up as chain state would be lying about the one thing this interface promises not
  to do.
- **Launch phase** is set by `NEXT_PUBLIC_LAUNCH_PHASE`, deliberately rather than guessed,
  and the notice says so. The interface could infer it from whether a pool address is
  configured, and a wrong guess would tell somebody the launch had reached a stage it had
  not.
- **Chain name** is the configured chain. When none is configured the header says so and
  every transaction control is disabled.

## Not shown, ever

- APY, projected returns, annualised figures, or any rate. There is no code path that
  computes one.
- A placeholder token id, owner, level, weight, or reward amount.
- A cached or estimated metric presented as live.
- A default that stands in for a failed read.
- A third-party request. WalletConnect is only offered when a project id is configured,
  because its library contacts its own servers on page load whether or not anyone opens
  it — which, with no project id, was telemetry in exchange for a connector that could not
  work. Verified with a network trace across every page: zero requests leave the origin. In particular **no failed read is ever
  coalesced to zero** — not a balance, not a quarter's minted count, not a pending or
  credited amount. Zero and "did not read" are different facts and the interface keeps
  them apart, in the type system rather than by convention: every such field is
  `bigint | undefined`, so a display site that forgets to handle the difference does not
  compile.
