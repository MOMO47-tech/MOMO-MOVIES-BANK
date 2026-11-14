"use strict";

const { randomUUID } = require("node:crypto");
const { isMovieAdmin, listAdminLibrary, createLibraryItem } = require("../lib/supabase");
const { DJ_MACK_MARKER, isDjMackSynopsis, normalizeLibraryInput, toPublicLibraryItem, safeHttpsUrl } = require("../lib/movie-library");
const { OBJECT_PATTERN, MAX_FILE_BYTES, createDjUpload, verifyUploadedDjMovie, deleteDjObject } = require("../lib/dj-storage");
const { verifyAdminSession, sendJson } = require("../lib/security");

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

function parseBody(body) {
  if (body && typeof body === "object" && !Array.isArray(body)) return body;
  if (typeof body === "string" && body.length <= 16384) {
    try { const parsed = JSON.parse(body); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch {}
  }
  return {};
}

function validateDetails(body) {
  const title = String(body.title || "").trim();
  const year = String(body.release_year || "").trim();
  const synopsis = String(body.synopsis || "").trim();
  const rightsUrl = safeHttpsUrl(String(body.rights_url || "").trim());
  const rightsNotes = String(body.rights_notes || "").trim();
  const posterUrl = String(body.poster_url || "").trim();
  const rightsConfirmed = body.rights_confirmed === true;
  if (!title || title.length > 160) throw new Error("DJ_TITLE_REQUIRED");
  if (!/^\d{4}$/.test(year) || Number(year) < 1888 || Number(year) > 2100) throw new Error("DJ_YEAR_INVALID");
  if (synopsis.length > 3900 || rightsNotes.length < 15 || rightsNotes.length > 1000) throw new Error("DJ_DETAILS_INVALID");
  if (!rightsUrl) throw new Error("DJ_RIGHTS_URL_REQUIRED");
  if (!rightsConfirmed) throw new Error("DJ_RIGHTS_CONFIRM_REQUIRED");
  if (posterUrl && !safeHttpsUrl(posterUrl)) throw new Error("DJ_POSTER_INVALID");
  return { title, year, synopsis, rightsUrl, rightsNotes, posterUrl: posterUrl ? safeHttpsUrl(posterUrl) : "" };
}

function userMessage(error) {
  return ({
    SUPABASE_NOT_CONFIGURED: "Supabase Storage haijaunganishwa. Hakikisha SUPABASE_SERVICE_ROLE_KEY imewekwa kwenye Vercel.",
    SUPABASE_STORAGE_HOST_UNSUPPORTED: "URL ya Supabase Storage haijatumika kwa upload hii.",
    DJ_BUCKET_NOT_PUBLIC: "Bucket ya DJ Mack ipo lakini haijaruhusu playback ya umma; wasiliana na admin wa Supabase.",
    DJ_BUCKET_SIZE_CONFIG_FAILED: "Mpango wa Supabase haukuruhusu kuongeza kikomo cha video hadi 5 GB. Angalia Storage settings au tumia faili dogo.",
    DJ_BUCKET_LOOKUP_FAILED: "Imeshindikana kuangalia mipangilio ya Supabase Storage.",
    DJ_BUCKET_CREATE_FAILED: "Imeshindikana kuunda bucket ya video. Angalia Storage limits na ruhusa za Supabase.",
    DJ_SIGNED_UPLOAD_FAILED: "Imeshindikana kuandaa link salama ya upload. Angalia Supabase Storage limits.",
    DJ_UPLOAD_TOKEN_MISSING: "Supabase haikurudisha signed upload token.",
    DJ_UPLOAD_NOT_RANGE_READABLE: "Video haijathibitishwa kwenye Storage; jaribu upload tena.",
    DJ_UPLOAD_NOT_VALID_MP4: "Faili iliyopakiwa si MP4 inayosomeka au content type yake haijathibitishwa.",
    DJ_TITLE_REQUIRED: "Weka jina la filamu (herufi 160 au chini).",
    DJ_YEAR_INVALID: "Weka mwaka wa kutoka wenye tarakimu nne.",
    DJ_DETAILS_INVALID: "Kagua maelezo ya filamu na haki; maelezo ya haki yahitaji angalau herufi 15.",
    DJ_RIGHTS_URL_REQUIRED: "Weka kiungo cha HTTPS kinachoonyesha chanzo/uthibitisho wa haki.",
    DJ_RIGHTS_CONFIRM_REQUIRED: "Thibitisha kwamba una haki ya kuchapisha na kuruhusu download.",
    DJ_POSTER_INVALID: "Poster lazima iwe kiungo salama cha HTTPS.",
    DJ_FILE_SIZE_INVALID: "Faili lazima iwe zaidi ya 0 na isizidi 5 GB. Kikomo halisi pia hutegemea Supabase project plan.",
    DJ_FILE_TOO_LARGE: "File yako imezidi kikomo cha 5 GB cha fomu hii.",
    DJ_UPLOAD_METADATA_MISMATCH: "Ukubwa wa faili iliyohifadhiwa hautalingana na faili iliyochaguliwa.",
    DJ_RECORD_NOT_SAVED: "Video imepakiwa lakini rekodi haijahifadhiwa; video iliyopakiwa imeondolewa. Jaribu tena.",
    INVALID_DJ_OBJECT_PATH: "Njia ya faili haijatambuliwa. Anza upload mpya."
  })[error.message] || "Upload imeshindikana. Angalia Supabase Storage limits/connection kisha ujaribu tena.";
}

async function cleanupObject(path) {
  try { await deleteDjObject(path); return false; }
  catch { return true; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return sendJson(res, 405, { error: "Method not allowed" }); }
  const session = verifyAdminSession(req);
  if (!session) return sendJson(res, 401, { error: "Ingia kwa akaunti ya admin kwanza." });
  if (!sameOrigin(req)) return sendJson(res, 403, { error: "Ombi la admin halijathibitishwa." });

  try {
    if (!await isMovieAdmin(session.sub)) return sendJson(res, 403, { error: "Akaunti hii haina ruhusa ya admin." });
    const body = parseBody(req.body);
    if (body.action === "discard") {
      const discardPath = String(body.path || "");
      if (!OBJECT_PATTERN.test(discardPath)) return sendJson(res, 400, { error: userMessage(new Error("INVALID_DJ_OBJECT_PATH")) });
      await deleteDjObject(discardPath);
      return sendJson(res, 200, { ok: true });
    }
    const details = validateDetails(body);

    if (body.action === "init") {
      const size = Number(body.file_size);
      if (!Number.isSafeInteger(size) || size < 8) return sendJson(res, 400, { error: userMessage(new Error("DJ_FILE_SIZE_INVALID")) });
      if (size > MAX_FILE_BYTES) return sendJson(res, 413, { error: userMessage(new Error("DJ_FILE_TOO_LARGE")) });
      const objectPath = `dj-mack/${randomUUID()}.mp4`;
      const upload = await createDjUpload(objectPath);
      if (size > upload.maxFileBytes) {
        return sendJson(res, 413, {
          error: "Faili imezidi kikomo cha sasa cha Supabase Storage. Punguza ukubwa wa MP4 au ongeza kikomo kwenye Supabase.",
          maxFileBytes: upload.maxFileBytes
        });
      }
      return sendJson(res, 201, { upload, maxFileBytes: upload.maxFileBytes });
    }

    if (body.action !== "complete") return sendJson(res, 400, { error: "Kitendo cha upload hakitambuliki." });
    const objectPath = String(body.path || "");
    if (!OBJECT_PATTERN.test(objectPath)) return sendJson(res, 400, { error: userMessage(new Error("INVALID_DJ_OBJECT_PATH")) });
    const fileSize = Number(body.file_size);
    if (!Number.isSafeInteger(fileSize) || fileSize < 8 || fileSize > MAX_FILE_BYTES) {
      return sendJson(res, 400, { error: userMessage(new Error("DJ_FILE_SIZE_INVALID")) });
    }

    let uploaded;
    try { uploaded = await verifyUploadedDjMovie(objectPath); }
    catch (error) {
      const cleanupFailed = await cleanupObject(objectPath);
      return sendJson(res, 422, { error: userMessage(error), retry_upload: true, cleanup_failed: cleanupFailed });
    }
    if (uploaded.size !== fileSize) {
      const cleanupFailed = await cleanupObject(objectPath);
      return sendJson(res, 422, { error: userMessage(new Error("DJ_UPLOAD_METADATA_MISMATCH")), retry_upload: true, cleanup_failed: cleanupFailed });
    }

    const existingRow = (await listAdminLibrary()).find(row => isDjMackSynopsis(row.synopsis) && row.playback_url === uploaded.publicUrl);
    if (existingRow) {
      const existingItem = toPublicLibraryItem(existingRow);
      if (existingItem) return sendJson(res, 200, { item: existingItem, fileSize: uploaded.size, alreadyPublished: true });
      return sendJson(res, 409, { error: "Faili hii tayari ina rekodi isiyochapishwa. Kagua rekodi ya DJ Mack kabla ya kujaribu tena." });
    }

    const internalSynopsis = `${DJ_MACK_MARKER}\n${details.synopsis}`.slice(0, 4000);
    let normalized;
    try {
      normalized = normalizeLibraryInput({
        title: details.title,
        media_type: "movie",
        synopsis: internalSynopsis,
        poster_url: details.posterUrl,
        release_date: details.year,
        playback_type: "file",
        playback_url: uploaded.publicUrl,
        rights_url: details.rightsUrl,
        rights_notes: details.rightsNotes,
        rights_verified: true,
        is_published: true
      });
    } catch (error) {
      const cleanupFailed = await cleanupObject(objectPath);
      return sendJson(res, 400, { error: userMessage(error), retry_upload: true, cleanup_failed: cleanupFailed });
    }

    let row;
    try { row = await createLibraryItem(normalized, session.sub); }
    catch { return sendJson(res, 503, { error: "Hifadhidata haikuthibitisha kuchapisha. Bonyeza upload tena; mfumo utakagua rekodi kabla ya kuunda nyingine." }); }
    if (!row) return sendJson(res, 503, { error: "Hifadhidata haikurudisha uthibitisho wa rekodi. Bonyeza upload tena; mfumo utakagua rekodi kabla ya kuunda nyingine." });
    const item = toPublicLibraryItem(row);
    if (!item) return sendJson(res, 503, { error: "Rekodi imehifadhiwa lakini uthibitishaji wa public haujapita. Kagua rekodi ya DJ Mack kwenye Admin." });
    return sendJson(res, 201, { item, fileSize: uploaded.size });
  } catch (error) {
    const message = userMessage(error);
    const status = error.message === "SUPABASE_NOT_CONFIGURED" ? 503 : 502;
    return sendJson(res, status, { error: message });
  }
};
