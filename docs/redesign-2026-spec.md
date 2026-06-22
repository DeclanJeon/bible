# UI Redesign 2026 — Design Specification

## 1. Current State Summary

### Pages
| Route | Purpose |
|---|---|
| `/[locale]` | Home: hero title + input + 2-card grid + footer |
| `/[locale]/companion` | Reflection: passage recommendation, teaching, linked texts, YouTube |
| `/[locale]/study/[slug]` | Deep study desk: passage in context, cross-refs, notes |
| `/[locale]/graph/[slug]` | Hyperlink graph visualization |
| `/[locale]/bible` | Full Bible reader by book/chapter |
| `/[locale]/hanja` | Hanja catalog list (1073 entries) |
| `/[locale]/hanja/[slug]` | Hanja detail: meaning, sources, passages |
| `/[locale]/crossrefs/[ref]` | Full cross-reference network |
| `/[locale]/lanes` | Study lanes browse with topic filter |
| `/[locale]/reviews` | Community reviews |
| `/[locale]/admin/retrieval-debug` | Debug panel |

### Current Navigation
- **Home page**: no nav bar — only footer links and card grid
- **Interior pages**: `SecondaryNav` — sticky glass header with horizontal scrolling icon+text links
- **Language toggle**: fixed top-right KO/EN buttons (only on home page)

### Current Problems
1. **Home page is cluttered**: hero text + input + 2 cards + footer = too much for a "just type" entry point
2. **Navigation inconsistency**: home has no nav, interior pages have SecondaryNav with 8+ items
3. **No command palette / quick access**: users must navigate through multiple pages to reach Bible reader, Hanja, or crossrefs
4. **Mobile nav overflow**: SecondaryNav scrolls horizontally on mobile, hiding items
5. **No breadcrumbs or back-to-home**: hard to orient after several navigations
6. **Language toggle only on home**: switching locale from interior pages requires going back

---

## 2. Design Philosophy

### Core Principle: One Input, Infinite Depth

The home page should feel like a search-first interface. One text field. Type a question, a book name, a reference, a character — and the system routes you to the right surface.

### Design Language (Updated)
- Keep the dark canvas + gold accent system (it's strong)
- Upgrade glass surfaces: more subtle, more depth, less border noise
- Add micro-animations for state transitions (input → result, page → panel)
- Introduce a unified command surface that works on every page

---

## 3. Redesigned Information Architecture

### 3.1. Global Shell

```
┌─────────────────────────────────────────────┐
│ [Logo/Title]              [KO/EN] [≡ Menu] │ ← Global top bar (all pages)
├─────────────────────────────────────────────┤
│                                             │
│              Main Content Area              │
│                                             │
└─────────────────────────────────────────────┘
```

**Global Top Bar** (appears on EVERY page including home):
- Left: site title "성경 하이퍼링크 컴패니언" (clickable → home)
- Right: locale toggle + hamburger menu (mobile) or inline nav (desktop)

**Desktop Inline Nav** (replaces SecondaryNav):
- Minimal: `성경 읽기` · `한자` · `공부 레인` · `리뷰`
- Active page highlighted with gold underline
- No icon clutter — text only, clean typography

**Mobile Menu** (slide-in drawer):
- Full nav list with sections
- Current page indicator
- Quick links to companion, bible, hanja

### 3.2. Home Page Redesign

**Before**: Hero title + subtitle + input + 2 cards + footer links
**After**: Single centered input with minimal branding

```
┌─────────────────────────────────────────────┐
│ 성경 하이퍼링크 컴패니언           KO/EN  ≡ │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│        성경 하이퍼링크 컴패니언              │ ← gradient title, smaller
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │ 🔍 궁금한 것을 적어보세요...    →  │   │ ← single large input
│   └─────────────────────────────────────┘   │
│                                             │
│   요즘 일이 너무 힘들고 지쳐요              │ ← subtle suggestion chips
│   로마서 8장 전체 읽기                      │    (3-4 items, rotated)
│   神 자의 의미가 궁금해                     │
│   히브리서와 레위기 연결 찾기                │
│                                             │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                             │
│   성경 읽기 · 한자 · 공부 레인 · 리뷰       │ ← subtle text nav
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes**:
- **No card grid**: remove Bible reader card + Hanja card from home
- **No footer links section**: replaced by subtle text nav below the input
- **Smaller hero title**: reduced from 5xl to 3xl
- **Larger input**: full-width, more prominent, centered
- **Suggestion chips**: 3-4 rotating prompts that change on each visit
- **Single page feel**: the entire viewport is the input

**Input Routing Logic**:
- Starts with a book code pattern (e.g., "MAT 11:28-30", "로마서 8장") → `/bible?book=...`
- Starts with a character (e.g., "神", "義") → `/hanja/[slug]`
- Looks like a reference (e.g., "ISA-40-29-31") → `/crossrefs/...`
- Otherwise → `/companion?prompt=...`

### 3.3. Companion Page Redesign

**Current**: Long scroll with many sections
**Redesigned**: Two-column layout with progressive disclosure

```
┌─────────────────────────────────────────────┐
│ 성경 하이퍼링크 컴패니언     성경 읽기 한자 ≡│
├─────────────────────────────────────────────┤
│ ← 돌아가기    "요즘 일이 너무 힘들고 지쳐요"│ ← prompt echo + back
├────────────────────┬────────────────────────┤
│                    │                        │
│  주요 본문         │  배경과 역사            │ ← sticky right sidebar
│  이사야 40:29-31   │  저자: ...             │    on desktop
│                    │  시기: ...             │
│  [본문 텍스트]     │  청중: ...             │
│                    │  문맥: ...             │
│  ─ ─ ─ ─ ─ ─ ─   │                        │
│                    │  ─ ─ ─ ─ ─ ─ ─        │
│  연결 본문         │                        │
│  로마서 8:28-30    │  연관 성구 네트워크     │
│  빌립보서 4:13     │  → 전체 네트워크 보기   │
│                    │                        │
│  ─ ─ ─ ─ ─ ─ ─   │  ─ ─ ─ ─ ─ ─ ─        │
│                    │                        │
│  AI 해석           │  관련 YouTube           │
│  [teaching prose]  │  영상 3개               │
│                    │                        │
│  묵상 질문         │  관련 공부 레인         │
│  1. ...            │  위로, 인내, 소망       │
│  2. ...            │                        │
│                    │                        │
└────────────────────┴────────────────────────┘
```

**Key Changes**:
- **Two-column on desktop**: main content left, context/resources sidebar right
- **Single column on mobile**: sidebar sections collapse below main content
- **Back button**: returns to home with the input preserved
- **Progressive disclosure**: AI teaching is initially collapsed, expandable
- **Sidebar is sticky**: background/history stays visible while scrolling passages

### 3.4. Bible Reader Redesign

**Current**: Book selector grid + chapter view
**Redesigned**: Cleaner book selector, improved verse interaction

```
┌─────────────────────────────────────────────┐
│ 성경 하이퍼링크 컴패니언     성경 읽기 한자 ≡│
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🔍 책 이름이나 장을 검색...         │   │ ← inline search
│  └─────────────────────────────────────┘   │
│                                             │
│  구약                                      │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐           │
│  │창세││출애││레위││민수││신명│ ...        │ ← compact book grid
│  └────┘└────┘└────┘└────┘└────┘           │
│  신약                                      │
│  ┌────┐┌────┐┌────┐┌────┐                 │
│  │마태││마가││누가││요한│ ...              │
│  └────┘└────┘└────┘└────┘                 │
│                                             │
│  ── 이사야 40장 ──────────────────────      │
│                                             │
│  29  피곤한 자에게는 능력을 주시며...        │ ← verse with highlight
│  30  소년이라도 피곤하며...                  │
│  31  오직 여호와를 앙망하는 자는...          │
│                                             │
│  [← 39장]  [41장 →]                         │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes**:
- **Inline search**: type book name to filter instead of scrolling 66 books
- **Compact book grid**: smaller chips instead of large cards
- **Verse hover/click**: click a verse to see cross-ref summary inline (expandable)
- **Passage panel integration**: clicking linked references opens the side panel

### 3.5. Hanja Catalog Redesign

**Current**: Large hero section + stats + full card grid
**Redesigned**: Search-first catalog with compact cards

```
┌─────────────────────────────────────────────┐
│ 성경 하이퍼링크 컴패니언     성경 읽기 한자 ≡│
├─────────────────────────────────────────────┤
│                                             │
│  한자 (1073)                                │ ← title + count
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🔍 한자, 음독, 뜻으로 검색...       │   │ ← search/filter
│  └─────────────────────────────────────┘   │
│                                             │
│  [전체] [지지↑] [비판↑] [본문多]           │ ← sort/filter chips
│                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │義 義 │ │神 神 │ │福 福 │ │字 字 │ ...  │ ← compact cards
│  │의    │ │신    │ │복    │ │자    │      │    (character + reading
│  │20 src│ │15 src│ │18 src│ │12 src│      │     + source count)
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
│  [더 보기]                                   │ ← load more (initial: 48)
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes**:
- **Remove hero section**: the stats/info box is too large
- **Add search**: filter by character, reading, or keyword
- **Sort/filter chips**: quick access to different orderings
- **Compact cards**: character + reading + source count only
- **Pagination**: show 48 initially, "더 보기" to load more
- **Remove full SSR of 1073 cards**: only render initial slice server-side

### 3.6. Hanja Detail Page Redesign

**Current**: Long single-column scroll
**Redesigned**: Tab-based progressive disclosure

```
┌─────────────────────────────────────────────┐
│ ← 카탈로그      福 · 복(福)                 │
├─────────────────────────────────────────────┤
│                                             │
│  福                                        │ ← large character
│  복(福)                                     │
│  "복은 비야(備也)라고 했습니다"              │ ← thesis
│                                             │
│  [의미] [본문] [출처] [관련]                │ ← tabs
│  ─────────────                              │
│                                             │
│  의미 탭:                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 링크 본문에서 정리한 뜻               │   │
│  │ 후한 100년 설문해자...               │   │
│  │ [DSTV 원문 열기 →]                   │   │
│  │                                     │   │
│  │ 복(福)은 비야(備也)...               │   │
│  │ [킵바이블 원문 열기 →]               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  키워드: 복 福 righteousness ...            │
│  출처: 20 · 지지 18 · 비판 1               │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes**:
- **Tab navigation**: 의미 / 본문 / 출처 / 관련 (Meaning / Passages / Sources / Related)
- **Reduced initial load**: only meaning tab rendered server-side
- **Compact source cards**: title + stance badge + "원문 열기" link
- **Passage tab**: main + related passages with side-panel links
- **Source tab**: full supportive/critical source lists

### 3.7. Crossrefs Page Redesign

**Current**: Summary-first with opt-in full network
**Keep**: The summary-first architecture is already good
**Improve**: Visual polish of the summary view

```
┌─────────────────────────────────────────────┐
│ ← 본문      마태복음 11:28-30               │
├─────────────────────────────────────────────┤
│                                             │
│  192개 직접 연결                             │ ← network summary
│  ─────────────────────────                  │
│                                             │
│  가장 강한 연결:                             │
│  ┌─────────────────────────────────────┐   │
│  │ 이사야 40:29-31  ←  연결 192개      │   │ ← top connections
│  │ 로마서 8:28-30   ←  연결 45개       │   │    with passage panel links
│  │ 빌립보서 4:13     ←  연결 38개       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [전체 네트워크 보기 →]                       │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.8. Lanes Page Redesign

**Current**: Search + topic filter + cluster cards
**Improve**: Better visual hierarchy, topic chips

```
┌─────────────────────────────────────────────┐
│ 성경 하이퍼링크 컴패니언     성경 읽기 한자 ≡│
├─────────────────────────────────────────────┤
│                                             │
│  공부 레인                                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🔍 주제나 키워드로 검색...          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [토라] [역사서] [시가] [대선지서] ...      │ ← topic chips
│  [복음서] [바울서신] [공동서신] [묵시]      │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 위로와 소망                          │   │
│  │ "지쳐 있는 사람에게 성경은..."       │   │
│  │ 이사야 40:29-31 → 묵상 시작         │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 고난과 인내                          │   │
│  │ ...                                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. Component-Level Changes

### 4.1. New: `components/global-nav.tsx`
Replaces `SecondaryNav` on interior pages + adds minimal bar to home page.

- Sticky top bar with glass background
- Site title (left), nav links (center/right), locale toggle (right)
- Mobile: hamburger menu → slide-in drawer
- Desktop: inline text links with active underline

### 4.2. New: `components/search-input.tsx`
Unified search component used on home, bible, hanja, lanes pages.

- Large input with search icon
- Placeholder text varies by context
- Submit routes to companion or current page with filter
- Suggestion chips below (home page only)

### 4.3. Modified: `components/quick-prompt-form.tsx`
Simplified for home page use.

- Remove the submit button (Enter key submits)
- Cleaner, more minimal styling
- Suggestion chips become subtle text links

### 4.4. New: `components/tab-section.tsx` (for hanja detail)
Already exists — reuse for hanja detail page tab navigation.

### 4.5. Modified: `components/passage-panel.tsx`
No structural changes needed — the side panel is already well-designed.

### 4.6. New: `components/mobile-menu.tsx`
Slide-in drawer for mobile navigation.

- Full nav list with sections
- Current page indicator
- Quick links to companion, bible, hanja
- Locale toggle inside

### 4.7. Modified: `components/crossref-network.tsx`
Visual polish only — summary view improvements.

---

## 5. Visual System Updates

### 5.0. Design Reference Basis

Extracted from `2026-pixel-fidelity-design-specs-ko` (Linear, Raycast, Stripe, Vercel, Notion, Cleo AI):

| Pattern | Source | Applied To |
|---|---|---|
| Near-black canvas `#08080d` | Linear, Raycast, Vercel | Page background |
| Single accent color (gold) | All dark-theme refs | Interactive states |
| Compact nav `clamp(56px, 6vw, 72px)` | All references | Global nav bar |
| Centered hero + single input | Raycast, Cleo AI | Home page |
| Hairline borders over shadows | Linear, Vercel | Card elevation |
| `clamp()` responsive spacing | All references | Container, gutter, padding |
| `12px` card radius, `8px` input radius | Stripe, Notion | Surface rounding |
| `999px` pill radius | Linear, Raycast | Chips, badges |
| Z-index layers: 0/3/40/50/60 | All references | Background/content/nav/overlay/modal |

### 5.1. CSS Variable Updates (globals.css)

```css
:root {
  /* Canvas — near-black (Linear/Raycast range) */
  --canvas: #08080d;
  --surface-0: #060609;
  --surface-1: #0e0e16;
  --surface-2: #16161f;
  --surface-3: #1e1e28;

  /* Hairline — subtle borders */
  --hairline: rgba(255, 255, 255, 0.06);
  --hairline-strong: rgba(255, 255, 255, 0.12);
  --hairline-hover: rgba(212, 168, 83, 0.25);

  /* Text hierarchy — warm off-white */
  --ink: #f0ece4;
  --ink-muted: #8a8480;
  --ink-subtle: #5a5550;

  /* Accent — gold (preserved) */
  --gold: #d4a853;
  --gold-hover: #e0bc6a;
  --gold-deep: #b8923f;
  --gold-soft: rgba(212, 168, 83, 0.08);

  /* Link */
  --link: #8ab4e8;

  /* Input (Raycast/Cleo pattern) */
  --input-bg: #0c0c14;
  --input-border: rgba(255, 255, 255, 0.08);
  --input-focus-border: rgba(212, 168, 83, 0.40);
  --input-placeholder: #4a4540;

  /* Focus (WCAG) */
  --focus-ring: rgba(212, 168, 83, 0.5);

  /* Transitions (Linear/Raycast easing) */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  /* Spacing (clamp-based, all references) */
  --container-max: clamp(320px, 92vw, 1200px);
  --gutter: clamp(16px, 4vw, 48px);
  --section-pad: clamp(48px, 8vw, 120px);
  --card-gap: clamp(12px, 2vw, 24px);

  /* Radius (Stripe/Notion ranges) */
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-pill: 999px;

  /* Nav (all references) */
  --nav-height: clamp(56px, 6vw, 72px);

  /* Z-index layers */
  --z-bg: 0;
  --z-content: 3;
  --z-nav: 40;
  --z-overlay: 50;
  --z-modal: 60;
}
```

### 5.2. Tailwind Config Extension

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      canvas: 'var(--canvas)',
      'surface-0': 'var(--surface-0)',
      'surface-1': 'var(--surface-1)',
      'surface-2': 'var(--surface-2)',
      'surface-3': 'var(--surface-3)',
      gold: {
        DEFAULT: 'var(--gold)',
        hover: 'var(--gold-hover)',
        deep: 'var(--gold-deep)',
        soft: 'var(--gold-soft)',
      },
      ink: {
        DEFAULT: 'var(--ink)',
        muted: 'var(--ink-muted)',
        subtle: 'var(--ink-subtle)',
      },
    },
    borderRadius: {
      card: 'var(--radius-card)',
      input: 'var(--radius-input)',
      pill: 'var(--radius-pill)',
    },
    maxWidth: {
      content: 'var(--container-max)',
      narrow: 'clamp(320px, 88vw, 720px)',
    },
    spacing: {
      section: 'var(--section-pad)',
      gutter: 'var(--gutter)',
      nav: 'var(--nav-height)',
    },
    transitionTimingFunction: {
      'out-expo': 'var(--ease-out)',
    },
    zIndex: {
      bg: 'var(--z-bg)',
      content: 'var(--z-content)',
      nav: 'var(--z-nav)',
      overlay: 'var(--z-overlay)',
      modal: 'var(--z-modal)',
    },
  },
},
```

### 5.3. Component Surface Tokens

| Component | Background | Border | Radius | Notes |
|---|---|---|---|---|
| Nav bar | `--surface-1` + `backdrop-blur-xl` | `--hairline` bottom | 0 | Sticky, z-nav |
| Card | `--surface-1` | `--hairline` | `--radius-card` | Hover: border → `--hairline-hover` |
| Input | `--input-bg` | `--input-border` | `--radius-input` | Focus: border → `--input-focus-border` + ring |
| Button primary | `--gold` | none | `--radius-input` | Hover: `--gold-hover` |
| Chip | `--surface-2` | `--hairline` | `--radius-pill` | Hover: border → `--hairline-hover` |
| Mobile drawer | `--surface-0` | `--hairline` right | `0 12px 12px 0` | z-modal, backdrop |
| Side panel | `--surface-1` | `--hairline` left | 0 | z-overlay |
| Section title | transparent | none | none | `0.75rem`, uppercase, gold, `0.08em` tracking |

---

## 6. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 640px` (mobile) | Single column, hamburger menu, stacked content |
| `640px - 1023px` (tablet) | Two-column where appropriate, inline nav starts |
| `≥ 1024px` (desktop) | Full two-column companion, sticky sidebar, side panel |

---

## 7. Migration Strategy

### Phase 1: Global Shell (this spec)
1. Create `components/global-nav.tsx`
2. Create `components/mobile-menu.tsx`
3. Update `app/[locale]/layout.tsx` to include global nav
4. Remove `SecondaryNav` from interior pages (replaced by global nav)

### Phase 2: Home Page
1. Simplify `app/[locale]/page.tsx` to input-only layout
2. Add smart routing logic to the input
3. Add rotating suggestion chips

### Phase 3: Companion Page
1. Restructure to two-column layout
2. Move background/history to sticky sidebar
3. Add progressive disclosure for teaching sections

### Phase 4: Bible Reader
1. Add inline book search
2. Compact book grid
3. Verse interaction improvements

### Phase 5: Hanja Pages
1. Search + filter on catalog page
2. Compact card grid with pagination
3. Tab-based detail page

### Phase 6: Polish
1. Micro-animations
2. Visual system updates
3. Tailwind config extension
4. CSS variable cleanup

---

## 8. Success Criteria

- [ ] Home page: single input dominates the viewport (≥ 60% of visible area)
- [ ] All pages have consistent top navigation
- [ ] Language toggle accessible from every page
- [ ] Mobile: hamburger menu with full nav
- [ ] Companion: two-column layout on desktop
- [ ] Bible: inline search works for book names
- [ ] Hanja: search/filter reduces visible cards
- [ ] Hanja detail: tab-based progressive disclosure
- [ ] Crossrefs: summary-first (already done, polish only)
- [ ] All existing functionality preserved
- [ ] All QA benchmarks pass
