import * as cheerio from "cheerio";

const originBase = process.env.XIANJIAN_BASE_URL || "https://ai.xianjianwendao.com";
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let originCookie = "";
let originUser = process.env.XIANJIAN_USERNAME || "";
let originPassword = process.env.XIANJIAN_PASSWORD || "";

function originError(message, status = 502, code = "ORIGIN_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function text(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;]+?=)/) : [];
}

function mergeCookies(headers) {
  const next = new Map(
    originCookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), part.slice(index + 1)];
      }),
  );

  for (const header of getSetCookies(headers)) {
    const [pair] = header.split(";");
    const index = pair.indexOf("=");
    if (index > 0) {
      next.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
  originCookie = [...next.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function isLoginPage(html, url = "") {
  return url.includes("/kb/login") || (html.includes('name="username"') && html.includes('name="password"'));
}

async function rawOriginFetch(pathname, options = {}) {
  const url = new URL(pathname, originBase);
  const response = await fetch(url, {
    redirect: "follow",
    ...options,
    headers: {
      "User-Agent": userAgent,
      Cookie: originCookie,
      ...(options.headers || {}),
    },
  });
  mergeCookies(response.headers);
  const html = await response.text();
  if (!response.ok && (response.status < 300 || response.status >= 400)) {
    throw originError(`原站请求失败：${response.status}`, response.status);
  }
  return { html, url: response.url, status: response.status, location: response.headers.get("location") };
}

export async function loginOrigin(username, password) {
  const nextUser = text(username) || originUser;
  const nextPassword = String(password || originPassword || "");
  if (!nextUser || !nextPassword) {
    throw originError("需要原站账号密码：请在服务端配置 XIANJIAN_USERNAME / XIANJIAN_PASSWORD。", 401, "ORIGIN_AUTH_REQUIRED");
  }

  originCookie = "";
  const body = new URLSearchParams({ username: nextUser, password: nextPassword });
  const result = await rawOriginFetch("/kb/login", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const verified = result.location ? await rawOriginFetch(result.location) : result;
  if (isLoginPage(verified.html, verified.url)) {
    originCookie = "";
    throw originError("原站登录失败，请检查账号密码。", 401, "ORIGIN_AUTH_FAILED");
  }
  originUser = nextUser;
  originPassword = nextPassword;
  return true;
}

async function ensureOriginSession() {
  if (originCookie) {
    return;
  }
  await loginOrigin(originUser, originPassword);
}

async function fetchOriginHtml(pathname, retry = true) {
  await ensureOriginSession();
  const result = await rawOriginFetch(pathname);
  if (retry && isLoginPage(result.html, result.url)) {
    originCookie = "";
    await ensureOriginSession();
    return fetchOriginHtml(pathname, false);
  }
  if (isLoginPage(result.html, result.url)) {
    throw originError("原站登录态已失效，请检查服务端原站账号密码配置。", 401, "ORIGIN_AUTH_REQUIRED");
  }
  return result.html;
}

function cleanHtml($, node) {
  const clone = node.clone();
  clone.find("script, style, iframe, form, input, button").remove();
  clone.find("*").each((_, element) => {
    for (const name of Object.keys(element.attribs || {})) {
      if (name.startsWith("on") || name.startsWith("hx-") || name === "id") {
        delete element.attribs[name];
      }
    }
    const tag = element.tagName?.toLowerCase();
    if (tag === "a") {
      const href = element.attribs.href || "";
      if (!href.startsWith("http") && !href.startsWith("/")) {
        delete element.attribs.href;
      }
      element.attribs.target = "_blank";
      element.attribs.rel = "noopener noreferrer nofollow";
    }
    if (tag === "img") {
      element.attribs.loading = "lazy";
      element.attribs.referrerpolicy = "no-referrer";
    }
  });
  return clone.html() || "";
}

function parseTotal($) {
  const totalText = $("main span")
    .toArray()
    .map((element) => text($(element).text()))
    .find((value) => /^\d+\s*篇$/.test(value));
  return totalText ? Number(totalText.replace(/\D/g, "")) : 0;
}

function parseListItem($, element, activeTag) {
  const card = $(element);
  const href = card.attr("href") || "";
  const id = href.match(/\/kb\/item\/([^/?#]+)/)?.[1] || "";
  const meta = card
    .children("div")
    .first()
    .find("span")
    .toArray()
    .map((span) => text($(span).text()))
    .filter(Boolean);
  const kind = meta[0] || "公众号";
  const source = meta[1] || "";
  const date = meta[3] || meta.at(-1) || "";
  const tags = card.find(".card-tags span").toArray().map((tag) => text($(tag).text())).filter(Boolean);
  const summaryNode = card.find(".card-summary").first();
  const signals = summaryNode
    .find("div")
    .eq(1)
    .find("span")
    .toArray()
    .map((signal) => text($(signal).text()))
    .filter(Boolean);
  const summary = text(summaryNode.find(".kb-body").text() || summaryNode.find(".kb-lead").text() || summaryNode.text());

  return {
    id,
    title: text(card.find(".kb-title").first().text()),
    summary,
    summaryHtml: cleanHtml($, summaryNode),
    source,
    kind,
    tag: activeTag || tags[0] || "全部",
    tags,
    date,
    signals,
    originalUrl: card.find(".kb-src").first().attr("data-url") || "",
    detailUrl: `${originBase}${href}`,
  };
}

export function parseItemsPage(html, activeTag = "全部") {
  const $ = cheerio.load(html);
  const items = $(".kb-card")
    .toArray()
    .map((element) => parseListItem($, element, activeTag))
    .filter((item) => item.id && item.title);
  return { items, total: parseTotal($) || items.length };
}

export function parseItemPage(html, id) {
  const $ = cheerio.load(html);
  const article = $("article").first();
  const meta = article
    .children("div")
    .first()
    .find("span")
    .toArray()
    .map((span) => text($(span).text()))
    .filter(Boolean);
  const summaryNode = article.find('[class*="bg-slate-50"]').first();
  const contentNode = article.find(".prose-kb").first();
  const tags = $("#tags-region .inline-flex")
    .toArray()
    .map((tag) => text($(tag).text()))
    .filter(Boolean);

  return {
    id,
    title: text(article.find("h1").first().text()),
    summary: text(summaryNode.text()),
    summaryHtml: cleanHtml($, summaryNode),
    source: meta[1] || "",
    kind: meta[0] || "公众号",
    date: meta[3] || meta.at(-1) || "",
    tags,
    originalUrl: article.find('a[href^="https://mp.weixin.qq.com/"]').first().attr("href") || "",
    detailUrl: `${originBase}/kb/item/${id}`,
    contentHtml: cleanHtml($, contentNode),
  };
}

export async function fetchOriginItems({ tag = "全部", q = "", author = "" } = {}) {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (author) {
    params.set("author", author);
  } else if (tag && tag !== "全部") {
    params.set("tag", tag);
  }
  const html = await fetchOriginHtml(`/kb/items${params.toString() ? `?${params}` : ""}`);
  return parseItemsPage(html, tag);
}

export async function fetchOriginItem(id) {
  const cleanId = text(id);
  if (!/^\d+$/.test(cleanId)) {
    throw originError("文章 ID 不合法。", 400, "BAD_ITEM_ID");
  }
  const html = await fetchOriginHtml(`/kb/item/${cleanId}`);
  const item = parseItemPage(html, cleanId);
  if (!item.title) {
    throw originError("原站没有返回文章内容。", 404, "ITEM_NOT_FOUND");
  }
  return item;
}
