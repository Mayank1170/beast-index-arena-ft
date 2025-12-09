'use client';

import * as anchor from '@coral-xyz/anchor';
import { useState, useEffect } from "react";
import { useProgram } from "../hooks/useProgram";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

const POLL_INTERVAL = 15000; // Poll every 15 seconds to avoid rate limits

export function UserPosition() {
    const program = useProgram();
    const wallet = useWallet();
    const { currentBattleId, battle } = useCurrentBattle();
    const [positions, setPositions] = useState<any>([]);
    const [selling, setSelling] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [market, setMarket] = useState<any>(null);

    const fetchUserPositions = async () => {
        if (!program || !wallet.publicKey || !currentBattleId) return;

        const battleId = currentBattleId;
        const foundPositions = [];

        for (let i = 0; i < 4; i++) {
            try {
                const [positionPDA] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('position'),
                        Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer)),
                        wallet.publicKey.toBuffer(),
                        Buffer.from([i])
                    ],
                    program.programId
                );

                const position = await (program.account as any).userPosition.fetch(positionPDA);

                // Only add if user actually owns this position
                if (position.user.toString() !== PublicKey.default.toString()) {
                    foundPositions.push({
                        creature: i,
                        shares: position.amount.toNumber(),
                        claimed: position.claimed,
                        pda: positionPDA
                    });
                }
            } catch (error: any) {
                // Silently skip - account doesn't exist (user hasn't bet on this creature)
                continue;
            }
        }
        setPositions(foundPositions);

        // Fetch market data
        try {
            const [marketPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('market'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId
            );

            const marketData = await (program.account as any).marketState.fetch(marketPDA);
            setMarket(marketData);
        } catch (error: any) {
            // Silently handle - market might not exist yet
        }
    };

    const handleSell = async (creature: number, positionPDA: any, shares: number) => {
        if (!program || !wallet.publicKey || !currentBattleId) return;
        setSelling(true);
        try {
            const battleId = currentBattleId;
            console.log('Selling shares...');
            console.log('  Creature:', creature);
            console.log('  Shares:', shares);

            const [battlePDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('battle'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId,
            );

            const [marketPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('market'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId,
            );

            console.log('Calling sell_shares...');
            const tx = await program.methods.sellShares(new anchor.BN(shares)).accounts({
                battleState: battlePDA,
                marketState: marketPDA,
                userPosition: positionPDA,
                user: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }).rpc();

            console.log('Sold! Tx:', tx);
            alert('Shares sold!\n\nTx: ' + tx);

            await fetchUserPositions();

        } catch (error) {
            console.error('Error:', error);
            alert('Failed: ' + error);
        } finally {
            setSelling(false);
        }
    };

    const handleClaim = async (creature: number, positionPDA: any) => {
        if (!program || !wallet.publicKey || !currentBattleId) return;

        setClaiming(true);

        try {
            const battleId = currentBattleId;

            console.log('Claiming winnings...');
            console.log('Creature:', creature);

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

            console.log('Calling claim_winnings...');

            const tx = await program.methods
                .claimWinnings()
                .accounts({
                    battleState: battlePDA,
                    marketState: marketPDA,
                    userPosition: positionPDA,
                    user: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log('Claimed! Tx:', tx);
            alert('Winnings claimed!\n\nTx: ' + tx);

            await fetchUserPositions();

        } catch (error) {
            console.error('Error:', error);
            alert('Failed: ' + error);
        } finally {
            setClaiming(false);
        }
    };

    const calculatePayout = (shares: number, creature: number) => {
        if (!market || !battle?.winner === null) return 0;

        const pools = [
            market.creature0Pool,
            market.creature1Pool,
            market.creature2Pool,
            market.creature3Pool
        ];

        const winningPool = pools[creature].toNumber();
        const totalPool = market.totalPool.toNumber();

        if (winningPool === 0) return 0;

        const payout = (shares / winningPool) * totalPool;
        return payout / 1_000_000_000;
    };

    // Real-time polling
    useEffect(() => {
        if (!program || !wallet.publicKey || !currentBattleId) return;

        // Fetch immediately
        fetchUserPositions();

        // Set up polling interval
        const interval = setInterval(() => {
            fetchUserPositions();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [program, wallet.publicKey, currentBattleId]);

    if (!wallet.connected) {
        return (
            <div className="bg-black/30 rounded-xl border border-slate-800 p-6">
                <h2 className="text-xl font-black text-white mb-4 tracking-tight">
                    💼 YOUR POSITIONS
                </h2>
                <p className="text-slate-400 text-sm">Connect wallet to see your positions</p>
            </div>
        );
    }

    return (
        <div className="bg-black/30 rounded-xl border border-slate-800 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white tracking-tight">
                    💼 YOUR POSITIONS
                </h2>
                <span className="text-xs text-slate-500 font-bold">
                    BATTLE #{currentBattleId || '...'}
                </span>
            </div>

            {battle?.isBattleOver && (
                <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-black p-3 rounded-lg mb-4 text-center font-bold text-sm">
                    🏆 BATTLE OVER! WINNER: CREATURE {battle.winner !== null ? battle.winner : 'NONE'}
                </div>
            )}

            {positions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {positions.map((pos: any) => {
                        const isWinner = battle?.isBattleOver && battle.winner === pos.creature;
                        const isLoser = battle?.isBattleOver && battle.winner !== pos.creature;

                        return (
                            <div key={pos.creature} className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-white font-black text-lg flex items-center gap-2">
                                            CREATURE {pos.creature}
                                            {isWinner && <span className="text-yellow-400">👑</span>}
                                            {isLoser && <span className="text-red-500">💀</span>}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            <span className="font-bold text-white">{pos.shares.toLocaleString()}</span> SHARES
                                        </div>
                                    </div>
                                    <div>
                                        {pos.claimed && (
                                            <span className="text-green-400 text-xs font-bold bg-green-900/30 px-2 py-1 rounded border border-green-700">
                                                ✅ CLAIMED
                                            </span>
                                        )}
                                        {!pos.claimed && isWinner && (
                                            <span className="text-yellow-400 text-xs font-bold bg-yellow-900/30 px-2 py-1 rounded border border-yellow-700">
                                                💰 WINNER
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isWinner && !pos.claimed && (
                                    <div className="text-sm text-green-400 mb-3 bg-green-900/20 p-2 rounded border border-green-700">
                                        Est. Payout: <span className="font-bold">{calculatePayout(pos.shares, pos.creature).toFixed(4)} SOL</span>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {!battle?.isBattleOver ? (
                                        <>
                                            <button
                                                onClick={() => handleSell(pos.creature, pos.pda, Math.floor(pos.shares / 2))}
                                                disabled={selling}
                                                className="flex-1 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white py-2 rounded font-bold text-xs border border-orange-600/50 transition-all disabled:opacity-50"
                                            >
                                                {selling ? '⏳' : '📉 SELL HALF'}
                                            </button>

                                            <button
                                                onClick={() => handleSell(pos.creature, pos.pda, pos.shares)}
                                                disabled={selling}
                                                className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded font-bold text-xs border border-red-600/50 transition-all disabled:opacity-50"
                                            >
                                                {selling ? '⏳' : '📉 SELL ALL'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {isWinner && !pos.claimed && (
                                                <button
                                                    onClick={() => handleClaim(pos.creature, pos.pda)}
                                                    disabled={claiming}
                                                    className="w-full bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white py-2 rounded font-bold text-sm border border-green-600/50 transition-all disabled:opacity-50"
                                                >
                                                    {claiming ? '⏳ CLAIMING...' : '💰 CLAIM WINNINGS'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-500">
                    <div className="text-4xl mb-2">📊</div>
                    <div className="text-sm">No positions yet. Buy some shares to get started!</div>
                </div>
            )}
        </div>
    );
}