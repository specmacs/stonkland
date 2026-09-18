# Art brief

Everything here must be original. A prior project shares these mechanics; nothing may be
adapted from its art, and nothing may reference Monopoly, Hasbro, or their marks — no top
hats, no "Go", no "Community Chest", no green-house-to-red-hotel progression, and no
Boardwalk-style place names. Not in the art, not in the file names, not in the prompts
used to produce it.

## What already exists

The five building forms and the mark ship as **original inline SVG**, drawn for this
project:

| Asset | Where |
|---|---|
| Five building levels | `web/components/PieceArt.tsx` |
| Mark | `web/components/Mark.tsx` |
| Favicon | `web/app/icon.tsx`, generated from the mark |
| OG image | `web/app/opengraph-image.tsx`, 1200×630, generated at request time |

They are vector rather than raster so they stay crisp at any size, weigh almost nothing,
and need no re-export when the brand name changes. They satisfy the brief's constraints:
one camera angle and one light direction across all five levels, a footprint that never
changes while the silhouette grows upward and denser, neutral greys so quarter colour is
applied by the interface rather than baked in, and a signature silhouette reserved for
the Landmark alone.

## What still needs commissioning

Raster versions, for the places that cannot render inline SVG — marketplace listings,
social cards, and any printed material.

**Five building levels** — `web/public/game/pieces/level-{1..5}-{house,residence,building,tower,landmark}.png`

- Consistent isometric view: same camera angle and light direction across all five
- Transparent background, square canvas, 1024×1024, PNG
- Each level must read as the same plot developed further. The silhouette grows upward and
  denser; the footprint stays constant
- **House** single storey, pitched roof · **Residence** two to three storeys ·
  **Building** mid-rise, flat roof, visible grid of windows · **Tower** high-rise with
  setbacks · **Landmark** distinctive crown or spire, the only level allowed a signature
  silhouette
- **Do not** use green houses and red hotels, or any palette pairing that reads as a
  famous board game
- Neutral materials. Quarter colour coding is applied in the interface, never baked into
  the art

Match `PieceArt.tsx` closely enough that a card looks like the same object in both places.

**Mark** — `web/public/brand/mark.png` plus SVG. Legible at 24px, works on light and dark.
The shipped mark is a surveyor's corner: two plot boundaries meeting around the parcel
they bound. A raster export at several sizes is what is missing.

## Quarter colours

Four hues, defined in `web/tailwind.config.ts` and `web/app/globals.css`:

| Quarter | Hex |
|---|---|
| One | `#4a8fd4` |
| Two | `#d98b3a` |
| Three | `#5fa86b` |
| Four | `#a774c4` |

They separate on lightness as well as hue, so they stay distinguishable in greyscale and
under the common forms of colour blindness. Any replacement palette has to clear the same
bar — check it in a deuteranopia and protanopia simulation before adopting it, and check
it in greyscale.

## Still open

- Quarter names. `Quarter One` through `Quarter Four` are placeholders in
  `web/lib/brand.ts`, waiting on the reward assets being settled.
- Whether each quarter gets its own art treatment beyond the colour token.
