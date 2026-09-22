import {BRAND, EDITION, LEVELS, OWNER_FUNCTION_COUNT} from "./brand";

/**
 * The rulebook, in one place.
 *
 * Rendered at /rulebook and emitted to docs/rulebook.md by scripts/gen-rulebook.mjs, so
 * the page a player reads and the document in the repository cannot drift apart.
 *
 * Numbers interpolate from `brand.ts`, which mirrors the deployed constants. Nothing here
 * restates a figure by hand.
 */

export type Block =
  | {kind: "p"; text: string}
  | {kind: "list"; items: string[]}
  | {kind: "ol"; items: string[]}
  | {kind: "table"; head: string[]; rows: string[][]}
  | {kind: "callout"; text: string};

export type Section = {id: string; heading: string; blocks: Block[]};

const T = BRAND.tokenTicker;
const quarter = BRAND.groupTerm.toLowerCase();
const quarters = BRAND.groupTermPlural.toLowerCase();
const card = BRAND.itemName.toLowerCase();
const n = (v: number) => v.toLocaleString("en-US");

export const RULEBOOK: Section[] = [
  {
    id: "what-this-is",
    heading: "What this is",
    blocks: [
      {
        kind: "p",
        text: `A board game that settles onchain. There are ${n(EDITION.cardSupply)} ${card}s and there will never be more. Each belongs to one of four ${quarters} of the city, ${n(EDITION.quarterCap)} to a ${quarter}. You acquire a card by destroying tokens, and you improve it by destroying more. An improved card carries more weight, and weight decides how the ${quarter}'s incoming rewards are divided among the cards inside it.`,
      },
      {
        kind: "p",
        text: `Nothing here pays a rate. There is no schedule of returns and no promise that rewards arrive at all. What the protocol distributes is what it actually received, split according to weight. If it receives nothing, it distributes nothing.`,
      },
    ],
  },
  {
    id: "the-token",
    heading: "The token",
    blocks: [
      {
        kind: "p",
        text: `Supply is fixed at one billion and there is no function capable of creating more. The only direction supply can move is down, because every mint and every upgrade destroys tokens permanently.`,
      },
      {
        kind: "p",
        text: `Moving tokens between wallets costs nothing and always will: there is no transfer tax in this token, and no function that could add one. Trading is where the fee is, and it is charged in the asset the pair is priced in rather than in tokens.`,
      },
      {
        kind: "p",
        text: `This launch sets a ${EDITION.creatorTaxPercent}% tax on trades, and that ${EDITION.creatorTaxPercent}% reaches the protocol in full. It is fixed at the moment the token is created and cannot be changed by anyone afterwards, including whoever holds the key. It lives on the launch venue rather than in these contracts, so it is checkable against the token itself.`,
      },
      {
        kind: "p",
        text: `The venue charges a fee of its own as well. That one belongs to the venue — they set it, they can change it, and it is not this protocol's to quote, so no figure for it appears here. Part of it may reach the protocol too. Nothing in this rulebook counts on that, and neither should you: ${EDITION.creatorTaxPercent}% of what trades is the number to hold this protocol to. That, and the card resale royalty below, is the whole of its revenue.`,
      },
      {
        kind: "p",
        text: `${EDITION.buybackBps / 100}% of the treasury's share is spent buying the token on the open market, and everything bought is destroyed. Whether anybody can trigger that, or only a named keeper, is set by the owner and readable onchain — a keeper exists because a buyback fired at a bad moment spends the treasury badly, and the same setting carries a ceiling per call and a cooldown between them. What is not adjustable is where the tokens go. That is fixed when the buyback contract is constructed and has no setter: this deployment fixes it to destroy everything bought, so there is no recipient it could be pointed at instead.`,
      },
    ],
  },
  {
    id: "the-cards",
    heading: "The cards",
    blocks: [
      {
        kind: "p",
        text: `There are ${n(EDITION.cardSupply)} cards, divided evenly into four ${quarters} of ${n(EDITION.quarterCap)}, each laid out as a ${EDITION.gridSize}×${EDITION.gridSize} grid. A card's ${quarter} is fixed at mint and can never change.`,
      },
      {
        kind: "p",
        text: `Minting destroys ${n(EDITION.mintBurn)} tokens. Each wallet may mint ${EDITION.mintsPerWallet} cards directly from the protocol. That is a limit on primary mints, not on ownership — you may buy as many cards as you like from other holders.`,
      },
      {
        kind: "p",
        text: `Every card starts as a ${LEVELS[0]?.form} at level one, carrying a weight of ${LEVELS[0]?.weight}.`,
      },
      {
        kind: "p",
        text: `No cards are reserved. There is no team allocation, no founder set, and no owner mint — the contracts contain no function that can create a card outside the ${EDITION.mintsPerWallet}-per-wallet mint everyone else uses, so anything the team holds was minted or bought on the same terms as yours.`,
      },
      {
        kind: "p",
        text: `Cards resell with a ${EDITION.royaltyBps / 100}% royalty, which is routed into rewards rather than to anyone's pocket. It is the one revenue source that does not depend on token trading volume.`,
      },
    ],
  },
  {
    id: "building",
    heading: "Building",
    blocks: [
      {
        kind: "p",
        text: `A card climbs through five forms. Each step destroys tokens and permanently raises the card's weight.`,
      },
      {
        kind: "table",
        head: ["Level", "Form", "Weight", "Cost to reach"],
        rows: LEVELS.map((l) => [
          String(l.level),
          l.form,
          String(l.weight),
          l.level === 1 ? `${n(l.burnToReach)} (mint)` : n(l.burnToReach),
        ]),
      },
      {
        kind: "p",
        text: `Levels must be taken in order. A card cannot skip a level, cannot be reduced, and cannot be reset. Only the current owner can upgrade a card. Taking a card from ${LEVELS[0]?.form} to ${LEVELS[4]?.form} destroys ${n(LEVELS[4]?.cumulativeBurn ?? 0)} tokens in total, the mint included.`,
      },
      {
        kind: "p",
        text: `Reaching the top is rare by arithmetic, not by policy: building every card to ${LEVELS[4]?.form} would take more tokens than will ever exist. Most cards will never get there, and the ones that do will be few.`,
      },
      {
        kind: "callout",
        text: `Upgrading is irreversible. Tokens spent on an upgrade are gone, and the only thing you receive in return is a higher share of whatever the ${quarter} happens to receive afterward. Treat it as spending, not as depositing.`,
      },
    ],
  },
  {
    id: "weight",
    heading: "Weight",
    blocks: [
      {
        kind: "p",
        text: `${BRAND.scoreTerm} is a card's score inside its ${quarter}, and nothing else. It is not a rate, not a yield, and not a claim on anything outside the ${quarter}'s pool.`,
      },
      {
        kind: "p",
        text: `When rewards arrive in a ${quarter}, they are divided among that ${quarter}'s cards in proportion to weight. A ${LEVELS[4]?.form} carries five times the weight of a ${LEVELS[0]?.form}, so it receives five times the share of the same deposit. If the deposit is small, five times a small number is still a small number. If there is no deposit, weight determines nothing.`,
      },
      {
        kind: "p",
        text: `Weight only matters relative to the other cards in the same ${quarter}. As other owners build, your share of each deposit falls even though your weight hasn't changed. This is the central tension of the game and it is intentional.`,
      },
      {
        kind: "p",
        text: `The exact weights for this edition are ${LEVELS.map((l) => l.weight).join(", ")}. They are the base schedule multiplied by this edition's ${EDITION.weightMultiplier}×, with fractions truncated, which is why levels three and four read ${LEVELS[2]?.weight} and ${LEVELS[3]?.weight} rather than half-units. The ratio the paragraph above promises holds exactly: ${LEVELS[4]?.weight} is five times ${LEVELS[0]?.weight}.`,
      },
    ],
  },
  {
    id: "how-rewards-reach-a-card",
    heading: "How rewards reach a card",
    blocks: [
      {kind: "p", text: `Trading fees accumulate at the venue. From there:`},
      {
        kind: "ol",
        items: [
          `Anyone can trigger the claim that pulls accrued fees into the protocol.`,
          `The router splits them on fixed terms: one third to the treasury, two thirds to rewards.`,
          `The rewards portion is wrapped and funded into ${EDITION.streamEpochSeconds}-second streams, so a single large sweep is spread across time rather than landing entirely on whoever upgraded a minute earlier.`,
          `As streams mature, the proceeds are converted into each ${quarter}'s reward asset through fixed routes. The route is checked against its own thirty-minute average price before the trade and again after it, and refuses rather than accepting a bad fill — both one somebody has arranged, and one caused by the size of the trade itself against a thin market.`,
          `Converted rewards are deposited to the distributor, where cards accrue against them by weight.`,
        ],
      },
      {
        kind: "p",
        text: `No one can redirect a deposit once it is made, and no operator has to act for you to be paid. Claiming the venue's fees, splitting them, releasing the stream and sweeping card royalties are open to anyone, always — those contracts have no owner and no pause. Allocating between ${quarters} and converting a ${quarter} into its asset are open to anyone while the vault is running, and to a named processor only while conversion is paused. Steps can stall — a conversion may fail if liquidity is thin, and the funds simply wait until it succeeds.`,
      },
      {
        kind: "p",
        text: `Each ${quarter} is allocated an equal share and converts independently. A ${quarter} with no minted cards accrues its share as a reserve rather than passing it to the others.`,
      },
    ],
  },
  {
    id: "claiming-holding-selling",
    heading: "Claiming, holding, selling",
    blocks: [
      {
        kind: "p",
        text: `Rewards accrue to the card, but they are settled to a wallet. Whenever a card is transferred, upgraded, or claimed against, the protocol settles what has accrued so far and credits it to the current owner.`,
      },
      {
        kind: "callout",
        text: `This has one consequence worth understanding before you sell. Amounts already credited to your wallet stay with your wallet — they do not transfer with the card. Amounts pending on a card at the moment of sale are settled to you as the seller during the transfer. The buyer begins accruing from that point and shares only in deposits that arrive afterward. A marketplace will not explain this to either of you.`,
      },
    ],
  },
  {
    id: "later-editions",
    heading: "Later editions, and what they cost you",
    blocks: [
      {
        kind: "p",
        text: `This is the ${BRAND.editionName}. It will not be the only one, and you should know how a later edition affects this one before you buy into this one.`,
      },
      {
        kind: "p",
        text: `Later editions are separate collections, minted with the same token, each with its own card supply, its own mint cost, and its own fixed set of reward assets. Fees from trading land in one shared pot. That pot is divided between editions in proportion to each edition's total weight, and each edition's portion buys only that edition's own assets.`,
      },
      {
        kind: "callout",
        text: `Every new edition adds weight to the shared pot, so every existing card's share of future fees falls. That is not a side effect, it is the mechanism. The ${BRAND.editionName} carries a ${EDITION.weightMultiplier}× weight multiplier, so each of its cards counts for ${EDITION.weightMultiplier} times what the same card would count for in an edition without one. That softens the fall; it does not stop it, and there is no single percentage that describes it, because how far your share falls depends entirely on how much weight the new edition brings.`,
      },
      {
        kind: "p",
        text: `You will never be paid in another edition's asset, and another edition's asset going bad cannot reach into yours. An edition's asset set is fixed when it is deployed and has no setter; adding an asset means registering a new edition, which everyone can see onchain.`,
      },
    ],
  },
  {
    id: "what-cannot-be-changed",
    heading: "What cannot be changed",
    blocks: [
      {
        kind: "p",
        text: `Once deployed, no one — including whoever holds the key — can create tokens or cards beyond the caps, restore destroyed supply, alter a level, weight, or ${quarter}, change the fee split, the stream duration, or the ${quarter} allocation, withdraw or redirect deposited rewards, or touch any edition's weight multiplier or asset set. All of this is demonstrable from the verified source.`,
      },
      {
        kind: "p",
        text: `Administrative control is the following list and nothing else. Pausing minting, upgrades, and conversion. Swapping the metadata renderer, which is presentation only. Replacing a conversion route, which can change how an asset is bought but never which asset you receive, because the route is checked against the edition's frozen asset list before it is accepted. Naming who may move the two vault stages while conversion is paused. Naming who may trigger the treasury buyback, setting a ceiling on what it spends per call and a cooldown between calls, and replacing the route it buys through. Adjusting the share of treasury revenue spent on buybacks, which cannot touch the rewards leg. And registering a new edition.`,
      },
      {
        kind: "p",
        text: `Two things that look like powers are not. The wiring functions that point each contract at the others can each be called once and then revert forever, so after deployment they are spent. And whether bought tokens are burned or kept is fixed when the buyback contract is constructed, with no setter at all.`,
      },
      {
        kind: "p",
        text: `That list is meant to be exhaustive, and it is checkable: every function carrying the owner modifier is visible in the verified source, and there are ${OWNER_FUNCTION_COUNT} of them. If you find one this rulebook does not account for, the rulebook is wrong.`,
      },
      {
        kind: "callout",
        text: `Registering a new edition is the one discretionary power in this system, and it shifts future fee share toward the new edition and away from yours. It is held by a single externally owned account with no timelock and no multisig. That is the owner's deliberate choice, stated here rather than buried: if that key is compromised, someone can register an edition; if it is lost, no future edition can ever be registered. This protocol should not be described as decentralised or trustless in administrative terms, because it is neither.`,
      },
      {
        kind: "p",
        text: `Token transfers and card transfers cannot be paused by anyone, including the key holder. Your ability to move what you own is not conditional on anyone's cooperation.`,
      },
    ],
  },
  {
    id: "risks",
    heading: "Risks",
    blocks: [
      {kind: "p", text: `Read this part twice.`},
      {
        kind: "list",
        items: [
          `The token may lose value, and the cards may prove worth less than what was destroyed to build them.`,
          `Upgrade costs are permanent and unrecoverable regardless of what happens afterward.`,
          `Rewards depend entirely on trading activity and card resales. If no one trades and no one sells, nothing is distributed.`,
          `Conversions depend on liquidity in the reward asset and can fail or execute poorly.`,
          `Smart contracts can contain flaws that audits do not catch.`,
          `Each reward asset is a token tracking a share price, issued by somebody else. It can lose value with the share, it depends on its issuer continuing to back it, and its onchain market can thin out or disappear. None of that is within this protocol's control.`,
          `A single key holds every administrative role, with no timelock standing between a decision and its effect.`,
          `Each new edition permanently reduces your share of future fees.`,
          `Regulatory treatment of assets like these is unsettled and may change.`,
        ],
      },
      {
        kind: "p",
        text: `This is a game with real economic stakes and no safety net. Nothing here is investment advice, and nothing here is a promise.`,
      },
    ],
  },
];

export const RULEBOOK_INTRO = `${BRAND.projectName} · ${BRAND.editionName}. ${n(EDITION.cardSupply)} ${card}s across four ${quarters}. Every figure below matches the deployed contracts, and ${T} is the token throughout.`;
