import { createHash } from "node:crypto";
import type { EquityQuote, OptionChainSelection } from "@/lib/market/types";

type SelectionOptions = {
  limit?: number;
  moverSlots?: number;
  volumeSlots?: number;
  coreSymbols?: string[];
};

const DEFAULT_CORE = ["SPY", "QQQ", "IWM", "DIA", "TLT", "GLD", "XLE", "XLK", "SMH"];

export function selectOptionChainSymbols(
  quotes: Map<string, EquityQuote>,
  reportDate: string,
  options: SelectionOptions = {}
): OptionChainSelection {
  const available = [...quotes.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const limit = clampInteger(options.limit ?? envNumber("OPTIONS_CHAIN_SYMBOL_LIMIT", 40), 1, Math.max(1, available.length));
  const coreSymbols = options.coreSymbols ?? envList("OPTIONS_CORE_SYMBOLS", DEFAULT_CORE);
  const selected = new Set<string>();
  const take = (symbols: string[], count: number) => {
    const values: string[] = [];
    for (const symbol of symbols) {
      if (selected.size >= limit || values.length >= count || selected.has(symbol) || !quotes.has(symbol)) continue;
      selected.add(symbol);
      values.push(symbol);
    }
    return values;
  };

  const core = take(coreSymbols, limit);
  const remainingSlots = () => Math.max(0, limit - selected.size);
  const moverTarget = Math.min(remainingSlots(), clampInteger(options.moverSlots ?? envNumber("OPTIONS_MOVER_SLOTS", 18), 0, limit));
  const movers = take(available
    .filter((quote) => !selected.has(quote.symbol))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct) || b.volume - a.volume || a.symbol.localeCompare(b.symbol))
    .map((quote) => quote.symbol), moverTarget);
  const volumeTarget = Math.min(remainingSlots(), clampInteger(options.volumeSlots ?? envNumber("OPTIONS_VOLUME_SLOTS", 7), 0, limit));
  const volume = take(available
    .filter((quote) => !selected.has(quote.symbol))
    .sort((a, b) => b.volume - a.volume || Math.abs(b.changePct) - Math.abs(a.changePct) || a.symbol.localeCompare(b.symbol))
    .map((quote) => quote.symbol), volumeTarget);
  const rotation = take(available
    .filter((quote) => !selected.has(quote.symbol))
    .sort((a, b) => rotationKey(reportDate, a.symbol).localeCompare(rotationKey(reportDate, b.symbol)) || a.symbol.localeCompare(b.symbol))
    .map((quote) => quote.symbol), remainingSlots());

  return {
    strategyVersion: "rfdelta-chain-preselection-v1",
    quoteUniverseCount: available.length,
    selectedSymbolCount: selected.size,
    core,
    movers,
    volume,
    rotation,
    selectedSymbols: [...selected].sort()
  };
}

function rotationKey(reportDate: string, symbol: string) {
  return createHash("sha256").update(`${reportDate}:${symbol}`).digest("hex");
}

function envList(name: string, fallback: string[]) {
  const values = process.env[name]?.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  return values?.length ? [...new Set(values)] : fallback;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
