'use client';

import { useEffect } from 'react';

export default function SecurityScript() {
  useEffect(() => {
    // ১. মাউস রাইট-ক্লিক লক করার ফাংশন
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // ২. কি-বোর্ডের শর্টকাট (F12, Ctrl+U ইত্যাদি) লক করার ফাংশন
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    // ইভেন্ট লিসেনারগুলো অ্যাড করা হলো
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // মেমোরি লিক বন্ধ করতে ক্লিনআপ করা হলো
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
