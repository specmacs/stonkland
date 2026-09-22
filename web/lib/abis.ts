/**
 * Only the functions this interface actually calls.
 *
 * Kept narrow on purpose: an ABI entry that exists here but nowhere in the contracts
 * fails loudly at call time rather than silently returning a default, and a smaller
 * surface is a smaller thing to keep in step with the deployed source.
 */

export const tokenAbi = [
  {type: "function", name: "name", inputs: [], outputs: [{type: "string"}], stateMutability: "view"},
  {type: "function", name: "symbol", inputs: [], outputs: [{type: "string"}], stateMutability: "view"},
  {type: "function", name: "decimals", inputs: [], outputs: [{type: "uint8"}], stateMutability: "view"},
  {type: "function", name: "totalSupply", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "MAX_SUPPLY", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {
    type: "function",
    name: "balanceOf",
    inputs: [{name: "account", type: "address"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [{name: "owner", type: "address"}, {name: "spender", type: "address"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [{name: "spender", type: "address"}, {name: "value", type: "uint256"}],
    outputs: [{type: "bool"}],
    stateMutability: "nonpayable",
  },
] as const;

export const propertyNftAbi = [
  {type: "function", name: "MAX_SUPPLY", inputs: [], outputs: [{type: "uint16"}], stateMutability: "view"},
  {type: "function", name: "QUARTER_COUNT", inputs: [], outputs: [{type: "uint8"}], stateMutability: "view"},
  {type: "function", name: "QUARTER_CAP", inputs: [], outputs: [{type: "uint16"}], stateMutability: "view"},
  {
    type: "function",
    name: "WEIGHT_MULTIPLIER_BPS",
    inputs: [],
    outputs: [{type: "uint16"}],
    stateMutability: "view",
  },
  {type: "function", name: "totalSupply", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {
    type: "function",
    name: "mintedInQuarter",
    inputs: [{name: "quarter", type: "uint8"}],
    outputs: [{type: "uint16"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "propertyOf",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [
      {
        type: "tuple",
        components: [
          {name: "quarter", type: "uint8"},
          {name: "level", type: "uint8"},
          {name: "weight", type: "uint16"},
          {name: "burned", type: "uint256"},
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [{type: "address"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "exists",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [{type: "bool"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{name: "owner", type: "address"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [{name: "owner", type: "address"}, {name: "index", type: "uint256"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scheduleWeight",
    inputs: [{name: "level", type: "uint8"}],
    outputs: [{type: "uint16"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextUpgrade",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [
      {name: "nextLevel", type: "uint8"},
      {name: "nextWeight", type: "uint16"},
      {name: "burnAmount", type: "uint256"},
    ],
    stateMutability: "view",
  },
] as const;

export const minterAbi = [
  {type: "function", name: "MINT_BURN", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {
    type: "function",
    name: "MINTS_PER_WALLET",
    inputs: [],
    outputs: [{type: "uint8"}],
    stateMutability: "view",
  },
  {type: "function", name: "paused", inputs: [], outputs: [{type: "bool"}], stateMutability: "view"},
  {type: "function", name: "mintOpen", inputs: [], outputs: [{type: "bool"}], stateMutability: "view"},
  {
    type: "function",
    name: "mintsUsed",
    inputs: [{name: "wallet", type: "address"}],
    outputs: [{type: "uint8"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "remainingMints",
    inputs: [{name: "wallet", type: "address"}],
    outputs: [{type: "uint8"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [{name: "quarter", type: "uint8"}],
    outputs: [{type: "uint256"}],
    stateMutability: "nonpayable",
  },
] as const;

export const progressionManagerAbi = [
  {type: "function", name: "paused", inputs: [], outputs: [{type: "bool"}], stateMutability: "view"},
  {
    type: "function",
    name: "quote",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [
      {name: "nextLevel", type: "uint8"},
      {name: "nextWeight", type: "uint16"},
      {name: "burnAmount", type: "uint256"},
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "build",
    inputs: [{name: "tokenId", type: "uint256"}],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const distributorAbi = [
  {
    type: "function",
    name: "quarterWeight",
    inputs: [{name: "edition", type: "uint256"}, {name: "quarter", type: "uint8"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "editionWeight",
    inputs: [{name: "edition", type: "uint256"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {type: "function", name: "protocolWeight", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {
    type: "function",
    name: "totalDeposited",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "asset", type: "address"},
      {name: "quarter", type: "uint8"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClaimed",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "asset", type: "address"},
      {name: "quarter", type: "uint8"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reserveOf",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "asset", type: "address"},
      {name: "quarter", type: "uint8"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creditedOf",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "asset", type: "address"},
      {name: "quarter", type: "uint8"},
      {name: "wallet", type: "address"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingOf",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "asset", type: "address"},
      {name: "quarter", type: "uint8"},
      {name: "tokenId", type: "uint256"},
      {name: "weight", type: "uint16"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimQuarter",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "quarter", type: "uint8"},
      {name: "cursor", type: "uint256"},
      {name: "maxScan", type: "uint256"},
    ],
    outputs: [
      {name: "nextCursor", type: "uint256"},
      {name: "complete", type: "bool"},
      {name: "assets", type: "address[]"},
      {name: "paid", type: "uint256[]"},
    ],
    stateMutability: "nonpayable",
  },
] as const;

export const revenueVaultAbi = [
  {
    type: "function",
    name: "quarterPending",
    inputs: [{name: "edition", type: "uint256"}, {name: "quarter", type: "uint8"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {type: "function", name: "unallocated", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "totalPendingWeth", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "paused", inputs: [], outputs: [{type: "bool"}], stateMutability: "view"},
] as const;

export const streamVaultAbi = [
  {type: "function", name: "releasable", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "unmatured", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "EPOCH", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "periodFinish", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
] as const;

export const feeRouterAbi = [
  {type: "function", name: "distributable", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "treasuryLiability", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "TREASURY_BPS", inputs: [], outputs: [{type: "uint16"}], stateMutability: "view"},
  {type: "function", name: "REWARDS_BPS", inputs: [], outputs: [{type: "uint16"}], stateMutability: "view"},
] as const;

/**
 * The permissionless stages of the reward pipeline.
 *
 * Every one of these is open to anyone by design, which is only true in practice if
 * something can press them. A protocol whose rewards move only when its team runs a
 * script has an operator whether it admits to one or not.
 */
export const pipelineAbi = [
  {type: "function", name: "distribute", inputs: [], outputs: [{type: "uint256"}, {type: "uint256"}], stateMutability: "nonpayable"},
  {type: "function", name: "flushTreasury", inputs: [], outputs: [{type: "uint256"}], stateMutability: "nonpayable"},
  {type: "function", name: "release", inputs: [], outputs: [{type: "uint256"}], stateMutability: "nonpayable"},
  {type: "function", name: "allocate", inputs: [], outputs: [{type: "uint256"}], stateMutability: "nonpayable"},
  {
    type: "function",
    name: "processQuarter",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "quarter", type: "uint8"},
      {name: "minOuts", type: "uint256[]"},
      {name: "deadline", type: "uint256"},
    ],
    outputs: [{type: "uint256[]"}],
    stateMutability: "nonpayable",
  },
  {type: "function", name: "forward", inputs: [], outputs: [{type: "uint256"}], stateMutability: "nonpayable"},
  {
    type: "function",
    name: "pushQuarter",
    inputs: [
      {name: "edition", type: "uint256"},
      {name: "quarter", type: "uint8"},
      {name: "fromId", type: "uint256"},
      {name: "limit", type: "uint256"},
    ],
    outputs: [{type: "uint256"}, {type: "bool"}],
    stateMutability: "nonpayable",
  },
  {type: "function", name: "pending", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
] as const;

export const erc20MetadataAbi = [
  {type: "function", name: "symbol", inputs: [], outputs: [{type: "string"}], stateMutability: "view"},
  {type: "function", name: "decimals", inputs: [], outputs: [{type: "uint8"}], stateMutability: "view"},
] as const;

/**
 * The treasury buyback.
 *
 * Surfaced because the interface makes claims about it -- the share spent, that what it
 * buys is destroyed, who may trigger it, the ceiling and the cooldown -- and every one of
 * those was copy with nothing behind it until this contract could be read. A claim the
 * reader cannot check against the chain is a claim this interface should not be making.
 */
export const treasuryBuybackAbi = [
  {type: "function", name: "buybackBps", inputs: [], outputs: [{type: "uint16"}], stateMutability: "view"},
  {type: "function", name: "burnsBought", inputs: [], outputs: [{type: "bool"}], stateMutability: "view"},
  {type: "function", name: "keeper", inputs: [], outputs: [{type: "address"}], stateMutability: "view"},
  {type: "function", name: "maxSpendPerCall", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "cooldown", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "lastExecutedAt", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "available", inputs: [], outputs: [{type: "uint256"}], stateMutability: "view"},
  {type: "function", name: "adapter", inputs: [], outputs: [{type: "address"}], stateMutability: "view"},
  {
    type: "function",
    name: "canExecute",
    inputs: [{name: "caller", type: "address"}],
    outputs: [{type: "bool"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "execute",
    inputs: [{name: "minOut", type: "uint256"}, {name: "deadline", type: "uint256"}],
    outputs: [{type: "uint256"}],
    stateMutability: "nonpayable",
  },
] as const;
