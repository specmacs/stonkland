# stonkland

A board game that settles onchain: a fixed-supply ERC-20 paired with a hard-capped
collection of property cards. Owners burn the token to advance a card through five levels,
each level carries a fixed weight, and protocol revenue is converted into per-quarter
reward assets and distributed in proportion to weight.

No emissions. Holders can only ever claim assets that were actually deposited.

```
contracts/   Foundry project — the protocol
web/         Next.js App Router — the interface
docs/        Rulebook and art brief
```

## The shape of it

Three loops, decoupled so any one can stall without touching the others:

- **Ownership** — mint, transfer, sell. Plain ERC-721, and transfers are pausable by nobody.
- **Progression** — burn, advance a level, raise weight. Irreversible.
- **Rewards** — capture fees, stream, convert, deposit, claim. Every stage is open to anyone.

The founding edition is 400 cards across four quarters of 100, at a 1.25× weight
multiplier. See [`docs/rulebook.md`](docs/rulebook.md) for how it behaves, including the
parts that carry risk.

## Contracts

```bash
cd contracts
forge build
forge test                        # unit, fuzz, adversarial, invariant
FOUNDRY_PROFILE=deep forge test   # 10k fuzz runs, 1024 invariant runs
```

The accounting is where the risk lives. `Distributor` is an accumulator per
`(edition, asset, quarter)`, so a deposit is O(1) however many cards exist and the
collection is never iterated. Cards are settled at their old weight before any weight is
written and before any ownership moves.

### Deploying

`script/SystemDeployer.sol` holds the sequence, as a library so the script and the tests
run the same code. `script/DeploymentChecks.sol` verifies every published number against
what actually landed, and can be run again later by someone who did not do the deploying.

```bash
# Rehearse with no broadcast and diff the manifest first.
forge script script/Deploy.s.sol --fork-url $RPC_URL

# Then, only once the diff is empty:
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Deployments land with minting paused. Unpausing the minter is the launch.

## Interface

```bash
cd web
cp .env.example .env.local     # addresses come from here, never from code
npm install
npm run dev
```

Reads go straight to an RPC node with multicall batching. Every number on screen traces to
a read that succeeded; an address that is not configured disables the control that needed
it and says which variable is missing.

### Against a local chain

```bash
anvil
cd contracts && forge script script/DeployLocal.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key>
cp contracts/deployments/local.env web/.env.local
cd web && npm run dev
```

`DeployLocal` brings up a stand-in venue and four placeholder reward assets, and refuses
to run anywhere but a local chain.

## Renaming

The brand is not final. `web/lib/brand.ts` is the only place the project name, ticker,
edition name, and vocabulary appear. A rename is one edit there.

## Robinhood Chain

The deployment target is Robinhood Chain (4663), with tokenized NVDA, GOOGL, AAPL and
META as the four quarters' reward assets. [`docs/chain-notes.md`](docs/chain-notes.md)
records every address, how it was established, and what is still open.

Two findings worth knowing before reading the code:

- **The reward assets are not transfer-restricted.** A contract can hold them and pass
  them on, verified against the live chain. That was the one finding that could have
  ended the design rather than delayed it.
- **There are no price feeds on this chain.** `UniswapV3TwapAdapter` therefore prices
  against the route's own 30-minute average and bounds both the pool's deviation from it
  and the trade's own impact. Where a real feed exists, `UniswapV3Adapter` is the better
  choice and the vault can swap between them without touching accounting.

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path 'test/fork/*' -vv
```

## Before launch

See the blocking items in the handoff: an independent audit, securities counsel sign-off,
the jurisdiction decision implemented, confirmation from each reward asset's issuer,
liquidity depth confirmed, terms and privacy published, monitoring, and a written incident
procedure. `/terms` and `/privacy` currently say plainly that they are not yet in force.
