"use client";

import {useEffect, useRef} from "react";
import {BRAND, QUARTERS, formName, levelInfo} from "@/lib/brand";
import {formatWholeTokens, shortAddress} from "@/lib/format";
import type {CardState} from "@/lib/reads";
import {PieceArt} from "./PieceArt";

/** Detail for one minted card. Everything shown here came from a read of that card. */
export function CardDetail({card, onClose}: {card: CardState; onClose: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const quarter = QUARTERS[card.quarter];
  const next = levelInfo(card.level + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Card ${card.tokenId}`}
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-lg bg-ink-900 p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="rule-label flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
              />
              {quarter?.label}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink-100">
              {BRAND.itemName} #{card.tokenId.toString()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-sm text-ink-400 hover:text-ink-200"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex gap-5">
          <PieceArt level={card.level} className="h-28 w-28 shrink-0" />
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="rule-label">Form</dt>
              <dd className="mt-0.5 text-ink-100">
                {formName(card.level)} <span className="text-ink-500">({card.level}★)</span>
              </dd>
            </div>
            <div>
              <dt className="rule-label">{BRAND.scoreTerm}</dt>
              <dd className="mt-0.5 font-mono text-brass-400">{card.weight}</dd>
            </div>
            <div className="col-span-2">
              <dt className="rule-label">Lifetime burn</dt>
              <dd className="mt-0.5 font-mono text-ink-200">
                {formatWholeTokens(card.burned)} {BRAND.tokenTicker}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="rule-label">Owner</dt>
              <dd className="mt-0.5 font-mono text-ink-300">{shortAddress(card.owner)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 border-t border-ink-800 pt-4 text-xs leading-relaxed text-ink-500">
          {next
            ? `Next level is ${next.form} at ${BRAND.scoreTerm} ${next.weight}, reached by burning ${next.burnToReach.toLocaleString("en-US")} ${BRAND.tokenTicker}. Only the current owner can build.`
            : `This card is at ${formName(card.level)}, the top of the ladder. It cannot be built further, reduced, or reset.`}
        </p>
      </div>
    </div>
  );
}
