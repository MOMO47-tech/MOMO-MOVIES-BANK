"use strict";

const { UUID } = require("./movie-library");

function getConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return { url, key };
}

function headers(key, extras = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extras };
}

async function addMember(phoneHash) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/momo_movie_members?on_conflict=phone_hash`, {
    method: "POST",
    headers: headers(key, { Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ phone_hash: phoneHash })
  });
  if (!response.ok) throw new Error("SUPABASE_MEMBER_WRITE_FAILED");
}

async function memberCount() {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/momo_movie_members?select=phone_hash`, {
    method: "HEAD",
    headers: headers(key, { Prefer: "count=exact", Range: "0-0" })
  });
  if (!response.ok) throw new Error("SUPABASE_COUNT_FAILED");
  const range = response.headers.get("content-range") || "";
  const total = range.split("/").pop();
  const count = Number(total);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("SUPABASE_COUNT_INVALID");
  return count;
}

async function rest(path, options = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: headers(key, options.headers || {}),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("SUPABASE_REQUEST_FAILED");
  if (response.status === 204) return null;
  return response.json();
}

async function authenticateUser(email, password) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  // Prefer the public key, but keep a server-only fallback for deployments that
  // already store only the service-role key. This key is never sent to the client.
  const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !authKey) throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: authKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) return null;
  const data = await response.json();
  const userId = String(data.user?.id || "");
  return UUID.test(userId) ? userId : null;
}

async function completeAdminInvite(accessToken, password) {
  const { url, key } = getConfig();
  const authKey = process.env.SUPABASE_ANON_KEY || key;
  const authHeaders = {
    apikey: authKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders,
    signal: AbortSignal.timeout(12000)
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const userId = String(user.id || "");
  if (!UUID.test(userId) || !await isMovieAdmin(userId)) return null;
  const passwordResponse = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(12000)
  });
  if (passwordResponse.status === 401 || passwordResponse.status === 403) return null;
  if (!passwordResponse.ok) throw new Error("SUPABASE_PASSWORD_UPDATE_FAILED");
  return userId;
}

async function isMovieAdmin(userId) {
  if (!UUID.test(String(userId || ""))) return false;
  const rows = await rest(`momo_movie_admins?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

async function listPublicLibrary() {
  return rest("momo_movie_library?select=id,title,media_type,synopsis,poster_url,release_date,playback_type,playback_url,rights_verified,is_published&rights_verified=eq.true&is_published=eq.true&order=created_at.desc&limit=200");
}

async function listAdminLibrary() {
  return rest("momo_movie_library?select=id,title,media_type,synopsis,poster_url,release_date,playback_type,playback_url,rights_url,rights_notes,rights_verified,is_published,created_at,updated_at&order=updated_at.desc&limit=200");
}

async function createLibraryItem(item, userId) {
  const rows = await rest("momo_movie_library?select=id,title,media_type,synopsis,poster_url,release_date,playback_type,playback_url,rights_url,rights_notes,rights_verified,is_published,created_at,updated_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: { ...item, created_by: userId, updated_by: userId }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateLibraryItem(id, item, userId) {
  return rest(`momo_movie_library?id=eq.${encodeURIComponent(id)}&select=id,title,media_type,synopsis,poster_url,release_date,playback_type,playback_url,rights_url,rights_notes,rights_verified,is_published,created_at,updated_at`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { ...item, updated_by: userId, updated_at: new Date().toISOString() }
  });
}

async function deleteLibraryItem(id) {
  await rest(`momo_movie_library?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function listMovieComments(movieKey) {
  const rows = await rest(`momo_movie_comments?select=id,member_hash,comment_text,created_at&movie_key=eq.${encodeURIComponent(movieKey)}&order=created_at.desc&limit=100`);
  return Array.isArray(rows) ? rows : [];
}

async function listAdminMovieComments(offset = 0, limit = 101) {
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 && offset <= 100000 ? offset : 0;
  const safeLimit = Number.isSafeInteger(limit) && limit >= 1 && limit <= 101 ? limit : 101;
  const rows = await rest(`momo_movie_comments?select=id,movie_key,movie_title,member_hash,comment_text,created_at,updated_at&order=updated_at.desc&limit=${safeLimit}&offset=${safeOffset}`);
  return Array.isArray(rows) ? rows : [];
}

async function upsertMovieComment({ movieKey, title, text, memberHash }) {
  const rows = await rest("momo_movie_comments?on_conflict=movie_key,member_hash&select=id,member_hash,comment_text,created_at", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      movie_key: movieKey,
      movie_title: title,
      member_hash: memberHash,
      comment_text: text,
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

module.exports = {
  addMember, memberCount, authenticateUser, completeAdminInvite, isMovieAdmin,
  listPublicLibrary, listAdminLibrary, createLibraryItem, updateLibraryItem, deleteLibraryItem,
  listMovieComments, listAdminMovieComments, upsertMovieComment
};
