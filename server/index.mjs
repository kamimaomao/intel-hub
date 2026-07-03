import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countItems, createDataStore, normalizeTags, slug } from "./dataStore.mjs";
import { fetchSourceItems } from "./sourceSync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const originalSources = JSON.parse(readFileSync(path.join(rootDir, "src", "data", "originalSources.json"), "utf8"));
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const dataFile = path.join(dataDir, "intel-hub.json");
const port = Number(process.env.PORT || 8787);
const dataStore = createDataStore({ dataFile, seedSources: originalSources });

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
    response.json({ counts: countItems(data.items) });
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

app.post("/api/sources/:id/sync", async (request, response, next) => {
  const sourceId = request.params.id;
  try {
    const data = await dataStore.readData();
    const source = data.sources.find((itemSource) => itemSource.id === sourceId);
    if (!source) {
      response.status(404).json({ error: "来源不存在", code: "SOURCE_NOT_FOUND" });
      return;
    }

    const items = await fetchSourceItems(source);
    await dataStore.addItems(items, source);
    const updatedSource = await dataStore.updateSource(source.id, {
      lastSyncAt: new Date().toISOString(),
      syncStatus: "success",
      syncMessage: `同步 ${items.length} 条`,
    });
    response.json({ source: updatedSource, imported: items.length });
  } catch (error) {
    await dataStore.updateSource(sourceId, {
      lastSyncAt: new Date().toISOString(),
      syncStatus: "failed",
      syncMessage: error.message || "同步失败",
    });
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
