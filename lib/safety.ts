export type SafetyLevel = "none" | "caution" | "crisis";
export type SafetyLocale = "en" | "ko" | "es";
export type SafetyRegion = "us-ca" | "kr" | "global";
export type SafetyFlag =
  | "self-harm"
  | "immediate danger"
  | "abuse danger"
  | "despair"
  | "abuse"
  | "mental distress"
  | "scrupulosity";

export type SafetyResource = {
  label: string;
  value: string;
  href?: string;
};

export type SafetyAssessment = {
  level: SafetyLevel;
  locale: SafetyLocale;
  region: SafetyRegion;
  title: string;
  flags: SafetyFlag[];
  flagLabels: string[];
  summary: string;
  guidance: string[];
  resourcesTitle: string;
  resources: SafetyResource[];
};

type SafetyOptions = {
  requestedLocale?: string;
  acceptLanguage?: string;
  countryCode?: string;
};

type SafetyCopy = {
  title: string;
  summary: string;
  guidance: string[];
  resourcesTitle: string;
};

type SafetyCopyByLevel = Record<Exclude<SafetyLevel, "none">, SafetyCopy> & {
  none: Pick<SafetyCopy, "summary" | "resourcesTitle">;
};

const HANGUL_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/i;
const SPANISH_PATTERN = /[¿¡áéíóúñ]|\b(dios|oraci[oó]n|siento|quiero|espera|perd[oó]n|ansiedad|triste|culpa)\b/i;

const FLAG_LABELS: Record<SafetyLocale, Record<SafetyFlag, string>> = {
  en: {
    "self-harm": "Self-harm",
    "immediate danger": "Immediate danger",
    "abuse danger": "Abuse danger",
    despair: "Despair",
    abuse: "Abuse",
    "mental distress": "Mental distress",
    scrupulosity: "Scrupulosity",
  },
  ko: {
    "self-harm": "자해 위험",
    "immediate danger": "즉각적인 위험",
    "abuse danger": "학대·폭력 위험",
    despair: "절망감",
    abuse: "학대·폭력",
    "mental distress": "정신적 고통",
    scrupulosity: "종교적 절망감",
  },
  es: {
    "self-harm": "Riesgo de autolesión",
    "immediate danger": "Peligro inmediato",
    "abuse danger": "Riesgo de abuso o violencia",
    despair: "Desesperación",
    abuse: "Abuso",
    "mental distress": "Angustia mental",
    scrupulosity: "Escrupulosidad religiosa",
  },
};

const SAFETY_COPY: Record<SafetyLocale, SafetyCopyByLevel> = {
  en: {
    none: {
      summary: "No elevated safety signals detected by the lightweight classifier.",
      resourcesTitle: "Support options",
    },
    caution: {
      title: "Caution signal",
      summary: "This prompt may need pastoral, relational, or mental-health caution in addition to scripture guidance.",
      guidance: [
        "Do not present the app as a counselor or final authority.",
        "Encourage the user to speak with a trusted pastor, counselor, doctor, or safe support person.",
        "If the situation worsens or becomes unsafe, move quickly to crisis help instead of staying inside reflection alone.",
      ],
      resourcesTitle: "Support options",
    },
    crisis: {
      title: "Immediate safety signal",
      summary: "This prompt may involve immediate self-harm, abuse, or acute danger and should not receive only a reflective Bible-study response.",
      guidance: [
        "Contact local emergency services or the nearest crisis line now if you may act on this danger.",
        "Move toward a trusted person or a safer public place if you are not safe where you are.",
        "Keep any spiritual reflection secondary to immediate safety and human support.",
      ],
      resourcesTitle: "Get help now",
    },
  },
  ko: {
    none: {
      summary: "가벼운 분류기 기준으로는 높은 안전 위험 신호가 감지되지 않았습니다.",
      resourcesTitle: "도움을 받을 수 있는 곳",
    },
    caution: {
      title: "주의가 필요한 신호",
      summary: "이 입력은 성경 설명만으로 끝내기보다 목회적·관계적·정신건강 차원의 주의가 함께 필요할 수 있습니다.",
      guidance: [
        "앱을 상담사나 최종 권위처럼 말하지 마세요.",
        "신뢰할 수 있는 목회자, 상담사, 의사, 가족이나 안전한 지지자와 실제로 연결되도록 권하세요.",
        "상황이 악화되거나 안전하지 않다고 느껴지면 묵상만 붙들지 말고 즉시 위기 지원으로 전환하세요.",
      ],
      resourcesTitle: "도움을 받을 수 있는 곳",
    },
    crisis: {
      title: "즉각적인 안전 신호",
      summary: "이 입력은 자해, 학대, 즉각적인 위험을 포함할 수 있으므로 성경 공부식 응답만으로 처리하면 안 됩니다.",
      guidance: [
        "지금 행동할 가능성이 있거나 이미 위험하다면 즉시 지역 응급전화나 위기 상담으로 연락하세요.",
        "혼자 있지 말고 신뢰할 수 있는 사람이나 더 안전한 공공장소로 이동하세요.",
        "영적 설명보다 즉각적인 안전 확보와 사람의 도움을 먼저 두세요.",
      ],
      resourcesTitle: "지금 바로 도움받기",
    },
  },
  es: {
    none: {
      summary: "El clasificador ligero no detectó señales elevadas de seguridad.",
      resourcesTitle: "Opciones de apoyo",
    },
    caution: {
      title: "Señal de precaución",
      summary: "Este mensaje puede necesitar precaución pastoral, relacional o de salud mental además de orientación bíblica.",
      guidance: [
        "No presentes la app como consejera ni como autoridad final.",
        "Anima a la persona a hablar con un pastor de confianza, un consejero, un médico o alguien seguro cercano.",
        "Si la situación empeora o se vuelve insegura, cambia rápido a ayuda de crisis en lugar de quedarte solo en la reflexión.",
      ],
      resourcesTitle: "Opciones de apoyo",
    },
    crisis: {
      title: "Señal de seguridad inmediata",
      summary: "Este mensaje puede implicar autolesión inmediata, abuso o peligro agudo y no debe recibir solo una respuesta devocional o de estudio bíblico.",
      guidance: [
        "Contacta ahora a emergencias locales o a una línea de crisis si crees que puedes actuar sobre este peligro.",
        "Acércate a una persona de confianza o a un lugar público más seguro si no estás a salvo donde estás.",
        "Mantén cualquier reflexión espiritual en segundo plano frente a la seguridad inmediata y la ayuda humana.",
      ],
      resourcesTitle: "Consigue ayuda ahora",
    },
  },
};

const CRISIS_PATTERNS: Array<[SafetyFlag, RegExp]> = [
  [
    "self-harm",
    /\b(kill myself|end my life|suicide|suicidal|hurt myself|self harm|self-harm|want to die|dont want to live|don't want to live)\b|죽고\s?싶|죽고싶|자해|목숨을\s?끊|살고\s?싶지\s?않|삶을\s?끝내|suicid|matarme|quitarme la vida|hacerme daño|lastimarme|quiero morir|no quiero vivir/i,
  ],
  [
    "immediate danger",
    /\b(overdose|jump off|hang myself|cut myself|plan to die|planning to die)\b|뛰어내리|목을\s?매|약을\s?과다|지금\s?죽|당장\s?죽|sobredosis|tirarme|ahorcarme|cortarme|pienso morir hoy|voy a matarme ahora/i,
  ],
  [
    "abuse danger",
    /\b(being abused right now|he is hitting me|she is hitting me|unsafe at home|in danger at home)\b|맞고\s?있|폭력을\s?당하|집에\s?있으면\s?위험|학대\s?받고\s?있|me está pegando|estoy en peligro en casa|abusan de mí ahora|violencia en casa/i,
  ],
];

const CAUTION_PATTERNS: Array<[SafetyFlag, RegExp]> = [
  [
    "despair",
    /\b(hopeless|worthless|numb|empty|cant go on|can't go on|no reason to live)\b|희망이\s?없|버티기\s?힘들|더는\s?못\s?버티|살\s?이유가\s?없|sin esperanza|no valgo nada|vacío|vacia|no puedo seguir|no hay razón para vivir/i,
  ],
  [
    "abuse",
    /\b(abuse|abusive|violent relationship|domestic violence|manipulated|controlled)\b|학대|가정폭력|폭력적인\s?관계|조종당하|통제당하|abuso|abusivo|violencia doméstica|violencia domestica|me controlan|me manipulan/i,
  ],
  [
    "mental distress",
    /\b(panic attack|anxiety attack|depressed|depression|breakdown|spiraling)\b|공황|불안\s?발작|우울|무너지는\s?것\s?같|너무\s?힘들|ataque de pánico|ataque de panico|ansiedad|depresión|depresion|derrumbe|me estoy hundiendo/i,
  ],
  [
    "scrupulosity",
    /\b(god hates me|unforgivable|blasphemed the spirit|beyond forgiveness)\b|하나님이\s?나를\s?미워|용서받을\s?수\s?없|성령\s?훼방|구원받지\s?못|dios me odia|imperdonable|blasfem[eé] contra el espíritu|no tengo perd[oó]n/i,
  ],
];

function uniqueFlags(flags: SafetyFlag[]) {
  return [...new Set(flags)];
}

function normalizeRegion(value: string | undefined): SafetyRegion | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["kr", "ko", "korea", "south-korea", "kor"].includes(normalized)) {
    return "kr";
  }

  if (["us", "usa", "ca", "canada", "us-ca", "na", "north-america"].includes(normalized)) {
    return "us-ca";
  }

  if (["global", "intl", "international", "world"].includes(normalized)) {
    return "global";
  }

  return null;
}

function resolveConfiguredRegion() {
  return normalizeRegion(process.env.SAFETY_REGION ?? process.env.NEXT_PUBLIC_SAFETY_REGION);
}

function supportOptionsTitle(locale: SafetyLocale) {
  return SAFETY_COPY[locale].none.resourcesTitle;
}

function globalResources(locale: SafetyLocale, level: Exclude<SafetyLevel, "none">): SafetyResource[] {
  if (locale === "es") {
    return level === "crisis"
      ? [
          {
            label: "Emergencias locales",
            value: "Llama ahora al número de emergencias de tu país si el peligro es inmediato.",
          },
          {
            label: "Findahelpline",
            value: "Busca una línea de crisis por país y por idioma.",
            href: "https://findahelpline.com/",
          },
          {
            label: "Befrienders Worldwide",
            value: "Red internacional de apoyo emocional y prevención del suicidio.",
            href: "https://www.befrienders.org/",
          },
        ]
      : [
          {
            label: "Findahelpline",
            value: "Encuentra ayuda de crisis y salud mental por país.",
            href: "https://findahelpline.com/",
          },
          {
            label: "Befrienders Worldwide",
            value: "Directorio internacional de apoyo emocional.",
            href: "https://www.befrienders.org/",
          },
        ];
  }

  if (locale === "ko") {
    return level === "crisis"
      ? [
          {
            label: "지역 응급전화",
            value: "즉각적인 위험이면 현재 있는 지역의 응급전화로 바로 연락하세요.",
          },
          {
            label: "Findahelpline",
            value: "국가별 위기 지원 연락처를 찾을 수 있습니다.",
            href: "https://findahelpline.com/",
          },
          {
            label: "Befrienders Worldwide",
            value: "국제 정서 지원 네트워크입니다.",
            href: "https://www.befrienders.org/",
          },
        ]
      : [
          {
            label: "Findahelpline",
            value: "국가별 위기·정신건강 지원을 찾을 수 있습니다.",
            href: "https://findahelpline.com/",
          },
          {
            label: "Befrienders Worldwide",
            value: "국제 정서 지원 연락처 모음입니다.",
            href: "https://www.befrienders.org/",
          },
        ];
  }

  return level === "crisis"
    ? [
        {
          label: "Local emergency services",
          value: "Call your local emergency number now if there is immediate danger.",
        },
        {
          label: "Findahelpline",
          value: "Find crisis and emotional-support lines by country and language.",
          href: "https://findahelpline.com/",
        },
        {
          label: "Befrienders Worldwide",
          value: "International emotional-support and suicide-prevention network.",
          href: "https://www.befrienders.org/",
        },
      ]
    : [
        {
          label: "Findahelpline",
          value: "Find mental-health and crisis support by country.",
          href: "https://findahelpline.com/",
        },
        {
          label: "Befrienders Worldwide",
          value: "International directory for emotional-support services.",
          href: "https://www.befrienders.org/",
        },
      ];
}

function usCaResources(locale: SafetyLocale, level: Exclude<SafetyLevel, "none">): SafetyResource[] {
  if (locale === "es") {
    return level === "crisis"
      ? [
          {
            label: "Emergencias locales",
            value: "Llama al 911 si el peligro es inmediato.",
          },
          {
            label: "988 Suicide & Crisis Lifeline",
            value: "Llama o envía un mensaje al 988 para apoyo inmediato en EE. UU. o Canadá.",
            href: "https://988lifeline.org/get-help/?lang=es",
          },
        ]
      : [
          {
            label: "988 Suicide & Crisis Lifeline",
            value: "Llama o envía un mensaje al 988 si la angustia se vuelve insegura o suicida.",
            href: "https://988lifeline.org/get-help/?lang=es",
          },
          {
            label: "Findahelpline",
            value: "Encuentra apoyo local adicional en español o inglés.",
            href: "https://findahelpline.com/",
          },
        ];
  }

  if (locale === "ko") {
    return level === "crisis"
      ? [
          {
            label: "응급상황",
            value: "미국·캐나다에 있고 즉각적인 위험이면 911로 연락하세요.",
          },
          {
            label: "988 Suicide & Crisis Lifeline",
            value: "미국·캐나다에서는 988로 전화하거나 문자할 수 있습니다.",
            href: "https://988lifeline.org/get-help/",
          },
        ]
      : [
          {
            label: "988 Suicide & Crisis Lifeline",
            value: "고통이 자살 위험이나 급한 위기로 번지면 988로 연락하세요.",
            href: "https://988lifeline.org/get-help/",
          },
          {
            label: "Findahelpline",
            value: "현지 추가 지원 연락처를 찾을 수 있습니다.",
            href: "https://findahelpline.com/",
          },
        ];
  }

  return level === "crisis"
    ? [
        {
          label: "Local emergency services",
          value: "Call 911 now if there is immediate danger.",
        },
        {
          label: "988 Suicide & Crisis Lifeline",
          value: "Call or text 988 in the U.S. or Canada.",
          href: "https://988lifeline.org/get-help/",
        },
      ]
    : [
        {
          label: "988 Suicide & Crisis Lifeline",
          value: "Call or text 988 if the distress turns unsafe or suicidal.",
          href: "https://988lifeline.org/get-help/",
        },
        {
          label: "Findahelpline",
          value: "Find additional local support if 988 is not the right fit.",
          href: "https://findahelpline.com/",
        },
      ];
}

function koreaResources(locale: SafetyLocale, level: Exclude<SafetyLevel, "none">): SafetyResource[] {
  if (locale === "ko") {
    return level === "crisis"
      ? [
          {
            label: "응급상황",
            value: "119 또는 지역 응급전화",
            href: "https://helpline.or.kr/crisis?lang=ko",
          },
          {
            label: "경찰",
            value: "112",
            href: "https://helpline.or.kr/crisis?lang=ko",
          },
          {
            label: "자살예방 상담전화",
            value: "109",
            href: "https://www.129.go.kr/109",
          },
          {
            label: "정신건강위기상담전화",
            value: "1577-0199",
            href: "https://helpline.or.kr/crisis?lang=ko",
          },
        ]
      : [
          {
            label: "정신건강위기상담전화",
            value: "1577-0199",
            href: "https://helpline.or.kr/crisis?lang=ko",
          },
          {
            label: "자살예방 상담전화",
            value: "109",
            href: "https://www.129.go.kr/109",
          },
        ];
  }

  if (locale === "es") {
    return level === "crisis"
      ? [
          {
            label: "Emergencias en Corea",
            value: "119 para emergencias médicas o 112 para policía.",
            href: "https://helpline.or.kr/en/crisis",
          },
          {
            label: "Helpline Korea",
            value: "Contactos de crisis en Corea con orientación en inglés.",
            href: "https://helpline.or.kr/en/crisis",
          },
        ]
      : [
          {
            label: "Helpline Korea",
            value: "Contactos de crisis y apoyo en Corea.",
            href: "https://helpline.or.kr/en/crisis",
          },
          {
            label: "Findahelpline",
            value: "Ayuda adicional por idioma y país.",
            href: "https://findahelpline.com/",
          },
        ];
  }

  return level === "crisis"
    ? [
        {
          label: "Emergency in Korea",
          value: "Call 119 for medical emergencies or 112 for police.",
          href: "https://helpline.or.kr/en/crisis",
        },
        {
          label: "Helpline Korea crisis contacts",
          value: "Emergency, suicide, and police contacts in Korea.",
          href: "https://helpline.or.kr/en/crisis",
        },
      ]
    : [
        {
          label: "Helpline Korea crisis contacts",
          value: "English-language crisis contacts for people in or near Korea.",
          href: "https://helpline.or.kr/en/crisis",
        },
        {
          label: "Findahelpline",
          value: "Additional country and language support options.",
          href: "https://findahelpline.com/",
        },
      ];
}

function buildResources(locale: SafetyLocale, region: SafetyRegion, level: Exclude<SafetyLevel, "none">) {
  if (region === "kr") {
    return koreaResources(locale, level);
  }

  if (region === "us-ca") {
    return usCaResources(locale, level);
  }

  return globalResources(locale, level);
}

function primaryAcceptedLocaleTag(acceptLanguage?: string) {
  return acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
}

export function resolveSafetyLocale({
  prompt,
  requestedLocale,
  acceptLanguage,
}: SafetyOptions & { prompt?: string }): SafetyLocale {
  const requested = requestedLocale?.toLowerCase();
  if (requested?.startsWith("ko")) {
    return "ko";
  }

  if (requested?.startsWith("es")) {
    return "es";
  }

  if (requested?.startsWith("en")) {
    return "en";
  }

  if (prompt && HANGUL_PATTERN.test(prompt)) {
    return "ko";
  }

  if (prompt && SPANISH_PATTERN.test(prompt)) {
    return "es";
  }

  const accepted = primaryAcceptedLocaleTag(acceptLanguage);
  if (accepted.startsWith("ko")) {
    return "ko";
  }

  if (accepted.startsWith("es")) {
    return "es";
  }

  return "en";
}

export function resolveSafetyRegion(options: SafetyOptions & { prompt?: string }): SafetyRegion {
  const configured = resolveConfiguredRegion();
  if (configured) {
    return configured;
  }

  const country = options.countryCode?.trim().toUpperCase();
  if (country === "KR") {
    return "kr";
  }

  if (country === "US" || country === "CA") {
    return "us-ca";
  }

  const accepted = primaryAcceptedLocaleTag(options.acceptLanguage);
  if (accepted.startsWith("ko")) {
    return "kr";
  }

  if (accepted.startsWith("en-us") || accepted.startsWith("en-ca") || accepted.startsWith("es-us") || accepted.startsWith("es-ca")) {
    return "us-ca";
  }

  return resolveSafetyLocale(options) === "ko" ? "kr" : "global";
}

export function assessPromptSafety(prompt: string, options: SafetyOptions = {}): SafetyAssessment {
  const locale = resolveSafetyLocale({ prompt, ...options });
  const region = resolveSafetyRegion({ prompt, ...options });
  const flags: SafetyFlag[] = [];

  for (const [label, pattern] of CRISIS_PATTERNS) {
    if (pattern.test(prompt)) {
      flags.push(label);
    }
  }

  if (flags.length) {
    const copy = SAFETY_COPY[locale].crisis;
    const unique = uniqueFlags(flags);

    return {
      level: "crisis",
      locale,
      region,
      title: copy.title,
      flags: unique,
      flagLabels: unique.map((flag) => FLAG_LABELS[locale][flag]),
      summary: copy.summary,
      guidance: copy.guidance,
      resourcesTitle: copy.resourcesTitle,
      resources: buildResources(locale, region, "crisis"),
    };
  }

  for (const [label, pattern] of CAUTION_PATTERNS) {
    if (pattern.test(prompt)) {
      flags.push(label);
    }
  }

  if (flags.length) {
    const copy = SAFETY_COPY[locale].caution;
    const unique = uniqueFlags(flags);

    return {
      level: "caution",
      locale,
      region,
      title: copy.title,
      flags: unique,
      flagLabels: unique.map((flag) => FLAG_LABELS[locale][flag]),
      summary: copy.summary,
      guidance: copy.guidance,
      resourcesTitle: copy.resourcesTitle,
      resources: buildResources(locale, region, "caution"),
    };
  }

  return {
    level: "none",
    locale,
    region,
    title: "",
    flags: [],
    flagLabels: [],
    summary: SAFETY_COPY[locale].none.summary,
    guidance: [],
    resourcesTitle: supportOptionsTitle(locale),
    resources: [],
  };
}
