"use client";

import {connectorsForWallets} from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import {createConfig, http, type Transport} from "wagmi";
import type {Chain} from "viem";
import {mainnet} from "viem/chains";
import {CHAIN, RPC_TRANSPORT_URL, USES_WALLETCONNECT, WALLETCONNECT_PROJECT_ID} from "./config";
import {BRAND} from "./brand";

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

/**
 * Wallets, assembled by hand rather than taken from `getDefaultConfig`.
 *
 * The default set always includes WalletConnect, which initialises on page load and calls
 * its own telemetry and config endpoints whether or not anybody ever opens it. With no
 * project id configured that connector cannot be used at all, so those were requests to
 * third parties in exchange for nothing -- and they made the privacy page's claim that
 * this site carries no third-party tracker untrue.
 *
 * WalletConnect is therefore offered only when a project id is actually set, which is the
 * only case where it works. Injected wallets, MetaMask and Safe need no third party and
 * are always available.
 */
export const wagmiConfig = createConfig({
  chains,
  transports,
  ssr: true,
  connectors: connectorsForWallets(
    [
      {
        groupName: "Installed",
        wallets: [injectedWallet, metaMaskWallet, safeWallet],
      },
      ...(USES_WALLETCONNECT
        ? [{groupName: "Other", wallets: [walletConnectWallet]}]
        : []),
    ],
    {
      appName: BRAND.projectName,
      // Validated unconditionally even when no wallet in the list above uses it, so an
      // unconfigured deployment passes a placeholder. Nothing is constructed with it:
      // the WalletConnect connector is simply absent, and absent connectors make no
      // requests.
      projectId: WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
    },
  ),
});
