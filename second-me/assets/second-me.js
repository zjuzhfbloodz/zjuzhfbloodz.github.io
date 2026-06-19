(function () {
  const e = React.createElement;
  const { useMemo, useState } = React;

  const DEFAULT_API = window.SECOND_ME_API_BASE || localStorage.getItem("secondMeApiBase") || "http://127.0.0.1:8765";
  const DEFAULT_TOKEN = localStorage.getItem("secondMeApiToken") || "";

  function joinUrl(base, path) {
    return String(base || "").replace(/\/+$/, "") + path;
  }

  async function callApi(apiBase, token, path, body) {
    const res = await fetch(joinUrl(apiBase, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  function fileUrl(apiBase, url) {
    if (!url) return "";
    if (/^https?:\/\//.test(url)) return url;
    return joinUrl(apiBase, url);
  }

  function fmtMeta(item) {
    return [item.date, item.doc_type, item.involvement, item.event_type, item.confidence].filter(Boolean).join(" / ");
  }

  function ProfilePanel({ apiBase, setApiBase, token, setToken, onHealth }) {
    return e("aside", { className: "sm-panel sm-profile" },
      e("h2", null, "Second Me"),
      e("div", { className: "sm-profile-section", style: { borderTop: 0, paddingTop: 0, marginTop: 0 } },
        e("label", { className: "sm-label" }, "API"),
        e("input", {
          className: "sm-control",
          value: apiBase,
          onChange: ev => {
            setApiBase(ev.target.value);
            localStorage.setItem("secondMeApiBase", ev.target.value);
          },
        }),
        e("label", { className: "sm-label", style: { marginTop: 10 } }, "Token（可选）"),
        e("input", {
          className: "sm-control",
          type: "password",
          value: token,
          onChange: ev => {
            setToken(ev.target.value);
            localStorage.setItem("secondMeApiToken", ev.target.value);
          },
        }),
        e("button", { className: "sm-chip", style: { marginTop: 10 }, onClick: onHealth }, "检查连接")
      ),
      e("div", { className: "sm-profile-section" },
        e("span", { className: "sm-label" }, "常驻画像"),
        e("p", null, "身份边界、时期画像、关系模式、偏好和表达风格会 always in context；具体问题再通过 memory_search 和 fetch_memory_detail 查证。")
      ),
      e("div", { className: "sm-profile-section" },
        e("span", { className: "sm-label" }, "工具"),
        e("ul", null,
          e("li", null, "memory_search：BM25 + 本地向量混合检索"),
          e("li", null, "fetch_memory_detail：打开事件、日总结、微信片段、照片和 episode"),
          e("li", null, "回答会保留 citations，点击可打开证据")
        )
      ),
      e("div", { className: "sm-profile-section" },
        e("span", { className: "sm-label" }, "说话目标"),
        e("p", null, "像我，但不硬装我。能用第一人称，必须讲不确定性，问事实必须查证。")
      )
    );
  }

  function Message({ msg, onOpen }) {
    const citations = msg.citations || [];
    const trace = msg.tool_trace || [];
    return e("div", { className: "sm-message " + msg.role },
      e("div", { className: "sm-bubble" },
        msg.content,
        citations.length ? e("div", { className: "sm-meta" },
          citations.slice(0, 12).map(ref => e("button", {
            key: ref,
            className: "sm-chip",
            onClick: () => onOpen(ref),
            title: "打开证据",
          }, ref))
        ) : null,
        trace.length ? e("div", { className: "sm-meta" },
          trace.map((t, idx) => e("span", { key: idx, className: "sm-chip" }, t.tool || "tool"))
        ) : null
      )
    );
  }

  function DetailPanel({ detail, apiBase }) {
    const content = useMemo(() => {
      if (!detail) return e("p", null, "点击 citation、搜索结果或证据 ref，这里会打开原始记忆详情。");
      if (detail.error) return e("p", { className: "sm-error" }, detail.error);
      if (detail.kind === "doc") {
        return e(React.Fragment, null,
          e("h2", null, detail.doc.title || detail.doc.doc_id),
          e("p", null, fmtMeta(detail.doc)),
          e("p", null, detail.doc.summary),
          e("div", { className: "sm-meta" },
            (detail.doc.evidence_refs || []).slice(0, 12).map(ref => e("span", { className: "sm-chip", key: ref }, ref))
          ),
          renderEvidence(detail.evidence || [], apiBase),
          e("pre", { className: "sm-code" }, JSON.stringify(detail.source_object || detail.doc, null, 2))
        );
      }
      return e(React.Fragment, null,
        e("h2", null, detail.kind || "memory detail"),
        renderEvidence([detail], apiBase),
        e("pre", { className: "sm-code" }, JSON.stringify(detail, null, 2))
      );
    }, [detail, apiBase]);

    return e("aside", { className: "sm-panel sm-detail" }, content);
  }

  function renderEvidence(items, apiBase) {
    return e("div", null, items.map((item, idx) => {
      if (!item || item.found === false) {
        return e("p", { key: idx, className: "sm-error" }, "未找到：" + (item && item.ref ? item.ref : "unknown"));
      }
      if (item.kind === "photo") {
        const photo = item.photo || {};
        return e("div", { key: idx },
          e("p", null, [photo.timestamp || item.date, photo.filename, item.ref].filter(Boolean).join(" · ")),
          photo.preview_url ? e("img", { className: "sm-evidence-img", src: fileUrl(apiBase, photo.preview_url), alt: photo.filename || item.ref }) : null
        );
      }
      if (item.kind === "photo_episode") {
        const ep = item.episode || {};
        const imgs = ep.representative_images || [];
        return e("div", { key: idx },
          e("p", null, `${ep.start_time || ""}-${ep.end_time || ""} · ${ep.asset_count || 0} assets · ${item.ref}`),
          e("p", null, ((ep.geo || {}).reverse_display_name || "")),
          imgs.map(img => e("img", { key: img.id, className: "sm-evidence-img", src: fileUrl(apiBase, img.preview_url), alt: img.filename || img.id }))
        );
      }
      if (item.kind === "wechat_message") {
        return e("div", { key: idx },
          e("p", null, `${item.date || ""} · ${item.ref}`),
          (item.context || []).map((line, i) => e("p", { key: i }, `${line.time || ""} ${line.session || ""} ${line.sender || ""}: ${line.text || ""}`))
        );
      }
      return e("pre", { key: idx, className: "sm-code" }, JSON.stringify(item, null, 2));
    }));
  }

  function App() {
    const [apiBase, setApiBase] = useState(DEFAULT_API);
    const [token, setToken] = useState(DEFAULT_TOKEN);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [messages, setMessages] = useState([
      {
        role: "assistant",
        content: "可以问我任何和“我”有关的事：某天发生了什么、某个人是谁、我为什么会喜欢某类东西、某段时期是什么状态。我会先查记忆，再回答。",
      },
    ]);

    async function openRef(ref) {
      const body = ref.startsWith("event:") || ref.startsWith("hypothesis:") || ref.startsWith("background:") || ref.startsWith("day:") || ref.startsWith("profile:")
        ? { doc_id: ref }
        : ref.match(/^\d{4}-\d{2}-\d{2}\./)
          ? { source_ref: ref }
          : { evidence_ref: ref };
      const data = await callApi(apiBase, token, "/api/memory/detail", body);
      setDetail(data);
    }

    async function send() {
      const text = input.trim();
      if (!text || busy) return;
      const next = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setBusy(true);
      try {
        const data = await callApi(apiBase, token, "/api/chat", { messages: next, model: "glm-4.6v" });
        setMessages([...next, {
          role: "assistant",
          content: data.answer || "(empty)",
          citations: data.citations || [],
          tool_trace: data.tool_trace || [],
        }]);
      } catch (err) {
        setMessages([...next, { role: "assistant", content: "接口报错：" + err.message }]);
      } finally {
        setBusy(false);
      }
    }

    async function searchMemory() {
      if (!searchQuery.trim()) return;
      const data = await callApi(apiBase, token, "/api/memory/search", { query: searchQuery.trim(), limit: 6 });
      setSearchResults(data.results || []);
    }

    async function health() {
      try {
        const res = await fetch(joinUrl(apiBase, "/api/health"));
        const data = await res.json();
        setDetail({ kind: "health", status: data });
      } catch (err) {
        setDetail({ error: "连接失败：" + err.message });
      }
    }

    return e("div", { className: "sm-shell" },
      e("header", { className: "sm-topbar" },
        e("div", { className: "sm-brand" },
          e("div", { className: "sm-title" }, "Second Me"),
          e("a", { href: "/" }, "Bloodz's Space")
        ),
        e("div", { className: "sm-status" },
          e("span", { className: "sm-dot" }),
          e("span", null, busy ? "thinking with memory..." : "LifeLog memory online"),
          e("span", null, "GLM-4.6V")
        )
      ),
      e("main", { className: "sm-layout" },
        e(ProfilePanel, { apiBase, setApiBase, token, setToken, onHealth: health }),
        e("section", { className: "sm-panel sm-chat" },
          e("div", { className: "sm-messages" },
            messages.map((msg, idx) => e(Message, { key: idx, msg, onOpen: openRef }))
          ),
          e("div", { className: "sm-composer" },
            e("div", { className: "sm-composer-row" },
              e("textarea", {
                className: "sm-control sm-input",
                value: input,
                placeholder: "问我：2026-05-02我去了哪？我和石雨菲是什么关系？我说话有什么风格？",
                onChange: ev => setInput(ev.target.value),
                onKeyDown: ev => {
                  if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") send();
                },
              }),
              e("button", { className: "sm-button", disabled: busy, onClick: send }, busy ? "思考中" : "发送")
            ),
            e("div", { className: "sm-toolbar" },
              e("input", {
                className: "sm-control",
                value: searchQuery,
                placeholder: "直接搜索记忆",
                onChange: ev => setSearchQuery(ev.target.value),
                onKeyDown: ev => { if (ev.key === "Enter") searchMemory(); },
              }),
              e("button", { className: "sm-chip", onClick: searchMemory }, "memory_search")
            ),
            searchResults.length ? e("div", { className: "sm-search-results" },
              searchResults.map(item => e("button", {
                key: item.doc_id,
                className: "sm-result",
                onClick: () => openRef(item.doc_id),
              },
                e("strong", null, item.title || item.doc_id),
                e("span", null, fmtMeta(item)),
                e("p", null, item.summary)
              ))
            ) : null
          )
        ),
        e(DetailPanel, { detail, apiBase })
      )
    );
  }

  ReactDOM.createRoot(document.getElementById("second-me-root")).render(e(App));
})();
