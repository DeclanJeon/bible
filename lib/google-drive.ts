import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const DEFAULT_DRIVE_FOLDER_ID = "1MsLyYIsnAH93ZvPokzie784BuBqj4PE7";
const DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type ServiceAccount = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

type DriveUploadResult =
  | { ok: true; fileId: string; imageUrl: string }
  | { ok: false; error: string };

type UploadLetterCardImageInput = {
  localPath: string;
  fileName: string;
  folderId?: string;
  mimeType?: string;
};

let tokenCache: { accessToken: string; expiresAtMs: number } | null = null;

export function letterCardDriveFolderId() {
  return process.env.LETTERS_CARD_IMAGE_DRIVE_FOLDER_ID || process.env.LETTERS_GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
}

function decodeServiceAccountJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function serviceAccountFromEnv(): ServiceAccount | null {
  const json = process.env.LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = decodeServiceAccountJson(json);
    const clientEmail = parsed?.client_email;
    const privateKey = parsed?.private_key;
    const tokenUri = parsed?.token_uri;
    if (typeof clientEmail === "string" && typeof privateKey === "string") {
      return {
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        tokenUri: typeof tokenUri === "string" ? tokenUri : DRIVE_TOKEN_URL,
      };
    }
  }

  const clientEmail = process.env.LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.LETTERS_GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    return null;
  }
  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    tokenUri: DRIVE_TOKEN_URL,
  };
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(serviceAccount: ServiceAccount) {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.clientEmail,
    scope: DRIVE_SCOPE,
    aud: serviceAccount.tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${base64Url(signer.sign(serviceAccount.privateKey))}`;

  const response = await fetch(serviceAccount.tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Drive token request failed: ${response.status} ${text.slice(0, 200)}`);
  }
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Google Drive token response did not include access_token");
  }
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

function multipartBody(metadata: Record<string, unknown>, fileBuffer: Buffer, mimeType: string, boundary: string) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

function publicDriveImageUrl(fileId: string) {
  const template = process.env.LETTERS_GOOGLE_DRIVE_PUBLIC_URL_TEMPLATE;
  if (template) {
    return template.replace(/\{fileId\}/g, encodeURIComponent(fileId));
  }
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

export async function uploadLetterCardImage(input: UploadLetterCardImageInput): Promise<DriveUploadResult> {
  const serviceAccount = serviceAccountFromEnv();
  if (!serviceAccount) {
    return { ok: false, error: "Google Drive service account env is not configured" };
  }

  try {
    const folderId = input.folderId || letterCardDriveFolderId();
    const mimeType = input.mimeType || "image/png";
    const accessToken = await getAccessToken(serviceAccount);
    const fileBuffer = await readFile(input.localPath);
    const boundary = `bible-letter-card-${Date.now().toString(36)}`;
    const uploadResponse = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody({ name: input.fileName, mimeType, parents: [folderId] }, fileBuffer, mimeType, boundary),
    });
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text().catch(() => "");
      return { ok: false, error: `Google Drive upload failed: ${uploadResponse.status} ${text.slice(0, 200)}` };
    }
    const uploaded = await uploadResponse.json() as { id?: string };
    if (!uploaded.id) {
      return { ok: false, error: "Google Drive upload response did not include file id" };
    }

    const permissionResponse = await fetch(`${DRIVE_API_URL}/${encodeURIComponent(uploaded.id)}/permissions?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
    if (!permissionResponse.ok) {
      const text = await permissionResponse.text().catch(() => "");
      return { ok: false, error: `Google Drive permission failed: ${permissionResponse.status} ${text.slice(0, 200)}` };
    }

    return { ok: true, fileId: uploaded.id, imageUrl: publicDriveImageUrl(uploaded.id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown Google Drive upload error" };
  }
}
