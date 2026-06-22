'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

export const PlayerLogs = forwardRef<PlayerLogsHandle>((_, ref) => {
  const [logs, setLogs] = useState<{ id: string; msg: string; type: string; time: string }[]>([]);

  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      const timeStr = new Date().toLocaleTimeString();
      setLogs((prev) => [
        { id: Math.random().toString(), msg: message, type, time: timeStr },
        ...prev.slice(0, 49), // সর্বোচ্চ ৫০টি লগ রাখবে
      ]);
    },
    clearLogs: () => setLogs([]),
  }));

  if (logs.length === 0) {
    return (
      <div className="mt-4 p-4 bg-[#1C1E2B] rounded-xl border border-gray-800 text-center text-xs text-gray-500">
        No active logs yet. Waiting for player actions...
      </div>
    );
  }

  return (
    <div className="mt-4 bg-[#1C1E2B] rounded-xl border border-gray-800 overflow-hidden shadow-inner">
      <div className="p-3 bg-gray-950/40 border-b border-gray-800 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Shaka Engine Live Logs
        </span>
        <button
          onClick={() => setLogs([])}
          className="text-[11px] text-gray-500 hover:text-white bg-gray-900 px-2 py-1 rounded border border-gray-800 transition-colors"
        >
          Clear Logs
        </button>
      </div>
      <div className="p-3 max-h-[220px] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-hide">
        {logs.map((log) => {
          let typeColor = 'text-gray-300';
          if (log.type === 'success') typeColor = 'text-green-400 font-semibold';
          if (log.type === 'error') typeColor = 'text-red-400 font-bold';
          if (log.type === 'warn') typeColor = 'text-yellow-400';

          return (
            <div key={log.id} className="flex gap-2 items-start border-b border-gray-800/30 pb-1">
              <span className="text-gray-600 shrink-0">[{log.time}]</span>
              <span className={typeColor}>{log.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
