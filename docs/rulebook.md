# The Rulebook

Stocktown · Founding Edition. 400 property cards across four quarters. Every figure below matches the deployed contracts, and TOWN is the token throughout.

## What this is

A board game that settles onchain. There are 400 property cards and there will never be more. Each belongs to one of four quarters of the city, 100 to a quarter. You acquire a card by destroying tokens, and you improve it by destroying more. An improved card carries more weight, and weight decides how the quarter's incoming rewards are divided among the cards inside it.

Nothing here pays a rate. There is no schedule of returns and no promise that rewards arrive at all. What the protocol distributes is what it actually received, split according to weight. If it receives nothing, it distributes nothing.

## The token

Supply is fixed at one billion and there is no function capable of creating more. The only direction supply can move is down, because every mint and every upgrade destroys tokens permanently.

Moving tokens between wallets costs nothing and always will: there is no transfer tax in this token, and no function that could add one. Trading is where the fee is. The venue the token launches on charges 1% on trades, in the pair's quote asset rather than in tokens, and keeps part of it. This protocol receives the launch creator's share, 70% of that fee, which works out at 0.7% of what trades. That, and the card resale royalty below, is the whole of the protocol's revenue.

20% of the treasury's share is spent buying the token on the open market, and everything bought is destroyed. Anyone can trigger it. This recycles revenue the protocol already earned — it does not create revenue, and it is not a return. What it does do is make the treasury's share a second route by which supply falls and can never rise.

## The cards

There are 400 cards, divided evenly into four quarters of 100, each laid out as a 10×10 grid. A card's quarter is fixed at mint and can never change.

Minting destroys 100,000 tokens. Each wallet may mint 3 cards directly from the protocol. That is a limit on primary mints, not on ownership — you may buy as many cards as you like from other holders.

Every card starts as a House at level one, carrying a weight of 125.

No cards are reserved. There is no team allocation, no founder set, and no owner mint — the contracts contain no function that can create a card outside the 3-per-wallet mint everyone else uses, so anything the team holds was minted or bought on the same terms as yours.

Cards resell with a 5% royalty, which is routed into rewards rather than to anyone's pocket. It is the one revenue source that does not depend on token trading volume.

## Building

A card climbs through five forms. Each step destroys tokens and permanently raises the card's weight.

| Level | Form | Weight | Cost to reach |
|---|---|---|---|
| 1 | House | 125 | 100,000 (mint) |
| 2 | Residence | 200 | 500,000 |
| 3 | Building | 312 | 1,000,000 |
| 4 | Tower | 456 | 1,500,000 |
| 5 | Landmark | 625 | 2,000,000 |

Levels must be taken in order. A card cannot skip a level, cannot be reduced, and cannot be reset. Only the current owner can upgrade a card. Taking a card from House to Landmark destroys 5,100,000 tokens in total, the mint included.

Reaching the top is rare by arithmetic, not by policy: building every card to Landmark would take more tokens than will ever exist. Most cards will never get there, and the ones that do will be few.

> Upgrading is irreversible. Tokens spent on an upgrade are gone, and the only thing you receive in return is a higher share of whatever the quarter happens to receive afterward. Treat it as spending, not as depositing.

## Weight

Yield Weight is a card's score inside its quarter, and nothing else. It is not a rate, not a yield, and not a claim on anything outside the quarter's pool.

When rewards arrive in a quarter, they are divided among that quarter's cards in proportion to weight. A Landmark carries five times the weight of a House, so it receives five times the share of the same deposit. If the deposit is small, five times a small number is still a small number. If there is no deposit, weight determines nothing.

Weight only matters relative to the other cards in the same quarter. As other owners build, your share of each deposit falls even though your weight hasn't changed. This is the central tension of the game and it is intentional.

The exact weights for this edition are 125, 200, 312, 456, 625. They are the base schedule multiplied by this edition's 1.25×, with fractions truncated, which is why levels three and four read 312 and 456 rather than half-units. The ratio the paragraph above promises holds exactly: 625 is five times 125.

## How rewards reach a card

Trading fees accumulate at the venue. From there:

1. Anyone can trigger the claim that pulls accrued fees into the protocol.
2. The router splits them on fixed terms: one third to the treasury, two thirds to rewards.
3. The rewards portion is wrapped and funded into 300-second streams, so a single large sweep is spread across time rather than landing entirely on whoever upgraded a minute earlier.
4. As streams mature, the proceeds are converted into each quarter's reward asset through fixed routes, with price-oracle checks that will reject the conversion rather than accept a bad one.
5. Converted rewards are deposited to the distributor, where cards accrue against them by weight.

Every step is permissionless. No operator has to act for you to be paid, and no one can redirect a deposit once it is made. Steps can stall — a conversion may fail if liquidity is thin, and the funds simply wait until it succeeds.

Each quarter is allocated an equal share and converts independently. A quarter with no minted cards accrues its share as a reserve rather than passing it to the others.

## Claiming, holding, selling

Rewards accrue to the card, but they are settled to a wallet. Whenever a card is transferred, upgraded, or claimed against, the protocol settles what has accrued so far and credits it to the current owner.

> This has one consequence worth understanding before you sell. Amounts already credited to your wallet stay with your wallet — they do not transfer with the card. Amounts pending on a card at the moment of sale are settled to you as the seller during the transfer. The buyer begins accruing from that point and shares only in deposits that arrive afterward. A marketplace will not explain this to either of you.

## Later editions, and what they cost you

This is the Founding Edition. It will not be the only one, and you should know how a later edition affects this one before you buy into this one.

Later editions are separate collections, minted with the same token, each with its own card supply, its own mint cost, and its own fixed set of reward assets. Fees from trading land in one shared pot. That pot is divided between editions in proportion to each edition's total weight, and each edition's portion buys only that edition's own assets.

> Every new edition adds weight to the shared pot, so every existing card's share of future fees falls. That is not a side effect, it is the mechanism. The Founding Edition carries a 1.25× weight multiplier, which makes its share fall 20% slower than an edition without one — it does not stop it falling.

You will never be paid in another edition's asset, and another edition's asset going bad cannot reach into yours. An edition's asset set is fixed when it is deployed and has no setter; adding an asset means registering a new edition, which everyone can see onchain.

## What cannot be changed

Once deployed, no one — including whoever holds the key — can create tokens or cards beyond the caps, restore destroyed supply, alter a level, weight, or quarter, change the fee split, the stream duration, or the quarter allocation, withdraw or redirect deposited rewards, or touch any edition's weight multiplier or asset set. All of this is demonstrable from the verified source.

Administrative control is limited to pausing minting, upgrades, and conversion; swapping the metadata renderer, which is presentation only; replacing a conversion route, which can change how an asset is bought but never which asset you receive; adjusting the share of treasury revenue spent on buybacks, which cannot touch the rewards leg; and registering a new edition. Whether bought tokens are burned or kept is not on that list — it is fixed at deployment and readable from the verified source.

> Registering a new edition is the one discretionary power in this system, and it shifts future fee share toward the new edition and away from yours. It is held by a single externally owned account with no timelock and no multisig. That is the owner's deliberate choice, stated here rather than buried: if that key is compromised, someone can register an edition; if it is lost, no future edition can ever be registered. This protocol should not be described as decentralised or trustless in administrative terms, because it is neither.

Token transfers and card transfers cannot be paused by anyone, including the key holder. Your ability to move what you own is not conditional on anyone's cooperation.

## Risks

Read this part twice.

- The token may lose value, and the cards may prove worth less than what was destroyed to build them.
- Upgrade costs are permanent and unrecoverable regardless of what happens afterward.
- Rewards depend entirely on trading activity and card resales. If no one trades and no one sells, nothing is distributed.
- Conversions depend on liquidity in the reward asset and can fail or execute poorly.
- Smart contracts can contain flaws that audits do not catch.
- Each reward asset is a token tracking a share price, issued by somebody else. It can lose value with the share, it depends on its issuer continuing to back it, and its onchain market can thin out or disappear. None of that is within this protocol's control.
- A single key holds every administrative role, with no timelock standing between a decision and its effect.
- Each new edition permanently reduces your share of future fees.
- Regulatory treatment of assets like these is unsettled and may change.

This is a game with real economic stakes and no safety net. Nothing here is investment advice, and nothing here is a promise.

---

_Generated from `web/lib/rulebook.ts`. Edit that file, then run `npm run gen:rulebook`._
