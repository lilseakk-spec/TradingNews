/**
 * Yapay zeka cagrisinin gercek token kullanimini kaydeder.
 * AI scriptleri cagri bitince bunu kullanir; maliyet sayfasi buradan okur.
 */

import fs from "node:fs";
import path from "node:path";
import { costOf, type UsageEntry, type UsageLog } from "../src/lib/usage.ts";

const FILE = path.join(process.cwd(), "src", "data", "ai-usage.json");
/** Dosya sismesin diye son kayitlar tutulur. */
const MAX = 400;

export function logUsage(
  job: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  items?: number,
): UsageEntry {
  const entry: UsageEntry = {
    at: new Date().toISOString(),
    job,
    model,
    inputTokens,
    outputTokens,
    cost: Number(costOf(model, inputTokens, outputTokens).toFixed(5)),
    items,
  };

  let log: UsageLog = { entries: [] };
  if (fs.existsSync(FILE)) {
    try {
      log = JSON.parse(fs.readFileSync(FILE, "utf8")) as UsageLog;
      if (!Array.isArray(log.entries)) log = { entries: [] };
    } catch {
      log = { entries: [] };
    }
  }

  log.entries.push(entry);
  log.entries = log.entries.slice(-MAX);

  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(log, null, 2) + "\n", "utf8");
  return entry;
}
