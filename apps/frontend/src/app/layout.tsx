import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '../components/Navbar'

export const metadata: Metadata = {
  title: 'RH Explorer — Robinhood Chain',
  description: 'The fastest explorer for Robinhood Chain — blocks, transactions, token holders, and cross-chain wallet investigation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  )
}
