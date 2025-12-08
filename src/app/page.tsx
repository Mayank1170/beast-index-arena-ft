"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BattleView } from "./components/BattleView";
import { MarketView } from "./components/MarketView";
import { UserPosition } from "./components/UserPosition";

export default function Home() {

  const { publicKey, connected } = useWallet();
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">
          🐉 Beast Index Arena
        </h1>

        <WalletMultiButton />
      </div>
      {connected ? (
        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <div className="text-green-500 mb-2">✅ Wallet Connected</div>
          <div className="text-sm text-gray-400">
            {publicKey?.toBase58()}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <div className="text-yellow-500 mb-2">⚠️ Wallet Not Connected</div>
          <div className="text-sm text-gray-400">
            Please connect your wallet to continue
          </div>
        </div>
      )}

      {connected && (
        <div className="grid lg:grid-cols-2 gap-8">
          <BattleView />
          <MarketView />
        </div>

      )}
      {connected && (
        <div className="mt-8">
          <UserPosition />
        </div>
      )}
    </main>
  );
}