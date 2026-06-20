(function () {
  const FALLBACK_API = "http://127.0.0.1:8765";
  const LOCAL_API_CANDIDATES = ["http://127.0.0.1:8765", "http://localhost:8765"];
  const storedApiBase = localStorage.getItem("secondMeApiBase") || "";
  const DEFAULT_API = window.SECOND_ME_API_BASE || normalizeApiBase(storedApiBase) || FALLBACK_API;
  const DEFAULT_TOKEN = localStorage.getItem("secondMeApiToken") || "";
  const DEFAULT_THINKING = localStorage.getItem("secondMeThinking") === "true";

  const CORE_PHOTOS = [
    ["Bangkok", "2026-05-02", "data/normalized/photos/resized_1600/2026/05/0FE1D37A-9C57-4F73-AF07-02FFBFA8DB13.jpg"],
    ["Museum", "2026-05-02", "data/normalized/photos/resized_1600/2026/05/FEE51636-DA4F-45CC-A908-27B5277CE281.jpg"],
    ["City", "2026-05-04", "data/normalized/photos/resized_1600/2026/05/0C08970C-4518-4BC8-B50B-0689C2438A5D.jpg"],
    ["NUS", "2021-09-09", "data/normalized/photos/resized_1600/2021/09/03A5EA77-8DF0-4FA2-9DA6-D4F7EEFA5F3A.jpg"],
    ["Notes", "2022-01-01", "data/normalized/photos/resized_1600/2022/01/9C4CF63F-D619-44D2-86CC-CC784EE53200.jpg"],
  ];

  const state = {
    apiBase: normalizeApiBase(DEFAULT_API) || FALLBACK_API,
    token: DEFAULT_TOKEN,
    thinking: DEFAULT_THINKING,
    settingsOpen: false,
    busy: false,
    detail: null,
    messages: [
      {
        role: "assistant",
        content: "问吧。某天去了哪、某个人是谁、我为什么那么选，或者直接让我翻几张当时的图。",
      },
    ],
  };

  const root = document.getElementById("second-me-root");

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(child => {
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function joinUrl(base, path) {
    return String(base || "").replace(/\/+$/, "") + path;
  }

  function normalizeApiBase(value) {
    const text = String(value || "").replace(/\/+$/, "");
    if (!text) return "";
    if (text === "http://localhost:8765") return FALLBACK_API;
    return text;
  }

  function apiCandidates(apiBase) {
    const normalized = normalizeApiBase(apiBase) || FALLBACK_API;
    return Array.from(new Set([normalized, ...LOCAL_API_CANDIDATES]));
  }

  function fileUrl(apiBase, url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url)) return url;
    return joinUrl(apiBase, url);
  }

  function memoryFileUrl(apiBase, path) {
    return fileUrl(apiBase, "/api/memory/file?" + new URLSearchParams({ path }).toString());
  }

  async function readJsonResponse(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (err) {
      return { error: text || res.statusText || err.message };
    }
  }

  function apiConnectHint(apiBase) {
    return `连接不到 API：${apiBase}。如果是在这台 Mac 打开，点“设置 -> 恢复默认”或填 ${FALLBACK_API}；如果是在手机/另一台电脑打开，localhost/127.0.0.1 指的是那台设备，需要改成本机局域网 API 地址。`;
  }

  async function callApi(apiBase, token, path, body) {
    let lastError = null;
    for (const candidate of apiCandidates(apiBase)) {
      try {
        const res = await fetch(joinUrl(candidate, path), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify(body || {}),
        });
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText}`);
        if (candidate !== normalizeApiBase(apiBase)) data.__apiBase = candidate;
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(apiConnectHint(apiBase) + ` 浏览器错误：${lastError ? lastError.message : "Failed to fetch"}`);
  }

  async function callHealth(apiBase) {
    let lastError = null;
    for (const candidate of apiCandidates(apiBase)) {
      try {
        const res = await fetch(joinUrl(candidate, "/api/health"));
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText}`);
        if (candidate !== normalizeApiBase(apiBase)) data.__apiBase = candidate;
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(apiConnectHint(apiBase) + ` 浏览器错误：${lastError ? lastError.message : "Failed to fetch"}`);
  }

  function setApiBase(value) {
    state.apiBase = normalizeApiBase(value) || FALLBACK_API;
    localStorage.setItem("secondMeApiBase", state.apiBase);
  }

  function addAssistant(content, extra) {
    state.messages.push({ role: "assistant", content, ...(extra || {}) });
    render();
  }

  function compactTrace(trace) {
    return Array.from(new Set((trace || []).map(t => t.tool).filter(Boolean))).slice(0, 4);
  }

  function scrollThread() {
    requestAnimationFrame(() => {
      const thread = document.querySelector(".thread");
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  }

  async function send(textOverride) {
    const textarea = document.querySelector(".composer textarea");
    const text = String(textOverride || (textarea ? textarea.value : "")).trim();
    if (!text || state.busy) return;
    const next = [...state.messages, { role: "user", content: text }];
    state.messages = next;
    state.busy = true;
    render();
    try {
      const data = await callApi(state.apiBase, state.token, "/api/chat", { messages: next, model: "glm-4.6v", thinking: state.thinking });
      if (data.__apiBase) setApiBase(data.__apiBase);
      state.messages = [
        ...next,
        {
          role: "assistant",
          content: data.answer || "(empty)",
          citations: data.citations || [],
          images: data.images || [],
          tool_trace: data.tool_trace || [],
        },
      ];
    } catch (err) {
      state.messages = [...next, { role: "assistant", content: "接口报错：" + err.message }];
    } finally {
      state.busy = false;
      render();
    }
  }

  async function health() {
    try {
      const data = await callHealth(state.apiBase);
      if (data.__apiBase) setApiBase(data.__apiBase);
      addAssistant(`连接正常：${data.service} / ${data.model}，API=${data.__apiBase || state.apiBase}`);
    } catch (err) {
      addAssistant(err.message);
    }
  }

  async function openRef(ref) {
    if (!ref) return;
    const body = ref.startsWith("event:") || ref.startsWith("hypothesis:") || ref.startsWith("background:") || ref.startsWith("day:") || ref.startsWith("profile:")
      ? { doc_id: ref }
      : /^\d{4}-\d{2}-\d{2}\./.test(ref)
        ? { source_ref: ref }
        : { evidence_ref: ref };
    try {
      const data = await callApi(state.apiBase, state.token, "/api/memory/detail", body);
      if (data.__apiBase) setApiBase(data.__apiBase);
      state.detail = data;
    } catch (err) {
      state.detail = { error: err.message };
    }
    render();
  }

  function renderMessage(msg) {
    const row = el("div", { className: "chat-row " + msg.role });
    if (msg.role === "assistant") row.appendChild(el("div", { className: "avatar", text: "我" }));
    const wrap = el("div", { className: "bubble-wrap" });
    wrap.appendChild(el("div", { className: "bubble", text: msg.content }));
    if (msg.images && msg.images.length) wrap.appendChild(renderImageGallery(msg.images));
    const refs = (msg.citations || []).slice(0, 6);
    const tools = compactTrace(msg.tool_trace);
    if (refs.length || tools.length) {
      const meta = el("div", { className: "bubble-meta" });
      tools.forEach(name => meta.appendChild(el("span", { className: "tool-pill", text: name })));
      refs.forEach(ref => meta.appendChild(el("button", { className: "ref-pill", text: ref, onclick: () => openRef(ref) })));
      wrap.appendChild(meta);
    }
    row.appendChild(wrap);
    return row;
  }

  function renderImageGallery(images) {
    const box = el("div", { className: "image-gallery" });
    images.slice(0, 8).forEach(img => {
      const ref = (img.detail_request || {}).evidence_ref || img.ref;
      const btn = el("button", { className: "memory-photo", title: img.source_title || img.caption || img.ref, onclick: () => openRef(ref) });
      btn.appendChild(el("img", { src: fileUrl(state.apiBase, img.preview_url), alt: img.caption || img.ref || "memory photo" }));
      btn.appendChild(el("span", { text: img.date || img.timestamp || "" }));
      box.appendChild(btn);
    });
    return box;
  }

  function renderMemoryStrip() {
    const strip = el("div", { className: "memory-strip" });
    CORE_PHOTOS.forEach(([title, date, path]) => {
      const btn = el("button", { className: "strip-photo", onclick: () => send(`${date} 我在做什么？顺手给我几张图。`) });
      btn.appendChild(el("img", { src: memoryFileUrl(state.apiBase, path), alt: title }));
      btn.appendChild(el("span", { text: title }));
      btn.appendChild(el("small", { text: date }));
      strip.appendChild(btn);
    });
    return strip;
  }

  function renderSettings() {
    const card = el("div", { className: "settings-card" });
    card.appendChild(el("label", { text: "API" }));
    card.appendChild(el("input", {
      className: "control",
      value: state.apiBase,
      oninput: ev => setApiBase(ev.target.value),
    }));
    card.appendChild(el("label", { text: "Token" }));
    card.appendChild(el("input", {
      className: "control",
      type: "password",
      value: state.token,
      oninput: ev => {
        state.token = ev.target.value;
        localStorage.setItem("secondMeApiToken", state.token);
      },
    }));
    const toggle = el("label", { className: "toggle-row" });
    toggle.appendChild(el("input", {
      type: "checkbox",
      checked: state.thinking,
      onchange: ev => {
        state.thinking = ev.target.checked;
        localStorage.setItem("secondMeThinking", String(state.thinking));
        render();
      },
    }));
    toggle.appendChild(el("span", { text: "Thinking mode" }));
    card.appendChild(toggle);
    const actions = el("div", { className: "settings-actions" });
    actions.appendChild(el("button", { className: "ghost-button", text: "检查连接", onclick: health }));
    actions.appendChild(el("button", {
      className: "ghost-button",
      text: "恢复默认",
      onclick: () => {
        setApiBase(FALLBACK_API);
        addAssistant(`API 已恢复成 ${FALLBACK_API}。`);
      },
    }));
    card.appendChild(actions);
    return card;
  }

  function renderDetailModal() {
    if (!state.detail) return null;
    const backdrop = el("div", { className: "modal-backdrop", onclick: () => { state.detail = null; render(); } });
    const modal = el("div", { className: "modal", onclick: ev => ev.stopPropagation() });
    modal.appendChild(el("button", { className: "modal-close", text: "关闭", onclick: () => { state.detail = null; render(); } }));
    if (state.detail.error) {
      modal.appendChild(el("p", { className: "error-text", text: state.detail.error }));
    } else {
      const photo = state.detail.photo || {};
      if (state.detail.kind === "photo" && photo.preview_url) {
        modal.appendChild(el("img", { className: "modal-image", src: fileUrl(state.apiBase, photo.preview_url), alt: photo.filename || state.detail.ref }));
      }
      modal.appendChild(el("pre", { text: JSON.stringify(state.detail, null, 2) }));
    }
    backdrop.appendChild(modal);
    return backdrop;
  }

  function render() {
    root.innerHTML = "";
    const shell = el("div", { className: "app-shell" });
    const header = el("header", { className: "chat-header" });
    const identity = el("div", { className: "identity" });
    identity.appendChild(el("div", { className: "identity-mark", text: "我" }));
    identity.appendChild(el("div", {}, [
      el("strong", { text: "赵鸿飞 / Bloodz" }),
      el("span", { text: state.busy ? "正在翻记忆" : "LifeLog online" }),
    ]));
    header.appendChild(identity);
    const actions = el("div", { className: "header-actions" });
    const mini = el("label", { className: "mini-toggle" });
    mini.appendChild(el("input", {
      type: "checkbox",
      checked: state.thinking,
      onchange: ev => {
        state.thinking = ev.target.checked;
        localStorage.setItem("secondMeThinking", String(state.thinking));
        render();
      },
    }));
    mini.appendChild(el("span", { text: "thinking" }));
    actions.appendChild(mini);
    actions.appendChild(el("button", { className: "icon-button", text: "设置", onclick: () => { state.settingsOpen = !state.settingsOpen; render(); } }));
    header.appendChild(actions);
    if (state.settingsOpen) header.appendChild(renderSettings());
    shell.appendChild(header);

    const main = el("main", { className: "chat-main" });
    main.appendChild(renderMemoryStrip());
    const thread = el("section", { className: "thread" });
    state.messages.forEach(msg => thread.appendChild(renderMessage(msg)));
    if (state.busy) {
      thread.appendChild(el("div", { className: "chat-row assistant" }, [
        el("div", { className: "avatar", text: "我" }),
        el("div", { className: "typing" }, [el("span"), el("span"), el("span")]),
      ]));
    }
    main.appendChild(thread);
    const form = el("form", { className: "composer", onsubmit: ev => { ev.preventDefault(); send(); } });
    form.appendChild(el("textarea", {
      placeholder: "问我：2026-05-02 我去了哪？顺手给我几张图。",
      onkeydown: ev => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") send();
      },
    }));
    form.appendChild(el("button", { disabled: state.busy, text: state.busy ? "等下" : "发送" }));
    main.appendChild(form);
    shell.appendChild(main);
    const modal = renderDetailModal();
    if (modal) shell.appendChild(modal);
    root.appendChild(shell);
    scrollThread();
  }

  render();
})();
