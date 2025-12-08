import { useCurrentBattle } from "../hooks/useCurrentBattle";

export const BattleView = () => {
    const { currentBattleId, battle, loading, error } = useCurrentBattle();

    if (loading) {
        return (
            <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400">⏳ Loading battle data...</div>
            </div>
        );
    }

    if (error || !battle) {
        return (
            <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-red-500">❌ Battle not found</div>
                <div className="text-gray-400 text-sm mt-2">
                    {error || "Make sure the bot is running and has created a battle"}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">
                        Battle #{battle.battleId.toString()}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-500">LIVE</span>
                    </div>
                </div>
                <div className="text-gray-400">
                    Turn: {battle.currentTurn.toString()}
                </div>
            </div>

            {battle.isBattleOver && (
                <div className="bg-yellow-500 text-black p-4 rounded mb-6 text-center font-bold">
                    🏆 Battle Over! 🏆
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {battle.creatureHp.map((hp: number, index: number) => (
                    <div
                        key={index}
                        className={`p-4 rounded-lg border-2 ${battle.isAlive[index]
                            ? 'bg-green-900 border-green-500'
                            : 'bg-red-900 border-red-500 opacity-50'
                            }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold text-white">
                                Creature {index}
                            </h3>
                            {!battle.isAlive[index] && (
                                <span className="text-red-500">💀</span>
                            )}
                        </div>

                        <div className="mb-2">
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                                <span>HP</span>
                                <span>{hp} / {battle.creatureMaxHp[index]}</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-4">
                                <div
                                    className={`h-4 rounded-full ${battle.isAlive[index] ? 'bg-green-500' : 'bg-red-500'
                                        }`}
                                    style={{
                                        width: `${(hp / battle.creatureMaxHp[index]) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <div className="text-sm text-gray-400">
                            {battle.isAlive[index] ? '✅ Alive' : '💀 Dead'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
