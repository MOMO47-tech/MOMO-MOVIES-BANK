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
  if (url.pathname === "/api/logout" && req.method === "POST") { res.setHeader("Set-Cookie", "momo_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"); return send(res, 200, { ok: true }); }
  if (url.pathname === "/api/enter") return send(res, 503, { error: "Preview pekee: weka secrets na Supabase kwenye Vercel ili kuwezesha kuingia." });
  if (url.pathname === "/api/movies") {
    const query = (url.searchParams.get("search") || "").toLowerCase();
    const detail = url.searchParams.get("detail");
    if (detail) {
      const movie = movies.find(item => String(item.id) === detail);
      return movie ? send(res, 200, { movie, source: "sample" }) : send(res, 404, { error: "Maelezo hayapatikani." });
    }
    const results = (url.searchParams.get("category") === "tv" ? [] : movies).filter(movie => !query || `${movie.title} ${movie.overview}`.toLowerCase().includes(query));
    return send(res, 200, { results, page: 1, hasMore: false, source: "sample" });
  }
  let pathname = decodeURIComponent(url.pathname);
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
