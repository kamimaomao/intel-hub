import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const validProviders = new Set(["manual", "feed", "json", "xianjian", "wechat", "newrank"]);

export function text(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => text(tag)).filter(Boolean);
  }
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^\p{Script=Han}\w-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function stableId(parts) {
  return createHash("sha1").update(parts.map(text).join("|")).digest("hex").slice(0, 16);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeSource(source) {
  const sourceType = source?.sourceType === "视频号" ? "视频号" : "公众号";
  const name = text(source?.name);
  const wechatId = text(source?.wechatId || source?.externalId || name);
  const feedUrl = text(source?.feedUrl);
  const provider = validProviders.has(source?.provider) ? source.provider : feedUrl ? "feed" : "manual";
  const externalId = text(source?.externalId || wechatId || name);
  const id = text(source?.id) || `${slug(sourceType)}-${slug(externalId || name)}-${Date.now()}`;

  return {
    id,
    sourceType,
    name,
    wechatId,
    provider,
    externalId,
    feedUrl,
    description: text(source?.description),
    tags: normalizeTags(source?.tags),
    status: source?.status === "停用" ? "停用" : "启用",
    createdAt: text(source?.createdAt) || today(),
    originalCount: Number(source?.originalCount) || undefined,
    lastSyncAt: text(source?.lastSyncAt),
    syncStatus: text(source?.syncStatus) || "idle",
    syncMessage: text(source?.syncMessage),
  };
}

export function normalizeItem(item, source) {
  const sourceName = text(item?.source || source?.name);
  const kind = text(item?.kind || source?.sourceType || "公众号");
  const tags = normalizeTags(item?.tags);
  const title = text(item?.title);
  const date = text(item?.date || item?.publishedAt || item?.createdAt);
  const originalUrl = text(item?.originalUrl || item?.url);
  const id = text(item?.id) || stableId([source?.id, sourceName, title, date, originalUrl]);
  const tag = text(item?.tag) || tags[0] || "全部";

  return {
    id,
    title,
    summary: text(item?.summary),
    source: sourceName,
    sourceId: text(item?.sourceId || source?.id),
    kind,
    tag,
    tags,
    date,
    signals: normalizeTags(item?.signals),
    originalUrl,
    detailUrl: text(item?.detailUrl || originalUrl),
    summaryHtml: text(item?.summaryHtml),
    contentHtml: text(item?.contentHtml || item?.summaryHtml || item?.summary),
    provider: text(item?.provider || source?.provider || "manual"),
  };
}

export function filterItems(items, { tag = "全部", q = "", author = "" } = {}) {
  const normalizedQuery = text(q).toLowerCase();
  const normalizedTag = text(tag || "全部");
  const normalizedAuthor = text(author);

  return [...items]
    .filter((item) => {
      const matchesAuthor = !normalizedAuthor || item.source === normalizedAuthor || item.sourceId === normalizedAuthor;
      const matchesTag =
        normalizedTag === "全部" || item.tag === normalizedTag || (Array.isArray(item.tags) && item.tags.includes(normalizedTag));
      const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${(item.tags || []).join(" ")} ${(item.signals || []).join(" ")}`.toLowerCase();
      return matchesAuthor && matchesTag && (!normalizedQuery || searchable.includes(normalizedQuery));
    })
    .sort((left, right) => text(right.date).localeCompare(text(left.date)));
}

export function countItems(items = []) {
  const tags = {};
  for (const item of items || []) {
    for (const tag of new Set([text(item?.tag), ...normalizeTags(item?.tags)])) {
      if (tag && tag !== "全部") {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }
  }
  return { total: Array.isArray(items) ? items.length : 0, tags };
}

export function upsertItems(currentItems, importedItems) {
  const merged = new Map();
  for (const item of currentItems || []) {
    merged.set(item.id, normalizeItem(item));
  }
  for (const item of importedItems || []) {
    const normalized = normalizeItem(item);
    if (normalized.id && normalized.title) {
      merged.set(normalized.id, normalized);
    }
  }
  return [...merged.values()].sort((left, right) => text(right.date).localeCompare(text(left.date)));
}

function normalizeData(raw, seedSources = []) {
  const seed = seedSources.map((source) => normalizeSource(source));
  const currentSources = Array.isArray(raw?.sources) ? raw.sources.map((source) => normalizeSource(source)).filter((source) => source.name) : [];
  const byName = new Map(currentSources.map((source) => [source.name, source]));
  for (const source of seed) {
    if (!byName.has(source.name)) {
      currentSources.push(source);
    }
  }
  return {
    sources: currentSources,
    items: Array.isArray(raw?.items) ? raw.items.map((item) => normalizeItem(item)).filter((item) => item.id && item.title) : [],
  };
}

export function createSeedData(seedSources = []) {
  return normalizeData({ sources: seedSources, items: [] }, []);
}

export function createDataStore({ dataFile, seedSources = [] }) {
  async function writeDataFile(data) {
    const tempFile = `${dataFile}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempFile, JSON.stringify(normalizeData(data, seedSources), null, 2), "utf8");
    await rename(tempFile, dataFile);
  }

  async function ensureDataFile() {
    await mkdir(path.dirname(dataFile), { recursive: true });
    try {
      await stat(dataFile);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      await writeDataFile(createSeedData(seedSources));
    }
  }

  async function readData() {
    await ensureDataFile();
    return normalizeData(JSON.parse(await readFile(dataFile, "utf8")), seedSources);
  }

  async function writeData(data) {
    await writeDataFile(data);
  }

  return {
    async readData() {
      return readData();
    },
    async listItems(filters) {
      const data = await readData();
      const items = filterItems(data.items, filters);
      return { items, total: items.length };
    },
    async getItem(id) {
      const data = await readData();
      return data.items.find((item) => item.id === text(id));
    },
    async addSource(sourceDraft) {
      const data = await readData();
      const source = normalizeSource(sourceDraft);
      data.sources.unshift(source);
      await writeData(data);
      return source;
    },
    async addItems(items, source) {
      const data = await readData();
      const normalizedItems = items.map((item) => normalizeItem(item, source));
      data.items = upsertItems(data.items, normalizedItems);
      await writeData(data);
      return normalizedItems;
    },
    async updateSource(sourceId, patch) {
      const data = await readData();
      const index = data.sources.findIndex((source) => source.id === sourceId);
      if (index === -1) {
        return null;
      }
      data.sources[index] = normalizeSource({ ...data.sources[index], ...patch });
      await writeData(data);
      return data.sources[index];
    },
  };
}
