# txlab.cash

> A lab for exploring the Bitcoin Cash network — plus the best maintained map of the BCH world.

Peer-to-peer cash is programmable. This site helps you explore, use, build, and run Bitcoin Cash.

## Status

Phase 1 in progress. Full three-phase roadmap: [`build-plan.md`](./build-plan.md).

**The Transaction Lab** lives at `/lab`: one real Bitcoin Cash transaction tells the story of its own life in first person as you scroll, across six stages (wallet, network, validation, mempool, block, archive), with Story / Technical / Raw lenses. The demo transaction is built and traced with Libauth at build time; paste any mainnet txid to ride your own (fetched from public Electrum servers, evaluated in the browser). Code: `src/pages/lab.astro`, `src/components/Stage.astro`, `src/lib/`. Debug URLs: `/lab?step=<id>&solo=1` pins the stage; `/lab?lens=raw`; `/lab?tx=<txid>`. Screenshots that need real time (WebSockets): `node tools/cdp-shot.mjs <url> out.png [waitMs]`.

## Local development

```
npm install
npm run dev
```

Runs on http://localhost:4321.

## Contribution

Content lives in `src/content/`. Projects are YAML entries validated against a Zod schema (`src/content/config.ts`). PRs welcome.

## License

MIT.
