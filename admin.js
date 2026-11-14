(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const loginPanel = $("#login-panel");
  const dashboardPanel = $("#dashboard-panel");
  const form = $("#library-form");
  const setupPanel = $("#setup-panel");
  const setupForm = $("#admin-setup-form");
  const djUploadForm = $("#dj-upload-form");
  const DJ_MACK_MARKER = "[[MOMO_DJ_MACK]]";
  const state = { items: [], comments: [], commentsHasMore: false, editingDjMack: false };
  const uploadState = { context: null, file: null, upload: null, busy: false };
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
    if (!response.ok) throw Object.assign(new Error(data.error || "Ombi halijakamilika."), { status: response.status, data });
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
    const search = $("#library-search").value.trim().toLocaleLowerCase();
    const category = $("#library-filter").value;
    const filtered = state.items.filter(item => {
      const synopsis = String(item.synopsis || "").replace(`${DJ_MACK_MARKER}\n`, "").trim();
      const isDjMack = String(item.synopsis || "").startsWith(`${DJ_MACK_MARKER}\n`);
      const isSeries = item.media_type === "series";
      const status = item.is_published && item.rights_verified ? "imechapishwa" : "rasimu";
      const matchesCategory = category === "dj-mack" ? isDjMack
        : category === "other-movies" ? !isDjMack && !isSeries
          : category === "series" ? isSeries
            : true;
      const searchable = [item.title, item.release_date, synopsis, item.rights_notes, status, isSeries ? "series" : "filamu", isDjMack ? "dj mack" : ""]
        .join(" ").toLocaleLowerCase();
      return matchesCategory && (!search || searchable.includes(search));
    });
    setMessage("#list-message", `${filtered.length} / ${state.items.length} rekodi`, true);
    if (!state.items.length) {
      list.innerHTML = '<div class="empty-state">Bado hakuna rekodi. Tumia fomu kuongeza maudhui yenye ruhusa.</div>';
      return;
    }
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">Hakuna rekodi inayolingana. Badilisha utafutaji au kichujio.</div>';
      return;
    }
    list.innerHTML = filtered.map(item => {
      const status = item.is_published && item.rights_verified ? "IMECHAPISHWA" : "RASIMU";
      const djMack = String(item.synopsis || "").startsWith(`${DJ_MACK_MARKER}\n`);
      const kind = djMack ? "DJ MACK" : item.media_type === "series" ? "SERIES" : "FILAMU";
      const synopsis = djMack ? String(item.synopsis || "").slice(DJ_MACK_MARKER.length).trim() : item.synopsis;
      const recordType = item.media_type === "series" ? "SERIES" : "FILAMU";
      return `<article class="entry-card"><div class="entry-copy"><p class="eyebrow">${kind} · ${status}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(synopsis || "Hakuna maelezo.")}</p><small>${item.rights_verified ? "✓ Haki zimethibitishwa" : "Haki hazijathibitishwa"}${item.updated_at ? ` · Imesasishwa ${escapeHtml(new Date(item.updated_at).toLocaleDateString("sw-TZ"))}` : ""}</small></div><div class="entry-actions" aria-label="Vitendo vya ${escapeHtml(item.title)}"><button class="entry-action entry-action--edit" type="button" data-edit="${escapeHtml(item.id)}" aria-label="Hariri ${escapeHtml(item.title)}">HARIRI ${recordType}</button><button class="entry-action entry-action--delete" type="button" data-delete="${escapeHtml(item.id)}" aria-label="Futa ${escapeHtml(item.title)}">FUTA ${recordType}</button></div></article>`;
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
    state.editingDjMack = false;
    $("#editor-title").textContent = "Ongeza maudhui";
    $("#save-item").innerHTML = "HIFADHI MAUDHUI <span>→</span>";
    setMessage("#form-message", "");
  }
  function editItem(id) {
    const item = state.items.find(candidate => String(candidate.id) === String(id));
    if (!item) return;
    state.editingDjMack = String(item.synopsis || "").startsWith(`${DJ_MACK_MARKER}\n`);
    $("#item-id").value = item.id;
    $("#item-title").value = item.title || "";
    $("#item-type").value = item.media_type || "movie";
    $("#item-date").value = item.release_date || "";
    $("#item-synopsis").value = state.editingDjMack ? String(item.synopsis || "").slice(DJ_MACK_MARKER.length).trim() : (item.synopsis || "");
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
      synopsis: `${state.editingDjMack ? `${DJ_MACK_MARKER}\n` : ""}${String(data.get("synopsis") || "")}`,
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
  function uploadDetails() {
    const data = new FormData(djUploadForm);
    return {
      title: String(data.get("title") || "").trim(),
      release_year: String(data.get("release_year") || "").trim(),
      synopsis: String(data.get("synopsis") || "").trim(),
      poster_url: String(data.get("poster_url") || "").trim(),
      rights_url: String(data.get("rights_url") || "").trim(),
      rights_notes: String(data.get("rights_notes") || "").trim(),
      rights_confirmed: $("#dj-upload-rights-confirm").checked
    };
  }
  function sameUploadFile(first, second) {
    return Boolean(first && second && first.name === second.name && first.size === second.size && first.lastModified === second.lastModified);
  }
  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[index]}`;
  }
  function setUploadProgress(percentage, uploaded, total) {
    const progress = $("#dj-upload-progress");
    progress.hidden = false;
    progress.value = Math.max(0, Math.min(100, Number(percentage) || 0));
    const suffix = total ? ` · ${formatBytes(uploaded)} / ${formatBytes(total)}` : "";
    setMessage("#dj-upload-message", `Uploading to Supabase: ${Math.round(progress.value)}%${suffix}`);
  }
  function setUploadBusy(value) {
    uploadState.busy = value;
    $("#dj-upload-submit").disabled = value;
    djUploadForm.querySelectorAll("input, textarea").forEach(field => { field.disabled = value; });
    $("#dj-upload-submit").innerHTML = value ? "UPLOADING…" : (uploadState.context ? "RESUME / RETRY UPLOAD" : "UPLOAD TO DJ MACK <span>↑</span>");
  }
  async function discardUploadContext() {
    const context = uploadState.context;
    if (!context) return;
    try { if (uploadState.upload) await uploadState.upload.abort(true); } catch {}
    if (context.upload?.path) {
      try {
        await api("/api/admin-dj-upload", { method: "POST", body: JSON.stringify({ action: "discard", path: context.upload.path }) });
      } catch { /* An unfinished TUS session expires; an unlisted file can be retried or removed by an admin. */ }
    }
    uploadState.context = null;
    uploadState.file = null;
    uploadState.upload = null;
    $("#dj-upload-progress").hidden = true;
  }
  async function publishDjUpload(context, file) {
    setUploadBusy(true);
    setMessage("#dj-upload-message", "Upload complete. Verifying MP4 and publishing to DJ Mack…");
    try {
      await api("/api/admin-dj-upload", {
        method: "POST",
        body: JSON.stringify({
          ...context.details,
          action: "complete",
          path: context.upload.path,
          file_size: file.size
        })
      });
      $("#dj-upload-progress").value = 100;
      setMessage("#dj-upload-message", "Published to DJ Mack. The movie now appears on the public site.", true);
      djUploadForm.reset();
      uploadState.context = null;
      uploadState.file = null;
      uploadState.upload = null;
      $("#dj-upload-submit").innerHTML = "UPLOAD TO DJ MACK <span>↑</span>";
      await loadItems();
    } catch (error) {
      throw error;
    } finally {
      setUploadBusy(false);
    }
  }
  async function runTusUpload(file, context) {
    if (!window.tusClient || typeof window.tusClient.Upload !== "function") throw new Error("TUS upload library failed to load. Refresh the page and try again.");
    return new Promise((resolve, reject) => {
      const upload = new window.tusClient.Upload(file, {
        endpoint: context.upload.endpoint,
        headers: { "x-signature": context.upload.token },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        fingerprint: (fileInfo, options) => Promise.resolve(`${options.endpoint}:${context.upload.path}:${fileInfo.size}:${fileInfo.lastModified}`),
        metadata: {
          bucketName: context.upload.bucket,
          objectName: context.upload.path,
          contentType: "video/mp4",
          cacheControl: "3600"
        },
        onProgress: (uploaded, total) => setUploadProgress(total ? uploaded / total * 100 : 0, uploaded, total),
        onError: () => {
          uploadState.upload = null;
          setUploadBusy(false);
          setMessage("#dj-upload-message", "Upload paused. Check your connection and tap RESUME / RETRY UPLOAD.");
          reject(new Error("Upload paused. Check your connection and retry."));
        },
        onSuccess: () => {
          context.completed = true;
          uploadState.upload = null;
          setUploadProgress(100, file.size, file.size);
          resolve();
        }
      });
      uploadState.upload = upload;
      (async () => {
        const previous = await upload.findPreviousUploads();
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })().catch(reject);
    });
  }
  async function submitDjUpload(event) {
    event.preventDefault();
    if (uploadState.busy) return;
    if (!djUploadForm.reportValidity()) return;
    const file = $("#dj-upload-file").files?.[0];
    if (!file || !/\.mp4$/i.test(file.name) || (file.type && !["video/mp4", "application/octet-stream"].includes(file.type))) {
      setMessage("#dj-upload-message", "Choose an MP4 video file from your phone.");
      return;
    }
    const details = uploadDetails();
    if (details.rights_notes.length < 15) {
      setMessage("#dj-upload-message", "Add at least 15 characters describing the permission or license.");
      $("#dj-upload-rights-notes").focus();
      return;
    }

    if (uploadState.context && (!sameUploadFile(file, uploadState.file) || JSON.stringify(details) !== JSON.stringify(uploadState.context.details))) {
      await discardUploadContext();
      setMessage("#dj-upload-message", "The selected file or details changed. A fresh upload will start.");
    }

    setUploadBusy(true);
    $("#dj-upload-progress").hidden = false;
    try {
      if (!uploadState.context) {
        setMessage("#dj-upload-message", "Checking admin access and preparing a secure upload…");
        const initialized = await api("/api/admin-dj-upload", {
          method: "POST",
          body: JSON.stringify({ action: "init", ...details, file_size: file.size })
        });
        uploadState.context = { upload: initialized.upload, details: { ...details }, completed: false };
        uploadState.file = file;
      }
      if (!uploadState.context.completed) await runTusUpload(file, uploadState.context);
      await publishDjUpload(uploadState.context, file);
    } catch (error) {
      if (error.data?.retry_upload === true && uploadState.context?.completed) {
        await discardUploadContext();
        const message = error.data.cleanup_failed === true
          ? "MP4 haikuchapishwa na usafi wa faili haujathibitishwa. Kagua Supabase Storage, kisha upload upya."
          : "MP4 iliwasilishwa lakini haikuchapishwa. Bonyeza UPLOAD tena ili kujaribu upya.";
        setMessage("#dj-upload-message", message);
        return;
      }
      setUploadBusy(false);
      const limit = Number(error.data?.maxFileBytes);
      const message = Number.isSafeInteger(limit) && limit > 0
        ? `This MP4 exceeds the current Supabase limit of ${formatBytes(limit)}. Reduce the file size or raise the Storage limit in Supabase.`
        : (error.message || "Upload failed. Check your connection and try again.");
      setMessage("#dj-upload-message", message);
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
    if (uploadState.context) await discardUploadContext();
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
  djUploadForm.addEventListener("submit", submitDjUpload);
  $("#library-search").addEventListener("input", renderItems);
  $("#library-filter").addEventListener("change", renderItems);
  $("#dj-upload-file").addEventListener("change", () => {
    const file = $("#dj-upload-file").files?.[0];
    if (!file) return;
    $("#dj-upload-progress").hidden = true;
    const privateName = String(file.name || "video.mp4").replace(/[\r\n]+/g, " ").slice(0, 120);
    setMessage("#dj-upload-message", `Umechagua: ${privateName} · ${formatBytes(file.size)}. Jina linaonekana hapa kwa admin pekee; halitachapishwa.`);
  });
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
