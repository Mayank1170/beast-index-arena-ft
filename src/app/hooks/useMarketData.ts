import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";

export interface MarketData {
  pools: [number, number, number, number];
  shares: [number, number, number, number];
  totalPool: number;
  kConstant: bigint;
}

export function useMarketData(battleId: number | null) {
  const program = useProgram();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program || battleId === null) return;

    const fetchMarket = async () => {
      try {
        const [marketPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("market"),
            Buffer.from(
              new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer)
            ),
          ],
          program.programId
        );

        const marketState = await (program.account as any).marketState.fetch(marketPDA);

        const pools: [number, number, number, number] = [
          typeof marketState.creature0Pool?.toNumber === 'function'
            ? marketState.creature0Pool.toNumber()
            : marketState.creature0Pool,
          typeof marketState.creature1Pool?.toNumber === 'function'
            ? marketState.creature1Pool.toNumber()
            : marketState.creature1Pool,
          typeof marketState.creature2Pool?.toNumber === 'function'
            ? marketState.creature2Pool.toNumber()
            : marketState.creature2Pool,
          typeof marketState.creature3Pool?.toNumber === 'function'
            ? marketState.creature3Pool.toNumber()
            : marketState.creature3Pool,
        ];

        const shares: [number, number, number, number] = [
          typeof marketState.creature0Shares?.toNumber === 'function'
            ? marketState.creature0Shares.toNumber()
            : marketState.creature0Shares,
          typeof marketState.creature1Shares?.toNumber === 'function'
            ? marketState.creature1Shares.toNumber()
            : marketState.creature1Shares,
          typeof marketState.creature2Shares?.toNumber === 'function'
            ? marketState.creature2Shares.toNumber()
            : marketState.creature2Shares,
          typeof marketState.creature3Shares?.toNumber === 'function'
            ? marketState.creature3Shares.toNumber()
            : marketState.creature3Shares,
        ];

        const totalPool = typeof marketState.totalPool?.toNumber === 'function'
          ? marketState.totalPool.toNumber()
          : marketState.totalPool;

        const kConstant = typeof marketState.kConstant?.toString === 'function'
          ? BigInt(marketState.kConstant.toString())
          : BigInt(marketState.kConstant);

        setMarketData({
          pools,
          shares,
          totalPool,
          kConstant,
        });
        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching market data:", error);
        setLoading(false);
      }
    };

    fetchMarket();

    // Poll every 30 seconds to reduce RPC calls (market doesn't change that often)
    const interval = setInterval(fetchMarket, 30000);
    return () => clearInterval(interval);
  }, [program, battleId]);

  return { marketData, loading };
}

// Calculate cost to buy shares using constant product formula
// When buying shares, we're effectively swapping SOL for shares
// The formula is: cost = pool * (shares_to_buy / (total_shares - shares_to_buy))
// This approximates the bonding curve pricing
export function calculateBuyCost(
  currentPool: number,
  currentShares: number,
  sharesToBuy: number
): number {
  if (currentShares === 0 || sharesToBuy <= 0) return 0;

  // Simple linear pricing: average price per share
  // More sophisticated would be: cost = pool * (sqrt(1 + sharesToBuy/shares) - 1)
  // But let's use a simpler bonding curve: price increases linearly with supply
  const avgPrice = currentPool / currentShares;
  const slippageFactor = 1 + (sharesToBuy / currentShares) * 0.1; // 10% slippage per 100% of supply
  return avgPrice * sharesToBuy * slippageFactor;
}

// Calculate how many shares you get for a given amount of SOL
export function calculateSharesForCost(
  currentPool: number,
  currentShares: number,
  solAmount: number
): number {
  if (currentShares === 0 || solAmount <= 0) return 0;

  const avgPrice = currentPool / currentShares;
  const baseShares = solAmount / avgPrice;
  const adjustedShares = baseShares / (1 + (baseShares / currentShares) * 0.05);
  return Math.floor(adjustedShares);
}
