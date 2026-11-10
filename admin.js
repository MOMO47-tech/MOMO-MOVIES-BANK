(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const loginPanel = $("#login-panel");
  const dashboardPanel = $("#dashboard-panel");
  const form = $("#library-form");
  const state = { items: [] };

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
    loginPanel.hidden = value;
    dashboardPanel.hidden = !value;
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
      if (data.authenticated) await loadItems();
    } catch (error) {
      setAuthenticated(false);
      if (error.status === 503) setMessage("#login-message", error.message);
    }
  }

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
      await loadItems();
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
  });
  form.addEventListener("submit", submitItem);
  $("#reset-form").addEventListener("click", resetForm);
  $("#refresh-list").addEventListener("click", loadItems);
  $("#entry-list").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) editItem(edit.dataset.edit);
    if (remove) deleteItem(remove.dataset.delete);
  });
  checkSession();
})();
