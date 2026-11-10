"use strict";
const { authenticateUser, completeAdminInvite, isMovieAdmin } = require("../lib/supabase");
const { createAdminSession, verifyAdminSession, setAdminSessionCookie, clearAdminSessionCookie, sendJson } = require("../lib/security");
function parseBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body === "string" && body.length <= 8192) { try { return JSON.parse(body); } catch { return {}; } }
  return {};
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host && parsed.protocol === `${proto}:`;
  } catch { return false; }
}
module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const session = verifyAdminSession(req);
    if (!session) return sendJson(res, 200, { authenticated: false });
    try { return sendJson(res, 200, { authenticated: await isMovieAdmin(session.sub) }); }
    catch { return sendJson(res, 503, { error: "Hatuwezi kuthibitisha akaunti ya admin kwa sasa." }); }
  }
  if (req.method === "DELETE") {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: "Ombi la admin halijathibitishwa." });
    clearAdminSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST, DELETE"); return sendJson(res, 405, { error: "Method not allowed" }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: "Ombi la admin halijathibitishwa." });
  res.setHeader("Cache-Control", "no-store");
  const body = parseBody(req.body);
  if (body.access_token !== undefined || body.new_password !== undefined) {
    const accessToken = body.access_token;
    const newPassword = body.new_password;
    const validToken = typeof accessToken === "string" && accessToken.length <= 8192 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken);
    if (!validToken || typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 256) {
      return sendJson(res, 400, { error: "Kiungo cha mwaliko si sahihi au nenosiri jipya ni fupi." });
    }
    try {
      const userId = await completeAdminInvite(accessToken, newPassword);
      if (!userId) return sendJson(res, 401, { error: "Kiungo kimekwisha muda au akaunti hii haina ruhusa ya admin." });
      setAdminSessionCookie(res, createAdminSession(userId));
      return sendJson(res, 200, { authenticated: true });
    } catch {
      return sendJson(res, 503, { error: "Imeshindikana kukamilisha akaunti ya admin kwa sasa." });
    }
  }
  const { email, password } = body;
  if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || password.length < 1 || password.length > 256) {
    return sendJson(res, 400, { error: "Weka email na nenosiri halali." });
  }
  try {
    const userId = await authenticateUser(email.trim().toLowerCase(), password);
    if (!userId || !await isMovieAdmin(userId)) return sendJson(res, 401, { error: "Taarifa za kuingia si sahihi au akaunti haina ruhusa ya admin." });
    setAdminSessionCookie(res, createAdminSession(userId));
    return sendJson(res, 200, { authenticated: true });
  } catch {
    return sendJson(res, 503, { error: "Huduma ya admin haijaunganishwa. Kagua Supabase Auth, key na schema." });
  }
};
