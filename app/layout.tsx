import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ToasterProvider } from '@/components/toaster-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'IFSM - Fleet Safety System',
  description: 'Integrated Fleet Safety Management System with comprehensive pre-trip inspections',
  generator: 'IFSM Fleet Safety',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <ToasterProvider />
        <Analytics />
      </body>
    </html>
  )
}
