#!/usr/bin/env node
/**
 * One-time Google OAuth setup script.
 * Run: node scripts/setup-google-auth.js
 *
 * Prerequisites:
 * 1. Create a project at console.cloud.google.com
 * 2. Enable the Google Calendar, Google Drive, and Gmail APIs
 * 3. Create OAuth 2.0 credentials (Desktop app type)
 * 4. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local
 * 5. Run this script — it will open your browser and save the refresh token
 */

const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local"
  );
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3001/oauth2callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\nDruckerAI — Google Workspace Setup");
console.log("===================================");
console.log("Requesting Calendar, Drive, and Gmail read-only access.");
console.log("Opening your browser for Google authorization...\n");

// Open browser
try {
  execSync(`open "${authUrl}"`);
} catch {
  console.log("Please open this URL in your browser:\n", authUrl);
}

// Local server to catch the callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname !== "/oauth2callback") {
    res.end("Not found");
    return;
  }

  const code = parsedUrl.query.code;

  if (!code) {
    res.end("No code received. Please try again.");
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Write tokens to .env.local
    const envPath = path.join(__dirname, "../.env.local");
    let content = fs.readFileSync(envPath, "utf-8");

    const updates = {
      GOOGLE_REFRESH_TOKEN: tokens.refresh_token || "",
      GOOGLE_ACCESS_TOKEN: tokens.access_token || "",
      GOOGLE_TOKEN_EXPIRY: String(tokens.expiry_date || ""),
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${key}="${value}"`);
      } else {
        content += `\n${key}="${value}"`;
      }
    }

    fs.writeFileSync(envPath, content);

    console.log("\n✅ Success! Google Workspace tokens saved to .env.local");
    console.log("   You can now start the app: npm run dev\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:sans-serif;max-width:500px;margin:4rem auto;padding:2rem">
        <h2>✅ DruckerAI connected to Google Workspace</h2>
        <p>Tokens saved. You can close this tab and start the app.</p>
        <code>npm run dev</code>
      </body></html>
    `);

    server.close();
    process.exit(0);
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    res.end("Error. Check console.");
    server.close();
    process.exit(1);
  }
});

server.listen(3001, () => {
  console.log("Waiting for Google OAuth callback on http://localhost:3001...\n");
});
