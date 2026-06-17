# Bible Hyperlink Companion

[![GitHub](https://img.shields.io/badge/GitHub-DeclanJeon%2Fbible-181717?logo=github&logoColor=white)](https://github.com/DeclanJeon/bible)
[![Live](https://img.shields.io/badge/Live-bible.ponslink.com-f59e0b?logo=vercel&logoColor=white)](https://bible.ponslink.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org)

A grounded Bible study companion that connects a lived concern to scripture, chapter context, cross references, and related study lanes without reducing the Bible to isolated proof-texts.

## Live app

- Korean: https://bible.ponslink.com/ko
- English: https://bible.ponslink.com/en
- Full Bible reader: https://bible.ponslink.com/ko/bible

## What it does

- Guides users from one prompt into a study desk with primary passage, linked passages, context notes, and source inventory.
- Exposes the full Bible by book and chapter for both Korean and English readers.
- Uses canonical locale paths: `/ko/...` and `/en/...`.
- Keeps public runtime diagnostics coarse: readiness only, no provider topology or secret previews.
- Keeps page GET rendering deterministic; generated reflection lives behind POST API flow.

## Tech stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- PM2 + nginx deployment on `bible.ponslink.com`

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/ko` or `http://localhost:3000/en`.

## Verification

```bash
npm audit --audit-level=moderate
npm run lint
npx tsc --noEmit
npm run build
```

## Deployment notes

Current production target:

- Host: `ponslink`
- Directory: `/home/declan/bible`
- Process: `pm2` app named `bible`
- Port: `127.0.0.1:3100`
- nginx site: `/etc/nginx/sites-enabled/bible.ponslink.com`

## Data sources

- World English Bible public-domain corpus
- Korean Bible corpus stored locally in `korean_bible/`
- OpenBible / cross-reference derived knowledge data under `data/knowledge/`

## License

Private project unless a license is added.
