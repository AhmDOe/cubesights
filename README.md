# CubeSights

CubeSights is a T3-stack web app that reads the state of a physical 3x3x3 Rubik's cube — either
from a Bluetooth smart cube's live move/state stream or from a low-latency device-camera scan of
the six faces — and immediately shows the user a move sequence that solves it, in the solving
method they chose: CFOP, Roux, ZZ, ZB, one-handed (OH), or blindfolded (BLD with M2 edges /
Old Pochmann corners, explicit setup moves and letter-pair targets).

Project scaffolded by **Ernest Asare-Asiedu**.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE) © Ernest Asare-Asiedu. Personal and
non-commercial use, copying, and modification are permitted. All commercial use and commercial
modification rights are reserved and are **not** granted under this license — a separate
commercial license from the copyright holder is required for any commercial purpose.

## Running the app

**Docker Compose (recommended — matches CI, and the primary way to debug via container logs):**

```sh
cp .env.example .env         # first time only
docker compose up -d app     # starts the app at http://localhost:3000
docker compose logs -f app   # tail logs — plain text, no extra wrapping
docker compose down          # stop
```

Run the E2E suite against the containerized app (the `test` service never starts on a bare
`up` — it's behind a Compose profile):

```sh
docker compose run --rm test
```

`scripts/check-docker-stack.sh` runs the whole sequence (build, health-check the app, verify logs,
run the E2E suite, tear down) and is what CI and `npm run test:e2e:docker` use.

**Local Node (faster iteration loop, no Docker):**

```sh
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
npm run test         # unit tests + BDD-scenario coverage check
npm run test:e2e     # Playwright, against a dev server it starts itself
```

## Project docs

- [`project.prd.md`](./project.prd.md) — the immutable original project brief.
- [`Agents.md`](./Agents.md) — tech stack, architecture, and agent operating rules.
- [`.tickets/Agents.md`](./.tickets/Agents.md) — the ticket workflow (BDD/TDD, task tracking, scripts).
- [`.tickets/`](./.tickets/) — individual ticket PRDs, starting with `ticket-001-foundation-cube-core`.
