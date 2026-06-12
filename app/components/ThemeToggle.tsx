'use client';

import { useAppTheme } from '../context/ThemeContext';
import { useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    { id: 'white', label: '☀️ White', bg: 'bg-white text-black' },
    { id: 'dark', label: '🌙 Dark', bg: 'bg-[#141822] text-white' },
    { id: 'moonlight', label: '🌌 Moonlight', bg: 'bg-[#101f42] text-[#8da2fb]' }
  ] as const;

  return (
    <div className="relative inline-block text-left z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-xs md:text-sm font-bold rounded-xl border border-gray-700/50 bg-[var(--bg-card)] hover:border-[#3498db] transition-all flex items-center gap-2 outline-none"
      >
        {theme === 'white' && '☀️ White'}
        {theme === 'dark' && '🌙 Dark'}
        {theme === 'moonlight' && '🌌 Moonlight'}
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl shadow-2xl bg-[var(--bg-card)] border border-gray-800/80 overflow-hidden animate-fade-in">
          <div className="py-1">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold flex items-center justify-between hover:bg-gray-800/30 transition-colors ${
                  theme === t.id ? 'text-[#3498db] bg-gray-800/10' : 'text-[var(--text-primary)]'
                }`}
              >
                {t.label}
                {theme === t.id && <span className="w-1.5 h-1.5 bg-[#3498db] rounded-full"></span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
