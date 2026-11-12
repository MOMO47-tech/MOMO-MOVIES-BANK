"use strict";

const { verifySession, sendJson } = require("../lib/security");
const { listMovieComments, upsertMovieComment } = require("../lib/supabase");
const { UUID } = require("../lib/movie-library");

const TMDB_KEY = /^tmdb:(?:movie|tv):\d{1,12}$/;
const SAMPLE_KEY = /^sample:[a-z0-9][a-z0-9-]{1,79}$/;

function validMovieKey(value) {
  return typeof value === "string" && (TMDB_KEY.test(value) || SAMPLE_KEY.test(value) || (value.startsWith("library:") && UUID.test(value.slice(8))));
}

function parseBody(body) {
  if (body && typeof body === "object" && !Array.isArray(body)) return body;
  if (typeof body === "string" && body.length <= 4096) {
    try { const value = JSON.parse(body); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  return {};
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    const proto = String(req.headers["x-forwarded-proto"] || parsed.protocol.replace(/:$/, "")).split(",")[0].trim().toLowerCase();
    return parsed.host.toLowerCase() === host && parsed.protocol === `${proto}:`;
  } catch { return false; }
}

function publicComment(row) {
  const hash = String(row.member_hash || "");
  return {
    id: row.id,
    author: `MEMBER-${hash.slice(0, 6).toUpperCase()}`,
    text: row.comment_text,
    created_at: row.created_at
  };
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const session = verifySession(req);
  if (!session || !/^[a-f0-9]{64}$/i.test(String(session.sub || ""))) return sendJson(res, 401, { error: "SESSION EXPIRED. LOG IN AGAIN TO VIEW OR POST COMMENTS." });

  try {
    if (req.method === "GET") {
      const movieKey = String(req.query?.movie || "");
      if (!validMovieKey(movieKey)) return sendJson(res, 400, { error: "Invalid movie reference." });
      const rows = await listMovieComments(movieKey);
      return sendJson(res, 200, { comments: rows.map(publicComment) });
    }

    if (!sameOrigin(req)) return sendJson(res, 403, { error: "COMMENT ORIGIN NOT VERIFIED." });
    const body = parseBody(req.body);
    const movieKey = String(body.movie || "");
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!validMovieKey(movieKey) || !title || text.length < 2 || text.length > 1000) {
      return sendJson(res, 400, { error: "ENTER A MOVIE AND A COMMENT (2–1000 CHARACTERS)." });
    }
    const row = await upsertMovieComment({ movieKey, title, text, memberHash: session.sub });
    if (!row) return sendJson(res, 503, { error: "COMMENT COULD NOT BE SAVED. TRY AGAIN." });
    return sendJson(res, 200, { comment: publicComment(row) });
  } catch {
    return sendJson(res, 503, { error: "COMMENTS DATABASE UNAVAILABLE. CHECK THE SUPABASE COMMENTS MIGRATION." });
  }
};
