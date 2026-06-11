'use client';

import { useEffect } from 'react';
import './globals.css';

// 🟢 SEO Boost: সার্চ ইঞ্জিনের জন্য মেটাডাটা অবজেক্ট (Next.js 13+ স্ট্যান্ডার্ড)
export const metadata = {
  title: {
    default: 'All in One Sports Web | Watch Premium Live Events Free',
    template: '%s | All in One Sports Web'
  },
  description: 'Stream premium live cricket, football, WWE, and global sports events in HD for free without any buffering.',
  keywords: ['live sports', 'free cricket streaming', 'live football streaming', 'wwe live watch', 'all in one sports', 'hd sports stream', 'bangladesh cricket live'],
  authors: [{ name: 'MD. RATUL HASAN' }],
  creator: 'MD. RATUL HASAN',
  publisher: 'All in One Sports Web',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // 🟢 Facebook, Messenger, WhatsApp-এ লিংক শেয়ার করলে যেমন দেখাবে (Open Graph)
  openGraph: {
    title: 'All in One Sports Web | Watch Premium Live Events Free',
    description: 'Stream premium live cricket, football, WWE, and global sports events in HD for free without any buffering.',
    url: 'https://dstyle.vercel.app', // আপনার অরিজিনাল ডোমেইন থাকলে এখানে বসাতে পারেন
    siteName: 'All in One Sports Web',
    locale: 'en_US',
    type: 'website',
  },
  // 🟢 Twitter/X এর জন্য কার্ড মেটাডাটা
  twitter: {
    card: 'summary_large_image',
    title: 'All in One Sports Web | Watch Premium Live Events Free',
    description: 'Stream premium live cricket, football, WWE, and global sports events in HD for free without any buffering.',
  },
  icons: {
    icon: '/favicon.ico', // আপনার public ফোল্ডারে favicon থাকলে অটো পাবে
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  // 🛡️ সিকিউরিটি লেয়ার: পুরো সাইটে রাইট-ক্লিক এবং Inspect Element (F12) ব্লক
  useEffect(() => {
    const disableInspect = (e: MouseEvent | KeyboardEvent) => {
      // ১. রাইট ক্লিক লক
      if ('button' in e && e.button === 2) {
        e.preventDefault();
      }
      // ২. F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Source Code view) লক
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

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* অতিরিক্ত সিকিউরিটি হেডার যা ব্রাউজারকে আপনার সাইট ফ্রেম বা চুরি করতে বাধা দেবে */}
        <meta httpEquiv="X-Frame-Options" content="DENY" />
      </meta>
      <body className="bg-gray-900 text-white selection:bg-[#3498db] selection:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
