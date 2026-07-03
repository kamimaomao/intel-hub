import assert from "node:assert/strict";
import test from "node:test";
import { fetchSourceItems, parseFeedItems, parseJsonItems, parseXianjianDetail, parseXianjianSitemap } from "../server/sourceSync.mjs";

const source = {
  id: "source-gamelook",
  name: "GameLook",
  sourceType: "公众号",
  provider: "feed",
  tags: ["行业情报"],
};

test("parseFeedItems converts RSS items into local intel items", () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>AI 游戏工具链观察</title>
      <link>https://example.com/rss-1</link>
      <description>RSS 摘要内容</description>
      <pubDate>Thu, 02 Jul 2026 09:00:00 GMT</pubDate>
      <category>AI与游戏</category>
    </item>
  </channel></rss>`;

  const items = parseFeedItems(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "AI 游戏工具链观察");
  assert.equal(items[0].source, "GameLook");
  assert.equal(items[0].kind, "公众号");
  assert.deepEqual(items[0].tags, ["AI与游戏", "行业情报"]);
});

test("parseJsonItems accepts common provider list shapes", () => {
  const items = parseJsonItems(
    {
      items: [
        {
          id: "json-1",
          title: "视频号素材拆解",
          summary: "JSON 来源摘要",
          url: "https://example.com/json-1",
          publishedAt: "2026-07-02 18:00",
          tags: ["视频号"],
        },
      ],
    },
    { ...source, name: "新游观察", sourceType: "视频号", provider: "json" },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "json-1");
  assert.equal(items[0].kind, "视频号");
  assert.equal(items[0].source, "新游观察");
  assert.equal(items[0].originalUrl, "https://example.com/json-1");
});

test("parseJsonItems accepts playable video fields", () => {
  const items = parseJsonItems(
    {
      data: [
        {
          id: "wxvideo-1",
          title: "视频号素材拆解",
          desc: "视频摘要",
          video_url: "https://cdn.example.com/wxvideo-1.mp4",
          cover_url: "https://cdn.example.com/wxvideo-1.jpg",
          duration: "00:42",
          link: "https://channels.weixin.qq.com/feed/wxvideo-1",
        },
      ],
    },
    { ...source, name: "新游观察", sourceType: "视频号", provider: "json", tags: ["视频号"] },
  );

  assert.equal(items[0].kind, "视频号");
  assert.equal(items[0].videoUrl, "https://cdn.example.com/wxvideo-1.mp4");
  assert.equal(items[0].coverUrl, "https://cdn.example.com/wxvideo-1.jpg");
  assert.equal(items[0].duration, "00:42");
});

test("parseXianjianSitemap extracts newest public item URLs", () => {
  const urls = parseXianjianSitemap(
    `<?xml version="1.0"?><urlset>
      <url><loc>https://ai.xianjianwendao.com/kb/item/6074</loc></url>
      <url><loc>https://ai.xianjianwendao.com/kb/item/6073</loc></url>
      <url><loc>https://ai.xianjianwendao.com/kb/items</loc></url>
    </urlset>`,
    1,
  );

  assert.deepEqual(urls, ["https://ai.xianjianwendao.com/kb/item/6074"]);
});

test("parseXianjianSitemap default import is uncapped", () => {
  const sitemap = `<?xml version="1.0"?><urlset>${Array.from(
    { length: 550 },
    (_, index) => `<url><loc>https://ai.xianjianwendao.com/kb/item/${7000 + index}</loc></url>`,
  ).join("")}</urlset>`;

  const urls = parseXianjianSitemap(sitemap);

  assert.equal(urls.length, 550);
});

test("parseXianjianDetail converts public detail HTML into a local item", () => {
  const html = `<!doctype html><html><head>
    <meta property="og:image" content="https://example.com/cover.jpg">
    <script type="application/ld+json">{"@type":"Article","headline":"AI 游戏夜话","description":"公开详情摘要","mainEntityOfPage":"https://ai.xianjianwendao.com/kb/item/6073","datePublished":"2026-07-02T12:02:00+08:00","author":{"name":"腾讯游戏学堂"}}</script>
    </head><body><article>
      <div><span>公众号</span><span>腾讯游戏学堂</span><span>·</span><span>2026-07-02 12:02</span></div>
      <div class="kb-sum"><div class="kb-lead">公开详情摘要</div><div>完整摘要正文</div></div>
      <div id="tags-region"><span>标签</span><span>AI与游戏</span><span>AI工具</span></div>
      <a href="https://mp.weixin.qq.com/s/test">查看原文 ↗</a>
    </article></body></html>`;

  const item = parseXianjianDetail(html, { ...source, id: "source-xianjian", provider: "xianjian" }, "https://ai.xianjianwendao.com/kb/item/6073");

  assert.equal(item.id, "xianjian-6073");
  assert.equal(item.title, "AI 游戏夜话");
  assert.equal(item.source, "腾讯游戏学堂");
  assert.equal(item.date, "2026-07-02 12:02");
  assert.equal(item.originalUrl, "https://mp.weixin.qq.com/s/test");
  assert.deepEqual(item.tags, ["AI与游戏", "AI工具", "行业情报"]);
});

test("fetchSourceItems imports public Xianjian sitemap details without private API access", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/kb/sitemap.xml")) {
      return new Response(`<urlset><url><loc>https://ai.xianjianwendao.com/kb/item/6073</loc></url></urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }
    if (value.endsWith("/kb/item/6073")) {
      return new Response(`<!doctype html><script type="application/ld+json">{"headline":"公开详情","description":"摘要","datePublished":"2026-07-02T12:02:00+08:00","author":{"name":"GameLook"}}</script><div id="tags-region"><span>标签</span><span>AI与游戏</span></div><a href="https://mp.weixin.qq.com/s/test">查看原文</a>`);
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const items = await fetchSourceItems({
      ...source,
      id: "source-xianjian",
      provider: "xianjian",
      feedUrl: "https://ai.xianjianwendao.com/kb/sitemap.xml",
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "公开详情");
    assert.equal(items[0].provider, "xianjian");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchSourceItems imports every Xianjian detail without opening every request at once", async () => {
  const originalFetch = globalThis.fetch;
  let activeDetails = 0;
  let maxActiveDetails = 0;
  const detailUrls = Array.from({ length: 12 }, (_, index) => `https://ai.xianjianwendao.com/kb/item/${8000 + index}`);

  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/kb/sitemap.xml")) {
      return new Response(`<urlset>${detailUrls.map((detailUrl) => `<url><loc>${detailUrl}</loc></url>`).join("")}</urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }
    if (detailUrls.includes(value)) {
      activeDetails += 1;
      maxActiveDetails = Math.max(maxActiveDetails, activeDetails);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeDetails -= 1;
      const id = value.match(/(\d+)$/)?.[1];
      return new Response(`<!doctype html><script type="application/ld+json">{"headline":"公开详情 ${id}","description":"摘要","datePublished":"2026-07-02T12:02:00+08:00","author":{"name":"GameLook"}}</script><div id="tags-region"><span>标签</span><span>AI与游戏</span></div><a href="https://mp.weixin.qq.com/s/${id}">查看原文</a>`);
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const items = await fetchSourceItems({
      ...source,
      id: "source-xianjian",
      provider: "xianjian",
      feedUrl: "https://ai.xianjianwendao.com/kb/sitemap.xml",
    });

    assert.equal(items.length, detailUrls.length);
    assert.equal(maxActiveDetails <= 8, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchSourceItems retries Xianjian detail pages after rate limiting", async () => {
  const originalFetch = globalThis.fetch;
  let detailAttempts = 0;

  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/kb/sitemap.xml")) {
      return new Response(`<urlset><url><loc>https://ai.xianjianwendao.com/kb/item/9001</loc></url></urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }
    if (value.endsWith("/kb/item/9001")) {
      detailAttempts += 1;
      if (detailAttempts === 1) {
        return new Response(`{"error":"rate_limited"}`, { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(`<!doctype html><script type="application/ld+json">{"headline":"限流后成功","description":"摘要","datePublished":"2026-07-02T12:02:00+08:00","author":{"name":"GameLook"}}</script><div id="tags-region"><span>标签</span><span>AI与游戏</span></div><a href="https://mp.weixin.qq.com/s/9001">查看原文</a>`);
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const items = await fetchSourceItems({
      ...source,
      id: "source-xianjian",
      provider: "xianjian",
      feedUrl: "https://ai.xianjianwendao.com/kb/sitemap.xml",
    });

    assert.equal(detailAttempts, 2);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "限流后成功");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchSourceItems skips Xianjian items that already exist locally", async () => {
  const originalFetch = globalThis.fetch;
  const fetchedUrls = [];

  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/kb/sitemap.xml")) {
      return new Response(
        `<urlset>
          <url><loc>https://ai.xianjianwendao.com/kb/item/9101</loc></url>
          <url><loc>https://ai.xianjianwendao.com/kb/item/9102</loc></url>
        </urlset>`,
        { headers: { "content-type": "application/xml" } },
      );
    }
    fetchedUrls.push(value);
    return new Response(`<!doctype html><script type="application/ld+json">{"headline":"新增详情","description":"摘要","datePublished":"2026-07-02T12:02:00+08:00","author":{"name":"GameLook"}}</script><div id="tags-region"><span>标签</span><span>AI与游戏</span></div><a href="https://mp.weixin.qq.com/s/new">查看原文</a>`);
  };

  try {
    const items = await fetchSourceItems(
      {
        ...source,
        id: "source-xianjian",
        provider: "xianjian",
        feedUrl: "https://ai.xianjianwendao.com/kb/sitemap.xml",
      },
      { skipItemIds: new Set(["xianjian-9101"]) },
    );

    assert.equal(items.length, 1);
    assert.deepEqual(fetchedUrls, ["https://ai.xianjianwendao.com/kb/item/9102"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
