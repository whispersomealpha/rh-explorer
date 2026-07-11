'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../lib/api'
import { shortAddr, formatEth, timeAgo, formatGwei, formatNumber } from '../lib/utils'
import { STOCK_TOKENS } from '../lib/types'

export default function HomePage() {
  const [blocks, setBlocks]   = useState<any[]>([])
  const [txs, setTxs]         = useState<any[]>([])
  const [stats, setStats]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [b, t, s] = await Promise.allSettled([
      api.getBlocks(8),
      api.getTxs(10),
      api.getStats(),
    ])
    if (b.status === 'fulfilled') setBlocks(b.value)
    if (t.status === 'fulfilled') setTxs(t.value)
    if (s.status === 'fulfilled') setStats(s.value)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [])

  const stockList = Object.entries(STOCK_TOKENS).slice(0, 8)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rh-border text-xs text-rh-muted mb-4">
          <div className="pulse-dot" />
          Robinhood Chain Mainnet · Chain ID 4663
        </div>
        <h1 className="text-4xl font-bold text-rh-text mb-3">
          The fastest explorer for{' '}
          <span style={{ background: 'linear-gradient(90deg, #6c63ff, #00d4aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Robinhood Chain
          </span>
        </h1>
        <p className="text-rh-muted text-lg">
          Blocks · Transactions · Token Holders · Cross-chain Wallet Investigation
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Latest Block',  value: stats ? formatNumber(stats.latestBlock, 0) : '—', icon: '◻' },
          { label: 'Gas Price',     value: stats ? `${stats.gasPriceGwei} Gwei` : '—',       icon: '⛽' },
          { label: 'Stock Tokens',  value: '25',                                               icon: '📈' },
          { label: 'Chain ID',      value: '4663',                                             icon: '🔗' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-rh-border bg-rh-card p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-rh-text mono">{s.value}</div>
            <div className="text-xs text-rh-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stock tokens quick links */}
      <div className="rounded-xl border border-rh-border bg-rh-card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-rh-text">Stock Token Contracts</h2>
          <Link href="/tokens" className="text-xs text-rh-accent hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stockList.map(([symbol, addr]) => (
            <Link
              key={symbol}
              href={`/token/${addr}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-rh-border hover:border-rh-accent hover:bg-rh-surface transition-all group"
            >
              <span className="text-sm font-semibold text-rh-text group-hover:text-rh-accent">{symbol}</span>
              <span className="text-xs text-rh-muted mono">{addr.slice(0,6)}…</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Blocks + Txs */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Latest Blocks */}
        <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-rh-border">
            <h2 className="text-sm font-semibold text-rh-text">Latest Blocks</h2>
            <Link href="/blocks" className="text-xs text-rh-accent hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-rh-muted text-sm">Loading...</div>
          ) : (
            <div>
              {blocks.map((b: any, i) => (
                <div key={b.height ?? i} className="flex items-center justify-between px-5 py-3 border-b border-rh-border last:border-0 hover:bg-rh-surface transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rh-surface flex items-center justify-center text-xs text-rh-accent font-bold shrink-0">◻</div>
                    <div>
                      <Link href={`/block/${b.height}`} className="text-sm font-mono text-rh-accent hover:underline">
                        #{b.height?.toLocaleString()}
                      </Link>
                      <div className="text-xs text-rh-muted">{timeAgo(b.timestamp)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-rh-text">{b.tx_count ?? 0} txs</div>
                    <div className="text-xs text-rh-muted">
                      {b.gas_used && b.gas_limit
                        ? `${Math.round((parseInt(b.gas_used) / parseInt(b.gas_limit)) * 100)}% gas`
                        : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Transactions */}
        <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-rh-border">
            <h2 className="text-sm font-semibold text-rh-text">Latest Transactions</h2>
            <Link href="/txs" className="text-xs text-rh-accent hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-rh-muted text-sm">Loading...</div>
          ) : (
            <div>
              {txs.map((tx: any, i) => (
                <div key={tx.hash ?? i} className="flex items-center justify-between px-5 py-3 border-b border-rh-border last:border-0 hover:bg-rh-surface transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${tx.status === true || tx.result === 'success' ? 'bg-rh-green' : 'bg-rh-red'}`} />
                    <div className="min-w-0">
                      <Link href={`/tx/${tx.hash}`} className="text-sm font-mono text-rh-accent hover:underline block truncate">
                        {shortAddr(tx.hash, 10)}
                      </Link>
                      <div className="text-xs text-rh-muted">
                        {tx.from?.hash ? shortAddr(tx.from.hash) : '?'} → {tx.to?.hash ? shortAddr(tx.to.hash) : 'Contract'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm text-rh-text mono">
                      {tx.value ? formatEth(tx.value) : '0 ETH'}
                    </div>
                    <div className="text-xs text-rh-muted">{timeAgo(tx.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Investigate CTA */}
      <div className="mt-8 rounded-xl border border-rh-accent/30 bg-rh-accent/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-rh-text font-semibold mb-1">🔍 Wallet Investigator</h3>
          <p className="text-rh-muted text-sm">
            Trace any wallet's funding history across Ethereum, Base, Arbitrum, and more. See where funds originated.
          </p>
        </div>
        <Link
          href="/wallet"
          className="shrink-0 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
          style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)', color: '#fff' }}
        >
          Investigate Wallet →
        </Link>
      </div>
    </div>
  )
}
