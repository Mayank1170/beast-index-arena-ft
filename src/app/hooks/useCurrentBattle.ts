import { useEffect, useState, useRef } from "react";
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
    const previousBattleStateRef = useRef<any>(null);


    const fetchBattleIdFromAPI = async (): Promise<number | null> => {
        try {
            // Use Next.js API route to avoid mixed content issues on HTTPS
            const response = await fetch('/api/current-battle', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            if (response.ok) {
                const data = await response.json();
                return data.battleId;
            }
        } catch (error) {
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

        console.log('🔍 generateEvents called');
        console.log('  New state turn:', currentTurn);
        console.log('  Old state exists:', !!oldState);

        if (!oldState) {
            console.log('  ⚠️ No old state, returning empty events');
            return events;
        }

        const oldTurn = typeof oldState.currentTurn?.toNumber === 'function'
            ? oldState.currentTurn.toNumber()
            : oldState.currentTurn;

        console.log('  Old turn:', oldTurn);
        console.log('  Turn changed:', currentTurn > oldTurn);

        const turnChanged = currentTurn > oldTurn;

        if (!turnChanged) {
            console.log('  ⏸️ No turn change, checking deaths/victory only');
            for (let i = 0; i < 4; i++) {
                if (oldState.isAlive[i] && !newState.isAlive[i]) {
                    console.log(`  💀 Creature ${i} died`);
                    events.push({
                        turn: currentTurn,
                        message: `💀 ${BEAST_NAMES[i]} has been defeated!`,
                        type: "death",
                        timestamp: Date.now()
                    });
                }
            }

            if (!oldState.isBattleOver && newState.isBattleOver) {
                const winnerIndex = typeof newState.winner?.toNumber === 'function'
                    ? newState.winner.toNumber()
                    : newState.winner;

                console.log(`  🏆 Battle over, winner: ${winnerIndex}`);

                if (winnerIndex !== null && winnerIndex !== undefined) {
                    events.push({
                        turn: currentTurn,
                        message: `🏆 ${BEAST_NAMES[winnerIndex]} WINS THE BATTLE!`,
                        type: "victory",
                        timestamp: Date.now() + 1000
                    });
                }
            }

            console.log(`  ✅ Returning ${events.length} events (no turn change)`);
            return events;
        }

        console.log('  ⚔️ Turn changed! Generating attack logs...');

        const attackNames = [
            "Claw Strike", "Bite", "Tail Whip", "Charge", "Slash",
            "Stomp", "Roar Attack", "Venomous Strike", "Thunder Blow", "Ice Shard"
        ];

        const aliveCreatures = [0, 1, 2, 3]
            .filter(i => oldState.isAlive[i])
            .map(i => ({ index: i, speed: newState.creatureSpd[i] }))
            .sort((a, b) => b.speed - a.speed);

        console.log('  Alive creatures:', aliveCreatures.map(c => c.index));

        if (aliveCreatures.length === 0) {
            console.log('  ⚠️ No alive creatures, returning empty');
            return events;
        }

        const damagedCreatures: Array<{ index: number; damage: number }> = [];
        for (let i = 0; i < 4; i++) {
            const oldHp = oldState.creatureHp[i];
            const newHp = newState.creatureHp[i];
            console.log(`  Creature ${i}: HP ${oldHp} → ${newHp}`);
            if (newHp < oldHp && oldState.isAlive[i]) {
                console.log(`    💥 Took ${oldHp - newHp} damage!`);
                damagedCreatures.push({
                    index: i,
                    damage: oldHp - newHp
                });
            }
        }

        console.log('  Total damaged creatures:', damagedCreatures.length);

        if (damagedCreatures.length > 0) {
            console.log('  📝 Creating attack logs for damaged creatures...');
            damagedCreatures.forEach((damaged, idx) => {
                const target = BEAST_NAMES[damaged.index];

                const possibleAttackers = aliveCreatures.filter(c => c.index !== damaged.index);
                const attackerIndex = possibleAttackers.length > 0
                    ? possibleAttackers[idx % possibleAttackers.length].index
                    : aliveCreatures[0].index;

                const attacker = BEAST_NAMES[attackerIndex];
                const attackName = attackNames[(attackerIndex + currentTurn) % attackNames.length];

                console.log(`    ⚔️ ${attacker} → ${target}: ${attackName} (-${damaged.damage} HP)`);

                events.push({
                    turn: currentTurn,
                    message: `${attacker} attacks ${target} with ${attackName} (-${damaged.damage} HP)`,
                    type: "attack",
                    timestamp: Date.now() + (idx * 100)
                });
            });
        } else if (aliveCreatures.length >= 2) {
            console.log('  ⚠️ No damage detected, showing miss');
            const attacker = aliveCreatures[0];
            const target = aliveCreatures[1];
            events.push({
                turn: currentTurn,
                message: `${BEAST_NAMES[attacker.index]} attacks ${BEAST_NAMES[target.index]} but misses!`,
                type: "attack",
                timestamp: Date.now()
            });
        }

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

            console.log('  🏆 Battle ended, winner:', winnerIndex);

            if (winnerIndex !== null && winnerIndex !== undefined) {
                events.push({
                    turn: currentTurn,
                    message: `🏆 ${BEAST_NAMES[winnerIndex]} WINS THE BATTLE!`,
                    type: "victory",
                    timestamp: Date.now() + 2000
                });
            }
        }

        console.log(`  ✅ Generated ${events.length} total events`);
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

            const newEvents = generateEvents(battleData, previousBattleStateRef.current);
            console.log('🎯 Generated events:', newEvents.length, newEvents);
            if (newEvents.length > 0) {
                setBattleLogs(prev => {
                    const updated = [...newEvents, ...prev].slice(0, 100); // Keep more logs
                    console.log('📊 Battle logs updated. Total:', updated.length);
                    return updated;
                });
            }

            previousBattleStateRef.current = battleData;
            setBattle(battleData);
            setError(null);
            setLoading(false);

            if (battleData.isBattleOver) {
                const nextBattleId = await fetchBattleIdFromAPI();

                if (nextBattleId !== null && nextBattleId > battleId) {
                    console.log('🔄 New battle starting, clearing old logs');
                    setCurrentBattleId(nextBattleId);
                    setBattleLogs([]);
                    previousBattleStateRef.current = null;
                }
            }

        } catch (err: any) {
            const errorMsg = err?.message || String(err);

            if (!errorMsg.includes('Account does not exist')) {
                console.error('Error fetching battle:', errorMsg);
                setError(errorMsg);
                setLoading(false);
            }
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

            const pda = getBattlePDA(latestBattleId);
            if (pda) {
                try {
                    await (program.account as any).battleState.fetch(pda);
                    await fetchBattle(latestBattleId);
                } catch (err: any) {
                    if (err?.message?.includes('Account does not exist')) {
                        setBattle(null);
                        setLoading(false);
                    } else {
                        throw err;
                    }
                }
            }
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
