import {defineChain, isAddress, type Address, type Chain} from "viem";
import {mainnet, base, sepolia, baseSepolia} from "viem/chains";

/**
 * Deployment configuration, read from the environment.
 *
 * There are no fallback addresses anywhere in this file. An address that is absent stays
 * absent: the interface disables the control that needed it and says why. A hardcoded
 * address would be worse than a disabled button, because a disabled button cannot send
 * somebody's tokens to the wrong place.
 */

const CONTRACT_KEYS = [
  "token",
  "nft",
  "minter",
  "progressionManager",
  "distributor",
  "editionRegistry",
  "revenueVault",
  "streamVault",
  "feeRouter",
  "royaltyRouter",
  "treasuryBuyback",
  "weth",
] as const;

export type ContractKey = (typeof CONTRACT_KEYS)[number];

const ENV_NAMES: Record<ContractKey, string> = {
  token: "NEXT_PUBLIC_TOKEN_ADDRESS",
  nft: "NEXT_PUBLIC_NFT_ADDRESS",
  minter: "NEXT_PUBLIC_MINTER_ADDRESS",
  progressionManager: "NEXT_PUBLIC_PROGRESSION_MANAGER_ADDRESS",
  distributor: "NEXT_PUBLIC_DISTRIBUTOR_ADDRESS",
  editionRegistry: "NEXT_PUBLIC_EDITION_REGISTRY_ADDRESS",
  revenueVault: "NEXT_PUBLIC_REVENUE_VAULT_ADDRESS",
  streamVault: "NEXT_PUBLIC_STREAM_VAULT_ADDRESS",
  feeRouter: "NEXT_PUBLIC_FEE_ROUTER_ADDRESS",
  royaltyRouter: "NEXT_PUBLIC_ROYALTY_ROUTER_ADDRESS",
  treasuryBuyback: "NEXT_PUBLIC_TREASURY_BUYBACK_ADDRESS",
  weth: "NEXT_PUBLIC_WETH_ADDRESS",
};

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only where the full literal appears in
 * source, so every one is spelled out rather than looked up by a computed key.
 */
const RAW: Record<ContractKey, string | undefined> = {
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
  nft: process.env.NEXT_PUBLIC_NFT_ADDRESS,
  minter: process.env.NEXT_PUBLIC_MINTER_ADDRESS,
  progressionManager: process.env.NEXT_PUBLIC_PROGRESSION_MANAGER_ADDRESS,
  distributor: process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS,
  editionRegistry: process.env.NEXT_PUBLIC_EDITION_REGISTRY_ADDRESS,
  revenueVault: process.env.NEXT_PUBLIC_REVENUE_VAULT_ADDRESS,
  streamVault: process.env.NEXT_PUBLIC_STREAM_VAULT_ADDRESS,
  feeRouter: process.env.NEXT_PUBLIC_FEE_ROUTER_ADDRESS,
  royaltyRouter: process.env.NEXT_PUBLIC_ROYALTY_ROUTER_ADDRESS,
  treasuryBuyback: process.env.NEXT_PUBLIC_TREASURY_BUYBACK_ADDRESS,
  weth: process.env.NEXT_PUBLIC_WETH_ADDRESS,
};

const REWARD_ASSET_RAW = [
  process.env.NEXT_PUBLIC_REWARD_ASSET_Q1,
  process.env.NEXT_PUBLIC_REWARD_ASSET_Q2,
  process.env.NEXT_PUBLIC_REWARD_ASSET_Q3,
  process.env.NEXT_PUBLIC_REWARD_ASSET_Q4,
];

function parse(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return undefined;
  return trimmed;
}

export const ADDRESSES: Partial<Record<ContractKey, Address>> = Object.fromEntries(
  CONTRACT_KEYS.map((key) => [key, parse(RAW[key])]).filter(([, v]) => v !== undefined),
) as Partial<Record<ContractKey, Address>>;

/** One reward asset per quarter, indexed by quarter. Undefined entries stay undefined. */
export const REWARD_ASSETS: ReadonlyArray<Address | undefined> = REWARD_ASSET_RAW.map(parse);

/** Names of the environment variables that are missing or malformed. */
export function missingAddressNames(keys: readonly ContractKey[]): string[] {
  return keys.filter((k) => !ADDRESSES[k]).map((k) => ENV_NAMES[k]);
}

/** True when every named contract has a usable address. */
export function hasAddresses(keys: readonly ContractKey[]): boolean {
  return keys.every((k) => Boolean(ADDRESSES[k]));
}

export function requireAddress(key: ContractKey): Address {
  const value = ADDRESSES[key];
  if (!value) {
    throw new Error(`${ENV_NAMES[key]} is not configured for this deployment.`);
  }
  return value;
}

/** The edition this interface is built for. */
export const EDITION_ID = 1n;

/**
 * The launch chain. Described here rather than imported because viem does not ship it,
 * and a chain the site cannot name is a chain where every control renders disabled.
 */
const robinhood = defineChain({
  id: 4_663,
  name: "Robinhood Chain",
  nativeCurrency: {name: "Ether", symbol: "ETH", decimals: 18},
  rpcUrls: {default: {http: ["https://rpc.mainnet.chain.robinhood.com"]}},
  blockExplorers: {default: {name: "Robinscan", url: "https://robinscan.io"}},
});

const robinhoodTestnet = defineChain({
  id: 46_630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {name: "Ether", symbol: "ETH", decimals: 18},
  rpcUrls: {default: {http: ["https://rpc.testnet.chain.robinhood.com/rpc"]}},
  blockExplorers: {
    default: {name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com"},
  },
  testnet: true,
});

const KNOWN_CHAINS: readonly Chain[] = [
  robinhood,
  robinhoodTestnet,
  mainnet,
  base,
  sepolia,
  baseSepolia,
];

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "0");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL?.trim() ?? "";

/**
 * A local chain is described here rather than imported, so a developer can point the
 * interface at anvil without the build pulling in a chain list it does not need.
 */
const anvil = defineChain({
  id: 31_337,
  name: "Anvil",
  nativeCurrency: {name: "Ether", symbol: "ETH", decimals: 18},
  rpcUrls: {default: {http: [RPC_URL || "http://127.0.0.1:8545"]}},
});

export const CHAIN: Chain | undefined =
  CHAIN_ID === 31_337 ? anvil : KNOWN_CHAINS.find((c) => c.id === CHAIN_ID);

export const CHAIN_NAME = CHAIN?.name ?? "the configured network";

export const RPC_TRANSPORT_URL: string | undefined =
  RPC_URL || CHAIN?.rpcUrls.default.http[0] || undefined;

/** True when the interface knows which chain it is talking to and how to reach it. */
export const CHAIN_CONFIGURED = Boolean(CHAIN && RPC_TRANSPORT_URL);

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

/**
 * Whether this deployment offers WalletConnect, and therefore whether the page reaches a
 * third party at all.
 *
 * Lives here rather than in the wallet setup because the privacy page states it, and that
 * page is rendered on the server. Without a project id the connector cannot work, so it
 * is left out entirely -- which is what makes "no third-party tracker" a fact about this
 * build rather than an aspiration.
 */
export const USES_WALLETCONNECT = WALLETCONNECT_PROJECT_ID.length > 0;

/** Where to buy the token. Absent until a market exists, which disables the Buy control. */
export const POOL_URL = process.env.NEXT_PUBLIC_POOL_URL?.trim() ?? "";

/**
 * Where the launch is in its life, when that is actually known.
 *
 * `curve`      the token trades on a bonding curve; no pool exists yet
 * `graduated`  the curve has been bought out and the token trades in a pool
 * `undefined`  nobody has said, so the interface says nothing
 *
 * There is deliberately no default. An earlier version fell back to `curve`, which meant
 * an unset variable produced a confident statement about where the launch was -- a claim
 * assembled out of nothing, on a site whose whole promise is that it does not do that.
 * Silence is the honest reading of an unset variable.
 *
 * It is also not inferred. The interface could guess from whether a pool address is
 * configured, and a wrong guess would tell somebody the launch had reached a stage it
 * had not.
 */
export type LaunchPhase = "curve" | "graduated";

function parsePhase(raw: string | undefined): LaunchPhase | undefined {
  const value = raw?.trim();
  return value === "curve" || value === "graduated" ? value : undefined;
}

export const LAUNCH_PHASE: LaunchPhase | undefined = parsePhase(
  process.env.NEXT_PUBLIC_LAUNCH_PHASE,
);
export const X_URL = process.env.NEXT_PUBLIC_X_URL?.trim() ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

export const CONFIG_MISSING_MESSAGE = "Contract addresses are not configured for this deployment.";
