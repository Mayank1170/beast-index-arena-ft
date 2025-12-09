"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../hooks/useProgram";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useUserPositions } from "../hooks/useUserPositions";
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
  const { positions } = useUserPositions(currentBattleId);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0.1);

  const userPosition = positions.find((p) => p.creatureIndex === creatureIndex);
  const userShares = userPosition?.shares || 0;

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

    setLoading(true);

    try {
      const lamports = Math.floor(amount * 1_000_000_000);

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

      const tx = await program.methods
        .placeBet(creatureIndex, new anchor.BN(lamports))
        .accounts({
          marketState: marketPDA,
          battleState: battlePDA,
          userPosition: userPositionPDA,
          user: wallet.publicKey!,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Bet placed! Tx:", tx);
      alert(`✅ Bet placed on ${creatureName}!\n\nTx: ${tx.substring(0, 20)}...`);
    } catch (error: any) {
      console.error("❌ Error:", error);
      alert(`❌ Failed: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-auto bg-black/30 p-3 rounded-lg border border-white/5">
      {/* Position Display */}
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>
          POSITION: <strong className="text-white">{userShares.toLocaleString()} SHARES</strong>
        </span>
        {userShares > 0 && (
          <span className="text-green-400">✓ ACTIVE</span>
        )}
      </div>

      {/* Amount Input */}
      <div className="mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          step={0.1}
          min={0.01}
          disabled={!isAlive || battleOver || loading}
          className="w-full bg-black/40 text-white px-3 py-2 rounded text-sm border border-white/10 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          placeholder="Amount in SOL"
        />
      </div>

      {/* Buy Button */}
      <button
        onClick={handleBuy}
        disabled={!isAlive || battleOver || loading || !wallet.connected}
        className="w-full flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white py-2 rounded font-bold text-sm border border-green-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>⏳ PROCESSING...</>
        ) : (
          <>
            📈 BUY {amount} SOL
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
