"use client";

import {useEffect, useRef, useState} from "react";
import {BRAND, LEVELS} from "@/lib/brand";
import {boardRule, levelStyle, shortTokens} from "@/lib/levelStyle";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";

/** How long each level holds before the card turns over. */
const DWELL_MS = 3600;

/**
 * The ladder as one card that turns over.
 *
 * Five forms shown in a row all at once makes the reader compare them; shown one at a
 * time in the same frame, they read as one card being built, which is what the game
 * actually is. The row of five still exists further down the page for comparing.
 *
 * It stops the moment the reader takes hold of it -- hovers it, focuses inside it, or
 * picks a level from the dots -- because a thing that keeps moving while you are reading
 * it is worse than one that never moved. It never starts at all under
 * `prefers-reduced-motion`, which the dots then serve as the only way through.
 *
 * Every figure on it is a parameter from `brand.ts`, not a reading: these are the five
 * levels the contracts define, and they say the same thing before a single card exists.
 */
export function LevelCarousel({className = ""}: {className?: string}) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  /* Once the reader picks a level, the card stays where they put it. */
  const held = useRef(false);

  useEffect(() => {
    const motionOk =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRunning(motionOk);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LEVELS.length);
    }, DWELL_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const stop = () => {
    held.current = true;
    setRunning(false);
  };
  const resume = () => {
    if (held.current) return;
    const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motionOk) setRunning(true);
  };

  const level = LEVELS[index];
  if (!level) return null;
  const style = levelStyle(level.level);
  const top = level.level === LEVELS.length;

  return (
    <div
      className={`border-rule border-ink bg-paperCard shadow-cardLg ${className}`}
      onMouseEnter={() => setRunning(false)}
      onMouseLeave={resume}
      onFocusCapture={() => setRunning(false)}
      onBlurCapture={resume}
    >
      <header
        className={`flex items-center justify-between gap-3 border-b-rule border-ink px-5 py-3.5 text-paperCard transition-colors duration-300 ${style.bar}`}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Level {level.level}
        </p>
        <p className={`font-mono text-sm font-semibold tabular-nums ${style.accent}`}>
          {String(level.level).padStart(2, "0")}
          <span className="opacity-50"> / {String(LEVELS.length).padStart(2, "0")}</span>
        </p>
      </header>

      {/* The field takes the level's colour and changes with it as the card turns
          over, so the colour is doing the same work as the header rather than just
          repeating it. */}
      <div className={`relative transition-colors duration-300 ${style.field}`}>
        <PieceArt
          key={level.level}
          level={level.level}
          priority={level.level === 1}
          className="aspect-square w-full"
        />
        <span
          aria-hidden
          className={`absolute bottom-0 left-0 h-1.5 w-full ${style.bar} transition-colors duration-300`}
        />
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl font-bold leading-none text-ink">
            {level.form}
          </h2>
          <Stars level={level.level} size="sm" />
        </div>

        <dl className="mt-5 border-t-rule border-ink/15 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="rule-label">{BRAND.scoreTerm}</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums text-seal">
              {level.weight}
            </dd>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2.5">
            <dt className="rule-label">Board rule</dt>
            <dd className="font-mono text-sm tabular-nums text-ink">
              {boardRule(level.level, level.burnToReach)} {BRAND.tokenTicker}
            </dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <dt className="rule-label">Burned in total</dt>
            <dd className="font-mono text-sm tabular-nums text-inkMuted">
              {shortTokens(level.cumulativeBurn)} {BRAND.tokenTicker}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between gap-3 border-t-rule border-ink bg-tint-cream px-5 py-3">
        <p className="font-mono text-[10px] uppercase leading-tight tracking-[0.14em] text-inkMuted">
          {top ? "Top of the ladder" : "Keep burning to climb"}
        </p>
        <div className="flex shrink-0 gap-1.5">
          {LEVELS.map((l, i) => (
            <button
              key={l.level}
              type="button"
              onClick={() => {
                stop();
                setIndex(i);
              }}
              aria-label={`Show level ${l.level}, ${l.form}`}
              aria-current={i === index}
              className={`h-3 w-3 border-2 border-ink transition-colors ${
                i === index ? "bg-ink" : "bg-paperCard hover:bg-ink/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
