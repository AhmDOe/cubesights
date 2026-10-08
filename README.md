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

## Status

Planning phase. No application code yet. See:

- [`project.prd.md`](./project.prd.md) — the immutable original project brief.
- [`Agents.md`](./Agents.md) — tech stack, architecture, and agent operating rules.
- [`.tickets/Agents.md`](./.tickets/Agents.md) — the ticket workflow (BDD/TDD, task tracking, scripts).
- [`.tickets/`](./.tickets/) — individual ticket PRDs, starting with `ticket-001-foundation-cube-core`.
