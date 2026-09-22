"use client";

import type {ReactNode} from "react";
import {BRAND, EDITION, QUARTERS} from "@/lib/brand";
import {formatAssetAmount, formatBps, formatCount, formatShare, formatWholeTokens} from "@/lib/format";
import {useProtocolStats, useRewardAssets, type ProtocolStats} from "@/lib/reads";
import {PageHeader} from "./Section";
import {SectionHead} from "./SectionHead";
import {ReadGate} from "./ReadGate";
import {NonAffiliation} from "./Disclaimer";
import {Pipeline} from "./Pipeline";
import {Buyback} from "./Buyback";

export function Stats() {
  const stats = useProtocolStats();
  const assets = useRewardAssets();

  return (
    <>
      <PageHeader
        eyebrow="Live from chain"
        heading="Protocol state."
        sub="Read directly from the contracts on every load. Nothing here is cached, estimated, or carried over from a previous read."
        tone="cream"
      />

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6">
        <ReadGate
          state={stats}
          loadingLabel="Reading contract state…"
          failureLabel="Reads did not succeed. Metrics appear only when they do."
        >
          {(data) => (
            <>
              <Supply data={data} />
              <Cards data={data} />
              <Rewards
                data={data}
                assets={assets.status === "ready" ? assets.data : undefined}
              />
              <PipelineState data={data} />
            </>
          )}
        </ReadGate>

        <div className="border-t-rule border-ink pt-14">
          <Pipeline />
        </div>

        <div className="border-t-rule border-ink pt-14">
          <Buyback />
        </div>

        <NonAffiliation className="max-w-3xl" />
      </div>
    </>
  );
}

/** A page-level block: a headline set against its explanation, then the figures. */
function Block({
  eyebrow,
  heading,
  sub,
  children,
  footnote,
}: {
  eyebrow: string;
  heading: string;
  sub?: ReactNode;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <section>
      <SectionHead eyebrow={eyebrow} heading={heading}>
        {sub}
      </SectionHead>
      <div className="mt-8">{children}</div>
      {footnote && (
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-inkMuted">{footnote}</p>
      )}
    </section>
  );
}

function Supply({data}: {data: ProtocolStats}) {
  const burned = data.tokenMaxSupply - data.tokenSupply;
  /* Clamped so a read that somehow exceeds the cap cannot draw a bar past its track. */
  const burnedPct =
    data.tokenMaxSupply === 0n
      ? 0
      : Math.min(100, Number((burned * 10_000n) / data.tokenMaxSupply) / 100);

  return (
    <Block
      eyebrow="Token"
      heading="Supply only falls."
      sub={`${BRAND.tokenTicker} was minted once at deployment and there is no function that can create more. Every token missing from circulation was destroyed by a mint or a build.`}
      footnote={`The bar is the share of the original ${formatWholeTokens(data.tokenMaxSupply)} ${BRAND.tokenTicker} that has been destroyed. It can only move one way.`}
    >
      <div className="border-rule border-ink bg-paperCard shadow-cardLg">
        <div
          className="flex h-14 w-full overflow-hidden border-b-rule border-ink bg-field-sun"
          role="img"
          aria-label={`${formatShare(burned, data.tokenMaxSupply)} of supply destroyed`}
        >
          <div
            className="h-full border-r-rule border-ink bg-ink"
            style={{width: `${burnedPct}%`}}
          />
        </div>
        <dl className="grid sm:grid-cols-3">
          <Figure
            cap="bg-ink"
            label="Burned to date"
            value={formatWholeTokens(burned)}
            unit={BRAND.tokenTicker}
          />
          <Figure
            cap="bg-field-sun"
            label="Circulating supply"
            value={formatWholeTokens(data.tokenSupply)}
            unit={BRAND.tokenTicker}
          />
          <Figure
            cap="bg-seal"
            label="Share of supply destroyed"
            value={formatShare(burned, data.tokenMaxSupply)}
            last
          />
        </dl>
      </div>
    </Block>
  );
}

function Cards({data}: {data: ProtocolStats}) {
  return (
    <Block
      eyebrow="Cards"
      heading={`${formatCount(data.cardSupply)} cards in this edition.`}
      sub={`Every card belongs to one ${BRAND.groupTerm.toLowerCase()}, and each ${BRAND.groupTerm.toLowerCase()} is capped independently.`}
      footnote={
        <>
          Each {BRAND.groupTerm.toLowerCase()} is allocated{" "}
          {formatBps(EDITION.quarterAllocationBps)} of the edition&apos;s reward share, frozen at
          deployment. A {BRAND.groupTerm.toLowerCase()} with no minted cards holds its share as a
          reserve rather than passing it to the others.
        </>
      }
    >
      <div className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          cap="bg-seal"
          label="Minted"
          value={formatCount(data.cardsMinted)}
          unit={`of ${formatCount(data.cardSupply)}`}
        />
        <Tile
          cap="bg-field-sun"
          label={`${BRAND.scoreTerm} in edition`}
          value={formatCount(data.editionWeight)}
        />
        <Tile
          cap="bg-felt"
          label="Protocol weight"
          value={formatCount(data.protocolWeight)}
          unit="all editions"
        />
        <Tile
          cap="bg-ink"
          label="Edition share of the pot"
          value={formatShare(data.editionWeight, data.protocolWeight)}
          last
        />
      </div>

      <div className="card-row mt-6 grid bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {QUARTERS.map((q, i) => {
          const minted = data.perQuarterMinted[q.index];
          const weight = data.perQuarterWeight[q.index];
          // "Full" is a claim about a count. Without the count there is no claim to make.
          const full = minted !== undefined && minted >= data.quarterCap;
          return (
            <div
              key={q.index}
              className={`bg-paperCard ${
                i < QUARTERS.length - 1 ? "border-b-rule border-ink lg:border-b-0 lg:border-r-rule" : ""
              }`}
            >
              <div
                className="flex items-center justify-between gap-2 border-b-rule border-ink px-4 py-2.5 text-paperCard"
                style={{backgroundColor: `var(${q.colorVar})`}}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
                  {q.label}
                </span>
                {minted !== undefined && (
                  <span className="border border-paperCard/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                    {full ? "Full" : "Open"}
                  </span>
                )}
              </div>
              <div className="px-4 py-5">
                <p className="font-mono text-3xl font-semibold tabular-nums leading-none text-ink">
                  {minted === undefined ? (
                    <span className="text-inkFaint">—</span>
                  ) : (
                    formatCount(minted)
                  )}
                  <span className="text-lg text-inkFaint"> / {formatCount(data.quarterCap)}</span>
                </p>
                <p className="rule-label mt-2.5">
                  {BRAND.scoreTerm}{" "}
                  {weight === undefined ? (
                    <span className="text-inkFaint">not read</span>
                  ) : (
                    formatCount(weight)
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function Rewards({
  data,
  assets,
}: {
  data: ProtocolStats;
  assets: ({symbol: string; decimals: number} | undefined)[] | undefined;
}) {
  return (
    <Block
      eyebrow={`Rewards by ${BRAND.groupTerm.toLowerCase()}`}
      heading="What has actually arrived."
      sub={`Deposited is what reached the ${BRAND.groupTermPlural.toLowerCase()}. Claimed is what owners have taken out of it. Both are read from the distributor.`}
      footnote="A dash means the figure has no configured asset behind it, or its read did not succeed. It never means zero."
    >
      <div className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {QUARTERS.map((q, i) => {
          const asset = assets?.[q.index];
          const deposited = data.depositedPerQuarter[q.index];
          const claimed = data.claimedPerQuarter[q.index];
          return (
            <div
              key={q.index}
              className={`bg-paperCard ${
                i < QUARTERS.length - 1 ? "border-b-rule border-ink lg:border-b-0 lg:border-r-rule" : ""
              }`}
            >
              <div
                aria-hidden
                className="h-2.5 w-full border-b-rule border-ink"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              <div className="px-4 py-5">
                <p className="rule-label">{q.label}</p>
                <p className="mt-1.5 font-mono text-sm text-ink">
                  {asset?.symbol ?? <span className="text-inkFaint">asset not configured</span>}
                </p>

                <dl className="mt-5 space-y-3">
                  <div>
                    <dt className="rule-label">Deposited</dt>
                    <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none text-ink">
                      {asset && deposited !== undefined ? (
                        formatAssetAmount(deposited, asset.decimals)
                      ) : (
                        <span className="text-inkFaint">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="border-t border-ink/10 pt-3">
                    <dt className="rule-label">Claimed</dt>
                    <dd className="mt-1 font-mono text-base tabular-nums text-inkMuted">
                      {asset && claimed !== undefined ? (
                        formatAssetAmount(claimed, asset.decimals)
                      ) : (
                        <span className="text-inkFaint">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function PipelineState({data}: {data: ProtocolStats}) {
  const stages: {label: string; value: bigint | undefined; note: string; cap: string}[] = [
    {
      label: "Awaiting fee split",
      value: data.feeRouterPending,
      cap: "bg-tint-sun",
      note: `Collected and not yet split ${formatBps(EDITION.feeSplitTreasuryBps)} / ${formatBps(EDITION.feeSplitRewardsBps)}. Anyone can trigger it.`,
    },
    {
      label: "Treasury owed",
      value: data.treasuryLiability,
      cap: "bg-tint-peach",
      note: "Split off but not yet delivered. Anyone can retry the payment.",
    },
    {
      label: "Still streaming",
      value: data.streamUnmatured,
      cap: "bg-tint-sky",
      note: `Inside the current ${EDITION.streamEpochSeconds}-second window.`,
    },
    {
      label: "Matured, awaiting release",
      value: data.streamReleasable,
      cap: "bg-tint-lilac",
      note: "Ready to move on to the revenue vault. Anyone can push it.",
    },
    {
      label: "Awaiting allocation",
      value: data.vaultUnallocated,
      cap: "bg-tint-mint",
      note: `Held before being divided between editions by weight, then between ${BRAND.groupTermPlural.toLowerCase()}. Open to anyone while the vault runs.`,
    },
  ];

  return (
    <Block
      eyebrow="Reward pipeline"
      heading="Where value is sitting."
      sub="Value moves through five holding places on its way to a claim. Each figure is what is resting at that step right now, counting ether and wrapped ether alike — the pipeline wraps as it goes, and a stage holding either is holding the same value."
      footnote={
        <>
          Each {BRAND.groupTerm.toLowerCase()} converts independently. A route that fails leaves
          only that {BRAND.groupTerm.toLowerCase()}&apos;s share pending, and pending is a
          comfortable resting state — sometimes for days, if the asset is thinly traded.
        </>
      }
    >
      <div className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((s, i) => (
          <div
            key={s.label}
            className={`bg-paperCard ${
              i < stages.length - 1 ? "border-b-rule border-ink lg:border-b-0 lg:border-r-rule" : ""
            }`}
          >
            <div aria-hidden className={`tile-cap ${s.cap}`} />
            <div className="p-4">
              <p className="rule-label">{s.label}</p>
              <p className="mt-2 font-mono text-lg tabular-nums text-ink">
                {s.value === undefined ? (
                  <span className="text-inkFaint">not read</span>
                ) : (
                  <>
                    {formatAssetAmount(s.value, 18)}
                    <span className="ml-1.5 text-xs text-inkMuted">ETH</span>
                  </>
                )}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-inkMuted">{s.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card-row mt-6 grid bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {QUARTERS.map((q, i) => {
          const pending = data.vaultPerQuarterPending[q.index];
          return (
            <div
              key={q.index}
              className={`bg-paperCard ${
                i < QUARTERS.length - 1 ? "border-b-rule border-ink lg:border-b-0 lg:border-r-rule" : ""
              }`}
            >
              <div
                aria-hidden
                className="tile-cap"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              <div className="p-4">
                <p className="rule-label">{q.label} awaiting conversion</p>
                <p className="mt-2 font-mono text-base tabular-nums text-ink">
                  {pending === undefined ? (
                    <span className="text-inkFaint">not read</span>
                  ) : (
                    <>
                      {formatAssetAmount(pending, 18)}
                      <span className="ml-1.5 text-xs text-inkMuted">ETH</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Block>
  );
}

/** A figure inside a bordered plate, divided by hairlines rather than the heavy rule. */
function Figure({
  cap,
  label,
  value,
  unit,
  last = false,
}: {
  cap: string;
  label: string;
  value: string;
  unit?: string;
  last?: boolean;
}) {
  return (
    <div className={`p-6 ${last ? "" : "border-b border-ink/15 sm:border-b-0 sm:border-r"}`}>
      <dt className="rule-label flex items-center gap-2">
        <span aria-hidden className={`h-2.5 w-2.5 border border-ink ${cap}`} />
        {label}
      </dt>
      {/* The full supply is thirteen characters and overflowed its third of the plate at
          the display size. Long figures step down rather than running into the next one. */}
      <dd
        className={`mt-3 font-mono tabular-nums leading-none text-ink ${
          value.length > 10 ? "text-2xl sm:text-3xl" : "figure"
        }`}
      >
        {value}
        {unit && <span className="ml-2 font-sans text-sm text-inkMuted">{unit}</span>}
      </dd>
    </div>
  );
}

/** A figure on its own card, topped by a band of colour. */
function Tile({
  cap,
  label,
  value,
  unit,
  last = false,
}: {
  cap: string;
  label: string;
  value: string;
  unit?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`bg-paperCard ${last ? "" : "border-b-rule border-ink lg:border-b-0 lg:border-r-rule"}`}
    >
      <div aria-hidden className={`tile-cap ${cap}`} />
      <div className="p-5">
        <p className="rule-label">{label}</p>
        <p
          className={`mt-3 font-mono tabular-nums leading-none text-ink ${
            value.length > 10 ? "text-2xl sm:text-3xl" : "figure"
          }`}
        >
          {value}
        </p>
        {unit && <p className="mt-1.5 text-xs text-inkMuted">{unit}</p>}
      </div>
    </div>
  );
}
