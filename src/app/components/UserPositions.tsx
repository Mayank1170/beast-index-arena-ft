import { useUserPositions } from "../hooks/useUserPositions";
import { useWallet } from "@solana/wallet-adapter-react";

interface UserPositionsProps {
    battleId: number | null;
}

export function UserPositions({ battleId }: UserPositionsProps) {
    const wallet = useWallet();
    const { positions, loading } = useUserPositions(battleId);

    if (!wallet.connected) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                    Your Bets
                </h3>
                <p className="text-gray-400">Connect wallet to see your bets</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                    Your Bets
                </h3>
                <p className="text-gray-400">Loading your positions...</p>
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                    Your Bets
                </h3>
                <p className="text-gray-400">You haven't placed any bets on this battle yet</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h3 className="text-xl font-bold text-white mb-4">
                Your Bets - Battle #{battleId}
            </h3>

            <div className="space-y-3">
                {positions.map((position) => (
                    <div
                        key={position.creatureIndex}
                        className="bg-gray-700 p-4 rounded-lg flex justify-between items-center"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                                {position.creatureIndex}
                            </div>
                            <div>
                                <div className="text-white font-bold">
                                    Creature {position.creatureIndex}
                                </div>
                                <div className="text-gray-400 text-sm">
                                    {position.shares.toLocaleString()} shares
                                </div>
                            </div>
                        </div>

                        <div>
                            {position.claimed ? (
                                <span className="text-green-500 font-semibold">
                                    ✅ Claimed
                                </span>
                            ) : (
                                <span className="text-yellow-500 font-semibold">
                                    ⏳ Active
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 p-3 bg-blue-900 rounded text-sm text-blue-200">
                💡 Tip: If your creature wins, you can claim your winnings even after the battle ends!
            </div>
        </div>
    );
}
