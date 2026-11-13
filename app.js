(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { category: "trending", query: "", movies: [], library: [], djItems: [], selected: null, page: 1, busy: false, requestId: 0, activeController: null };
  const localPreview = Boolean(window.MOMO_LOCAL_PREVIEW);

  const fallbackMovies = [
    { id: "metropolis-1927", media_type: "movie", title: "Metropolis", overview: "Katika jiji la baadaye lenye tabaka tofauti, mvumbuzi na mfanyakazi wanajaribu kuunganisha jamii iliyogawanyika.", release_date: "1927-01-10", poster_path: null, vote_average: null, genre: "SCI-FI CLASSIC", trailer_query: "Metropolis 1927 official trailer" },
    { id: "nosferatu-1922", media_type: "movie", title: "Nosferatu", overview: "Msimulizi wa kutisha kuhusu safari ya mgeni wa ajabu na kivuli kinachotanda katika mji wa mbali.", release_date: "1922-03-04", poster_path: null, vote_average: null, genre: "SILENT HORROR", trailer_query: "Nosferatu 1922 official trailer" },
    { id: "the-general-1926", media_type: "movie", title: "The General", overview: "Dereva wa treni anajikuta katikati ya tukio la kusisimua na la kuchekesha wakati wa vita vya wenyewe kwa wenyewe.", release_date: "1926-12-25", poster_path: null, vote_average: null, genre: "ACTION / CLASSIC COMEDY", trailer_query: "The General 1926 official trailer" },
    { id: "sherlock-jr-1924", media_type: "movie", title: "Sherlock Jr.", overview: "Mwendesha projekta anaota kuwa mpelelezi, na mipaka kati ya sinema na maisha halisi inaanza kuyeyuka.", release_date: "1924-04-21", poster_path: null, vote_average: null, genre: "SILENT COMEDY", trailer_query: "Sherlock Jr 1924 official trailer" },
    { id: "caligari-1920", media_type: "movie", title: "The Cabinet of Dr. Caligari", overview: "Mwanamume anasimulia fumbo la usingizi, siri na matukio yasiyoeleweka katika mji wa zamani.", release_date: "1920-02-26", poster_path: null, vote_average: null, genre: "EXPRESSIONIST", trailer_query: "The Cabinet of Dr Caligari 1920 official trailer" },
    { id: "phantom-1925", media_type: "movie", title: "The Phantom of the Opera", overview: "Mwimbaji mchanga anavutia usikivu wa mtu wa ajabu anayeishi katika njia za chini ya jumba la opera.", release_date: "1925-09-06", poster_path: null, vote_average: null, genre: "SILENT DRAMA", trailer_query: "The Phantom of the Opera 1925 official trailer" },
    { id: "haxan-1922", media_type: "movie", title: "Häxan", overview: "Filamu ya kipekee inayochanganya maigizo na uchunguzi wa historia ya imani na hofu za zamani.", release_date: "1922-09-18", poster_path: null, vote_average: null, genre: "DOCUMENTARY CLASSIC", trailer_query: "Haxan 1922 official trailer" },
    { id: "safety-last-1923", media_type: "movie", title: "Safety Last!", overview: "Kijana mjini anajikuta katika mfululizo wa vichekesho na changamoto za kazi na mapenzi.", release_date: "1923-04-01", poster_path: null, vote_average: null, genre: "CLASSIC COMEDY", trailer_query: "Safety Last 1923 official trailer" },
    { id: "prince-achmed-1926", media_type: "movie", title: "The Adventures of Prince Achmed", overview: "Hadithi ya kifalme katika filamu ya uhuishaji ya kivuli ya Lotte Reiniger.", release_date: "1926-09-02", poster_path: null, vote_average: null, genre: "ANIMATION / CLASSIC", trailer_query: "The Adventures of Prince Achmed 1926 official trailer" }
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function yearOf(movie) {
    const date = movie.release_date || movie.first_air_date || "";
    const match = String(date).match(/^\d{4}/);
    return match ? match[0] : "—";
  }
  function currentTanzaniaYear() {
    return new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", year: "numeric" }).format(new Date());
  }
  function titleOf(movie) { return movie.title || movie.name || "Untitled"; }
  function categoryTitle(category) {
    return {
      trending: "Trending",
      popular: "Maarufu",
      now_playing: "Mpya",
      watchlist: "My List",
      tv: "Series",
      horror: "Horror",
      action: "Action",
      animation: "Animation / Cartoon"
    }[category] || "Filamu";
  }
  function activateCategory(category) {
    state.category = category;
    state.query = "";
    state.page = 1;
    $("#search-input").value = "";
    $$(".nav-link").forEach(link => link.classList.toggle("is-active", link.dataset.category === category));
    $$(".genre-chip").forEach(chip => {
      const active = chip.dataset.category === category;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    $("#section-title").textContent = categoryTitle(category);
    loadCatalog();
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
    if (!response.ok) throw Object.assign(new Error(data.error || "Ombi halikukamilika."), { status: response.status, data });
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
    renderCount();
    loadCatalog();
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

  async function loadCatalog() {
    const requestId = ++state.requestId;
    state.activeController?.abort();
    const controller = new AbortController();
    state.activeController = controller;
    state.busy = true;
    $("#catalog-message").textContent = "";
    $("#catalog-count").textContent = state.query ? "Inatafuta…" : "Inapakia movies…";
    if (state.category === "watchlist" && !state.query) {
      state.activeController = null;
      state.busy = false;
      state.movies = watchlist();
      renderMovies(state.movies);
      $("#load-more").hidden = true;
      $("#catalog-message").textContent = state.movies.length ? "Orodha yangu huhifadhiwa kwenye kifaa hiki." : "Bado hujahifadhi movie. Bonyeza ♡ HIFADHI kwenye kadi.";
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
      $("#catalog-count").textContent = state.category === "watchlist" ? "Orodha yangu" : state.movies.length ? (state.category === "tv" ? "Series" : "Movies") : "Hakuna movie";
      $("#load-more").hidden = !data.hasMore || Boolean(state.query) || state.category === "watchlist";
      const needsTmdbKey = data.error === "TMDB_API_KEY_MISSING" || data.source === "sample";
      if (needsTmdbKey) {
        $("#catalog-message").textContent = "Katalogi ya sasa haipatikani. Mmiliki aangalie TMDB_API_KEY kwenye Vercel.";
      } else if (!movies.length) {
        $("#catalog-message").textContent = state.category === "watchlist" ? "Bado hakuna movie zilizohifadhiwa." : "Hakuna movie au series zilizopatikana.";
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
      $("#catalog-count").textContent = samples.length ? "Movies za mfano" : "Hakuna movie";
      $("#load-more").hidden = true;
      $("#catalog-message").textContent = "Katalogi haipatikani kwa sasa. Tafadhali jaribu tena baadaye.";
    } finally {
      if (state.activeController === controller) state.busy = false;
    }
  }

  function movieCard(movie) {
    const title = titleOf(movie);
    const poster = movie.poster_path || movie.poster || "";
    const isTv = movie.media_type === "tv" || movie.type === "tv";
    const canRequestTrailer = Boolean(movie.trailer_url) || /^\d{1,12}$/.test(String(movie.id));
    const playLabel = canRequestTrailer ? "▶ CHEZA" : "MAELEZO";
    const cardLabel = canRequestTrailer ? `Cheza trela ya ${title} ndani ya MOMO` : `Fungua maelezo ya ${title} ndani ya MOMO`;
    const rating = Number(movie.vote_average) > 0 ? `★ ${Number(movie.vote_average).toFixed(1)}` : (movie.genre || (isTv ? "SERIES" : "DISCOVER"));
    const saved = watchlist().some(item => watchlistKey(item) === watchlistKey(movie));
    const saveLabel = saved ? "♥ IMEHIFADHIWA" : "♡ HIFADHI";
    return `<article class="movie-card">
      <button class="movie-card__open" type="button" data-movie-id="${escapeHtml(movie.id)}" data-movie-type="${isTv ? "tv" : "movie"}" aria-label="${escapeHtml(cardLabel)}">
        <div class="poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster ya ${escapeHtml(title)}" onerror="this.remove()">` : `<span class="poster-placeholder"><span class="poster-title">${escapeHtml(title)}</span></span>`}<span class="poster-play" aria-hidden="true">${playLabel}</span><span class="poster-kind">${isTv ? "SERIES" : "FILAMU"}</span></div>
        <h3>${escapeHtml(title)}</h3><p class="movie-meta"><span>${escapeHtml(yearOf(movie))}</span><span class="movie-rating">${escapeHtml(rating)}</span></p>
      </button>
      <button class="watchlist-toggle" type="button" data-watchlist-toggle data-movie-id="${escapeHtml(movie.id)}" data-movie-type="${isTv ? "tv" : "movie"}" aria-pressed="${saved}" aria-label="${saved ? "Ondoa kwenye My List" : "Hifadhi kwenye My List"}">${saveLabel}</button>
    </article>`;
  }
  function updateDownloadStation(movies) {
    const select = $("#download-movie");
    if (!select) return;
    const previous = select.value;
    const options = (Array.isArray(movies) ? movies : []).map(movie => {
      const type = movie.media_type === "tv" ? "tv" : "movie";
      const value = `${type}:${movie.id}`;
      return `<option value="${escapeHtml(value)}">${escapeHtml(titleOf(movie))} · ${escapeHtml(yearOf(movie))}</option>`;
    }).join("");
    select.innerHTML = `<option value="">Chagua movie</option>${options}`;
    if (previous && [...select.options].some(option => option.value === previous)) select.value = previous;
    updateDownloadButton();
  }
  function selectedDownloadMovie() {
    const value = $("#download-movie")?.value || "";
    const [type, id] = value.split(":");
    return state.movies.find(item => String(item.id) === id && (item.media_type || "movie") === type) || null;
  }
  function updateDownloadButton() {
    const button = $("#download-current");
    const note = $("#download-current-note");
    if (!button) return;
    const movie = selectedDownloadMovie();
    const downloadUrl = movie && authorizedMovieDownload(movie);
    button.disabled = !downloadUrl;
    button.textContent = !movie ? "CHAGUA FILAMU" : downloadUrl ? "PAKUA FAILI ↓" : "HAKUNA FAILI";
    if (note) note.textContent = !movie
      ? "Kwa sasa hakuna faili la movie lililoidhinishwa. PAKUA FAILI huwashwa tu kwa direct file yenye ruhusa."
      : downloadUrl
        ? "Faili la moja kwa moja limeidhinishwa kwa kupakuliwa."
        : "Hakuna faili la kupakua lililoidhinishwa kwa filamu hii. Tumia kitufe tofauti cha kutazama chanzo rasmi kwenye maelezo.";
  }
  function renderMovies(movies) {
    const grid = $("#movie-grid");
    grid.innerHTML = movies.length ? movies.map(movieCard).join("") : `<div class="empty-state">Hakuna movie kwa sasa. Jaribu tena baadaye.</div>`;
    $$(".movie-card__open", grid).forEach(button => button.addEventListener("click", () => openDetails(button.dataset.movieId, button.dataset.movieType, true)));
    $$("[data-watchlist-toggle]", grid).forEach(button => button.addEventListener("click", () => {
      const movie = state.movies.find(item => String(item.id) === button.dataset.movieId && (item.media_type === "tv" ? "tv" : "movie") === button.dataset.movieType);
      if (movie) toggleWatchlist(movie);
    }));
    updateDownloadStation(movies);
    $("#catalog-count").textContent = state.category === "watchlist" ? "Orodha yangu" : movies.length ? (state.category === "tv" ? "Series" : "Movies") : "Hakuna movie";
    if (movies.length && !state.query && state.page === 1 && state.category !== "watchlist") {
      const lead = movies[0];
      $("#hero-title").innerHTML = `${escapeHtml(titleOf(lead))}<br><span>${escapeHtml(yearOf(lead))}</span>`;
      $("#hero-overview").textContent = lead.overview || "Angalia maelezo, trela na chanzo rasmi cha kutazama.";
      state.selected = lead;
      $("#hero-trailer").textContent = Boolean(lead.trailer_url) || /^\d{1,12}$/.test(String(lead.id)) ? "▶ CHEZA TRELA HAPA" : "▶ MAELEZO YA FILAMU";
      const backdrop = lead.backdrop_path || lead.backdrop;
      if (backdrop) $("#hero-art").style.backgroundImage = `linear-gradient(90deg,rgba(5,18,12,.12),rgba(5,18,12,.48)),url("${backdrop.replace(/["\\]/g, "")}")`;
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
  function officialSourceUrl(movie) {
    const watchUrl = safeExternalLink(movie?.watch_url);
    if (watchUrl) return watchUrl;
    const type = movie?.media_type === "tv" || movie?.type === "tv" ? "tv" : "movie";
    const id = String(movie?.id || "");
    if (/^\d{1,12}$/.test(id)) return `https://www.themoviedb.org/${type}/${encodeURIComponent(id)}`;
    return `https://www.themoviedb.org/search?query=${encodeURIComponent(titleOf(movie || {}))}`;
  }
  function authorizedMovieDownload(movie) {
    if (movie?.download_authorized !== true || movie?.rights_verified !== true) return "";
    if (!safeExternalLink(movie?.rights_url) || typeof movie?.rights_notes !== "string" || !movie.rights_notes.trim()) return "";
    return directDownloadUrl(movie?.download_url);
  }
  function translationSourceUrl(item) {
    return safeExternalLink(item?.official_watch_url || item?.source_url);
  }
  function renderDjDirectory(djs) {
    const grid = $("#dj-directory");
    if (!grid) return;
    const rows = Array.isArray(djs) ? djs : [];
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state translation-empty"><strong>Orodha ya DJs haipatikani kwa sasa.</strong><span>Hakuna clip au movie kamili inayoongezwa bila chanzo na ruhusa kuthibitishwa.</span></div>`;
      return;
    }
    const sourceRows = rows.filter(item => safeExternalLink(item.profile_url) || safeExternalLink(item.original_url));
    const pendingRows = rows.filter(item => !safeExternalLink(item.profile_url) && !safeExternalLink(item.original_url));
    const sourceCards = sourceRows.map(item => {
      const name = escapeHtml(item.name || "DJ");
      const status = escapeHtml(item.status_note || "Chanzo cha DJ kinahitaji kuthibitishwa.");
      const profileUrl = safeExternalLink(item.profile_url);
      const profileLabel = escapeHtml(item.profile_label || "FUNGUA CHANZO ↗");
      const originalUrl = safeExternalLink(item.original_url);
      const originalTitle = escapeHtml(item.original_title || "Toleo la asili");
      const originalNote = escapeHtml(item.original_note || "Kiungo hiki ni cha original version, si tafsiri ya DJ; upatikanaji hutegemea eneo.");
      const originalCta = escapeHtml(item.original_cta || "TAZAMA TOLEO LA ASILI ↗");
      const profileAction = profileUrl ? `<a class="translation-source-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${profileLabel}</a>` : "";
      const originalAction = originalUrl ? `<div class="dj-original"><p class="dj-original-label">TOLEO LA ASILI · SI TAFSIRI YA DJ</p><strong>${originalTitle}</strong><p>${originalNote}</p><a class="button button--ghost" href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">${originalCta}</a></div>` : "";
      return `<article class="dj-profile-card"><div class="dj-profile-head"><h3>${name}</h3><span>DJ</span></div><p class="dj-profile-status">${status}</p>${profileAction ? `<div class="dj-profile-links">${profileAction}</div>` : ""}${originalAction}</article>`;
    }).join("");
    const pendingNames = pendingRows.length
      ? `<div class="dj-pending-list"><p>Wametajwa pia</p><div class="dj-pending-chips">${pendingRows.map(item => `<span>${escapeHtml(item.name || "DJ")}</span>`).join("")}</div><small>Clip rasmi au full movie itaonekana baada ya chanzo na ruhusa kuthibitishwa.</small></div>`
      : "";
    grid.innerHTML = `${sourceCards}${pendingNames}`;
  }
  function renderTranslations(items) {
    const grid = $("#translation-grid");
    if (!grid) return;
    const rows = Array.isArray(items) ? items : [];
    state.djItems = rows;
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state translation-empty"><strong>Hakuna clips za DJ kwa sasa.</strong><span>Movie kamili na downloads huongezwa tu baada ya ruhusa kuthibitishwa.</span></div>`;
      return;
    }
    const groups = new Map();
    rows.forEach((item, index) => {
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
        const sourceUrl = safeExternalLink(item.source_url);
        const downloadUrl = authorizedTranslationDownload(item);
        const watchUrl = translationSourceUrl(item);
        const note = escapeHtml(item.source_note || "Clip fupi ya creator; si movie nzima.");
        const sourceLabel = escapeHtml(item.source_label || "CHANZO RASMI ↗");
        const playAction = videoId ? `<button class="button button--ghost" type="button" data-dj-play="${index}">▶ CHEZA HAPA</button>` : `<button class="button button--ghost" type="button" disabled aria-disabled="true">PLAYER HAIPATIKANI</button>`;
        const downloadAction = downloadUrl ? `<a class="button button--primary" href="${escapeHtml(downloadUrl)}" download title="Pakua faili iliyoidhinishwa">PAKUA FAILI ↓</a>` : "";
        const sourceAction = sourceUrl ? `<a class="dj-movie-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a>` : "";
        const watchAction = watchUrl ? `<a class="button button--ghost" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">TAZAMA CHANZO RASMI ↗</a>` : "";
        return `<article class="dj-movie-card"><div class="dj-movie-poster">${thumbnail ? `<img loading="lazy" src="${thumbnail}" alt="${title} clip thumbnail" onerror="this.remove()">` : ""}<span class="dj-movie-poster__title">${title}</span><span class="dj-movie-poster__badge">PUBLIC CLIP</span></div><div class="dj-movie-card__body"><p class="eyebrow eyebrow--muted">${escapeHtml(dj)}${item.year ? ` · ${escapeHtml(item.year)}` : ""}</p><h4>${title}</h4><p class="dj-movie-note">${note}</p>${sourceAction}<div class="dj-movie-actions">${playAction}${downloadAction}${watchAction}</div></div></article>`;
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
    const sourceUrl = safeExternalLink(item.source_url);
    const downloadUrl = authorizedTranslationDownload(item);
    const watchUrl = translationSourceUrl(item);
    const downloadMarkup = downloadUrl ? `<a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>PAKUA FAILI ↓</a>` : "";
    const sourceMarkup = sourceUrl ? `<a class="translation-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">FUNGUA CHANZO ↗</a>` : "";
    const watchMarkup = watchUrl ? `<a class="button button--ghost" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">TAZAMA CHANZO RASMI ↗</a>` : "";
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    content.innerHTML = `<div class="dialog-backdrop"></div><div class="dialog-body dj-clip-dialog"><p class="dialog-kicker">CLIP YA DJ</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info"><span>${escapeHtml(dj)}</span>${item.year ? `<span>${escapeHtml(item.year)}</span>` : ""}</div><p class="dialog-overview">${escapeHtml(item.source_note || "Hiki ni kipande kifupi, si movie nzima.")}</p><section class="inline-player" aria-label="Kicheza clip ya DJ"><div id="dj-clip-player" class="inline-player__frame"></div></section><div class="dialog-actions">${downloadMarkup}${watchMarkup}${sourceMarkup}</div>${downloadUrl ? `<p class="download-note">Faili iliyoidhinishwa imeunganishwa kwa upakuaji wa moja kwa moja.</p>` : `<p class="download-note">Hakuna faili la kupakua lililoidhinishwa kwa clip hii. Tumia player ya hapa au fungua chanzo rasmi kwa kitendo chake tofauti.</p>`}${commentsMarkup(key)}</div>`;
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
      const djs = Array.isArray(data.djs) ? data.djs : [];
      renderDjDirectory(djs);
      renderTranslations(items);
    } catch { renderDjDirectory([]); renderTranslations([]); }
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
    let movie = state.movies.find(item => String(item.id) === String(id));
    if (!movie) movie = fallbackMovies.find(item => String(item.id) === String(id));
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
      : `<section class="inline-player" aria-label="Trela"><div class="movie-player-empty"><span>TRELA HAIJAPATIKANA KWA SASA</span></div></section>`;
    const downloadUrl = authorizedMovieDownload(movie);
    const watchUrl = officialSourceUrl(movie);
    const downloadMarkup = downloadUrl ? `<a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>PAKUA FAILI ↓</a>` : "";
    const watchMarkup = watchUrl ? `<a class="button button--ghost" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">TAZAMA CHANZO RASMI ↗</a>` : "";
    const key = commentKey(movie, id, type);
    content.innerHTML = `<div class="dialog-backdrop" ${backdrop ? `style="background-image:linear-gradient(0deg,#06140c,transparent 80%),url('${escapeHtml(backdrop)}')"` : ""}></div><div class="dialog-body"><p class="dialog-kicker">${movie.media_type === "tv" || type === "tv" ? "SERIES" : "FILAMU"}</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info"><span>${escapeHtml(yearOf(movie))}</span>${Number(movie.vote_average) > 0 ? `<span>★ ${Number(movie.vote_average).toFixed(1)}</span>` : ""}${movie.runtime ? `<span>${escapeHtml(movie.runtime)} min</span>` : ""}</div><p class="dialog-overview">${escapeHtml(movie.overview || "")}</p>${trailerMarkup}<div class="dialog-actions">${downloadMarkup}${watchMarkup}</div>${downloadUrl ? `<p class="download-note">Faili iliyoidhinishwa imeunganishwa kwa upakuaji wa moja kwa moja.</p>` : `<p class="download-note">Katalogi ina kiungo cha kutazama rasmi, si faili la movie la kupakua. Huduma husika inaweza kutoa offline download ndani ya app yake.</p>`}${commentsMarkup(key)}</div>`;
    const comments = $(".movie-comments", content);
    setupMovieComments(comments, key, title);
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
      return `<article class="library-card"><div class="library-card__poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster ya ${escapeHtml(item.title)}" onerror="this.remove()">` : `<span>⬡</span>`}</div><div class="library-card__copy"><p class="eyebrow">${item.media_type === "series" ? "SERIES" : "FILAMU"} · RIGHTS VERIFIED</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.synopsis || "Maudhui rasmi yaliyoidhinishwa.")}</p><button class="button button--primary library-play" type="button" data-library-id="${escapeHtml(item.id)}">▶ CHEZA HAPA</button></div></article>`;
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
    const downloadMarkup = downloadUrl ? `<div class="dialog-actions"><a class="button button--primary download-button" href="${escapeHtml(downloadUrl)}" download>PAKUA FAILI ↓</a></div><p class="download-note">Faili iliyoidhinishwa imeunganishwa kwa upakuaji wa moja kwa moja.</p>` : "";
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
        note.textContent = "Video haikucheza kwenye kifaa hiki. Kagua kiungo au tumia HLS kwenye browser inayoiunga mkono.";
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
      watch_url: movie.watch_url || ""
    };
    const next = (exists ? list.filter(saved => watchlistKey(saved) !== key) : [...list, item]).slice(-150);
    try { localStorage.setItem("momo-watchlist", JSON.stringify(next)); }
    catch { $("#catalog-message").textContent = "Imeshindikana kuhifadhi orodha kwenye kifaa hiki."; return; }
    if (state.category === "watchlist") {
      state.movies = next;
      renderMovies(next);
      $("#load-more").hidden = true;
    } else {
      const saved = !exists;
      $$('[data-watchlist-toggle]').forEach(button => {
        if (button.dataset.movieId !== String(movie.id) || button.dataset.movieType !== (item.media_type === "tv" ? "tv" : "movie")) return;
        button.textContent = saved ? "♥ IMEHIFADHIWA" : "♡ HIFADHI";
        button.setAttribute("aria-pressed", String(saved));
        button.setAttribute("aria-label", saved ? "Ondoa kwenye My List" : "Hifadhi kwenye My List");
      });
    }
    $("#catalog-message").textContent = exists ? "Imeondolewa kwenye My List." : "Imehifadhiwa kwenye My List ya kifaa hiki.";
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
      if (!phone || !password) { message.textContent = "Weka namba yako ya simu na nenosiri."; return; }
      button.disabled = true;
      button.querySelector("span").textContent = "INAHAKIKI…";
      try {
        await request("/api/enter", { method: "POST", body: JSON.stringify({ phone, password }) });
        message.textContent = "Umeingia. Inafungua katalogi ya movies…";
        message.classList.add("is-success");
        await renderCount();
        showCatalog();
      } catch (error) {
        message.textContent = error.status === 503 ? "Huduma ya kuingia haipatikani. Mmiliki aangalie Supabase kwenye Vercel." : (error.message || "Imeshindikana kuingia. Kagua taarifa zako.");
      } finally {
        button.disabled = false;
        button.querySelector("span").textContent = "INGIA";
      }
    });
    $("#toggle-password").addEventListener("click", () => {
      const input = $("#password-input");
      input.type = input.type === "password" ? "text" : "password";
      $("#toggle-password").setAttribute("aria-label", input.type === "password" ? "Onyesha nenosiri" : "Ficha nenosiri");
    });
    $("#logout-button").addEventListener("click", async () => {
      try { await request("/api/logout", { method: "POST", body: "{}" }); } catch { /* clear the local view anyway */ }
      showGate("Umetoka kwenye akaunti.", true);
    });
    $$(".nav-link").forEach(link => link.addEventListener("click", () => {
      if (link.dataset.section) {
        document.getElementById(link.dataset.section)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      activateCategory(link.dataset.category);
    }));
    $$(".genre-chip").forEach(chip => chip.addEventListener("click", () => activateCategory(chip.dataset.category)));
    let searchTimer;
    const searchInput = $("#search-input");
    $$("[data-search-pick]").forEach(button => button.addEventListener("click", () => {
      searchInput.value = button.dataset.searchPick || "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      $("#movie-grid").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $("#search-input").addEventListener("input", event => {
      clearTimeout(searchTimer);
      state.activeController?.abort();
      state.requestId++;
      state.query = event.target.value.trim(); state.page = 1;
      if (state.query) state.category = "trending";
      $$(".nav-link").forEach(item => item.classList.toggle("is-active", !state.query && item.dataset.category === state.category));
      $$(".genre-chip").forEach(item => {
        const active = !state.query && item.dataset.category === state.category;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      $("#section-title").textContent = state.query ? `Matokeo ya “${state.query}”` : categoryTitle(state.category);
      searchTimer = setTimeout(loadCatalog, 300);
    });
    $("#load-more").addEventListener("click", () => { state.page += 1; loadCatalog(); });
    $("#hero-details").addEventListener("click", () => state.selected && openDetails(state.selected.id, state.selected.media_type || "movie"));
    $("#hero-trailer").addEventListener("click", () => state.selected && openDetails(state.selected.id, state.selected.media_type || "movie", true));
    $("#dialog-close").addEventListener("click", () => $("#movie-dialog").close());
    $("#movie-dialog").addEventListener("click", event => { if (event.target === $("#movie-dialog")) $("#movie-dialog").close(); });
    $("#movie-dialog").addEventListener("close", () => { $("#dialog-content").replaceChildren(); });
    $("#year").textContent = new Date().getFullYear();
    $("#download-movie")?.addEventListener("change", updateDownloadButton);
    $("#download-current")?.addEventListener("click", () => {
      const movie = selectedDownloadMovie();
      const url = movie && authorizedMovieDownload(movie);
      if (!url) { updateDownloadButton(); return; }
      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      $("#download-current-note").textContent = "Upakuaji umeanzishwa. Ikiwa seva ya faili inazuia download, wasiliana na msimamizi wa chanzo.";
    });
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
