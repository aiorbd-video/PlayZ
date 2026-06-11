'use client';

import { useEffect } from 'react';

export default function SecurityScript() {
  useEffect(() => {
    const disableInspect = (e: MouseEvent | KeyboardEvent) => {
      // ১. রাইট ক্লিক লক
      if ('button' in e && e.button === 2) {
        e.preventDefault();
      }
      // ২. F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U লক
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', disableInspect);
    document.addEventListener('keydown', disableInspect);

    return () => {
      document.removeEventListener('contextmenu', disableInspect);
      document.removeEventListener('keydown', disableInspect);
    };
  }, []);

  return null; // এটি ব্যাকগ্রাউন্ডে কাজ করবে, স্ক্রিনে কিছু দেখাবে না
}
