import * as cheerio from "cheerio";
import { normalizeItem, normalizeTags, text } from "./dataStore.mjs";

const XIANJIAN_SITEMAP_URL = "https://ai.xianjianwendao.com/kb/sitemap.xml";
const XIANJIAN_IMPORT_LIMIT = Number(process.env.XIANJIAN_IMPORT_LIMIT || 0);
const XIANJIAN_DETAIL_CONCURRENCY = Math.max(1, Number(process.env.XIANJIAN_DETAIL_CONCURRENCY || 8));
const XIANJIAN_DETAIL_RETRIES = Math.max(1, Number(process.env.XIANJIAN_DETAIL_RETRIES || 3));

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(values.length, Math.max(1, Number(concurrency) || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(values[currentIndex], currentIndex);
      }
    }),
  );
  return results;
}

function retryAfterMs(response, fallbackMs) {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) ? Math.max(0, retryAfter * 1000) : fallbackMs;
}

function mergeSourceTags(source, tags) {
  return unique([...tags, ...normalizeTags(source?.tags)]);
}

function parseJsonLdArticle($) {
  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      const parsed = JSON.parse($(element).text());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const article = candidates.find((item) => item?.["@type"] === "Article") || candidates[0];
      if (article) {
        return article;
      }
    } catch {
      // Ignore malformed structured data and fall back to page text.
    }
  }
  return {};
}

function parseXianjianDate(value) {
  const raw = text(value);
  const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (isoLike) {
    return `${isoLike[1]} ${isoLike[2]}`;
  }
  const plain = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (plain) {
    return `${plain[1]} ${plain[2]}`;
  }
  return parseDate(raw);
}

function xianjianIdFromUrl(url) {
  const match = text(url).match(/\/kb\/item\/(\d+)/);
  return match ? `xianjian-${match[1]}` : "";
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
      const enclosure = node.find("enclosure[type^='video']").first();
      const mediaContent = node.find("media\\:content[medium='video'], content[medium='video']").first();
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
          videoUrl: enclosure.attr("url") || mediaContent.attr("url"),
          coverUrl: node.find("media\\:thumbnail, thumbnail").first().attr("url"),
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
        videoUrl: item.videoUrl || item.video_url || item.video?.url || item.mediaUrl,
        embedUrl: item.embedUrl || item.embed_url || item.playerUrl,
        coverUrl: item.coverUrl || item.cover_url || item.poster || item.image,
        duration: item.duration,
      },
      source,
    ),
  );
}

export function parseXianjianSitemap(sitemapText, limit = XIANJIAN_IMPORT_LIMIT) {
  const $ = cheerio.load(sitemapText, { xmlMode: true });
  const urls = unique(
    $("loc")
      .toArray()
      .map((element) => $(element).text())
      .filter((url) => /\/kb\/item\/\d+/.test(url)),
  );
  const parsedLimit = Number(limit);
  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? urls.slice(0, parsedLimit) : urls;
}

export function parseXianjianDetail(html, source, detailUrl) {
  const $ = cheerio.load(html);
  const article = parseJsonLdArticle($);
  const tags = mergeSourceTags(
    source,
    $("#tags-region span")
      .toArray()
      .map((element) => $(element).text())
      .filter((tag) => text(tag) !== "标签"),
  );
  const summaryHtml = text($(".kb-sum").first().html() || article.description || $("meta[name='description']").attr("content"));
  const originalUrl = text($("article a[href*='mp.weixin.qq.com/s/']").first().attr("href") || $("a[href*='mp.weixin.qq.com/s/']").first().attr("href"));
  const metaSpans = $("article .flex.items-center span").toArray();

  return normalizeItem(
    {
      id: xianjianIdFromUrl(detailUrl),
      title: article.headline || $("h1").first().text(),
      summary: article.description || $(".kb-lead").first().text() || $("meta[name='description']").attr("content"),
      summaryHtml,
      contentHtml: summaryHtml,
      date: parseXianjianDate(article.datePublished || $(metaSpans[3]).text()),
      tags,
      tag: tags[0],
      originalUrl,
      detailUrl,
      source: article.author?.name || $(metaSpans[1]).text() || source?.name,
      kind: $(metaSpans[0]).text() || source?.sourceType || "公众号",
      provider: "xianjian",
    },
    source,
  );
}

async function fetchXianjianDetail(detailUrl, source) {
  for (let attempt = 1; attempt <= XIANJIAN_DETAIL_RETRIES; attempt += 1) {
    try {
      const detailResponse = await fetch(detailUrl, {
        headers: { "User-Agent": "IntelHub/0.1 (+https://intel-hub-production-9449.up.railway.app)" },
      });
      if (detailResponse.status === 429 && attempt < XIANJIAN_DETAIL_RETRIES) {
        await sleep(retryAfterMs(detailResponse, attempt * 1000));
        continue;
      }
      if (!detailResponse.ok) {
        return null;
      }
      return parseXianjianDetail(await detailResponse.text(), source, detailUrl);
    } catch {
      if (attempt >= XIANJIAN_DETAIL_RETRIES) {
        return null;
      }
      await sleep(attempt * 1000);
    }
  }
  return null;
}

export async function fetchSourceItems(source, options = {}) {
  if (source.provider === "manual") {
    return [];
  }

  if (source.provider === "xianjian") {
    const sitemapResponse = await fetch(source.feedUrl || XIANJIAN_SITEMAP_URL, {
      headers: { "User-Agent": "IntelHub/0.1 (+https://intel-hub-production-9449.up.railway.app)" },
    });
    if (!sitemapResponse.ok) {
      throw providerError(`公开索引请求失败：${sitemapResponse.status}`, sitemapResponse.status, "PROVIDER_FETCH_FAILED");
    }
    const skipItemIds = options.skipItemIds || new Set();
    const detailUrls = parseXianjianSitemap(await sitemapResponse.text()).filter((detailUrl) => !skipItemIds.has(xianjianIdFromUrl(detailUrl)));
    const details = await mapWithConcurrency(
      detailUrls,
      XIANJIAN_DETAIL_CONCURRENCY,
      async (detailUrl) => fetchXianjianDetail(detailUrl, source),
    );
    return details.filter(Boolean);
  }

  if (source.provider === "feed" || source.provider === "json") {
    if (!source.feedUrl) {
      throw providerError(`${source.name} 缺少 feedUrl，无法同步。`);
    }
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
