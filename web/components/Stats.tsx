"use client";

import {BRAND, EDITION, QUARTERS} from "@/lib/brand";
import {formatAssetAmount, formatBps, formatCount, formatShare, formatWholeTokens} from "@/lib/format";
import {useProtocolStats, useRewardAssets, type ProtocolStats} from "@/lib/reads";
import {PageHeader} from "./Section";
import {ReadGate} from "./ReadGate";
import {NonAffiliation} from "./Disclaimer";

export function Stats() {
  const stats = useProtocolStats();
  const assets = useRewardAssets();

  return (
    <>
      <PageHeader
        heading="Protocol state."
        sub="Read directly from the contracts. Nothing here is cached or estimated."
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ReadGate
          state={stats}
          loadingLabel="Reading contract state…"
          failureLabel="Reads did not succeed. Metrics appear only when they do."
        >
          {(data) => (
            <div className="space-y-10">
              <Supply data={data} />
              <Cards data={data} />
              <Rewards
                data={data}
                assets={assets.status === "ready" ? assets.data : undefined}
              />
              <Pipeline data={data} />
            </div>
          )}
        </ReadGate>

        <NonAffiliation className="mt-10 max-w-3xl" />
      </div>
    </>
  );
}

function Supply({data}: {data: ProtocolStats}) {
  const burned = data.tokenMaxSupply - data.tokenSupply;
  return (
    <section>
      <h2 className="rule-label mb-3">Token</h2>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-3">
        <Stat label="Circulating supply" value={formatWholeTokens(data.tokenSupply)} unit={BRAND.tokenTicker} />
        <Stat label="Burned to date" value={formatWholeTokens(burned)} unit={BRAND.tokenTicker} />
        <Stat
          label="Share of supply destroyed"
          value={formatShare(burned, data.tokenMaxSupply)}
        />
      </dl>
      <p className="mt-3 text-xs text-ink-500">
        Supply is fixed at {formatWholeTokens(data.tokenMaxSupply)} and there is no function that
        can create more. Every token missing from circulation was destroyed by a mint or a build.
      </p>
    </section>
  );
}

function Cards({data}: {data: ProtocolStats}) {
  return (
    <section>
      <h2 className="rule-label mb-3">Cards</h2>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-4">
        <Stat
          label="Minted"
          value={`${formatCount(data.cardsMinted)} / ${EDITION.cardSupply}`}
        />
        <Stat label={`${BRAND.scoreTerm} in edition`} value={formatCount(data.editionWeight)} />
        <Stat label="Protocol weight" value={formatCount(data.protocolWeight)} />
        <Stat
          label="Edition share of the pot"
          value={formatShare(data.editionWeight, data.protocolWeight)}
        />
      </dl>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-4">
        {QUARTERS.map((q) => (
          <div key={q.index} className="bg-ink-950 p-4">
            <p className="rule-label flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              {q.label}
            </p>
            <p className="mt-1.5 font-mono text-lg text-ink-100">
              {formatCount(data.perQuarterMinted[q.index] ?? 0n)}
              <span className="text-sm text-ink-600"> / {EDITION.quarterCap}</span>
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">
              {BRAND.scoreTerm.toLowerCase()} {formatCount(data.perQuarterWeight[q.index] ?? 0n)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Each {BRAND.groupTerm.toLowerCase()} is allocated{" "}
        {formatBps(EDITION.quarterAllocationBps)} of the edition&apos;s reward share, frozen at
        deployment. A {BRAND.groupTerm.toLowerCase()} with no minted cards holds its share as a
        reserve rather than passing it to the others.
      </p>
    </section>
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
    <section>
      <h2 className="rule-label mb-3">Rewards, by {BRAND.groupTerm.toLowerCase()}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left">
              <th scope="col" className="rule-label py-3 pr-4 font-normal">{BRAND.groupTerm}</th>
              <th scope="col" className="rule-label py-3 pr-4 font-normal">Asset</th>
              <th scope="col" className="rule-label py-3 pr-4 text-right font-normal">Deposited</th>
              <th scope="col" className="rule-label py-3 text-right font-normal">Claimed</th>
            </tr>
          </thead>
          <tbody>
            {QUARTERS.map((q) => {
              const asset = assets?.[q.index];
              const deposited = data.depositedPerQuarter[q.index];
              const claimed = data.claimedPerQuarter[q.index];
              return (
                <tr key={q.index} className="border-b border-ink-800/60">
                  <td className="py-3 pr-4 text-ink-200">{q.label}</td>
                  <td className="py-3 pr-4 font-mono text-ink-400">
                    {asset?.symbol ?? <span className="text-ink-600">not configured</span>}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-ink-200">
                    {asset && deposited !== undefined ? (
                      formatAssetAmount(deposited, asset.decimals)
                    ) : (
                      <span className="text-ink-600">—</span>
                    )}
                  </td>
                  <td className="py-3 text-right font-mono text-ink-400">
                    {asset && claimed !== undefined ? (
                      formatAssetAmount(claimed, asset.decimals)
                    ) : (
                      <span className="text-ink-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        A dash means the figure has no configured asset behind it, or its read did not
        succeed. It never means zero.
      </p>
    </section>
  );
}

function Pipeline({data}: {data: ProtocolStats}) {
  const stages: {label: string; value: bigint | undefined; note: string}[] = [
    {
      label: "Awaiting fee split",
      value: data.feeRouterPending,
      note: `Fees collected and not yet split ${formatBps(EDITION.feeSplitTreasuryBps)} / ${formatBps(EDITION.feeSplitRewardsBps)}. Anyone can trigger it.`,
    },
    {
      label: "Treasury owed",
      value: data.treasuryLiability,
      note: "Split off but not yet delivered. Anyone can retry the payment.",
    },
    {
      label: "Still streaming",
      value: data.streamUnmatured,
      note: `Inside the current ${EDITION.streamEpochSeconds}-second window.`,
    },
    {
      label: "Matured, awaiting release",
      value: data.streamReleasable,
      note: "Ready to move on to the revenue vault. Anyone can push it.",
    },
    {
      label: "Awaiting allocation",
      value: data.vaultUnallocated,
      note: `Held before being divided between editions by weight, then between ${BRAND.groupTermPlural.toLowerCase()}.`,
    },
  ];

  return (
    <section>
      <h2 className="rule-label mb-3">Reward pipeline</h2>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((s) => (
          <div key={s.label} className="bg-ink-950 p-4">
            <dt className="rule-label">{s.label}</dt>
            <dd className="mt-1.5 font-mono text-base text-ink-100">
              {s.value === undefined ? (
                <span className="text-ink-600">not read</span>
              ) : (
                `${formatAssetAmount(s.value, 18)} WETH`
              )}
            </dd>
            <p className="mt-2 text-xs leading-relaxed text-ink-500">{s.note}</p>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-4">
        {QUARTERS.map((q) => {
          const pending = data.vaultPerQuarterPending[q.index];
          return (
            <div key={q.index} className="bg-ink-950 p-4">
              <p className="rule-label">{q.label} awaiting conversion</p>
              <p className="mt-1.5 font-mono text-sm text-ink-200">
                {pending === undefined ? (
                  <span className="text-ink-600">not read</span>
                ) : (
                  `${formatAssetAmount(pending, 18)} WETH`
                )}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Each {BRAND.groupTerm.toLowerCase()} converts independently. A route that fails leaves
        only that {BRAND.groupTerm.toLowerCase()}&apos;s WETH pending, and pending is a
        comfortable resting state — sometimes for days, if the asset is thinly traded.
      </p>
    </section>
  );
}

function Stat({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <div className="bg-ink-950 p-5">
      <dt className="rule-label">{label}</dt>
      <dd className="mt-1.5 font-mono text-xl text-ink-100">
        {value}
        {unit && <span className="ml-1.5 text-sm text-ink-500">{unit}</span>}
      </dd>
    </div>
  );
}
