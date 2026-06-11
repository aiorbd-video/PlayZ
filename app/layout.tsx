import { Metadata } from 'next';
import './globals.css';
import SecurityScript from './components/SecurityScript'; // নিচে আমরা এই কম্পোনেন্টটি বানাচ্ছি

// 🟢 SEO Boost: এটি এখন পারফেক্টলি সার্ভার সাইড থেকে কাজ করবে
export const metadata: Metadata = {
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
  openGraph: {
    title: 'All in One Sports Web | Watch Premium Live Events Free',
    description: 'Stream premium live cricket, football, WWE, and global sports events in HD for free without any buffering.',
    url: 'https://dstyle.vercel.app',
    siteName: 'All in One Sports Web',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All in One Sports Web | Watch Premium Live Events Free',
    description: 'Stream premium live cricket, football, WWE, and global sports events in HD for free without any buffering.',
  },
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta httpEquiv="X-Frame-Options" content="DENY" />
      </head>
      <body className="bg-gray-900 text-white selection:bg-[#3498db] selection:text-white antialiased">
        {/* সিকিউরিটি স্ক্রিপ্টটি এখানে রান হবে */}
        <SecurityScript />
        {children}
      </body>
    </html>
  );
}
