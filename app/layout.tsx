import type { Metadata, Viewport } from 'next';
import './globals.css';
import SecurityScript from './components/SecurityScript';
import { GoogleAnalytics } from '@next/third-parties/google';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ratulxlive.duckdns.org'),

  title: {
    default: 'All in One Sports Web | Watch Live Cricket, Football & WWE HD',
    template: '%s | All in One Sports Web',
  },

  description:
    'Watch live cricket, football, WWE, UFC and premium sports events in HD quality. Fast streaming, mobile friendly and free access worldwide.',

  applicationName: 'All in One Sports Web',

  keywords: [
    'live cricket',
    'live football',
    'live sports',
    'watch cricket live',
    'football live stream',
    'wwe live',
    'ufc live',
    'sports streaming',
    'bangladesh cricket live',
    'hd sports stream',
    'all in one sports web',
    'live match today',
  ],

  authors: [
    {
      name: 'MD. RATUL HASAN',
    },
  ],

  creator: 'MD. RATUL HASAN',
  publisher: 'All in One Sports Web',

  alternates: {
    canonical: 'https://www.ratulxlive.duckdns.org',
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
    url: 'https://www.ratulxlive.duckdns.org',
    siteName: 'All in One Sports Web',
    title: 'All in One Sports Web | Live Sports Streaming',
    description:
      'Watch live cricket, football, WWE, UFC and premium sports events in HD quality.',

    images: [
  {
    url: 'https://www.ratulxlive.duckdns.org/og-image.jpg',
    width: 1200,
    height: 630,
    alt: 'All in One Sports Web',
  },
],
  },

  twitter: {
  card: 'summary_large_image',
  title: 'All in One Sports Web',
  description:
    'Watch live cricket, football, WWE and premium sports events in HD quality.',
  images: ['https://www.ratulxlive.duckdns.org/og-image.jpg'],
},

  verification: {
  google: 'v-ZWTYynmmRWTwdwUqXTcnYmT5q6rkBjqSark0ypkqM',
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

  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'All in One Sports Web',
    url: 'https://www.ratulxlive.duckdns.org',
    potentialAction: {
      '@type': 'SearchAction',
      target:
        'https://www.ratulxlive.duckdns.org/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
      </head>

      <body className="selection:bg-accent selection:text-white antialiased">
        <SecurityScript />

        {children}

        <GoogleAnalytics gaId="G-PWQE71BFDJ" />
      </body>
    </html>
  );
}
