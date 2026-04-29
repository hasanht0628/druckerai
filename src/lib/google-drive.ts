import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

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
      try {
        const envPath = path.join(process.cwd(), ".env.local");
        let content = fs.readFileSync(envPath, "utf-8");
        content = content
          .replace(/^GOOGLE_ACCESS_TOKEN=.*/m, `GOOGLE_ACCESS_TOKEN="${tokens.access_token}"`)
          .replace(/^GOOGLE_TOKEN_EXPIRY=.*/m, `GOOGLE_TOKEN_EXPIRY="${tokens.expiry_date ?? ""}"`);
        fs.writeFileSync(envPath, content);
        process.env.GOOGLE_ACCESS_TOKEN = tokens.access_token;
        if (tokens.expiry_date) process.env.GOOGLE_TOKEN_EXPIRY = String(tokens.expiry_date);
      } catch {
        // Non-fatal
      }
    }
  });

  return oauth2Client;
}

export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID);
}

export async function listRecentDocs(maxResults = 20): Promise<
  Array<{ id: string; name: string; modifiedTime: string }>
> {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.document' and trashed=false",
    orderBy: "modifiedTime desc",
    pageSize: maxResults,
    fields: "files(id,name,modifiedTime)",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    modifiedTime: f.modifiedTime!,
  }));
}

export async function fetchDriveDocText(fileId: string): Promise<string> {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.export(
    { fileId, mimeType: "text/plain" },
    { responseType: "text" }
  );

  const text = res.data as string;
  if (text.trim().length < 50) {
    throw new Error("Document has no extractable text — it may contain only images or be empty.");
  }
  return text;
}
