(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { category: "popular", query: "", movies: [], shelfMovies: new Map(), openMovies: [], library: [], djItems: [], selected: null, page: 1, busy: false, requestId: 0, activeController: null };
  const localPreview = Boolean(window.MOMO_LOCAL_PREVIEW);

  const fallbackMovies = [
    { id: "metropolis-1927", media_type: "movie", title: "Metropolis", overview: "In a futuristic city divided by class, an inventor and a worker try to unite a fractured society.", release_date: "1927-01-10", poster_path: null, vote_average: null, genre: "SCI-FI CLASSIC" },
    { id: "nosferatu-1922", media_type: "movie", title: "Nosferatu", overview: "A silent horror story about a mysterious visitor and a shadow over a distant town.", release_date: "1922-03-04", poster_path: null, vote_average: null, genre: "SILENT HORROR" },
    { id: "the-general-1926", media_type: "movie", title: "The General", overview: "A train engineer faces a comic adventure during the American Civil War.", release_date: "1926-12-25", poster_path: null, vote_average: null, genre: "ACTION / CLASSIC COMEDY" },
    { id: "sherlock-jr-1924", media_type: "movie", title: "Sherlock Jr.", overview: "A projectionist dreams of becoming a detective as cinema and real life collide.", release_date: "1924-04-21", poster_path: null, vote_average: null, genre: "SILENT COMEDY" },
    { id: "caligari-1920", media_type: "movie", title: "The Cabinet of Dr. Caligari", overview: "A mysterious tale of sleep, secrets and strange events in an old town.", release_date: "1920-02-26", poster_path: null, vote_average: null, genre: "EXPRESSIONIST" },
    { id: "phantom-1925", media_type: "movie", title: "The Phantom of the Opera", overview: "A young singer attracts the attention of a mysterious figure beneath an opera house.", release_date: "1925-09-06", poster_path: null, vote_average: null, genre: "SILENT DRAMA" },
    { id: "haxan-1922", media_type: "movie", title: "Häxan", overview: "A distinctive blend of drama and documentary exploring the history of belief and superstition.", release_date: "1922-09-18", poster_path: null, vote_average: null, genre: "DOCUMENTARY CLASSIC" },
    { id: "safety-last-1923", media_type: "movie", title: "Safety Last!", overview: "A young man faces comic challenges with work, city life and romance.", release_date: "1923-04-01", poster_path: null, vote_average: null, genre: "CLASSIC COMEDY" },
    { id: "prince-achmed-1926", media_type: "movie", title: "The Adventures of Prince Achmed", overview: "Lotte Reiniger's landmark silhouette-animated fairy tale.", release_date: "1926-09-02", poster_path: null, vote_average: null, genre: "ANIMATION / CLASSIC" }
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function yearOf(movie) {
    const date = movie.release_date || movie.first_air_date || "";
    const match = String(date).match(/^\d{4}/);
    return match ? match[0] : "";
  }
  function currentTanzaniaYear() {
    return new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", year: "numeric" }).format(new Date());
  }
  function titleOf(movie) { return movie.title || movie.name || "Untitled"; }
  function categoryTitle(category) {
    return {
      trending: "Trending Now",
      popular: "Popular Movies",
      top_rated: "Top Rated Movies",
      now_playing: "New Releases",
      watchlist: "My List",
      tv: "Series",
      horror: "Horror",
      action: "Action",
      animation: "Animation"
    }[category] || "Movies";
  }
  function activateCategory(category, scrollTarget = "complete-catalog") {
    state.category = category;
    state.query = "";
    state.page = 1;
    $("#catalog-view").classList.remove("is-searching");
    $("#search-input").value = "";
    const categoryNavExists = Boolean($(`.nav-link[data-category="${category}"]`));
    $$(".nav-link").forEach(link => link.classList.toggle("is-active", categoryNavExists ? link.dataset.category === category : (!link.dataset.category && link.dataset.section === scrollTarget)));
    $$(".genre-chip").forEach(chip => {
      const active = chip.dataset.category === category;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    $("#section-title").textContent = categoryTitle(category);
    loadCatalog();
    document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function watchlist() {
    try {
      const saved = JSON.parse(localStorage.getItem("momo-watchlist") || "[]");
      return Array.isArray(saved) ? saved.filter(item => item && (typeof item.id === "string" || Number.isSafeInteger(item.id))).slice(-150) : [];
    } catch { return []; }
  }
  function watchlistKey(movie) {
    const type = movie?.media_type === "tv" || movie?.type === "tv" ? "tv" : "movie";
    return `${type}:${String(movie?.id || "")}`;
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    let data = {};
    try { data = await response.json(); } catch { /* a server error may not be JSON */ }
    if (!response.ok) throw Object.assign(new Error(data.error || "Request failed. Please try again."), { status: response.status, data });
    return data;
  }

  function showGate(message = "", success = false) {
    $("#catalog-view").hidden = true;
    $("#gate-view").hidden = false;
    const status = $("#login-message");
    status.textContent = message;
    status.classList.toggle("is-success", success);
  }
  function showCatalog() {
    $("#gate-view").hidden = true;
    $("#catalog-view").hidden = false;
    $("#catalog-view").classList.remove("is-searching");
    renderCount();
    loadCatalog();
    loadHomeShelves();
    loadOpenMovies();
    loadLibrary();
    loadTranslations();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function renderCount() {
    const label = $("#member-count-value");
    const panel = $("#member-count");
    const status = $("#member-count-status");
    try {
      const data = await request("/api/member-count");
      if (Number.isInteger(data.count)) {
        label.textContent = new Intl.NumberFormat("en-US").format(data.count);
        panel.dataset.state = "live";
        status.textContent = "LIVE";
        label.removeAttribute("title");
      } else {
        label.textContent = "—";
        panel.dataset.state = "pending";
        status.textContent = "SYNCING";
        label.title = "Member count is not available yet.";
      }
    } catch {
      label.textContent = "—";
      panel.dataset.state = "offline";
      status.textContent = "OFFLINE";
      label.title = "Member count could not be loaded.";
    }
  }

  function movieType(movie) { return movie?.media_type === "tv" || movie?.type === "tv" ? "tv" : "movie"; }
  function findMovie(id, type) {
    const kind = type === "tv" ? "tv" : "movie";
    return state.movies.find(item => String(item.id) === String(id) && movieType(item) === kind)
      || state.shelfMovies.get(`${kind}:${String(id)}`)
      || state.openMovies.find(item => String(item.id) === String(id))
      || fallbackMovies.find(item => String(item.id) === String(id))
      || null;
  }
  function bindMovieCards(container) {
    $(".movie-card__open", container) && $$(".movie-card__open", container).forEach(button => button.addEventListener("click", () => openDetails(button.dataset.movieId, button.dataset.movieType, true)));
    $$("[data-watchlist-toggle]", container).forEach(button => button.addEventListener("click", () => {
      const movie = findMovie(button.dataset.movieId, button.dataset.movieType);
      if (movie) toggleWatchlist(movie);
    }));
  }
  function renderShelf(trackId, sectionId, rows) {
    const track = $(`#${trackId}`);
    const section = $(`#${sectionId}`);
    if (!track || !section) return;
    const items = Array.isArray(rows) ? rows.slice(0, 10) : [];
    section.hidden = !items.length;
    track.setAttribute("aria-busy", "false");
    if (!items.length) { track.replaceChildren(); return; }
    items.forEach(item => state.shelfMovies.set(`${movieType(item)}:${String(item.id)}`, item));
    track.innerHTML = items.map(item => movieCard(item, true)).join("");
    bindMovieCards(track);
  }
  async function loadHomeShelves() {
    const groups = [
      ["top_rated", "top-rated-track", "top-rated-shelf"],
      ["popular_series", "popular-series-track", "popular-series-shelf"],
      ["popular_movies", "popular-movies-track", "popular-movies-shelf"],
      ["trending", "trending-track", "trending-shelf"]
    ];
    state.shelfMovies.clear();
    groups.forEach(([, trackId]) => $(`#${trackId}`)?.setAttribute("aria-busy", "true"));
    try {
      const data = await request("/api/movies?category=home");
      const shelves = data.shelves || {};
      groups.forEach(([key, trackId, sectionId]) => renderShelf(trackId, sectionId, shelves[key]));
    } catch {
      groups.forEach(([, trackId, sectionId]) => renderShelf(trackId, sectionId, []));
    }
  }

  function safeOpenMovieFile(value) {
    const safe = safeExternalLink(value);
    if (!safe) return "";
    try {
      const url = new URL(safe);
      const host = url.hostname.toLowerCase();
      const archiveHost = host === "archive.org" || host.endsWith(".archive.org");
      return archiveHost && /\.mp4$/i.test(url.pathname) ? url.href : "";
    } catch { return ""; }
  }
  function verifiedOpenMovie(movie) {
    if (!movie || movie.open_movie !== true || movie.rights_verified !== true || movie.download_authorized !== true) return null;
    if (!safeExternalLink(movie.license_url) || !safeExternalLink(movie.rights_url) || !safeExternalLink(movie.source_url)) return null;
    if (!String(movie.license || "").trim() || !String(movie.rights_notes || "").trim() || !String(movie.attribution_text || "").trim()) return null;
    const playbackUrl = safeOpenMovieFile(movie.playback_url);
    const downloadUrl = safeOpenMovieFile(movie.download_url);
    if (!playbackUrl || !downloadUrl || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(movie.id || ""))) return null;
    return { ...movie, playback_url: playbackUrl, download_url: downloadUrl };
  }
  function renderOpenMovies(items) {
    const section = $("#open-movies-shelf");
    const track = $("#open-movies-track");
    if (!section || !track) return;
    state.openMovies = (Array.isArray(items) ? items : []).map(verifiedOpenMovie).filter(Boolean);
    section.hidden = state.openMovies.length === 0;
    track.innerHTML = state.openMovies.map(movie => {
      const title = escapeHtml(titleOf(movie));
      const poster = safeExternalLink(movie.poster_path || movie.poster_url || "");
      const year = yearOf(movie);
      const runtime = Number.isFinite(Number(movie.runtime_minutes)) && Number(movie.runtime_minutes) > 0 ? `${Math.round(Number(movie.runtime_minutes))} MIN` : "";
      const saved = watchlist().some(item => watchlistKey(item) === watchlistKey(movie));
      const size = escapeHtml(movie.download_size_label || "FILE DOWNLOAD");
      return `<article class="open-film-card movie-card--rail"><button class="open-film-card__play" type="button" data-open-film-play="${escapeHtml(movie.id)}" aria-label="Play ${title} in MOMO"><span class="open-film-card__poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster for ${title}" onerror="this.remove()">` : `<span class="poster-placeholder"><span class="poster-title">${title}</span></span>`}<span class="poster-play" aria-hidden="true">▶ PLAY</span><span class="poster-kind">FULL FILM</span></span></button><div class="open-film-card__body"><p class="movie-meta">${year ? `<span>${escapeHtml(year)}</span>` : ""}${runtime ? `<span>${runtime}</span>` : ""}</p><h3>${title}</h3><p class="open-film-card__license"><a href="${escapeHtml(movie.license_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(movie.license)}</a> · <a href="${escapeHtml(movie.rights_url)}" target="_blank" rel="noopener noreferrer">RIGHTS &amp; TERMS</a> · <a href="${escapeHtml(movie.source_url)}" target="_blank" rel="noopener noreferrer">FILE SOURCE</a></p><p class="open-film-card__credit">${escapeHtml(movie.attribution_text)}</p><div class="open-film-card__actions"><button class="button button--ghost" type="button" data-open-film-play="${escapeHtml(movie.id)}">▶ PLAY HERE</button><a class="button button--primary" data-open-film-download="${escapeHtml(movie.id)}" href="${escapeHtml(movie.download_url)}" target="_blank" rel="noopener noreferrer" download>DOWNLOAD ↓</a></div><p class="open-film-card__size">${size} · ADDED TO MY LIST WHEN DOWNLOADING</p><button class="watchlist-toggle" type="button" data-watchlist-toggle data-movie-id="${escapeHtml(movie.id)}" data-movie-type="movie" aria-pressed="${saved}" aria-label="${saved ? "Remove from My List" : "Add to My List"}" title="${saved ? "Remove from My List" : "Add to My List"}">${saved ? "♥" : "♡"}</button></div></article>`;
    }).join("");
    $$('[data-open-film-play]', track).forEach(button => button.addEventListener("click", () => {
      const movie = state.openMovies.find(item => String(item.id) === button.dataset.openFilmPlay);
      if (movie) playOpenMovie(movie, true);
    }));
    $$('[data-open-film-download]', track).forEach(link => link.addEventListener("click", event => {
      const movie = state.openMovies.find(item => String(item.id) === link.dataset.openFilmDownload);
      if (!movie) { event.preventDefault(); return; }
      const alreadySaved = watchlist().some(item => watchlistKey(item) === watchlistKey(movie));
      if (!alreadySaved && !toggleWatchlist(movie)) event.preventDefault();
    }));
    bindMovieCards(track);
  }
  async function loadOpenMovies() {
    const section = $("#open-movies-shelf");
    if (section) section.hidden = true;
    try {
      const response = await fetch("/data/open-movies.json", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("OPEN_MOVIES_UNAVAILABLE");
      const data = await response.json();
      renderOpenMovies(data.items);
    } catch { renderOpenMovies([]); }
  }

  async function loadCatalog() {
    const requestId = ++state.requestId;
    state.activeController?.abort();
    const controller = new AbortController();
    state.activeController = controller;
    state.busy = true;
    $("#catalog-message").textContent = "";
    $("#section-title").textContent = state.query ? `Results for “${state.query}”` : categoryTitle(state.category);
    if (state.category === "watchlist" && !state.query) {
      state.activeController = null;
      state.busy = false;
      state.movies = watchlist();
      renderMovies(state.movies);
      $("#load-more").hidden = true;
      $("#catalog-message").textContent = state.movies.length ? "Saved on this device." : "Your list is empty.";
      return;
    }
    try {
      const params = new URLSearchParams();
      if (state.query) params.set("search", state.query);
      else params.set("category", state.category === "watchlist" ? "popular" : state.category);
      params.set("page", String(state.page));
      const data = await request(`/api/movies?${params.toString()}`, { signal: controller.signal });
      if (controller.signal.aborted || requestId !== state.requestId) return;
      let movies = Array.isArray(data.results) ? data.results : [];
      if (state.category === "watchlist") {
        const saved = new Set(watchlist().map(item => String(item.id)));
        movies = movies.filter(item => saved.has(String(item.id)));
        const current = watchlist();
        if (movies.length === 0 && current.length) movies = current;
      }
      const appendPage = state.page > 1 && !state.query && state.category !== "watchlist";
      if (appendPage) {
        const keyOf = item => `${item.media_type || (item.name ? "tv" : "movie")}:${item.id}`;
        const seen = new Set(state.movies.map(keyOf));
        state.movies = [...state.movies, ...movies.filter(item => !seen.has(keyOf(item)))];
      } else state.movies = movies;
      renderMovies(state.movies);
      $("#load-more").hidden = !data.hasMore || Boolean(state.query) || state.category === "watchlist";
      const needsTmdbKey = data.error === "TMDB_API_KEY_MISSING" || data.source === "sample";
      if (needsTmdbKey) {
        $("#catalog-message").textContent = "Movie catalog is unavailable. Please try again later.";
      } else if (!movies.length) {
        $("#catalog-message").textContent = state.category === "watchlist" ? "Your list is empty." : "No titles found.";
      }
    } catch (error) {
      if (controller.signal.aborted || requestId !== state.requestId) return;
      const needle = state.query.toLocaleLowerCase();
      const samples = state.category === "watchlist" ? watchlist() : fallbackMovies.filter(item => {
        if (state.category === "tv") return item.media_type === "tv";
        if (state.category === "horror") return (item.genre_ids || []).includes(27) || /horror|kutisha/i.test(item.genre || "");
        if (state.category === "action") return (item.genre_ids || []).includes(28) || /action|fight|combat|mapigano/i.test(item.genre || "");
        if (state.category === "animation") return (item.genre_ids || []).includes(16) || /animation|cartoon|katuni/i.test(item.genre || "");
        if (state.category === "now_playing") return String(item.release_date || item.first_air_date || "").startsWith(`${currentTanzaniaYear()}-`);
        return !needle || `${titleOf(item)} ${item.overview} ${item.genre || ""}`.toLocaleLowerCase().includes(needle);
      });
      state.movies = samples;
      renderMovies(samples);
      $("#load-more").hidden = true;
      $("#catalog-message").textContent = "The catalog is temporarily unavailable.";
    } finally {
      if (state.activeController === controller) state.busy = false;
    }
  }

  function movieCard(movie, inRail = false) {
    const title = titleOf(movie);
    const poster = movie.poster_path || movie.poster || "";
    const isTv = movie.media_type === "tv" || movie.type === "tv";
    const canRequestTrailer = Boolean(movie.trailer_url) || /^\d{1,12}$/.test(String(movie.id));
    const playLabel = canRequestTrailer ? "▶ PLAY" : "DETAILS";
    const cardLabel = canRequestTrailer ? `Play the ${title} trailer in MOMO` : `Open details for ${title} in MOMO`;
    const rating = Number(movie.vote_average) > 0 ? `★ ${Number(movie.vote_average).toFixed(1)}` : "";
    const year = yearOf(movie);
    const saved = watchlist().some(item => watchlistKey(item) === watchlistKey(movie));
    const saveLabel = saved ? "♥" : "♡";
    return `<article class="movie-card${inRail ? " movie-card--rail" : ""}">
      <button class="movie-card__open" type="button" data-movie-id="${escapeHtml(movie.id)}" data-movie-type="${isTv ? "tv" : "movie"}" aria-label="${escapeHtml(cardLabel)}">
        <div class="poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster for ${escapeHtml(title)}" onerror="this.remove()">` : `<span class="poster-placeholder"><span class="poster-title">${escapeHtml(title)}</span></span>`}<span class="poster-play" aria-hidden="true">${playLabel}</span><span class="poster-kind">${isTv ? "SERIES" : "MOVIE"}</span></div>
        <h3>${escapeHtml(title)}</h3><p class="movie-meta">${year ? `<span>${escapeHtml(year)}</span>` : ""}${rating ? `<span class="movie-rating">${escapeHtml(rating)}</span>` : ""}</p>
      </button>
      <button class="watchlist-toggle" type="button" data-watchlist-toggle data-movie-id="${escapeHtml(movie.id)}" data-movie-type="${isTv ? "tv" : "movie"}" aria-pressed="${saved}" aria-label="${saved ? "Remove from My List" : "Add to My List"}" title="${saved ? "Remove from My List" : "Add to My List"}">${saveLabel}</button>
    </article>`;
  }
  function renderMovies(movies) {
    const grid = $("#movie-grid");
    grid.innerHTML = movies.length ? movies.map(movie => movieCard(movie)).join("") : `<div class="empty-state">No titles found.</div>`;
    bindMovieCards(grid);
    if (movies.length && !state.query && state.page === 1 && state.category !== "watchlist") {
      const lead = movies[0];
      const year = yearOf(lead);
      $("#hero-title").innerHTML = `${escapeHtml(titleOf(lead))}${year ? `<br><span>${escapeHtml(year)}</span>` : ""}`;
      $("#hero-overview").textContent = lead.overview || "Browse movie details and watch trailers here on MOMO.";
      state.selected = lead;
      $("#hero-trailer").textContent = Boolean(lead.trailer_url) || /^\d{1,12}$/.test(String(lead.id)) ? "▶ PLAY TRAILER" : "MOVIE DETAILS";
      const backdrop = lead.backdrop_path || lead.backdrop;
      const heroArt = $("#hero-art");
      if (backdrop) {
        heroArt.style.backgroundImage = `url("${backdrop.replace(/["\\]/g, "")}")`;
        heroArt.classList.add("has-backdrop");
      } else {
        heroArt.style.backgroundImage = "";
        heroArt.classList.remove("has-backdrop");
      }
    } else if (!movies.length && !state.query) {
      state.selected = null;
    }
  }
  function safeExternalLink(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }
  function directDownloadUrl(value) {
    const safe = safeExternalLink(value);
    if (!safe) return "";
    return /\.(mp4|webm)$/i.test(new URL(safe).pathname) ? safe : "";
  }
  function authorizedMovieDownload(movie) {
    if (movie?.download_authorized !== true || movie?.rights_verified !== true) return "";
    if (!safeExternalLink(movie?.rights_url) || typeof movie?.rights_notes !== "string" || !movie.rights_notes.trim()) return "";
    return directDownloadUrl(movie?.download_url);
  }
  function renderTranslations(items) {
    const section = $("#tz-translations");
    const grid = $("#translation-grid");
    if (!grid || !section) return;
    const rows = Array.isArray(items) ? items : [];
    state.djItems = rows;
    const playableRows = rows.map((item, index) => ({ item, index })).filter(({ item }) => youtubeVideoId(item.preview_url || item.official_watch_url));
    section.hidden = !playableRows.length;
    if (!playableRows.length) { grid.replaceChildren(); return; }
    const groups = new Map();
    playableRows.forEach(({ item, index }) => {
      const name = String(item.dj || "DJ Creator").trim() || "DJ Creator";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({ item, index });
    });
    grid.innerHTML = [...groups.entries()].map(([dj, entries], groupIndex) => {
      const shelfTitleId = `dj-shelf-title-${groupIndex}`;
      const cards = entries.map(({ item, index }) => {
        const title = escapeHtml(item.title || "DJ Clip");
        const videoId = youtubeVideoId(item.preview_url || item.official_watch_url);
        const thumbnail = videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : "";
      const downloadUrl = authorizedTranslationDownload(item);
      const playAction = `<button class="button button--ghost" type="button" data-dj-play="${index}">▶ PLAY CLIP</button>`;
      const downloadAction = downloadUrl ? `<a class="button button--primary" href="${escapeHtml(downloadUrl)}" download>DOWNLOAD ↓</a>` : "";
      return `<article class="dj-movie-card"><div class="dj-movie-poster">${thumbnail ? `<img loading="lazy" src="${thumbnail}" alt="${title} clip poster" onerror="this.remove()">` : ""}<span class="dj-movie-poster__title">${title}</span><span class="dj-movie-poster__badge">CLIP</span></div><div class="dj-movie-card__body"><p class="eyebrow eyebrow--muted">${escapeHtml(dj)}${item.year ? ` · ${escapeHtml(item.year)}` : ""}</p><h4>${title}</h4><div class="dj-movie-actions">${playAction}${downloadAction}</div></div></article>`;
      }).join("");
      return `<section class="dj-movie-shelf" aria-labelledby="${shelfTitleId}"><header class="dj-movie-shelf__heading"><h3 id="${shelfTitleId}">${escapeHtml(dj)}</h3></header><div class="dj-movie-shelf__track">${cards}</div></section>`;
    }).join("");
    $$('[data-dj-play]', grid).forEach(button => button.addEventListener("click", () => playDjClip(Number(button.dataset.djPlay))));
  }
  function youtubeVideoId(value) {
    const safe = safeExternalLink(value);
    if (!safe) return "";
    try {
      const url = new URL(safe);
      let id = "";
      if (url.hostname === "youtu.be") id = url.pathname.slice(1);
      else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) && url.pathname === "/watch") id = url.searchParams.get("v") || "";
      return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
    } catch { return ""; }
  }
  function authorizedTranslationDownload(item) {
    if (!item || item.download_authorized !== true || item.rights_verified !== true) return "";
    if (!safeExternalLink(item.rights_url) || typeof item.rights_notes !== "string" || !item.rights_notes.trim()) return "";
    return directDownloadUrl(item.official_download_url);
  }
  function playDjClip(index) {
    const item = state.djItems[index];
    const videoId = item && youtubeVideoId(item.preview_url || item.official_watch_url);
    if (!item || !videoId) return;
    const title = String(item.title || "DJ Clip").slice(0, 160);
    const dj = String(item.dj || "DJ Creator").slice(0, 100);
    const key = `sample:dj-${videoId.toLowerCase()}`;
    const downloadUrl = authorizedTranslationDownload(item);
    const downloadMarkup = downloadUrl ? `<a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>DOWNLOAD ↓</a>` : "";
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    content.innerHTML = `<div class="dialog-backdrop"></div><div class="dialog-body dj-clip-dialog"><p class="dialog-kicker">DJ CLIP</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info"><span>${escapeHtml(dj)}</span>${item.year ? `<span>${escapeHtml(item.year)}</span>` : ""}</div><section class="inline-player" aria-label="DJ clip player"><div id="dj-clip-player" class="inline-player__frame"></div></section><div class="dialog-actions">${downloadMarkup}</div>${commentsMarkup(key)}</div>`;
    const iframe = document.createElement("iframe");
    iframe.title = `In-page DJ clip player: ${title}`;
    iframe.src = safeEmbedUrl(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`);
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.sandbox = "allow-scripts allow-same-origin allow-presentation";
    iframe.allow = "encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    $("#dj-clip-player", content).append(iframe);
    setupMovieComments($(".movie-comments", content), key, title);
    dialog.showModal();
  }
  async function loadTranslations() {
    try {
      const response = await fetch("/data/tanzania-translations.json", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("TRANSLATIONS_UNAVAILABLE");
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      renderTranslations(items);
    } catch { renderTranslations([]); }
  }
  function safeEmbedUrl(value) {
    const safe = safeExternalLink(value);
    if (!safe) return "";
    try {
      const url = new URL(safe);
      const youtube = url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[A-Za-z0-9_-]{6,20}$/.test(url.pathname);
      const vimeo = url.hostname === "player.vimeo.com" && /^\/video\/\d{1,12}$/.test(url.pathname);
      return youtube || vimeo ? url.href : "";
    } catch { return ""; }
  }
  function commentKey(movie, id, type = "movie") {
    const movieType = movie?.media_type === "tv" || type === "tv" ? "tv" : "movie";
    const movieId = String(movie?.id ?? id ?? "");
    return /^\d{1,12}$/.test(movieId) ? `tmdb:${movieType}:${movieId}` : `sample:${movieId}`;
  }
  function commentsMarkup(key) {
    return `<section class="movie-comments" data-comment-key="${escapeHtml(key)}" aria-labelledby="comments-title"><div class="movie-comments__terminal"><span class="terminal-lights" aria-hidden="true"><i></i><i></i><i></i></span><span>momo@comments:~</span><b>AUTH://MEMBERS</b></div><div class="movie-comments__inner"><p class="movie-comments__eyebrow">// MOVIE DISCUSSION</p><h3 id="comments-title">COMMUNITY COMMENTS</h3><p class="movie-comments__hint">One comment per member. Submit again to update yours.</p><p class="movie-comments__status" role="status" aria-live="polite"></p><div class="movie-comments__list" aria-live="polite"><p class="movie-comments__empty">CONNECTING TO COMMENT FEED…</p></div><form class="movie-comments__form"><label for="movie-comment-input">ADD YOUR COMMENT</label><textarea id="movie-comment-input" name="text" maxlength="1000" rows="3" placeholder="Write a comment…" required></textarea><div class="movie-comments__form-footer"><span>MAX 1000 CHARACTERS</span><button class="button button--primary" type="submit">POST COMMENT ↗</button></div></form></div></section>`;
  }
  function renderComments(section, comments) {
    const list = $(".movie-comments__list", section);
    if (!Array.isArray(comments) || comments.length === 0) {
      list.innerHTML = `<p class="movie-comments__empty">NO TRANSMISSIONS YET // START THE DISCUSSION</p>`;
      return;
    }
    list.innerHTML = comments.map(comment => {
      const timestamp = new Date(comment.created_at);
      const date = Number.isNaN(timestamp.getTime()) ? "" : timestamp.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      return `<article class="movie-comment"><header><strong>${escapeHtml(comment.author || "MEMBER")}</strong><time>${escapeHtml(date)}</time></header><p>${escapeHtml(comment.text || "")}</p></article>`;
    }).join("");
  }
  async function setupMovieComments(section, key, title) {
    const list = $(".movie-comments__list", section);
    const status = $(".movie-comments__status", section);
    const form = $(".movie-comments__form", section);
    const load = async () => {
      try {
        const data = await request(`/api/comments?movie=${encodeURIComponent(key)}`);
        if (!section.isConnected) return [];
        renderComments(section, data.comments);
        return Array.isArray(data.comments) ? data.comments : [];
      } catch (error) {
        if (!section.isConnected) return [];
        list.innerHTML = `<p class="movie-comments__empty">${error.status === 401 ? "SESSION EXPIRED // LOG IN AGAIN TO VIEW COMMENTS" : "COMMENT FEED OFFLINE // TRY AGAIN LATER"}</p>`;
        return [];
      }
    };
    await load();
    if (!section.isConnected) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const field = $("textarea[name='text']", form);
      const button = $("button[type='submit']", form);
      const text = field.value.trim();
      if (text.length < 2 || text.length > 1000) {
        status.textContent = "ENTER 2–1000 CHARACTERS.";
        return;
      }
      button.disabled = true;
      status.textContent = "TRANSMITTING…";
      try {
        await request("/api/comments", { method: "POST", body: JSON.stringify({ movie: key, title, text }) });
        field.value = "";
        status.textContent = "COMMENT SAVED // TRANSMISSION COMPLETE";
        await load();
      } catch (error) {
        status.textContent = error.message || "COMMENT NOT SAVED // TRY AGAIN";
      } finally {
        button.disabled = false;
      }
    });
  }
  async function openDetails(id, type = "movie", autoplay = false) {
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    content.innerHTML = `<div class="empty-state">LOADING MOVIE FILE…</div>`;
    dialog.showModal();
    let movie = findMovie(id, type);
    if (movie?.open_movie) { playOpenMovie(movie, autoplay); return; }
    try {
      const data = await request(`/api/movies?detail=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
      movie = data.movie || movie;
    } catch { /* retain available catalogue data */ }
    if (!movie) { content.innerHTML = `<div class="empty-state">MOVIE FILE NOT FOUND.</div>`; return; }
    const title = titleOf(movie);
    const trailerBase = safeEmbedUrl(movie.trailer_url);
    const trailer = trailerBase && autoplay ? (() => { const url = new URL(trailerBase); url.searchParams.set("autoplay", "1"); url.searchParams.set("rel", "0"); return url.href; })() : trailerBase;
    const backdrop = movie.backdrop_path || movie.backdrop || "";
    const trailerMarkup = trailer
      ? `<section class="inline-player" aria-label="Trailer player for ${escapeHtml(title)}"><div class="inline-player__frame"><iframe title="Trailer player for ${escapeHtml(title)}" src="${escapeHtml(trailer)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div></section>`
      : `<section class="inline-player" aria-label="Trailer"><div class="movie-player-empty"><span>TRAILER UNAVAILABLE</span></div></section>`;
    const downloadUrl = authorizedMovieDownload(movie);
    const downloadMarkup = downloadUrl ? `<a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>DOWNLOAD ↓</a>` : "";
    const key = commentKey(movie, id, type);
    const year = yearOf(movie);
    content.innerHTML = `<div class="dialog-backdrop" ${backdrop ? `style="background-image:linear-gradient(0deg,#06140c,transparent 80%),url('${escapeHtml(backdrop)}')"` : ""}></div><div class="dialog-body"><p class="dialog-kicker">${movie.media_type === "tv" || type === "tv" ? "SERIES" : "MOVIE"}</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info">${year ? `<span>${escapeHtml(year)}</span>` : ""}${Number(movie.vote_average) > 0 ? `<span>★ ${Number(movie.vote_average).toFixed(1)}</span>` : ""}${movie.runtime ? `<span>${escapeHtml(movie.runtime)} min</span>` : ""}</div><p class="dialog-overview">${escapeHtml(movie.overview || "")}</p>${trailerMarkup}<div class="dialog-actions">${downloadMarkup}</div>${commentsMarkup(key)}</div>`;
    const comments = $(".movie-comments", content);
    setupMovieComments(comments, key, title);
  }

  function playOpenMovie(input, autoplay = false) {
    const movie = verifiedOpenMovie(input);
    if (!movie) return;
    const title = titleOf(movie);
    const year = yearOf(movie);
    const runtime = Number.isFinite(Number(movie.runtime_minutes)) && Number(movie.runtime_minutes) > 0 ? `${Math.round(Number(movie.runtime_minutes))} min` : "";
    const backdrop = safeExternalLink(movie.backdrop_path || "");
    const size = escapeHtml(movie.download_size_label || "");
    const rightsNotes = escapeHtml(movie.rights_notes || "");
    const attributionText = escapeHtml(movie.attribution_text || "");
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    const key = `sample:${movie.id}`;
    content.innerHTML = `<div class="dialog-backdrop" ${backdrop ? `style="background-image:linear-gradient(0deg,#06140c,transparent 80%),url('${escapeHtml(backdrop)}')"` : ""}></div><div class="dialog-body open-film-dialog"><p class="dialog-kicker">VERIFIED OPEN-LICENSE FEATURE</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info">${year ? `<span>${escapeHtml(year)}</span>` : ""}${runtime ? `<span>${escapeHtml(runtime)}</span>` : ""}${size ? `<span>${size}</span>` : ""}</div><p class="dialog-overview">${escapeHtml(movie.overview || "")}</p><section class="inline-player" aria-label="Full film player for ${escapeHtml(title)}"><div id="open-film-player" class="inline-player__frame"></div></section><div class="dialog-actions"><a class="button button--primary" data-open-movie-dialog-download href="${escapeHtml(movie.download_url)}" target="_blank" rel="noopener noreferrer" download>DOWNLOAD ↓</a><a class="open-film-source" href="${escapeHtml(movie.source_url)}" target="_blank" rel="noopener noreferrer">OFFICIAL FILE SOURCE ↗</a></div><p class="open-film-download-note">Your browser controls where the file is saved. On Android it usually goes to Downloads; Gallery visibility depends on the device.</p><section class="open-film-rights"><p><strong>${escapeHtml(movie.license || "OPEN LICENSE")}</strong> · <a href="${escapeHtml(movie.license_url)}" target="_blank" rel="noopener noreferrer">VIEW LICENSE ↗</a> · <a href="${escapeHtml(movie.rights_url)}" target="_blank" rel="noopener noreferrer">RIGHTSHOLDER ↗</a></p><p>${rightsNotes}</p><p>${attributionText}</p></section>${commentsMarkup(key)}</div>`;
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", `Play ${title}`);
    video.src = movie.playback_url;
    $("#open-film-player", content).append(video);
    const downloadLink = $("[data-open-movie-dialog-download]", content);
    downloadLink.addEventListener("click", event => {
      const alreadySaved = watchlist().some(item => watchlistKey(item) === watchlistKey(movie));
      if (!alreadySaved && !toggleWatchlist(movie)) event.preventDefault();
    });
    setupMovieComments($(".movie-comments", content), key, title);
    if (!dialog.open) dialog.showModal();
    if (autoplay) video.play().catch(() => {});
  }

  function safeLibraryPlayback(item) {
    const safe = safeExternalLink(item.playback_url);
    if (!safe) return "";
    try {
      const url = new URL(safe);
      if (item.playback_type === "embed") return safeEmbedUrl(safe);
      return /\.(mp4|webm|m3u8)$/i.test(url.pathname) ? url.href : "";
    } catch { return ""; }
  }
  function renderLibrary(items) {
    const section = $(".approved-library");
    const grid = $("#library-grid");
    if (!grid) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;
    grid.innerHTML = rows.map(item => {
      const poster = safeExternalLink(item.poster_url);
      return `<article class="library-card"><div class="library-card__poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster for ${escapeHtml(item.title)}" onerror="this.remove()">` : `<span>⬡</span>`}</div><div class="library-card__copy"><p class="eyebrow">${item.media_type === "series" ? "SERIES" : "MOVIE"} · RIGHTS VERIFIED</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.synopsis || "Officially approved title.")}</p><button class="button button--primary library-play" type="button" data-library-id="${escapeHtml(item.id)}">▶ PLAY HERE</button></div></article>`;
    }).join("");
    $$(".library-play", grid).forEach(button => button.addEventListener("click", () => playLibraryItem(button.dataset.libraryId)));
  }
  async function loadLibrary() {
    try {
      const data = await request("/api/library");
      state.library = Array.isArray(data.items) ? data.items : [];
      renderLibrary(state.library);
    } catch {
      state.library = [];
      renderLibrary([]);
    }
  }
  function playLibraryItem(id) {
    const item = state.library.find(candidate => String(candidate.id) === String(id));
    const playbackUrl = item && safeLibraryPlayback(item);
    if (!item || !playbackUrl) return;
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    const key = `library:${item.id}`;
    const downloadAllowed = item.download_authorized === true && item.rights_verified === true && safeExternalLink(item.rights_url) && typeof item.rights_notes === "string" && item.rights_notes.trim();
    const downloadUrl = downloadAllowed ? safeExternalLink(item.download_url) : "";
    const downloadMarkup = downloadUrl ? `<div class="dialog-actions"><a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>DOWNLOAD ↓</a></div>` : "";
    content.innerHTML = `<div class="dialog-body library-player-dialog"><p class="dialog-kicker">VIDEO ILIYOIDHINISHWA</p><h2 id="dialog-title">${escapeHtml(item.title)}</h2><p class="dialog-overview">${escapeHtml(item.synopsis || "")}</p><div id="library-player-mount" class="inline-player__frame"></div>${downloadMarkup}${commentsMarkup(key)}</div>`;
    const mount = $("#library-player-mount", content);
    if (item.playback_type === "embed") {
      const frame = document.createElement("iframe");
      frame.title = `Player ya ${item.title}`;
      frame.src = playbackUrl;
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.sandbox = "allow-scripts allow-same-origin allow-presentation";
      frame.allow = "encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      mount.append(frame);
    } else {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = playbackUrl;
      video.addEventListener("error", () => {
        const note = document.createElement("p");
        note.className = "inline-player-note";
        note.textContent = "This video could not play. Check the authorized source or try a browser with HLS support.";
        mount.append(note);
      }, { once: true });
      mount.append(video);
    }
    setupMovieComments($(".movie-comments", content), key, item.title);
    dialog.showModal();
  }
  function toggleWatchlist(movie) {
    const list = watchlist();
    const key = watchlistKey(movie);
    const exists = list.some(item => watchlistKey(item) === key);
    const item = {
      id: movie.id,
      media_type: movie.media_type === "tv" || movie.type === "tv" ? "tv" : "movie",
      title: movie.title || "",
      name: movie.name || "",
      overview: movie.overview || "",
      release_date: movie.release_date || movie.first_air_date || "",
      poster_path: movie.poster_path || movie.poster || "",
      backdrop_path: movie.backdrop_path || movie.backdrop || "",
      vote_average: Number(movie.vote_average) || null,
      genre_ids: Array.isArray(movie.genre_ids) ? movie.genre_ids : [],
      trailer_url: movie.trailer_url || "",
      watch_url: movie.watch_url || "",
      ...(movie.open_movie === true ? {
        open_movie: true,
        creator: movie.creator || "",
        runtime_minutes: Number(movie.runtime_minutes) || null,
        license: movie.license || "",
        license_url: movie.license_url || "",
        rights_url: movie.rights_url || "",
        rights_notes: movie.rights_notes || "",
        source_url: movie.source_url || "",
        attribution_text: movie.attribution_text || "",
        playback_url: movie.playback_url || "",
        download_url: movie.download_url || "",
        download_authorized: movie.download_authorized === true,
        rights_verified: movie.rights_verified === true,
        download_size_label: movie.download_size_label || ""
      } : {})
    };
    const next = (exists ? list.filter(saved => watchlistKey(saved) !== key) : [...list, item]).slice(-150);
    try { localStorage.setItem("momo-watchlist", JSON.stringify(next)); }
    catch { $("#catalog-message").textContent = "Could not save your list on this device."; return false; }
    if (state.category === "watchlist") {
      state.movies = next;
      renderMovies(next);
      $("#load-more").hidden = true;
    } else {
      const saved = !exists;
      $$('[data-watchlist-toggle]').forEach(button => {
        if (button.dataset.movieId !== String(movie.id) || button.dataset.movieType !== (item.media_type === "tv" ? "tv" : "movie")) return;
        button.textContent = saved ? "♥" : "♡";
        button.setAttribute("aria-pressed", String(saved));
        button.setAttribute("aria-label", saved ? "Remove from My List" : "Add to My List");
      });
    }
    $("#catalog-message").textContent = exists ? "Removed from My List." : "Saved to My List.";
    return true;
  }

  function setupControls() {
    $("#login-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = $("#login-button");
      const phone = $("#phone-input").value.trim();
      const password = $("#password-input").value;
      const message = $("#login-message");
      message.textContent = "";
      message.classList.remove("is-success");
      if (!phone || !password) { message.textContent = "Enter your phone number and unlock code."; return; }
      button.disabled = true;
      button.querySelector("span").textContent = "AUTHENTICATING…";
      try {
        await request("/api/enter", { method: "POST", body: JSON.stringify({ phone, password }) });
        message.textContent = "Access granted. Opening the movie network…";
        message.classList.add("is-success");
        showCatalog();
      } catch (error) {
        message.textContent = error.status === 503 ? "Access service is offline. Try again later." : (error.message || "Access denied. Check your phone number and unlock code.");
      } finally {
        button.disabled = false;
        button.querySelector("span").textContent = "ENTER SITE";
      }
    });
    $("#toggle-password").addEventListener("click", () => {
      const input = $("#password-input");
      input.type = input.type === "password" ? "text" : "password";
      $("#toggle-password").setAttribute("aria-label", input.type === "password" ? "Show unlock code" : "Hide unlock code");
    });
    $("#logout-button").addEventListener("click", async () => {
      try { await request("/api/logout", { method: "POST", body: "{}" }); } catch { /* clear the local view anyway */ }
      showGate("Session closed.", true);
    });
    $$(".nav-link").forEach(link => link.addEventListener("click", () => {
      const target = link.dataset.section || "complete-catalog";
      const category = link.dataset.category || "popular";
      activateCategory(category, target);
    }));
    $$('[data-category]:not(.nav-link)').forEach(button => button.addEventListener("click", () => activateCategory(button.dataset.category)));
    $$('[data-shelf-scroll]').forEach(button => button.addEventListener("click", () => {
      const track = document.getElementById(button.dataset.shelfScroll);
      if (!track) return;
      track.scrollBy({ left: track.clientWidth * Number(button.dataset.direction || 1), behavior: "smooth" });
    }));
    let searchTimer;
    const searchInput = $("#search-input");
    $("#search-input").addEventListener("input", event => {
      clearTimeout(searchTimer);
      state.activeController?.abort();
      state.requestId++;
      state.query = event.target.value.trim(); state.page = 1;
      if (state.query) state.category = "trending";
      $("#catalog-view").classList.toggle("is-searching", Boolean(state.query));
      $$(".nav-link").forEach(item => item.classList.toggle("is-active", !state.query && item.dataset.category === state.category));
      $$(".genre-chip").forEach(item => {
        const active = !state.query && item.dataset.category === state.category;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      $("#section-title").textContent = state.query ? `Results for “${state.query}”` : categoryTitle(state.category);
      searchTimer = setTimeout(loadCatalog, 300);
    });
    $("#load-more").addEventListener("click", () => { state.page += 1; loadCatalog(); });
    $("#hero-details").addEventListener("click", () => state.selected && openDetails(state.selected.id, state.selected.media_type || "movie"));
    $("#hero-trailer").addEventListener("click", () => state.selected && openDetails(state.selected.id, state.selected.media_type || "movie", true));
    $("#dialog-close").addEventListener("click", () => $("#movie-dialog").close());
    $("#movie-dialog").addEventListener("click", event => { if (event.target === $("#movie-dialog")) $("#movie-dialog").close(); });
    $("#movie-dialog").addEventListener("close", () => { $("#dialog-content").replaceChildren(); });
    $("#year").textContent = new Date().getFullYear();
    if (localPreview) {
      const demo = $("#demo-button");
      demo.hidden = false;
      demo.addEventListener("click", showCatalog);
    }
  }

  function setupStars() {
    const canvas = $("#starfield");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const stars = [];
    let width = 0, height = 0, raf = 0;
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars.length = 0;
      const count = Math.min(240, Math.max(70, Math.floor(width * height / 7500)));
      for (let i = 0; i < count; i++) stars.push({ x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.25 + .25, v: Math.random() * .34 + .08, a: Math.random() * .65 + .15, phase: Math.random() * Math.PI * 2 });
    }
    function draw(time = 0) {
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        star.y -= star.v;
        if (star.y < -3) { star.y = height + 3; star.x = Math.random() * width; }
        const alpha = star.a * (.72 + Math.sin(time / 900 + star.phase) * .25);
        ctx.beginPath(); ctx.fillStyle = `rgba(83,255,173,${alpha})`; ctx.shadowColor = "rgba(38,239,144,.6)"; ctx.shadowBlur = star.r > 1 ? 7 : 3; ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); draw(); }, { passive: true });
  }

  async function boot() {
    setupStars(); setupControls(); renderCount();
    try {
      const session = await request("/api/session");
      if (session.authenticated) showCatalog(); else showGate();
    } catch { showGate(); }
  }
  boot();
})();
