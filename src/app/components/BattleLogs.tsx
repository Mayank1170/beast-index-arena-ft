"use client";
import { BattleEvent } from "../hooks/useCurrentBattle";

interface BattleLogsProps {
  logs: BattleEvent[];
}

export function BattleLogs({ logs }: BattleLogsProps) {
  if (logs.length === 0) {
    return null; 
  }

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-3 max-h-64 overflow-y-auto shadow-2xl">
      <h3 className="text-xs font-black text-white mb-2 tracking-widest sticky top-0 bg-black/90 pb-1 backdrop-blur-md z-10">
        ⚔️ BATTLE LOG
      </h3>
      <div className="space-y-1.5">
        {logs.slice(0, 15).map((event, idx) => (
          <div
            key={`${event.turn}-${event.timestamp}-${idx}`}
            className={`text-xs p-2 rounded border-l-3 transition-all duration-200 ${
              event.type === "victory"
                ? "bg-yellow-500/20 border-yellow-400 text-yellow-200 font-bold"
                : event.type === "death"
                ? "bg-red-500/20 border-red-400 text-red-200 font-bold"
                : "bg-blue-500/10 border-blue-400 text-blue-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="font-black text-white text-[10px] bg-black/40 px-1.5 py-0.5 rounded">T{event.turn}</span>
              <span className="text-[11px] leading-relaxed flex-1">{event.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
