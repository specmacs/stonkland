import {LEVELS, formName} from "./brand";

/**
 * The commissioned render for each level.
 *
 * The 1024px masters live beside these at `/pieces/<slug>-v2.png` for marketplaces and
 * social cards that cannot render the page. Nothing in the interface loads them; token
 * metadata points at them by URL.
 *
 * All five are transparent cut-outs on a straight (unpremultiplied) alpha channel, so
 * they float on any field the interface puts them on. Each has been trimmed to the
 * building and re-centred on a square canvas with the same margin and the same ground
 * line, so the five sit at one scale and the ladder climbs by silhouette: a low wide
 * house, a gabled one standing taller, then three, five and nine storeys.
 *
 * The `-v2` suffix is not decoration. Next's image optimiser caches by URL, so replacing
 * art under a name it has already served hands readers the old pieces; renaming is what
 * guarantees the new set is the set that ships.
 */
const ART: Record<number, string | undefined> = {
  1: "house-v2",
  2: "residence-v2",
  3: "building-v2",
  4: "tower-v2",
  5: "landmark-v2",
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
