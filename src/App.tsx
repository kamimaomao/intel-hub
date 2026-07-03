import {
  ChevronDown,
  CirclePlus,
  ExternalLink,
  Heart,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  directCategoryLinks,
  groupedCategoryLinks,
  playTypeLinks,
  themeLinks,
  topNavLinks,
  type NavLink,
} from "./data/navConfig";
import originalSources from "./data/originalSources.json";

type ViewMode = "double" | "single" | "compact";
type PageMode = "items" | "admin";
type SourceProvider = "manual" | "feed" | "json" | "xianjian" | "wechat" | "newrank";

type SourceAccount = {
  id: string;
  sourceType?: "公众号" | "视频号";
  name: string;
  wechatId: string;
  provider?: SourceProvider;
  externalId?: string;
  feedUrl?: string;
  description: string;
  tags: string[];
  status: "启用" | "停用";
  createdAt: string;
  originalCount?: number;
  itemCount?: number;
  lastSyncAt?: string;
  syncStatus?: "idle" | "syncing" | "success" | "failed";
  syncMessage?: string;
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

type ItemCounts = {
  total: number;
  tags: Record<string, number>;
};

type SourceDraft = {
  sourceType: SourceAccount["sourceType"];
  provider: SourceProvider;
  name: string;
  wechatId: string;
  externalId: string;
  feedUrl: string;
  tags: string;
  description: string;
  status: SourceAccount["status"];
};

type SyncResult = {
  source: SourceAccount;
  imported: number;
  status?: SourceAccount["syncStatus"];
  message?: string;
};

const emptyDraft: SourceDraft = {
  sourceType: "公众号",
  provider: "manual",
  name: "",
  wechatId: "",
  externalId: "",
  feedUrl: "",
  tags: "AI与游戏",
  description: "",
  status: "启用",
};

const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";
const offlineSourcesKey = "intel-hub-offline-sources-v2";
const fallbackSources = originalSources as SourceAccount[];
const fallbackItems: IntelItem[] = [];
const emptyCounts: ItemCounts = { total: 0, tags: {} };

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
  return items.filter((item) => {
    const matchesTag = tag === "全部" || item.tag === tag || item.tags.includes(tag);
    const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${item.tags.join(" ")}`.toLowerCase();
    return matchesTag && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function countLink(link: NavLink, counts: ItemCounts) {
  return link.value === "全部" ? counts.total : counts.tags[link.value] || 0;
}

function countLinks(links: NavLink[], counts: ItemCounts) {
  return links.reduce((total, link) => total + countLink(link, counts), 0);
}

function Sidebar({
  activeTag,
  activeAuthor,
  pageMode,
  query,
  sources,
  itemCounts,
  summarySize,
  onSelectTag,
  onSelectAuthor,
  onPageModeChange,
  onQueryChange,
  onSummarySizeChange,
}: {
  activeTag: string;
  activeAuthor: string;
  pageMode: PageMode;
  query: string;
  sources: SourceAccount[];
  itemCounts: ItemCounts;
  summarySize: number;
  onSelectTag: (tag: string, label?: string) => void;
  onSelectAuthor: (author: string) => void;
  onPageModeChange: (mode: PageMode) => void;
  onQueryChange: (query: string) => void;
  onSummarySizeChange: (size: number) => void;
}) {
  const availableSources = sources.length > 0 ? sources : fallbackSources;
  const authorSources = availableSources.filter((source) => (source.sourceType || "公众号") === "公众号");
  const videoSources = availableSources.filter((source) => source.sourceType === "视频号");

  function tagActive(value: string) {
    return pageMode === "items" && !activeAuthor && activeTag === value;
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
        <strong>{countLink(link, itemCounts)}</strong>
      </button>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <button type="button" className="brand-link" onClick={() => onSelectTag("全部", "全部内容")}>
          <span className="brand-mark" aria-hidden="true">IH</span>
          <span>
            <strong>游戏行业情报库</strong>
            <small>INTEL MEDIA HUB</small>
          </span>
        </button>
      </div>

      <label className="search-control">
        <Search size={15} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题/摘要" />
      </label>

      <nav className="side-nav" aria-label="情报导航">
        {topNavLinks.slice(0, 1).map((link) => renderTagButton(link))}
        {topNavLinks.slice(1).map((link) => renderTagButton(link))}

        <div className="nav-section">分类</div>
        {directCategoryLinks.slice(0, 1).map((link) => renderTagButton(link))}
        {groupedCategoryLinks.map((group) => (
          <details className="nav-group" key={group.title} open={group.links.some((link) => tagActive(link.value)) || undefined}>
            <summary>
              <span>▸ {group.title}</span>
              <strong>{countLinks(group.links, itemCounts)}</strong>
            </summary>
            <div>
              {group.links.map((link) => renderTagButton(link, "nav-subrow"))}
            </div>
          </details>
        ))}
        {directCategoryLinks.slice(1).map((link) => renderTagButton(link))}

        <details className="nav-group" open={playTypeLinks.concat(themeLinks).some((link) => tagActive(link.value)) || undefined}>
          <summary>
            <span>▸ 玩法 / 主题</span>
            <strong>{countLinks(playTypeLinks.concat(themeLinks), itemCounts)}</strong>
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
            <span>▸ 按公众号</span>
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
                <strong>{source.itemCount || ""}</strong>
              </button>
            ))}
          </div>
        </details>

        <details className="nav-group" open={videoSources.some((source) => activeAuthor === source.name) || undefined}>
          <summary>
            <span>▸ 按视频号</span>
            <strong>{videoSources.length}</strong>
          </summary>
          <div>
            {videoSources.length === 0 ? (
              <div className="nav-empty">后台添加视频号后显示在这里</div>
            ) : (
              videoSources.map((source) => (
                <button
                  className={`nav-subrow ${activeAuthor === source.name ? "active" : ""}`.trim()}
                  key={source.id}
                  type="button"
                  onClick={() => onSelectAuthor(source.name)}
                >
                  <span>{source.name}</span>
                  <strong>{source.itemCount || ""}</strong>
                </button>
              ))
            )}
          </div>
        </details>

        <button className={pageMode === "admin" ? "active" : ""} type="button" onClick={() => onPageModeChange("admin")}>
          <span>后台管理</span>
          <strong>{availableSources.length}</strong>
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
            <span key={signal}>{signal}</span>
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
  const viewLabel = viewMode === "double" ? "双列" : viewMode === "single" ? "单列" : "紧凑";

  return (
    <main className="main-panel">
      <div className="campaign-head">
        <div className="campaign-copy">
          <p>MEDIA INTEL / GAME BUSINESS</p>
          <h1>{title}</h1>
          <span>用真实来源追踪游戏行业、AI 应用、发行投放与内容信号。</span>
          <div className="campaign-metrics" aria-label="当前视图数据">
            <strong>{total}<span>篇文章</span></strong>
            <strong>{viewLabel}<span>视图</span></strong>
            <strong>{summaryOpen ? "ON" : "OFF"}<span>摘要</span></strong>
          </div>
        </div>
        <div className="campaign-visual" aria-hidden="true">
          <span className="bolt-mark">I</span>
          <span className="orbit-label label-media">MEDIA</span>
          <span className="orbit-label label-data">DATA</span>
          <span className="orbit-label label-game">GAME</span>
          <span className="orbit-label label-feed">FEED</span>
        </div>
      </div>

      <div className="page-toolbar">
        <div>
          <strong>{title}</strong>
          <span>{total} 篇真实文章</span>
        </div>
        <ViewControls mode={viewMode} summaryOpen={summaryOpen} onModeChange={onViewModeChange} onSummaryToggle={onSummaryToggle} />
      </div>

      {error ? (
        <div className="empty-state">{error}</div>
      ) : loading ? (
        <div className="empty-state">加载中...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">没有本地情报数据。请在后台添加来源并同步，或通过接口导入文章。</div>
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
  const accountLabel = draft.sourceType === "视频号" ? "视频号账号/主页链接" : "微信号";
  const needsFeedUrl = draft.provider === "feed" || draft.provider === "json";

  return (
    <form className="source-form" onSubmit={onSubmit}>
      <label>
        <span>来源类型</span>
        <select value={draft.sourceType} onChange={(event) => onDraftChange({ ...draft, sourceType: event.target.value as SourceAccount["sourceType"] })}>
          <option value="公众号">公众号</option>
          <option value="视频号">视频号</option>
        </select>
      </label>
      <label>
        <span>数据源</span>
        <select value={draft.provider} onChange={(event) => onDraftChange({ ...draft, provider: event.target.value as SourceProvider })}>
          <option value="manual">手动导入</option>
          <option value="feed">RSS / Atom</option>
          <option value="json">JSON API</option>
          <option value="xianjian">原站公开索引</option>
          <option value="wechat">微信采集</option>
          <option value="newrank">新榜 / 新视</option>
        </select>
      </label>
      <label>
        <span>{draft.sourceType === "视频号" ? "视频号名称" : "公众号名称"}</span>
        <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} required />
      </label>
      <label>
        <span>{accountLabel}</span>
        <input value={draft.wechatId} onChange={(event) => onDraftChange({ ...draft, wechatId: event.target.value })} required />
      </label>
      <label>
        <span>外部 ID</span>
        <input value={draft.externalId} onChange={(event) => onDraftChange({ ...draft, externalId: event.target.value })} placeholder="视频号 ID / wxbiz / provider id" />
      </label>
      <label className="wide">
        <span>{needsFeedUrl ? "Feed / API URL" : "Feed / API URL（可选）"}</span>
        <input value={draft.feedUrl} onChange={(event) => onDraftChange({ ...draft, feedUrl: event.target.value })} placeholder="https://..." required={needsFeedUrl} />
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
        {saving ? "保存中..." : `添加${draft.sourceType}`}
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
  syncingSourceId,
  onDraftChange,
  onSubmit,
  onSync,
}: {
  sources: SourceAccount[];
  draft: SourceDraft;
  error: string;
  offline: boolean;
  saving: boolean;
  syncingSourceId: string;
  onDraftChange: (draft: SourceDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSync: (sourceId: string) => void;
}) {
  const publicAccountCount = sources.filter((source) => (source.sourceType || "公众号") === "公众号").length;
  const videoAccountCount = sources.filter((source) => source.sourceType === "视频号").length;

  return (
    <main className="main-panel admin-panel">
      <div className="campaign-head admin-head">
        <div className="campaign-copy">
          <p>SOURCE CONTROL / DATA PIPELINE</p>
          <h1>后台管理</h1>
          <span>添加公众号、视频号、RSS、JSON 或公开索引来源，统一同步到本地情报库。</span>
          <div className="campaign-metrics" aria-label="来源统计">
            <strong>{publicAccountCount}<span>公众号源</span></strong>
            <strong>{videoAccountCount}<span>视频号源</span></strong>
            <strong>{sources.length}<span>总来源</span></strong>
          </div>
        </div>
        <div className="campaign-visual" aria-hidden="true">
          <span className="bolt-mark">S</span>
          <span className="orbit-label label-media">WECHAT</span>
          <span className="orbit-label label-data">RSS</span>
          <span className="orbit-label label-game">JSON</span>
          <span className="orbit-label label-feed">SYNC</span>
        </div>
      </div>
      {offline && <div className="offline-banner">当前为静态演示模式，公众号保存在本浏览器；接通后端后会写入服务端。</div>}

      <section className="admin-grid">
        <article className="admin-card">
          <div className="card-head">
            <Settings size={18} />
            <div>
              <h2>添加来源</h2>
              <p>来源保存到本地库。feed/json/公开索引可直接同步；微信和新榜需要可用账号或接口权限。</p>
            </div>
          </div>
          <SourceForm draft={draft} error={error} saving={saving} onDraftChange={onDraftChange} onSubmit={onSubmit} />
        </article>

        <article className="admin-card">
          <div className="card-head">
            <Newspaper size={18} />
            <div>
              <h2>情报源</h2>
              <p>同步成功后的文章会写入本地情报库。</p>
            </div>
          </div>
          <div className="source-list">
            {sources.map((source) => (
              <section key={source.id}>
                <div>
                  <h3><span className="source-type">{source.sourceType || "公众号"}</span>{source.name}</h3>
                  <p>{source.description || "暂无简介"}</p>
                  <small>
                    {(source.provider || "manual").toUpperCase()} · {source.externalId || source.wechatId} · {source.tags.join(" / ")}
                    {source.itemCount ? ` · 本地 ${source.itemCount} 篇` : ""}
                    {source.lastSyncAt ? ` · ${source.lastSyncAt.slice(0, 16).replace("T", " ")}` : ""}
                  </small>
                  {source.feedUrl && <small>{source.feedUrl}</small>}
                  {source.syncMessage && <small>{source.syncMessage}</small>}
                </div>
                <div className="source-actions">
                  <span className={source.status === "启用" ? "status on" : "status"}>{source.status}</span>
                  <button type="button" onClick={() => onSync(source.id)} disabled={syncingSourceId === source.id || source.syncStatus === "syncing"}>
                    <RefreshCw size={14} />
                    {syncingSourceId === source.id || source.syncStatus === "syncing" ? "同步中" : "同步"}
                  </button>
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

export default function App() {
  const offline = false;
  const [pageMode, setPageMode] = useState<PageMode>("items");
  const [activeTag, setActiveTag] = useState("AI与游戏");
  const [activeTitle, setActiveTitle] = useState("AI与游戏");
  const [activeAuthor, setActiveAuthor] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IntelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SourceAccount[]>([]);
  const [itemCounts, setItemCounts] = useState<ItemCounts>(emptyCounts);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("double");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summarySize, setSummarySize] = useState(15);
  const [draft, setDraft] = useState<SourceDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState("");

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
        const [{ items: nextItems, total: nextTotal }, { sources: nextSources }, { counts: nextCounts }] = offline
          ? [
              { items: filterItems(fallbackItems, activeTag, query), total: fallbackItems.length },
              { sources: loadOfflineSources() },
              { counts: emptyCounts },
            ]
          : await Promise.all([
              api<{ items: IntelItem[]; total: number }>(itemUrl),
              api<{ sources: SourceAccount[] }>("/api/sources"),
              api<{ counts: ItemCounts }>("/api/item-counts"),
            ]);
        if (!cancelled) {
          setItems(nextItems);
          setTotal(nextTotal);
          setSources(nextSources);
          setItemCounts(nextCounts);
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
        setItemCounts(emptyCounts);
        setLoadError(error instanceof Error ? error.message : "没有连上真实数据后端。请部署 Node 服务，并配置自己的数据源。");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTag, itemUrl, offline, query]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const source = offline
        ? {
            id: `${draft.wechatId.trim() || draft.name.trim()}-${Date.now()}`,
            sourceType: draft.sourceType,
            name: draft.name.trim(),
            wechatId: draft.wechatId.trim(),
            description: draft.description.trim(),
            provider: draft.provider,
            externalId: draft.externalId.trim(),
            feedUrl: draft.feedUrl.trim(),
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

  async function syncSource(sourceId: string) {
    setSyncingSourceId(sourceId);
    setFormError("");
    try {
      let result = await api<SyncResult>(`/api/sources/${sourceId}/sync`, { method: "POST" });
      setSources((current) => current.map((source) => (source.id === sourceId ? result.source : source)));
      while (result.status === "syncing" || result.source.syncStatus === "syncing") {
        await delay(5000);
        result = await api<SyncResult>(`/api/sources/${sourceId}/sync`);
        setSources((current) => current.map((source) => (source.id === sourceId ? result.source : source)));
      }
      const [{ items: nextItems, total: nextTotal }, { counts: nextCounts }] = await Promise.all([
        api<{ items: IntelItem[]; total: number }>(itemUrl),
        api<{ counts: ItemCounts }>("/api/item-counts"),
      ]);
      setItems(nextItems);
      setTotal(nextTotal);
      setItemCounts(nextCounts);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "同步失败");
    } finally {
      setSyncingSourceId("");
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTag={activeTag}
        activeAuthor={activeAuthor}
        pageMode={pageMode}
        query={query}
        sources={sources}
        itemCounts={itemCounts}
        summarySize={summarySize}
        onSelectTag={(tag, label = tag) => {
          setSelectedItemId("");
          setPageMode("items");
          setActiveAuthor("");
          setActiveTag(tag);
          setActiveTitle(label === "全部" ? "全部内容" : label.replace(/^[^\p{Script=Han}A-Za-z0-9]+\s*/u, ""));
        }}
        onSelectAuthor={(author) => {
          setSelectedItemId("");
          setPageMode("items");
          setActiveTag("全部");
          setActiveTitle(author);
          setActiveAuthor(author);
        }}
        onPageModeChange={(mode) => {
          setSelectedItemId("");
          setActiveAuthor("");
          setPageMode(mode);
        }}
        onQueryChange={setQuery}
        onSummarySizeChange={setSummarySize}
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
        <AdminPage
          sources={sources}
          draft={draft}
          error={formError}
          offline={offline}
          saving={saving}
          syncingSourceId={syncingSourceId}
          onDraftChange={setDraft}
          onSubmit={addSource}
          onSync={syncSource}
        />
      )}
    </div>
  );
}
