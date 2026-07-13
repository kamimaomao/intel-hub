export const defaultDailySyncTime = "14:45";
export const defaultDailySyncTimeZone = "Asia/Shanghai";
export const defaultDailySyncRetryIntervalMs = 30 * 60_000;

const syncableProviders = new Set(["feed", "json", "xianjian"]);

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function parseTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: 14, minute: 45 };
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function dailySyncKey(date = new Date(), timeZone = defaultDailySyncTimeZone) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shouldRunDailySync({
  now = new Date(),
  lastRunKey = "",
  lastRunAt = "",
  lastRunStatus = "idle",
  time = defaultDailySyncTime,
  timeZone = defaultDailySyncTimeZone,
  retryIntervalMs = defaultDailySyncRetryIntervalMs,
} = {}) {
  const key = dailySyncKey(now, timeZone);
  if (lastRunKey === key) {
    if (lastRunStatus !== "failed") {
      return false;
    }
    const lastAttemptAt = Date.parse(lastRunAt);
    if (Number.isFinite(lastAttemptAt) && now.getTime() - lastAttemptAt < retryIntervalMs) {
      return false;
    }
  }
  const parts = zonedParts(now, timeZone);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const scheduled = parseTime(time);
  return currentMinutes >= scheduled.hour * 60 + scheduled.minute;
}

export function isSyncableSource(source) {
  return source?.status !== "停用" && syncableProviders.has(source?.provider);
}

export async function runDailySourceSync({
  dataStore,
  runKey,
  syncSource,
  now = new Date(),
} = {}) {
  const data = await dataStore.readData();
  const sources = (data.sources || []).filter(isSyncableSource);
  await dataStore.updateSyncState({
    dailyLastRunKey: runKey,
    dailyLastRunAt: now.toISOString(),
    dailyLastStatus: "syncing",
    dailyLastImported: 0,
    dailyLastMessage: `自动刷新中：${sources.length} 个来源。`,
  });

  let imported = 0;
  let failed = 0;
  for (const source of sources) {
    const result = await syncSource(source.id);
    imported += Number(result?.imported) || 0;
    if (result?.status === "failed") {
      failed += 1;
    }
  }

  const status = failed === 0 ? "success" : failed === sources.length ? "failed" : "partial";
  const message = `自动刷新 ${sources.length} 个来源，导入 ${imported} 条${failed ? `，失败 ${failed} 个来源` : ""}。`;
  await dataStore.updateSyncState({
    dailyLastRunKey: runKey,
    dailyLastRunAt: new Date().toISOString(),
    dailyLastStatus: status,
    dailyLastImported: imported,
    dailyLastMessage: message,
  });
  return { status, sourceCount: sources.length, imported, failed, message };
}

export function startDailySyncScheduler({
  enabled = true,
  intervalMs = 60_000,
  retryIntervalMs = defaultDailySyncRetryIntervalMs,
  getSyncState,
  getLastRunKey,
  run,
  time = defaultDailySyncTime,
  timeZone = defaultDailySyncTimeZone,
  now = () => new Date(),
}) {
  if (!enabled) {
    return null;
  }

  let running = false;
  const tick = async () => {
    if (running) {
      return;
    }
    const syncState = getSyncState
      ? await getSyncState()
      : { dailyLastRunKey: await getLastRunKey?.() };
    const current = now();
    if (!shouldRunDailySync({
      now: current,
      lastRunKey: syncState?.dailyLastRunKey,
      lastRunAt: syncState?.dailyLastRunAt,
      lastRunStatus: syncState?.dailyLastStatus,
      time,
      timeZone,
      retryIntervalMs,
    })) {
      return;
    }
    running = true;
    try {
      await run({ runKey: dailySyncKey(current, timeZone), time, timeZone });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    tick().catch((error) => console.error("Daily sync scheduler failed", error));
  }, intervalMs);
  timer.unref?.();
  tick().catch((error) => console.error("Daily sync scheduler failed", error));
  return timer;
}
