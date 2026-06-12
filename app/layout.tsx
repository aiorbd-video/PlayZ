import { Metadata } from 'next';
import './globals.css';
import SecurityScript from './components/SecurityScript';

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
    url: 'https://ratulxlive.vercel.app',
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
        {/* ইন-অ্যাপ ব্রাউজার (মেসেঞ্জার/টেলিগ্রাম) ব্লকিং ফিক্স */}
        <meta httpEquiv="X-Frame-Options" content="SAMEORIGIN" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      <body className="bg-gray-900 text-white selection:bg-[#3498db] selection:text-white antialiased">
        {/* গ্লোবাল সিকিউরিটি স্ক্রিপ্ট */}
        <SecurityScript />
        {children}
        
        {/* 🟢 থার্ড পার্টি প্যাকেজ ছাড়া ডাইরেক্ট গুগল অ্যানালিটিক্স স্ক্রিপ্ট (১০০% বিল্ড সেফ) */}
        {/* ⚠️ নিচের দুটি লাইনে "G-XXXXXXXXXX" কেটে আপনার আসল গুগল অ্যানালিটিক্স Measurement ID বসিয়ে দিবেন */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-Z517JJ7M56', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
