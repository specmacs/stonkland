"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {ConnectButton} from "@rainbow-me/rainbowkit";
import {useBlockNumber} from "wagmi";
import {BRAND} from "@/lib/brand";
import {CHAIN_NAME, CHAIN_CONFIGURED, POOL_URL} from "@/lib/config";
import {Mark} from "./Mark";

const NAV = [
  {href: "/board", label: "Board"},
  {href: "/mint", label: "Mint"},
  {href: "/cards", label: "My cards"},
  {href: "/rent", label: BRAND.rewardsPageTerm},
  {href: "/stats", label: "Stats"},
  {href: "/rulebook", label: "Rulebook"},
] as const;

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-rule border-ink bg-paperCard/95 backdrop-blur">
      {/* A hairline of the four quarter colours, so the palette is stated before the page
          is scrolled and the header has an edge rather than a fade. */}
      <div aria-hidden className="flex h-1">
        <span className="flex-1 bg-quarter-1" />
        <span className="flex-1 bg-quarter-2" />
        <span className="flex-1 bg-quarter-3" />
        <span className="flex-1 bg-quarter-4" />
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.projectName}, home`}>
          <Mark className="h-8 w-8 text-seal" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-bold tracking-tight text-ink">
              {BRAND.projectName}
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-inkMuted">
              {BRAND.editionName}
            </span>
          </span>
        </Link>

        <nav className="scrollbar-none order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-rule px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-ink bg-ink text-paperCard"
                    : "border-transparent text-inkMuted hover:border-ink hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BuyControl />
          <NetworkStatus />
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
        </div>
      </div>
    </header>
  );
}

/**
 * Whether the chain this deployment names is actually answering.
 *
 * A green dot beside a network name reads as "connected", so it has to mean that. It
 * tracks the head block: configuration alone earns no dot, because every figure on this
 * site depends on reads succeeding, and a reader deserves to know at a glance whether
 * they can. A page full of "not read" beside a confident green light would be the
 * interface contradicting itself.
 */
function NetworkStatus() {
  // Not watched: this is a liveness check, not a feed, and a subscription re-rendering the
  // header on every block buys nothing.
  const {data: blockNumber, isPending, isError} = useBlockNumber({
    query: {enabled: CHAIN_CONFIGURED, refetchInterval: 30_000},
  });

  if (!CHAIN_CONFIGURED) {
    return (
      <Status
        dot="bg-inkFaint"
        label="No network configured"
        title="No chain is configured for this deployment."
      />
    );
  }

  if (isPending) {
    return <Status dot="bg-inkFaint" label={CHAIN_NAME} title={`Reaching ${CHAIN_NAME}…`} />;
  }

  if (isError || blockNumber === undefined) {
    return (
      <Status
        dot="bg-seal"
        label={`${CHAIN_NAME} unreachable`}
        title={`${CHAIN_NAME} is configured but did not answer. Figures that depend on reads will not be shown.`}
      />
    );
  }

  return (
    <Status
      dot="bg-quarter-3"
      label={CHAIN_NAME}
      title={`${CHAIN_NAME}, at block ${blockNumber.toString()}.`}
    />
  );
}

function Status({dot, label, title}: {dot: string; label: string; title: string}) {
  return (
    <span
      className="hidden items-center gap-1.5 border-rule border-ink/30 px-2.5 py-1.5 font-mono text-[11px] text-inkMuted lg:inline-flex"
      title={title}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Disabled until a market exists to point at. It never guesses at a URL. */
function BuyControl() {
  if (!POOL_URL) {
    return (
      <span
        className="hidden cursor-not-allowed border-rule border-ink/30 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-inkFaint sm:inline-flex"
        title="No market has been configured for this deployment yet."
        aria-disabled="true"
      >
        Buy {BRAND.tokenTicker}
      </span>
    );
  }
  return (
    <a
      href={POOL_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="hidden border-rule border-ink bg-field-sun px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-ink shadow-cardSm transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:inline-flex"
    >
      Buy {BRAND.tokenTicker}
    </a>
  );
}
