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

const primaryLinks = [
  { label: "📚 全部内容", tag: "全部" },
  { label: "❤️ 我的收藏", tag: "收藏" },
  { label: "💡 提建议", tag: "建议" },
  { label: "📣 更新日志", tag: "日志" },
  { label: "💬 加入微信群", tag: "微信群" },
  { label: "🤖 AI与游戏", tag: "AI与游戏" },
];

const categoryLinks = ["小游戏", "发行", "研发", "出海", "其他", "玩法 / 主题", "按公众号"];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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

function LoginScreen({ onLogin }: { onLogin: () => void }) {
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
        setError("请输入账号和密码");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "登录失败");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="登录">
        <h1>📚 游戏研究所pro</h1>
        <p>登录后查看全量归档与检索</p>
        <form className="login-form" onSubmit={submit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="账号" autoFocus />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密码" />
          <button type="submit">
            <LogIn size={16} />
            登录
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
        <p className="login-note">还没账号？<button type="button">注册</button></p>
      </section>
    </main>
  );
}

function Sidebar({
  activeTag,
  pageMode,
  query,
  sources,
  summarySize,
  onTagChange,
  onPageModeChange,
  onQueryChange,
  onSummarySizeChange,
  onLogout,
}: {
  activeTag: string;
  pageMode: PageMode;
  query: string;
  sources: SourceAccount[];
  summarySize: number;
  onTagChange: (tag: string) => void;
  onPageModeChange: (mode: PageMode) => void;
  onQueryChange: (query: string) => void;
  onSummarySizeChange: (size: number) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <button type="button" className="brand-link" onClick={() => onPageModeChange("items")}>
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
        {primaryLinks.map((link) => (
          <button
            className={pageMode === "items" && activeTag === link.tag ? "active" : ""}
            key={link.tag}
            type="button"
            onClick={() => {
              onPageModeChange("items");
              onTagChange(link.tag);
            }}
          >
            <span>{link.label}</span>
            <strong>{link.tag === "AI与游戏" ? 268 : link.tag === "全部" ? 4182 : ""}</strong>
          </button>
        ))}
        <div className="nav-section">分类</div>
        {categoryLinks.map((label) => (
          <button
            className={pageMode === "items" && activeTag === label ? "active" : ""}
            key={label}
            type="button"
            onClick={() => {
              onPageModeChange("items");
              onTagChange(label);
            }}
          >
            <span>{label === "按公众号" ? `▸ 📰 ${label}` : `▸ ${label}`}</span>
            <strong>{label === "按公众号" ? sources.length : ""}</strong>
          </button>
        ))}
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
}: {
  item: IntelItem;
  compact: boolean;
  summaryOpen: boolean;
  summarySize: number;
}) {
  return (
    <article className={compact ? "item-card compact" : "item-card"}>
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
      {summaryOpen && <p style={{ fontSize: summarySize }}>{item.summary}</p>}
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
        <a href={item.originalUrl} onClick={(event) => event.preventDefault()}>
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
  viewMode,
  summaryOpen,
  summarySize,
  onViewModeChange,
  onSummaryToggle,
}: {
  activeTag: string;
  items: IntelItem[];
  total: number;
  loading: boolean;
  viewMode: ViewMode;
  summaryOpen: boolean;
  summarySize: number;
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

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">没有匹配的情报</div>
      ) : (
        <div className={gridClass}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} compact={viewMode === "compact"} summaryOpen={summaryOpen} summarySize={summarySize} />
          ))}
        </div>
      )}
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
  saving,
  onDraftChange,
  onSubmit,
}: {
  sources: SourceAccount[];
  draft: SourceDraft;
  error: string;
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
                  <small>{source.wechatId} · {source.tags.join(" / ")}</small>
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
  const [pageMode, setPageMode] = useState<PageMode>("items");
  const [activeTag, setActiveTag] = useState("AI与游戏");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IntelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SourceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("double");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summarySize, setSummarySize] = useState(15);
  const [draft, setDraft] = useState<SourceDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const itemUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tag", ["收藏", "建议", "日志", "微信群"].includes(activeTag) ? "全部" : activeTag);
    if (query.trim()) {
      params.set("q", query.trim());
    }
    return `/api/items?${params.toString()}`;
  }, [activeTag, query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [{ items: nextItems, total: nextTotal }, { sources: nextSources }] = await Promise.all([
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
    load().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemUrl]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const { source } = await api<{ source: SourceAccount }>("/api/sources", {
        method: "POST",
        body: JSON.stringify({ ...draft, tags: normalizeTags(draft.tags) }),
      });
      setSources((current) => [source, ...current]);
      setDraft(emptyDraft);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTag={activeTag}
        pageMode={pageMode}
        query={query}
        sources={sources}
        summarySize={summarySize}
        onTagChange={setActiveTag}
        onPageModeChange={setPageMode}
        onQueryChange={setQuery}
        onSummarySizeChange={setSummarySize}
        onLogout={() => setLoggedIn(false)}
      />
      {pageMode === "items" ? (
        <ItemsPage
          activeTag={activeTag}
          items={items}
          total={total}
          loading={loading}
          viewMode={viewMode}
          summaryOpen={summaryOpen}
          summarySize={summarySize}
          onViewModeChange={setViewMode}
          onSummaryToggle={() => setSummaryOpen((current) => !current)}
        />
      ) : (
        <AdminPage sources={sources} draft={draft} error={formError} saving={saving} onDraftChange={setDraft} onSubmit={addSource} />
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
