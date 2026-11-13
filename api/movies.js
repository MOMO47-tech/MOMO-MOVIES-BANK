"use strict";

const fallback = require("../data/fallback-movies.json");
const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const ROUTES = {
  trending: "/trending/movie/week",
  popular: "/movie/popular",
  top_rated: "/movie/top_rated",
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
    release_year: String(item.release_date || item.first_air_date || "").match(/^\d{4}/)?.[0] || null,
    poster_path: image(item.poster_path),
    backdrop_path: image(item.backdrop_path, "w1280"),
    vote_average: Number(item.vote_average) || null,
    popularity: Number(item.popularity) || 0,
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
  if (["popular", "top_rated", "trending"].includes(category)) results = fallback.filter(item => item.media_type !== "tv");
  if (category === "horror") results = fallback.filter(item => (item.genre_ids || []).includes(27) || /horror|kutisha/i.test(item.genre || ""));
  if (category === "action") results = fallback.filter(item => (item.genre_ids || []).includes(28) || /action|fight|combat|mapigano/i.test(item.genre || ""));
  if (category === "animation") results = fallback.filter(item => (item.genre_ids || []).includes(16) || /animation|cartoon|katuni/i.test(item.genre || ""));
  if (category === "now_playing") {
    const { year } = tanzaniaDateParts();
    results = fallback.filter(item => String(item.release_date || item.first_air_date || "").startsWith(`${year}-`));
  }
  if (query) {
    const needle = query.toLocaleLowerCase();
    results = results.filter(item => `${item.title} ${item.name || ""} ${item.overview} ${item.genre || ""}`.toLocaleLowerCase().includes(needle));
  }
  return results.filter(isReleased);
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
function pickTrailer(detail) {
  const videos = detail.videos?.results || [];
  const video = videos.find(item => item.site === "YouTube" && item.type === "Trailer" && item.official) || videos.find(item => item.site === "YouTube" && item.type === "Trailer");
  return video ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}` : null;
}
function tanzaniaDateParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(parts.year), today: `${parts.year}-${parts.month}-${parts.day}` };
}
function isReleased(item) {
  const date = String(item.release_date || item.first_air_date || "").slice(0, 10);
  return !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= tanzaniaDateParts().today;
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
    if (category === "home") {
      const movies = fallback.filter(item => item.media_type !== "tv" && isReleased(item)).slice(0, 10);
      const series = fallback.filter(item => item.media_type === "tv" && isReleased(item)).slice(0, 10);
      return sendJson(res, 200, { shelves: { top_rated: movies, popular_series: series, popular_movies: movies, trending: movies }, source: "sample", error: "TMDB_API_KEY_MISSING" });
    }
    const results = fallbackResults(query, category);
    return sendJson(res, 200, { results, page: 1, hasMore: false, source: "sample", error: "TMDB_API_KEY_MISSING" });
  }
  try {
    if (detailId) {
      if (!/^\d{1,12}$/.test(detailId)) return sendJson(res, 400, { error: "ID ya filamu si sahihi." });
      const detail = await tmdb(`/${type}/${detailId}`, { append_to_response: "videos" });
      const movie = normalize({ ...detail, media_type: type });
      movie.trailer_url = pickTrailer(detail);
      return sendJson(res, 200, { movie, source: "tmdb" });
    }
    if (category === "home") {
      const safeList = async route => {
        try {
          const payload = await tmdb(route, { page: 1, region: process.env.TMDB_WATCH_REGION || "TZ" });
          return (payload.results || []).filter(item => item.media_type !== "person" && isReleased(item)).slice(0, 10).map(normalize);
        } catch { return []; }
      };
      const [topRated, popularSeries, popularMovies, trending] = await Promise.all([
        safeList("/movie/top_rated"),
        safeList("/tv/popular"),
        safeList("/movie/popular"),
        safeList("/trending/movie/week")
      ]);
      return sendJson(res, 200, { shelves: { top_rated: topRated, popular_series: popularSeries, popular_movies: popularMovies, trending }, source: "tmdb" });
    }
    let payload;
    if (query) payload = await tmdb("/search/multi", { query, include_adult: "false", page });
    else if (category === "animation") {
      const [movieData, tvData] = await Promise.all([
        tmdb("/discover/movie", { with_genres: 16, sort_by: "popularity.desc", include_adult: "false", page }),
        tmdb("/discover/tv", { with_genres: 16, sort_by: "popularity.desc", page })
      ]);
      const results = [
        ...(movieData.results || []).filter(isReleased).map(item => normalize({ ...item, media_type: "movie" })),
        ...(tvData.results || []).filter(isReleased).map(item => normalize({ ...item, media_type: "tv" }))
      ].sort((a, b) => b.popularity - a.popularity);
      return sendJson(res, 200, {
        results,
        page,
        hasMore: Number(movieData.total_pages) > page || Number(tvData.total_pages) > page,
        source: "tmdb"
      });
    }
    else if (category === "horror" || category === "action") {
      payload = await tmdb("/discover/movie", {
        with_genres: category === "horror" ? 27 : 28,
        sort_by: "popularity.desc",
        include_adult: "false",
        page
      });
    }
    else if (category === "now_playing") {
      const { year, today } = tanzaniaDateParts();
      payload = await tmdb("/discover/movie", {
        primary_release_year: year,
        "release_date.lte": today,
        sort_by: "primary_release_date.desc",
        include_adult: "false",
        region: process.env.TMDB_WATCH_REGION || "TZ",
        page
      });
    } else payload = await tmdb(ROUTES[category] || ROUTES.trending, { page, region: process.env.TMDB_WATCH_REGION || "TZ" });
    const rows = (payload.results || []).filter(item => item.media_type !== "person" && isReleased(item)).map(normalize);
    return sendJson(res, 200, { results: rows, page, hasMore: Number(payload.total_pages) > page, source: "tmdb" });
  } catch {
    if (detailId) return sendJson(res, 502, { error: "TMDB_UNAVAILABLE", message: "Maelezo ya filamu hayapatikani kwa sasa." });
    return sendJson(res, 502, { results: [], page, hasMore: false, error: "TMDB_UNAVAILABLE", message: "Movie service haipatikani kwa sasa." });
  }
};
