import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { getBookMetadata } from "@/lib/book-metadata";
import { getPassage, type BibleReference } from "@/lib/bible";
import { resolveAppLocale, type AppLocale } from "@/lib/content";
import { buildBibleReferenceHref } from "@/lib/navigation";
import { buildPassageRecommendation } from "@/lib/passage-response";
import type { SafetyAssessment } from "@/lib/safety";
import { queueCardImageGeneration } from "@/lib/letter-card-generator";
import { sendSystemEmail } from "@/lib/letter-email";
import { loadLettersEmailEnv } from "@/lib/letter-env";

export type LetterCategory = "concern" | "reflection" | "question" | "prayer";
export type LetterVisibility = "private" | "unlisted" | "public";
export type LetterStatus = "created" | "matched" | "sent" | "answered" | "blocked";
export type CardKind = "question" | "answer";
export type GenerationStatus = "pending" | "generating" | "ready" | "failed" | "skipped";

export type ScriptureSuggestion = {
  reference: string;
  text: string;
  reason: string;
  href: string | null;
  confidence: "high" | "medium" | "low";
};

export type CardVisualTheme = {
  coreMessage: string;
  spiritualTheme: string;
  emotionalTone: string;
  visualMetaphor: string;
  environment: string;
  includeHumanFigure: boolean;
};

export type AnonymousLetter = {
  id: string;
  locale: AppLocale;
  category: LetterCategory;
  body: string;
  authorEmailHash: string;
  authorEmailEncrypted?: string;
  authorEmail: string;
  authorNickname?: string;
  status: LetterStatus;
  shareVisibility: LetterVisibility;
  safety: SafetyAssessment;
  scripture: ScriptureSuggestion;
  createdAt: string;
  updatedAt: string;
};

export type LetterCard = {
  id: string;
  letterId: string;
  answerId?: string;
  kind: CardKind;
  title: string;
  summary: string;
  scripture: ScriptureSuggestion;
  visualTheme: CardVisualTheme;
  imageUrl?: string;
  shareUrl?: string;
  generationProvider: "codex-imagen";
  generationStatus: GenerationStatus;
  generationMetadata?: Record<string, unknown>;
  visibility: LetterVisibility;
  createdAt: string;
};

export type LetterDelivery = {
  id: string;
  letterId: string;
  recipientEmail: string;
  recipientEmailHash: string;
  recipientEmailEncrypted?: string;
  participantId?: string;
  status: "sent" | "opened" | "answered" | "expired" | "skipped";
  replyTokenHash: string;
  sentAt?: string;
  expiresAt: string;
};

export type LetterAnswer = {
  id: string;
  letterId: string;
  deliveryId: string;
  responderNickname?: string;
  body: string;
  scripture: ScriptureSuggestion;
  answerCardId: string;
  readTokenHash: string;
  readToken?: string;
  createdAt: string;
};

export type LetterReport = {
  id: string;
  targetType: "letter" | "answer";
  targetId: string;
  reason: string;
  createdAt: string;
};

export type LetterParticipantStatus = "pending" | "active" | "paused" | "unsubscribed";

export type LetterParticipant = {
  id: string;
  email: string;
  emailHash: string;
  emailEncrypted?: string;
  nickname?: string;
  pendingNickname?: string;
  status: LetterParticipantStatus;
  canReceiveLetters: boolean;
  pendingCanReceiveLetters?: boolean;
  preferredLocale?: AppLocale;
  pendingPreferredLocale?: AppLocale;
  maxLettersPerDay?: number;
  otpHash?: string;
  otpExpiresAt?: string;
  otpRequestedAt?: string;
  otpRequestWindowStartedAt?: string;
  otpRequestCount: number;
  otpVerifyAttemptCount: number;
  unsubscribeTokenHash?: string;
  sessionTokenHash?: string;
  sessionTokenExpiresAt?: string;
  verifiedAt?: string;
  pausedUntil?: string;
  unsubscribedAt?: string;
  lastSelectedAt?: string;
  selectionWindowStartedAt?: string;
  selectionWindowCount: number;
  createdAt: string;
  updatedAt: string;
};

type LettersData = {
  letters: AnonymousLetter[];
  cards: LetterCard[];
  deliveries: LetterDelivery[];
  answers: LetterAnswer[];
  reports: LetterReport[];
  participants: LetterParticipant[];
};

export type PublicLetterParticipantStatus = {
  participantId: string;
  status: LetterParticipantStatus;
  canReceiveLetters: boolean;
  nickname?: string;
  maskedEmail: string;
  verifiedAt?: string;
  pausedUntil?: string;
  preferredLocale: AppLocale;
  maxLettersPerDay: number;
  selectionWindowCount: number;
  selectionLimitPerDay: number;
  nextEligibleAt?: string;
};

export type PublicLetterAnswer = Omit<LetterAnswer, "deliveryId" | "readTokenHash" | "readToken">;

export type PublicLetterBundle = {
  letter: Omit<AnonymousLetter, "authorEmail" | "authorEmailHash" | "authorEmailEncrypted">;
  card: LetterCard | null;
  delivery?: Pick<LetterDelivery, "status" | "expiresAt">;
  answer?: PublicLetterAnswer;
  answerCard?: LetterCard | null;
  requestedCard?: LetterCard;
};

const DEFAULT_LETTERS_PATH = join(process.cwd(), ".data", "letters.json");
const LETTERS_PATH = process.env.LETTERS_DATA_FILE || DEFAULT_LETTERS_PATH;
const MAX_BODY_LENGTH = 1200;
const MIN_BODY_LENGTH = 20;
const MAX_ANSWER_LENGTH = 1400;
const MAX_REPLY_SCRIPTURE_SUGGESTIONS = 10;
const MAX_NICKNAME_LENGTH = 32;
const MAX_STORED_LETTERS = 5000;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OTP_TTL_MS = 1000 * 60 * 10;
const OTP_RESEND_COOLDOWN_MS = 1000 * 60;
const OTP_REQUEST_WINDOW_MS = 1000 * 60 * 60;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const PARTICIPANT_SELECTION_COOLDOWN_MS = 1000 * 60 * 60 * 12;
const PARTICIPANT_SELECTION_WINDOW_MS = 1000 * 60 * 60 * 24;
const PARTICIPANT_SELECTION_MAX_PER_WINDOW = 3;
const PARTICIPANT_MAX_LETTERS_PER_DAY_OPTIONS = [1, 2, 3] as const;
const PARTICIPANT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 30000;
const CONTACT_PATTERN = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}\b|카톡|카카오톡|kakao|telegram|텔레그램)/i;
const MASTER_RELAY_EMAIL = "declan@ponslink.com";
const SYSTEM_CREATOR_EMAIL = MASTER_RELAY_EMAIL;
const CUTE_RANDOM_NICKNAMES = [
  "햇살친구",
  "말씀새싹",
  "은혜토끼",
  "기쁨방울",
  "소망별",
  "평안구름",
  "사랑콩",
  "위로새",
  "믿음나무",
  "빛송이",
  "기도고래",
  "감사양",
  "하늘다람쥐",
  "샬롬곰",
  "축복나비",
  "온유달",
  "진리별빛",
  "은혜바람",
  "소망씨앗",
  "사랑열매",
  "평화비둘기",
  "말씀등불",
  "기쁨여우",
  "위로햇님",
  "믿음펭귄",
  "하늘민들레",
  "샬롬고양이",
  "은혜물결",
  "소망종달새",
  "빛의친구",
] as const;

let writeQueue = Promise.resolve();

function emptyData(): LettersData {
  return { letters: [], cards: [], deliveries: [], answers: [], reports: [], participants: [] };
}

function hashValue(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string) {
  return hashValue(token);
}

function otpHash(email: string, otp: string) {
  return hashValue(`${normalizeEmail(email) ?? email}:${otp}`);
}

function normalizeBody(value: unknown, min = MIN_BODY_LENGTH, max = MAX_BODY_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n").trim();
  if (normalized.length < min || normalized.length > max) {
    return null;
  }
  return normalized;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizePreferredLocale(value: unknown): AppLocale | null {
  return value === "en" || value === "ko" ? value : null;
}


function resolveLetterRequestLocale(input: { locale?: string; acceptLanguage?: string; countryCode?: string }): AppLocale {
  const country = input.countryCode?.trim().toUpperCase();
  if (country === "KR") {
    return "ko";
  }

  const accepted = input.acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (accepted.startsWith("ko")) {
    return "ko";
  }
  if (accepted) {
    return "en";
  }
  if (country) {
    return "en";
  }

  return resolveAppLocale(input.locale);
}

function normalizeMaxLettersPerDay(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return PARTICIPANT_MAX_LETTERS_PER_DAY_OPTIONS.includes(parsed as typeof PARTICIPANT_MAX_LETTERS_PER_DAY_OPTIONS[number]) ? parsed : undefined;
}

function emailEncryptionKey() {
  const secret = process.env.LETTERS_EMAIL_ENCRYPTION_KEY?.trim();
  return secret ? createHash("sha256").update(secret).digest() : null;
}

function encryptEmailValue(value: string) {
  const key = emailEncryptionKey();
  if (!key) {
    return null;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptEmailValue(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("v1:")) {
    return null;
  }
  const key = emailEncryptionKey();
  if (!key) {
    return null;
  }
  const [, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    return null;
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
    return normalizeEmail(decrypted);
  } catch {
    return null;
  }
}

function storedEmail(raw: unknown, encrypted: unknown) {
  return normalizeEmail(raw) ?? decryptEmailValue(encrypted);
}

function normalizeOtp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

function maskedEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const safeLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}***`;
  const [domainName = "", ...domainRest] = domain.split(".");
  const safeDomain = domainName ? `${domainName.slice(0, 1)}***` : "***";
  return `${safeLocal}@${[safeDomain, ...domainRest].filter(Boolean).join(".")}`;
}

function createOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function normalizeNickname(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_NICKNAME_LENGTH || CONTACT_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function randomCuteNickname() {
  return CUTE_RANDOM_NICKNAMES[randomInt(0, CUTE_RANDOM_NICKNAMES.length)];
}

function normalizeCategory(value: unknown): LetterCategory {
  return value === "reflection" || value === "question" || value === "prayer" ? value : "concern";
}

function normalizeVisibility(value: unknown): LetterVisibility {
  return value === "public" ? "public" : "unlisted";
}

function normalizeScriptureReference(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 80 || CONTACT_PATTERN.test(normalized)) {
    return null;
  }
  return /^[\p{L}\p{N}\s:.,;\-–—()]+$/u.test(normalized) ? normalized : null;
}

function sanitizeExcerpt(text: string, max = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function categoryLabel(category: LetterCategory, locale: AppLocale) {
  const ko: Record<LetterCategory, string> = { concern: "고민", reflection: "고찰", question: "질문", prayer: "기도제목" };
  const en: Record<LetterCategory, string> = { concern: "Concern", reflection: "Reflection", question: "Question", prayer: "Prayer" };
  return (locale === "ko" ? ko : en)[category];
}

function referenceLabel(reference: { code: string; chapter: number; startVerse: number; endVerse: number }, locale: AppLocale) {
  const verse = reference.startVerse === reference.endVerse ? `${reference.chapter}:${reference.startVerse}` : `${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  const bookTitle = getBookMetadata(reference.code, locale)?.title ?? reference.code;
  return `${bookTitle} ${verse}`;
}

function fallbackScripture(locale: AppLocale): ScriptureSuggestion {
  return locale === "ko"
    ? {
        reference: "시편 23:1-3",
        text: "여호와는 나의 목자시니 내게 부족함이 없으리로다.",
        reason: "위로와 인도를 함께 묵상할 수 있는 기본 말씀입니다.",
        href: `/${locale}/passage/PSA-23-1-3`,
        confidence: "low",
      }
    : {
        reference: "Psalm 23:1-3",
        text: "Yahweh is my shepherd: I shall lack nothing.",
        reason: "A basic passage for comfort and guidance.",
        href: `/${locale}/passage/PSA-23-1-3`,
        confidence: "low",
      };
}

function inferVisualTheme(input: string, scripture: ScriptureSuggestion, locale: AppLocale): CardVisualTheme {
  const text = `${input} ${scripture.reference} ${scripture.reason}`.toLowerCase();
  const includes = (...terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));

  if (includes("위로", "쉼", "쉬게", "무거운", "짐", "지치", "평안", "불안", "기도", "응답", "comfort", "rest", "burden", "weary", "peace", "anxiety", "prayer", "trust")) {
    return {
      coreMessage: locale === "ko" ? "하나님의 말씀 안에서 받는 조용한 위로" : "Quiet comfort held in God's Word",
      spiritualTheme: "comfort_rest_trust",
      emotionalTone: locale === "ko" ? "따뜻하고 회복적인" : "warm and restorative",
      visualMetaphor: locale === "ko" ? "고요한 쉼터와 따뜻한 빛" : "a quiet shelter and warm light",
      environment: locale === "ko" ? "이른 아침의 들판과 부드러운 빛" : "a peaceful field in gentle morning light",
      includeHumanFigure: false,
    };
  }


  if (includes("빛", "진리", "생명", "light", "truth", "life", "revelation")) {
    return {
      coreMessage: locale === "ko" ? "어둠 가운데 드러나는 하나님의 빛" : "God's light breaking into darkness",
      spiritualTheme: "light_truth_life",
      emotionalTone: locale === "ko" ? "경외감과 소망" : "reverent hope",
      visualMetaphor: locale === "ko" ? "어둠을 가르는 한 줄기 빛" : "a ray of light breaking darkness",
      environment: locale === "ko" ? "새벽빛이 열리는 고요한 하늘" : "a quiet sky opening at dawn",
      includeHumanFigure: false,
    };
  }

  if (includes("창조", "태초", "태초에 말씀이", "영원", "creation", "beginning", "the word", "eternity")) {
    return {
      coreMessage: locale === "ko" ? "모든 시작 위에 계신 하나님의 말씀" : "The Word before every beginning",
      spiritualTheme: "creation_word_majesty",
      emotionalTone: locale === "ko" ? "장엄하고 경외로운" : "majestic and awe-filled",
      visualMetaphor: locale === "ko" ? "질서가 생겨나는 우주적 여명" : "primordial light ordering the vastness",
      environment: locale === "ko" ? "광대한 하늘과 시작의 빛" : "vast heavens and first light",
      includeHumanFigure: false,
    };
  }

  if (includes("목자", "인도", "보호", "푸른", "shepherd", "guide", "protect", "provide")) {
    return {
      coreMessage: locale === "ko" ? "하나님이 길과 쉼을 주신다" : "God provides a safe path and rest",
      spiritualTheme: "guidance_provision",
      emotionalTone: locale === "ko" ? "안전하고 평온한" : "safe and peaceful",
      visualMetaphor: locale === "ko" ? "푸른 초장과 안전한 길" : "green pasture and a safe path",
      environment: locale === "ko" ? "강가와 초장이 있는 고요한 풍경" : "a quiet river and pasture landscape",
      includeHumanFigure: false,
    };
  }

  if (includes("용기", "담대", "소명", "사명", "약속", "courage", "calling", "mission", "promise", "persevere")) {
    return {
      coreMessage: locale === "ko" ? "두려움 속에서도 앞으로 부르시는 하나님" : "God calls forward through fear",
      spiritualTheme: "courage_calling",
      emotionalTone: locale === "ko" ? "담대하고 희망적인" : "courageous and hopeful",
      visualMetaphor: locale === "ko" ? "먼 지평선을 향해 이어지는 산길" : "a mountain path toward a far horizon",
      environment: locale === "ko" ? "새벽 능선과 열린 길" : "a dawn ridge and open road",
      includeHumanFigure: true,
    };
  }

  if (includes("회개", "용서", "은혜", "죄", "repent", "forgive", "grace", "sin")) {
    return {
      coreMessage: locale === "ko" ? "하나님께 돌아가는 길이 열려 있다" : "A return to grace remains open",
      spiritualTheme: "repentance_grace",
      emotionalTone: locale === "ko" ? "애통하지만 소망 있는" : "tender and hopeful",
      visualMetaphor: locale === "ko" ? "비가 그친 뒤 집으로 향하는 빛" : "homecoming light after rain",
      environment: locale === "ko" ? "젖은 길과 부드러운 새벽" : "a softened dawn after rain",
      includeHumanFigure: true,
    };
  }

  if (includes("부활", "승리", "resurrection", "victory")) {
    return {
      coreMessage: locale === "ko" ? "죽음과 절망을 넘어서는 새 생명" : "New life beyond death and despair",
      spiritualTheme: "resurrection_victory",
      emotionalTone: locale === "ko" ? "승리와 환희" : "triumphant hope",
      visualMetaphor: locale === "ko" ? "찬란하게 열리는 새벽" : "a radiant breakthrough dawn",
      environment: locale === "ko" ? "밝아지는 하늘과 열린 공간" : "brightening sky and open space",
      includeHumanFigure: false,
    };
  }

  return {
    coreMessage: locale === "ko" ? "하나님의 말씀 안에서 받는 조용한 위로" : "Quiet comfort held in God's Word",
    spiritualTheme: "comfort_rest_trust",
    emotionalTone: locale === "ko" ? "따뜻하고 회복적인" : "warm and restorative",
    visualMetaphor: locale === "ko" ? "고요한 쉼터와 따뜻한 빛" : "a quiet shelter and warm light",
    environment: locale === "ko" ? "이른 아침의 들판과 부드러운 빛" : "a peaceful field in gentle morning light",
    includeHumanFigure: false,
  };
}


function migrateLetters(value: unknown): AnonymousLetter[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const letter = entry as Partial<AnonymousLetter>;
    const authorEmail = storedEmail(letter.authorEmail, letter.authorEmailEncrypted);
    if (!authorEmail) {
      return [];
    }
    return [{
      ...letter,
      id: typeof letter.id === "string" ? letter.id : randomUUID(),
      locale: resolveAppLocale(letter.locale),
      category: normalizeCategory(letter.category),
      body: typeof letter.body === "string" ? letter.body : "",
      authorEmail,
      authorEmailHash: typeof letter.authorEmailHash === "string" ? letter.authorEmailHash : hashValue(authorEmail),
      status: letter.status === "matched" || letter.status === "sent" || letter.status === "answered" || letter.status === "blocked" ? letter.status : "created",
      shareVisibility: normalizeVisibility(letter.shareVisibility),
      safety: letter.safety as SafetyAssessment,
      scripture: letter.scripture as ScriptureSuggestion,
      createdAt: typeof letter.createdAt === "string" ? letter.createdAt : new Date().toISOString(),
      updatedAt: typeof letter.updatedAt === "string" ? letter.updatedAt : typeof letter.createdAt === "string" ? letter.createdAt : new Date().toISOString(),
    } as AnonymousLetter];
  });
}

function migrateDeliveries(value: unknown): LetterDelivery[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const delivery = entry as Partial<LetterDelivery>;
    const recipientEmail = storedEmail(delivery.recipientEmail, delivery.recipientEmailEncrypted);
    if (!recipientEmail || typeof delivery.letterId !== "string" || typeof delivery.replyTokenHash !== "string") {
      return [];
    }
    return [{
      ...delivery,
      id: typeof delivery.id === "string" ? delivery.id : randomUUID(),
      letterId: delivery.letterId,
      recipientEmail,
      recipientEmailHash: typeof delivery.recipientEmailHash === "string" ? delivery.recipientEmailHash : hashValue(recipientEmail),
      status: delivery.status === "sent" || delivery.status === "opened" || delivery.status === "answered" || delivery.status === "expired" ? delivery.status : "skipped",
      replyTokenHash: delivery.replyTokenHash,
      expiresAt: typeof delivery.expiresAt === "string" ? delivery.expiresAt : new Date(0).toISOString(),
    } as LetterDelivery];
  });
}

function migrateParticipants(value: unknown): LetterParticipant[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const participant = entry as Partial<LetterParticipant>;
    const email = storedEmail(participant.email, participant.emailEncrypted);
    const emailHash = typeof participant.emailHash === "string" ? participant.emailHash : email ? hashValue(email) : null;
    if (!email || !emailHash) {
      return [];
    }
    const now = typeof participant.createdAt === "string" ? participant.createdAt : new Date().toISOString();
    const status: LetterParticipantStatus =
      participant.status === "active" || participant.status === "paused" || participant.status === "unsubscribed" ? participant.status : "pending";
    return [{
      id: typeof participant.id === "string" ? participant.id : randomUUID(),
      email,
      emailHash,
      emailEncrypted: typeof participant.emailEncrypted === "string" ? participant.emailEncrypted : undefined,
      nickname: typeof participant.nickname === "string" ? participant.nickname : undefined,
      pendingNickname: typeof participant.pendingNickname === "string" ? participant.pendingNickname : undefined,
      status,
      canReceiveLetters: participant.canReceiveLetters === true,
      pendingCanReceiveLetters: typeof participant.pendingCanReceiveLetters === "boolean" ? participant.pendingCanReceiveLetters : undefined,
      preferredLocale: normalizePreferredLocale(participant.preferredLocale) ?? resolveAppLocale(participant.preferredLocale),
      pendingPreferredLocale: normalizePreferredLocale(participant.pendingPreferredLocale) ?? undefined,
      maxLettersPerDay: normalizeMaxLettersPerDay(participant.maxLettersPerDay) ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW,
      otpHash: typeof participant.otpHash === "string" ? participant.otpHash : undefined,
      otpExpiresAt: typeof participant.otpExpiresAt === "string" ? participant.otpExpiresAt : undefined,
      otpRequestedAt: typeof participant.otpRequestedAt === "string" ? participant.otpRequestedAt : undefined,
      otpRequestWindowStartedAt: typeof participant.otpRequestWindowStartedAt === "string" ? participant.otpRequestWindowStartedAt : undefined,
      otpRequestCount: Number.isFinite(participant.otpRequestCount) ? Number(participant.otpRequestCount) : 0,
      otpVerifyAttemptCount: Number.isFinite(participant.otpVerifyAttemptCount) ? Number(participant.otpVerifyAttemptCount) : 0,
      sessionTokenHash: typeof participant.sessionTokenHash === "string" ? participant.sessionTokenHash : undefined,
      sessionTokenExpiresAt: typeof participant.sessionTokenExpiresAt === "string" ? participant.sessionTokenExpiresAt : undefined,
      unsubscribeTokenHash: typeof participant.unsubscribeTokenHash === "string" ? participant.unsubscribeTokenHash : undefined,
      verifiedAt: typeof participant.verifiedAt === "string" ? participant.verifiedAt : undefined,
      pausedUntil: typeof participant.pausedUntil === "string" ? participant.pausedUntil : undefined,
      unsubscribedAt: typeof participant.unsubscribedAt === "string" ? participant.unsubscribedAt : undefined,
      lastSelectedAt: typeof participant.lastSelectedAt === "string" ? participant.lastSelectedAt : undefined,
      selectionWindowStartedAt: typeof participant.selectionWindowStartedAt === "string" ? participant.selectionWindowStartedAt : undefined,
      selectionWindowCount: Number.isFinite(participant.selectionWindowCount) ? Number(participant.selectionWindowCount) : 0,
      createdAt: now,
      updatedAt: typeof participant.updatedAt === "string" ? participant.updatedAt : now,
    }];
  });
}

async function readLettersFile(): Promise<LettersData> {
  try {
    const raw = await readFile(LETTERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LettersData>;
    return {
      letters: migrateLetters(parsed.letters),
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      deliveries: migrateDeliveries(parsed.deliveries),
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      participants: migrateParticipants(parsed.participants),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return emptyData();
    }
    throw error;
  }
}


function serializeLettersData(data: LettersData): LettersData {
  if (!emailEncryptionKey()) {
    return data;
  }
  return {
    ...data,
    letters: data.letters.map((letter) => {
      const { authorEmail, ...rest } = letter;
      return { ...rest, authorEmailEncrypted: encryptEmailValue(authorEmail) ?? letter.authorEmailEncrypted } as AnonymousLetter;
    }),
    deliveries: data.deliveries.map((delivery) => {
      const { recipientEmail, ...rest } = delivery;
      return { ...rest, recipientEmailEncrypted: encryptEmailValue(recipientEmail) ?? delivery.recipientEmailEncrypted } as LetterDelivery;
    }),
    participants: data.participants.map((participant) => {
      const { email, ...rest } = participant;
      return { ...rest, emailEncrypted: encryptEmailValue(email) ?? participant.emailEncrypted } as LetterParticipant;
    }),
  };
}

async function writeLettersFile(data: LettersData) {
  await mkdir(dirname(LETTERS_PATH), { recursive: true });
  const tmpPath = `${LETTERS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(serializeLettersData(data), null, 2)}\n`, "utf8");
  await rename(tmpPath, LETTERS_PATH);
}

async function acquireLettersFileLock() {
  await mkdir(dirname(LETTERS_PATH), { recursive: true });
  const lockPath = `${LETTERS_PATH}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, "utf8");
      return async () => {
        await handle.close().catch(() => undefined);
        await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }
      const lockStat = await stat(lockPath).catch(() => null);
      if (lockStat && Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for letters data file lock");
      }
      await sleep(25);
    }
  }
}


async function mutateLettersFile<T>(mutator: (data: LettersData) => Promise<T> | T) {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const release = await acquireLettersFileLock();
    try {
      const data = await readLettersFile();
      result = await mutator(data);
      data.letters = data.letters.slice(0, MAX_STORED_LETTERS);
      await writeLettersFile(data);
    } finally {
      await release();
    }
  });
  await writeQueue;
  return result;
}

async function buildScriptureSuggestion(prompt: string, locale: AppLocale, requestMeta?: { acceptLanguage?: string; countryCode?: string }): Promise<{ scripture: ScriptureSuggestion; safety: SafetyAssessment }> {
  const build = await buildPassageRecommendation(prompt, {
    locale,
    acceptLanguage: requestMeta?.acceptLanguage,
    countryCode: requestMeta?.countryCode,
    includeRelatedPassageDetails: false,
    includeExternalResources: false,
  });

  const primary = build.recommendation.primary;
  if (!primary) {
    return { scripture: fallbackScripture(locale), safety: build.safety };
  }

  return {
    scripture: {
      reference: referenceLabel(primary.reference, locale),
      text: primary.text,
      reason: primary.reason,
      href: build.recommendation.readerHref ?? buildBibleReferenceHref(primary.reference, { locale, from: "letters" }),
      confidence: build.recommendation.confidence,
    },
    safety: build.safety,
  };
}

function normalizeRecommendationConfidence(value: unknown): ScriptureSuggestion["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function compactScriptureText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  for (const marker of ["핵심 구절:", "Key lines:"]) {
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex >= 0) {
      return normalized.slice(markerIndex + marker.length).trim();
    }
  }
  if (
    normalized.startsWith("본문을 직접 읽으며") ||
    normalized.startsWith("Read this passage directly") ||
    normalized.startsWith("Supporting passage") ||
    normalized.startsWith("메인 성구를 보강")
  ) {
    return "";
  }
  return normalized;
}

async function passageVerseText(reference: BibleReference, locale: AppLocale, fallbackText: string) {
  try {
    const passage = await getPassage(reference, locale);
    const text = passage.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ");
    return compactScriptureText(text);
  } catch {
    return compactScriptureText(fallbackText);
  }
}

async function buildReplyScriptureSuggestions(letter: AnonymousLetter, locale: AppLocale) {
  const suggestions: ScriptureSuggestion[] = [];
  const seen = new Set<string>();
  const pushSuggestion = (suggestion: ScriptureSuggestion) => {
    const reference = suggestion.reference.replace(/\s+/g, " ").trim();
    if (!reference || seen.has(reference) || suggestions.length >= MAX_REPLY_SCRIPTURE_SUGGESTIONS) {
      return;
    }
    seen.add(reference);
    suggestions.push({ ...suggestion, reference });
  };

  pushSuggestion(letter.scripture);

  try {
    const build = await buildPassageRecommendation(letter.body, {
      locale,
      includeRelatedPassageDetails: true,
      includeExternalResources: false,
    });
    const confidence = normalizeRecommendationConfidence(build.recommendation.confidence);
    const primary = build.recommendation.primary;
    if (primary) {
      pushSuggestion({
        reference: referenceLabel(primary.reference, locale),
        text: primary.text,
        reason: primary.reason,
        href: build.recommendation.readerHref ?? buildBibleReferenceHref(primary.reference, { locale, from: "letters" }),
        confidence,
      });
    }
    for (const related of build.relatedPassageDetails ?? []) {
      pushSuggestion({
        reference: related.referenceLabel || referenceLabel(related.reference, locale),
        text: await passageVerseText(related.reference, locale, related.excerpt),
        reason: "",
        href: related.href,
        confidence,
      });
    }
  } catch {
    // The original card scripture is already available; suggestion expansion must not break a reply link.
  }

  return suggestions.slice(0, MAX_REPLY_SCRIPTURE_SUGGESTIONS);
}

function configuredRecipients() {
  loadLettersEmailEnv();
  const raw = process.env.LETTERS_RECIPIENT_EMAILS || process.env.PONSLINK_ADMIN_EMAILS || "";
  return raw
    .split(/[;,\n]/)
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));
}

function pickEnvRecipient(authorEmailHash: string) {
  const recipients = configuredRecipients().filter((email) => hashValue(email) !== authorEmailHash);
  if (!recipients.length) {
    return null;
  }
  return { email: recipients[Math.floor(Math.random() * recipients.length)], participant: null };
}

function resetParticipantSelectionWindow(participant: LetterParticipant, nowMs: number) {
  const windowStartedAt = participant.selectionWindowStartedAt ? new Date(participant.selectionWindowStartedAt).getTime() : 0;
  if (!windowStartedAt || nowMs - windowStartedAt >= PARTICIPANT_SELECTION_WINDOW_MS) {
    participant.selectionWindowStartedAt = new Date(nowMs).toISOString();
    participant.selectionWindowCount = 0;
  }
}

function isEligibleParticipantRecipient(participant: LetterParticipant, authorEmailHash: string, nowMs: number) {
  if (
    participant.emailHash === authorEmailHash ||
    participant.status !== "active" ||
    !participant.canReceiveLetters ||
    participant.unsubscribedAt ||
    (participant.pausedUntil && new Date(participant.pausedUntil).getTime() > nowMs)
  ) {
    return false;
  }
  const lastSelectedAt = participant.lastSelectedAt ? new Date(participant.lastSelectedAt).getTime() : 0;
  if (lastSelectedAt && nowMs - lastSelectedAt < PARTICIPANT_SELECTION_COOLDOWN_MS) {
    return false;
  }
  const windowStartedAt = participant.selectionWindowStartedAt ? new Date(participant.selectionWindowStartedAt).getTime() : 0;
  const windowCount = !windowStartedAt || nowMs - windowStartedAt >= PARTICIPANT_SELECTION_WINDOW_MS ? 0 : participant.selectionWindowCount;
  return windowCount < (participant.maxLettersPerDay ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW);
}

function eligibleParticipantRecipients(data: LettersData, authorEmail: string | null | undefined, nowMs = Date.now()) {
  const authorEmailHash = authorEmail ? hashValue(authorEmail) : "";
  return data.participants.filter((participant) => isEligibleParticipantRecipient(participant, authorEmailHash, nowMs));
}

function pickRecipient(data: LettersData, authorEmail: string, locale: AppLocale) {
  const nowMs = Date.now();
  const authorEmailHash = hashValue(authorEmail);
  const eligibleParticipants = eligibleParticipantRecipients(data, authorEmail, nowMs);
  const localeMatched = eligibleParticipants.filter((participant) => (participant.preferredLocale ?? "ko") === locale);
  const participants = localeMatched.length ? localeMatched : eligibleParticipants;
  if (participants.length) {
    const participant = participants[Math.floor(Math.random() * participants.length)];
    resetParticipantSelectionWindow(participant, nowMs);
    participant.selectionWindowCount += 1;
    participant.lastSelectedAt = new Date(nowMs).toISOString();
    participant.updatedAt = participant.lastSelectedAt;
    return { email: participant.email, participant };
  }
  if (SYSTEM_CREATOR_EMAIL && hashValue(SYSTEM_CREATOR_EMAIL) !== authorEmailHash) {
    return { email: SYSTEM_CREATOR_EMAIL, participant: null };
  }
  return pickEnvRecipient(authorEmailHash);
}

function publicBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://bible.ponslink.com";
  return configured.replace(/\/$/, "");
}

function makeShareUrl(path: string) {
  return `${publicBaseUrl()}${path}`;
}

function sanitizeCardId(cardId: string) {
  return cardId.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function makeLetterCardImageRoute(cardId: string, locale: AppLocale) {
  const safeCardId = sanitizeCardId(cardId);
  return safeCardId ? `/${locale}/api/letters/card/${safeCardId}/image` : null;
}

export function makeCardPageImageSrc(card: Pick<LetterCard, "id" | "imageUrl">, locale: AppLocale) {
  return card.imageUrl ? makeLetterCardImageRoute(card.id, locale) : null;
}

function makeCardImageSrc(imageUrl: string, locale: AppLocale) {
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  const localizedPath = imageUrl.startsWith("/api/letters/card/") ? `/${locale}${imageUrl}` : imageUrl;
  return localizedPath.startsWith("/") ? makeShareUrl(localizedPath) : imageUrl;
}

function buildLetterEmailHtml(input: {
  card: LetterCard;
  imageUrl?: string;
  ctaUrl: string;
  ctaLabel: string;
  locale: AppLocale;
  eyebrow: string;
  bodyLabel: string;
  privacyHtml?: string;
}) {
  const imageSrc = input.imageUrl ? makeCardImageSrc(input.imageUrl, input.locale) : null;
  const imageHtml = imageSrc
    ? `<tr><td style="padding:0 0 18px 0;"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(input.card.title)}" style="display:block;width:100%;max-width:560px;border:0;border-radius:24px;outline:none;text-decoration:none;" /></td></tr>`
    : "";
  const privacyHtml = input.privacyHtml
    ?? (input.locale === "ko"
      ? "이메일은 서로에게 보이지 않습니다. 모든 편지와 답장은 시스템을 통해서만 전달됩니다."
      : "Email addresses are hidden from each other. Every letter and reply is relayed only through the system.");
  const textFallbackLabel = input.locale === "ko" ? "텍스트로 읽기" : "Read as text";
  const textFallbackIntro = input.locale === "ko"
    ? "이미지가 보이지 않을 때를 위해 같은 내용을 텍스트로 남겨두었습니다."
    : "The same content is included as text in case the image does not load.";
  const ctaHtml = `
              <tr>
                <td align="center" style="padding:24px 26px 28px 26px;">
                  <a href="${escapeHtml(input.ctaUrl)}" style="display:block;border-radius:16px;background:#c79a41;color:#fffaf0;text-decoration:none;padding:15px 22px;font-size:16px;font-weight:900;letter-spacing:-0.01em;">${escapeHtml(input.ctaLabel)}</a>
                  <div style="margin-top:18px;border-top:1px solid #eadcc3;padding-top:14px;font-size:12px;line-height:1.7;color:#786a5a;">${privacyHtml}</div>
                </td>
              </tr>`;
  const fullCardHtml = `
        <tr>
          <td style="overflow:hidden;border:1px solid #dec99d;border-radius:28px;background:#fffaf0;padding:0;box-shadow:0 14px 36px rgba(66,45,19,0.12);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="padding:30px 26px 24px 26px;text-align:center;">
                  <div style="display:inline-block;border:1px solid #d2ac5c;border-radius:999px;background:#c79a41;color:#fffaf0;padding:8px 18px;font-size:13px;font-weight:800;letter-spacing:0.08em;">${escapeHtml(input.card.title)}</div>
                  <div style="margin:22px auto 0 auto;max-width:500px;font-size:24px;line-height:1.55;font-weight:800;color:#271d13;">${escapeHtml(input.card.scripture.text)}</div>
                  <div style="margin:18px auto 0 auto;width:68px;height:1px;background:#d2ac5c;"></div>
                  <div style="margin-top:12px;font-size:14px;line-height:1.5;font-weight:800;color:#8a6425;">${escapeHtml(input.card.scripture.reference)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 26px 24px 26px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:18px;border:1px solid #eadcc3;background:#fffdf8;">
                    <tr>
                      <td style="padding:18px 18px 16px 18px;">
                        <div style="font-size:13px;font-weight:800;color:#8a6425;">${escapeHtml(input.bodyLabel)}</div>
                        <div style="margin-top:8px;font-size:15px;line-height:1.75;color:#4c4032;">${escapeHtml(input.card.summary)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${ctaHtml}
            </table>
          </td>
        </tr>`;
  const imageBackedHtml = `
        ${imageHtml}
        <tr>
          <td style="overflow:hidden;border:1px solid #dec99d;border-radius:24px;background:#fffaf0;padding:0;box-shadow:0 10px 28px rgba(66,45,19,0.10);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;">
              ${ctaHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 4px 0 4px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:18px;border:1px solid #eadcc3;background:#fffdf8;">
              <tr>
                <td style="padding:16px 18px 15px 18px;">
                  <div style="font-size:12px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#8a6425;">${escapeHtml(textFallbackLabel)}</div>
                  <div style="margin-top:6px;font-size:12px;line-height:1.6;color:#786a5a;">${escapeHtml(textFallbackIntro)}</div>
                  <div style="margin-top:12px;font-size:13px;line-height:1.6;font-weight:800;color:#8a6425;">${escapeHtml(input.card.scripture.reference)}</div>
                  <div style="margin-top:6px;font-size:14px;line-height:1.65;color:#4c4032;">${escapeHtml(input.card.scripture.text)}</div>
                  <div style="margin-top:14px;font-size:13px;font-weight:800;color:#8a6425;">${escapeHtml(input.bodyLabel)}</div>
                  <div style="margin-top:6px;font-size:14px;line-height:1.65;color:#4c4032;">${escapeHtml(input.card.summary)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background:#f7f0e3;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#271d13;">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:separate;border-spacing:0;">
        <tr>
          <td style="padding:0 4px 14px 4px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#b18435;">Bible Hyperlink Companion</div>
            <div style="margin-top:8px;font-size:20px;line-height:1.35;font-weight:800;color:#271d13;">${escapeHtml(input.eyebrow)}</div>
          </td>
        </tr>
        ${imageSrc ? imageBackedHtml : fullCardHtml}
      </table>
    </td>
  </tr>
</table>`.trim();
}

function publicCard(card: LetterCard | null | undefined): LetterCard | null {
  if (!card) {
    return null;
  }
  const safeCard = { ...card };
  delete safeCard.generationMetadata;
  return safeCard;
}


function participantNextEligibleAt(participant: LetterParticipant) {
  const nowMs = Date.now();
  const pausedUntilMs = participant.pausedUntil ? new Date(participant.pausedUntil).getTime() : 0;
  const lastSelectedAtMs = participant.lastSelectedAt ? new Date(participant.lastSelectedAt).getTime() : 0;
  const windowStartedAtMs = participant.selectionWindowStartedAt ? new Date(participant.selectionWindowStartedAt).getTime() : 0;
  const candidates = [pausedUntilMs, lastSelectedAtMs ? lastSelectedAtMs + PARTICIPANT_SELECTION_COOLDOWN_MS : 0];
  const limit = participant.maxLettersPerDay ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW;
  if (windowStartedAtMs && nowMs - windowStartedAtMs < PARTICIPANT_SELECTION_WINDOW_MS && participant.selectionWindowCount >= limit) {
    candidates.push(windowStartedAtMs + PARTICIPANT_SELECTION_WINDOW_MS);
  }
  const next = Math.max(...candidates);
  return next > nowMs ? new Date(next).toISOString() : undefined;
}

function publicParticipantStatus(participant: LetterParticipant): PublicLetterParticipantStatus {
  return {
    participantId: participant.id,
    status: participant.status,
    canReceiveLetters: participant.canReceiveLetters,
    nickname: participant.nickname,
    maskedEmail: maskedEmail(participant.email),
    verifiedAt: participant.verifiedAt,
    pausedUntil: participant.pausedUntil,
    preferredLocale: participant.preferredLocale ?? "ko",
    maxLettersPerDay: participant.maxLettersPerDay ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW,
    selectionWindowCount: participant.selectionWindowCount,
    selectionLimitPerDay: participant.maxLettersPerDay ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW,
    nextEligibleAt: participantNextEligibleAt(participant),
  };
}

function participantSessionExpiresAt(nowMs = Date.now()) {
  return new Date(nowMs + PARTICIPANT_SESSION_TTL_MS).toISOString();
}

function isParticipantSessionValid(participant: LetterParticipant, nowMs = Date.now()) {
  return Boolean(
    participant.sessionTokenHash &&
    participant.sessionTokenExpiresAt &&
    new Date(participant.sessionTokenExpiresAt).getTime() > nowMs &&
    participant.status !== "unsubscribed",
  );
}

function settingsPauseUntil(value: unknown) {
  if (value === null || value === false || value === 0 || value === "0" || value === "none" || value === "resume") {
    return null;
  }
  const days = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (days === 7 || days === 30) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  return undefined;
}

function publicGenerationMetadata(metadata: Record<string, unknown> | undefined) {
  return metadata ? { provider: "codex-imagen" } : undefined;
}


function publicBundle(data: LettersData, letter: AnonymousLetter, options: { includePrivateAnswer?: boolean } = {}): PublicLetterBundle {
  const card = data.cards.find((entry) => entry.letterId === letter.id && entry.kind === "question") ?? null;
  const delivery = data.deliveries.find((entry) => entry.letterId === letter.id);
  const answer = data.answers.find((entry) => entry.letterId === letter.id);
  const storedAnswerCard = answer ? data.cards.find((entry) => entry.id === answer.answerCardId) ?? null : null;
  const answerCard = publicCard(storedAnswerCard && (options.includePrivateAnswer || storedAnswerCard.visibility !== "private") ? storedAnswerCard : null);
  const safeLetter: PublicLetterBundle["letter"] = {
    id: letter.id,
    locale: letter.locale,
    category: letter.category,
    body: letter.body,
    authorNickname: letter.authorNickname,
    status: letter.status,
    shareVisibility: letter.shareVisibility,
    safety: letter.safety,
    scripture: options.includePrivateAnswer ? letter.scripture : { reference: "", text: "", reason: "", href: null, confidence: "low" as const },
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  };
  const safeAnswer: PublicLetterBundle["answer"] = answer && answerCard
    ? {
        id: answer.id,
        letterId: answer.letterId,
        responderNickname: answer.responderNickname,
        body: answer.body,
        scripture: answer.scripture,
        answerCardId: answer.answerCardId,
        createdAt: answer.createdAt,
      }
    : undefined;
  return {
    letter: safeLetter,
    card: publicCard(card),
    delivery: delivery ? { status: delivery.status, expiresAt: delivery.expiresAt } : undefined,
    answer: safeAnswer,
    answerCard,
  };
}

export async function requestLetterParticipantOtp(input: {
  email: unknown;
  nickname?: unknown;
  canReceiveLetters?: unknown;
  preferredLocale?: unknown;
  maxLettersPerDay?: unknown;
  locale?: string;
}) {
  const locale = resolveAppLocale(input.locale);
  const email = normalizeEmail(input.email);
  const nickname = normalizeNickname(input.nickname);
  const preferredLocale = normalizePreferredLocale(input.preferredLocale) ?? locale;
  const maxLettersPerDay = normalizeMaxLettersPerDay(input.maxLettersPerDay) ?? PARTICIPANT_SELECTION_MAX_PER_WINDOW;
  if (!email) {
    return { ok: false as const, error: "invalid-email" as const };
  }
  if (nickname === null) {
    return { ok: false as const, error: "contact-info-not-allowed" as const };
  }
  const pendingNickname = nickname ?? randomCuteNickname();

  const otp = createOtp();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + OTP_TTL_MS).toISOString();
  const resendAvailableAt = new Date(nowMs + OTP_RESEND_COOLDOWN_MS).toISOString();
  const emailHash = hashValue(email);
  const reserve = await mutateLettersFile((data) => {
    let participant = data.participants.find((entry) => entry.emailHash === emailHash);
    if (!participant) {
      participant = {
        id: randomUUID(),
        email,
        emailHash,
        nickname: undefined,
        pendingNickname,
        status: "pending",
        canReceiveLetters: false,
        pendingCanReceiveLetters: input.canReceiveLetters === true,
        otpHash: undefined,
        otpExpiresAt: undefined,
        otpRequestedAt: undefined,
        otpRequestWindowStartedAt: now,
        otpRequestCount: 0,
        otpVerifyAttemptCount: 0,
        unsubscribeTokenHash: undefined,
        verifiedAt: undefined,
        pausedUntil: undefined,
        unsubscribedAt: undefined,
        lastSelectedAt: undefined,
        selectionWindowStartedAt: undefined,
        selectionWindowCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      data.participants.unshift(participant);
    }

    const requestedAtMs = participant.otpRequestedAt ? new Date(participant.otpRequestedAt).getTime() : 0;
    if (requestedAtMs && nowMs - requestedAtMs < OTP_RESEND_COOLDOWN_MS) {
      return {
        ok: false as const,
        error: "otp-resend-too-soon" as const,
        retryAfter: new Date(requestedAtMs + OTP_RESEND_COOLDOWN_MS).toISOString(),
        participant: publicParticipantStatus(participant),
      };
    }
    const windowStartedAtMs = participant.otpRequestWindowStartedAt ? new Date(participant.otpRequestWindowStartedAt).getTime() : 0;
    if (!windowStartedAtMs || nowMs - windowStartedAtMs >= OTP_REQUEST_WINDOW_MS) {
      participant.otpRequestWindowStartedAt = now;
      participant.otpRequestCount = 0;
    }
    if (participant.otpRequestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
      const retryAfterMs = new Date(participant.otpRequestWindowStartedAt ?? now).getTime() + OTP_REQUEST_WINDOW_MS;
      return {
        ok: false as const,
        error: "otp-request-limit" as const,
        retryAfter: new Date(retryAfterMs).toISOString(),
        participant: publicParticipantStatus(participant),
      };
    }

    participant.email = email;
    participant.pendingNickname = pendingNickname;
    participant.pendingCanReceiveLetters = input.canReceiveLetters === true;
    participant.pendingPreferredLocale = preferredLocale;
    participant.maxLettersPerDay = maxLettersPerDay;
    participant.otpHash = otpHash(email, otp);
    participant.otpExpiresAt = expiresAt;
    participant.otpRequestedAt = now;
    participant.otpRequestCount += 1;
    participant.otpVerifyAttemptCount = 0;
    participant.updatedAt = now;
    return {
      ok: true as const,
      participantId: participant.id,
      participant: publicParticipantStatus(participant),
      remainingRequests: Math.max(0, OTP_MAX_REQUESTS_PER_WINDOW - participant.otpRequestCount),
    };
  });

  if (!reserve.ok) {
    return reserve;
  }

  const emailResult = await sendSystemEmail({
    to: email,
    subject: locale === "ko" ? "말씀편지 인증번호" : "Your Scripture letter verification code",
    text: locale === "ko"
      ? `말씀편지 인증번호는 ${otp} 입니다. ${Math.round(OTP_TTL_MS / 60000)}분 안에 입력해 주세요.`
      : `Your Scripture letter verification code is ${otp}. Enter it within ${Math.round(OTP_TTL_MS / 60000)} minutes.`,
    html: locale === "ko"
      ? `<p>말씀편지 인증번호는 <strong>${otp}</strong> 입니다.</p><p>${Math.round(OTP_TTL_MS / 60000)}분 안에 입력해 주세요.</p>`
      : `<p>Your Scripture letter verification code is <strong>${otp}</strong>.</p><p>Enter it within ${Math.round(OTP_TTL_MS / 60000)} minutes.</p>`,
  });
  if (!emailResult.ok) {
    await mutateLettersFile((data) => {
      const participant = data.participants.find((entry) => entry.id === reserve.participantId);
      if (!participant || participant.otpHash !== otpHash(email, otp)) {
        return;
      }
      participant.otpHash = undefined;
      participant.otpExpiresAt = undefined;
      participant.otpVerifyAttemptCount = 0;
      participant.updatedAt = new Date().toISOString();
    });
    return { ok: false as const, error: "email-failed" as const };
  }

  return {
    ok: true as const,
    participant: reserve.participant,
    otp: {
      expiresAt,
      resendAvailableAt,
      remainingRequests: reserve.remainingRequests,
    },
  };
}

export async function verifyLetterParticipantOtp(input: { email: unknown; otp: unknown }) {
  const email = normalizeEmail(input.email);
  const otp = normalizeOtp(input.otp);
  if (!email) {
    return { ok: false as const, error: "invalid-email" as const };
  }
  if (!otp) {
    return { ok: false as const, error: "invalid-otp" as const };
  }

  const emailHash = hashValue(email);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const unsubscribeToken = createToken();
  const sessionToken = createToken();
  const sessionTokenExpiresAt = participantSessionExpiresAt(nowMs);
  return mutateLettersFile((data) => {
    const participant = data.participants.find((entry) => entry.emailHash === emailHash);
    if (!participant || !participant.otpHash || !participant.otpExpiresAt) {
      return { ok: false as const, error: "otp-not-requested" as const };
    }
    if (new Date(participant.otpExpiresAt).getTime() < nowMs) {
      participant.otpHash = undefined;
      participant.otpExpiresAt = undefined;
      participant.otpVerifyAttemptCount = 0;
      participant.updatedAt = now;
      return { ok: false as const, error: "otp-expired" as const, participant: publicParticipantStatus(participant) };
    }
    if (participant.otpVerifyAttemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
      participant.otpHash = undefined;
      participant.otpExpiresAt = undefined;
      participant.updatedAt = now;
      return { ok: false as const, error: "otp-attempt-limit" as const, participant: publicParticipantStatus(participant) };
    }
    if (participant.otpHash !== otpHash(email, otp)) {
      participant.otpVerifyAttemptCount += 1;
      participant.updatedAt = now;
      const remainingAttempts = Math.max(0, OTP_MAX_VERIFY_ATTEMPTS - participant.otpVerifyAttemptCount);
      if (remainingAttempts === 0) {
        participant.otpHash = undefined;
        participant.otpExpiresAt = undefined;
      }
      return {
        ok: false as const,
        error: "invalid-otp" as const,
        remainingAttempts,
        participant: publicParticipantStatus(participant),
      };
    }

    participant.email = email;
    participant.nickname = participant.pendingNickname;
    participant.pendingNickname = undefined;
    participant.canReceiveLetters = participant.pendingCanReceiveLetters === true;
    participant.pendingCanReceiveLetters = undefined;
    participant.preferredLocale = participant.pendingPreferredLocale ?? participant.preferredLocale ?? "ko";
    participant.pendingPreferredLocale = undefined;
    participant.status = "active";
    participant.verifiedAt = now;
    participant.pausedUntil = undefined;
    participant.unsubscribedAt = undefined;
    participant.unsubscribeTokenHash = tokenHash(unsubscribeToken);
    participant.sessionTokenHash = tokenHash(sessionToken);
    participant.sessionTokenExpiresAt = sessionTokenExpiresAt;
    participant.otpHash = undefined;
    participant.otpExpiresAt = undefined;
    participant.otpVerifyAttemptCount = 0;
    participant.updatedAt = now;
    return { ok: true as const, participant: publicParticipantStatus(participant), sessionToken, sessionTokenExpiresAt };
  });
}

export async function getRelayAvailability(authorEmail: string | null | undefined) {
  const email = normalizeEmail(authorEmail);
  const data = await readLettersFile();
  const nowMs = Date.now();
  const eligibleCount = eligibleParticipantRecipients(data, email, nowMs).length;
  const activeReceiverCount = eligibleParticipantRecipients(data, null, nowMs).length;
  return {
    eligibleCount,
    activeReceiverCount,
    hasEligibleHumanRelay: eligibleCount > 0,
    usesMasterFallback: eligibleCount === 0 && Boolean(SYSTEM_CREATOR_EMAIL && (!email || hashValue(SYSTEM_CREATOR_EMAIL) !== hashValue(email))),
  };
}

export async function getLetterParticipantSession(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return null;
  }
  const sessionTokenHash = tokenHash(sessionToken);
  const data = await readLettersFile();
  const participant = data.participants.find((entry) => entry.sessionTokenHash === sessionTokenHash);
  if (!participant || !isParticipantSessionValid(participant)) {
    return null;
  }
  return publicParticipantStatus(participant);
}

export async function getLetterParticipantAuthor(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return null;
  }
  const sessionTokenHash = tokenHash(sessionToken);
  const data = await readLettersFile();
  const participant = data.participants.find((entry) => entry.sessionTokenHash === sessionTokenHash);
  if (!participant || !isParticipantSessionValid(participant)) {
    return null;
  }
  return {
    email: participant.email,
    nickname: participant.nickname,
    participant: publicParticipantStatus(participant),
  };
}

export async function updateLetterParticipantSettings(input: {
  sessionToken: string | null | undefined;
  canReceiveLetters?: unknown;
  nickname?: unknown;
  pauseDays?: unknown;
  preferredLocale?: unknown;
  maxLettersPerDay?: unknown;
}) {
  if (!input.sessionToken) {
    return { ok: false as const, error: "not-authenticated" as const };
  }
  const nickname = input.nickname === undefined ? undefined : normalizeNickname(input.nickname);
  const nicknameWasProvided = input.nickname !== undefined;
  if (nickname === null) {
    return { ok: false as const, error: "contact-info-not-allowed" as const };
  }
  const pauseUntil = settingsPauseUntil(input.pauseDays);
  const preferredLocale = input.preferredLocale === undefined ? undefined : normalizePreferredLocale(input.preferredLocale);
  const maxLettersPerDay = input.maxLettersPerDay === undefined ? undefined : normalizeMaxLettersPerDay(input.maxLettersPerDay);
  const sessionTokenHash = tokenHash(input.sessionToken);
  return mutateLettersFile((data) => {
    const participant = data.participants.find((entry) => entry.sessionTokenHash === sessionTokenHash);
    if (!participant || !isParticipantSessionValid(participant)) {
      return { ok: false as const, error: "not-authenticated" as const };
    }
    if (input.canReceiveLetters !== undefined) {
      participant.canReceiveLetters = input.canReceiveLetters === true;
    }
    if (nicknameWasProvided) {
      participant.nickname = nickname ?? randomCuteNickname();
    }
    if (preferredLocale) {
      participant.preferredLocale = preferredLocale;
    }
    if (maxLettersPerDay !== undefined) {
      participant.maxLettersPerDay = maxLettersPerDay;
    }
    if (pauseUntil !== undefined) {
      participant.pausedUntil = pauseUntil ?? undefined;
      participant.status = pauseUntil ? "paused" : "active";
    } else if (participant.status === "paused" && (!participant.pausedUntil || new Date(participant.pausedUntil).getTime() <= Date.now())) {
      participant.status = "active";
      participant.pausedUntil = undefined;
    }
    participant.updatedAt = new Date().toISOString();
    return { ok: true as const, participant: publicParticipantStatus(participant) };
  });
}

export async function unsubscribeLetterParticipant(input: { sessionToken?: string | null; token?: string | null }) {
  const sessionTokenHash = input.sessionToken ? tokenHash(input.sessionToken) : null;
  const unsubscribeTokenHash = input.token ? tokenHash(input.token) : null;
  if (!sessionTokenHash && !unsubscribeTokenHash) {
    return { ok: false as const, error: "not-authenticated" as const };
  }
  return mutateLettersFile((data) => {
    const participant = data.participants.find((entry) =>
      Boolean(
        (sessionTokenHash && entry.sessionTokenHash === sessionTokenHash && isParticipantSessionValid(entry)) ||
        (unsubscribeTokenHash && entry.unsubscribeTokenHash === unsubscribeTokenHash),
      ),
    );
    if (!participant) {
      return { ok: false as const, error: "invalid-token" as const };
    }
    const now = new Date().toISOString();
    participant.status = "unsubscribed";
    participant.canReceiveLetters = false;
    participant.pausedUntil = undefined;
    participant.unsubscribedAt = now;
    participant.sessionTokenHash = undefined;
    participant.sessionTokenExpiresAt = undefined;
    participant.updatedAt = now;
    return { ok: true as const, participant: publicParticipantStatus(participant) };
  });
}


export type PublicLetterHistory = {
  participant: PublicLetterParticipantStatus;
  authored: PublicLetterBundle[];
  received: PublicLetterBundle[];
};

export async function getLetterParticipantHistory(sessionToken: string | null | undefined): Promise<PublicLetterHistory | null> {
  if (!sessionToken) {
    return null;
  }
  const sessionTokenHash = tokenHash(sessionToken);
  const data = await readLettersFile();
  const participant = data.participants.find((entry) => entry.sessionTokenHash === sessionTokenHash);
  if (!participant || !isParticipantSessionValid(participant)) {
    return null;
  }
  const authored = data.letters
    .filter((letter) => letter.authorEmailHash === participant.emailHash)
    .slice(0, 50)
    .map((letter) => publicBundle(data, letter, { includePrivateAnswer: true }));
  const receivedLetterIds = new Set(data.deliveries.filter((delivery) => delivery.participantId === participant.id).map((delivery) => delivery.letterId));
  const received = data.letters
    .filter((letter) => receivedLetterIds.has(letter.id))
    .slice(0, 50)
    .map((letter) => publicBundle(data, letter, { includePrivateAnswer: true }));
  return { participant: publicParticipantStatus(participant), authored, received };
}

export type AdminLetterModerationData = {
  totals: {
    letters: number;
    sent: number;
    blocked: number;
    answers: number;
    reports: number;
    activeParticipants: number;
  };
  letters: Array<Pick<AnonymousLetter, "id" | "locale" | "category" | "status" | "shareVisibility" | "createdAt" | "updatedAt"> & { body: string; scriptureReference: string; cardStatus?: GenerationStatus }>;
  participants: PublicLetterParticipantStatus[];
  deliveries: Array<Pick<LetterDelivery, "id" | "letterId" | "status" | "participantId" | "sentAt" | "expiresAt"> & { maskedRecipientEmail: string }>;
  reports: LetterReport[];
};

export async function getAdminLetterModerationData(limit = 50): Promise<AdminLetterModerationData> {
  const data = await readLettersFile();
  return {
    totals: {
      letters: data.letters.length,
      sent: data.letters.filter((letter) => letter.status === "sent" || letter.status === "answered").length,
      blocked: data.letters.filter((letter) => letter.status === "blocked").length,
      answers: data.answers.length,
      reports: data.reports.length,
      activeParticipants: data.participants.filter((participant) => participant.status === "active" && participant.canReceiveLetters).length,
    },
    letters: data.letters.slice(0, limit).map((letter) => ({
      id: letter.id,
      locale: letter.locale,
      category: letter.category,
      status: letter.status,
      shareVisibility: letter.shareVisibility,
      body: sanitizeExcerpt(letter.body, 240),
      scriptureReference: letter.scripture.reference,
      cardStatus: data.cards.find((card) => card.letterId === letter.id && card.kind === "question")?.generationStatus,
      createdAt: letter.createdAt,
      updatedAt: letter.updatedAt,
    })),
    participants: data.participants.slice(0, limit).map((participant) => publicParticipantStatus(participant)),
    deliveries: data.deliveries.slice(0, limit).map((delivery) => ({
      id: delivery.id,
      letterId: delivery.letterId,
      status: delivery.status,
      participantId: delivery.participantId,
      maskedRecipientEmail: maskedEmail(delivery.recipientEmail),
      sentAt: delivery.sentAt,
      expiresAt: delivery.expiresAt,
    })),
    reports: data.reports.slice(0, limit),
  };
}

export async function acceptRelayParticipation(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return { ok: false as const, error: "not-authenticated" as const };
  }
  const sessionTokenHash = tokenHash(sessionToken);
  return mutateLettersFile((data) => {
    const participant = data.participants.find((entry) => entry.sessionTokenHash === sessionTokenHash);
    if (!participant || !isParticipantSessionValid(participant)) {
      return { ok: false as const, error: "not-authenticated" as const };
    }
    participant.canReceiveLetters = true;
    participant.updatedAt = new Date().toISOString();
    return { ok: true as const, participant: publicParticipantStatus(participant) };
  });
}

export async function getRelayRunnerLetter(token: string) {
  const hash = tokenHash(token);
  const data = await readLettersFile();
  const delivery = data.deliveries.find((entry) => entry.replyTokenHash === hash);
  if (!delivery) {
    return null;
  }
  const letter = data.letters.find((entry) => entry.id === delivery.letterId);
  if (!letter) {
    return null;
  }
  return {
    letter: {
      id: letter.id,
      locale: letter.locale,
      category: letter.category,
      body: letter.body,
      authorNickname: letter.authorNickname,
      scripture: letter.scripture,
      createdAt: letter.createdAt,
    },
    card: data.cards.find((entry) => entry.letterId === letter.id && entry.kind === "question") ?? null,
  };
}

export async function getLetterBundle(id: string) {
  const data = await readLettersFile();
  const letter = data.letters.find((entry) => entry.id === id);
  return letter ? publicBundle(data, letter) : null;
}

export async function getCardBundle(cardId: string) {
  const data = await readLettersFile();
  const card = data.cards.find((entry) => entry.id === cardId || (entry.kind === "question" && entry.letterId === cardId));
  if (!card || card.visibility === "private") {
    return null;
  }
  const letter = data.letters.find((entry) => entry.id === card.letterId);
  return letter ? { ...publicBundle(data, letter), card: publicCard(card), requestedCard: publicCard(card) ?? undefined } : null;
}

export async function getStoredCardImageUrl(cardId: string) {
  const safeCardId = sanitizeCardId(cardId);
  if (!safeCardId) {
    return null;
  }
  const data = await readLettersFile();
  const card = data.cards.find((entry) => entry.id === safeCardId);
  return typeof card?.imageUrl === "string" && card.imageUrl.length > 0 ? card.imageUrl : null;
}

export async function getReplyBundle(token: string) {
  const hash = tokenHash(token);
  const data = await readLettersFile();
  const delivery = data.deliveries.find((entry) => entry.replyTokenHash === hash);
  if (!delivery || delivery.status === "expired") {
    return null;
  }
  const letter = data.letters.find((entry) => entry.id === delivery.letterId);
  if (!letter) {
    return null;
  }
  const bundle = publicBundle(data, letter, { includePrivateAnswer: true });
  const scriptureRecommendations = await buildReplyScriptureSuggestions(letter, letter.locale);
  return { ...bundle, delivery: { status: delivery.status, expiresAt: delivery.expiresAt }, scriptureRecommendations };
}

export async function getAnswerBundle(token: string) {
  const hash = tokenHash(token);
  const data = await readLettersFile();
  const answer = data.answers.find((entry) => entry.readTokenHash === hash);
  if (!answer) {
    return null;
  }
  const letter = data.letters.find((entry) => entry.id === answer.letterId);
  if (!letter) {
    return null;
  }
  return publicBundle(data, letter, { includePrivateAnswer: true });
}

async function scheduleLetterDispatch(work: () => Promise<void>, scheduler?: (work: () => Promise<void>) => void) {
  const guardedWork = async () => {
    try {
      await work();
    } catch (error) {
      console.error("Letter dispatch background task failed", error);
    }
  };
  if (scheduler) {
    scheduler(guardedWork);
    return;
  }
  await guardedWork();
}

export async function createAnonymousLetter(input: {
  locale?: string;
  category?: unknown;
  body: unknown;
  authorEmail: unknown;
  authorNickname?: unknown;
  shareVisibility?: unknown;
  acceptLanguage?: string;
  countryCode?: string;
  scheduleDispatch?: (work: () => Promise<void>) => void;
}) {
  const locale = resolveLetterRequestLocale(input);
  const body = normalizeBody(input.body);
  const authorEmail = normalizeEmail(input.authorEmail);
  const authorNickname = normalizeNickname(input.authorNickname);
  if (!body) {
    return { ok: false as const, error: "invalid-body" as const };
  }
  if (!authorEmail) {
    return { ok: false as const, error: "invalid-email" as const };
  }
  if (authorNickname === null || CONTACT_PATTERN.test(body)) {
    return { ok: false as const, error: "contact-info-not-allowed" as const };
  }
  const storedAuthorNickname = authorNickname ?? randomCuteNickname();

  const category = normalizeCategory(input.category);
  const shareVisibility = normalizeVisibility(input.shareVisibility);
  const { scripture, safety } = await buildScriptureSuggestion(body, locale, {
    acceptLanguage: input.acceptLanguage,
    countryCode: input.countryCode,
  });
  const visualTheme = inferVisualTheme(body, scripture, locale);
  const now = new Date().toISOString();
  const letter: AnonymousLetter = {
    id: randomUUID(),
    locale,
    category,
    body,
    authorEmail,
    authorEmailHash: hashValue(authorEmail),
    authorNickname: storedAuthorNickname,
    status: safety.level === "crisis" ? "blocked" : "created",
    shareVisibility,
    safety,
    scripture,
    createdAt: now,
    updatedAt: now,
  };
  const cardId = randomUUID();
  const card: LetterCard = {
    id: cardId,
    letterId: letter.id,
    kind: "question",
    title: locale === "ko" ? `익명의 ${categoryLabel(category, locale)}` : `Anonymous ${categoryLabel(category, locale)}`,
    summary: sanitizeExcerpt(body),
    scripture,
    visualTheme,
    shareUrl: makeShareUrl(`/${locale}/letters/card/${cardId}`),
    generationProvider: "codex-imagen",
    generationStatus: "skipped",
    visibility: shareVisibility,
    createdAt: now,
  };

  const replyToken = createToken();
  const deliveryReservation = await mutateLettersFile((data) => {
    data.letters.unshift(letter);
    data.cards.unshift(card);
    if (safety.level === "crisis") {
      return null;
    }
    const recipient = pickRecipient(data, authorEmail, locale);
    if (!recipient) {
      return null;
    }
    const unsubscribeToken = recipient.participant ? createToken() : null;
    if (recipient.participant && unsubscribeToken) {
      recipient.participant.unsubscribeTokenHash = tokenHash(unsubscribeToken);
      recipient.participant.updatedAt = new Date().toISOString();
    }
    const reservedDelivery: LetterDelivery = {
      id: randomUUID(),
      letterId: letter.id,
      recipientEmail: recipient.email,
      recipientEmailHash: hashValue(recipient.email),
      participantId: recipient.participant?.id,
      status: "skipped",
      replyTokenHash: tokenHash(replyToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };
    data.deliveries.unshift(reservedDelivery);
    letter.status = "matched";
    return { delivery: reservedDelivery, recipientEmail: recipient.email, unsubscribeToken };
  });

  if (deliveryReservation) {
    await scheduleLetterDispatch(async () => {
      const { delivery, recipientEmail, unsubscribeToken } = deliveryReservation;
      const deliveryId = delivery.id;
      const replyUrl = makeShareUrl(`/${locale}/letters/reply/${replyToken}`);
      const unsubscribeUrl = unsubscribeToken ? makeShareUrl(`/${locale}/letters/unsubscribe/${unsubscribeToken}`) : null;
      const footerText = unsubscribeUrl
        ? (locale === "ko" ? `\n\n수신을 중단하려면: ${unsubscribeUrl}` : `\n\nStop receiving letters: ${unsubscribeUrl}`)
        : "";
      const email = await sendSystemEmail({
        to: recipientEmail,
        subject: locale === "ko" ? "익명의 말씀편지가 도착했습니다" : "An anonymous Scripture letter arrived",
        text: `${card.title}\n\n${card.summary}\n\n${scripture.reference}\n${scripture.text}\n\n${replyUrl}${footerText}`,
        html: buildLetterEmailHtml({
          card,
          ctaUrl: replyUrl,
          ctaLabel: locale === "ko" ? "답변과 성구 보내기" : "Send a reply and Scripture",
          locale,
          eyebrow: locale === "ko" ? "익명의 말씀편지가 도착했습니다" : "An anonymous Scripture letter arrived",
          bodyLabel: locale === "ko" ? "보낸 마음" : "Letter excerpt",
          privacyHtml: `${locale === "ko" ? "이메일은 서로에게 보이지 않습니다. 모든 편지와 답장은 시스템을 통해서만 전달됩니다." : "Email addresses are hidden from each other. Every letter and reply is relayed only through the system."}${unsubscribeUrl ? `<br /><br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a6425;font-weight:800;text-decoration:underline;">${locale === "ko" ? "말씀편지 수신 중단" : "Stop receiving Scripture letters"}</a>` : ""}`,
        }),
      });
      await mutateLettersFile((data) => {
        const storedLetter = data.letters.find((entry) => entry.id === letter.id);
        const storedDelivery = data.deliveries.find((entry) => entry.id === deliveryId);
        if (storedLetter) {
          storedLetter.status = email.ok ? "sent" : "matched";
          storedLetter.updatedAt = new Date().toISOString();
        }
        if (storedDelivery) {
          storedDelivery.status = email.ok ? "sent" : "skipped";
          storedDelivery.sentAt = email.ok ? new Date().toISOString() : undefined;
        }
      });
    }, input.scheduleDispatch);
  }


  return { ok: true as const, bundle: await getLetterBundle(letter.id), replyToken: process.env.NODE_ENV === "test" ? replyToken : undefined };
}

export async function createLetterAnswer(input: {
  token: string;
  locale?: string;
  responderNickname?: unknown;
  body: unknown;
  scriptureRef?: unknown;
  acceptLanguage?: string;
  countryCode?: string;
  scheduleDispatch?: (work: () => Promise<void>) => void;
}) {
  const answerBody = normalizeBody(input.body, 8, MAX_ANSWER_LENGTH);
  const responderNickname = normalizeNickname(input.responderNickname);
  if (!answerBody) {
    return { ok: false as const, error: "invalid-body" as const };
  }
  if (responderNickname === null || CONTACT_PATTERN.test(answerBody)) {
    return { ok: false as const, error: "contact-info-not-allowed" as const };
  }
  const storedResponderNickname = responderNickname ?? randomCuteNickname();

  const hash = tokenHash(input.token);
  const data = await readLettersFile();
  const delivery = data.deliveries.find((entry) => entry.replyTokenHash === hash);
  if (!delivery) {
    return { ok: false as const, error: "invalid-token" as const };
  }
  if (delivery.status === "answered" || delivery.status === "opened") {
    return { ok: false as const, error: "already-answered" as const };
  }
  if (new Date(delivery.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "expired-token" as const };
  }
  const letter = data.letters.find((entry) => entry.id === delivery.letterId);
  if (!letter) {
    return { ok: false as const, error: "missing-letter" as const };
  }

  const locale = resolveLetterRequestLocale({ locale: input.locale ?? letter.locale, acceptLanguage: input.acceptLanguage, countryCode: input.countryCode });
  const requestedScriptureRef = normalizeScriptureReference(input.scriptureRef);
  if (requestedScriptureRef === null) {
    return { ok: false as const, error: "contact-info-not-allowed" as const };
  }
  const selectedScripture = requestedScriptureRef
    ? { ...letter.scripture, reference: requestedScriptureRef, href: null }
    : (await buildScriptureSuggestion(`${letter.body}\n\n${answerBody}`, locale, { acceptLanguage: input.acceptLanguage, countryCode: input.countryCode })).scripture;
  const visualTheme = inferVisualTheme(answerBody, selectedScripture, locale);
  const readToken = createToken();
  const now = new Date().toISOString();
  const answerId = randomUUID();
  const answerCardId = randomUUID();
  const answerCard: LetterCard = {
    id: answerCardId,
    letterId: letter.id,
    answerId,
    kind: "answer",
    title: locale === "ko" ? "익명의 답장" : "Anonymous reply",
    summary: sanitizeExcerpt(answerBody),
    scripture: selectedScripture,
    visualTheme,
    shareUrl: makeShareUrl(`/${locale}/letters/card/${answerCardId}`),
    generationProvider: "codex-imagen",
    generationStatus: "pending",
    visibility: letter.shareVisibility,
    createdAt: now,
  };
  const answer: LetterAnswer = {
    id: answerId,
    letterId: letter.id,
    deliveryId: delivery.id,
    responderNickname: storedResponderNickname,
    body: answerBody,
    scripture: selectedScripture,
    answerCardId: answerCard.id,
    readTokenHash: tokenHash(readToken),
    createdAt: now,
  };

  const reserveResult = await mutateLettersFile((draft) => {
    const storedDelivery = draft.deliveries.find((entry) => entry.replyTokenHash === hash);
    if (!storedDelivery) {
      return { ok: false as const, error: "invalid-token" as const };
    }
    if (storedDelivery.status === "answered" || storedDelivery.status === "opened") {
      return { ok: false as const, error: "already-answered" as const };
    }
    if (new Date(storedDelivery.expiresAt).getTime() < Date.now()) {
      storedDelivery.status = "expired";
      return { ok: false as const, error: "expired-token" as const };
    }
    const storedLetter = draft.letters.find((entry) => entry.id === storedDelivery.letterId);
    if (!storedLetter) {
      return { ok: false as const, error: "missing-letter" as const };
    }
    storedDelivery.status = "opened";
    storedLetter.updatedAt = now;
    draft.answers.unshift(answer);
    draft.cards.unshift(answerCard);
    return { ok: true as const, previousStatus: delivery.status };
  });
  if (!reserveResult.ok) {
    return reserveResult;
  }
  const answerUrl = makeShareUrl(`/${locale}/letters/answer/${readToken}`);
  await scheduleLetterDispatch(async () => {
    const imageResult = await queueCardImageGeneration(answerCard, { body: answerBody, locale });
    await updateCardGeneration(answerCard.id, imageResult);
    const email = await sendSystemEmail({
      to: letter.authorEmail,
      subject: locale === "ko" ? "익명의 답장이 도착했습니다" : "Your anonymous reply arrived",
      text: `${answerCard.title}\n\n${answerCard.summary}\n\n${selectedScripture.reference}\n\n${answerUrl}`,
      html: buildLetterEmailHtml({
        card: answerCard,
        imageUrl: imageResult.imageUrl,
        ctaUrl: answerUrl,
        ctaLabel: locale === "ko" ? "답변 카드 보기" : "View answer card",
        locale,
        eyebrow: locale === "ko" ? "익명의 답장이 도착했습니다" : "Your anonymous reply arrived",
        bodyLabel: locale === "ko" ? "도착한 답장" : "Reply excerpt",
      }),
    });
    await mutateLettersFile((draft) => {
      const storedLetter = draft.letters.find((entry) => entry.id === letter.id);
      const storedDelivery = draft.deliveries.find((entry) => entry.replyTokenHash === hash);
      if (storedLetter) {
        storedLetter.status = email.ok ? "answered" : "matched";
        storedLetter.updatedAt = now;
      }
      if (storedDelivery && storedDelivery.status === "opened") {
        storedDelivery.status = email.ok ? "answered" : reserveResult.previousStatus;
      }
    });
  }, input.scheduleDispatch);


  return { ok: true as const, answer, answerCard, readToken };
}

export async function suggestReplyScriptures(token: string) {
  const hash = tokenHash(token);
  const data = await readLettersFile();
  const delivery = data.deliveries.find((entry) => entry.replyTokenHash === hash);
  if (!delivery) {
    return { ok: false as const, error: "invalid-token" as const };
  }
  const letter = data.letters.find((entry) => entry.id === delivery.letterId);
  if (!letter) {
    return { ok: false as const, error: "invalid-token" as const };
  }
  return { ok: true as const, suggestions: await buildReplyScriptureSuggestions(letter, letter.locale) };
}

export async function updateCardVisibility(cardId: string, visibility: LetterVisibility) {
  return mutateLettersFile((data) => {
    const card = data.cards.find((entry) => entry.id === cardId || entry.letterId === cardId);
    if (!card) {
      return { ok: false as const, error: "missing-card" as const };
    }
    card.visibility = visibility;
    return { ok: true as const, card };
  });
}

export async function updateCardGeneration(cardId: string, result: { status: GenerationStatus; imageUrl?: string; metadata?: Record<string, unknown> }) {
  return mutateLettersFile((data) => {
    const card = data.cards.find((entry) => entry.id === cardId);
    if (card) {
      card.generationStatus = result.status;
      card.imageUrl = result.imageUrl ?? card.imageUrl;
      card.generationMetadata = publicGenerationMetadata(result.metadata);
    }
  });
}

export async function reportLetterTarget(input: { targetType: unknown; targetId: unknown; reason: unknown }) {
  if ((input.targetType !== "letter" && input.targetType !== "answer") || typeof input.targetId !== "string") {
    return { ok: false as const, error: "invalid-target" as const };
  }
  const reason = normalizeBody(input.reason, 3, 400);
  if (!reason) {
    return { ok: false as const, error: "invalid-reason" as const };
  }
  const report: LetterReport = { id: randomUUID(), targetType: input.targetType, targetId: input.targetId, reason, createdAt: new Date().toISOString() };
  await mutateLettersFile((data) => {
    data.reports.unshift(report);
  });
  return { ok: true as const, report };
}

export function letterCategoryLabel(category: LetterCategory, locale: AppLocale) {
  return categoryLabel(category, locale);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
