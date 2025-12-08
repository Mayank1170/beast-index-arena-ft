import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

const POLL_INTERVAL = 5000; // Poll every 5 seconds

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
                    const positionData = await program.account.userPosition.fetch(positionPDA);

                    // Only include if position actually has shares (user is not default)
                    if (positionData.user.toString() !== PublicKey.default.toString()) {
                        userPositions.push({
                            creatureIndex,
                            shares: positionData.amount.toNumber(),
                            claimed: positionData.claimed,
                            pda: positionPDA.toBase58(),
                        });
                    }
                } catch (err) {
                    // Position doesn't exist for this creature, skip
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
