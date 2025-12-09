"use client";
import { BattleArena } from "./components/BattleArena";
import { UnclaimedWinnings } from "./components/UnclaimedWinnings";
import { UserPosition } from "./components/UserPosition";

export default function Home() {
  return (
    <>
      <BattleArena />
      <div className="bg-slate-950 px-2 md:px-6 pb-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <UnclaimedWinnings />
          <UserPosition />
        </div>
      </div>
    </>
  );
}