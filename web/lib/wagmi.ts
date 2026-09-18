"use client";

import {getDefaultConfig} from "@rainbow-me/rainbowkit";
import {http, type Transport} from "viem";
import type {Chain} from "viem";
import {CHAIN, RPC_TRANSPORT_URL, WALLETCONNECT_PROJECT_ID} from "./config";
import {BRAND} from "./brand";
import {mainnet} from "viem/chains";

/**
 * Reads go straight to an RPC node with multicall batching. Four hundred cards is small
 * enough to read directly, and an indexer would introduce exactly the thing this
 * interface is not allowed to have: a number that was true a moment ago being presented
 * as a number that is true now.
 */
const chains: readonly [Chain, ...Chain[]] = CHAIN ? [CHAIN] : [mainnet];

const transports: Record<number, Transport> = Object.fromEntries(
  chains.map((c) => [
    c.id,
    http(RPC_TRANSPORT_URL, {
      batch: {wait: 16},
      retryCount: 2,
    }),
  ]),
);

export const wagmiConfig = getDefaultConfig({
  appName: BRAND.projectName,
  // RainbowKit requires a project id for WalletConnect. Without one, injected wallets
  // still work and WalletConnect simply is not offered.
  projectId: WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
  chains,
  transports,
  ssr: true,
});
