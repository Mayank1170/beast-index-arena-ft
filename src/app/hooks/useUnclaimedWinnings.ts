import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

const POLL_INTERVAL = 20000; // Poll every 20 seconds (slower since historical data)

interface UnclaimedWinning {
    battleId: number;
    creatureIndex: number;
    shares: number;
    pda: string;
    totalPool: number;
    winningPool: number;
}

export function useUnclaimedWinnings(currentBattleId: number | null) {
    const program = useProgram();
    const wallet = useWallet();
    const [unclaimedWinnings, setUnclaimedWinnings] = useState<UnclaimedWinning[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUnclaimedWinnings = async () => {
        if (!program || !wallet.publicKey || !currentBattleId) {
            setUnclaimedWinnings([]);
            setLoading(false);
            return;
        }

        try {
            const winnings: UnclaimedWinning[] = [];

            // Check last 10 battles (including current one)
            const startBattleId = Math.max(0, currentBattleId - 9);

            for (let battleId = startBattleId; battleId <= currentBattleId; battleId++) {
                try {
                    // Get battle state
                    const [battlePDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from('battle'),
                            Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                        ],
                        program.programId
                    );

                    const battleData = await (program.account as any).battleState.fetch(battlePDA);

                    // Skip if battle isn't over
                    if (!battleData.isBattleOver) continue;

                    // Get market state
                    const [marketPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from('market'),
                            Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
                        ],
                        program.programId
                    );

                    const marketData = await (program.account as any).marketState.fetch(marketPDA);

                    // Check all 4 creatures for user positions
                    for (let creatureIndex = 0; creatureIndex < 4; creatureIndex++) {
                        try {
                            const [positionPDA] = PublicKey.findProgramAddressSync(
                                [
                                    Buffer.from('position'),
                                    Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer)),
                                    wallet.publicKey.toBuffer(),
                                    Buffer.from([creatureIndex])
                                ],
                                program.programId
                            );

                            const positionData = await (program.account as any).userPosition.fetch(positionPDA);

                            // Check if this is a winning position that hasn't been claimed
                            if (
                                positionData.user.toString() !== PublicKey.default.toString() &&
                                !positionData.claimed &&
                                battleData.winner === creatureIndex
                            ) {
                                const pools = [
                                    marketData.creature0Pool,
                                    marketData.creature1Pool,
                                    marketData.creature2Pool,
                                    marketData.creature3Pool
                                ];

                                winnings.push({
                                    battleId,
                                    creatureIndex,
                                    shares: positionData.amount.toNumber(),
                                    pda: positionPDA.toBase58(),
                                    totalPool: marketData.totalPool.toNumber(),
                                    winningPool: pools[creatureIndex].toNumber(),
                                });
                            }
                        } catch (err: any) {
                            // Position doesn't exist for this creature, skip
                            continue;
                        }
                    }
                } catch (err: any) {
                    // Battle doesn't exist or error fetching, skip
                    continue;
                }
            }

            setUnclaimedWinnings(winnings);
            setLoading(false);

        } catch (err) {
            console.error('Error fetching unclaimed winnings:', err);
            setLoading(false);
        }
    };

    // Real-time polling for unclaimed winnings
    useEffect(() => {
        if (!program || !wallet.publicKey || !currentBattleId) {
            setUnclaimedWinnings([]);
            setLoading(false);
            return;
        }

        // Fetch immediately
        fetchUnclaimedWinnings();

        // Set up polling interval
        const interval = setInterval(() => {
            fetchUnclaimedWinnings();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [program, wallet.publicKey, currentBattleId]);

    return {
        unclaimedWinnings,
        loading,
        refresh: fetchUnclaimedWinnings,
    };
}
