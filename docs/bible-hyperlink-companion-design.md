# Bible Hyperlink Companion Design

## Product direction
This product is not a verse-of-the-day chatbot. It is a guided Bible study companion that starts from a user's concern and teaches through:

1. the primary passage,
2. the surrounding story or poetic unit,
3. date / place / audience / authorship notes,
4. linked scriptures and canonical echoes,
5. Jewish reception and New Testament reuse where available,
6. a careful explanation of why the text may connect to the user.

The system must prefer grounded retrieval over improvisation. Prose comes last.

## Design objectives
- Keep the emotional ease of a modern chat UI.
- Make the Bible's hyperlink nature visible.
- Teach context without burying the user in academic clutter.
- Separate original-context notes from later interpretation.
- Show confidence levels instead of pretending every historical detail is certain.

## Concept UI assets
Saved mockups:
- `design/concepts/home-concept.png`
- `design/concepts/companion-concept.png`
- `design/concepts/study-concept.png`
- `design/concepts/graph-concept.png`

### Page 1 — Home (`home-concept.png`)
Purpose:
- explain the product in one screen,
- show the first prompt box,
- position the product as a study-first companion.

Key choices:
- dark, contemplative palette instead of a plain productivity UI,
- large hero statement to clarify that the product follows scripture's own links,
- first prompt box on the landing screen,
- feature cards limited to cross-reference graph, context labels, and personal connection.

### Page 2 — Companion (`companion-concept.png`)
Purpose:
- preserve familiar chat behavior,
- answer with passage cards instead of free-form advice first,
- keep a permanent right rail explaining the study pipeline.

Key choices:
- left sidebar for conversation starts and thematic entry points,
- center lane for user reflection and grounded answer shell,
- right rail for themes, study flow, and deep-dive links,
- primary + linked passage cards visible before interpretation expands.

### Page 3 — Study Desk (`study-concept.png`)
Purpose:
- turn one answer into a small Bible lesson,
- show date / place / audience / author notes next to the actual passage,
- separate teaching notes from the passage text itself.

Key choices:
- contextual metadata shown above the passage,
- the passage displayed with verse numbers and nearby context,
- linked scripture network shown as a second step,
- side column reserved for authorship, meaning, Jesus layer, Paul layer, and Jewish reception.

### Page 4 — Hyperlink Graph (`graph-concept.png`)
Purpose:
- visualize that scripture is a connected graph,
- show how one concern travels through the canon,
- communicate interpretation boundaries.

Key choices:
- a primary node for the story cluster,
- linked nodes grouped by relation type: parallel, echo, theme, fulfillment,
- a canonical travel path checklist,
- related study lanes for concern-adjacent pivots,
- explicit warnings that personal application is downstream from textual study.

## Interaction model
### Home to companion
User enters a reflection on the home page.
The app routes into the companion page with a prompt parameter or future API call.
Lane cards and sidebar suggested starts can also route directly into the companion with prefilled starter prompts tied to each study cluster.
The main prompt form now exposes guided-start chips sourced from the live study clusters, so users can jump into a representative concern without hunting through the UI.
A dedicated `/lanes` catalog page now lists every live study lane with direct actions into reflection, study, and graph views.
The lanes catalog supports topic filtering so people can browse only guidance, grief, forgiveness, and similar concerns without leaving the catalog view.
The lanes catalog also supports free-text filtering across title, pastoral prompt, themes, and emotions so users can narrow the catalog before opening a lane.
When filters eliminate every lane, the catalog now shows an explicit no-results state with a clear-filters action instead of leaving the user in a blank catalog.

### Companion to study desk
The companion page chooses a story cluster and shows:
- why that cluster was chosen,
- the primary passage,
- linked passages,
- a path into the deeper study desk.

The study desk and companion now surface related study lanes, allowing users to pivot into neighboring biblical patterns when one cluster is close but not exact.
### Study desk to graph
The study desk lets the user inspect context and then jump into a graph view that explains how linked texts relate.

## Visual system
- Palette: midnight blue, slate glass panels, gold accents for scriptural focus.
- Density: premium, not minimal; enough structure to teach.
- Motif: illuminated-study aesthetic rather than generic AI dashboard.
- Contrast rule: all instructional metadata is secondary; the passage text remains primary.

## Content architecture
Each final answer should eventually ship in this order:
1. concern summary,
2. similar story or primary passage,
3. date / place / audience / author notes,
4. connected scriptures,
5. Jesus / New Testament reuse,
6. personal connection,
7. reflection questions,
8. citations and confidence labels.


## Retrieval and knowledge layers
### Layer 1 — Canon text
Local WEB corpus already ingested under `world_english_bible/`.

### Layer 2 — Story clusters
Current implementation includes initial clusters for:
- waiting in the silence,
- restoration after failure,
- fear and calling,
- grief and loss,
- wisdom in confusion,
- forgiveness after betrayal.

### Layer 3 — Hyperlink graph
Implemented sources now:
- OpenBible cross references, ingested into `data/knowledge/openbible-crossrefs.json`
- Bible Cross References KJV phrase-anchor dataset, ingested into `data/knowledge/crossreferences-kjv.json`
- Build scripts:
  - `npm run ingest:crossrefs`
  - `npm run ingest:phrases`

Runtime behavior:
- passage-level graph suggestions merge OpenBible vote strength with KJV phrase anchors
- results are ranked and exposed in UI and APIs with source provenance



### Layer 4 — Context metadata
Target sources:
- STEPBible data,
- OpenBible geocoding,
- curated book metadata for author/date/place/audience with confidence.
### Topic starts
The app now derives reusable topic starts from the live study clusters and exposes them in both the UI and `GET /api/topics`. A cluster catalog is also exposed through `GET /api/clusters` for clients that need titles, starter prompts, themes, and related-lane slugs. The cluster catalog API now accepts `topic` and `q` filters and returns counts alongside the filtered results.

### Layer 5 — Reception and interpretation
Target sources:
- Sefaria links for Jewish textual linkage,
- curated NT use-of-OT notes,
- Jesus / Paul / apostolic interpretation notes.

## Source policy
Historical and interpretive notes must be labeled by confidence:
- `high`
- `medium`
- `disputed`

The UI must never collapse these into fake certainty.

## Current implementation status
Implemented now:
- Next.js application scaffold,
- landing page,
- companion page,
- study desk page,
- hyperlink graph page,
- initial story-cluster data layer,
- local WEB passage loading from `canon_66_vpl.txt`,
- sourced note cards with confidence badges,
- structured reflection builder used by both UI and APIs,
- ingested OpenBible cross-reference graph stored at `data/knowledge/openbible-crossrefs.json`,
- ingested Bible Cross References KJV phrase graph stored at `data/knowledge/crossreferences-kjv.json`,
- runtime graph suggestions aggregated from passage-level anchors across both datasets, with reconciled provenance labels (`consensus link`, `vote-supported link`, `phrase-anchor link`),
- hybrid prompt-to-cluster retrieval using hints, themes, emotions, passage-keyword overlap, and TF-IDF-style semantic scoring,
- optional OpenAI-compatible embeddings retrieval wired through `lib/embeddings.ts`, with Hermes-agent credential reuse and provider-catalog model discovery when no explicit embeddings env is set, and exposed in retrieval metadata when configured,
- retrieval rationale and retrieval mode exposed in the companion UI and `POST /api/reflect`,
- book metadata now combines curated profiles for high-traffic books with full-canon fallback profiles grouped by literary category,
- book profile cards shown in companion and study pages with confidence badges on each note,
- note and book metadata sources now render as richer source cards with source type and host context, while page-level source inventory stays compact,
- Hermes evidence-locked contract implemented in `lib/hermes-contract.ts`,
- Hermes generation service implemented with deterministic fallback in `lib/hermes.ts`,
- localized English/Korean/Spanish safety copy with region-aware crisis-resource routing driven by locale, deployment configuration, and country headers.
- starter APIs:
  - `POST /api/reflect`
  - `GET /api/study/[slug]`
  - `GET /api/topics`
  - `GET /api/clusters`
  - study and reflect payloads now also expose related study lanes so clients can pivot into adjacent biblical patterns without recomputing similarity locally.
- saved concept screenshots in `design/concepts/`.

## Immediate next implementation steps
1. tune and validate live embeddings reranking against a fuller cluster set,
2. keep reconciling relation signals across both cross-reference datasets and future TSK ingest,
3. deepen and refine the fallback metadata into more book-specific profiles across the wider canon,
4. continue refining source provenance and note-level evidence detail where higher-resolution citations become available,
5. configure Hermes runtime credentials/base URL and validate live model responses against the evidence-locked schema,
6. expand safety coverage beyond the current English/Korean/Spanish routing and deepen region-specific escalation options.

## Source inventory for this design
- WEB local corpus: `world_english_bible/metadata.json`
- Bible Cross References project: https://crossreferences.org/project/
- Bible Cross References developers: https://crossreferences.org/project/developers/
- Bible Cross References licensing: https://crossreferences.org/project/licensing/
- CrossWire TSK: https://www2.crosswire.org/sword/modules/ModInfo.jsp?beta=true&modName=TSK
- STEPBible data: https://github.com/STEPBible/STEPBible-Data
- OpenBible geocoding: https://www.openbible.info/geo/
- OpenBible cross references: https://www.openbible.info/labs/cross-references/
- Sefaria links API: https://developers.sefaria.org/reference/get-links
