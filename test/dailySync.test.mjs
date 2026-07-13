import assert from "node:assert/strict";
import test from "node:test";
import {
  dailySyncKey,
  isSyncableSource,
  runDailySourceSync,
  shouldRunDailySync,
} from "../server/dailySync.mjs";

test("dailySyncKey uses the configured timezone day", () => {
  assert.equal(dailySyncKey(new Date("2026-07-07T16:30:00Z"), "Asia/Shanghai"), "2026-07-08");
});

test("shouldRunDailySync starts at 14:45 Asia/Shanghai once per day", () => {
  assert.equal(
    shouldRunDailySync({
      now: new Date("2026-07-07T06:44:59Z"),
      lastRunKey: "",
      time: "14:45",
      timeZone: "Asia/Shanghai",
    }),
    false,
  );
  assert.equal(
    shouldRunDailySync({
      now: new Date("2026-07-07T06:45:00Z"),
      lastRunKey: "",
      time: "14:45",
      timeZone: "Asia/Shanghai",
    }),
    true,
  );
  assert.equal(
    shouldRunDailySync({
      now: new Date("2026-07-07T07:00:00Z"),
      lastRunKey: "2026-07-07",
      time: "14:45",
      timeZone: "Asia/Shanghai",
    }),
    false,
  );
});

test("shouldRunDailySync retries a failed run after the retry interval", () => {
  const base = {
    lastRunKey: "2026-07-07",
    lastRunAt: "2026-07-07T06:45:00Z",
    lastRunStatus: "failed",
    time: "14:45",
    timeZone: "Asia/Shanghai",
    retryIntervalMs: 30 * 60_000,
  };
  assert.equal(shouldRunDailySync({ ...base, now: new Date("2026-07-07T07:14:59Z") }), false);
  assert.equal(shouldRunDailySync({ ...base, now: new Date("2026-07-07T07:15:00Z") }), true);
});

test("isSyncableSource only allows enabled feed/json/xianjian sources", () => {
  assert.equal(isSyncableSource({ provider: "xianjian", status: "启用" }), true);
  assert.equal(isSyncableSource({ provider: "json", status: "启用" }), true);
  assert.equal(isSyncableSource({ provider: "manual", status: "启用" }), false);
  assert.equal(isSyncableSource({ provider: "xianjian", status: "停用" }), false);
});

test("runDailySourceSync syncs enabled syncable sources and persists a summary", async () => {
  const patches = [];
  const synced = [];
  const dataStore = {
    async readData() {
      return {
        sources: [
          { id: "xianjian", provider: "xianjian", status: "启用" },
          { id: "feed", provider: "feed", status: "启用" },
          { id: "manual", provider: "manual", status: "启用" },
        ],
      };
    },
    async updateSyncState(patch) {
      patches.push(patch);
      return patch;
    },
  };

  const result = await runDailySourceSync({
    dataStore,
    runKey: "2026-07-07",
    now: new Date("2026-07-07T06:45:00Z"),
    syncSource: async (sourceId) => {
      synced.push(sourceId);
      return { status: "success", imported: sourceId === "xianjian" ? 3 : 2 };
    },
  });

  assert.deepEqual(synced, ["xianjian", "feed"]);
  assert.equal(result.imported, 5);
  assert.equal(result.sourceCount, 2);
  assert.equal(patches[0].dailyLastStatus, "syncing");
  assert.equal(patches.at(-1).dailyLastStatus, "success");
  assert.equal(patches.at(-1).dailyLastImported, 5);
});

test("runDailySourceSync reports partial success when one source fails", async () => {
  const patches = [];
  const dataStore = {
    async readData() {
      return {
        sources: [
          { id: "blocked", provider: "xianjian", status: "启用" },
          { id: "feed", provider: "feed", status: "启用" },
        ],
      };
    },
    async updateSyncState(patch) {
      patches.push(patch);
      return patch;
    },
  };

  const result = await runDailySourceSync({
    dataStore,
    runKey: "2026-07-07",
    syncSource: async (sourceId) => sourceId === "blocked"
      ? { status: "failed", imported: 0 }
      : { status: "success", imported: 2 },
  });

  assert.equal(result.status, "partial");
  assert.equal(result.imported, 2);
  assert.equal(result.failed, 1);
  assert.equal(patches.at(-1).dailyLastStatus, "partial");
});
