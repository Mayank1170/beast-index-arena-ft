"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../hooks/useProgram";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useUserPositions } from "../hooks/useUserPositions";
import { useMarketData, calculateBuyCost } from "../hooks/useMarketData";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

interface MarketActionsProps {
  creatureIndex: number;
  creatureName: string;
  isAlive: boolean;
  battleOver: boolean;
}

export function MarketActions({
  creatureIndex,
  creatureName,
  isAlive,
  battleOver,
}: MarketActionsProps) {
  const wallet = useWallet();
  const program = useProgram();
  const { currentBattleId } = useCurrentBattle();
  const { positions, refresh: refreshPositions } = useUserPositions(currentBattleId);
  const { marketData } = useMarketData(currentBattleId);
  const [loading, setLoading] = useState(false);
  const [betAmountSOL, setBetAmountSOL] = useState("0.05");

  const userPosition = positions.find((p) => p.creatureIndex === creatureIndex);
  const userShares = userPosition?.shares || 0;

  const betAmountInLamports = Math.floor(parseFloat(betAmountSOL || "0") * 1_000_000_000);

  const currentPool = marketData ? marketData.pools[creatureIndex] : 0;
  const currentShares = marketData ? marketData.shares[creatureIndex] : 0;
  const pricePerShare = currentShares > 0 ? (currentPool / currentShares) / 1_000_000_000 : 0;

  const handleBuy = async () => {
    if (!wallet.connected || !program || !currentBattleId) {
      alert("Please connect your wallet");
      return;
    }

    if (battleOver) {
      alert("⚠️ Battle is over! Wait for next battle.");
      return;
    }

    if (!isAlive) {
      alert("⚠️ Cannot bet on dead creature!");
      return;
    }

    const solAmount = parseFloat(betAmountSOL || "0");
    if (solAmount < 0.01) {
      alert("⚠️ Minimum bet is 0.01 SOL");
      return;
    }

    setLoading(true);

    try {
      const connection = program.provider.connection;
      const balance = await connection.getBalance(wallet.publicKey!);
      const balanceInSol = balance / 1_000_000_000;

      console.log(`💰 Wallet balance: ${balanceInSol.toFixed(4)} SOL`);
      console.log(`🎲 Bet amount: ${solAmount} SOL`);

      if (balanceInSol < solAmount + 0.001) { 
        alert(`❌ Insufficient balance!\n\nYou have: ${balanceInSol.toFixed(4)} SOL\nNeed: ${(solAmount + 0.001).toFixed(4)} SOL (including fees)`);
        setLoading(false);
        return;
      }

      const [battlePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("battle"),
          Buffer.from(
            new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer)
          ),
        ],
        program.programId
      );

      const [marketPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          Buffer.from(
            new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer)
          ),
        ],
        program.programId
      );

      const [userPositionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          Buffer.from(
            new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer)
          ),
          wallet.publicKey!.toBuffer(),
          Buffer.from([creatureIndex]),
        ],
        program.programId
      );

      console.log('📝 Sending transaction...');
      console.log('  Battle ID:', currentBattleId);
      console.log('  Creature:', creatureIndex, creatureName);
      console.log('  Amount (lamports):', betAmountInLamports);

      const tx = await program.methods
        .placeBet(creatureIndex, new anchor.BN(betAmountInLamports))
        .accounts({
          marketState: marketPDA,
          battleState: battlePDA,
          userPosition: userPositionPDA,
          user: wallet.publicKey!,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log('✅ Transaction confirmed:', tx);
      alert(`✅ Bet placed on ${creatureName} for ${solAmount.toFixed(4)} SOL!\n\nTx: ${tx.substring(0, 20)}...`);
      setBetAmountSOL("0.05");

      await refreshPositions();
    } catch (error: any) {
      console.error("❌ Full error object:", error);
      console.error("❌ Error name:", error.name);
      console.error("❌ Error message:", error.message);

      const errorMsg = error.message || String(error);

      if (errorMsg.includes("User rejected")) {
        alert("❌ Transaction cancelled - you rejected the signature request");
      } else if (errorMsg.includes("BetTooSmall")) {
        alert("❌ Minimum bet is 0.01 SOL");
      } else if (errorMsg.includes("insufficient")) {
        alert("❌ Insufficient SOL in wallet");
      } else if (errorMsg.includes("Unexpected error")) {
        alert("❌ Wallet error - please make sure:\n\n1. You have enough SOL in your wallet\n2. Your wallet is unlocked\n3. Try refreshing the page");
      } else {
        alert(`❌ Transaction failed:\n\n${errorMsg.substring(0, 200)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-auto bg-black/30 p-3 rounded-lg border border-white/5">
      {/* Position Display */}
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>
          YOUR SHARES: <strong className="text-white">{userShares.toLocaleString()}</strong>
        </span>
        {userShares > 0 && (
          <span className="text-green-400">✓ ACTIVE</span>
        )}
      </div>

      <div className="mb-2 p-2 bg-black/40 rounded border border-white/5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Price per share:</span>
          <span className="text-green-400 font-bold">
            {pricePerShare > 0 ? `${pricePerShare.toFixed(6)} SOL` : "Loading..."}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-slate-400">Total shares:</span>
          <span className="text-white">{currentShares.toLocaleString()}</span>
        </div>
      </div>

      <div className="mb-2">
        <label className="text-xs text-slate-400 mb-1 block">BET AMOUNT (SOL)</label>
        <input
          type="number"
          value={betAmountSOL}
          onChange={(e) => setBetAmountSOL(e.target.value)}
          step="0.01"
          min="0.01"
          disabled={!isAlive || battleOver || loading}
          className="w-full bg-black/40 text-white px-3 py-2 rounded text-sm border border-white/10 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          placeholder="0.05"
        />
        <div className="text-xs text-slate-500 mt-1">Minimum: 0.01 SOL</div>
      </div>

      {/* Buy Button */}
      <button
        onClick={handleBuy}
        disabled={!isAlive || battleOver || loading || !wallet.connected || parseFloat(betAmountSOL || "0") < 0.01}
        className="w-full flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white py-2 rounded font-bold text-sm border border-green-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>⏳ PROCESSING...</>
        ) : (
          <>
            💰 BET {betAmountSOL || "0"} SOL
          </>
        )}
      </button>

      {!wallet.connected && (
        <div className="text-center text-xs text-slate-500 mt-2">
          Connect wallet to trade
        </div>
      )}

      {battleOver && (
        <div className="text-center text-xs text-orange-500 mt-2 font-bold">
          ⚠️ Battle Over
        </div>
      )}
    </div>
  );
}
