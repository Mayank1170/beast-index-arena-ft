import { useEffect, useState } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import { retryWithBackoff } from "../utils/rpcRetry";

const POLL_INTERVAL = 5000;
const BEAST_NAMES = ["YETI", "MAPINGUARI", "ZMEY", "NAGA"];

export interface BattleEvent {
    turn: number;
    message: string;
    type: "attack" | "death" | "victory";
    timestamp: number;
}

export function useCurrentBattle() {
    const program = useProgram();
    const [currentBattleId, setCurrentBattleId] = useState<number | null>(null);
    const [battle, setBattle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [battleLogs, setBattleLogs] = useState<BattleEvent[]>([]);
    const [previousBattleState, setPreviousBattleState] = useState<any>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setBattleLogs(prev => {
                const filtered = prev.filter(log => now - log.timestamp < 15000); // Keep logs < 15 seconds old
                return filtered;
            });
        }, 1000); 
        return () => clearInterval(interval);
    }, []);

    const fetchBattleIdFromAPI = async (): Promise<number | null> => {
        try {
            const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://140.238.244.166:3001';
            const response = await fetch(`${botApiUrl}/current-battle`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            if (response.ok) {
                const data = await response.json();
                return data.battleId;
            } else {
                console.log(`⚠️ Bot API returned ${response.status}`);
            }
        } catch (error) {
            console.log(`⚠️ Bot API not available:`, error);
        }
        return null;
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


    const generateEvents = (newState: any, oldState: any | null): BattleEvent[] => {
        const events: BattleEvent[] = [];
        const currentTurn = typeof newState.currentTurn?.toNumber === 'function'
            ? newState.currentTurn.toNumber()
            : newState.currentTurn;

        if (!oldState) {
            return events;
        }

        const attackOrder = [0, 1, 2, 3]
            .map(i => ({ index: i, speed: newState.creatureSpd[i], alive: oldState.isAlive[i] }))
            .filter(c => c.alive)
            .sort((a, b) => b.speed - a.speed); 
        const damagedCreatures: Array<{ index: number; damage: number; attacker: number | null }> = [];
        for (let i = 0; i < 4; i++) {
            const oldHp = oldState.creatureHp[i];
            const newHp = newState.creatureHp[i];
            if (newHp < oldHp) {
                const attackerIdx = attackOrder.find(a => a.index !== i);
                damagedCreatures.push({
                    index: i,
                    damage: oldHp - newHp,
                    attacker: attackerIdx ? attackerIdx.index : null
                });
            }
        }

        const attackNames = [
            "Claw Strike", "Bite", "Tail Whip", "Charge", "Slash",
            "Stomp", "Roar Attack", "Venomous Strike", "Thunder Blow", "Ice Shard"
        ];

        damagedCreatures.forEach((damaged, idx) => {
            const target = BEAST_NAMES[damaged.index];

            let attackerIndex = damaged.attacker;
            if (attackerIndex === null && attackOrder.length > 0) {
                attackerIndex = attackOrder[idx % attackOrder.length].index;
            }

            const attacker = attackerIndex !== null ? BEAST_NAMES[attackerIndex] : "Unknown";

            const attackName = attackNames[attackerIndex !== null ? attackerIndex % attackNames.length : 0];

            events.push({
                turn: currentTurn,
                message: `${attacker} attacks ${target} with ${attackName}`,
                type: "attack",
                timestamp: Date.now() + idx
            });
        });

        for (let i = 0; i < 4; i++) {
            if (oldState.isAlive[i] && !newState.isAlive[i]) {
                events.push({
                    turn: currentTurn,
                    message: `💀 ${BEAST_NAMES[i]} has been defeated!`,
                    type: "death",
                    timestamp: Date.now() + 1000
                });
            }
        }

        if (!oldState.isBattleOver && newState.isBattleOver) {
            const winnerIndex = typeof newState.winner?.toNumber === 'function'
                ? newState.winner.toNumber()
                : newState.winner;

            if (winnerIndex !== null && winnerIndex !== undefined) {
                events.push({
                    turn: currentTurn,
                    message: `🏆 ${BEAST_NAMES[winnerIndex]} WINS THE BATTLE!`,
                    type: "victory",
                    timestamp: Date.now() + 2000
                });
            }
        }

        return events;
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

            const newEvents = generateEvents(battleData, previousBattleState);
            if (newEvents.length > 0) {
                setBattleLogs(prev => [...newEvents, ...prev].slice(0, 50)); // Keep last 50 events
            }

            setPreviousBattleState(battleData);
            setBattle(battleData);
            setError(null);
            setLoading(false);

            if (battleData.isBattleOver) {
                const nextBattleId = await fetchBattleIdFromAPI();

                if (nextBattleId !== null && nextBattleId > battleId) {
                    setCurrentBattleId(nextBattleId);
                    setBattleLogs([]);
                    setPreviousBattleState(null);
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

    useEffect(() => {
        if (!program) return;

        const initialize = async () => {
            setLoading(true);

            const latestBattleId = await fetchBattleIdFromAPI();

            if (latestBattleId === null) {
                setError('Connecting to battle server...');
                setLoading(false);

                // Retry after 10 seconds
                setTimeout(() => initialize(), 10000);
                return;
            }

            setCurrentBattleId(latestBattleId);
            await fetchBattle(latestBattleId);
        };

        initialize();
    }, [program]);

    useEffect(() => {
        if (!program || !currentBattleId) return;

        // Fetch immediately
        fetchBattle(currentBattleId);

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
        battleLogs,
        refresh: () => currentBattleId !== null && fetchBattle(currentBattleId),
    };
}
