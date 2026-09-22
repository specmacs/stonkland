/**
 * The colour each level is struck in.
 *
 * One record, used by the rotating hero card and by the row of five below it, so the
 * Tower is the same orange in both places. Two files each picking their own palette is
 * how a page ends up with a level that changes colour when you scroll past it.
 *
 * The four saturated hues climb and the fifth breaks the pattern: a Landmark is not one
 * more step along a gradient, it is the end of the ladder, and it gets the stamp.
 */
export const LEVEL_STYLE: Record<
  number,
  {
    /** Header field. Carries white type at display size. */
    bar: string;
    /** The same hue at card-tint strength, for the field a render stands on. */
    field: string;
    /** Accent for the level number in the header. */
    accent: string;
  }
> = {
  1: {bar: "bg-felt", field: "bg-tint-mint", accent: "text-paperCard/60"},
  2: {bar: "bg-quarter-1", field: "bg-tint-sky", accent: "text-paperCard/60"},
  3: {bar: "bg-quarter-4", field: "bg-tint-lilac", accent: "text-paperCard/60"},
  4: {bar: "bg-quarter-2", field: "bg-tint-peach", accent: "text-paperCard/60"},
  5: {bar: "bg-seal", field: "bg-tint-sun", accent: "text-field-sun"},
};

export function levelStyle(level: number) {
  return LEVEL_STYLE[level] ?? LEVEL_STYLE[1]!;
}

/** Whole-token figures at card size. The exact figures are in the ladder table. */
export function shortTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  return `${tokens / 1_000}k`;
}

/**
 * The one-line rule for a level, framed as a move rather than a fee.
 *
 * Level 1 is the mint, levels 2 to 4 are builds, and level 5 is the last one there is.
 * Saying which it is matters: the same figure means "what it costs to enter" at the
 * bottom of the ladder and "what it costs to finish" at the top.
 */
export function boardRule(level: number, burnToReach: number): string {
  const amount = shortTokens(burnToReach);
  if (level === 1) return `Mint · ${amount}`;
  if (level === 5) return `Final · ${amount}`;
  return `Build · ${amount}`;
}
