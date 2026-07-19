# BCH Community Website — Build Plan

**Domain:** `txlab.cash`
**Positioning:** *A lab for exploring the Bitcoin Cash network — plus the best maintained map of the BCH world.*
**Not:** the official voice of BCH. **Yes:** the most useful, honest, technically serious hub. Tool-first framing: come for the Lab, stay for the Map.

---

## North star

Community-owned, tech-forward, ecosystem-first. A place where a curious newcomer, a developer, a merchant, a node operator, and a contributor all find their door — and where the site *demonstrates* BCH's capabilities instead of just describing them.

**Hero line:** *Peer-to-peer cash is programmable.*

---

## Site skeleton — four audience pathways

The whole site organizes around who's arriving:

- **Use BCH** — transact, choose a wallet, understand privacy, find merchants
- **Build on BCH** — CashScript, CashTokens, Libauth, contract patterns, playgrounds
- **Run BCH** — node implementations, mining, infrastructure, network health
- **Grow BCH** — Flipstarter, bounties, translations, contribution, events

---

## Editorial principles (locked in day one)

1. **Proof before promotion.** Every claim links to a spec, source, or working demo.
2. **Visible freshness.** Every project card and guide shows when it was last verified.
3. **No paid rankings.** Sponsorships never affect placement.
4. **Explain tradeoffs.** BCH isn't risk-free; neither is any software. Say so.
5. **Minimal tribal warfare.** Explain BCH's choices without turning every page into a BTC argument.
6. **International by design.** Translation is part of the content system, not an afterthought.
7. **Open contribution.** Content and registry live in a public repo; PRs are the primary contribution path.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro** | Content-heavy with interactive islands is Astro's sweet spot. Next.js if we later need heavier SPA behavior. |
| Content | **MDX + YAML** in the repo | Version-controlled, PR-based contributions, no CMS lock-in |
| Network data | **Chaingraph GraphQL** (Phase 1) → self-hosted BCHN + Chaingraph (Phase 2+) | Start on public infra, own the pipeline before the Transaction Lab ships |
| Styling | **Tailwind** + design tokens | Restrained BCH green accents, warm neutrals |
| i18n | Astro i18n routing, JSON translation files in repo | Contributors translate via PR |
| Hosting | **Cloudflare Pages** + Workers for API needs | Free-tier friendly, scales, edge-close |
| Repo | GitHub, MIT license | Standard open-source contribution flow |
| Analytics | **Plausible** or self-hosted Umami | Privacy-respecting (matches editorial ethos) |

---

## Phase 1 — The Map (Weeks 1-10)

**Goal:** Ship the "best maintained BCH directory + starter learning paths." Enough substance to be cited. Nothing flashy yet.

### Pages
- **Homepage** — hero, live technical strip (block/fee/tx count), four pathways, "This Week in BCH" (manual), 3 featured projects
- **Use BCH** — wallet chooser flow, first-transaction walkthrough, merchant list, privacy 101 (CashFusion explainer)
- **Build on BCH** — dev quickstart, CashScript primer, CashTokens primer, SDK comparison table
- **Run BCH** — node implementation comparison (BCHN, Bitcoin Verde, Knuth), install recipes for Linux/Docker
- **Grow BCH** — Flipstarter overview, contribution paths, translation asks
- **About / Editorial principles / Contribute**

### Data-driven features
- **Project registry v1** — ~50 hand-curated entries in YAML with freshness state (Active / Maintained / Experimental / Seeking maintainers / Archived / Unverified). Filterable by category, license, custody, CashTokens support, platform.
- **Wallet compatibility matrix** — subset of the registry rendered as a table (mobile/desktop/hardware, CashTokens, NFTs, CashFusion, RPA, multisig, merchant mode, WalletConnect, testnet, open-source, etc.)
- **Network dashboard v1** — latest block height, mempool size, median fee, tx/block over 24h, next CHIP activation countdown
- **CHIP tracker v1** — static per-CHIP pages (problem, proposal, status, discussion links, plain-English summary). Layla marked activated; upcoming CHIPs listed.
- **Weekly Digest** — manually edited MDX, published every Sunday

### Not in Phase 1
- No Transaction Lab yet
- No automated GitHub scraping
- No merchant map integration
- No aggregated community feed

### Phase 1 deliverables
- Live site at chosen domain
- Public GitHub repo with contribution guide + code of conduct
- Privacy-respecting analytics live
- At least English + one other language complete (Spanish or Japanese suggested)

---

## Phase 2 — The Living Site (Months 3-6)

**Goal:** Automate what was manual, expand coverage, introduce real interactivity. Site starts to breathe.

### Automation
- GitHub API pulls commit activity, latest release, open issues into every registry card
- Automated freshness flags — red if repo untouched 12+ months, yellow at 6+ months
- CHIP tracker fed by Bitcoin Cash Research (scrape or API)

### New features
- **Technology Atlas** — interactive stack diagram:
  ```
  Applications
      ↓
  Wallets · Payments · DeFi · Games · Marketplaces
      ↓
  CashTokens · BCMR · CashScript · CashFusion · RPA
      ↓
  Libraries · Indexers · APIs · Explorers
      ↓
  Transaction and scripting model
      ↓
  Nodes · Mining · Propagation · Consensus
  ```
  Every node clickable → panel with: what problem, how it works, who uses it, how to try it, how to build with it, specs/discussions.
- **CashScript playground** — Monaco editor + WASM compiler, basic contract templates
- **Transaction Lab — Mode 1 (Simulated)** — client-side, no network dependency. Libauth-powered VM so the tx itself is genuine, only the network around it is faked. Scenario library, speed slider (1x/10x/instant), pause/step/rewind. Plants the flag while Modes 2 and 3 infra is built.
- **Merchant map** — BCH Map data integration
- **Community feed** — aggregated from read.cash RSS, notable YouTube channels, podcast feeds
- **CashTokens explorer** (basic — recent issuances, notable tokens)
- **Flipstarter dashboard** — active campaigns, historical outcomes

### CashTokens visual system (built in Phase 2, used site-wide)

The visual language for CashTokens is designed and shipped in Phase 2 as a **shared component library**, then reused across the Transaction Lab in Phase 3. This ensures every surface that touches tokens speaks the same visual language from day one.

Phase 2 surfaces that must use the shared system:
- **Mode 1 (Simulated Transaction Lab)** — genesis mint, NFT with commitment, multi-token payment, mutable commitment update, CashToken-secured covenant, burn, and minting-NFT scenarios
- **CashTokens explorer** — recent issuances, notable tokens, category detail pages
- **Technology Atlas** — CashTokens node uses the same UTXO-container illustration
- **Project registry cards** — projects that support CashTokens show a stable badge derived from the shared system
- **Wallet compatibility matrix** — CashToken / NFT / capability support columns use the same iconography

Shared primitives (spec):
- **UTXO as container** — layered shape: BCH sats base + fungible token band (colored per category) + NFT badge + capability pip
- **Category = stable color + BCMR identity** — BCMR name + icon when available; truncated hash + "unverified metadata" pill otherwise. Trust status never hidden.
- **Capability pips** — Minting (⚡), Mutable (~), None (🔒)
- **Parallel flow lanes** — BCH in one stream, each category in its own colored stream
- **NFTs as unique unsplittable objects** — click to inspect commitment bytes

Implementation note: build these as framework-agnostic components (SVG + a thin JS layer) so they drop into Astro islands, the Explorer, the Atlas, and the Transaction Lab without duplication. One source of truth for token visuals.

### Infrastructure
- Self-hosted BCHN + Chaingraph instance provisioned (prep for Transaction Lab)
- Chipnet endpoint provisioned
- Public API endpoint for the project registry (JSON feed)
- **Live network dashboard fully wired to Chaingraph** — replaces Phase 1's Blockchair polling (which hits shared per-IP rate limits) and enables the median fee stat to move from static ("≈ min relay") to real-time

### Translations
- Spanish, Japanese, Portuguese complete (biggest active BCH communities)

---

## Phase 3 — The Showpiece (Months 6-12)

**Goal:** The Transaction Lab ships. BCH gets its most memorable tech demo. verifier.cash and BCMR verification arrive.

### Transaction Laboratory — three modes

The user journey: **Learn → Try → Watch your own.**

**Mode 1 — Simulated (ships Phase 2, expanded here)**
- Already live from Phase 2. Phase 3 expands the scenario library and adds cross-mode continuity ("Try this on chipnet →" button pre-populates Mode 2).

**Mode 2 — Chipnet real-time (Try)**
1. Built-in chipnet wallet + integrated faucet (no external setup required)
2. User builds a tx — form-based (send BCH / send CashToken / mint NFT / covenant example) or raw JSON
3. Broadcast → the movie begins:
   - Tx arrives at our BCHN mempool (real, observed)
   - Peer propagation animation — our node's peers announce, we fan-out the visualization (labeled as "our view")
   - Mempool position — ranked by fee, ETA estimate
   - Block arrives → the tx animates into the block
   - Confirmation counter increments live

**Mode 3 — Mainnet real-time (Watch your own)**

Two entry points:
- **Paste a txid** — replay whatever's available. If recent (still in mempool retention), replay from mempool entry; if older, skip to block inclusion.
- **Broadcast via us** — wallet integration (WalletConnect first, CashConnect second — see wallet connection notes below). User sends through the Lab UI and we catch the tx from the instant it hits our mempool. This gives the full journey for the user's *real* transaction — the payoff no other visualizer offers.

**Wallet connection strategy for Mode 3:**
- **Phase 3a: WalletConnect** — BCH-flavored WalletConnect (generic transport, BCH-specific API). Widest wallet support, meets users where they already are, mature. Low-friction Mode 3 launch.
- **Phase 3b: CashConnect** — BCH-native protocol, richer UX for CashToken and covenant scenarios. Ships as the second connector.
- **Not yet: WizardConnect** — earlier-stage, tied to CashID and RPA workflows. Solves identity/addressing, not general tx signing. Add only if we later ship CashID-based identity features (e.g., project-owner verification for BCMR entries).

**Shared across all three modes:**
- Layered lens toggle with morph transitions:
  - **Beginner:** "Alice paid a merchant."
  - **Technical:** UTXOs, scripts, token operations, fee, change
  - **Raw:** serialized bytes and bytecode
- Opcode step-through of locking/unlocking scripts with live stack visualization
- Forward-tracing: click any output UTXO → animate follow-up txs
- Cross-mode carry: "Try this on chipnet" / "Try this on mainnet" buttons transfer tx structure between modes

**CashTokens visual language:** uses the shared Phase 2 CashTokens visual system (see Phase 2 section) — same UTXO-container primitives, category colors, capability pips, and parallel flow lanes. Phase 3 adds the *motion* layer on top:
- Genesis / mint animation on category creation — birth effect makes new supply visually explicit
- Minting-NFT branching animation when it spawns children
- Mutable-NFT state-change animation on commitment update
- Burn fade-out when outputs of a category < inputs

**Honest UX rules:**
- Observed data (mempool entry, block inclusion, confirmations) rendered solid
- Inferred data (global propagation, miner selection pre-block) rendered distinctly (dashed, "estimated" label)
- Clear "our view" vs "consensus" indication throughout
- Mode 1 always clearly labeled "Simulation" — pedagogical, not a real network view

### Other Phase 3 features
- **ZK-verifier tracker** — verifier.cash leaderboard mirror + explainer, positioned as "the primitive being built" (see notes on honest framing)
- **BCMR-verified registry entries** — project owners sign metadata to claim their entry
- **Public API v2** — CORS-friendly JSON for the registry, weekly digest, CHIP status
- **Structured submission workflow** — form-based submissions in addition to PRs, still reviewed
- **CashScript playground v2** — templates for Layla opcodes (bounded loops, OP_DEFINE, bitwise)
- **Podcast/video native embeds** in weekly digest

---

## Ongoing (every phase)

- Weekly digest — never skips
- Registry freshness sweeps monthly
- Translation coverage expands
- Editorial policy enforced in every PR review
- Correction log for public accountability

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| Curation burden — registry rots without maintainers | Automated freshness (Phase 2) + BCMR self-verification (Phase 3) |
| Chaingraph dependency in Phase 1 | Run our own BCHN + Chaingraph starting Phase 2 |
| Transaction Lab scope creep | Chipnet-first in Phase 3; mainnet-replay comes second |
| Tone drift toward crypto-hype/tribalism | Editorial principles page enforced at PR review |
| Solo-maintainer failure mode | Recruit 1-2 committed contributors before Phase 2; consider Flipstarter to fund ongoing work |
| ZK-verifier framing overhype | Position honestly: "primitive being built," not "BCH now has private tx" |

---

## Year-one success metrics

- Project registry: 200+ entries, 80%+ verified fresh
- Weekly digest: 52 issues, no gaps
- Wallet matrix: comprehensive for actively maintained wallets
- Translations: 3+ languages complete
- Transaction Lab shipped on chipnet
- External citations: referenced by BCH developers, wallets, or media as the go-to hub

---

## Open questions to resolve before Phase 1

- ~~Domain name~~ — **decided: `txlab.cash`**
- Solo build or recruit co-maintainer(s) upfront?
- Funding: self-funded, Flipstarter, or hybrid?
- Governance: single BDFL, small maintainer team, or looser contributor model?
- Which language ships first alongside English?
- ~~Mode 3 wallet integration~~ — **decided: WalletConnect first (Phase 3a), CashConnect second (Phase 3b), WizardConnect deferred until we ship CashID-based features**
