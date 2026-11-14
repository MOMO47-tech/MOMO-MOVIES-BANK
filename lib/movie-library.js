"use strict";

const net = require("node:net");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DJ_MACK_MARKER = "[[MOMO_DJ_MACK]]";
function isDjMackSynopsis(value) { return String(value || "").startsWith(`${DJ_MACK_MARKER}\n`); }
function stripDjMackMarker(value) {
  const synopsis = String(value || "");
  return isDjMackSynopsis(synopsis) ? synopsis.slice(DJ_MACK_MARKER.length).trim() : synopsis;
}

function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const ipHost = host.replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || net.isIP(ipHost)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function safeEmbedUrl(value) {
  const safe = safeHttpsUrl(value);
  if (!safe) return "";
  const url = new URL(safe);
  const youtube = url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[A-Za-z0-9_-]{6,20}$/.test(url.pathname);
  const vimeo = url.hostname === "player.vimeo.com" && /^\/video\/\d{1,12}$/.test(url.pathname);
  return youtube || vimeo ? url.href : "";
}

function safePlaybackUrl(value, playbackType) {
  if (playbackType === "embed") return safeEmbedUrl(value);
  if (playbackType !== "file") return "";
  const safe = safeHttpsUrl(value);
  if (!safe) return "";
  const path = new URL(safe).pathname.toLowerCase();
  return /\.(mp4|webm|m3u8)$/.test(path) ? safe : "";
}

function normalizeLibraryInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_RECORD");
  const title = String(input.title || "").trim();
  const mediaType = input.media_type === "series" ? "series" : "movie";
  const synopsis = String(input.synopsis || "").trim();
  const playbackType = input.playback_type === "embed" ? "embed" : "file";
  const playbackUrl = String(input.playback_url || "").trim();
  const rightsUrl = String(input.rights_url || "").trim();
  const rightsNotes = String(input.rights_notes || "").trim();
  const posterUrl = String(input.poster_url || "").trim();
  const releaseDate = String(input.release_date || "").trim();
  const rightsVerified = input.rights_verified === true;
  const isPublished = input.is_published === true;

  if (!title || title.length > 160 || synopsis.length > 4000 || rightsNotes.length > 1200) throw new Error("INVALID_FIELDS");
  if (releaseDate && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(releaseDate)) throw new Error("INVALID_DATE");
  const cleanPoster = posterUrl ? safeHttpsUrl(posterUrl) : "";
  const cleanRights = rightsUrl ? safeHttpsUrl(rightsUrl) : "";
  const cleanPlayback = playbackUrl ? safePlaybackUrl(playbackUrl, playbackType) : "";
  if (posterUrl && !cleanPoster) throw new Error("INVALID_POSTER_URL");
  if (rightsUrl && !cleanRights) throw new Error("INVALID_RIGHTS_URL");
  if (playbackUrl && !cleanPlayback) throw new Error("INVALID_PLAYBACK_URL");
  if (isPublished && (!rightsVerified || !cleanRights || !rightsNotes || !cleanPlayback)) throw new Error("PUBLISH_REQUIRES_RIGHTS");

  return {
    title,
    media_type: mediaType,
    synopsis,
    poster_url: cleanPoster || null,
    release_date: releaseDate || null,
    playback_type: playbackType,
    playback_url: cleanPlayback || null,
    rights_url: cleanRights || null,
    rights_notes: rightsNotes || null,
    rights_verified: rightsVerified,
    is_published: isPublished
  };
}

function toPublicLibraryItem(row) {
  if (!row || row.rights_verified !== true || row.is_published !== true) return null;
  const playbackUrl = safePlaybackUrl(row.playback_url, row.playback_type);
  if (!playbackUrl || !row.title) return null;
  const isDjMack = isDjMackSynopsis(row.synopsis);
  const rightsUrl = isDjMack ? safeHttpsUrl(row.rights_url) : "";
  const rightsNotes = isDjMack ? String(row.rights_notes || "").trim() : "";
  if (isDjMack && (!rightsUrl || !rightsNotes || row.playback_type !== "file" || !/\.mp4$/i.test(new URL(playbackUrl).pathname))) return null;
  const downloadName = `${String(row.title).normalize("NFKD").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "DJ-Mack-Movie"}.mp4`;
  const downloadUrl = new URL(playbackUrl);
  downloadUrl.searchParams.set("download", downloadName);
  return {
    id: String(row.id),
    title: String(row.title),
    media_type: row.media_type === "series" ? "series" : "movie",
    synopsis: stripDjMackMarker(row.synopsis),
    poster_url: row.poster_url ? safeHttpsUrl(row.poster_url) || null : null,
    release_date: String(row.release_date || ""),
    playback_type: row.playback_type,
    playback_url: playbackUrl,
    ...(isDjMack ? {
      creator: "DJ Mack",
      dj: "DJ Mack",
      year: String(row.release_date || "").slice(0, 4),
      full_movie: true,
      dj_upload_movie: true,
      download_url: downloadUrl.href,
      official_download_url: downloadUrl.href,
      download_authorized: true,
      rights_url: rightsUrl,
      rights_notes: rightsNotes,
      rights_verified: true
    } : {})
  };
}

module.exports = { UUID, DJ_MACK_MARKER, isDjMackSynopsis, stripDjMackMarker, safeHttpsUrl, safeEmbedUrl, safePlaybackUrl, normalizeLibraryInput, toPublicLibraryItem };
