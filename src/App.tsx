import {
  BookOpen,
  ChevronDown,
  CirclePlus,
  ExternalLink,
  Heart,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Newspaper,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  directCategoryLinks,
  groupedCategoryLinks,
  playTypeLinks,
  specialNavLinks,
  themeLinks,
  topNavLinks,
  type NavLink,
} from "./data/navConfig";
import originalSources from "./data/originalSources.json";

type ViewMode = "double" | "single" | "compact";
type PageMode = "items" | "admin";

type SourceAccount = {
  id: string;
  name: string;
  wechatId: string;
  description: string;
  tags: string[];
  status: "启用" | "停用";
  createdAt: string;
  originalCount?: number;
};

type IntelItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  kind: string;
  tag: string;
  tags: string[];
  date: string;
  signals: string[];
  originalUrl: string;
  detailUrl?: string;
  summaryHtml?: string;
};

type IntelDetail = Omit<IntelItem, "signals" | "tag"> & {
  contentHtml: string;
};

type SourceDraft = {
  name: string;
  wechatId: string;
  tags: string;
  description: string;
  status: SourceAccount["status"];
};

const emptyDraft: SourceDraft = {
  name: "",
  wechatId: "",
  tags: "AI与游戏",
  description: "",
  status: "启用",
};

const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";
const offlineSourcesKey = "intel-hub-offline-sources-v2";
const fallbackSources = originalSources as SourceAccount[];
const fallbackItems: IntelItem[] = [];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "请求失败");
  }
  return response.json() as Promise<T>;
}

function normalizeTags(value: string) {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function loadOfflineSources() {
  const stored = window.localStorage.getItem(offlineSourcesKey);
  if (!stored) {
    return fallbackSources;
  }
  try {
    const parsed = JSON.parse(stored) as SourceAccount[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallbackSources;
  } catch {
    return fallbackSources;
  }
}

function filterItems(items: IntelItem[], tag: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTag = ["收藏", "建议", "日志", "微信群"].includes(tag) ? "全部" : tag;
  return items.filter((item) => {
    const matchesTag = normalizedTag === "全部" || item.tag === normalizedTag || item.tags.includes(normalizedTag);
    const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${item.tags.join(" ")}`.toLowerCase();
    return matchesTag && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

function LoginScreen({ onLogin }: { onLogin: (offline?: boolean) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ ok: boolean }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (result.ok) {
        onLogin();
      } else {
        setError("原站登录失败");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败，请检查原站账号密码");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="登录">
        <h1>📚 游戏研究所pro</h1>
        <p>使用本站账号登录后读取真实文章</p>
        <form className="login-form" onSubmit={submit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="账号" autoFocus />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密码" />
          <button type="submit">
            <LogIn size={16} />
            登录
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
        <p className="login-note">默认账号：111 / 111</p>
      </section>
    </main>
  );
}

function Sidebar({
  activeTag,
  activeAuthor,
  activeSpecial,
  pageMode,
  query,
  sources,
  summarySize,
  onSelectTag,
  onSelectAuthor,
  onSelectSpecial,
  onPageModeChange,
  onQueryChange,
  onSummarySizeChange,
  onLogout,
}: {
  activeTag: string;
  activeAuthor: string;
  activeSpecial: string;
  pageMode: PageMode;
  query: string;
  sources: SourceAccount[];
  summarySize: number;
  onSelectTag: (tag: string, label?: string) => void;
  onSelectAuthor: (author: string) => void;
  onSelectSpecial: (value: string, label: string, message: string) => void;
  onPageModeChange: (mode: PageMode) => void;
  onQueryChange: (query: string) => void;
  onSummarySizeChange: (size: number) => void;
  onLogout: () => void;
}) {
  const authorSources = sources.length > 0 ? sources : fallbackSources;

  function tagActive(value: string) {
    return pageMode === "items" && !activeAuthor && !activeSpecial && activeTag === value;
  }

  function renderTagButton(link: NavLink, className = "") {
    return (
      <button
        className={`${className} ${tagActive(link.value) ? "active" : ""}`.trim()}
        key={link.value}
        type="button"
        onClick={() => onSelectTag(link.value, link.label)}
      >
        <span>{link.label}</span>
        <strong>{link.count}</strong>
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <button type="button" className="brand-link" onClick={() => onSelectTag("全部", "全部内容")}>
          📚 游戏行业情报库
        </button>
        <div className="account-links">
          <button type="button">改密码</button>
          <span>·</span>
          <button type="button" onClick={onLogout}>退出</button>
        </div>
      </div>

      <label className="search-control">
        <Search size={15} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题/摘要" />
      </label>

      <nav className="side-nav" aria-label="情报导航">
        {topNavLinks.slice(0, 1).map((link) => renderTagButton(link))}
        {specialNavLinks.map((link) => (
          <button
            className={pageMode === "items" && activeSpecial === link.value ? "active" : ""}
            key={link.value}
            type="button"
            onClick={() => onSelectSpecial(link.value, link.label.replace(/^[^ ]+ /, ""), link.message)}
          >
            <span>{link.label}</span>
            <strong />
          </button>
        ))}
        {topNavLinks.slice(1).map((link) => renderTagButton(link))}

        <div className="nav-section">分类</div>
        {directCategoryLinks.slice(0, 1).map((link) => renderTagButton(link))}
        {groupedCategoryLinks.map((group) => (
          <details className="nav-group" key={group.title} open={group.links.some((link) => tagActive(link.value)) || undefined}>
            <summary>
              <span>▸ {group.title}</span>
              <strong>{group.count}</strong>
            </summary>
            <div>
              {group.links.map((link) => renderTagButton(link, "nav-subrow"))}
            </div>
          </details>
        ))}
        {directCategoryLinks.slice(1).map((link) => renderTagButton(link))}

        <details className="nav-group" open={playTypeLinks.concat(themeLinks).some((link) => tagActive(link.value)) || undefined}>
          <summary>
            <span>▸ 🎮 玩法 / 主题</span>
            <strong>{playTypeLinks.length + themeLinks.length}</strong>
          </summary>
          <div className="chip-section">
            <p>玩法品类</p>
            <div className="chip-grid">{playTypeLinks.map((link) => renderTagButton(link, "tag-chip"))}</div>
            <p>主题</p>
            <div className="chip-grid">{themeLinks.map((link) => renderTagButton(link, "tag-chip"))}</div>
          </div>
        </details>

        <details className="nav-group" open={Boolean(activeAuthor) || undefined}>
          <summary>
            <span>▸ 📰 按公众号</span>
            <strong>{authorSources.length}</strong>
          </summary>
          <div>
            {authorSources.map((source) => (
              <button
                className={`nav-subrow ${activeAuthor === source.name ? "active" : ""}`.trim()}
                key={source.id}
                type="button"
                onClick={() => onSelectAuthor(source.name)}
              >
                <span>{source.name}</span>
                <strong>{source.originalCount || ""}</strong>
              </button>
            ))}
          </div>
        </details>

        <button className={pageMode === "admin" ? "active" : ""} type="button" onClick={() => onPageModeChange("admin")}>
          <span>⚙ 后台管理</span>
          <strong>源</strong>
        </button>
      </nav>

      <div className="font-control">
        <div>
          <SlidersHorizontal size={15} />
          <span>摘要字号</span>
          <strong>{summarySize}px</strong>
        </div>
        <input
          aria-label="摘要字号"
          type="range"
          min="13"
          max="18"
          value={summarySize}
          onChange={(event) => onSummarySizeChange(Number(event.target.value))}
        />
      </div>
    </aside>
  );
}

function ViewControls({
  mode,
  summaryOpen,
  onModeChange,
  onSummaryToggle,
}: {
  mode: ViewMode;
  summaryOpen: boolean;
  onModeChange: (mode: ViewMode) => void;
  onSummaryToggle: () => void;
}) {
  return (
    <div className="view-controls" aria-label="视图控制">
      <span>视图</span>
      <button className={mode === "double" ? "active" : ""} type="button" onClick={() => onModeChange("double")}>双列</button>
      <button className={mode === "single" ? "active" : ""} type="button" onClick={() => onModeChange("single")}>单列</button>
      <button className={mode === "compact" ? "active" : ""} type="button" onClick={() => onModeChange("compact")}>紧凑</button>
      <button type="button" onClick={onSummaryToggle}>
        <ChevronDown size={14} />
        {summaryOpen ? "收起摘要" : "展开摘要"}
      </button>
    </div>
  );
}

function ItemCard({
  item,
  compact,
  summaryOpen,
  summarySize,
  onOpen,
}: {
  item: IntelItem;
  compact: boolean;
  summaryOpen: boolean;
  summarySize: number;
  onOpen: (id: string) => void;
}) {
  return (
    <article
      className={compact ? "item-card compact" : "item-card"}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen(item.id);
        }
      }}
    >
      <div className="item-meta">
        <span>{item.kind}</span>
        <strong>{item.source}</strong>
        <span>·</span>
        <time dateTime={item.date}>{item.date}</time>
        <button type="button" aria-label="收藏">
          <Heart size={16} />
        </button>
      </div>
      <h2>{item.title}</h2>
      {summaryOpen && item.summaryHtml ? (
        <div className="summary-html" style={{ fontSize: summarySize }} dangerouslySetInnerHTML={{ __html: item.summaryHtml }} />
      ) : (
        summaryOpen && <p style={{ fontSize: summarySize }}>{item.summary}</p>
      )}
      {!compact && (
        <div className="signals">
          {item.signals.map((signal) => (
            <span key={signal}>📡 {signal}</span>
          ))}
        </div>
      )}
      <div className="tag-row">
        {item.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        <a href={item.originalUrl} target="_blank" rel="noopener noreferrer nofollow" onClick={(event) => event.stopPropagation()}>
          查看原文 <ExternalLink size={13} />
        </a>
      </div>
    </article>
  );
}

function ItemsPage({
  activeTag,
  items,
  total,
  loading,
  error,
  viewMode,
  summaryOpen,
  summarySize,
  onItemOpen,
  onViewModeChange,
  onSummaryToggle,
}: {
  activeTag: string;
  items: IntelItem[];
  total: number;
  loading: boolean;
  error: string;
  viewMode: ViewMode;
  summaryOpen: boolean;
  summarySize: number;
  onItemOpen: (id: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSummaryToggle: () => void;
}) {
  const title = activeTag === "全部" ? "全部内容" : activeTag;
  const gridClass = viewMode === "single" ? "item-grid single" : viewMode === "compact" ? "item-grid compact-grid" : "item-grid";

  return (
    <main className="main-panel">
      <div className="page-head">
        <div className="title-row">
          <h1>{title}</h1>
          <span>{total} 篇</span>
        </div>
        <ViewControls mode={viewMode} summaryOpen={summaryOpen} onModeChange={onViewModeChange} onSummaryToggle={onSummaryToggle} />
      </div>

      {error ? (
        <div className="empty-state">{error}</div>
      ) : loading ? (
        <div className="empty-state">加载中...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">没有真实文章数据。请确认后端已部署，并且原站账号可登录。</div>
      ) : (
        <div className={gridClass}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              compact={viewMode === "compact"}
              summaryOpen={summaryOpen}
              summarySize={summarySize}
              onOpen={onItemOpen}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function DetailPage({ itemId, onBack }: { itemId: string; onBack: () => void }) {
  const [item, setItem] = useState<IntelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<{ item: IntelDetail }>(`/api/item/${itemId}`)
      .then((result) => {
        if (!cancelled) {
          setItem(result.item);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "文章加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return (
    <main className="main-panel detail-panel">
      <button className="back-button" type="button" onClick={onBack}>
        ← 返回
      </button>
      {loading ? (
        <div className="empty-state">加载文章中...</div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : item ? (
        <article className="article-card">
          <div className="item-meta article-meta">
            <span>{item.kind}</span>
            <strong>{item.source}</strong>
            <span>·</span>
            <time dateTime={item.date}>{item.date}</time>
          </div>
          <h1>{item.title}</h1>
          {item.summaryHtml && <div className="article-summary" dangerouslySetInnerHTML={{ __html: item.summaryHtml }} />}
          <div className="tag-row detail-tags">
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {item.originalUrl && (
              <a href={item.originalUrl} target="_blank" rel="noopener noreferrer nofollow">
                查看微信原文 <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div className="article-html" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
        </article>
      ) : null}
    </main>
  );
}

function SourceForm({
  draft,
  error,
  saving,
  onDraftChange,
  onSubmit,
}: {
  draft: SourceDraft;
  error: string;
  saving: boolean;
  onDraftChange: (draft: SourceDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="source-form" onSubmit={onSubmit}>
      <label>
        <span>公众号名称</span>
        <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} required />
      </label>
      <label>
        <span>微信号</span>
        <input value={draft.wechatId} onChange={(event) => onDraftChange({ ...draft, wechatId: event.target.value })} required />
      </label>
      <label>
        <span>标签</span>
        <input value={draft.tags} onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })} />
      </label>
      <label>
        <span>状态</span>
        <select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value as SourceAccount["status"] })}>
          <option value="启用">启用</option>
          <option value="停用">停用</option>
        </select>
      </label>
      <label className="wide">
        <span>简介</span>
        <textarea value={draft.description} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} rows={4} />
      </label>
      {error && <div className="form-error wide">{error}</div>}
      <button className="submit-button wide" type="submit" disabled={saving}>
        <CirclePlus size={16} />
        {saving ? "保存中..." : "添加公众号"}
      </button>
    </form>
  );
}

function AdminPage({
  sources,
  draft,
  error,
  offline,
  saving,
  onDraftChange,
  onSubmit,
}: {
  sources: SourceAccount[];
  draft: SourceDraft;
  error: string;
  offline: boolean;
  saving: boolean;
  onDraftChange: (draft: SourceDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="main-panel admin-panel">
      <div className="page-head">
        <div className="title-row">
          <h1>后台管理</h1>
          <span>{sources.length} 个公众号源</span>
        </div>
      </div>
      {offline && <div className="offline-banner">当前为静态演示模式，公众号保存在本浏览器；接通后端后会写入服务端。</div>}

      <section className="admin-grid">
        <article className="admin-card">
          <div className="card-head">
            <Settings size={18} />
            <div>
              <h2>添加公众号</h2>
              <p>提交后写入服务端数据文件，并立即同步到来源列表。</p>
            </div>
          </div>
          <SourceForm draft={draft} error={error} saving={saving} onDraftChange={onDraftChange} onSubmit={onSubmit} />
        </article>

        <article className="admin-card">
          <div className="card-head">
            <Newspaper size={18} />
            <div>
              <h2>公众号源</h2>
              <p>后续抓取任务可从这里读取启用源。</p>
            </div>
          </div>
          <div className="source-list">
            {sources.map((source) => (
              <section key={source.id}>
                <div>
                  <h3>{source.name}</h3>
                  <p>{source.description || "暂无简介"}</p>
                  <small>
                    {source.wechatId} · {source.tags.join(" / ")}
                    {source.originalCount ? ` · 原站 ${source.originalCount} 篇` : ""}
                  </small>
                </div>
                <span className={source.status === "启用" ? "status on" : "status"}>{source.status}</span>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pageMode, setPageMode] = useState<PageMode>("items");
  const [activeTag, setActiveTag] = useState("AI与游戏");
  const [activeTitle, setActiveTitle] = useState("AI与游戏");
  const [activeAuthor, setActiveAuthor] = useState("");
  const [activeSpecial, setActiveSpecial] = useState("");
  const [specialMessage, setSpecialMessage] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IntelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SourceAccount[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("double");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summarySize, setSummarySize] = useState(15);
  const [draft, setDraft] = useState<SourceDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const itemUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (activeAuthor) {
      params.set("author", activeAuthor);
    } else {
      params.set("tag", activeTag);
    }
    if (query.trim()) {
      params.set("q", query.trim());
    }
    return `/api/items?${params.toString()}`;
  }, [activeAuthor, activeTag, query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (specialMessage) {
          const { sources: nextSources } = offline ? { sources: loadOfflineSources() } : await api<{ sources: SourceAccount[] }>("/api/sources");
          if (!cancelled) {
            setItems([]);
            setTotal(0);
            setSources(nextSources);
            setLoadError(specialMessage);
          }
          return;
        }

        const [{ items: nextItems, total: nextTotal }, { sources: nextSources }] = offline
          ? [
              { items: filterItems(fallbackItems, activeTag, query), total: fallbackItems.length },
              { sources: loadOfflineSources() },
            ]
          : await Promise.all([
              api<{ items: IntelItem[]; total: number }>(itemUrl),
              api<{ sources: SourceAccount[] }>("/api/sources"),
            ]);
        if (!cancelled) {
          setItems(nextItems);
          setTotal(nextTotal);
          setSources(nextSources);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load().catch((error) => {
      if (!cancelled) {
        setItems([]);
        setTotal(0);
        setSources(loadOfflineSources());
        setLoadError(error instanceof Error ? error.message : "没有连上真实数据后端。请部署 Node 服务，并使用原站账号登录。");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTag, itemUrl, offline, query, specialMessage]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const source = offline
        ? {
            id: `${draft.wechatId.trim() || draft.name.trim()}-${Date.now()}`,
            name: draft.name.trim(),
            wechatId: draft.wechatId.trim(),
            description: draft.description.trim(),
            tags: normalizeTags(draft.tags),
            status: draft.status,
            createdAt: new Date().toISOString().slice(0, 10),
          }
        : (
            await api<{ source: SourceAccount }>("/api/sources", {
              method: "POST",
              body: JSON.stringify({ ...draft, tags: normalizeTags(draft.tags) }),
            })
          ).source;
      setSources((current) => [source, ...current]);
      if (offline) {
        window.localStorage.setItem(offlineSourcesKey, JSON.stringify([source, ...sources]));
      }
      setDraft(emptyDraft);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        onLogin={(nextOffline = false) => {
          setOffline(nextOffline);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTag={activeTag}
        activeAuthor={activeAuthor}
        activeSpecial={activeSpecial}
        pageMode={pageMode}
        query={query}
        sources={sources}
        summarySize={summarySize}
        onSelectTag={(tag, label = tag) => {
          setSelectedItemId("");
          setPageMode("items");
          setActiveAuthor("");
          setActiveSpecial("");
          setSpecialMessage("");
          setActiveTag(tag);
          setActiveTitle(label === "全部" ? "全部内容" : label.replace(/^[^\p{Script=Han}A-Za-z0-9]+\s*/u, ""));
        }}
        onSelectAuthor={(author) => {
          setSelectedItemId("");
          setPageMode("items");
          setActiveTag("全部");
          setActiveTitle(author);
          setActiveAuthor(author);
          setActiveSpecial("");
          setSpecialMessage("");
        }}
        onSelectSpecial={(value, label, message) => {
          setSelectedItemId("");
          setPageMode("items");
          setActiveTag("全部");
          setActiveTitle(label);
          setActiveAuthor("");
          setActiveSpecial(value);
          setSpecialMessage(message);
        }}
        onPageModeChange={(mode) => {
          setSelectedItemId("");
          setActiveAuthor("");
          setActiveSpecial("");
          setSpecialMessage("");
          setPageMode(mode);
        }}
        onQueryChange={setQuery}
        onSummarySizeChange={setSummarySize}
        onLogout={() => setLoggedIn(false)}
      />
      {selectedItemId ? (
        <DetailPage itemId={selectedItemId} onBack={() => setSelectedItemId("")} />
      ) : pageMode === "items" ? (
        <ItemsPage
          activeTag={activeTitle}
          items={items}
          total={total}
          loading={loading}
          error={loadError}
          viewMode={viewMode}
          summaryOpen={summaryOpen}
          summarySize={summarySize}
          onItemOpen={setSelectedItemId}
          onViewModeChange={setViewMode}
          onSummaryToggle={() => setSummaryOpen((current) => !current)}
        />
      ) : (
        <AdminPage sources={sources} draft={draft} error={formError} offline={offline} saving={saving} onDraftChange={setDraft} onSubmit={addSource} />
      )}
      <div className="mobile-bar" aria-hidden="true">
        <BookOpen size={16} />
        <Megaphone size={16} />
        <MessageCircle size={16} />
        <LogOut size={16} />
      </div>
    </div>
  );
}
