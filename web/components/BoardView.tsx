"use client";

import {useMemo, useState, type ReactNode} from "react";
import {useAccount} from "wagmi";
import {BRAND, EDITION, QUARTERS, formName, type Quarter} from "@/lib/brand";
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
        eyebrow={`The complete ${EDITION.cardSupply}-card register`}
        heading="Enter the board."
        sub={`Four ${BRAND.groupTermPlural.toLowerCase()}, one finite city. Minted cards show their real onchain level, weight, and owner.`}
        tone="cream"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        <ReadGate
          state={counts}
          loadingLabel="Reading card state…"
          failureLabel="Registry unavailable. Onchain reads did not succeed."
        >
          {(data) => (
            <>
              <div className="card-row mb-8 grid bg-ink sm:grid-cols-2 lg:grid-cols-5">
                <div className="bg-ink px-5 py-5 text-paperCard">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-field-sun">
                    Claimed
                  </p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums leading-none">
                    {formatCount(data.total)}
                    <span className="text-paperCard/40"> / {formatCount(data.cardSupply)}</span>
                  </p>
                </div>
                {QUARTERS.map((q) => (
                  <div key={q.index} className="bg-paperCard">
                    <div
                      aria-hidden
                      className="tile-cap"
                      style={{backgroundColor: `var(${q.colorVar})`}}
                    />
                    <div className="px-5 py-4">
                      <p className="rule-label">{q.label}</p>
                      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-ink">
                        {formatCount(data.perQuarter[q.index] ?? 0n)}
                        <span className="text-inkFaint"> / {formatCount(data.quarterCap)}</span>
                      </p>
                    </div>
                  </div>
                ))}
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
                quarterCap={Number(data.quarterCap)}
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
              className={`flex items-center gap-2 border-rule border-ink px-3 py-1.5 text-sm font-medium transition-transform ${
                quarter === q.index
                  ? "text-paperCard shadow-cardSm"
                  : "bg-paperCard text-inkMuted hover:-translate-y-px hover:text-ink"
              }`}
              style={
                quarter === q.index
                  ? {backgroundColor: `var(${q.colorVar})`}
                  : undefined
              }
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 border border-ink"
                style={{
                  backgroundColor:
                    quarter === q.index ? "#fffdf6" : `var(${q.colorVar})`,
                }}
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
              className={`border-rule border-ink px-3 py-1.5 text-sm font-medium capitalize transition-transform ${
                ownership === o
                  ? "bg-ink text-paperCard shadow-cardSm"
                  : "bg-paperCard text-inkMuted hover:-translate-y-px hover:text-ink"
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
              className={`border-rule border-ink px-3 py-1.5 text-sm font-medium transition-transform ${
                levelFilter === l
                  ? "bg-ink text-paperCard shadow-cardSm"
                  : "bg-paperCard text-inkMuted hover:-translate-y-px hover:text-ink"
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
  quarterCap,
  ownership,
  levelFilter,
  onSelect,
}: {
  quarter: number;
  mintedCount: number;
  /** Read from the collection, so the grid draws exactly the capacity that exists. */
  quarterCap: number;
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

  const firstId = BigInt(quarter) * BigInt(quarterCap) + 1n;
  const cells = Array.from({length: quarterCap}, (_, i) => firstId + BigInt(i));

  return (
    <ReadGate
      state={cards}
      loadingLabel="Reading card state…"
      failureLabel="Registry unavailable. Onchain reads did not succeed."
    >
      {() => {
        if (mintedCount === 0) {
          return (
            <Plate quarter={quarterMeta} cap={quarterCap}>
              <div className="px-6 py-16 text-center">
                <p className="font-display text-2xl font-bold text-ink">
                  Nothing claimed here yet.
                </p>
                <p className="mt-3 text-sm text-inkMuted">
                  All {quarterCap} plots in this {BRAND.groupTerm.toLowerCase()} are open
                  capacity.
                </p>
              </div>
            </Plate>
          );
        }

        return (
          <Plate quarter={quarterMeta} cap={quarterCap}>
          <div
            className="grid gap-1.5 p-4"
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
                    className="aspect-square border border-dashed border-ink/25 bg-paper"
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
                  className={`group relative aspect-square border-rule text-paperCard transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-cardSm ${
                    isYours ? "border-gold" : "border-ink"
                  }`}
                  style={{backgroundColor: `var(${quarterMeta?.colorVar ?? "--quarter-1"})`}}
                >
                  <span className="absolute inset-x-0 top-1 font-mono text-[9px] leading-none opacity-70">
                    {card.tokenId.toString()}
                  </span>
                  <span className="absolute inset-x-0 bottom-1.5 font-mono text-xs font-semibold leading-none">
                    {card.level}★
                  </span>
                  {isYours && (
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 h-1.5 w-1.5 bg-gold"
                    />
                  )}
                </button>
              );
            })}
          </div>
          </Plate>
        );
      }}
    </ReadGate>
  );
}

/**
 * The grid sits on card stock under a band of its own colour, so switching
 * {BRAND.groupTermPlural.toLowerCase()} is visible at a glance rather than only in the
 * pressed tab above it.
 */
function Plate({
  quarter,
  cap,
  children,
}: {
  quarter: Quarter | undefined;
  cap: number;
  children: ReactNode;
}) {
  return (
    <div className="border-rule border-ink bg-paperCard shadow-cardLg">
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b-rule border-ink px-5 py-3 text-paperCard"
        style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
          {quarter?.label ?? BRAND.groupTerm}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">
          {EDITION.gridSize} × {EDITION.gridSize} · {cap} plots
        </p>
      </div>
      {children}
    </div>
  );
}

function Hidden() {
  return <div aria-hidden className="aspect-square border border-dashed border-ink/10" />;
}

export function CardSummaryLine({card}: {card: CardState}) {
  return (
    <p className="font-mono text-xs text-inkMuted">
      #{card.tokenId.toString()} · {formName(card.level)} · {BRAND.scoreTerm} {card.weight} ·{" "}
      {formatCompactTokens(card.burned)} burned · {shortAddress(card.owner)}
    </p>
  );
}
