"use client";

import {useMemo, useState} from "react";
import {useAccount} from "wagmi";
import {BRAND, EDITION, QUARTERS, formName} from "@/lib/brand";
import {formatCompactTokens, formatCount, shortAddress} from "@/lib/format";
import {useBoardCounts, useQuarterCards, type CardState} from "@/lib/reads";
import {PageHeader} from "./Section";
import {ReadGate} from "./ReadGate";
import {CardDetail} from "./CardDetail";

type Ownership = "all" | "available" | "minted" | "yours";
type LevelFilter = "all" | 1 | 2 | 3 | 4 | 5;

export function BoardView() {
  const [quarter, setQuarter] = useState(0);
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [selected, setSelected] = useState<CardState | null>(null);

  const counts = useBoardCounts();

  return (
    <>
      <PageHeader
        eyebrow={`THE COMPLETE ${EDITION.cardSupply}-CARD REGISTER`}
        heading="Enter the board."
        sub={`Four ${BRAND.groupTermPlural.toLowerCase()}, one finite city. Minted cards show their real onchain level, weight, and owner.`}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ReadGate
          state={counts}
          loadingLabel="Reading card state…"
          failureLabel="Registry unavailable. Onchain reads did not succeed."
        >
          {(data) => (
            <>
              <div className="panel mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
                <div>
                  <p className="rule-label">Claimed</p>
                  <p className="mt-1 font-mono text-2xl text-ink">
                    {formatCount(data.total)}
                    <span className="text-inkFaint"> / {EDITION.cardSupply}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {QUARTERS.map((q) => (
                    <div key={q.index}>
                      <p className="rule-label flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full"
                          style={{backgroundColor: `var(${q.colorVar})`}}
                        />
                        {q.short}
                      </p>
                      <p className="mt-1 font-mono text-sm text-inkMuted">
                        {formatCount(data.perQuarter[q.index] ?? 0n)}
                        <span className="text-inkFaint"> / {EDITION.quarterCap}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Filters
                quarter={quarter}
                onQuarter={setQuarter}
                ownership={ownership}
                onOwnership={setOwnership}
                levelFilter={levelFilter}
                onLevel={setLevelFilter}
              />

              <QuarterGrid
                quarter={quarter}
                mintedCount={Number(data.perQuarter[quarter] ?? 0n)}
                ownership={ownership}
                levelFilter={levelFilter}
                onSelect={setSelected}
              />
            </>
          )}
        </ReadGate>

        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-inkMuted">
          Minted details come from onchain reads. Open cells represent{" "}
          {BRAND.groupTerm.toLowerCase()} capacity only and never carry a placeholder ID, level,
          owner, or weight.
        </p>
      </div>

      {selected && <CardDetail card={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function Filters({
  quarter,
  onQuarter,
  ownership,
  onOwnership,
  levelFilter,
  onLevel,
}: {
  quarter: number;
  onQuarter: (q: number) => void;
  ownership: Ownership;
  onOwnership: (o: Ownership) => void;
  levelFilter: LevelFilter;
  onLevel: (l: LevelFilter) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-8 gap-y-4">
      <fieldset>
        <legend className="rule-label mb-2">{BRAND.groupTerm}</legend>
        <div className="flex flex-wrap gap-1.5">
          {QUARTERS.map((q) => (
            <button
              key={q.index}
              type="button"
              onClick={() => onQuarter(q.index)}
              aria-pressed={quarter === q.index}
              className={`flex items-center gap-1.5 border-rule px-3 py-1.5 text-sm font-medium transition-colors ${
                quarter === q.index
                  ? "border-ink bg-ink text-paper"
                  : "border-ink text-inkMuted hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              {q.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="rule-label mb-2">Ownership</legend>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "available", "minted", "yours"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onOwnership(o)}
              aria-pressed={ownership === o}
              className={`border-rule px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                ownership === o
                  ? "border-ink bg-ink text-paper"
                  : "border-ink text-inkMuted hover:text-ink"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="rule-label mb-2">Level</legend>
        <div className="flex flex-wrap gap-1.5">
          {(["all", 1, 2, 3, 4, 5] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLevel(l)}
              aria-pressed={levelFilter === l}
              className={`border-rule px-3 py-1.5 text-sm font-medium transition-colors ${
                levelFilter === l
                  ? "border-ink bg-ink text-paper"
                  : "border-ink text-inkMuted hover:text-ink"
              }`}
            >
              {l === "all" ? "All" : `${l}★`}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function QuarterGrid({
  quarter,
  mintedCount,
  ownership,
  levelFilter,
  onSelect,
}: {
  quarter: number;
  mintedCount: number;
  ownership: Ownership;
  levelFilter: LevelFilter;
  onSelect: (c: CardState) => void;
}) {
  const {address: wallet} = useAccount();
  const cards = useQuarterCards(quarter, mintedCount);
  const quarterMeta = QUARTERS[quarter];

  const byTokenId = useMemo(() => {
    const map = new Map<string, CardState>();
    if (cards.status === "ready") {
      for (const c of cards.data) map.set(c.tokenId.toString(), c);
    }
    return map;
  }, [cards]);

  const firstId = BigInt(quarter) * BigInt(EDITION.quarterCap) + 1n;
  const cells = Array.from({length: EDITION.quarterCap}, (_, i) => firstId + BigInt(i));

  return (
    <ReadGate
      state={cards}
      loadingLabel="Reading card state…"
      failureLabel="Registry unavailable. Onchain reads did not succeed."
    >
      {() => {
        if (mintedCount === 0) {
          return (
            <div className="panel p-8 text-center">
              <p className="text-sm text-inkMuted">
                No cards minted in this {BRAND.groupTerm.toLowerCase()} yet.
              </p>
              <p className="mt-2 text-xs text-inkMuted">
                All {EDITION.quarterCap} plots are open capacity.
              </p>
            </div>
          );
        }

        return (
          <div
            className="grid gap-1.5"
            style={{gridTemplateColumns: `repeat(${EDITION.gridSize}, minmax(0, 1fr))`}}
            role="grid"
            aria-label={`${quarterMeta?.label ?? "Quarter"} plots`}
          >
            {cells.map((tokenId) => {
              const card = byTokenId.get(tokenId.toString());

              // Filters
              if (ownership === "available" && card) return <Hidden key={tokenId.toString()} />;
              if (ownership === "minted" && !card) return <Hidden key={tokenId.toString()} />;
              if (ownership === "yours" && card?.owner.toLowerCase() !== wallet?.toLowerCase()) {
                return <Hidden key={tokenId.toString()} />;
              }
              if (levelFilter !== "all" && card?.level !== levelFilter) {
                return <Hidden key={tokenId.toString()} />;
              }

              if (!card) {
                // Capacity, and nothing more. No id, owner, level, or weight is invented
                // for a plot that does not exist yet.
                return (
                  <div
                    key={tokenId.toString()}
                    role="gridcell"
                    aria-label="Open plot"
                    className="aspect-square border border-dashed border-ink/25 bg-paperShade/50"
                  />
                );
              }

              const isYours = wallet && card.owner.toLowerCase() === wallet.toLowerCase();
              return (
                <button
                  key={tokenId.toString()}
                  type="button"
                  role="gridcell"
                  onClick={() => onSelect(card)}
                  title={`#${card.tokenId} · ${formName(card.level)} · ${BRAND.scoreTerm} ${card.weight}`}
                  className={`group relative aspect-square border-rule bg-paper transition-transform hover:-translate-y-0.5 ${
                    isYours ? "border-seal" : "border-ink"
                  }`}
                  style={{
                    boxShadow: `inset 0 -2px 0 0 var(${quarterMeta?.colorVar ?? "--quarter-1"})`,
                  }}
                >
                  <span className="absolute inset-x-0 top-1 font-mono text-[9px] leading-none text-inkFaint">
                    {card.tokenId.toString()}
                  </span>
                  <span className="absolute inset-x-0 bottom-2 font-mono text-[11px] font-semibold leading-none text-ink">
                    {card.level}★
                  </span>
                </button>
              );
            })}
          </div>
        );
      }}
    </ReadGate>
  );
}

function Hidden() {
  return <div aria-hidden className="aspect-square rounded border-rule border-ink/15 opacity-25" />;
}

export function CardSummaryLine({card}: {card: CardState}) {
  return (
    <p className="font-mono text-xs text-inkMuted">
      #{card.tokenId.toString()} · {formName(card.level)} · {BRAND.scoreTerm} {card.weight} ·{" "}
      {formatCompactTokens(card.burned)} burned · {shortAddress(card.owner)}
    </p>
  );
}
