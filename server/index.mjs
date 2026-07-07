import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countItems, createDataStore, normalizeTags, slug } from "./dataStore.mjs";
import {
  dailySyncKey,
  defaultDailySyncTime,
  defaultDailySyncTimeZone,
  isSyncableSource,
  runDailySourceSync,
  startDailySyncScheduler,
} from "./dailySync.mjs";
import { fetchSourceItems } from "./sourceSync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const originalSources = JSON.parse(readFileSync(path.join(rootDir, "src", "data", "originalSources.json"), "utf8"));
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const dataFile = path.join(dataDir, "intel-hub.json");
const port = Number(process.env.PORT || 8787);
const dataStore = createDataStore({ dataFile, seedSources: originalSources });
const syncJobs = new Map();
let dailySyncJob = null;
const dailySyncConfig = {
  enabled: process.env.AUTO_SYNC_ENABLED !== "0",
  time: process.env.AUTO_SYNC_TIME || defaultDailySyncTime,
  timeZone: process.env.AUTO_SYNC_TIMEZONE || defaultDailySyncTimeZone,
  intervalMs: Math.max(10_000, Number(process.env.AUTO_SYNC_CHECK_INTERVAL_MS || 60_000)),
};
const itemCountSets = {
  "发行": [
    "发行·买量数据与素材",
    "发行·行业大盘与新游",
    "发行·流水榜单与市场",
    "发行·立项选品与休闲发行",
    "发行·广告变现策略",
  ],
  "研发": [
    "研发·爆款拆解与系统复盘",
    "研发·策划与设计方法论",
    "研发·数值设计",
    "研发·研发技术与独立开发",
    "研发·小游戏立项",
  ],
  "出海": [
    "出海·出海资讯与策略",
    "出海·海外买量与素材",
    "出海·海外数据与榜单",
    "出海·短剧出海与分发",
  ],
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

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/items", async (request, response, next) => {
  try {
    const query = String(request.query.q || "").trim().toLowerCase();
    const tag = String(request.query.tag || "全部");
    const author = String(request.query.author || "").trim();
    const result = await dataStore.listItems({ tag, q: query, author });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/item/:id", async (request, response, next) => {
  try {
    const item = await dataStore.getItem(request.params.id);
    if (!item) {
      response.status(404).json({ error: "文章不存在", code: "ITEM_NOT_FOUND" });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

app.get("/api/item-counts", async (_request, response, next) => {
  try {
    const data = await dataStore.readData();
    response.json({ counts: countItems(data.items, itemCountSets) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", async (request, response, next) => {
  try {
    const data = await dataStore.readData();
    const payloadItems = Array.isArray(request.body?.items) ? request.body.items : [request.body];
    const sourceId = String(request.body?.sourceId || payloadItems[0]?.sourceId || "").trim();
    const sourceName = String(request.body?.source || payloadItems[0]?.source || "").trim();
    const source = data.sources.find((itemSource) => itemSource.id === sourceId || itemSource.name === sourceName);
    const items = await dataStore.addItems(payloadItems, source);
    response.status(201).json({ items, imported: items.length });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sources", async (_request, response, next) => {
  try {
    const data = await dataStore.readData();
    const counts = new Map();
    for (const item of data.items) {
      counts.set(item.source, (counts.get(item.source) || 0) + 1);
      if (item.sourceId) {
        counts.set(item.sourceId, (counts.get(item.sourceId) || 0) + 1);
      }
    }
    const sources = data.sources.map((source) => ({
      ...source,
      itemCount: counts.get(source.id) || counts.get(source.name) || 0,
    }));
    response.json({ sources });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sources/:id/sync", async (request, response, next) => {
  try {
    const data = await dataStore.readData();
    const source = data.sources.find((itemSource) => itemSource.id === request.params.id);
    if (!source) {
      response.status(404).json({ error: "来源不存在", code: "SOURCE_NOT_FOUND" });
      return;
    }
    const job = syncJobs.get(source.id);
    response.json({
      source,
      status: job?.status || source.syncStatus || "idle",
      imported: job?.imported || 0,
      message: job?.message || source.syncMessage || "",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sync/daily", async (_request, response, next) => {
  try {
    const data = await dataStore.readData();
    response.json({
      syncState: {
        ...data.syncState,
        dailyEnabled: dailySyncConfig.enabled && data.syncState.dailyEnabled !== false,
        dailyTime: dailySyncConfig.time,
        dailyTimeZone: dailySyncConfig.timeZone,
      },
      syncableSourceCount: data.sources.filter(isSyncableSource).length,
      job: dailySyncJob,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sources", async (request, response, next) => {
  try {
    const name = String(request.body?.name || "").trim();
    const wechatId = String(request.body?.wechatId || "").trim();
    const sourceType = request.body?.sourceType === "视频号" ? "视频号" : "公众号";
    if (!name || !wechatId) {
      response.status(400).json({ error: "来源名称和账号/链接必填" });
      return;
    }

    const source = await dataStore.addSource({
      id: `${slug(sourceType)}-${slug(wechatId || name)}-${Date.now()}`,
      sourceType,
      name,
      wechatId,
      provider: request.body?.provider,
      externalId: request.body?.externalId,
      feedUrl: request.body?.feedUrl,
      description: String(request.body?.description || "").trim(),
      tags: normalizeTags(request.body?.tags),
      status: request.body?.status === "停用" ? "停用" : "启用",
      createdAt: new Date().toISOString().slice(0, 10),
    });
    response.status(201).json({ source });
  } catch (error) {
    next(error);
  }
});

async function runSourceSync(sourceId) {
  const job = syncJobs.get(sourceId);
  try {
    const data = await dataStore.readData();
    const source = data.sources.find((itemSource) => itemSource.id === sourceId);
    if (!source) {
      throw new Error("来源不存在");
    }

    const items = await fetchSourceItems(source, { skipItemIds: new Set(data.items.map((item) => item.id)) });
    await dataStore.addItems(items, source);
    const updatedSource = await dataStore.updateSource(source.id, {
      lastSyncAt: new Date().toISOString(),
      syncStatus: "success",
      syncMessage: `同步 ${items.length} 条`,
    });
    if (job) {
      job.status = "success";
      job.imported = items.length;
      job.message = updatedSource.syncMessage;
    }
    return { source: updatedSource, status: "success", imported: items.length, message: updatedSource.syncMessage };
  } catch (error) {
    const updatedSource = await dataStore.updateSource(sourceId, {
      lastSyncAt: new Date().toISOString(),
      syncStatus: "failed",
      syncMessage: error.message || "同步失败",
    });
    if (job) {
      job.status = "failed";
      job.message = error.message || "同步失败";
    }
    return { source: updatedSource, status: "failed", imported: 0, message: error.message || "同步失败" };
  }
}

async function runDailySync({ runKey = dailySyncKey(new Date(), dailySyncConfig.timeZone), reason = "manual" } = {}) {
  if (dailySyncJob?.status === "syncing") {
    return dailySyncJob;
  }
  dailySyncJob = {
    status: "syncing",
    imported: 0,
    message: reason === "schedule" ? "每日自动刷新中。" : "手动刷新中。",
    startedAt: new Date().toISOString(),
    runKey,
  };
  try {
    const result = await runDailySourceSync({
      dataStore,
      runKey,
      syncSource: runSourceSync,
    });
    dailySyncJob = { ...dailySyncJob, ...result, status: result.status, finishedAt: new Date().toISOString() };
    return dailySyncJob;
  } catch (error) {
    const message = error.message || "自动刷新失败";
    await dataStore.updateSyncState({
      dailyLastRunKey: runKey,
      dailyLastRunAt: new Date().toISOString(),
      dailyLastStatus: "failed",
      dailyLastImported: 0,
      dailyLastMessage: message,
    });
    dailySyncJob = { ...dailySyncJob, status: "failed", imported: 0, message, finishedAt: new Date().toISOString() };
    return dailySyncJob;
  }
}

app.post("/api/sources/:id/sync", async (request, response, next) => {
  const sourceId = request.params.id;
  try {
    const data = await dataStore.readData();
    const source = data.sources.find((itemSource) => itemSource.id === sourceId);
    if (!source) {
      response.status(404).json({ error: "来源不存在", code: "SOURCE_NOT_FOUND" });
      return;
    }

    const currentJob = syncJobs.get(sourceId);
    if (currentJob?.status === "syncing") {
      response.status(202).json({ source, status: "syncing", imported: currentJob.imported, message: currentJob.message });
      return;
    }

    const updatedSource = await dataStore.updateSource(source.id, {
      lastSyncAt: new Date().toISOString(),
      syncStatus: "syncing",
      syncMessage: "同步中，原站限流时会自动等待后继续。",
    });

    syncJobs.set(sourceId, {
      status: "syncing",
      imported: 0,
      message: updatedSource.syncMessage,
      startedAt: new Date().toISOString(),
    });
    runSourceSync(sourceId);
    response.status(202).json({ source: updatedSource, status: "syncing", imported: 0, message: updatedSource.syncMessage });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sync/daily/run", async (_request, response, next) => {
  try {
    const runKey = dailySyncKey(new Date(), dailySyncConfig.timeZone);
    if (dailySyncJob?.status === "syncing") {
      response.status(202).json({ job: dailySyncJob });
      return;
    }
    runDailySync({ runKey, reason: "manual" }).catch((error) => console.error("Daily sync failed", error));
    response.status(202).json({
      job: {
        status: "syncing",
        imported: 0,
        message: "手动刷新中。",
        runKey,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(rootDir, "dist")));
app.get("*", (_request, response) => {
  response.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.message || "服务端错误", code: error.code || "SERVER_ERROR" });
});

app.listen(port, () => {
  console.log(`Intel Hub server listening on http://localhost:${port}`);
});

startDailySyncScheduler({
  enabled: dailySyncConfig.enabled,
  intervalMs: dailySyncConfig.intervalMs,
  time: dailySyncConfig.time,
  timeZone: dailySyncConfig.timeZone,
  getLastRunKey: async () => {
    const data = await dataStore.readData();
    return data.syncState.dailyEnabled === false ? dailySyncKey(new Date(), dailySyncConfig.timeZone) : data.syncState.dailyLastRunKey;
  },
  run: ({ runKey }) => runDailySync({ runKey, reason: "schedule" }),
});
