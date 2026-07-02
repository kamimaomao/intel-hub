import assert from "node:assert/strict";
import test from "node:test";
import { filterItems, normalizeSource, upsertItems } from "../server/dataStore.mjs";

const baseItems = [
  {
    id: "a1",
    title: "AI 关卡生成进入预研",
    summary: "工具链先在原型阶段落地。",
    source: "GameLook",
    kind: "公众号",
    tag: "AI与游戏",
    tags: ["AI与游戏", "研发"],
    date: "2026-07-02 10:00",
    signals: ["AI工具"],
    originalUrl: "https://example.com/a1",
  },
  {
    id: "v1",
    title: "新游观察：今日小游戏买量素材",
    summary: "视频号发布的素材观察。",
    source: "新游观察",
    kind: "视频号",
    tag: "买量素材",
    tags: ["视频号", "买量素材"],
    date: "2026-07-01 08:00",
    signals: [],
    originalUrl: "https://example.com/v1",
  },
];

test("filterItems filters the local item store by tag, source, and query", () => {
  assert.deepEqual(
    filterItems(baseItems, { tag: "AI与游戏", q: "", author: "" }).map((item) => item.id),
    ["a1"],
  );
  assert.deepEqual(
    filterItems(baseItems, { tag: "全部", q: "", author: "新游观察" }).map((item) => item.id),
    ["v1"],
  );
  assert.deepEqual(
    filterItems(baseItems, { tag: "全部", q: "素材", author: "" }).map((item) => item.id),
    ["v1"],
  );
});

test("normalizeSource stores provider fields for self-owned connectors", () => {
  const source = normalizeSource({
    name: "新游观察",
    sourceType: "视频号",
    wechatId: "sphqRMmfwGMaAR0",
    provider: "feed",
    externalId: "sphqRMmfwGMaAR0",
    feedUrl: "https://example.com/feed.xml",
    tags: "视频号,买量素材",
  });

  assert.equal(source.provider, "feed");
  assert.equal(source.externalId, "sphqRMmfwGMaAR0");
  assert.equal(source.feedUrl, "https://example.com/feed.xml");
  assert.deepEqual(source.tags, ["视频号", "买量素材"]);
});

test("normalizeSource keeps the public Xianjian sitemap provider", () => {
  const source = normalizeSource({
    name: "游戏研究所pro公开索引",
    wechatId: "xianjian-public",
    provider: "xianjian",
    feedUrl: "https://ai.xianjianwendao.com/kb/sitemap.xml",
  });

  assert.equal(source.provider, "xianjian");
  assert.equal(source.feedUrl, "https://ai.xianjianwendao.com/kb/sitemap.xml");
});

test("upsertItems merges imported items by id and keeps newest first", () => {
  const next = upsertItems(baseItems, [
    { ...baseItems[0], title: "AI 关卡生成更新版", date: "2026-07-03 10:00" },
    {
      id: "a2",
      title: "新来源文章",
      summary: "",
      source: "GameLook",
      kind: "公众号",
      tag: "AI与游戏",
      tags: ["AI与游戏"],
      date: "2026-07-04 09:00",
      signals: [],
      originalUrl: "https://example.com/a2",
    },
  ]);

  assert.deepEqual(next.map((item) => item.id), ["a2", "a1", "v1"]);
  assert.equal(next.find((item) => item.id === "a1")?.title, "AI 关卡生成更新版");
});
