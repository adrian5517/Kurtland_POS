import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import Script from 'next/script'
import './globals.css'

const GA_MEASUREMENT_ID = 'G-NJ5DYNZCBQ'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Kurtland POS - Canteen Management System',
  description: 'Professional Point of Sale system for canteen operations with inventory management, analytics, and secure authentication',
  generator: 'v0.app',
  keywords: ['POS', 'Point of Sale', 'Canteen', 'Inventory Management', 'Restaurant'],
  authors: [{ name: 'Kurtland' }],
  icons: {
    icon: [
      {
        url: '/kurtland_logo.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/kurtland_logo.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/kurtland_logo.png',
        type: 'image/png',
      },
    ],
    shortcut: '/kurtland_logo.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        <Toaster
          position="top-right"
          theme="system"
          richColors
          closeButton
          expand
        />
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
