import { google, gmail_v1 } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import type {
  EmailParticipant,
  NormalizedEmailMessage,
  NormalizedEmailThread,
} from "@/types/email";

export const DEFAULT_GMAIL_QUERY =
  "newer_than:30d in:inbox category:primary -category:updates -category:promotions -category:social -category:forums";

const EXCLUDED_CATEGORY_LABELS = new Set([
  "CATEGORY_UPDATES",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
]);

const AUTOMATED_SENDER_PATTERNS = [
  /(^|[-_.])no-?reply@/i,
  /(^|[-_.])do-?not-?reply@/i,
  /(^|[-_.])notifications?@/i,
  /(^|[-_.])updates?@/i,
  /(^|[-_.])mailer@/i,
  /(^|[-_.])news@/i,
];

const LOW_SIGNAL_SUBJECT_PATTERNS = [
  /\bnewsletter\b/i,
  /\bdigest\b/i,
  /\broundup\b/i,
  /\bweekly update\b/i,
  /\bproduct update\b/i,
  /\bsecurity alert\b/i,
  /\blogin alert\b/i,
  /\byour receipt\b/i,
];

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );

  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    expiry_date: process.env.GOOGLE_TOKEN_EXPIRY
      ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY)
      : undefined,
  });

  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      persistTokens(tokens.access_token, tokens.expiry_date ?? null);
    }
  });

  return oauth2Client;
}

function persistTokens(accessToken: string, expiryDate: number | null) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let content = fs.readFileSync(envPath, "utf-8");
    content = content
      .replace(/^GOOGLE_ACCESS_TOKEN=.*/m, `GOOGLE_ACCESS_TOKEN="${accessToken}"`)
      .replace(
        /^GOOGLE_TOKEN_EXPIRY=.*/m,
        `GOOGLE_TOKEN_EXPIRY="${expiryDate ?? ""}"`
      );
    fs.writeFileSync(envPath, content);
    process.env.GOOGLE_ACCESS_TOKEN = accessToken;
    if (expiryDate) process.env.GOOGLE_TOKEN_EXPIRY = String(expiryDate);
  } catch {
    // Non-fatal: the refreshed token still works for this request.
  }
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

export async function listRecentThreads(
  maxResults = 20,
  query = DEFAULT_GMAIL_QUERY
): Promise<Array<{ id: string; snippet?: string }>> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.threads.list({
    userId: "me",
    maxResults,
    q: query,
  });

  return (response.data.threads ?? [])
    .filter((thread): thread is gmail_v1.Schema$Thread & { id: string } =>
      Boolean(thread.id)
    )
    .map((thread) => ({ id: thread.id, snippet: thread.snippet ?? undefined }));
}

export function isLikelyImportantThread(thread: NormalizedEmailThread): boolean {
  if (thread.labels.some((label) => EXCLUDED_CATEGORY_LABELS.has(label))) {
    return false;
  }

  if (LOW_SIGNAL_SUBJECT_PATTERNS.some((pattern) => pattern.test(thread.subject))) {
    return false;
  }

  const senders = thread.messages
    .map((message) => message.from?.email ?? "")
    .filter(Boolean);
  if (
    senders.length > 0 &&
    senders.every((sender) =>
      AUTOMATED_SENDER_PATTERNS.some((pattern) => pattern.test(sender))
    )
  ) {
    return false;
  }

  return true;
}

export async function fetchThreadMessages(
  threadId: string
): Promise<NormalizedEmailThread> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  return normalizeEmailThread(response.data);
}

export function normalizeEmailThread(
  thread: gmail_v1.Schema$Thread
): NormalizedEmailThread {
  const messages = (thread.messages ?? [])
    .filter((message): message is gmail_v1.Schema$Message & { id: string } =>
      Boolean(message.id)
    )
    .map(normalizeMessage)
    .filter((message) => message.bodyText.trim().length > 0);

  const firstMessage = thread.messages?.[0];
  const subject = getHeader(firstMessage, "subject") || "(No subject)";
  const labels = Array.from(
    new Set((thread.messages ?? []).flatMap((message) => message.labelIds ?? []))
  );
  const participants = dedupeParticipants(
    messages.flatMap((message) => [
      ...(message.from ? [message.from] : []),
      ...message.to,
      ...message.cc,
    ])
  );
  const lastMessageAt =
    messages
      .map((message) => message.date)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? new Date().toISOString();

  return {
    threadId: thread.id ?? "",
    subject,
    participants,
    labels,
    lastMessageAt,
    snippet: thread.snippet ?? firstMessage?.snippet ?? undefined,
    messages,
  };
}

function normalizeMessage(
  message: gmail_v1.Schema$Message & { id: string }
): NormalizedEmailMessage {
  const from = parseParticipant(getHeader(message, "from"));
  const to = parseParticipantList(getHeader(message, "to"));
  const cc = parseParticipantList(getHeader(message, "cc"));
  const date = normalizeDate(getHeader(message, "date"));

  return {
    id: message.id,
    from,
    to,
    cc,
    date,
    snippet: message.snippet ?? undefined,
    bodyText: cleanBodyText(extractBodyText(message.payload)),
  };
}

function getHeader(
  message: gmail_v1.Schema$Message | undefined,
  name: string
): string | undefined {
  return message?.payload?.headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase()
  )?.value ?? undefined;
}

function extractBodyText(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return "";

  const mimeType = part.mimeType ?? "";
  if (part.body?.data && (mimeType === "text/plain" || mimeType === "text/html")) {
    const decoded = decodeBase64Url(part.body.data);
    return mimeType === "text/html" ? htmlToText(decoded) : decoded;
  }

  return (part.parts ?? []).map(extractBodyText).filter(Boolean).join("\n\n");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanBodyText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(">"))
    .join("\n")
    .replace(/\nOn .+ wrote:\n[\s\S]*$/i, "")
    .replace(/\n-{2,}\s*Forwarded message[\s\S]*$/i, "")
    .replace(/\n(Unsubscribe|Manage preferences|View in browser)[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 12_000)
    .trim();
}

function parseParticipant(value?: string): EmailParticipant | undefined {
  if (!value) return undefined;
  const match = value.match(/^(?:"?([^"<]*)"?)?\s*<?([^<>\s]+@[^<>\s]+)>?$/);
  if (!match) return { email: value.trim() };

  const name = match[1]?.trim();
  const email = match[2]?.trim();
  return email ? { name: name || undefined, email } : undefined;
}

function parseParticipantList(value?: string): EmailParticipant[] {
  if (!value) return [];
  return value
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((item) => parseParticipant(item.trim()))
    .filter((item): item is EmailParticipant => Boolean(item?.email));
}

function dedupeParticipants(participants: EmailParticipant[]): EmailParticipant[] {
  const seen = new Map<string, EmailParticipant>();
  for (const participant of participants) {
    const key = participant.email.toLowerCase();
    if (!seen.has(key)) seen.set(key, participant);
  }
  return Array.from(seen.values());
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
