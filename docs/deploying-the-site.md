# Deploying the site

The interface can go live **now**, before anything is deployed onchain. With no contract
addresses configured it shows what it knows — which is nothing — and names the variable
missing behind each blank. Nothing has to be hidden or faked in the meantime.

## Host

It is a standard Next.js 15 app in `web/`, with no server routes, no database and no
runtime secrets. Anything that serves Next.js works. On Vercel:

- **Root directory:** `web`
- **Framework preset:** Next.js (detected)
- **Build command / install:** defaults are correct

No `vercel.json` is needed and none is committed, so the host stays swappable.

`npm run build` runs `check:parameters` first. A build cannot ship copy that has drifted
from the contracts.

## Environment, in three stages

Every variable is `NEXT_PUBLIC_*` and therefore public. There are no secrets here — if a
value would be damaging to publish, it does not belong in this app.

### Stage 1 — before the token exists

```
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_SITE_URL=https://<your domain>
```

That is enough to ship. The rulebook, the board layout, the level ladder and the legal
pages all work. Every figure that would need a contract reads as unavailable and says
which variable is missing. Every transaction control is disabled with a reason.

Leave `NEXT_PUBLIC_LAUNCH_PHASE` unset: unset means nobody has said where the launch is,
and the interface says nothing rather than guessing.

### Stage 2 — token launched, curve running

Add:

```
NEXT_PUBLIC_LAUNCH_PHASE=curve
NEXT_PUBLIC_POOL_URL=<the Pons page for the token>
NEXT_PUBLIC_X_URL=<if there is one>
```

`POOL_URL` is what enables the Buy control. Until it is set that control renders disabled,
because the interface will not guess a market URL.

### Stage 3 — contracts deployed

Copy the block the deploy script writes. `script/Deploy.s.sol` emits a manifest with every
address; the local script writes the env block directly. Then the whole interface comes
alive at once: figures, controls, the board, the pipeline, the buyback panel.

After graduation, also set `NEXT_PUBLIC_LAUNCH_PHASE=graduated`.

## Checks

CI runs on every push: contract build and tests, then the web parameter check, typecheck,
lint and build. The parameter check is the one that matters most — it compares the figures
the site publishes against the constants in the Solidity and fails on drift.

## What is deliberately absent

- **No analytics, no tracker, no third-party script.** Verified with a network trace across
  every page: nothing leaves the origin. WalletConnect is only included when a project id
  is configured, because its library calls its own servers on page load.
- **No backend, no database, no secrets.** The site is static files plus calls the
  browser makes directly to an RPC endpoint.
- **No indexer.** Reads go straight to the chain, so a figure is never one that was true a
  moment ago being presented as true now.
