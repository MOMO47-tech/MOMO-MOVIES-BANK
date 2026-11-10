"use strict";
const { listPublicLibrary } = require("../lib/supabase");
const { toPublicLibraryItem } = require("../lib/movie-library");
const { sendJson } = require("../lib/security");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return sendJson(res, 405, { error: "Method not allowed" }); }
  try {
    const rows = await listPublicLibrary();
    const items = (Array.isArray(rows) ? rows : []).map(toPublicLibraryItem).filter(Boolean);
    return sendJson(res, 200, { items });
  } catch {
    return sendJson(res, 503, { items: [], error: "MOVIE_LIBRARY_UNAVAILABLE" });
  }
};
