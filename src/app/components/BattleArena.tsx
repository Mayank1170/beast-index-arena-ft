"use client";
import { useState, useEffect } from "react";
import { useCurrentBattle } from "../hooks/useCurrentBattle";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MarketActions } from "./MarketActions";
import Image from "next/image";

const BEAST_CONFIG = [
  {
    id: 0,
    name: "YETI",
    country: "Nepal",
    image: "/beasts/yeti/yeti.png",
    imageDead: "/beasts/yeti/Yeti_dead.png",
    imageWin: "/beasts/yeti/yeti_win.png",
    color: "from-blue-500/20 to-blue-900/40",
    glowColor: "shadow-blue-500/50",
    borderColor: "border-blue-400",
  },
  {
    id: 1,
    name: "MAPINGUARI",
    country: "Brazil",
    image: "/beasts/mapinguari/mapinguari.png",
    imageDead: "/beasts/mapinguari/mapinguari_dead.png",
    imageWin: "/beasts/mapinguari/mapinguari_win.png",
    color: "from-amber-500/20 to-amber-900/40",
    glowColor: "shadow-amber-500/50",
    borderColor: "border-amber-600",
  },
  {
    id: 2,
    name: "ZMEY",
    country: "Russia",
    image: "/beasts/zmey/zmey.png",
    imageDead: "/beasts/zmey/Zmey_dead.png",
    imageWin: "/beasts/zmey/Zmey_win.png",
    color: "from-red-500/20 to-red-900/40",
    glowColor: "shadow-red-500/50",
    borderColor: "border-red-500",
  },
  {
    id: 3,
    name: "NAGA",
    country: "India",
    image: "/beasts/naga/naga.png",
    imageDead: "/beasts/naga/naga_dead.png",
    imageWin: "/beasts/naga/Naga_win.png",
    color: "from-emerald-500/20 to-emerald-900/40",
    glowColor: "shadow-emerald-500/50",
    borderColor: "border-emerald-400",
  },
];

export function BattleArena() {
  const { currentBattleId, battle, loading } = useCurrentBattle();
  const wallet = useWallet();
  const [previousHp, setPreviousHp] = useState<number[]>([100, 100, 100, 100]);
  const [damagedCreatures, setDamagedCreatures] = useState<boolean[]>([false, false, false, false]);

  useEffect(() => {
    if (!battle) return;
    const currentHp = battle.creatureHp;
    const damaged = currentHp.map((hp: number, idx: number) => hp < previousHp[idx]);
    setDamagedCreatures(damaged);

    const timeout = setTimeout(() => {
      setDamagedCreatures([false, false, false, false]);
    }, 500);

    setPreviousHp(currentHp);
    return () => clearTimeout(timeout);
  }, [battle?.currentTurn]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          {/* <div className="text-6xl mb-4 animate-pulse">Sword</div> */}
          <div className="text-2xl font-black">LOADING ARENA...</div>
        </div>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <div className="text-2xl font-black mb-4">WAITING FOR NEXT BATTLE</div>
          <div className="text-sm text-slate-400">Bot creates new battles every ~60 seconds</div>
          <div className="text-sm text-slate-400 mt-2">The page will automatically refresh...</div>
        </div>
      </div>
    );
  }

  const isWinner = (index: number) => {
    if (!battle?.isBattleOver || battle.winner === null) return false;
    const winnerIndex = typeof battle.winner?.toNumber === 'function'
      ? battle.winner.toNumber()
      : battle.winner;
    return winnerIndex === index;
  };

  // Safe conversion helpers
  const battleId = currentBattleId;
  const currentTurn = typeof battle.currentTurn?.toNumber === 'function'
    ? battle.currentTurn.toNumber()
    : battle.currentTurn;

  return (
    <div className="min-h-screen relative overflow-hidden font-mono">
      <div className="absolute inset-0 z-0">
        <Image
          src="/backgrounds/background2.jpg"
          alt="Arena Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="w-full flex justify-between items-center p-4 md:p-6 bg-black/40 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Cryptids Arena Logo"
              width={80}
              height={80}
              className=""
              priority
            />
            <div>
              {/* <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
                CRYPTIDS ARENA
              </h1> */}
              <div className="flex gap-2 mt-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded-full border border-green-500/30 backdrop-blur-sm flex items-center gap-1">
                  BATTLE #{battleId}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right bg-black/50 px-4 py-2 rounded-lg border border-white/20 backdrop-blur-sm">
              <div className="text-xs text-slate-400 font-bold tracking-widest">
                TURN {currentTurn}
              </div>
              <div className="text-lg font-black text-white flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                LIVE
              </div>
            </div>
            <WalletMultiButton />
          </div>
        </header>

        {battle.isBattleOver && (
          <div className="w-full py-2 text-black text-center bg-yellow-400">
            <div className="text-3xl md:text-5xl font-black animate-pulse">
              Trophy BATTLE OVER! Trophy
            </div>
            <div className="text-xl md:text-3xl font-black mt-2">
              WINNER: {battle.winner !== null ? BEAST_CONFIG[typeof battle.winner?.toNumber === 'function' ? battle.winner.toNumber() : battle.winner].name : "DRAW"}
            </div>
          </div>
        )}

        <div className="flex-1 relative min-h-[900px]">
          {BEAST_CONFIG.map((beast, index) => {
            const hp = battle.creatureHp[index];
            const maxHp = battle.creatureMaxHp[index];
            const alive = battle.isAlive[index];
            const winner = isWinner(index);
            const hpPercent = (hp / maxHp) * 100;
            const isDamaged = damagedCreatures[index];

            let imageSrc = beast.image;
            if (winner) imageSrc = beast.imageWin;
            else if (!alive) imageSrc = beast.imageDead;

            const positionClasses = [
              "absolute top-8 left-8",
              "absolute top-8 right-8",
              "absolute bottom-8 left-8",
              "absolute bottom-8 right-8",
            ];

            return (
              <div
                key={beast.id}
                className={`${positionClasses[index]} w-72 rounded-xl overflow-hidden transition-all duration-300 ${alive
                  ? `bg-gradient-to-br ${beast.color} ${isDamaged ? "animate-shake" : ""}`
                  : "bg-slate-900/50 opacity-80 grayscale"
                  } ${winner ? "ring-4 ring-yellow-400 shadow-2xl shadow-yellow-500/50" : ""} border-2 ${beast.borderColor} backdrop-blur-sm`}
              >
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{beast.country}</span>
                      <h2 className="text-sm font-black text-white drop-shadow-lg">{beast.name}</h2>
                    </div>
                    <div className="bg-black/80 px-2 py-0.5 rounded-full">
                      <span className={`text-base font-black ${hp < 30 ? "text-red-400 animate-pulse" : "text-white"}`}>
                        {hp}
                      </span>
                      <span className="text-xs text-slate-400"> / {maxHp}</span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/30 shadow-lg">
                    <div
                      className={`h-full transition-all duration-300 ${hpPercent > 60
                        ? "bg-gradient-to-r from-green-400 to-green-600"
                        : hpPercent > 30
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                          : "bg-gradient-to-r from-red-500 to-red-700 animate-pulse"
                        }`}
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>

                <div className="h-40 flex items-center justify-center px-3 pb-2 relative">
                  <div className={`relative ${isDamaged ? "animate-damage-flash" : ""}`}>
                    <Image
                      src={imageSrc}
                      alt={beast.name}
                      width={150}
                      height={150}
                      className={`object-contain drop-shadow-2xl transition-all duration-300 ${alive ? "scale-100" : "scale-90 opacity-60"
                        } ${winner ? "animate-bounce" : ""}`}
                      priority
                    />
                    {alive && !battle.isBattleOver && (
                      <div className={`absolute inset-0 ${beast.glowColor} blur-2xl opacity-30 -z-10 animate-pulse`}></div>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 backdrop-blur-md border-t border-white/10">
                  <MarketActions
                    creatureIndex={index}
                    creatureName={beast.name}
                    isAlive={alive}
                    battleOver={battle.isBattleOver}
                  />
                </div>

                {!alive && (
                  <div className="absolute top-2 right-2 z-40">
                    <div className="bg-gradient-to-br from-red-600 to-red-800 text-white font-black text-xs px-2.5 py-1 rounded-full shadow-xl border-2 border-red-400">
                      Skull ELIMINATED
                    </div>
                  </div>
                )}

                {winner && (
                  <div className="absolute top-2 right-2 z-40">
                    <div className="bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 text-black font-black text-xs px-2.5 py-1 rounded-full shadow-2xl animate-pulse border-2 border-yellow-200">
                      Crown CHAMPION
                    </div>
                  </div>
                )}

                {alive && hp < 30 && !battle.isBattleOver && (
                  <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-full animate-bounce shadow-lg">
                      Warning CRITICAL!
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-full bg-black/60 backdrop-blur-md border-t border-white/10 p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-slate-400 text-xs font-bold tracking-widest">BATTLE ID</div>
              <div className="text-white text-xl font-black">#{battleId}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs font-bold tracking-widest">CURRENT TURN</div>
              <div className="text-white text-xl font-black">{currentTurn}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs font-bold tracking-widest">CREATURES ALIVE</div>
              <div className="text-green-400 text-xl font-black">
                {battle.isAlive.filter((a: boolean) => a).length} / 4
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs font-bold tracking-widest">STATUS</div>
              <div className={`text-xl font-black ${battle.isBattleOver ? "text-red-400" : "text-green-400"}`}>
                {battle.isBattleOver ? "Cross ENDED" : "Fire FIGHTING"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}