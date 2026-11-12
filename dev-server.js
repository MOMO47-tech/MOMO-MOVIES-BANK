"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const ROOT = __dirname;
const movies = require("./data/fallback-movies.json");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
function send(res, status, body, type = "application/json; charset=utf-8") { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/session") return send(res, 200, { authenticated: false });
  if (url.pathname === "/api/member-count") return send(res, 200, { count: null });
  if (url.pathname === "/api/comments") return send(res, 401, { error: "Local preview does not provide member sessions or persistent comments." });
  if (url.pathname === "/api/admin-comments") return send(res, 401, { error: "Local preview does not provide Supabase admin sessions or persistent comments." });
  if (url.pathname === "/api/admin-auth" && req.method === "GET") return send(res, 200, { authenticated: false });
  if (url.pathname === "/api/admin-auth" && req.method === "DELETE") return send(res, 200, { ok: true });
  if (url.pathname === "/api/admin-auth") return send(res, 503, { error: "Preview pekee: admin Auth huhitaji Supabase iliyosanidiwa." });
  if (url.pathname === "/api/library") return send(res, 200, { items: [] });
  if (url.pathname === "/api/admin-library") return send(res, 503, { error: "Preview pekee: hifadhidata ya admin huhitaji Supabase iliyosanidiwa." });
  if (url.pathname === "/api/logout" && req.method === "POST") { res.setHeader("Set-Cookie", "momo_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"); return send(res, 200, { ok: true }); }
  if (url.pathname === "/api/enter") return send(res, 503, { error: "Preview pekee: weka secrets na Supabase kwenye Vercel ili kuwezesha kuingia." });
  if (url.pathname === "/api/movies") {
    const query = (url.searchParams.get("search") || "").toLowerCase();
    const category = url.searchParams.get("category") || "trending";
    const detail = url.searchParams.get("detail");
    if (detail) {
      const movie = movies.find(item => String(item.id) === detail);
      return movie ? send(res, 200, { movie, source: "sample" }) : send(res, 404, { error: "Maelezo hayapatikani." });
    }
    let catalogue = movies;
    if (category === "tv") catalogue = movies.filter(movie => movie.media_type === "tv");
    if (category === "horror") catalogue = movies.filter(movie => /horror|kutisha/i.test(movie.genre || ""));
    if (category === "action") catalogue = movies.filter(movie => /action|fight|combat|mapigano/i.test(movie.genre || ""));
    if (category === "animation") catalogue = movies.filter(movie => /animation|cartoon|katuni/i.test(movie.genre || ""));
    if (category === "now_playing") {
      const year = new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", year: "numeric" }).format(new Date());
      catalogue = movies.filter(movie => String(movie.release_date || movie.first_air_date || "").startsWith(`${year}-`));
    }
    const results = catalogue.filter(movie => !query || `${movie.title} ${movie.overview} ${movie.genre || ""}`.toLowerCase().includes(query));
    return send(res, 200, { results, page: 1, hasMore: false, source: "sample", error: "TMDB_API_KEY_MISSING" });
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";
  if (pathname === "/") pathname = "/index.html";
  const target = path.resolve(ROOT, `.${pathname}`);
  if (!target.startsWith(`${ROOT}${path.sep}`)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  fs.readFile(target, (error, contents) => {
    if (error) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    let body = contents;
    if (pathname === "/index.html") body = contents.toString("utf8").replace("</head>", "<script>window.MOMO_LOCAL_PREVIEW=true;</script></head>");
    res.writeHead(200, { "Content-Type": MIME[path.extname(target)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(body);
  });
});
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`MOMO local preview listening on ${port}`));
