import originalSources from "../src/data/originalSources.json";

type SourceAccount = {
  id: string;
  sourceType: "公众号" | "视频号";
  name: string;
  wechatId: string;
  provider: string;
  externalId: string;
  feedUrl: string;
  description: string;
  tags: string[];
  status: "启用" | "停用";
  createdAt: string;
  originalCount?: number;
  lastSyncAt?: string;
  syncStatus?: "idle" | "syncing" | "success" | "failed";
  syncMessage?: string;
};

type IntelItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceId: string;
  kind: string;
  tag: string;
  tags: string[];
  date: string;
  signals: string[];
  originalUrl: string;
  detailUrl: string;
  summaryHtml: string;
  contentHtml: string;
  provider: string;
  videoUrl: string;
  embedUrl: string;
  coverUrl: string;
  duration: string;
};

type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

const fetchUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const itemCountSets: Record<string, string[]> = {
  "发行": ["发行·买量数据与素材", "发行·行业大盘与新游", "发行·流水榜单与市场", "发行·立项选品与休闲发行", "发行·广告变现策略"],
  "研发": ["研发·爆款拆解与系统复盘", "研发·策划与设计方法论", "研发·数值设计", "研发·研发技术与独立开发", "研发·小游戏立项"],
  "出海": ["出海·出海资讯与策略", "出海·海外买量与素材", "出海·海外数据与榜单", "出海·短剧出海与分发"],
  "玩法 / 主题": [
    "SLG",
    "合成",
    "模拟经营",
    "休闲",
    "超休闲",
    "三消",
    "卡牌",
    "放置",
    "Roguelike",
    "塔防",
    "二次元",
    "重度MMO",
    "买量素材",
    "数值设计",
    "IAA变现",
    "IAP混变",
    "出海",
    "爆款拆解",
    "AI工具",
    "平台政策",
    "融资资本",
    "榜单数据",
    "投放ROI",
    "长线运营",
  ],
};

function text(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((tag) => text(tag)).filter(Boolean);
  }
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function slug(value: string) {
  return text(value)
    .toLowerCase()
    .replace(/[^\p{Script=Han}\w-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

async function stableId(parts: unknown[]) {
  const data = new TextEncoder().encode(parts.map(text).join("|"));
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(source: Partial<SourceAccount>): SourceAccount {
  const sourceType = source.sourceType === "视频号" ? "视频号" : "公众号";
  const name = text(source.name);
  const wechatId = text(source.wechatId || source.externalId || name);
  const feedUrl = text(source.feedUrl);
  const provider = text(source.provider || (feedUrl ? "feed" : "manual")) || "manual";
  const externalId = text(source.externalId || wechatId || name);

  return {
    id: text(source.id) || `${slug(sourceType)}-${slug(externalId || name)}-${Date.now()}`,
    sourceType,
    name,
    wechatId,
    provider,
    externalId,
    feedUrl,
    description: text(source.description),
    tags: normalizeTags(source.tags),
    status: source.status === "停用" ? "停用" : "启用",
    createdAt: text(source.createdAt) || today(),
    originalCount: Number(source.originalCount) || undefined,
    lastSyncAt: text(source.lastSyncAt),
    syncStatus: (text(source.syncStatus) as SourceAccount["syncStatus"]) || "idle",
    syncMessage: text(source.syncMessage),
  };
}

async function normalizeItem(item: Partial<IntelItem>, source?: SourceAccount): Promise<IntelItem> {
  const sourceName = text(item.source || source?.name);
  const kind = text(item.kind || source?.sourceType || "公众号");
  const tags = normalizeTags(item.tags);
  const title = text(item.title);
  const date = text(item.date);
  const originalUrl = text(item.originalUrl);

  return {
    id: text(item.id) || (await stableId([source?.id, sourceName, title, date, originalUrl])),
    title,
    summary: text(item.summary),
    source: sourceName,
    sourceId: text(item.sourceId || source?.id),
    kind,
    tag: text(item.tag) || tags[0] || "全部",
    tags,
    date,
    signals: normalizeTags(item.signals),
    originalUrl,
    detailUrl: text(item.detailUrl || originalUrl),
    summaryHtml: text(item.summaryHtml),
    contentHtml: text(item.contentHtml || item.summaryHtml || item.summary),
    provider: text(item.provider || source?.provider || "manual"),
    videoUrl: text(item.videoUrl),
    embedUrl: text(item.embedUrl),
    coverUrl: text(item.coverUrl),
    duration: text(item.duration),
  };
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString().slice(0, 16).replace("T", " ");
}

function parseXianjianDate(value: unknown) {
  const raw = text(value);
  const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (isoLike) {
    return `${isoLike[1]} ${isoLike[2]}`;
  }
  const plain = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  return plain ? `${plain[1]} ${plain[2]}` : parseDate(raw);
}

function stripHtml(value: string) {
  return text(value.replace(/<[^>]+>/g, " "));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function unique(values: string[]) {
  return [...new Set(values.map(text).filter(Boolean))];
}

async function initDb(env: Env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, source_type TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, source_id TEXT NOT NULL, tag TEXT NOT NULL, tags TEXT NOT NULL, date TEXT NOT NULL, searchable TEXT NOT NULL, data TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS items_date_idx ON items (date DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS items_source_id_idx ON items (source_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS items_tag_idx ON items (tag)"),
  ]);

  const seeded = await env.DB.prepare("SELECT value FROM kv WHERE key = ?").bind("seeded:sources:v1").first<{ value: string }>();
  if (seeded?.value) {
    return;
  }

  const sources = (originalSources as Partial<SourceAccount>[]).map(normalizeSource).filter((source) => source.name);
  const inserts = sources.map((source) =>
    env.DB.prepare("INSERT OR IGNORE INTO sources (id, name, source_type, status, data) VALUES (?, ?, ?, ?, ?)")
      .bind(source.id, source.name, source.sourceType, source.status, JSON.stringify(source)),
  );
  inserts.push(env.DB.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").bind("seeded:sources:v1", new Date().toISOString()));
  await env.DB.batch(inserts);
}

async function getKv(env: Env, key: string) {
  const row = await env.DB.prepare("SELECT value FROM kv WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value || "";
}

async function setKv(env: Env, key: string, value: unknown) {
  await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").bind(key, JSON.stringify(value)).run();
}

async function listSources(env: Env) {
  const result = await env.DB.prepare("SELECT data FROM sources ORDER BY source_type DESC, name ASC").all<{ data: string }>();
  return result.results.map((row) => normalizeSource(JSON.parse(row.data)));
}

async function getSource(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT data FROM sources WHERE id = ?").bind(id).first<{ data: string }>();
  return row ? normalizeSource(JSON.parse(row.data)) : null;
}

async function saveSource(env: Env, source: SourceAccount) {
  const normalized = normalizeSource(source);
  await env.DB.prepare("INSERT OR REPLACE INTO sources (id, name, source_type, status, data) VALUES (?, ?, ?, ?, ?)")
    .bind(normalized.id, normalized.name, normalized.sourceType, normalized.status, JSON.stringify(normalized))
    .run();
  return normalized;
}

async function upsertItems(env: Env, items: IntelItem[]) {
  const statements = items
    .filter((item) => item.id && item.title)
    .map((item) => {
      const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${item.tags.join(" ")} ${item.signals.join(" ")}`.toLowerCase();
      return env.DB.prepare("INSERT OR REPLACE INTO items (id, title, source, source_id, tag, tags, date, searchable, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(item.id, item.title, item.source, item.sourceId, item.tag, JSON.stringify(item.tags), item.date, searchable, JSON.stringify(item));
    });
  for (let index = 0; index < statements.length; index += 100) {
    await env.DB.batch(statements.slice(index, index + 100));
  }
}

async function readItems(env: Env, filters: { tag?: string; q?: string; author?: string } = {}) {
  const tag = text(filters.tag || "全部");
  const query = text(filters.q).toLowerCase();
  const author = text(filters.author);
  const result = await env.DB.prepare("SELECT data FROM items ORDER BY date DESC").all<{ data: string }>();
  const items = result.results.map((row) => JSON.parse(row.data) as IntelItem).filter((item) => {
    const matchesAuthor = !author || item.source === author || item.sourceId === author;
    const matchesTag = tag === "全部" || item.tag === tag || item.tags.includes(tag);
    const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${item.tags.join(" ")} ${item.signals.join(" ")}`.toLowerCase();
    return matchesAuthor && matchesTag && (!query || searchable.includes(query));
  });
  return { items, total: items.length };
}

function countItems(items: IntelItem[]) {
  const tags: Record<string, number> = {};
  const sets: Record<string, number> = {};
  const normalizedSets = Object.entries(itemCountSets).map(([name, values]) => [name, new Set(normalizeTags(values))] as const);
  for (const item of items) {
    const itemTags = new Set([text(item.tag), ...normalizeTags(item.tags)].filter(Boolean));
    for (const tag of itemTags) {
      if (tag && tag !== "全部") {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }
    for (const [name, values] of normalizedSets) {
      if ([...itemTags].some((tag) => values.has(tag))) {
        sets[name] = (sets[name] || 0) + 1;
      }
    }
  }
  return { total: items.length, tags, sets };
}

function parseFeedItems(feedText: string, source: SourceAccount) {
  const itemBlocks = [...feedText.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  return Promise.all(itemBlocks.map(async (block) => {
    const read = (tag: string) => decodeHtml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((match) => decodeHtml(match[1]));
    const tags = unique([...categories, ...source.tags]);
    return normalizeItem({
      id: read("guid") || read("link"),
      title: read("title"),
      summary: stripHtml(read("description")),
      contentHtml: read("content:encoded") || read("description"),
      date: parseDate(read("pubDate")),
      tags,
      tag: tags[0],
      originalUrl: read("link"),
    }, source);
  }));
}

function parseJsonItems(payload: unknown, source: SourceAccount) {
  const data = payload as Record<string, unknown>;
  const list = Array.isArray(payload)
    ? payload
    : (data.items || data.entries || (data.data as Record<string, unknown>)?.items || (data.data as Record<string, unknown>)?.list || data.data || []);
  if (!Array.isArray(list)) {
    return Promise.resolve([]);
  }
  return Promise.all(list.map((raw) => {
    const item = raw as Record<string, unknown>;
    const tags = unique([...normalizeTags(item.tags || item.category), ...source.tags]);
    return normalizeItem({
      id: item.id as string || item.uuid as string || item.url as string,
      title: item.title as string || item.name as string,
      summary: item.summary as string || item.description as string || item.desc as string || item.excerpt as string,
      contentHtml: item.contentHtml as string || item.content as string || item.html as string || item.summary as string,
      date: item.date as string || item.publishedAt as string || item.pubDate as string || item.createTime as string || item.createdAt as string,
      tags,
      tag: tags[0],
      originalUrl: item.originalUrl as string || item.url as string || item.link as string,
      detailUrl: item.detailUrl as string || item.url as string || item.link as string,
      videoUrl: item.videoUrl as string || item.video_url as string || (item.video as Record<string, unknown>)?.url as string || item.mediaUrl as string,
      embedUrl: item.embedUrl as string || item.embed_url as string || item.playerUrl as string,
      coverUrl: item.coverUrl as string || item.cover_url as string || item.poster as string || item.image as string,
      duration: item.duration as string,
    }, source);
  }));
}

function parseXianjianSitemap(sitemapText: string) {
  return unique([...sitemapText.matchAll(/<loc>(https:\/\/ai\.xianjianwendao\.com\/kb\/item\/\d+)<\/loc>/g)].map((match) => match[1]));
}

function xianjianIdFromUrl(url: string) {
  const match = text(url).match(/\/kb\/item\/(\d+)/);
  return match ? `xianjian-${match[1]}` : "";
}

async function parseXianjianDetail(html: string, source: SourceAccount, detailUrl: string) {
  const jsonLdText = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  let article: Record<string, unknown> = {};
  if (jsonLdText) {
    try {
      const parsed = JSON.parse(jsonLdText);
      article = Array.isArray(parsed) ? parsed[0] || {} : parsed;
    } catch {
      article = {};
    }
  }
  const title = text(article.headline || decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""));
  const description = text(article.description || decodeHtml(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ""));
  const summaryHtml = text(html.match(/class=["'][^"']*kb-sum[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || description);
  const originalUrl = text(html.match(/https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+/i)?.[0]);
  const tags = unique([...source.tags, ...[...html.matchAll(/id=["']tags-region["'][\s\S]*?<\/div>/gi)].flatMap((match) =>
    [...match[0].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((tag) => stripHtml(decodeHtml(tag[1]))),
  )]).filter((tag) => tag !== "标签");

  return normalizeItem({
    id: xianjianIdFromUrl(detailUrl),
    title,
    summary: description,
    summaryHtml,
    contentHtml: summaryHtml,
    date: parseXianjianDate(article.datePublished),
    tags,
    tag: tags[0],
    originalUrl,
    detailUrl,
    source: (article.author as Record<string, unknown>)?.name as string || source.name,
    kind: "公众号",
    provider: "xianjian",
  }, source);
}

async function fetchSourceItems(source: SourceAccount, skipItemIds = new Set<string>()) {
  if (source.provider === "manual") {
    return [];
  }
  if (source.provider === "xianjian") {
    const sitemapResponse = await fetch(source.feedUrl || "https://ai.xianjianwendao.com/kb/sitemap.xml", {
      headers: { "User-Agent": fetchUserAgent },
    });
    if (!sitemapResponse.ok) {
      throw new Error(`公开索引请求失败：${sitemapResponse.status}`);
    }
    const detailUrls = parseXianjianSitemap(await sitemapResponse.text()).filter((url) => !skipItemIds.has(xianjianIdFromUrl(url)));
    const imported: IntelItem[] = [];
    for (let index = 0; index < detailUrls.length; index += 8) {
      const chunk = detailUrls.slice(index, index + 8);
      const items = await Promise.all(chunk.map(async (detailUrl) => {
        try {
          const response = await fetch(detailUrl, { headers: { "User-Agent": fetchUserAgent } });
          return response.ok ? parseXianjianDetail(await response.text(), source, detailUrl) : null;
        } catch {
          return null;
        }
      }));
      imported.push(...items.filter(Boolean) as IntelItem[]);
    }
    return imported;
  }
  if (source.provider === "feed" || source.provider === "json") {
    if (!source.feedUrl) {
      throw new Error(`${source.name} 缺少 feedUrl，无法同步。`);
    }
    const response = await fetch(source.feedUrl, { headers: { "User-Agent": fetchUserAgent } });
    if (!response.ok) {
      throw new Error(`数据源请求失败：${response.status}`);
    }
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "";
    return source.provider === "json" || contentType.includes("json") || /^[\s\n]*[\[{]/.test(body)
      ? parseJsonItems(JSON.parse(body), source)
      : parseFeedItems(body, source);
  }
  throw new Error(`${source.provider} 需要接入可用的第三方账号、Cookie 或 API Key。`);
}

async function syncSource(env: Env, sourceId: string) {
  const source = await getSource(env, sourceId);
  if (!source) {
    throw new Error("来源不存在");
  }
  const existing = await readItems(env);
  const syncingSource = await saveSource(env, { ...source, syncStatus: "syncing", syncMessage: "同步中，原站限流时会自动等待后继续。" });
  try {
    const items = await fetchSourceItems(syncingSource, new Set(existing.items.map((item) => item.id)));
    await upsertItems(env, items);
    const updated = await saveSource(env, {
      ...syncingSource,
      lastSyncAt: new Date().toISOString(),
      syncStatus: "success",
      syncMessage: `同步 ${items.length} 条`,
    });
    return { source: updated, status: "success", imported: items.length, message: updated.syncMessage };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    const updated = await saveSource(env, {
      ...syncingSource,
      lastSyncAt: new Date().toISOString(),
      syncStatus: "failed",
      syncMessage: message,
    });
    return { source: updated, status: "failed", imported: 0, message };
  }
}

function dailySyncKey(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function maybeRunDailySync(env: Env, ctx: ExecutionContext) {
  const state = await readDailySync(env);
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: state.syncState.dailyTimeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
  const [hour, minute] = state.syncState.dailyTime.split(":").map(Number);
  const key = dailySyncKey(now, state.syncState.dailyTimeZone);
  if (state.syncState.dailyEnabled !== false && state.syncState.dailyLastRunKey !== key && currentMinutes >= hour * 60 + minute) {
    ctx.waitUntil(runDailySync(env, key));
  }
}

async function readDailySync(env: Env) {
  const stored = await getKv(env, "syncState");
  const syncState = stored ? JSON.parse(stored) : {};
  const sources = await listSources(env);
  return {
    syncState: {
      dailyEnabled: syncState.dailyEnabled === false ? false : true,
      dailyTime: text(syncState.dailyTime) || "14:45",
      dailyTimeZone: text(syncState.dailyTimeZone) || "Asia/Shanghai",
      dailyLastRunKey: text(syncState.dailyLastRunKey),
      dailyLastRunAt: text(syncState.dailyLastRunAt),
      dailyLastStatus: text(syncState.dailyLastStatus) || "idle",
      dailyLastImported: Number(syncState.dailyLastImported) || 0,
      dailyLastMessage: text(syncState.dailyLastMessage),
    },
    syncableSourceCount: sources.filter((source) => source.status !== "停用" && ["feed", "json", "xianjian"].includes(source.provider)).length,
    job: null,
  };
}

async function runDailySync(env: Env, runKey = dailySyncKey()) {
  const sources = (await listSources(env)).filter((source) => source.status !== "停用" && ["feed", "json", "xianjian"].includes(source.provider));
  await setKv(env, "syncState", {
    dailyLastRunKey: runKey,
    dailyLastRunAt: new Date().toISOString(),
    dailyLastStatus: "syncing",
    dailyLastImported: 0,
    dailyLastMessage: `自动刷新中：${sources.length} 个来源。`,
  });
  let imported = 0;
  let failed = 0;
  for (const source of sources) {
    const result = await syncSource(env, source.id);
    imported += Number(result.imported) || 0;
    if (result.status === "failed") {
      failed += 1;
    }
  }
  const status = failed ? "failed" : "success";
  const message = `自动刷新 ${sources.length} 个来源，导入 ${imported} 条${failed ? `，失败 ${failed} 个来源` : ""}。`;
  await setKv(env, "syncState", {
    dailyLastRunKey: runKey,
    dailyLastRunAt: new Date().toISOString(),
    dailyLastStatus: status,
    dailyLastImported: imported,
    dailyLastMessage: message,
  });
  return { status, sourceCount: sources.length, imported, failed, message };
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext) {
  await initDb(env);
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true });
  }
  if (request.method === "GET" && path === "/api/items") {
    ctx.waitUntil(maybeRunDailySync(env, ctx));
    const result = await readItems(env, {
      tag: url.searchParams.get("tag") || "全部",
      q: url.searchParams.get("q") || "",
      author: url.searchParams.get("author") || "",
    });
    return json(result);
  }
  if (request.method === "GET" && path.startsWith("/api/item/")) {
    const id = decodeURIComponent(path.replace("/api/item/", ""));
    const row = await env.DB.prepare("SELECT data FROM items WHERE id = ?").bind(id).first<{ data: string }>();
    return row ? json({ item: JSON.parse(row.data) }) : json({ error: "文章不存在", code: "ITEM_NOT_FOUND" }, { status: 404 });
  }
  if (request.method === "GET" && path === "/api/item-counts") {
    const result = await readItems(env);
    return json({ counts: countItems(result.items) });
  }
  if (request.method === "GET" && path === "/api/sources") {
    const sources = await listSources(env);
    const counts = await env.DB.prepare("SELECT source, source_id, COUNT(*) AS count FROM items GROUP BY source, source_id").all<{ source: string; source_id: string; count: number }>();
    const sourceCounts = new Map<string, number>();
    for (const row of counts.results) {
      sourceCounts.set(row.source, Number(row.count) || 0);
      sourceCounts.set(row.source_id, Number(row.count) || 0);
    }
    return json({ sources: sources.map((source) => ({ ...source, itemCount: sourceCounts.get(source.id) || sourceCounts.get(source.name) || 0 })) });
  }
  if (request.method === "GET" && path === "/api/sync/daily") {
    ctx.waitUntil(maybeRunDailySync(env, ctx));
    return json(await readDailySync(env));
  }
  if (request.method === "POST" && path === "/api/sync/daily/run") {
    const runKey = dailySyncKey();
    ctx.waitUntil(runDailySync(env, runKey));
    return json({ job: { status: "syncing", imported: 0, message: "手动刷新中。", runKey } }, { status: 202 });
  }
  if (request.method === "POST" && path === "/api/sources") {
    const body = await request.json<Partial<SourceAccount> & { tags?: unknown }>();
    const name = text(body.name);
    const wechatId = text(body.wechatId);
    if (!name || !wechatId) {
      return json({ error: "来源名称和账号/链接必填" }, { status: 400 });
    }
    const source = await saveSource(env, normalizeSource({
      ...body,
      id: `${slug(body.sourceType === "视频号" ? "视频号" : "公众号")}-${slug(wechatId || name)}-${Date.now()}`,
      name,
      wechatId,
      tags: normalizeTags(body.tags),
    }));
    return json({ source }, { status: 201 });
  }
  const syncMatch = path.match(/^\/api\/sources\/([^/]+)\/sync$/);
  if (syncMatch && request.method === "GET") {
    const source = await getSource(env, decodeURIComponent(syncMatch[1]));
    return source ? json({ source, status: source.syncStatus || "idle", imported: 0, message: source.syncMessage || "" }) : json({ error: "来源不存在", code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }
  if (syncMatch && request.method === "POST") {
    const sourceId = decodeURIComponent(syncMatch[1]);
    const source = await getSource(env, sourceId);
    if (!source) {
      return json({ error: "来源不存在", code: "SOURCE_NOT_FOUND" }, { status: 404 });
    }
    ctx.waitUntil(syncSource(env, sourceId));
    const syncingSource = await saveSource(env, { ...source, syncStatus: "syncing", syncMessage: "同步中，原站限流时会自动等待后继续。" });
    return json({ source: syncingSource, status: "syncing", imported: 0, message: syncingSource.syncMessage }, { status: 202 });
  }

  return json({ error: "接口不存在", code: "NOT_FOUND" }, { status: 404 });
}

async function serveAsset(request: Request, env: Env) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) {
    return response;
  }
  const indexUrl = new URL("/index.html", request.url);
  return env.ASSETS.fetch(new Request(indexUrl, request));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, ctx);
      }
      return await serveAsset(request, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "服务端错误";
      return json({ error: message, code: "SERVER_ERROR" }, { status: 500 });
    }
  },
};
