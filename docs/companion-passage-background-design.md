# Companion Passage Background Design

## Objective

Make Companion results explain not only which Scripture fits a user concern, but why the passage matters in its own context: background, people, setting, message, cautions, and a one-sentence takeaway.

## Product principles

- Keep the primary answer pastoral and readable; deeper material is visible as compact cards.
- Do not turn Companion into a raw commentary dump.
- Preserve original-context first: original audience and passage flow before personal application.
- Avoid unsupported historical claims. Use local Bible text, book metadata, passage index, and curated source metadata.
- Show limits/cautions where a passage is commonly over-applied.
- Ground every added field in an allowed local source: Bible text/reference, `book-metadata`, `passage-index`, or a deterministic template whose wording names uncertainty when needed.

## Response shape

Extend `PassageBackgroundSummary` into a richer local background summary:

```ts
type PassageBackgroundSummary = {
  bookName: string;
  author?: string;
  date?: string;
  place?: string;
  audience?: string;
  storyContext: string;
  canonicalContext?: string;
  people?: PassageBackgroundPerson[];
  setting?: PassageBackgroundSetting;
  message?: PassageBackgroundMessage;
  application?: PassageBackgroundApplication;
  sources: BackgroundSource[];
  youtubeResources?: PassageYoutubeResource[];
};
```

### People

Role-based, not name-list-only:

- `name`: user-facing label.
- `role`: what this person/group does in the passage.
- `relevance`: why it matters for interpreting the passage.
- Grounding rule: do not invent named characters. Phase 1 may use generic labels such as “원래 청중”, “본문 속 말하는 이/듣는 이”, “신앙 공동체”, or “시편의 기도자” only when the label follows from book genre, metadata, or the selected passage family.

### Setting

- `historical`: time/pressure/situation.
- `literary`: surrounding passage flow.
- `cultural`: cultural or genre caution.

### Message

- `original`: what the passage said first to its original audience/context.
- `theological`: how the passage contributes to the larger biblical theme.
- `pastoral`: how to speak it to the user's concern without flattening the text.
- `cautions`: common misreadings or boundary notes.

### Application

- `comfort`: direct comfort.
- `challenge`: gentle response or practice.
- `prayerPrompt`: prayer starter.
- `takeaway`: one sentence the user can hold.

## Data strategy

Phase 1 uses deterministic local enrichment rather than broad live web search:

1. Book metadata supplies author/date/place/audience/genre.
2. Passage index supplies literary unit or immediate passage summary.
3. Curated templates by genre/theme supply people, setting, message, and application.
4. Exact well-known passages can receive explicit overrides later.

Live web crawling is deferred. Curated external sources should be ingested only when license and source quality are known.

## Compatibility boundaries

The enriched summary must preserve the old shape for every existing consumer:

- `summarizeBackgroundPack` still returns valid old fields and may leave the new optional fields empty unless the pack already has grounded data.
- `buildLocalPassageBackground` is the Phase 1 enrichment source.
- `buildPassageRecommendation` and passage selection/ranking must not change semantics; only the returned background object becomes richer.
- `app/[locale]/companion/page.tsx` may render optional new fields, but existing background/sidebar sections must continue to work when fields are missing.
- Any other consumer of `PassageBackgroundSummary` must treat new fields as optional.

## UI detail

Concrete Korean labels and order for the Companion page:

1. `본문이 놓인 자리` — story/literary context, max two short paragraphs.
2. `등장 인물과 상황` — 1–3 compact role cards. Use generic groups when exact names are not grounded.
3. `이 말씀이 전하는 메시지` — original message, biblical-theological message, pastoral message.
4. `오늘 붙들 문장` — one sentence takeaway, followed by optional prayer prompt.
5. `조심해서 읽을 점` — caution chips/list when present.

English labels: `Where this passage sits`, `People and situation`, `What this passage says`, `A sentence to hold today`, `Reading cautions`.

Empty-state rule: hide a subsection when its optional data is absent; never render placeholder or speculative content.


## UI strategy

In Companion:

1. Keep `메인 성구` and `왜 이 성구인가` as the main flow.
2. Replace the sidebar-only “배경과 역사” with a richer compact area:
   - 본문이 놓인 자리
   - 등장 인물과 상황
   - 이 말씀이 전하는 메시지
   - 오늘 붙들 문장
3. Keep source/video links in the sidebar as deeper evidence.

## Acceptance criteria

- A normal Companion result with a primary passage renders background, people, message, cautions, and takeaway.
- Fallback data never fabricates named people; generic groups are allowed only when grounded by genre/book context.
- Existing recommendation behavior remains unchanged.
- `npm run lint`, `npm run qa:companion-probes`, and `npm run build` pass.
- QA includes a recommendation-stability check: existing selected primary references for current companion probes do not change.
