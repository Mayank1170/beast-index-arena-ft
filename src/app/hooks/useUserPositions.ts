import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { retryWithBackoff } from "../utils/rpcRetry";

const POLL_INTERVAL = 15000; // Poll every 15 seconds to avoid rate limits

export function useUserPositions(battleId: number | null) {
    const program = useProgram();
    const wallet = useWallet();
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPositions = async () => {
        if (!program || !wallet.publicKey || !battleId) {
            setPositions([]);
            setLoading(false);
            return;
        }

        try {
            const userPositions: any[] = [];

            // Check all 4 creatures for user positions
            for (let creatureIndex = 0; creatureIndex < 4; creatureIndex++) {
                const [positionPDA] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('position'),
                        Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer)),
                        wallet.publicKey.toBuffer(),
                        Buffer.from([creatureIndex])
                    ],
                    program.programId
                );

                try {
                    const positionData = await retryWithBackoff(async () => {
                        return await (program.account as any).userPosition.fetch(positionPDA);
                    });

                    // Only include if position actually has shares (user is not default)
                    if (positionData.user.toString() !== PublicKey.default.toString()) {
                        userPositions.push({
                            creatureIndex,
                            shares: positionData.amount.toNumber(),
                            claimed: positionData.claimed,
                            pda: positionPDA.toBase58(),
                        });
                    }
                } catch (err: any) {
                    // Position doesn't exist for this creature, skip silently
                    // Don't log to avoid console spam
                    continue;
                }
            }

            setPositions(userPositions);
            setLoading(false);

        } catch (err) {
            console.error('Error fetching user positions:', err);
            setLoading(false);
        }
    };

    // Real-time polling for user positions
    useEffect(() => {
        if (!program || !wallet.publicKey || !battleId) {
            setPositions([]);
            setLoading(false);
            return;
        }

        // Fetch immediately
        fetchPositions();

        // Set up polling interval
        const interval = setInterval(() => {
            fetchPositions();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [program, wallet.publicKey, battleId]);

    return {
        positions,
        loading,
        refresh: fetchPositions,
    };
}
