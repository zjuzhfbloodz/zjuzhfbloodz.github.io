(function () {
  const e = React.createElement;
  const { useMemo, useState } = React;

  const FALLBACK_API = "http://127.0.0.1:8765";
  const LOCAL_API_CANDIDATES = ["http://127.0.0.1:8765", "http://localhost:8765"];
  const storedApiBase = localStorage.getItem("secondMeApiBase") || "";
  const DEFAULT_API = window.SECOND_ME_API_BASE || normalizeApiBase(storedApiBase) || FALLBACK_API;
  const DEFAULT_TOKEN = localStorage.getItem("secondMeApiToken") || "";
  const DEFAULT_THINKING = localStorage.getItem("secondMeThinking") === "true";
  if (storedApiBase && normalizeApiBase(storedApiBase) !== storedApiBase) {
    localStorage.setItem("secondMeApiBase", normalizeApiBase(storedApiBase));
  }

  const CORE_PHOTOS = [
    {
      title: "Bangkok",
      date: "2026-05-02",
      path: "data/normalized/photos/resized_1600/2026/05/0FE1D37A-9C57-4F73-AF07-02FFBFA8DB13.jpg",
    },
    {
      title: "Museum",
      date: "2026-05-02",
      path: "data/normalized/photos/resized_1600/2026/05/FEE51636-DA4F-45CC-A908-27B5277CE281.jpg",
    },
    {
      title: "City",
      date: "2026-05-04",
      path: "data/normalized/photos/resized_1600/2026/05/0C08970C-4518-4BC8-B50B-0689C2438A5D.jpg",
    },
    {
      title: "NUS",
      date: "2021-09-09",
      path: "data/normalized/photos/resized_1600/2021/09/03A5EA77-8DF0-4FA2-9DA6-D4F7EEFA5F3A.jpg",
    },
    {
      title: "Notes",
      date: "2022-01-01",
      path: "data/normalized/photos/resized_1600/2022/01/9C4CF63F-D619-44D2-86CC-CC784EE53200.jpg",
    },
  ];

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
    return `连接不到 API：${apiBase}。如果是在这台 Mac 打开，点“设置 -> 恢复默认”或填 ${FALLBACK_API}；如果是在手机/另一台电脑打开，localhost/127.0.0.1 指的是那台设备，需要改成本机局域网 API 地址或用本地博客页面。`;
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
    let res;
    let lastError = null;
    for (const candidate of apiCandidates(apiBase)) {
      try {
        res = await fetch(joinUrl(candidate, "/api/health"));
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

  function compactTrace(trace) {
    const names = (trace || []).map(t => t.tool).filter(Boolean);
    return Array.from(new Set(names)).slice(0, 4);
  }

  function Message({ msg, apiBase, onOpen }) {
    const refs = (msg.citations || []).slice(0, 6);
    const tools = compactTrace(msg.tool_trace);
    return e("div", { className: "chat-row " + msg.role },
      msg.role === "assistant" ? e("div", { className: "avatar" }, "我") : null,
      e("div", { className: "bubble-wrap" },
        e("div", { className: "bubble" }, msg.content),
        msg.images && msg.images.length ? e(ImageGallery, { images: msg.images, apiBase, onOpen }) : null,
        refs.length || tools.length ? e("div", { className: "bubble-meta" },
          tools.map(name => e("span", { key: "tool-" + name, className: "tool-pill" }, name)),
          refs.map(ref => e("button", { key: ref, className: "ref-pill", onClick: () => onOpen(ref) }, ref))
        ) : null
      )
    );
  }

  function ImageGallery({ images, apiBase, onOpen }) {
    return e("div", { className: "image-gallery" },
      images.slice(0, 8).map((img, idx) => e("button", {
        key: (img.ref || img.preview_url || idx) + idx,
        className: "memory-photo",
        onClick: () => onOpen((img.detail_request || {}).evidence_ref || img.ref),
        title: img.source_title || img.caption || img.ref,
      },
        e("img", { src: fileUrl(apiBase, img.preview_url), alt: img.caption || img.ref || "memory photo" }),
        e("span", null, img.date || img.timestamp || "")
      ))
    );
  }

  function MemoryStrip({ apiBase, onAsk }) {
    return e("div", { className: "memory-strip" },
      CORE_PHOTOS.map(photo => e("button", {
        key: photo.path,
        className: "strip-photo",
        onClick: () => onAsk(`${photo.date} 我在做什么？顺手给我几张图。`),
      },
        e("img", { src: memoryFileUrl(apiBase, photo.path), alt: photo.title }),
        e("span", null, photo.title),
        e("small", null, photo.date)
      ))
    );
  }

  function Settings({ apiBase, setApiBase, token, setToken, thinking, setThinking, onHealth, onReset }) {
    return e("div", { className: "settings-card" },
      e("label", null, "API"),
      e("input", {
        className: "control",
        value: apiBase,
        onChange: ev => {
          setApiBase(ev.target.value);
          localStorage.setItem("secondMeApiBase", ev.target.value);
        },
      }),
      e("label", null, "Token"),
      e("input", {
        className: "control",
        type: "password",
        value: token,
        onChange: ev => {
          setToken(ev.target.value);
          localStorage.setItem("secondMeApiToken", ev.target.value);
        },
      }),
      e("label", { className: "toggle-row" },
        e("input", {
          type: "checkbox",
          checked: thinking,
          onChange: ev => {
            setThinking(ev.target.checked);
            localStorage.setItem("secondMeThinking", String(ev.target.checked));
          },
        }),
        e("span", null, "Thinking mode")
      ),
      e("div", { className: "settings-actions" },
        e("button", { className: "ghost-button", onClick: onHealth }, "检查连接"),
        e("button", { className: "ghost-button", onClick: onReset }, "恢复默认")
      )
    );
  }

  function DetailModal({ detail, onClose, apiBase }) {
    const content = useMemo(() => {
      if (!detail) return null;
      if (detail.error) return e("p", { className: "error-text" }, detail.error);
      if (detail.kind === "photo") {
        const photo = detail.photo || {};
        return e(React.Fragment, null,
          photo.preview_url ? e("img", { className: "modal-image", src: fileUrl(apiBase, photo.preview_url), alt: photo.filename || detail.ref }) : null,
          e("pre", null, JSON.stringify(detail, null, 2))
        );
      }
      return e("pre", null, JSON.stringify(detail, null, 2));
    }, [detail, apiBase]);
    if (!detail) return null;
    return e("div", { className: "modal-backdrop", onClick: onClose },
      e("div", { className: "modal", onClick: ev => ev.stopPropagation() },
        e("button", { className: "modal-close", onClick: onClose }, "关闭"),
        content
      )
    );
  }

  function App() {
    const [apiBase, setApiBase] = useState(DEFAULT_API);
    const [token, setToken] = useState(DEFAULT_TOKEN);
    const [thinking, setThinking] = useState(DEFAULT_THINKING);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState(null);
    const [messages, setMessages] = useState([
      {
        role: "assistant",
        content: "问吧。某天去了哪、某个人是谁、我为什么那么选，或者直接让我翻几张当时的图。",
      },
    ]);

    async function openRef(ref) {
      if (!ref) return;
      const body = ref.startsWith("event:") || ref.startsWith("hypothesis:") || ref.startsWith("background:") || ref.startsWith("day:") || ref.startsWith("profile:")
        ? { doc_id: ref }
        : ref.match(/^\d{4}-\d{2}-\d{2}\./)
          ? { source_ref: ref }
          : { evidence_ref: ref };
      try {
        const data = await callApi(apiBase, token, "/api/memory/detail", body);
        if (data.__apiBase) {
          setApiBase(data.__apiBase);
          localStorage.setItem("secondMeApiBase", data.__apiBase);
        }
        setDetail(data);
      } catch (err) {
        setDetail({ error: err.message });
      }
    }

    async function send(textOverride) {
      const text = (textOverride || input).trim();
      if (!text || busy) return;
      const next = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setBusy(true);
      try {
        const data = await callApi(apiBase, token, "/api/chat", { messages: next, model: "glm-4.6v", thinking });
        if (data.__apiBase) {
          setApiBase(data.__apiBase);
          localStorage.setItem("secondMeApiBase", data.__apiBase);
        }
        setMessages([...next, {
          role: "assistant",
          content: data.answer || "(empty)",
          citations: data.citations || [],
          images: data.images || [],
          tool_trace: data.tool_trace || [],
        }]);
      } catch (err) {
        setMessages([...next, { role: "assistant", content: "接口报错：" + err.message }]);
      } finally {
        setBusy(false);
      }
    }

    async function health() {
      try {
        const data = await callHealth(apiBase);
        if (data.__apiBase) {
          setApiBase(data.__apiBase);
          localStorage.setItem("secondMeApiBase", data.__apiBase);
        }
        setMessages(m => [...m, { role: "assistant", content: `连接正常：${data.service} / ${data.model}，API=${data.__apiBase || apiBase}` }]);
      } catch (err) {
        setMessages(m => [...m, { role: "assistant", content: err.message }]);
      }
    }

    function resetApi() {
      setApiBase(FALLBACK_API);
      localStorage.setItem("secondMeApiBase", FALLBACK_API);
      setMessages(m => [...m, { role: "assistant", content: `API 已恢复成 ${FALLBACK_API}。` }]);
    }

    return e("div", { className: "app-shell" },
      e("header", { className: "chat-header" },
        e("div", { className: "identity" },
          e("div", { className: "identity-mark" }, "我"),
          e("div", null,
            e("strong", null, "赵鸿飞 / Bloodz"),
            e("span", null, busy ? "正在翻记忆" : "LifeLog online")
          )
        ),
        e("div", { className: "header-actions" },
          e("label", { className: "mini-toggle" },
            e("input", {
              type: "checkbox",
              checked: thinking,
              onChange: ev => {
                setThinking(ev.target.checked);
                localStorage.setItem("secondMeThinking", String(ev.target.checked));
              },
            }),
            e("span", null, "thinking")
          ),
          e("button", { className: "icon-button", onClick: () => setSettingsOpen(!settingsOpen) }, "设置")
        ),
        settingsOpen ? e(Settings, { apiBase, setApiBase, token, setToken, thinking, setThinking, onHealth: health, onReset: resetApi }) : null
      ),
      e("main", { className: "chat-main" },
        e(MemoryStrip, { apiBase, onAsk: send }),
        e("section", { className: "thread" },
          messages.map((msg, idx) => e(Message, { key: idx, msg, apiBase, onOpen: openRef })),
          busy ? e("div", { className: "chat-row assistant" },
            e("div", { className: "avatar" }, "我"),
            e("div", { className: "typing" }, e("span"), e("span"), e("span"))
          ) : null
        ),
        e("form", {
          className: "composer",
          onSubmit: ev => {
            ev.preventDefault();
            send();
          },
        },
          e("textarea", {
            value: input,
            placeholder: "问我：2026-05-02 我去了哪？顺手给我几张图。",
            onChange: ev => setInput(ev.target.value),
            onKeyDown: ev => {
              if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") send();
            },
          }),
          e("button", { disabled: busy || !input.trim() }, busy ? "等下" : "发送")
        )
      ),
      e(DetailModal, { detail, onClose: () => setDetail(null), apiBase })
    );
  }

  ReactDOM.createRoot(document.getElementById("second-me-root")).render(e(App));
})();
