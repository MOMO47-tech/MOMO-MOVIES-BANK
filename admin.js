(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const loginPanel = $("#login-panel");
  const dashboardPanel = $("#dashboard-panel");
  const form = $("#library-form");
  const setupPanel = $("#setup-panel");
  const setupForm = $("#admin-setup-form");
  const state = { items: [], comments: [], commentsHasMore: false };
  let commentsLoading = false;
  const inviteContext = { accessToken: null };

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch { /* Use a safe fallback for non-JSON errors. */ }
    if (!response.ok) throw Object.assign(new Error(data.error || "Ombi halijakamilika."), { status: response.status });
    return data;
  }
  function setMessage(selector, text, success = false) {
    const element = $(selector);
    element.textContent = text;
    element.classList.toggle("is-success", success);
  }
  function setAuthenticated(value) {
    loginPanel.hidden = value || Boolean(inviteContext.accessToken);
    setupPanel.hidden = value || !inviteContext.accessToken;
    dashboardPanel.hidden = !value;
  }
  function clearAuthUrl(url) {
    url.hash = "";
    ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "error", "error_description", "error_code"].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(null, document.title, `${url.pathname}${url.search}`);
  }
  function readInviteLink() {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const get = key => url.searchParams.get(key) || fragment.get(key);
    const accessToken = get("access_token");
    const type = get("type");
    const error = get("error_description") || get("error");
    if (accessToken && type === "invite") {
      inviteContext.accessToken = accessToken;
      clearAuthUrl(url);
      setAuthenticated(false);
      setMessage("#setup-message", "Mwaliko umethibitishwa. Chagua nenosiri lako.", true);
      return true;
    }
    if (error && type === "invite") {
      clearAuthUrl(url);
      setMessage("#login-message", "Kiungo cha mwaliko kimekwisha muda au hakikukamilika. Omba mwaliko mpya.");
    }
    return false;
  }
  function renderItems() {
    const list = $("#entry-list");
    if (!state.items.length) {
      list.innerHTML = '<div class="empty-state">Bado hakuna rekodi. Tumia fomu kuongeza maudhui yenye ruhusa.</div>';
      return;
    }
    list.innerHTML = state.items.map(item => {
      const status = item.is_published && item.rights_verified ? "IMECHAPISHWA" : "RASIMU";
      const kind = item.media_type === "series" ? "SERIES" : "FILAMU";
      return `<article class="entry-card"><div class="entry-copy"><p class="eyebrow">${kind} · ${status}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.synopsis || "Hakuna maelezo.")}</p><small>${item.rights_verified ? "✓ Haki zimethibitishwa" : "Haki hazijathibitishwa"}${item.updated_at ? ` · Imesasishwa ${escapeHtml(new Date(item.updated_at).toLocaleDateString("sw-TZ"))}` : ""}</small></div><div class="entry-actions"><button class="text-button" type="button" data-edit="${escapeHtml(item.id)}">Hariri</button><button class="text-button text-button--danger" type="button" data-delete="${escapeHtml(item.id)}">Futa</button></div></article>`;
    }).join("");
  }
  async function loadItems() {
    setMessage("#list-message", "Inapakia...");
    try {
      const data = await api("/api/admin-library");
      state.items = Array.isArray(data.items) ? data.items : [];
      setMessage("#list-message", `${state.items.length} rekodi`, true);
      renderItems();
    } catch (error) {
      setMessage("#list-message", error.message || "Imeshindikana kupakia rekodi.");
      $("#entry-list").innerHTML = '<div class="empty-state">Kagua schema ya Supabase na ruhusa za admin, kisha ujaribu tena.</div>';
    }
  }
  function renderAdminComments() {
    const list = $("#comment-review-list");
    const query = $("#comments-search").value.trim().toLocaleLowerCase();
    const filtered = state.comments.filter(comment => !query || `${comment.movie_title || ""} ${comment.author || ""} ${comment.text || ""}`.toLocaleLowerCase().includes(query));
    $("#comments-count").textContent = `${filtered.length} / ${state.comments.length} LOADED`;
    if (!state.comments.length) {
      list.innerHTML = '<div class="empty-state">Bado hakuna maoni ya members.</div>';
      return;
    }
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">Hakuna maoni yanayolingana na utafutaji huo.</div>';
      return;
    }
    list.innerHTML = filtered.map(comment => {
      const timestamp = new Date(comment.updated_at || comment.created_at);
      const date = Number.isNaN(timestamp.getTime()) ? "TIME UNKNOWN" : timestamp.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      return `<article class="comment-review-card"><div class="comment-review-card__top"><div><p class="eyebrow">${escapeHtml(comment.author || "MEMBER")}</p><h3>${escapeHtml(comment.movie_title || "Untitled movie")}</h3></div><time datetime="${escapeHtml(comment.updated_at || comment.created_at || "")}">${escapeHtml(date)}</time></div><p class="comment-review-card__text">${escapeHtml(comment.text || "")}</p></article>`;
    }).join("");
  }
  async function loadComments({ append = false } = {}) {
    if (commentsLoading) return;
    commentsLoading = true;
    const button = $("#load-more-comments");
    button.disabled = true;
    const offset = append ? state.comments.length : 0;
    if (!append) {
      state.comments = [];
      state.commentsHasMore = false;
    }
    setMessage("#comments-message", append ? "Inapakia maoni zaidi…" : "Inapakia maoni…");
    try {
      const data = await api(`/api/admin-comments?offset=${offset}`);
      const page = Array.isArray(data.comments) ? data.comments : [];
      state.comments = append ? [...state.comments, ...page] : page;
      state.commentsHasMore = data.has_more === true;
      renderAdminComments();
      setMessage("#comments-message", `Maoni ${state.comments.length} yamepakiwa${state.commentsHasMore ? "; kuna mengine zaidi." : "."}`, true);
    } catch (error) {
      if (!append) {
        state.comments = [];
        state.commentsHasMore = false;
        $("#comments-count").textContent = "LOCKED";
        $("#comment-review-list").innerHTML = '<div class="empty-state">Feed haipatikani. Hakikisha umeingia kwa akaunti iliyo kwenye admin allow-list.</div>';
      }
      setMessage("#comments-message", error.message || "Imeshindikana kupakia maoni.");
    } finally {
      commentsLoading = false;
      button.disabled = false;
      button.hidden = !state.commentsHasMore;
    }
  }
  async function loadDashboardData() {
    await Promise.all([loadItems(), loadComments()]);
  }
  function resetForm() {
    form.reset();
    $("#item-id").value = "";
    $("#editor-title").textContent = "Ongeza maudhui";
    $("#save-item").innerHTML = "HIFADHI MAUDHUI <span>→</span>";
    setMessage("#form-message", "");
  }
  function editItem(id) {
    const item = state.items.find(candidate => String(candidate.id) === String(id));
    if (!item) return;
    $("#item-id").value = item.id;
    $("#item-title").value = item.title || "";
    $("#item-type").value = item.media_type || "movie";
    $("#item-date").value = item.release_date || "";
    $("#item-synopsis").value = item.synopsis || "";
    $("#item-poster").value = item.poster_url || "";
    $("#item-playback-type").value = item.playback_type || "file";
    $("#item-playback").value = item.playback_url || "";
    $("#item-rights-url").value = item.rights_url || "";
    $("#item-rights-notes").value = item.rights_notes || "";
    $("#item-rights-verified").checked = item.rights_verified === true;
    $("#item-published").checked = item.is_published === true;
    $("#editor-title").textContent = "Hariri maudhui";
    $("#save-item").innerHTML = "HIFADHI MABADILIKO <span>→</span>";
    setMessage("#form-message", "Unahariri rekodi iliyopo.", true);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function submitItem(event) {
    event.preventDefault();
    const button = $("#save-item");
    const id = $("#item-id").value;
    const data = new FormData(form);
    const payload = {
      id,
      title: data.get("title"),
      media_type: data.get("media_type"),
      release_date: data.get("release_date"),
      synopsis: data.get("synopsis"),
      poster_url: data.get("poster_url"),
      playback_type: data.get("playback_type"),
      playback_url: data.get("playback_url"),
      rights_url: data.get("rights_url"),
      rights_notes: data.get("rights_notes"),
      rights_verified: $("#item-rights-verified").checked,
      is_published: $("#item-published").checked
    };
    button.disabled = true;
    setMessage("#form-message", "Inahifadhi...");
    try {
      await api("/api/admin-library", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      resetForm();
      setMessage("#form-message", "Maudhui yamehifadhiwa.", true);
      await loadItems();
    } catch (error) {
      setMessage("#form-message", error.message || "Imeshindikana kuhifadhi.");
    } finally {
      button.disabled = false;
    }
  }
  async function deleteItem(id) {
    const item = state.items.find(candidate => String(candidate.id) === String(id));
    if (!item || !window.confirm(`Futa “${item.title}” kabisa?`)) return;
    try {
      await api(`/api/admin-library?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if ($("#item-id").value === id) resetForm();
      setMessage("#list-message", "Rekodi imefutwa.", true);
      await loadItems();
    } catch (error) {
      setMessage("#list-message", error.message || "Imeshindikana kufuta rekodi.");
    }
  }
  async function checkSession() {
    try {
      const data = await api("/api/admin-auth");
      setAuthenticated(data.authenticated === true);
      if (data.authenticated) await loadDashboardData();
    } catch (error) {
      setAuthenticated(false);
      if (error.status === 503) setMessage("#login-message", error.message);
    }
  }

  setupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#setup-button");
    const password = $("#setup-password").value;
    const confirmation = $("#setup-password-confirm").value;
    if (!inviteContext.accessToken) {
      setMessage("#setup-message", "Kiungo cha mwaliko hakipo. Fungua tena link uliyopokea.");
      return;
    }
    if (password.length < 12 || password.length > 256) {
      setMessage("#setup-message", "Nenosiri liwe na angalau herufi 12.");
      return;
    }
    if (password !== confirmation) {
      setMessage("#setup-message", "Nenosiri halilingani.");
      return;
    }
    button.disabled = true;
    setMessage("#setup-message", "Inahifadhi nenosiri...");
    try {
      await api("/api/admin-auth", {
        method: "POST",
        body: JSON.stringify({ access_token: inviteContext.accessToken, new_password: password })
      });
      inviteContext.accessToken = null;
      setupForm.reset();
      setMessage("#setup-message", "Nenosiri limehifadhiwa.", true);
      setAuthenticated(true);
      await loadDashboardData();
    } catch (error) {
      setMessage("#setup-message", error.message || "Imeshindikana kuweka nenosiri.");
    } finally {
      button.disabled = false;
    }
  });

  $("#admin-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#login-button");
    button.disabled = true;
    setMessage("#login-message", "Inathibitisha...");
    try {
      await api("/api/admin-auth", {
        method: "POST",
        body: JSON.stringify({ email: $("#admin-email").value.trim(), password: $("#admin-password").value })
      });
      $("#admin-password").value = "";
      setMessage("#login-message", "Umeingia.", true);
      setAuthenticated(true);
      await loadDashboardData();
    } catch (error) {
      setMessage("#login-message", error.message || "Imeshindikana kuingia.");
    } finally {
      button.disabled = false;
    }
  });
  $("#admin-logout").addEventListener("click", async () => {
    try { await api("/api/admin-auth", { method: "DELETE" }); } catch { /* Always remove the local admin view. */ }
    setAuthenticated(false);
    resetForm();
    state.comments = [];
    state.commentsHasMore = false;
    $("#load-more-comments").hidden = true;
    $("#comments-count").textContent = "LOCKED";
    $("#comment-review-list").innerHTML = '<div class="empty-state">Maoni yataonekana baada ya admin kuingia.</div>';
  });
  form.addEventListener("submit", submitItem);
  $("#reset-form").addEventListener("click", resetForm);
  $("#refresh-list").addEventListener("click", loadItems);
  $("#refresh-comments").addEventListener("click", () => loadComments());
  $("#load-more-comments").addEventListener("click", () => loadComments({ append: true }));
  $("#comments-search").addEventListener("input", renderAdminComments);
  $("#entry-list").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) editItem(edit.dataset.edit);
    if (remove) deleteItem(remove.dataset.delete);
  });
  if (!readInviteLink()) checkSession();
})();
