import type { Metadata, Viewport } from 'next';
import './globals.css';
import SecurityScript from './components/SecurityScript';
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

// ডাইনামিক সাইট ইউআরএল (Vercel Env থেকে আসবে, না থাকলে ডিফল্ট)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ratulxlive.duckdns.org';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'All In One Reborn | Watch Live Sports, Cricket & Football HD',
    template: '%s | All In One Reborn',
  },

  description:
    'Stream live cricket, football, WWE, and UFC in HD for free on All In One Reborn. Get buffer-free access to today\'s live sports matches worldwide.',

  applicationName: 'All In One Reborn',

  keywords: [
    'live cricket',
    'live football stream',
    'watch live sports hd',
    'live tv bd',
    'wwe live today',
    'ufc live stream',
    'sports streaming free',
    'bangladesh cricket live',
    'hd sports stream',
    'all in one reborn',
    'live match today',
    'ipl live',
    'bpl live',
    't20 world cup live',
    'football highlights hd'
  ],

  authors: [
    {
      name: 'MD. RATUL HASAN',
      url: SITE_URL,
    },
  ],

  creator: 'All In One Reborn',
  publisher: 'All In One Reborn',

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'All In One Reborn',
    title: 'All In One Reborn | HD Live Sports Streaming',
    description:
      'Watch live cricket, football, WWE, UFC and premium sports events in HD quality without buffering.',
    images: [
      {
        url: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'All In One Reborn Live Streaming Platform',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'All In One Reborn | HD Live Sports',
    description:
      'Watch live cricket, football, WWE and premium sports events in HD quality for free.',
    images: [`${SITE_URL}/og-image.jpg`],
  },

  verification: {
    google: '0BaewLI3JQJ_V9zxXdw4gmgRhq809X2nJPLKDOvqyFA',
  },

  category: 'Sports',

  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },

  appleWebApp: {
    title: 'AIO Reborn',
    statusBarStyle: 'black-translucent',
    capable: true,
  },

  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // 🎯 ম্যাজিক ফিক্স: গুগলের সার্চ রেজাল্টে "Duck DNS" সরিয়ে আপনার আসল ব্র্যান্ড নাম বসানোর জন্য Advanced Schema
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'All In One Reborn',
        alternateName: ['AIO Reborn', 'All In One Sports Web'],
        url: SITE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'All In One Reborn',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        sameAs: [
          'https://t.me/allonebd' // আপনার সোশ্যাল বা টেলিগ্রাম লিংক এখানে থাকলে গুগল ব্র্যান্ড ভ্যালু বেশি দেয়
        ],
      }
    ]
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        
        {/* 🟢 ট্রাফিক সোর্স ট্র্যাক করার জন্য Referrer মেটা ট্যাগ */}
        <meta name="referrer" content="no-referrer-when-downgrade" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>

      <body className="selection:bg-[#00E5FF] selection:text-black antialiased">
        <SecurityScript />

        {/* 🟢 ফ্লোটিং টেলিগ্রাম বাটন শুরু */}
        <a
          href="https://t.me/allonebd"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center w-14 h-14 md:w-auto md:h-auto md:px-5 md:py-3 bg-gradient-to-br from-[#0088cc] to-[#005580] text-white rounded-full shadow-[0_0_20px_rgba(0,136,204,0.6)] backdrop-blur-md border border-white/20 animate-pulse hover:animate-none hover:scale-110 transition-all duration-300 group"
          aria-label="Join our Telegram Channel"
        >
          <svg className="w-7 h-7 md:mr-2 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/>
          </svg>
          <span className="hidden md:block font-bold tracking-wide text-sm drop-shadow-md">
            Join Telegram
          </span>
        </a>
        {/* 🟢 ফ্লোটিং টেলিগ্রাম বাটন শেষ */}

        {children}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('Service Worker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>

        {/* 🟢 Google Analytics (Vercel Env থেকে ডাইনামিক্যালি আনা) */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}

      </body>
    </html>
  );
}
