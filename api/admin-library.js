"use strict";
const { isMovieAdmin, listAdminLibrary, createLibraryItem, updateLibraryItem, deleteLibraryItem } = require("../lib/supabase");
const { UUID, normalizeLibraryInput } = require("../lib/movie-library");
const { verifyAdminSession, sendJson } = require("../lib/security");
function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return parsed.host.toLowerCase() === host && parsed.protocol === `${proto}:`; }
  catch { return false; }
}
function parseBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body === "string" && body.length <= 16384) { try { return JSON.parse(body); } catch { return {}; } }
  return {};
}
function messageFor(error) {
  return ({
    INVALID_FIELDS: "Jaza jina (hadi herufi 160); maelezo au haki zimezidi urefu unaoruhusiwa.",
    INVALID_DATE: "Tarehe lazima iwe YYYY, YYYY-MM, au YYYY-MM-DD.",
    INVALID_POSTER_URL: "Poster lazima iwe kiungo cha HTTPS cha umma.",
    INVALID_RIGHTS_URL: "Kiungo cha uthibitisho wa haki lazima kiwe HTTPS.",
    INVALID_PLAYBACK_URL: "Player inaruhusu MP4, WebM, HLS (.m3u8), YouTube no-cookie embed au Vimeo embed salama pekee.",
    PUBLISH_REQUIRES_RIGHTS: "Ili kuchapisha, weka player, chanzo cha uthibitisho, maelezo ya haki, na uthibitishe kuwa una ruhusa."
  })[error.message] || "Imeshindikana kuhifadhi rekodi kwa sasa.";
}
module.exports = async function handler(req, res) {
  const session = verifyAdminSession(req);
  if (!session) return sendJson(res, 401, { error: "Ingia kwa akaunti ya admin kwanza." });
  try {
    if (!await isMovieAdmin(session.sub)) return sendJson(res, 403, { error: "Akaunti hii haina ruhusa ya admin." });
    if (req.method === "GET") return sendJson(res, 200, { items: await listAdminLibrary() });
    if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    if (!sameOrigin(req)) return sendJson(res, 403, { error: "Ombi la admin halijathibitishwa." });
    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!UUID.test(id)) return sendJson(res, 400, { error: "ID si sahihi." });
      await deleteLibraryItem(id);
      return sendJson(res, 200, { ok: true });
    }
    const body = parseBody(req.body);
    let item;
    try { item = normalizeLibraryInput(body); }
    catch (error) { return sendJson(res, 400, { error: messageFor(error) }); }
    if (req.method === "POST") {
      const created = await createLibraryItem(item, session.sub);
      return created ? sendJson(res, 201, { item: created }) : sendJson(res, 503, { error: "Rekodi haijahifadhiwa." });
    }
    const id = String(body.id || "");
    if (!UUID.test(id)) return sendJson(res, 400, { error: "ID si sahihi." });
    const rows = await updateLibraryItem(id, item, session.sub);
    return Array.isArray(rows) && rows.length ? sendJson(res, 200, { item: rows[0] }) : sendJson(res, 404, { error: "Rekodi haipo." });
  } catch {
    return sendJson(res, 503, { error: "Hifadhidata ya admin haijaunganishwa. Kagua schema.sql na SUPABASE_SERVICE_ROLE_KEY." });
  }
};
