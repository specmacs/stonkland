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

const KNOWN_CHAINS: readonly Chain[] = [mainnet, base, sepolia, baseSepolia];

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

/** The canonical pool. Absent until one exists, which disables the Buy control. */
export const POOL_URL = process.env.NEXT_PUBLIC_POOL_URL?.trim() ?? "";
export const X_URL = process.env.NEXT_PUBLIC_X_URL?.trim() ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

export const CONFIG_MISSING_MESSAGE = "Contract addresses are not configured for this deployment.";
