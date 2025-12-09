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

    // Helper to get global state PDA
    const getGlobalPDA = () => {
        if (!program) return null;
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global')],
            program.programId
        );
        return pda;
    };

    // Helper to get current battle ID from global state
    const getCurrentBattleId = async (): Promise<number | null> => {
        if (!program) return null;
        try {
            const globalPDA = getGlobalPDA();
            if (!globalPDA) return null;

            const globalState = await retryWithBackoff(async () => {
                return await (program.account as any).globalState.fetch(globalPDA);
            });
            const battleId = typeof globalState.currentBattleId?.toNumber === 'function'
                ? globalState.currentBattleId.toNumber()
                : globalState.currentBattleId;
            console.log(`🌍 Current battle ID from chain: ${battleId}`);
            return battleId;
        } catch (error: any) {
            console.error("Failed to fetch current battle ID:", error?.message || error);
            return null;
        }
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

            // If current battle is over, check global state for latest battle
            if (battleData.isBattleOver) {
                console.log(`🏁 Battle #${battleId} is over, checking for latest battle...`);
                const latestBattleId = await getCurrentBattleId();

                if (latestBattleId !== null && latestBattleId > battleId) {
                    console.log(`✅ Jumping to latest battle #${latestBattleId}`);
                    setCurrentBattleId(latestBattleId);
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

    // Initial setup: get current battle from global state
    useEffect(() => {
        if (!program) return;

        const initialize = async () => {
            setLoading(true);
            console.log(`🔍 Fetching current battle ID from global state...`);
            const latestBattleId = await getCurrentBattleId();

            if (latestBattleId === null) {
                console.log(`❌ No battle ID found in global state`);
                setLoading(false);
                return;
            }

            console.log(`🎮 Current battle: #${latestBattleId}`);
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
