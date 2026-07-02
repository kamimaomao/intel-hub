import * as cheerio from "cheerio";
import { normalizeItem, normalizeTags, text } from "./dataStore.mjs";

function unique(values) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function providerError(message, status = 422, code = "PROVIDER_NOT_CONFIGURED") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function mergeSourceTags(source, tags) {
  return unique([...tags, ...normalizeTags(source?.tags)]);
}

export function parseFeedItems(feedText, source) {
  const $ = cheerio.load(feedText, { xmlMode: true });
  const rssItems = $("item")
    .toArray()
    .map((element) => {
      const node = $(element);
      const tags = mergeSourceTags(
        source,
        node
          .find("category")
          .toArray()
          .map((category) => $(category).text()),
      );
      const originalUrl = text(node.find("link").first().text());
      return normalizeItem(
        {
          id: text(node.find("guid").first().text()) || originalUrl,
          title: node.find("title").first().text(),
          summary: node.find("description").first().text(),
          contentHtml: node.find("content\\:encoded").first().text() || node.find("description").first().text(),
          date: parseDate(node.find("pubDate").first().text()),
          tags,
          tag: tags[0],
          originalUrl,
        },
        source,
      );
    });

  if (rssItems.length > 0) {
    return rssItems;
  }

  return $("entry")
    .toArray()
    .map((element) => {
      const node = $(element);
      const tags = mergeSourceTags(
        source,
        node
          .find("category")
          .toArray()
          .map((category) => $(category).attr("term") || $(category).text()),
      );
      const originalUrl = text(node.find("link[rel='alternate']").attr("href") || node.find("link").first().attr("href"));
      return normalizeItem(
        {
          id: text(node.find("id").first().text()) || originalUrl,
          title: node.find("title").first().text(),
          summary: node.find("summary").first().text() || node.find("content").first().text(),
          contentHtml: node.find("content").first().text() || node.find("summary").first().text(),
          date: parseDate(node.find("published").first().text() || node.find("updated").first().text()),
          tags,
          tag: tags[0],
          originalUrl,
        },
        source,
      );
    });
}

export function parseJsonItems(payload, source) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.entries || payload?.data?.items || payload?.data?.list || payload?.data || [];

  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((item) =>
    normalizeItem(
      {
        id: item.id || item.uuid || item.url,
        title: item.title || item.name,
        summary: item.summary || item.description || item.desc || item.excerpt,
        contentHtml: item.contentHtml || item.content || item.html || item.summary,
        date: item.date || item.publishedAt || item.pubDate || item.createTime || item.createdAt,
        tags: mergeSourceTags(source, normalizeTags(item.tags || item.category)),
        originalUrl: item.originalUrl || item.url || item.link,
        detailUrl: item.detailUrl || item.url || item.link,
      },
      source,
    ),
  );
}

export async function fetchSourceItems(source) {
  if (source.provider === "manual") {
    return [];
  }

  if (!source.feedUrl) {
    throw providerError(`${source.name} 缺少 feedUrl，无法同步。`);
  }

  if (source.provider === "feed" || source.provider === "json") {
    const response = await fetch(source.feedUrl, {
      headers: { "User-Agent": "IntelHub/0.1 (+https://intel-hub-production-9449.up.railway.app)" },
    });
    if (!response.ok) {
      throw providerError(`数据源请求失败：${response.status}`, response.status, "PROVIDER_FETCH_FAILED");
    }
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "";
    if (source.provider === "json" || contentType.includes("json") || /^[\s\n]*[\[{]/.test(body)) {
      return parseJsonItems(JSON.parse(body), source);
    }
    return parseFeedItems(body, source);
  }

  throw providerError(`${source.provider} 需要接入可用的第三方账号、Cookie 或 API Key。`);
}
