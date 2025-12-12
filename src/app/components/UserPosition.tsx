'use client';

import * as anchor from '@coral-xyz/anchor';
import { useState, useEffect } from "react";
import { useProgram } from "../hooks/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { retryWithBackoff } from "../utils/rpcRetry";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useUserPositions } from "../hooks/useUserPositions";

export function UserPosition() {
    const program = useProgram();
    const wallet = useWallet();
    const { currentBattleId } = useCurrentBattle();
    const { positions: userPositions, refresh: refreshPositions } = useUserPositions(currentBattleId);
    const [selling, setSelling] = useState(false);
    const [battleOver, setBattleOver] = useState(false);
    const [winner, setWinner] = useState<number | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [market, setMarket] = useState<any>(null);

    const fetchBattleAndMarketData = async () => {
        if (!program || !currentBattleId) return;

        const battleId = currentBattleId;

        try {
            const [battlePDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('battle'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer)),
                ],
                program.programId,
            );
            const battleData = await retryWithBackoff(async () => {
                return await (program.account as any).battleState.fetch(battlePDA);
            });

            setBattleOver(battleData.isBattleOver);
            setWinner(battleData.winner);
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            if (!errorMsg.includes('Account does not exist')) {
                console.error('Error fetching battle:', error);
            }
        }

        try {
            const [marketPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('market'),
                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId
            );

            const marketData = await retryWithBackoff(async () => {
                return await (program.account as any).marketState.fetch(marketPDA);
            });
            setMarket(marketData);
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            if (!errorMsg.includes('Account does not exist')) {
                console.error('Error fetching market:', error);
            }
        }
    };

    const handleSell = async (creature: number, positionPDA: any, shares: number) => {
        if (!program || !wallet.publicKey || !currentBattleId) return;
        setSelling(true);
        try {
            const battleId = currentBattleId;

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

            const tx = await program.methods.sellShares(new anchor.BN(shares)).accounts({
                battleState: battlePDA,
                marketState: marketPDA,
                userPosition: positionPDA,
                user: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }).rpc();

            alert('Shares sold!\n\nTx: ' + tx);

            await refreshPositions();

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

            alert('Winnings claimed!\n\nTx: ' + tx);

            await refreshPositions();

        } catch (error) {
            console.error('Error:', error);
            alert('Failed: ' + error);
        } finally {
            setClaiming(false);
        }
    };

    const calculatePayout = (shares: number, creature: number) => {
        if (!market || winner === null) return 0;

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

    useEffect(() => {
        fetchBattleAndMarketData();

        const interval = setInterval(() => {
            fetchBattleAndMarketData();
        }, 5000);

        return () => clearInterval(interval);
    }, [program, currentBattleId]);

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-6">
                Your Positions
            </h2>

            {battleOver && (
                <div className="bg-yellow-500 text-black p-4 rounded mb-4 text-center font-bold">
                    Battle Over! Winner: Creature {winner !== null ? winner : 'None'}
                </div>
            )}

            {userPositions.length > 0 ? (
                <div className="space-y-3">
                    {userPositions.map((pos: any) => {
                        const isWinner = battleOver && winner === pos.creatureIndex;
                        const isLoser = battleOver && winner !== pos.creatureIndex;

                        const positionPDA = new PublicKey(pos.pda);

                        return (
                            <div key={pos.creatureIndex} className="bg-gray-700 p-4 rounded">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-white font-bold">
                                            Creature {pos.creatureIndex}
                                            {isWinner && " 👑 WINNER"}
                                            {isLoser && " 💀 ELIMINATED"}
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            Shares: {pos.shares.toLocaleString()}
                                        </div>
                                        {isWinner && !pos.claimed && (
                                            <div className="text-sm text-green-400">
                                                Estimated Payout: {calculatePayout(pos.shares, pos.creatureIndex).toFixed(4)} SOL
                                            </div>
                                        )}
                                        {isLoser && (
                                            <div className="text-sm text-red-400">
                                                Lost
                                            </div>
                                        )}
                                        {pos.claimed && (
                                            <div className="text-sm text-green-400">
                                                Already claimed
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {!battleOver ? (
                                            <>
                                                <button
                                                    onClick={() => handleSell(pos.creatureIndex, positionPDA, Math.floor(pos.shares / 2))}
                                                    disabled={selling}
                                                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
                                                >
                                                    {selling ? 'loading..' : 'Sell Half'}
                                                </button>

                                                <button
                                                    onClick={() => handleSell(pos.creatureIndex, positionPDA, pos.shares)}
                                                    disabled={selling}
                                                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
                                                >
                                                    {selling ? 'loading..' : 'Sell All'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {isWinner && !pos.claimed && (
                                                    <button
                                                        onClick={() => handleClaim(pos.creatureIndex, positionPDA)}
                                                        disabled={claiming}
                                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
                                                    >
                                                        {claiming ? 'Claiming...' : 'Claim Winnings'}
                                                    </button>
                                                )}
                                                {pos.claimed && (
                                                    <div className="text-green-400 font-bold px-4 py-2">
                                                        Claimed
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-gray-400">No positions yet. Buy some shares!</p>
            )}
        </div>
    );
}