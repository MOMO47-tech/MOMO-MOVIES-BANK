"use strict";

const { isMovieAdmin, listAdminMovieComments } = require("../lib/supabase");
const { verifyAdminSession, sendJson } = require("../lib/security");

function publicAdminComment(row) {
  const memberHash = String(row.member_hash || "");
  return {
    id: row.id,
    movie_key: row.movie_key,
    movie_title: row.movie_title,
    author: /^[a-f0-9]{64}$/i.test(memberHash) ? `MEMBER-${memberHash.slice(0, 6).toUpperCase()}` : "MEMBER",
    text: row.comment_text,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const session = verifyAdminSession(req);
  if (!session) return sendJson(res, 401, { error: "Admin sign-in required." });
  try {
    if (!await isMovieAdmin(session.sub)) return sendJson(res, 403, { error: "This account is not on the admin allow-list." });
    const rawOffset = req.query?.offset === undefined ? "0" : String(req.query.offset);
    if (!/^\d{1,6}$/.test(rawOffset) || Number(rawOffset) > 100000) return sendJson(res, 400, { error: "Invalid comment page." });
    const offset = Number(rawOffset);
    const rows = await listAdminMovieComments(offset, 101);
    const hasMore = rows.length > 100;
    const comments = rows.slice(0, 100);
    return sendJson(res, 200, { comments: comments.map(publicAdminComment), limit: 100, has_more: hasMore, next_offset: offset + comments.length });
  } catch {
    return sendJson(res, 503, { error: "The admin comment feed is temporarily unavailable." });
  }
};
