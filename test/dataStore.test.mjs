import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { countItems, createDataStore, filterItems, normalizeItem, normalizeSource, upsertItems } from "../server/dataStore.mjs";

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
    wechatId: "sphqRMmfwGMaARO",
    provider: "feed",
    externalId: "sphqRMmfwGMaARO",
    feedUrl: "https://example.com/feed.xml",
    tags: "视频号,买量素材",
  });

  assert.equal(source.provider, "feed");
  assert.equal(source.externalId, "sphqRMmfwGMaARO");
  assert.equal(source.feedUrl, "https://example.com/feed.xml");
  assert.deepEqual(source.tags, ["视频号", "买量素材"]);
});

test("normalizeItem keeps playable video metadata", () => {
  const item = normalizeItem(
    {
      id: "video-1",
      title: "新游观察视频",
      summary: "视频摘要",
      videoUrl: "https://cdn.example.com/video.mp4",
      embedUrl: "https://player.example.com/video-1",
      coverUrl: "https://cdn.example.com/cover.jpg",
      duration: "01:23",
      tags: ["视频号"],
    },
    { id: "video-xinyouguancha", name: "新游观察", sourceType: "视频号", provider: "json" },
  );

  assert.equal(item.kind, "视频号");
  assert.equal(item.videoUrl, "https://cdn.example.com/video.mp4");
  assert.equal(item.embedUrl, "https://player.example.com/video-1");
  assert.equal(item.coverUrl, "https://cdn.example.com/cover.jpg");
  assert.equal(item.duration, "01:23");
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

test("addSource updates an existing source with the same type and name", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "intel-hub-store-"));
  const dataFile = path.join(dir, "intel-hub.json");

  try {
    const store = createDataStore({
      dataFile,
      seedSources: [
        {
          id: "video-xinyouguancha",
          sourceType: "视频号",
          name: "新游观察",
          wechatId: "sphqRMmfwGMaAR0",
          externalId: "sphqRMmfwGMaAR0",
        },
      ],
    });

    const source = await store.addSource({
      sourceType: "视频号",
      name: "新游观察",
      wechatId: "sphqRMmfwGMaARO",
      externalId: "sphqRMmfwGMaARO",
      description: "IP归属地：北京；认证信息：游戏自媒体；主体类型：个人。",
      tags: ["视频号", "新游观察", "AI与游戏"],
    });
    const data = await store.readData();

    assert.equal(source.id, "video-xinyouguancha");
    assert.equal(data.sources.filter((item) => item.name === "新游观察").length, 1);
    assert.equal(data.sources.find((item) => item.name === "新游观察")?.externalId, "sphqRMmfwGMaARO");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

test("countItems returns real totals by tag", () => {
  const counts = countItems([
    baseItems[0],
    { ...baseItems[0], id: "a2", tags: ["AI与游戏", "发行·买量数据与素材"], tag: "AI与游戏" },
    baseItems[1],
  ]);

  assert.equal(counts.total, 3);
  assert.equal(counts.tags["AI与游戏"], 2);
  assert.equal(counts.tags["发行·买量数据与素材"], 1);
  assert.equal(counts.tags["买量素材"], 1);
});

test("countItems returns deduplicated totals for tag sets", () => {
  const counts = countItems(
    [
      { ...baseItems[0], tags: ["SLG", "买量素材"], tag: "AI与游戏" },
      { ...baseItems[1], tags: ["SLG"], tag: "小游戏" },
      { ...baseItems[1], id: "v2", tags: ["公众号"], tag: "其他" },
    ],
    { "玩法 / 主题": ["SLG", "买量素材"] },
  );

  assert.equal(counts.tags.SLG, 2);
  assert.equal(counts.tags["买量素材"], 1);
  assert.equal(counts.sets["玩法 / 主题"], 2);
});

test("createDataStore does not reset an existing data file when JSON parsing fails", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "intel-hub-store-"));
  const dataFile = path.join(dir, "intel-hub.json");
  const brokenJson = `{"sources":[`;
  await writeFile(dataFile, brokenJson, "utf8");

  try {
    const store = createDataStore({ dataFile, seedSources: [{ name: "Seed", wechatId: "seed" }] });

    await assert.rejects(() => store.readData(), SyntaxError);
    assert.equal(await readFile(dataFile, "utf8"), brokenJson);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
