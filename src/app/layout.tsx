import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Ya Machur',
  description: 'Minimalist Focus Enforcer',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    title: 'Ya Machur',
    statusBarStyle: 'black-translucent',
    capable: true,
  },
};

export const viewport = {
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}
