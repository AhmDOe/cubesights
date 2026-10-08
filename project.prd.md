# CubeSights — Project PRD (Original Brief)

> **Immutable record.** This file captures the original project brief verbatim. Do not edit, reword, or delete this file after creation — amend scope via new tickets in `.tickets/` instead.

| Field | Value |
| --- | --- |
| Project | CubeSights |
| Created | 2026-10-08 |
| Status | Immutable — append-only via `.tickets/` |
| Ticket workflow | [`.tickets/Agents.md`](./.tickets/Agents.md) |
| Agent instructions | [`Agents.md`](./Agents.md) |

Any change in scope, interpretation, or priority is recorded as a new ticket under
`.tickets/ticket-xxx-short-description/prd.md`. This document is the fixed reference point
those tickets are measured against.

---

## Original prompt (verbatim)

```
using your hightest thinking mode and delegating planing and architecting to claude opus
plan and design a rubix cube webapp built with t3 stack
clean minimalistic design , goal of the app is to realize functionality as quick as posibile, use .tickets/ticket-xxx-short-description/prd.md to track what should be implemented
plan the first 5 tickets to realize the poc where application either connects to a smart rubix cubes and supports all the solution variants cfop, raux, zz,zb , blind solving, one hand
consult jperm.com for any needed info, and feel free to capitalize on existing opensource work and materials available in the public domain
a critical feature we want is for ability to use device camera to substitute for where we dont have a smart cube or lack gyro and orientation information,
in order for quick latency , camera detection and feature support and tracking of tiles should have the lowest latency and a responsive engine
we hope that this app can look at scrambled cube and show use move sequences to solve it for all variants , especially blind solve solutions including m2, old poachman and setup moves required
make an Agents.md in .tickets linked to root Agents.md on how to use tickets to record and track expected work, wwith appropriate bdd and tdd testing for all features and sub features
also leverage claude fast models for rapid implementation and opus for all thinking and planing of tickets, tickets should be relatively detailed
also cature this original prompt in project.prd.md and it should never be modified again after creation
```

---

## Derived requirements index

The brief above decomposes into the following numbered requirements. Tickets cite these IDs.

| ID | Requirement |
| --- | --- |
| R1 | Web app built on the T3 stack (Next.js, TypeScript, tRPC, Tailwind, Prisma, NextAuth). |
| R2 | Clean, minimalistic design; shortest possible path from "cube in hand" to "solution on screen". |
| R3 | Work tracked exclusively in `.tickets/ticket-xxx-short-description/prd.md`. |
| R4 | First 5 tickets deliver a POC. |
| R5 | Input path A: connect to Bluetooth smart cubes, read state and live moves. |
| R6 | Input path B: device camera scans a dumb cube's 6 faces and reconstructs state — required where no smart cube exists and where no gyro/orientation data is available. |
| R7 | Camera pipeline must be low-latency with responsive, continuous tile tracking (not photo-by-photo). |
| R8 | Solution generation for CFOP, Roux, ZZ, ZB, one-handed (OH), and blindfolded. |
| R9 | Blindfolded output must be human-memorizable: M2 edges, Old Pochmann, explicit setup moves, letter/target breakdowns — not a bare optimal move list. |
| R10 | Reuse existing open-source work and public-domain material (jperm.net reference material included) rather than reinventing. |
| R11 | BDD and TDD coverage for every feature and sub-feature. |
| R12 | Model policy: top-reasoning model (Opus) for all planning/architecture; fast models for routine implementation. |
| R13 | Tickets must be detailed, not stubs. |
| R14 | This file captures the original prompt and is never modified again. |
