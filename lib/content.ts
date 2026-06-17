import type { SourceLink, StoryCluster } from "@/lib/app-data";
import type { CrossReferenceSupportType } from "@/lib/knowledge";

export type AppLocale = "en" | "ko";

const KO_TOPIC_LABELS: Record<string, string> = {
  Torah: "토라",
  History: "역사서",
  "Poetry and Wisdom": "시가·지혜서",
  "Major Prophets": "대선지서",
  "Minor Prophets": "소선지서",
  Gospels: "복음서",
  Acts: "사도행전",
  "Pauline Letters": "바울서신",
  "General Letters": "공동서신",
  Apocalyptic: "묵시문학",
  Canon: "정경",
};

export const UI_COPY = {
  en: {
    siteTitle: "Bible Hyperlink Companion",
    siteSubtitle: "Grounded study-first guidance",
    home: {
      badge: "Concept + implementation foundation",
      subBadge: "WEB corpus · hyperlink-first Bible study companion",
      eyebrow: "Designed for people who want scripture taught, not merely quoted",
      title: "Bring your thoughts.\nFollow the Bible’s own links.",
      body:
        "This companion starts with a lived concern, then teaches through passage context, authorship, date range, location, intertextual echoes, and the way Jesus and Paul speak into the same theme.",
      openCompanion: "Open companion",
      openGraph: "View hyperlink map",
      openLanes: "Browse study lanes",
      tryTitle: "Try the core interaction",
      browseByTopic: "Browse by topic",
      implementedLanes: "Initial study lanes implemented",
      features: [
        {
          title: "Cross-reference graph",
          body: "Scripture interprets scripture through explicit and thematic links.",
        },
        {
          title: "Date, place, audience",
          body: "Each passage carries context labels and confidence, not fake certainty.",
        },
        {
          title: "Personal connection",
          body: "The app explains why a text may fit your concern without pretending to replace pastoral care.",
        },
      ],
      heroTitle: "Bible Guidance",
      heroSubtitle: "Write one sentence about what's on your mind. The companion follows the Bible's own links through passage, context, and cross references.",
      heroHint: "Press Enter to start · Results open in the companion with passages, context, and cross references",
      howItWorks: [
        { title: "One Input", body: "From the first screen, you know exactly what to do." },
        { title: "Instant Entry", body: "After typing, you go straight to the companion results." },
        { title: "Grounded", body: "The homepage stays simple. Detailed study lives in the next screen." },
      ],
    },
    prompt: {
      placeholder:
        "Tell the app what you are carrying. It will answer with passages, context, linked texts, and how the story connects to you.",
      guidedStart: "Try a guided start",
      chips: ["Stories, not proof-texts", "Citations required", "Date/place shown when known"],
      submit: "Find the connected story",
    },
    sidebar: {
      navNewReflection: "New reflection",
      navGraph: "Hyperlink graph",
      navLanes: "Study lanes",
      navBible: "Full Bible",
      navReviews: "Reviews",
      suggestedStarts: "Suggested starts",
      browseByTopic: "Browse by topic",
      whyDifferent: "Why this UI feels different",
      whyDifferentBody:
        "Every answer must travel through passage context, linked texts, and study notes before it becomes prose.",
    },
    companion: {
      conversation: "Conversation",
      groundedResponse: "Grounded response",
      retrievalRationale: "Retrieval rationale",
      retrievalMode: "Retrieval mode",
      generation: "Generation",
      whyThisStoryFirst: "Why this story first",
      personalConnection: "Personal connection",
      primaryAndLinked: "Primary and linked passages",
      primaryAndLinkedBody: "These cards anchor the explanation before prose expands.",
      openStudyDesk: "Open study desk",
      primaryPassage: "Primary passage",
      linkedText: "Linked text",
      teachingBreakdown: "Teaching breakdown",
      primaryStory: "Primary story",
      datePlaceAudience: "Date / place / audience",
      originalAudience: "What the original audience likely heard",
      jesusPaul: "Jesus / Paul / canonical echoes",
      linkedMap: "Linked scripture map",
      relatedLanes: "Related study lanes",
      relatedLanesBody:
        "If this concern is close but not exact, follow another nearby biblical pattern.",
      sourcedNotes: "Sourced context notes",
      reflectionQuestions: "Reflection questions",
      sourceInventory: "Source inventory",
      continueReflecting: "Continue reflecting",
      notes: {
        date: "Date",
        place: "Place",
        author: "Author / transmission",
        reception: "Reception",
      },
    },
    study: {
      title: "Guided study desk",
      dateLayer: "Date / time layer",
      howToRead: "How to read this page",
      howToReadBody:
        "Study the passage first, then compare the linked texts, then inspect the sourced context notes before drawing a personal application.",
      primaryInContext: "Primary passage in context",
      whatPassageDoing: "What this passage is doing",
      meaningInsideCanon: "Meaning inside the canon",
      originalAudience: "Original audience likely heard",
      connectedNetwork: "Connected scripture network",
      relatedLanes: "Related study lanes",
      relatedLanesBody: "Compare this pattern with another nearby lane before settling on one application.",
      reflectionQuestions: "Reflection questions",
      teachingNotes: "Teaching notes",
      sourceInventory: "Source inventory",
    },
    graph: {
      title: "Hyperlink map",
      body:
        "This page visualizes how one concern moves through canonical links instead of collapsing into a single inspirational quote.",
      primaryNode: "Primary node",
      travelPath: "Canonical travel path",
      travelSteps: [
        "Start with the lived concern and main narrative/poetic unit.",
        "Pull explicit and thematic links from cross-reference datasets.",
        "Separate original-context notes from later Jewish and Christian readings.",
        "Show how Jesus and Paul speak into the same tension.",
        "Return to the user with citations and caution.",
      ],
      nextMove: "Next move",
      nextMoveBody:
        "Use the study desk to read each node with date, place, author, and audience labels before the final reflective explanation is written.",
      openStudyDesk: "Open study desk",
      relatedLanes: "Related study lanes",
      relatedLanesBody:
        "If this graph feels adjacent rather than exact, pivot into another nearby lane and compare the canonical pattern.",
      boundaries: "Interpretation boundaries",
      boundaryLines: [
        "Historical notes require sources and confidence labels.",
        "Jewish reception and Christian interpretation are shown in separate lanes.",
        "Personal application is downstream from the graph, never upstream of it.",
      ],
    },
    lanes: {
      title: "Study lanes catalog",
      heading: "Browse every guided biblical pattern",
      body:
        "Each lane starts from a lived concern, then routes through primary passages, linked scriptures, context notes, and related lanes instead of collapsing into one proof-text.",
      allTopics: "All topics",
      searchPlaceholder: "Search lanes by concern, theme, or emotion",
      filter: "Filter lanes",
      allLanes: "All lanes",
      shown: "shown",
      filters: "Filters",
      startReflection: "Start reflection",
      openStudyDesk: "Open study desk",
      viewGraph: "View graph",
      noMatch: "No lanes matched these filters",
      noMatchBody: "Try a broader topic, remove the search term, or return to the full catalog.",
      clearFilters: "Clear filters",
      openCompanion: "Open companion",
      howToUse: "How to use this catalog",
      howToUseLines: [
        "Pick the lane that most closely matches the tension you are carrying now.",
        "Use the companion when you want a response first, the study desk when you want structure first, and the graph when you want canonical links first.",
        "If one lane is close but not exact, use the related-lane pivots inside companion, study, or graph views.",
      ],
    },
    reviews: {
      title: "Anonymous reviews",
      heading: "Leave an anonymous review",
      body: "Share what worked, what felt confusing, or what should improve. Reviews are public, anonymous, and shown newest first.",
      formLabel: "Your review",
      placeholder: "Write a short anonymous review of the Bible Hyperlink Companion.",
      submit: "Post anonymous review",
      posting: "Posting…",
      empty: "No reviews yet. Be the first to leave one.",
      anonymous: "Anonymous reader",
      helper: "Do not include private information. Reviews must be 10-1200 characters.",
      success: "Review posted.",
      invalid: "Review could not be posted.",
    },
    rightRail: {
      teachThrough: "This answer will teach through",
      themes: "Themes",
      retrievalSignals: "Retrieval signals",
      studyFlow: "Study flow",
      flow: [
        "Primary passage in context",
        "Linked scriptures and echoes",
        "Date, place, author, audience",
        "Jesus / Paul / apostolic layer",
        "Personal connection with caution",
      ],
      deepDive: "Deep dive",
      openGuidedStudy: "Open guided study page",
      viewGraph: "View hyperlink map",
      browseByTopic: "Browse by topic",
    },
    crossrefs: {
      title: "Dataset cross references",
      body: "Ranked from the ingested OpenBible and Bible Cross References datasets.",
      howLabelsWork: "How these labels work",
      labels: {
        "consensus-link": "Consensus link",
        "vote-supported": "Vote-supported link",
        "phrase-anchor": "Phrase-anchor link",
      },
      labelBodies: {
        "consensus-link": "both datasets support the connection.",
        "vote-supported": "strongest support comes from OpenBible vote totals.",
        "phrase-anchor": "strongest support comes from KJV phrase-level anchors.",
      },
      sources: "Sources",
    },
    noteCard: {
      confidence: {
        high: "high",
        medium: "medium",
        disputed: "disputed",
      },
    },
    sourceList: {
      local: "Local asset",
      repository: "Repository",
      reference: "Reference data",
      external: "External source",
      source: "Source",
    },
    bookProfile: {
      title: "Book profile",
    },
    relationTypes: {
      parallel: "Parallel story or pattern",
      quotation: "Direct quotation",
      echo: "Canonical echo",
      fulfillment: "Fulfillment claim",
      theme: "Shared theme",
    },
  },
  ko: {
    siteTitle: "성경 하이퍼링크 컴패니언",
    siteSubtitle: "근거 중심의 공부 우선 안내",
    home: {
      badge: "개념 + 구현 기반",
      subBadge: "WEB 본문 · 하이퍼링크 중심 성경 공부 컴패니언",
      eyebrow: "성구만 인용받기보다 성경이 가르치기를 원하는 사람들을 위해",
      title: "마음을 가져오세요.\n성경이 스스로 연결하는 길을 따라가세요.",
      body:
        "이 컴패니언은 삶의 고민에서 출발해, 본문 문맥, 저자, 시대, 장소, 상호본문적 울림, 그리고 예수님과 바울이 같은 주제에 어떻게 말씀하는지를 통해 차근차근 가르칩니다.",
      openCompanion: "컴패니언 열기",
      openGraph: "하이퍼링크 지도 보기",
      openLanes: "공부 레인 둘러보기",
      tryTitle: "핵심 상호작용 바로 써보기",
      browseByTopic: "주제별로 둘러보기",
      implementedLanes: "구현된 기본 공부 레인",
      features: [
        {
          title: "상호참조 그래프",
          body: "성경은 명시적 연결과 주제적 연결을 통해 성경으로 성경을 풉니다.",
        },
        {
          title: "시대, 장소, 청중",
          body: "각 본문에는 과장된 확신이 아니라 문맥 라벨과 신뢰도 표시가 함께 붙습니다.",
        },
        {
          title: "개인적 연결",
          body: "앱은 목회적 돌봄을 대신한다고 가장하지 않으면서도, 왜 이 본문이 지금의 고민과 맞닿는지 설명합니다.",
        },
      ],
      heroTitle: "성경 길찾기",
      heroSubtitle: "마음을 한 문장으로 적으면, 본문과 연결과 맥락으로 바로 안내합니다.",
      heroHint: "Enter 키로 바로 시작 · 결과는 컴패니언 화면에서 본문/맥락/교차참조로 이어짐",
      howItWorks: [
        { title: "하나의 입력", body: "첫 화면에서 유저는 무엇을 해야 할지 바로 압니다." },
        { title: "즉시 진입", body: "입력 후 바로 결과 화면으로 이동합니다." },
        { title: "근거 중심", body: "홈은 단순하게, 복잡한 해설은 다음 화면으로." },
      ],
    },
    prompt: {
      placeholder:
        "지금 마음에 지고 있는 것을 적어 주세요. 앱은 관련 본문, 문맥, 연결 본문, 그리고 그 이야기가 왜 지금의 고민과 맞닿는지로 답합니다.",
      guidedStart: "가이드 시작 문장",
      chips: ["구절 끼워 맞추기 금지", "출처 필수", "알 수 있는 범위의 시대·장소 표시"],
      submit: "연결된 이야기를 찾기",
    },
    sidebar: {
      navNewReflection: "새 묵상 시작",
      navGraph: "하이퍼링크 그래프",
      navLanes: "공부 레인",
      navBible: "성경 전체",
      navReviews: "리뷰",
      suggestedStarts: "추천 시작점",
      browseByTopic: "주제별 둘러보기",
      whyDifferent: "이 UI가 다른 이유",
      whyDifferentBody:
        "모든 답변은 문장으로 풀어내기 전에 반드시 본문 문맥, 연결 본문, 공부 노트를 통과해야 합니다.",
    },
    companion: {
      conversation: "대화",
      groundedResponse: "근거 기반 응답",
      retrievalRationale: "검색 근거",
      retrievalMode: "검색 방식",
      generation: "생성 방식",
      whyThisStoryFirst: "왜 이 이야기를 먼저 읽는가",
      personalConnection: "개인적 연결",
      primaryAndLinked: "핵심 본문과 연결 본문",
      primaryAndLinkedBody: "설명이 길어지기 전에 이 카드들이 먼저 근거를 붙잡아 줍니다.",
      openStudyDesk: "스터디 데스크 열기",
      primaryPassage: "핵심 본문",
      linkedText: "연결 본문",
      teachingBreakdown: "가르침 분해",
      primaryStory: "핵심 이야기",
      datePlaceAudience: "시대 / 장소 / 청중",
      originalAudience: "처음 들은 이들이 들었을 법한 것",
      jesusPaul: "예수님 / 바울 / 정경적 울림",
      linkedMap: "연결된 성경 지도",
      relatedLanes: "관련 공부 레인",
      relatedLanesBody: "이 고민과 가깝지만 정확히 같지 않다면, 가까운 다른 성경 패턴으로 옮겨 가 보세요.",
      sourcedNotes: "출처가 있는 문맥 노트",
      reflectionQuestions: "묵상 질문",
      sourceInventory: "출처 목록",
      continueReflecting: "묵상 이어가기",
      notes: {
        date: "시대",
        place: "장소",
        author: "저자 / 전승",
        reception: "수용 전통",
      },
    },
    study: {
      title: "가이드 스터디 데스크",
      dateLayer: "시대 층위",
      howToRead: "이 페이지 읽는 법",
      howToReadBody:
        "먼저 본문을 읽고, 연결 본문을 비교한 뒤, 개인 적용으로 넘어가기 전에 출처가 있는 문맥 노트를 살펴보세요.",
      primaryInContext: "문맥 안의 핵심 본문",
      whatPassageDoing: "이 본문이 하고 있는 일",
      meaningInsideCanon: "정경 안에서의 의미",
      originalAudience: "처음 청중이 들었을 법한 것",
      connectedNetwork: "연결된 성경 네트워크",
      relatedLanes: "관련 공부 레인",
      relatedLanesBody: "한 가지 적용으로 바로 좁히기 전에, 가까운 다른 패턴과 먼저 비교해 보세요.",
      reflectionQuestions: "묵상 질문",
      teachingNotes: "가르침 노트",
      sourceInventory: "출처 목록",
    },
    graph: {
      title: "하이퍼링크 지도",
      body:
        "이 페이지는 한 가지 고민이 어떻게 정경적 연결을 따라 이동하는지 보여 줍니다. 한 문장의 위로 구절로 납작해지지 않게 하기 위해서입니다.",
      primaryNode: "핵심 노드",
      travelPath: "정경적 이동 경로",
      travelSteps: [
        "삶의 고민과 중심 서사/시 본문에서 시작합니다.",
        "상호참조 데이터셋에서 명시적 연결과 주제 연결을 끌어옵니다.",
        "원래 문맥 노트와 후대의 유대·기독교 읽기를 구분합니다.",
        "예수님과 바울이 같은 긴장 속에서 어떻게 말씀하는지 보여 줍니다.",
        "출처와 주의 문구를 갖춘 채 다시 사용자에게 돌아옵니다.",
      ],
      nextMove: "다음 단계",
      nextMoveBody:
        "최종 묵상 설명을 쓰기 전에, 스터디 데스크에서 각 노드를 시대, 장소, 저자, 청중 라벨과 함께 읽어 보세요.",
      openStudyDesk: "스터디 데스크 열기",
      relatedLanes: "관련 공부 레인",
      relatedLanesBody: "이 그래프가 비슷하지만 정확하지 않게 느껴진다면, 가까운 다른 레인으로 옮겨 정경 패턴을 비교해 보세요.",
      boundaries: "해석 경계선",
      boundaryLines: [
        "역사 노트에는 출처와 신뢰도 표시가 필요합니다.",
        "유대 전승과 기독교 해석은 분리된 레인으로 보여 줍니다.",
        "개인 적용은 그래프 다음 단계이지, 그래프를 밀어내는 출발점이 아닙니다.",
      ],
    },
    lanes: {
      title: "공부 레인 목록",
      heading: "가이드된 성경 패턴 전체 둘러보기",
      body:
        "각 레인은 삶의 고민에서 시작해, 핵심 본문, 연결 본문, 문맥 노트, 관련 레인을 거칩니다. 한 구절로 축소하지 않기 위해서입니다.",
      allTopics: "모든 주제",
      searchPlaceholder: "고민, 주제, 감정으로 레인 검색",
      filter: "레인 필터링",
      allLanes: "전체 레인",
      shown: "표시됨",
      filters: "필터",
      startReflection: "묵상 시작",
      openStudyDesk: "스터디 데스크 열기",
      viewGraph: "그래프 보기",
      noMatch: "조건에 맞는 레인이 없습니다",
      noMatchBody: "더 넓은 주제를 시도하거나 검색어를 지우고 전체 목록으로 돌아오세요.",
      clearFilters: "필터 지우기",
      openCompanion: "컴패니언 열기",
      howToUse: "이 목록을 쓰는 법",
      howToUseLines: [
        "지금 가장 가깝게 닿는 긴장을 담고 있는 레인을 고르세요.",
        "먼저 응답이 필요하면 컴패니언, 먼저 구조가 필요하면 스터디 데스크, 먼저 정경 연결이 필요하면 그래프를 쓰세요.",
        "가깝지만 정확하지 않은 레인이라면 컴패니언, 스터디, 그래프 안의 관련 레인 이동을 활용하세요.",
      ],
    },
    reviews: {
      title: "익명 리뷰",
      heading: "익명 리뷰 남기기",
      body: "좋았던 점, 헷갈렸던 점, 더 나아졌으면 하는 점을 남겨 주세요. 리뷰는 공개되며 익명으로 최신순 표시됩니다.",
      formLabel: "리뷰 내용",
      placeholder: "성경 하이퍼링크 컴패니언을 써본 느낌을 익명으로 적어 주세요.",
      submit: "익명 리뷰 등록",
      posting: "등록 중…",
      empty: "아직 리뷰가 없습니다. 첫 리뷰를 남겨 주세요.",
      anonymous: "익명 독자",
      helper: "개인정보는 적지 마세요. 리뷰는 10-1200자만 등록됩니다.",
      success: "리뷰가 등록되었습니다.",
      invalid: "리뷰를 등록하지 못했습니다.",
    },
    rightRail: {
      teachThrough: "이 답변은 다음 길을 따라 가르칩니다",
      themes: "주제",
      retrievalSignals: "검색 신호",
      studyFlow: "공부 흐름",
      flow: [
        "문맥 안의 핵심 본문",
        "연결된 성경과 울림",
        "시대, 장소, 저자, 청중",
        "예수님 / 바울 / 사도적 층위",
        "주의를 담은 개인적 연결",
      ],
      deepDive: "더 깊이 보기",
      openGuidedStudy: "가이드 스터디 열기",
      viewGraph: "하이퍼링크 지도 보기",
      browseByTopic: "주제별 둘러보기",
    },
    crossrefs: {
      title: "데이터셋 상호참조",
      body: "수집한 OpenBible 및 Bible Cross References 데이터셋 기준으로 정렬했습니다.",
      howLabelsWork: "라벨 읽는 법",
      labels: {
        "consensus-link": "합의된 연결",
        "vote-supported": "투표 기반 연결",
        "phrase-anchor": "구문 앵커 연결",
      },
      labelBodies: {
        "consensus-link": "두 데이터셋이 모두 이 연결을 지지합니다.",
        "vote-supported": "가장 강한 근거가 OpenBible 투표 수에서 옵니다.",
        "phrase-anchor": "가장 강한 근거가 KJV 구문 단위 앵커에서 옵니다.",
      },
      sources: "출처",
    },
    noteCard: {
      confidence: {
        high: "높음",
        medium: "중간",
        disputed: "논쟁 있음",
      },
    },
    sourceList: {
      local: "로컬 자산",
      repository: "저장소",
      reference: "참고 데이터",
      external: "외부 출처",
      source: "출처",
    },
    bookProfile: {
      title: "책 프로필",
    },
    relationTypes: {
      parallel: "평행한 이야기 / 패턴",
      quotation: "직접 인용",
      echo: "정경적 울림",
      fulfillment: "성취 주장",
      theme: "공유된 주제",
    },
  },
} as const;

export function resolveAppLocale(locale?: string): AppLocale {
  return locale === "ko" ? "ko" : "en";
}

export function localizeStoryCluster(cluster: StoryCluster, locale?: string): StoryCluster {
  const appLocale = resolveAppLocale(locale);
  if (appLocale === "en") {
    return cluster;
  }

  const copy = cluster.localizations?.ko;
  if (!copy) {
    return cluster;
  }

  return {
    ...cluster,
    ...copy,
    localizations: cluster.localizations,
  };
}

export function localizeSourceLinks(sources: SourceLink[], locale?: string): SourceLink[] {
  if (resolveAppLocale(locale) !== "ko") {
    return sources;
  }

  const labels: Record<string, string> = {
    "WEB metadata": "WEB 메타데이터",
    "World English Bible text": "World English Bible 본문",
    "Korean Bible text": "한국어 성경 본문",
    "Open Bibles Korean source": "Open Bibles 한국어 성경 원천",
    "Bible Cross References": "Bible Cross References",
    "CrossWire TSK": "CrossWire TSK",
    "STEPBible Data": "STEPBible 데이터",
    "OpenBible Geocoding": "OpenBible 지오코딩",
    "Sefaria Links API": "Sefaria 링크 API",
    "Bible Cross References project": "Bible Cross References 프로젝트",
    "Bible Cross References developers": "Bible Cross References 개발자 문서",
    "OpenBible cross references": "OpenBible 상호참조",
    "OpenBible geocoding": "OpenBible 지오코딩",
    "STEPBible places": "STEPBible 장소 데이터",
    "STEPBible data": "STEPBible 데이터",
    "Sefaria links API": "Sefaria 링크 API",
  };

  return sources.map((source) => ({
    ...source,
    label: labels[source.label] ?? source.label,
  }));
}

export function localizeTopicLabel(label: string, locale?: string) {
  if (resolveAppLocale(locale) !== "ko") {
    return label;
  }
  return KO_TOPIC_LABELS[label] ?? label;
}

export function localizeRelationTypeLabel(type: keyof typeof UI_COPY.en.relationTypes, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return UI_COPY[appLocale].relationTypes[type];
}

export function localizeConfidenceLabel(confidence: keyof typeof UI_COPY.en.noteCard.confidence, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return UI_COPY[appLocale].noteCard.confidence[confidence];
}

export function localizeSourceKind(kind: "local" | "repository" | "reference" | "external" | "source", locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return UI_COPY[appLocale].sourceList[kind];
}

export function localizeCrossReferenceSupportType(type: CrossReferenceSupportType, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return UI_COPY[appLocale].crossrefs.labels[type];
}

export function localizeCrossReferenceSupportSummary(type: CrossReferenceSupportType, locale?: string) {
  const appLocale = resolveAppLocale(locale);
  return UI_COPY[appLocale].crossrefs.labelBodies[type];
}
