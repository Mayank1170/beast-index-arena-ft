import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";

const STARTING_BATTLE_ID = 102; // Same as bot config
const POLL_INTERVAL = 3000; // Poll every 3 seconds for real-time updates

export function useCurrentBattle() {
    const program = useProgram();
    const [currentBattleId, setCurrentBattleId] = useState<number>(STARTING_BATTLE_ID);
    const [battle, setBattle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            await program.account.battleState.fetch(pda);
            return true;
        } catch {
            return false;
        }
    };

    // Find the latest active battle
    const findLatestBattle = async (): Promise<number> => {
        if (!program) return currentBattleId;

        // Start from current battle ID and check forward
        let checkId = currentBattleId;
        let latestFound = currentBattleId;

        // Check up to 10 battles ahead
        for (let i = 0; i < 10; i++) {
            const exists = await battleExists(checkId);
            if (exists) {
                latestFound = checkId;
                checkId++;
            } else {
                break;
            }
        }

        return latestFound;
    };

    // Fetch battle data
    const fetchBattle = async (battleId: number) => {
        if (!program) return;

        try {
            const pda = getBattlePDA(battleId);
            if (!pda) return;

            const battleData = await program.account.battleState.fetch(pda);
            setBattle(battleData);
            setError(null);
            setLoading(false);

            // If current battle is over, check for next battle
            if (battleData.isBattleOver) {
                console.log(`🏁 Battle #${battleId} is over, checking for next battle...`);
                const nextBattleId = battleId + 1;
                const nextExists = await battleExists(nextBattleId);

                if (nextExists) {
                    console.log(`✅ Found next battle #${nextBattleId}, switching...`);
                    setCurrentBattleId(nextBattleId);
                }
            }

        } catch (err: any) {
            console.error('Error fetching battle:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    // Initial setup: find latest battle
    useEffect(() => {
        if (!program) return;

        const initialize = async () => {
            setLoading(true);
            const latestBattleId = await findLatestBattle();
            console.log(`🎮 Latest battle found: #${latestBattleId}`);
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
        refresh: () => fetchBattle(currentBattleId),
    };
}
