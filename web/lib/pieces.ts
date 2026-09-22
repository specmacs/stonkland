import {LEVELS, formName} from "./brand";

/**
 * The commissioned render for each level, where one exists.
 *
 * The 1024px masters live beside these at `/pieces/<slug>.png` for marketplaces and
 * social cards that cannot render the page. Nothing in the interface loads them; token
 * metadata points at them by URL.
 *
 * Four of the five were delivered. They are mapped by how much building stands on the
 * plot, not by the signage baked into two of the renders: a sign reading "THE RESIDENCE"
 * on a six-storey block is that render's own flavour text, and this ladder's level names
 * are set in `brand.ts`. Level 3 has no render yet and deliberately shows a marked
 * placeholder rather than a drawing dressed up as finished art -- swapping it in later is
 * one line here.
 *
 * Every entry is a square, transparent cut-out on a shared baseline, so the five sit at
 * one scale on any field the interface puts them on.
 */
const ART: Record<number, string | undefined> = {
  1: "house",
  2: "residence",
  3: undefined,
  4: "tower",
  5: "landmark",
};

export function pieceArtSlug(level: number): string | undefined {
  return ART[level];
}

/** What the site loads: 512px, which covers the largest on-page use at 2x. */
export function pieceWebPath(level: number): string | undefined {
  const slug = ART[level];
  return slug ? `/pieces/${slug}.webp` : undefined;
}

export function pieceAlt(level: number): string {
  return `${formName(level)}, level ${level} of ${LEVELS.length}`;
}
