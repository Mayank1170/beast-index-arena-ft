'use client';
import * as anchor from '@coral-xyz/anchor';
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { useProgram } from "../hooks/useProgram";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { PublicKey } from "@solana/web3.js";

const MARKET_POLL_INTERVAL = 3000; // Poll every 3 seconds

export function MarketView() {
    const [selectedCreature, setSelectedCreature] = useState(0);
    const [amount, setAmount] = useState(0.1);
    const [loading, setLoading] = useState(false);
    const [market, setMarket] = useState<any>(null);

    const wallet = useWallet();
    const program = useProgram();
    const { currentBattleId, battle } = useCurrentBattle();

    const fetchMarket = async (battleId: number) => {
        if (!program || !battleId) return;
        try {
            const [marketPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('market'),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                ],
                program.programId
            )
            const marketData = await program.account.marketState.fetch(marketPDA);
            setMarket(marketData);
        }
        catch (error) {
            console.error('Error fetching market:', error);
        }
    }

    // Real-time polling for market data
    useEffect(() => {
        if (!program || !currentBattleId) return;

        // Fetch immediately
        fetchMarket(currentBattleId);

        // Set up polling interval
        const interval = setInterval(() => {
            fetchMarket(currentBattleId);
        }, MARKET_POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [program, currentBattleId]);


    const handleBuy = async () => {
        if (!wallet.connected || !program) {
            alert('Please connect your wallet to buy shares');
            return;
        }

        if (!currentBattleId) {
            alert('No active battle found');
            return;
        }

        // Check if battle is over
        if (battle?.isBattleOver) {
            alert('⚠️ This battle is over! Wait for the next battle to start.');
            return;
        }

        setLoading(true);
        const lamports = Math.floor(parseFloat(amount) * 1_000_000_000);
        console.log('Amount:', amount, 'SOL =', lamports, 'lamports');
        const [battlePDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('battle'),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer))
            ],
            program.programId
        );

        const [marketPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('market'),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer))
            ],
            program.programId
        );

        const [userPositionPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('position'),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(currentBattleId)]).buffer)),
                wallet.publicKey?.toBuffer(),
                Buffer.from([selectedCreature])
            ],
            program.programId
        );

        console.log('Battle PDA:', battlePDA.toBase58());
        console.log('Market PDA:', marketPDA.toBase58());
        console.log('User Position PDA:', userPositionPDA.toBase58());
        try {
            console.log('🎯 Calling place_bet...');

            const tx = await program.methods
                .placeBet(selectedCreature, new anchor.BN(lamports))
                .accounts({
                    marketState: marketPDA,
                    battleState: battlePDA,
                    userPosition: userPositionPDA,
                    user: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log('✅ Success! Tx:', tx);
            alert('✅ Bet placed!\n\nTx: ' + tx);
            await fetchMarket(currentBattleId);
            setLoading(false);

        } catch (error) {
            console.error('❌ Error:', error);
            alert('❌ Failed: ' + error);
            setLoading(false);
        }
    };
    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <div className="mb-6">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white">
                            Market Pools - Battle #{currentBattleId || '...'}
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-500">LIVE</span>
                        </div>
                    </div>

                    {market ? (
                        <div className="space-y-2">
                            {[0, 1, 2, 3].map((index) => {
                                const pools = [
                                    market.creature0Pool,
                                    market.creature1Pool,
                                    market.creature2Pool,
                                    market.creature3Pool
                                ];
                                const pool = pools[index].toNumber();
                                const poolSOL = (pool / 1_000_000_000).toFixed(3);
                                const totalPool = market.totalPool.toNumber();
                                const percentage = totalPool > 0 ? ((pool / totalPool) * 100).toFixed(1) : '0.0';
                                return (
                                    <div key={index} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                                        <span className="text-white font-bold">Creature {index}</span>
                                        <div className="flex gap-4">
                                            <span className="text-green-400">{percentage}%</span>
                                            <span className="text-blue-400">{poolSOL} SOL</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-400">Loading...</p>
                    )}
                </div>
                {market ? (
                    <div className="bg-gray-700 p-4 rounded">
                        <div className="text-gray-400 text-sm">Total Pool</div>
                        <div className="text-2xl font-bold text-white">
                            {(market.totalPool.toNumber() / 1_000_000_000).toFixed(2)} SOL
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400">Loading market data...</p>
                )}
            </div>

            {battle?.isBattleOver && (
                <div className="bg-yellow-500 text-black p-4 rounded mb-6 text-center font-bold">
                    ⚠️ Battle Over! Wait for next battle to start...
                </div>
            )}

            <h2 className="text-2xl font-bold text-white mb-6">
                Place Your Bet
            </h2>

            <div className="mb-6">
                <label className="text-white block mb-2">Select Creature:</label>
                <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((index) => (
                        <button
                            onClick={() => setSelectedCreature(index)}
                            key={index}
                            className={`p-3 rounded border-2 ${selectedCreature === index
                                ? 'bg-blue-600 border-blue-400'
                                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                                }`}
                        >
                            <div className="text-white font-bold">
                                Creature {index}
                            </div>
                        </button>
                    ))}
                </div>
                <div className="mb-6">
                    <label className="text-white block mb-2">
                        Amount (SOL):
                    </label>
                    <input
                        type="number"
                        value={amount}
                        step={0.1}
                        min={0.1}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600"
                        placeholder="0.1"
                    />
                    <button
                        onClick={handleBuy}
                        disabled={loading || battle?.isBattleOver}
                        className={`w-full font-bold py-3 px-4 rounded ${
                            loading || battle?.isBattleOver
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        } text-white`}
                    >
                        {loading ? '⏳ Processing...' :
                         battle?.isBattleOver ? '⚠️ Battle Over' :
                         `🎯 Buy Shares on Creature ${selectedCreature}`}
                    </button>
                </div>
            </div>
        </div>
    );
}