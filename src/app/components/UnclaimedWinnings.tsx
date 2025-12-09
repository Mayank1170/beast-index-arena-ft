'use client';

import * as anchor from '@coral-xyz/anchor';
import { useState } from "react";
import { useProgram } from "../hooks/useProgram";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useUnclaimedWinnings } from "../hooks/useUnclaimedWinnings";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

const BEAST_NAMES = ["YETI", "MAPINGUARI", "ZMEY", "NAGA"];
const BEAST_EMOJIS = ["❄️", "🌿", "🔥", "🐍"];

export function UnclaimedWinnings() {
    const program = useProgram();
    const wallet = useWallet();
    const { currentBattleId } = useCurrentBattle();
    const { unclaimedWinnings, loading, refresh } = useUnclaimedWinnings(currentBattleId);
    const [claiming, setClaiming] = useState<string | null>(null);

    const handleClaim = async (battleId: number, creatureIndex: number, pda: string) => {
        if (!program || !wallet.publicKey) return;

        const claimKey = `${battleId}-${creatureIndex}`;
        setClaiming(claimKey);

        try {
            console.log('Claiming winnings...');
            console.log('Battle ID:', battleId);
            console.log('Creature:', creatureIndex);

            const [battlePDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('battle'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId
            );

            const [marketPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('market'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId
            );

            const positionPDA = new PublicKey(pda);

            console.log('Calling claim_winnings...');

            const tx = await program.methods
                .claimWinnings()
                .accounts({
                    battleState: battlePDA,
                    marketState: marketPDA,
                    userPosition: positionPDA,
                    user: wallet.publicKey!,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log('Claimed! Tx:', tx);
            alert(`✅ Winnings claimed from Battle #${battleId}!\n\nTx: ${tx.substring(0, 20)}...`);

            // Refresh the list
            await refresh();

        } catch (error) {
            console.error('Error:', error);
            alert('Failed: ' + error);
        } finally {
            setClaiming(null);
        }
    };

    const calculatePayout = (shares: number, totalPool: number, winningPool: number) => {
        if (winningPool === 0) return 0;
        const payout = (shares / winningPool) * totalPool;
        return payout / 1_000_000_000;
    };

    if (!wallet.connected) {
        return null; // Don't show anything if wallet not connected
    }

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-700/50 p-6">
                <h2 className="text-xl font-black text-yellow-400 mb-4 tracking-tight flex items-center gap-2">
                    💰 UNCLAIMED WINNINGS
                </h2>
                <div className="text-center py-4 text-slate-400 text-sm">
                    <div className="animate-pulse">Checking for unclaimed winnings...</div>
                </div>
            </div>
        );
    }

    if (unclaimedWinnings.length === 0) {
        return null; // Don't show section if no unclaimed winnings
    }

    return (
        <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-700/50 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-yellow-400 tracking-tight flex items-center gap-2">
                    💰 UNCLAIMED WINNINGS
                    <span className="text-sm bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded border border-yellow-500/30">
                        {unclaimedWinnings.length}
                    </span>
                </h2>
            </div>

            <div className="space-y-3">
                {unclaimedWinnings.map((winning) => {
                    const claimKey = `${winning.battleId}-${winning.creatureIndex}`;
                    const isClaiming = claiming === claimKey;
                    const payout = calculatePayout(winning.shares, winning.totalPool, winning.winningPool);

                    return (
                        <div
                            key={claimKey}
                            className="bg-black/40 border border-yellow-600/50 rounded-lg p-4 hover:border-yellow-500 transition-all"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-2xl">{BEAST_EMOJIS[winning.creatureIndex]}</span>
                                        <span className="text-white font-black text-lg">
                                            {BEAST_NAMES[winning.creatureIndex]}
                                        </span>
                                        <span className="text-yellow-400 text-lg">👑</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Battle #{winning.battleId} • {winning.shares.toLocaleString()} SHARES
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 font-black text-xl">
                                        {payout.toFixed(4)} SOL
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Est. Payout
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleClaim(winning.battleId, winning.creatureIndex, winning.pda)}
                                disabled={isClaiming}
                                className="w-full bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white py-2 rounded font-bold text-sm border border-green-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isClaiming ? '⏳ CLAIMING...' : '💰 CLAIM WINNINGS'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 text-center text-xs text-yellow-600/70">
                Showing last 10 battles • Claims never expire
            </div>
        </div>
    );
}
