// Google Play tracks for com.bunktab.app, through the Play Developer API with the
// publisher service account in secrets/play-service-account.json.
//
//   node scripts/play-tracks.mjs status                 what each track holds
//   node scripts/play-tracks.mjs rollout <versionCode>  internal → completed, alpha → draft
//
// EAS submits each Android build as a *draft* on the internal track (eas.json). This
// is the second half: make that draft live for internal testers and park the same
// build as the closed-testing (Alpha) draft, ready to send for review.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PKG = "com.bunktab.app";
const VERSION = JSON.parse(readFileSync(new URL("../apps/mobile/app.json", import.meta.url), "utf8")).expo.version;
const key = JSON.parse(readFileSync(new URL("../secrets/play-service-account.json", import.meta.url), "utf8"));

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token: ${JSON.stringify(j)}`);
  return j.access_token;
}

const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
async function api(tok, method, path, body) {
  const r = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

const [cmd, arg] = process.argv.slice(2);
const tok = await token();
const edit = await api(tok, "POST", "/edits", {});
const tracks = (await api(tok, "GET", `/edits/${edit.id}/tracks`)).tracks ?? [];
const show = () => { for (const t of tracks) for (const r of t.releases ?? []) console.log(`${t.track.padEnd(10)} ${String(r.status).padEnd(10)} ${(r.versionCodes ?? []).join(",") || "-"}  ${r.name ?? ""}`); };

if (cmd === "status") { show(); process.exit(0); }
if (cmd === "rollout") {
  const vc = String(arg);
  if (!/^\d+$/.test(vc)) { console.error("rollout <versionCode>"); process.exit(1); }
  const internal = tracks.find((t) => t.track === "internal");
  const has = (internal?.releases ?? []).some((r) => (r.versionCodes ?? []).includes(vc));
  if (!has) { console.error(`version code ${vc} is not on the internal track yet (EAS submission still running?)`); show(); process.exit(2); }
  await api(tok, "PUT", `/edits/${edit.id}/tracks/internal`, { track: "internal", releases: [{ name: `${VERSION} (${vc})`, versionCodes: [vc], status: "completed" }] });
  await api(tok, "PUT", `/edits/${edit.id}/tracks/alpha`, { track: "alpha", releases: [{ name: `${VERSION} (${vc})`, versionCodes: [vc], status: "draft" }] });
  await api(tok, "POST", `/edits/${edit.id}:commit`);
  console.log(`internal: ${vc} completed · alpha: ${vc} draft`);
  process.exit(0);
}
console.error("usage: status | rollout <versionCode>"); process.exit(1);
