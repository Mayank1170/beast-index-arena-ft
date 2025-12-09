import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import { retryWithBackoff } from "../utils/rpcRetry";

const POLL_INTERVAL = 15000; // Poll every 15 seconds to avoid rate limits

export function useCurrentBattle() {
    const program = useProgram();
    const [currentBattleId, setCurrentBattleId] = useState<number | null>(null);
    const [battle, setBattle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper to find the latest battle by searching recent battle IDs
    const findLatestBattle = async (startFrom: number): Promise<number | null> => {
        if (!program) return null;

        console.log(`🔍 Searching for battles starting from #${startFrom}...`);
        let lastFoundBattle: number | null = null;

        // Search forward up to 100 battles
        for (let offset = 0; offset < 100; offset++) {
            const battleId = startFrom + offset;
            try {
                const pda = getBattlePDA(battleId);
                if (!pda) continue;

                console.log(`  Checking battle #${battleId}...`);

                const battleData = await retryWithBackoff(async () => {
                    return await (program.account as any).battleState.fetch(pda);
                });

                lastFoundBattle = battleId;

                // If this battle exists and is not over, it's the current one
                if (!battleData.isBattleOver) {
                    console.log(`✅ Found ACTIVE battle: #${battleId}`);
                    return battleId;
                }

                console.log(`  Battle #${battleId} is over, checking next...`);
                // If battle is over, continue to next
                continue;
            } catch (error: any) {
                const errorMsg = error?.message || String(error);

                // If account doesn't exist, we've gone too far
                if (errorMsg.includes('Account does not exist') || errorMsg.includes('could not find account')) {
                    if (lastFoundBattle !== null) {
                        console.log(`🏁 Latest battle is #${lastFoundBattle} (next doesn't exist yet)`);
                        return lastFoundBattle;
                    }
                    console.log(`❌ Battle #${battleId} not found`);
                    break;
                }

                console.warn(`⚠️ Error checking battle #${battleId}:`, errorMsg);
                // For other errors, try a few more times before giving up
                if (offset < 5) continue;
                break;
            }
        }

        return lastFoundBattle;
    };

    // Helper to get battle PDA
    const getBattlePDA = (battleId: number) => {
        if (!program) return null;
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('battle'),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(battleId)]).buffer))
            ],
            program.programId
        );
        return pda;
    };

    // Helper to check if battle exists
    const battleExists = async (battleId: number): Promise<boolean> => {
        if (!program) return false;
        try {
            const pda = getBattlePDA(battleId);
            if (!pda) return false;
            await retryWithBackoff(async () => {
                return await (program.account as any).battleState.fetch(pda);
            });
            return true;
        } catch {
            return false;
        }
    };


    // Fetch battle data
    const fetchBattle = async (battleId: number) => {
        if (!program) return;

        try {
            const pda = getBattlePDA(battleId);
            if (!pda) return;

            const battleData = await retryWithBackoff(async () => {
                return await (program.account as any).battleState.fetch(pda);
            });

            setBattle(battleData);
            setError(null);
            setLoading(false);

            // If current battle is over, search for the next battle
            if (battleData.isBattleOver) {
                console.log(`🏁 Battle #${battleId} is over, checking for next battle...`);
                const nextBattleId = await findLatestBattle(battleId + 1);

                if (nextBattleId !== null && nextBattleId > battleId) {
                    console.log(`✅ Jumping to battle #${nextBattleId}`);
                    setCurrentBattleId(nextBattleId);
                } else {
                    console.log(`⏳ No new battles yet, waiting...`);
                }
            }

        } catch (err: any) {
            const errorMsg = err?.message || String(err);
            console.error('Error fetching battle:', errorMsg);

            // Only set error state for non-account-not-found errors
            if (!errorMsg.includes('Account does not exist')) {
                setError(errorMsg);
            }
            setLoading(false);
        }
    };

    // Initial setup: find the latest battle
    useEffect(() => {
        if (!program) return;

        const initialize = async () => {
            setLoading(true);
            console.log(`🔍 Searching for latest battle...`);

            // Start searching from a known recent battle
            // Bot is currently around #375-380
            const startBattleId = 375;
            console.log(`🔍 Starting search from battle #${startBattleId}`);
            const latestBattleId = await findLatestBattle(startBattleId);

            if (latestBattleId === null) {
                console.log(`❌ No active battles found`);
                setLoading(false);
                return;
            }

            console.log(`🎮 Latest battle: #${latestBattleId}`);
            setCurrentBattleId(latestBattleId);
            await fetchBattle(latestBattleId);
        };

        initialize();
    }, [program]);

    // Real-time polling: fetch battle data every few seconds
    useEffect(() => {
        if (!program || !currentBattleId) return;

        // Fetch immediately
        fetchBattle(currentBattleId);

        // Set up polling interval
        const interval = setInterval(() => {
            fetchBattle(currentBattleId);
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [program, currentBattleId]);

    return {
        currentBattleId,
        battle,
        loading,
        error,
        refresh: () => currentBattleId !== null && fetchBattle(currentBattleId),
    };
}
