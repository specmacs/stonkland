import {LEVELS, formName} from "./brand";

/**
 * The commissioned render for each level.
 *
 * The 1024px masters live beside these at `/pieces/<slug>.png` for marketplaces and
 * social cards that cannot render the page. Nothing in the interface loads them; token
 * metadata points at them by URL.
 *
 * All five are square night scenes on their own dark backdrop, lit from inside, shot on
 * one isometric angle at a consistent scale. They are not cut-outs: each one's backdrop
 * is vignetted rather than flat, so there is no clean key and no honest way to float the
 * building on a coloured field. The interface frames them instead -- the render fills its
 * panel edge to edge behind the same ink rule as everything else, which is what a card's
 * art does anyway.
 */
const ART: Record<number, string | undefined> = {
  1: "house",
  2: "residence",
  3: "building",
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
