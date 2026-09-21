/**
 * Every name the product is known by, in one place.
 *
 * The brand is not final. Nothing outside this file should contain the project name, the
 * ticker, the edition name, or any of the vocabulary below -- a rename has to be one edit
 * here, not a search across the codebase.
 *
 * Before the name is locked: check the domain, the X handle, that no token with the
 * ticker already trades on DEXScreener, and run a basic USPTO search.
 */
export const BRAND = {
  /** Working name. */
  projectName: "Stocktown",
  /** Working ticker. */
  tokenTicker: "TOWN",
  /** This edition's name. */
  editionName: "Founding Edition",
  /** What one NFT is called. */
  itemName: "Property Card",
  itemNamePlural: "Property Cards",
  /** The per-card score. Defined before any number derived from it is shown. */
  scoreTerm: "Yield Weight",
  /** A group of cards sharing a reward pool. */
  groupTerm: "Quarter",
  groupTermPlural: "Quarters",
  /** The rewards page. */
  rewardsPageTerm: "Ground Rent",
  strapline: "The property game that settles onchain",
} as const;

/** The founding edition's fixed parameters, mirrored from the contracts for copy only. */
export const EDITION = {
  /** Cards in this edition, ever. */
  cardSupply: 400,
  quarterCount: 4,
  /** Cards per quarter, laid out as a 10x10 grid. */
  quarterCap: 100,
  gridSize: 10,
  /** Primary mints per wallet. Not a cap on ownership. */
  mintsPerWallet: 3,
  /** Tokens destroyed per mint, in whole tokens. */
  mintBurn: 100_000,
  /**
   * The venue's trading fee, as a percentage of trade value.
   *
   * Charged by the launch venue in the pair's quote asset, never by the token itself,
   * which has no transfer tax of any kind. Pons documents 1% on a V1 launch. Confirm
   * against the launch actually used before this number goes in front of anybody.
   */
  venueTradingFeePercent: 1,
  /**
   * The launch creator's share of that fee, in basis points. The remainder is the
   * venue's. Pons documents 7000 for current V1 launches.
   */
  creatorShareOfVenueFeeBps: 7_000,
  feeSplitTreasuryBps: 3_333,
  feeSplitRewardsBps: 6_667,
  streamEpochSeconds: 300,
  quarterAllocationBps: 2_500,
  /** Card resale royalty, routed into rewards. */
  royaltyBps: 500,
  /** This edition's weight multiplier, already baked into every stored weight. */
  weightMultiplier: 1.25,
  /** Share of treasury revenue spent buying the token back and destroying it. */
  buybackBps: 2_000,
  /** Cards reserved for the team. None: any team card is minted like anyone else's. */
  teamAllocation: 0,
} as const;

export type LevelInfo = {
  level: 1 | 2 | 3 | 4 | 5;
  form: string;
  /** Weight as stored on chain for this edition, multiplier included. */
  weight: number;
  /** Tokens destroyed to reach this level, in whole tokens. Level 1 is the mint. */
  burnToReach: number;
  /** Everything destroyed to get a card here from nothing, in whole tokens. */
  cumulativeBurn: number;
};

/**
 * The level schedule as the contracts compute it.
 *
 * Weights are the base schedule (100/160/250/365/500) times this edition's 1.25, with
 * integer truncation -- which is why levels 3 and 4 read 312 and 456 rather than 312.5
 * and 456.25. The ratio the rulebook actually promises, a Landmark being five Houses,
 * holds exactly: 625 is 5 x 125.
 */
export const LEVELS: readonly LevelInfo[] = [
  {level: 1, form: "House", weight: 125, burnToReach: 100_000, cumulativeBurn: 100_000},
  {level: 2, form: "Residence", weight: 200, burnToReach: 500_000, cumulativeBurn: 600_000},
  {level: 3, form: "Building", weight: 312, burnToReach: 1_000_000, cumulativeBurn: 1_600_000},
  {level: 4, form: "Tower", weight: 456, burnToReach: 1_500_000, cumulativeBurn: 3_100_000},
  {level: 5, form: "Landmark", weight: 625, burnToReach: 2_000_000, cumulativeBurn: 5_100_000},
] as const;

export const MAX_LEVEL = 5;

/**
 * What share of trade value actually reaches this protocol, as a percentage.
 *
 * The venue takes its fee and keeps a cut; only the creator's share arrives here. Stating
 * the venue's headline fee as though all of it were protocol revenue would overstate what
 * holders can expect by a factor of about three.
 */
export const PROTOCOL_SHARE_OF_TRADE_PERCENT =
  (EDITION.venueTradingFeePercent * EDITION.creatorShareOfVenueFeeBps) / 10_000;

export function levelInfo(level: number): LevelInfo | undefined {
  return LEVELS.find((l) => l.level === level);
}

export function formName(level: number): string {
  return levelInfo(level)?.form ?? "Unknown";
}

/**
 * Quarters are zero-indexed on chain and one-indexed everywhere a person reads them.
 * Names are placeholders until the art and the reward assets are settled.
 */
export const QUARTERS = [
  {index: 0, label: "Quarter One", short: "Q1", colorVar: "--quarter-1"},
  {index: 1, label: "Quarter Two", short: "Q2", colorVar: "--quarter-2"},
  {index: 2, label: "Quarter Three", short: "Q3", colorVar: "--quarter-3"},
  {index: 3, label: "Quarter Four", short: "Q4", colorVar: "--quarter-4"},
] as const;

export type Quarter = (typeof QUARTERS)[number];

/**
 * Shown on every page. The wording is load-bearing, not decoration: it is the difference
 * between describing a share of what arrived and implying a rate.
 */
export const GLOBAL_DISCLAIMER =
  `${BRAND.scoreTerm} determines a card's relative share of rewards actually deposited ` +
  `into its ${BRAND.groupTerm.toLowerCase()}. No fixed rate, no projected return, no ` +
  `guarantee that any rewards will be deposited.`;

/** Wherever an underlying asset is named. */
export const NON_AFFILIATION =
  `Rewards are not guaranteed in availability or amount. The reward asset grants no legal ` +
  `or beneficial ownership of any underlying security. ${BRAND.projectName} is not ` +
  `affiliated with, endorsed by, or sponsored by any company named here.`;
