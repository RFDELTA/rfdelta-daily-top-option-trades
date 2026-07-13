import type { MarketDataProvider } from "@/lib/market/types";
import { TastytradeBridgeMarketDataProvider } from "@/lib/market/tastytradeBridge";
import { TradierMarketDataProvider } from "@/lib/market/tradier";

export function createMarketDataProvider(): MarketDataProvider {
  const provider = (process.env.MARKET_DATA_PROVIDER?.trim() || "tt_bridge").toLowerCase();
  if (provider === "tt_bridge" || provider === "rfdelta") return new TastytradeBridgeMarketDataProvider();
  if (provider === "tradier") return new TradierMarketDataProvider();
  throw new Error(`Unsupported MARKET_DATA_PROVIDER: ${provider}`);
}
