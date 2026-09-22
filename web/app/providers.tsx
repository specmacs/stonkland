"use client";

import {RainbowKitProvider, lightTheme} from "@rainbow-me/rainbowkit";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {WagmiProvider} from "wagmi";
import {useState, type ReactNode} from "react";
import {wagmiConfig} from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

export function Providers({children}: {children: ReactNode}) {
  // Reads are re-fetched rather than served stale. Chain state moves, and a number that
  // was true a block ago is not a number this interface is willing to present as current.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 8_000,
            refetchInterval: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#15120c",
            accentColorForeground: "#fdfaf2",
            borderRadius: "small",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
