import net from "node:net";
import tls from "node:tls";

import { loadLettersEmailEnv } from "@/lib/letter-env";

export type EmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

function smtpConfig(): SmtpConfig | null {
  loadLettersEmailEnv();
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!host || !from || !Number.isFinite(port)) {
    return null;
  }
  return {
    host,
    port,
    from,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}

function encodeSubject(subject: string) {
  return /^[\x00-\x7F]*$/.test(subject) ? subject : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

function dotEscape(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function readResponse(socket: net.Socket) {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  let buffer = "";
  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const last = lines.at(-1);
    if (last && /^\d{3} /.test(last)) {
      socket.off("data", onData);
      socket.off("error", onError);
      resolve(buffer);
    }
  };
  const onError = (error: Error) => {
    socket.off("data", onData);
    reject(error);
  };
  socket.on("data", onData);
  socket.once("error", onError);
  return promise;
}

async function command(socket: net.Socket, line: string, expected = /^[23]/) {
  socket.write(`${line}\r\n`);
  const response = await readResponse(socket);
  if (!expected.test(response)) {
    throw new Error(`SMTP command failed: ${response.split(/\r?\n/)[0] ?? "unknown"}`);
  }
  return response;
}

async function connect(config: SmtpConfig) {
  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });

  const connected = Promise.withResolvers<void>();
  socket.once(config.secure ? "secureConnect" : "connect", connected.resolve);
  socket.once("error", connected.reject);
  await connected.promise;
  await readResponse(socket);
  await command(socket, `EHLO bible.ponslink.com`);

  if (!config.secure) {
    await command(socket, "STARTTLS");
    const upgraded = tls.connect({ socket, servername: config.host });
    const secured = Promise.withResolvers<void>();
    upgraded.once("secureConnect", secured.resolve);
    upgraded.once("error", secured.reject);
    await secured.promise;
    await command(upgraded, `EHLO bible.ponslink.com`);
    return upgraded;
  }

  return socket;
}

function buildMime(config: SmtpConfig, message: EmailMessage) {
  const boundary = `letters-${Date.now().toString(36)}`;
  return [
    `From: ${config.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeSubject(message.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    message.text,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    message.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function sendSystemEmail(message: EmailMessage): Promise<EmailSendResult> {
  const config = smtpConfig();
  if (!config) {
    return { ok: false, skipped: true, error: "SMTP env is not configured" };
  }

  let socket: net.Socket | null = null;
  try {
    socket = await connect(config);
    if (config.user && config.pass) {
      await command(socket, "AUTH LOGIN", /^334/);
      await command(socket, Buffer.from(config.user).toString("base64"), /^334/);
      await command(socket, Buffer.from(config.pass).toString("base64"));
    }
    await command(socket, `MAIL FROM:<${config.from.replace(/^.*<|>.*$/g, "")}>`);
    await command(socket, `RCPT TO:<${message.to}>`);
    await command(socket, "DATA", /^354/);
    socket.write(`${dotEscape(buildMime(config, message))}\r\n.\r\n`);
    const response = await readResponse(socket);
    if (!/^250/.test(response)) {
      throw new Error(`SMTP DATA failed: ${response.split(/\r?\n/)[0] ?? "unknown"}`);
    }
    await command(socket, "QUIT", /^[23]/).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown SMTP error" };
  } finally {
    socket?.destroy();
  }
}
