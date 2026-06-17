import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveAppLocale, type AppLocale } from "@/lib/content";

export type AnonymousReview = {
  id: string;
  locale: AppLocale;
  body: string;
  createdAt: string;
};

const MAX_REVIEW_LENGTH = 1200;
const MAX_STORED_REVIEWS = 2000;
const DEFAULT_REVIEW_PATH = join(process.cwd(), ".data", "reviews.json");
const REVIEW_PATH = process.env.REVIEWS_DATA_FILE || DEFAULT_REVIEW_PATH;
let writeQueue = Promise.resolve();

function normalizeReviewBody(body: unknown) {
  if (typeof body !== "string") {
    return null;
  }

  const normalized = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length < 10 || normalized.length > MAX_REVIEW_LENGTH) {
    return null;
  }

  return normalized;
}

function isReview(value: unknown): value is AnonymousReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    (candidate.locale === "en" || candidate.locale === "ko") &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string"
  );
}

async function readReviewsFile() {
  try {
    const raw = await readFile(REVIEW_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isReview) : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeReviewsFile(reviews: AnonymousReview[]) {
  await mkdir(dirname(REVIEW_PATH), { recursive: true });
  const tmpPath = `${REVIEW_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(reviews, null, 2)}\n`, "utf8");
  await rename(tmpPath, REVIEW_PATH);
}

export async function listAnonymousReviews(locale?: string, limit = 50) {
  const appLocale = resolveAppLocale(locale);
  const reviews = await readReviewsFile();
  return reviews
    .filter((review) => review.locale === appLocale)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function createAnonymousReview({
  locale,
  body,
}: {
  locale?: string;
  body: unknown;
}) {
  const normalizedBody = normalizeReviewBody(body);
  if (!normalizedBody) {
    return { ok: false as const, error: "invalid-body" as const };
  }

  const appLocale = resolveAppLocale(locale);
  const review: AnonymousReview = {
    id: randomUUID(),
    locale: appLocale,
    body: normalizedBody,
    createdAt: new Date().toISOString(),
  };

  writeQueue = writeQueue.then(async () => {
    const reviews = await readReviewsFile();
    reviews.unshift(review);
    await writeReviewsFile(reviews.slice(0, MAX_STORED_REVIEWS));
  });

  await writeQueue;
  return { ok: true as const, review };
}
