import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { MarketSnapshot } from "@/lib/market/types";
import type { TradeIdeaScore } from "@/lib/model/types";
import type { OptionsReport } from "@/lib/report/types";
import type { CandidateDataset, DatasetManifest, MarketFeatureDataset, SelectionPolicy } from "@/lib/training/types";

type DatasetIndexItem = {
  runId: string;
  reportDate: string;
  reportId: string;
  dataAsOfUtc: string;
  candidateCount: number;
  selectedIdeaCount: number;
  trainingSampleCount: number;
};

type DatasetIndex = {
  schemaVersion: "1.0";
  latestRunId: string | null;
  runs: DatasetIndexItem[];
};

const ROOT = process.cwd();
const DATASETS_ROOT = path.join(ROOT, "data", "datasets");
const TRAINING_ROOT = path.join(ROOT, "data", "training");
const INDEX_PATH = path.join(DATASETS_ROOT, "index.json");

export function createDatasetRunId(snapshot: MarketSnapshot, features: MarketFeatureDataset, policy: SelectionPolicy) {
  const hash = sha256({
    reportDate: snapshot.reportDate,
    dataAsOfUtc: snapshot.asOfUtc,
    sourceFingerprint: snapshot.sourceFingerprint ?? "",
    features,
    policy
  });
  return `run-${hash.slice(0, 16)}`;
}

export async function persistRunDataset(args: {
  runId: string;
  snapshot: MarketSnapshot;
  features: MarketFeatureDataset;
  policy: SelectionPolicy;
  candidates: TradeIdeaScore[];
  report: OptionsReport;
}) {
  const { runId, snapshot, features, policy, candidates, report } = args;
  const runDirectory = path.join(DATASETS_ROOT, snapshot.reportDate, runId);
  const candidateDataset: CandidateDataset = {
    schemaVersion: "1.0",
    runId,
    reportDate: snapshot.reportDate,
    candidates
  };
  const featureDatasetHash = sha256(features);
  const candidateDatasetHash = sha256(candidateDataset);
  const selectionPolicyHash = sha256(policy);
  const manifest: DatasetManifest = {
    schemaVersion: "1.0",
    runId,
    reportDate: snapshot.reportDate,
    reportId: report.reportId,
    dataAsOfUtc: snapshot.asOfUtc,
    ...(snapshot.sourceFingerprint ? { sourceFingerprint: snapshot.sourceFingerprint } : {}),
    ...(snapshot.historicalData ? {
      historicalProvider: snapshot.historicalData.provider,
      historicalCoverageRatio: snapshot.historicalData.coverageRatio,
      historicalBarCount: snapshot.historicalData.totalBarCount
    } : {}),
    featureVersion: features.featureVersion,
    policyVersion: policy.policyVersion,
    trainingSampleCount: policy.resolvedTradeCount,
    universeCount: snapshot.universe.length,
    includedSymbolCount: snapshot.symbols.length,
    candidateCount: candidates.length,
    selectedIdeaCount: report.topTrades.length,
    featureDatasetHash,
    candidateDatasetHash,
    selectionPolicyHash
  };
  await Promise.all([fs.mkdir(runDirectory, { recursive: true }), fs.mkdir(TRAINING_ROOT, { recursive: true })]);
  await Promise.all([
    writeJson(path.join(runDirectory, "manifest.json"), manifest),
    writeJson(path.join(runDirectory, "market-features.json"), features),
    writeJson(path.join(runDirectory, "candidates.json"), candidateDataset),
    writeJson(path.join(runDirectory, "selection-policy.json"), policy),
    writeJson(path.join(TRAINING_ROOT, "selection-policy.json"), policy)
  ]);
  await updateDatasetIndex(manifest);
  return manifest;
}

async function updateDatasetIndex(manifest: DatasetManifest) {
  const index = await getDatasetIndex();
  const item: DatasetIndexItem = {
    runId: manifest.runId,
    reportDate: manifest.reportDate,
    reportId: manifest.reportId,
    dataAsOfUtc: manifest.dataAsOfUtc,
    candidateCount: manifest.candidateCount,
    selectedIdeaCount: manifest.selectedIdeaCount,
    trainingSampleCount: manifest.trainingSampleCount
  };
  const runs = [item, ...index.runs.filter((run) => run.runId !== item.runId)]
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || b.dataAsOfUtc.localeCompare(a.dataAsOfUtc) || a.runId.localeCompare(b.runId));
  await fs.mkdir(DATASETS_ROOT, { recursive: true });
  await writeJson(INDEX_PATH, { schemaVersion: "1.0", latestRunId: runs[0]?.runId ?? null, runs } satisfies DatasetIndex);
}

async function getDatasetIndex(): Promise<DatasetIndex> {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, "utf8")) as DatasetIndex;
  } catch {
    return { schemaVersion: "1.0", latestRunId: null, runs: [] };
  }
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
