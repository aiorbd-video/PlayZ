import { Metadata } from 'next';
import './globals.css';
import SecurityScript from './components/SecurityScript';
import { ThemeProvider } from './context/ThemeContext'; // 🟢 থিম প্রোভাইডার ইমপোর্ট করা হলো

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
        <meta httpEquiv="X-Frame-Options" content="SAMEORIGIN" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      {/* 🟢 এখানে থিম প্রোভাইডার দিয়ে মুড়িয়ে দেওয়া হলো */}
      <ThemeProvider>
        <body className="selection:bg-[#3498db] selection:text-white antialiased">
          <SecurityScript />
          {children}
          
          {/* গুগল অ্যানালিটিক্স স্ক্রিপ্ট */}
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
      </ThemeProvider>
    </html>
  );
}
