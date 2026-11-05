# Frontend guide

For a developer joining to work on the interface. Read the first two sections before you
change anything; the rest you can come back to.

The protocol side lives in `contracts/` and you can largely ignore it. What you cannot
ignore is the rule in **The one rule** below — it is the reason several things in this
codebase look more awkward than they need to, and undoing that awkwardness is the main
way to break the project.

---

## Run it

```bash
cd web
cp .env.example .env.local      # every value may stay blank
npm install
npm run dev                     # http://localhost:3000
```

Node 22. The site runs with **nothing configured** — that is deliberate, not a broken
setup. With an empty `.env.local` every page renders, and anything that needs a contract
says so instead of showing a number. You can do almost all UI work in that state.

Before you push:

```bash
npm run typecheck     # tsc --noEmit, strict
npm run lint
npm run build         # runs check:parameters first, as a prebuild hook
```

CI (`.github/workflows/ci.yml`) runs exactly those plus the Foundry suite, on every push
and PR.

---

## The one rule

**A number on screen is a claim about chain state. If we cannot verify it, we do not show
it.** No defaults, no last-known values, no estimates, no zero-as-a-stand-in. An empty
state stays empty.

This is not a style preference. People make money decisions on these pages, and a figure
that is wrong in a confident typeface is worse than no figure.

The codebase splits every number into two kinds, and they must never be confused:

| | **Reading** | **Parameter** |
|---|---|---|
| Comes from | a live contract call, this page load | a constant compiled into the contracts, mirrored in `lib/brand.ts` |
| Example | how many cards have been minted | how many cards *can* be minted (400) |
| If unavailable | withheld, with a reason | n/a — it is true before anything is deployed |
| Labelled with | nothing (it is just the truth) | `<Parameters />` from `components/Provenance.tsx` |

Every block of parameters on a page carries a `<Parameters />` note saying "Set in the
contracts at deployment, not read from chain." If you add a parameter block, add the note.
Without it a reader cannot tell which kind of number they are looking at, and a page that
leaves them guessing will eventually be believed about something it does not know.

### How that is enforced in code

`lib/reads.ts` defines a discriminated union that every hook returns:

```ts
export type ReadState<T> =
  | {status: "unconfigured"; missing: string[]}   // env vars absent — names included
  | {status: "loading"}
  | {status: "error"; error: Error}
  | {status: "ready"; data: T}                    // the ONLY variant carrying data
```

Data exists only on `ready`. There is no field to read on the other three, so a component
*cannot* render a figure from a failed read — TypeScript stops you. That is the point: the
rule is structural, not a convention people remember.

`components/ReadGate.tsx` is the only sanctioned way to unwrap it:

```tsx
<ReadGate
  state={counts}
  loadingLabel="Reading each district's count…"
  failureLabel="Counts did not read back, so no district can be chosen yet."
>
  {(data) => <YourThing minted={data.perQuarter[0]} />}
</ReadGate>
```

The children prop is a function receiving `T`, called only on `ready`. The `unconfigured`
branch prints the exact missing variable names so an operator knows what to set.

**Things that will get a change rejected:**

- `?? 0` or `|| 0` on a value from a read. A failed read is not zero. If you find a hook
  returning `bigint` where it should return `bigint | undefined`, that is a bug — three of
  those have been fixed already.
- Reaching into `state.data` without `ReadGate` or `isReady()`.
- Rendering a cached or previous value while a refetch is in flight.
- Showing APY, projected returns, or any annualised figure. There are none, anywhere.
- A disabled control with no reason given. If a button is off, say why.

`docs/data-sources.md` maps **every** figure on the site to the exact call behind it, and
lists what is deliberately never shown. Check it before adding a number.

---

## Map

```
web/
  app/                 routes (App Router)
    page.tsx           the landing page — all parameters, no reads
    board/             the 400-card grid, and /board/[id] per card
    mint/  cards/  rent/  stats/      the transactional pages
    rulebook/          generated long-form copy
    terms/  privacy/   placeholders, and they say so
    layout.tsx         fonts, metadata, Providers
    providers.tsx      wagmi + react-query + RainbowKit
  components/          see below
  lib/
    brand.ts           EVERY name and fixed number. Single source of truth.
    config.ts          env → addresses, chain, feature flags
    reads.ts           ReadState + every chain-reading hook
    batch.ts           multicall batching (Cursor / useBatch)
    abis.ts            contract ABIs
    levelStyle.ts      per-level colour + the board-rule label
    pieces.ts          which art file belongs to which level
    format.ts          number/bps formatting
    rulebook.ts        rulebook content as data
    wagmi.ts           connector setup
  public/pieces/       the five building renders
  scripts/             check-parameters.mjs, gen-rulebook.mjs
```

### Components, grouped

**Chrome** — `Header` (sticky, district-colour hairline, network status, Buy control),
`Footer`, `Section` + `SectionHead` (every landing section is built from these),
`Disclaimer`, `Mark` (the logo).

**Landing page** — `LevelCarousel` (the hero card that rotates through all five levels),
`LevelCards` (the five-up row), `WeightComparison`, `PhaseNotice`, `Icons`.

**Cards and art** — `PieceArt` (renders a level's building), `CardPage`, `CardDetail`,
`MyCards`, `BoardView`.

**Transactional** — `MintFlow`, `GroundRent`, `Pipeline`, `Buyback`, `Stats`, `TxButton`.

**Read safety** — `ReadGate`, `Provenance` (`<Parameters />`, `<VenueParameter />`).

---

## Design system

A board game printed on paper, not a dashboard. Cream card stock on flat coloured fields,
everything bounded by a heavy ink rule rather than a hairline, hard offset shadows instead
of blur, and numbers set in mono because on most of these pages the number *is* the
argument.

Sections are separated by **changing the colour of the page**, not by whitespace. That is
what stops a long rulebook reading like a spreadsheet.

### Tokens — `tailwind.config.ts`

```
paper #f6efdd   paperCard #fffdf6   paperShade #eadfc4     the stock
ink   #14110a   inkMuted  #5f574a   inkFaint   #8f8675     printed ink
seal  #bb2018   the stamp — used sparingly, always to mean something
felt  #1d5c4a   gold #e2a615

quarter-1 #164a9e   quarter-2 #b04a06   quarter-3 #146138   quarter-4 #63278c
  The four district hues. Also exposed as CSS vars --quarter-1..4 so they can be set
  inline via style={{backgroundColor: `var(${q.colorVar})`}}. Separated on lightness as
  well as hue, so they survive greyscale and colour blindness. Use as whole fields, not dots.

field-cream #f7f2e6   field-sky #bfe4ec   field-sun #f5c937   field-night #141414
  Full-bleed section fields.

tint-cream  #fdf8ec   tint-sun #fdf0c4   tint-peach #fbdcc8
tint-sky    #d8e4fb   tint-mint #cfeedd   tint-lilac #e6dcf7
  Card faces. All six carry ink at body size with room to spare.
```

Type: `font-display` (Inter Tight, headlines), `font-sans` (Inter, prose), `font-mono`
(IBM Plex Mono, **every number**). Sizes `display-xl / display-lg / display-md / stat /
body-lg` are all `clamp()`, so a headline fills a phone and a desktop equally well — do not
add fixed-px headline sizes.

`border-rule` is 2px — the standard border everywhere. Shadows `card` / `cardSm` /
`cardLg` are hard offsets (`4px 4px 0 0`), plus `cardSeal` and `cardGold` struck in colour.
No blurred shadows anywhere.

### Utility classes — `app/globals.css`

`.panel` card stock with a rule · `.panel-raised` the same, lifted · `.band` a full-bleed
field · `.band-ink/-felt/-seal/-sky/-sun/-cream/-night` · `.card-row` a row lifted as one
block, not card by card · `.tile` + `.tile-cap` · `.pip` a numbered circle ·
`.rule-label` the small spaced mono label · `.figure` a big mono stat ·
`.btn` / `.btn-primary` / `.btn-secondary` · `.scrollbar-none`

Buttons sit proud of the page and press down when used (translate + shadow removal on
`:active`). Keep that — it is most of the tactility.

### Per-level colour — `lib/levelStyle.ts`

One record keyed by level, so a Tower is the same orange in the hero card and in the row
below it. Two files each picking their own palette is how a page ends up with a level that
changes colour when you scroll past it.

```
1 House     felt green   2 Residence blue   3 Building purple
4 Tower     orange       5 Landmark  seal red
```

Also exports `boardRule(level, burn)` → `Mint · 100k` / `Build · 500k` / `Final · 2M`, and
`shortTokens()`.

### Motion

Almost none, by design. The exception is `LevelCarousel`, which rotates through the five
levels every 3.6s. It stops the moment a reader takes hold of it — hover, focus, or picking
a dot — and never starts at all under `prefers-reduced-motion`. `globals.css` also kills
all animation under that media query globally. Respect both.

---

## Single sources of truth

### `lib/brand.ts`

**Every** name and every fixed number. The project name, ticker, edition name, the word for
a group of cards, the five levels and their weights and burns, the four districts, the
disclaimers. Nothing outside this file should contain the project name or ticker — a
rename is one edit here.

Key exports: `BRAND`, `EDITION`, `LEVELS`, `QUARTERS`, `MAX_LEVEL`, `BUILD_BURN_RANGE`,
`OWNER_FUNCTION_COUNT`, `GLOBAL_DISCLAIMER`, `NON_AFFILIATION`, `REWARD_ASSET_EXPLAINER`.

> **Naming, which is genuinely confusing:** the *contracts* call a group of cards a
> **quarter** (`QUARTER_CAP`, `claimQuarter`, `perQuarter`). The *interface* calls it a
> **district**. That is intentional — the on-chain term is frozen, the user-facing one is
> `BRAND.groupTerm`. Never hardcode either word in a component; use `BRAND.groupTerm`.

Districts are named after the asset each pays in — NVDA, GOOGL, AAPL, META. Those labels
are written in `brand.ts`, not read from a contract, and may only be used **as names**.
Anywhere a live figure appears, the asset symbol is read from its own contract and that
read is what is shown beside the number.

### `lib/config.ts`

Env → typed config. Twelve contract addresses, four reward assets, chain id, RPC, plus
`POOL_URL`, `X_URL`, `SITE_URL`, `LAUNCH_PHASE`, `USES_WALLETCONNECT`.

An address that is absent or malformed simply does not appear in `ADDRESSES`. Helpers:
`hasAddresses(keys)`, `missingAddressNames(keys)` (returns the env var names, for the
`unconfigured` state), `requireAddress(key)`.

`LAUNCH_PHASE` is `LaunchPhase | undefined` with **no default** and is never inferred. The
interface could guess from whether a pool address is set; a wrong guess would tell somebody
the launch had reached a stage it had not. Unset means `PhaseNotice` renders nothing —
and the caller collapses its own padding via the exported `HAS_PHASE_NOTICE`.

---

## The art

Five renders in `web/public/pieces/`, one per level:

```
house-v2  residence-v2  building-v2  tower-v2  landmark-v2
  .png   1024×1024, transparent, for token metadata and social cards
  .webp   512×512, transparent, what the site actually loads
```

Transparent cut-outs with **straight (unpremultiplied) alpha** — premultiplied-against-black
or -white gives a visible fringe on coloured fields. Each is trimmed to the building and
re-centred on a square canvas with one shared margin and one shared ground line, so the
five stand on the same floor and the ladder climbs by silhouette.

`lib/pieces.ts` maps level → slug. `PieceArt` renders with `object-contain`; where a render
is missing it shows a marked placeholder rather than a substitute drawing.

**The `-v2` suffix is load-bearing.** Next's image optimiser caches by URL, so replacing art
under a name it has already served hands readers the old pieces. If you swap art, change the
filename. (This bit me during development — the old buildings kept appearing.)

`docs/art-brief.md` describes the commissioning spec, though parts of it are now stale: it
still describes the renders as outstanding and the districts as "Quarter One" etc.

---

## What CI enforces

`npm run check:parameters` runs as a **prebuild hook** — you cannot build without it passing.
It parses the Solidity source directly (not an ABI, not a deployment, either of which could
be stale in exactly the way this exists to catch) and fails if anything in `brand.ts` has
drifted from the contracts: supply, caps, mints per wallet, mint burn, the full level
schedule and weight multiplier, the fee split, stream epoch, royalty bps, and the count of
`onlyOwner` functions the rulebook claims is exhaustive.

So: **if you change a number in `brand.ts`, the build will tell you whether you were allowed
to.** If it fails, the copy is wrong, not the check.

---

## Gotchas

- **`npx next` without installing first** grabs whatever Next is latest, not the pinned v15.
  Always `npm ci` first.
- **Stale image cache.** `rm -rf .next/cache/images` after replacing anything in
  `public/pieces/` with the same filename.
- **A stale `next start` holds the port** and serves HTML referencing chunks a rebuild
  deleted, which shows up as `ChunkLoadError`. Kill it, or use a different port.
- **One-column CSS grids** size their implicit column to `auto`, which cannot go below its
  content's min-content width. A bare text node inside a `flex` row is an anonymous flex
  item with `min-width: auto`. Together those overflowed the rulebook sideways on a phone.
  Fix with `grid-cols-[minmax(0,1fr)]` and a `min-w-0` wrapper. Sweep at 360/390/768 after
  layout work.
- **The contracts' word is "quarter", the UI's is "district".** See above.
- `/terms` and `/privacy` are placeholders and say so in the copy. They need real content
  before launch.

---

## Where to start

Good first tasks, roughly ascending:

1. Read `app/page.tsx` top to bottom. It is the whole design system in one file and touches
   no chain state.
2. Sweep the pages at 360 / 390 / 768 and fix anything that overflows.
3. Accessibility pass — focus order, `aria-live` on the read states, contrast on the tints.
4. `/board` is the heaviest page (400 cells, multicall batched). Worth profiling.
5. The empty states are load-bearing copy, not filler. If you can make them clearer without
   making them claim more, that is real work.

**Before you open a PR**, re-read **The one rule**. Everything else here is a preference you
can argue with. That one is not.

---

## Further reading

- [`docs/data-sources.md`](data-sources.md) — every figure → the call behind it, and what is
  never shown
- [`docs/deploying-the-site.md`](deploying-the-site.md) — hosting, and the three env stages
- [`docs/rulebook.md`](rulebook.md) — how the game actually behaves, including the risks
- [`docs/chain-notes.md`](chain-notes.md) — the chain, the venue, the reward assets
- [`README.md`](../README.md) — the protocol side
