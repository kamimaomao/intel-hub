import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedItems, parseJsonItems } from "../server/sourceSync.mjs";

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
