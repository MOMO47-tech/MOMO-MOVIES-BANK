(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { category: "trending", query: "", movies: [], library: [], selected: null, page: 1, busy: false, requestId: 0, activeController: null };
  const localPreview = Boolean(window.MOMO_LOCAL_PREVIEW);

  const fallbackMovies = [
    { id: "metropolis-1927", media_type: "movie", title: "Metropolis", overview: "Katika jiji la baadaye lenye tabaka tofauti, mvumbuzi na mfanyakazi wanajaribu kuunganisha jamii iliyogawanyika.", release_date: "1927-01-10", poster_path: null, vote_average: null, genre: "SCI-FI CLASSIC", trailer_query: "Metropolis 1927 official trailer" },
    { id: "nosferatu-1922", media_type: "movie", title: "Nosferatu", overview: "Msimulizi wa kutisha kuhusu safari ya mgeni wa ajabu na kivuli kinachotanda katika mji wa mbali.", release_date: "1922-03-04", poster_path: null, vote_average: null, genre: "SILENT HORROR", trailer_query: "Nosferatu 1922 official trailer" },
    { id: "the-general-1926", media_type: "movie", title: "The General", overview: "Dereva wa treni anajikuta katikati ya tukio la kusisimua na la kuchekesha wakati wa vita vya wenyewe kwa wenyewe.", release_date: "1926-12-25", poster_path: null, vote_average: null, genre: "CLASSIC COMEDY", trailer_query: "The General 1926 official trailer" },
    { id: "sherlock-jr-1924", media_type: "movie", title: "Sherlock Jr.", overview: "Mwendesha projekta anaota kuwa mpelelezi, na mipaka kati ya sinema na maisha halisi inaanza kuyeyuka.", release_date: "1924-04-21", poster_path: null, vote_average: null, genre: "SILENT COMEDY", trailer_query: "Sherlock Jr 1924 official trailer" },
    { id: "caligari-1920", media_type: "movie", title: "The Cabinet of Dr. Caligari", overview: "Mwanamume anasimulia fumbo la usingizi, siri na matukio yasiyoeleweka katika mji wa zamani.", release_date: "1920-02-26", poster_path: null, vote_average: null, genre: "EXPRESSIONIST", trailer_query: "The Cabinet of Dr Caligari 1920 official trailer" },
    { id: "phantom-1925", media_type: "movie", title: "The Phantom of the Opera", overview: "Mwimbaji mchanga anavutia usikivu wa mtu wa ajabu anayeishi katika njia za chini ya jumba la opera.", release_date: "1925-09-06", poster_path: null, vote_average: null, genre: "SILENT DRAMA", trailer_query: "The Phantom of the Opera 1925 official trailer" },
    { id: "haxan-1922", media_type: "movie", title: "Häxan", overview: "Filamu ya kipekee inayochanganya maigizo na uchunguzi wa historia ya imani na hofu za zamani.", release_date: "1922-09-18", poster_path: null, vote_average: null, genre: "DOCUMENTARY CLASSIC", trailer_query: "Haxan 1922 official trailer" },
    { id: "safety-last-1923", media_type: "movie", title: "Safety Last!", overview: "Kijana mjini anajikuta katika mfululizo wa vichekesho na changamoto za kazi na mapenzi.", release_date: "1923-04-01", poster_path: null, vote_average: null, genre: "CLASSIC COMEDY", trailer_query: "Safety Last 1923 official trailer" }
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function yearOf(movie) {
    const date = movie.release_date || movie.first_air_date || "";
    return date ? date.slice(0, 4) : "—";
  }
  function currentTanzaniaYear() {
    return new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", year: "numeric" }).format(new Date());
  }
  function titleOf(movie) { return movie.title || movie.name || "Untitled"; }
  function categoryTitle(category) {
    return {
      trending: "Filamu na series zinazotrend",
      popular: "Movies na series zinazotrend",
      top_rated: "Zilizokadiriwa",
      now_playing: `Movies mpya za ${currentTanzaniaYear()}`,
      tv: "Series maarufu",
      watchlist: "Orodha yangu",
      horror: "Horror · za kutisha",
      action: "Action · mapigano",
      animation: "Animation · cartoon"
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
    try { return JSON.parse(localStorage.getItem("momo-watchlist") || "[]"); } catch { return []; }
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
    $("#catalog-count").textContent = state.query ? "Inatafuta…" : "Inapakia katalogi…";
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
      state.movies = movies;
      renderMovies(movies);
      $("#catalog-count").textContent = movies.length ? `${movies.length} matokeo` : "Hakuna matokeo";
      $("#load-more").hidden = !data.hasMore || Boolean(state.query) || state.category === "watchlist";
      const needsTmdbKey = data.error === "TMDB_API_KEY_MISSING" || data.source === "sample";
      if (needsTmdbKey) {
        $("#catalog-message").textContent = "Utafutaji wa movies na series za sasa unahitaji TMDB_API_KEY. Iongeze kwenye Vercel → Project Settings → Environment Variables, kisha redeploy.";
      } else if (!movies.length) {
        $("#catalog-message").textContent = state.category === "watchlist" ? "Bado hujaongeza filamu kwenye orodha yako." : "Hakuna filamu au series zinazolingana na utafutaji huo.";
      }
    } catch (error) {
      if (controller.signal.aborted || requestId !== state.requestId) return;
      const needle = state.query.toLocaleLowerCase();
      const samples = state.category === "watchlist" ? watchlist() : fallbackMovies.filter(item => {
        if (state.category === "tv") return item.media_type === "tv";
        if (state.category === "horror") return (item.genre_ids || []).includes(27) || /horror|kutisha/i.test(item.genre || "");
        if (state.category === "action") return (item.genre_ids || []).includes(28) || /action|fight|combat|mapigano/i.test(item.genre || "");
        if (state.category === "animation") return (item.genre_ids || []).includes(16) || /animation|cartoon|katuni/i.test(item.genre || "");
        return !needle || `${titleOf(item)} ${item.overview} ${item.genre || ""}`.toLocaleLowerCase().includes(needle);
      });
      state.movies = samples;
      renderMovies(samples);
      $("#catalog-count").textContent = samples.length ? `${samples.length} filamu za mfano` : "Hakuna matokeo";
      $("#load-more").hidden = true;
      $("#catalog-message").textContent = "Huduma ya movies haijajibu. Kagua TMDB_API_KEY na hali ya deployment ya Vercel.";
    } finally {
      if (state.activeController === controller) state.busy = false;
    }
  }

  function movieCard(movie, index) {
    const title = titleOf(movie);
    const poster = movie.poster_path || movie.poster || "";
    const isTv = movie.media_type === "tv" || movie.type === "tv";
    const rating = Number(movie.vote_average) > 0 ? `★ ${Number(movie.vote_average).toFixed(1)}` : (movie.genre || (isTv ? "SERIES" : "DISCOVER"));
    return `<button class="movie-card" type="button" data-movie-id="${escapeHtml(movie.id)}" data-movie-type="${isTv ? "tv" : "movie"}" aria-label="Maelezo ya ${escapeHtml(title)}">
      <div class="poster">${poster ? `<img loading="lazy" src="${escapeHtml(poster)}" alt="Poster ya ${escapeHtml(title)}" onerror="this.remove()">` : `<span class="poster-placeholder"><span class="poster-title">${escapeHtml(title)}</span></span>`}<span class="poster-number">M • ${String(index + 1).padStart(2, "0")}</span><span class="poster-kind">${isTv ? "SERIES" : "FILAMU"}</span></div>
      <h3>${escapeHtml(title)}</h3><p class="movie-meta"><span>${escapeHtml(yearOf(movie))}</span><span class="movie-rating">${escapeHtml(rating)}</span></p>
    </button>`;
  }
  function renderMovies(movies) {
    const grid = $("#movie-grid");
    grid.innerHTML = movies.length ? movies.map(movieCard).join("") : `<div class="empty-state">Hakuna filamu kwa sasa. Jaribu tena baadaye.</div>`;
    $$(".movie-card", grid).forEach(button => button.addEventListener("click", () => openDetails(button.dataset.movieId, button.dataset.movieType)));
    if (movies.length && !state.query && state.page === 1 && state.category !== "watchlist") {
      const lead = movies[0];
      $("#hero-title").innerHTML = `${escapeHtml(titleOf(lead))}<br><span>${escapeHtml(yearOf(lead))}</span>`;
      $("#hero-overview").textContent = lead.overview || "Tazama maelezo, trela na chaguo halali za kutazama.";
      state.selected = lead;
      $("#hero-trailer").textContent = lead.trailer_url ? "▶ CHEZA TRELA HAPA" : "▶ MAELEZO NA CHAGUO HALALI";
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
  function renderDjDirectory(djs) {
    const grid = $("#dj-directory");
    if (!grid) return;
    const rows = Array.isArray(djs) ? djs : [];
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state translation-empty"><strong>Orodha ya DJs haipatikani kwa sasa.</strong><span>Hakuna full translation au download itakayoongezwa bila chanzo na haki kuthibitishwa.</span></div>`;
      return;
    }
    grid.innerHTML = rows.map(item => {
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
  }
  function renderTranslations(items) {
    const grid = $("#translation-grid");
    if (!grid) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state translation-empty"><strong>Bado hakuna vipande vya tafsiri vilivyoongezwa.</strong><span>Vipande vitaonekana baada ya kuthibitisha channel ya DJ au chanzo cha mwenye haki. Hatuweki filamu nzima au downloads zisizo na ruhusa.</span></div>`;
      return;
    }
    grid.innerHTML = rows.map(item => {
      const title = escapeHtml(item.title || "Filamu");
      const dj = escapeHtml(item.dj || "DJ wa Tanzania");
      const year = item.year ? `<span>${escapeHtml(item.year)}</span>` : "";
      const previewUrl = safeExternalLink(item.preview_url || item.official_watch_url);
      const sourceUrl = safeExternalLink(item.source_url);
      const downloadUrl = item.download_authorized === true ? safeExternalLink(item.official_download_url) : "";
      const watchLabel = escapeHtml(item.watch_label || "TAZAMA RASMI ↗");
      const sourceNote = escapeHtml(item.source_note || "Chanzo cha DJ.");
      const sourceLabel = escapeHtml(item.source_label || "CHANZO ↗");
      const watchAction = previewUrl ? `<a class="button button--ghost" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">${watchLabel}</a>` : "";
      const downloadAction = downloadUrl ? `<a class="button button--primary" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">PAKUA RASMI ↗</a>` : "";
      const sourceMarkup = sourceUrl ? `<a class="translation-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a>` : "";
      return `<article class="translation-card"><div class="translation-card__mark" aria-hidden="true">TZ</div><div class="translation-card__copy"><p class="eyebrow eyebrow--muted">TAFSIRI YA DJ</p><h3>${title}</h3><p>${dj}${year ? ` · ${year}` : ""}</p><p class="translation-source-note">${sourceNote}</p>${sourceMarkup}<div class="translation-actions">${watchAction}${downloadAction}</div></div></article>`;
    }).join("");
  }
  async function loadTranslations() {
    try {
      const response = await fetch("/data/tanzania-translations.json", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("TRANSLATIONS_UNAVAILABLE");
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const visible = new Set(items.map(item => String(item.dj || "").trim().toLocaleLowerCase()));
      const djs = (Array.isArray(data.djs) ? data.djs : []).filter(item => visible.has(String(item.name || "").trim().toLocaleLowerCase()));
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
  async function openDetails(id, type = "movie") {
    const dialog = $("#movie-dialog");
    const content = $("#dialog-content");
    content.innerHTML = `<div class="empty-state">Inatafuta maelezo…</div>`;
    dialog.showModal();
    let movie = state.movies.find(item => String(item.id) === String(id));
    if (!movie) movie = fallbackMovies.find(item => String(item.id) === String(id));
    try {
      const data = await request(`/api/movies?detail=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
      movie = data.movie || movie;
    } catch { /* retain available catalogue data */ }
    if (!movie) { content.innerHTML = `<div class="empty-state">Maelezo ya filamu hii hayapatikani.</div>`; return; }
    const title = titleOf(movie);
    const trailer = safeEmbedUrl(movie.trailer_url);
    const providers = Array.isArray(movie.providers) ? movie.providers : [];
    const backdrop = movie.backdrop_path || movie.backdrop || "";
    const watchUrl = safeExternalLink(movie.watch_url) || `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`;
    const providerMarkup = providers.length
      ? `<p class="dialog-kicker">HUDUMA RASMI ZA KUTAZAMA • TANZANIA</p><div class="provider-list">${providers.map(item => `<a class="provider-chip" href="${escapeHtml(safeExternalLink(item.link) || watchUrl)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml((item.access || []).join(" · "))}</small></a>`).join("")}</div>`
      : `<div class="watch-empty"><p>TMDB haijaorodhesha huduma ya kutazama Tanzania kwa filamu hii kwa sasa.</p><a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">ANGALIA UPATIKANAJI RASMI ↗</a></div>`;
    const trailerMarkup = trailer
      ? `<section class="inline-player" aria-label="Trela rasmi ya ${escapeHtml(title)}"><div class="inline-player__frame"><iframe title="Trela rasmi ya ${escapeHtml(title)}" src="${escapeHtml(trailer)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p>Trela rasmi inachezwa ndani ya MOMO; si filamu nzima. Tumia huduma rasmi hapo juu kutazama filamu kamili.</p></section>`
      : `<div class="inline-player-note">Trela ya ku-embed haipatikani kwa sasa. Hakuna utafutaji au redirect wa YouTube; angalia huduma rasmi zilizoorodheshwa.</div>`;
    const downloadUrl = movie.download_authorized === true ? safeExternalLink(movie.download_url) : "";
    const downloadMarkup = downloadUrl
      ? `<a class="button button--ghost" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">PAKUA RASMI ↗</a>`
      : `<div class="download-note"><strong>Download rasmi</strong><span>Pakua/offline tu kupitia app ya huduma rasmi ikiwa inaruhusu; MOMO haihosti faili za filamu.</span></div>`;
    content.innerHTML = `<div class="dialog-backdrop" ${backdrop ? `style="background-image:linear-gradient(0deg,#06140c,transparent 80%),url('${escapeHtml(backdrop)}')"` : ""}></div><div class="dialog-body"><p class="dialog-kicker">MOMO MOVIE FILE • ${movie.media_type === "tv" || type === "tv" ? "SERIES" : "FEATURE"}</p><h2 id="dialog-title">${escapeHtml(title)}</h2><div class="dialog-info"><span>${escapeHtml(yearOf(movie))}</span>${Number(movie.vote_average) > 0 ? `<span>★ ${Number(movie.vote_average).toFixed(1)}</span>` : ""}${movie.runtime ? `<span>${escapeHtml(movie.runtime)} min</span>` : ""}</div><p class="dialog-overview">${escapeHtml(movie.overview || "Maelezo hayajapatikana.")}</p>${trailerMarkup}${providerMarkup}<div class="dialog-actions"><a class="button button--primary" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">${providers.length ? "ANGALIA HUDUMA ZA KUTAZAMA ↗" : "ANGALIA UPATIKANAJI RASMI ↗"}</a>${downloadMarkup}<button class="button button--ghost" id="save-movie" type="button">♡ HIFADHI KWENYE ORODHA</button></div></div>`;
    $("#save-movie", content).addEventListener("click", () => toggleWatchlist(movie));
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
    const grid = $("#library-grid");
    if (!grid) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state">Hakuna video yenye ruhusa iliyothibitishwa iliyochapishwa hapa bado. Trela na huduma rasmi bado zinapatikana kwenye catalog.</div>`;
      return;
    }
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
    content.innerHTML = `<div class="dialog-body library-player-dialog"><p class="dialog-kicker">MOMO MOVIE LIBRARY • RIGHTS VERIFIED</p><h2 id="dialog-title">${escapeHtml(item.title)}</h2><p class="dialog-overview">${escapeHtml(item.synopsis || "Maudhui rasmi yaliyoidhinishwa.")}</p><div id="library-player-mount" class="inline-player__frame"></div><p class="player-rights-note">Chanzo hiki kimeongezwa na admin aliyeidhinishwa kama maudhui yenye ruhusa ya kucheza.</p></div>`;
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
    dialog.showModal();
  }
  function toggleWatchlist(movie) {
    const list = watchlist();
    const exists = list.some(item => String(item.id) === String(movie.id));
    const next = exists ? list.filter(item => String(item.id) !== String(movie.id)) : [...list, movie];
    localStorage.setItem("momo-watchlist", JSON.stringify(next));
    const button = $("#save-movie");
    if (button) button.textContent = exists ? "♡ HIFADHI KWENYE ORODHA" : "✓ IMEHIFADHIWA";
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
      button.querySelector("span").textContent = "VERIFYING ACCESS…";
      try {
        await request("/api/enter", { method: "POST", body: JSON.stringify({ phone, password }) });
        message.textContent = "Access granted. Opening the movie network…";
        message.classList.add("is-success");
        await renderCount();
        showCatalog();
      } catch (error) {
        message.textContent = error.status === 503 ? "Access service is offline. The site owner must configure Supabase on Vercel." : (error.message || "ACCESS DENIED. Check your phone number and unlock code.");
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
      showGate("Session closed successfully.", true);
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
    $("#hero-trailer").addEventListener("click", () => state.selected && openDetails(state.selected.id, state.selected.media_type || "movie"));
    $("#dialog-close").addEventListener("click", () => $("#movie-dialog").close());
    $("#movie-dialog").addEventListener("click", event => { if (event.target === $("#movie-dialog")) $("#movie-dialog").close(); });
    $("#movie-dialog").addEventListener("close", () => { $("#dialog-content").replaceChildren(); });
    $("#year").textContent = new Date().getFullYear();
    const newReleasesLabel = $("#new-releases-label");
    if (newReleasesLabel) newReleasesLabel.textContent = `Mpya ${currentTanzaniaYear()}`;
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
