"use strict";

const fallback = require("../data/fallback-movies.json");
const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const ROUTES = {
  trending: "/trending/movie/week",
  popular: "/movie/popular",
  top_rated: "/movie/top_rated",
  now_playing: "/movie/now_playing",
  tv: "/tv/popular"
};

function image(path, size = "w500") { return path ? `${IMAGE_BASE}/${size}${path}` : null; }
function normalize(item) {
  return {
    id: item.id,
    media_type: item.media_type || (item.name ? "tv" : "movie"),
    title: item.title || item.name || "Untitled",
    overview: item.overview || "",
    release_date: item.release_date || item.first_air_date || "",
    poster_path: image(item.poster_path),
    backdrop_path: image(item.backdrop_path, "w1280"),
    vote_average: Number(item.vote_average) || null,
    genre_ids: item.genre_ids || [],
    runtime: item.runtime || null
  };
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "public, max-age=300, stale-while-revalidate=600" : "no-store");
  res.end(JSON.stringify(body));
}
function fallbackResults(query, category) {
  let results = fallback;
  if (category === "tv") results = fallback.filter(item => item.media_type === "tv");
  if (query) {
    const needle = query.toLocaleLowerCase();
    results = results.filter(item => `${item.title} ${item.name || ""} ${item.overview} ${item.genre || ""}`.toLocaleLowerCase().includes(needle));
  }
  return results;
}
async function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("TMDB_REQUEST_FAILED");
  return response.json();
}
function pickProviders(detail) {
  const region = (process.env.TMDB_WATCH_REGION || "TZ").toUpperCase();
  const regional = detail["watch/providers"]?.results?.[region];
  if (!regional) return [];
  const rows = [...(regional.flatrate || []), ...(regional.free || []), ...(regional.ads || []), ...(regional.rent || []), ...(regional.buy || [])];
  const unique = new Map();
  rows.forEach(provider => unique.set(provider.provider_id, { name: provider.provider_name, link: regional.link || "https://www.themoviedb.org/" }));
  return [...unique.values()];
}
function pickTrailer(detail) {
  const videos = detail.videos?.results || [];
  const video = videos.find(item => item.site === "YouTube" && item.type === "Trailer" && item.official) || videos.find(item => item.site === "YouTube" && item.type === "Trailer");
  return video ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}` : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return sendJson(res, 405, { error: "Method not allowed" }); }
  const query = String(req.query?.search || "").trim().slice(0, 120);
  const category = String(req.query?.category || "trending");
  const detailId = String(req.query?.detail || "");
  const type = req.query?.type === "tv" ? "tv" : "movie";
  const page = Math.max(1, Math.min(500, Number.parseInt(req.query?.page, 10) || 1));
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    if (detailId) {
      const movie = fallback.find(item => String(item.id) === detailId);
      return movie ? sendJson(res, 200, { movie, source: "sample" }) : sendJson(res, 404, { error: "Maelezo hayapatikani." });
    }
    const results = fallbackResults(query, category);
    return sendJson(res, 200, { results, page: 1, hasMore: false, source: "sample", error: "TMDB_API_KEY_MISSING" });
  }
  try {
    if (detailId) {
      if (!/^\d{1,12}$/.test(detailId)) return sendJson(res, 400, { error: "ID ya filamu si sahihi." });
      const detail = await tmdb(`/${type}/${detailId}`, { append_to_response: "videos,watch/providers" });
      const movie = normalize({ ...detail, media_type: type });
      movie.trailer_url = pickTrailer(detail);
      movie.providers = pickProviders(detail);
      return sendJson(res, 200, { movie, source: "tmdb" });
    }
    let payload;
    if (query) payload = await tmdb("/search/multi", { query, include_adult: "false", page });
    else payload = await tmdb(ROUTES[category] || ROUTES.trending, { page, region: process.env.TMDB_WATCH_REGION || "TZ" });
    const rows = (payload.results || []).filter(item => item.media_type !== "person").map(normalize);
    return sendJson(res, 200, { results: rows, page, hasMore: Number(payload.total_pages) > page, source: "tmdb" });
  } catch {
    if (detailId) return sendJson(res, 502, { error: "TMDB_UNAVAILABLE", message: "Maelezo ya filamu hayapatikani kwa sasa." });
    return sendJson(res, 502, { results: [], page, hasMore: false, error: "TMDB_UNAVAILABLE", message: "Movie service haipatikani kwa sasa." });
  }
};
