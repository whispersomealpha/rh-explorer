'use client'
import { useState } from 'react'
import Link from 'next/link'
import { STOCK_TOKENS } from '../../lib/types'
import { shortAddr } from '../../lib/utils'

const TOKEN_META: Record<string, { name: string; type: 'stock' | 'etf' | 'stable' | 'wrapped' }> = {
  AAPL: { name: 'Apple Inc.', type: 'stock' }, AMD: { name: 'Advanced Micro Devices', type: 'stock' },
  AMZN: { name: 'Amazon.com', type: 'stock' }, BABA: { name: 'Alibaba Group', type: 'stock' },
  BE: { name: 'Bloom Energy', type: 'stock' }, COIN: { name: 'Coinbase Global', type: 'stock' },
  CRCL: { name: 'Circle Internet', type: 'stock' }, CRWV: { name: 'CoreWeave', type: 'stock' },
  GOOGL: { name: 'Alphabet Inc.', type: 'stock' }, INTC: { name: 'Intel Corporation', type: 'stock' },
  META: { name: 'Meta Platforms', type: 'stock' }, MSFT: { name: 'Microsoft Corp.', type: 'stock' },
  MU: { name: 'Micron Technology', type: 'stock' }, NVDA: { name: 'NVIDIA Corporation', type: 'stock' },
  ORCL: { name: 'Oracle Corporation', type: 'stock' }, PLTR: { name: 'Palantir Technologies', type: 'stock' },
  SNDK: { name: 'SanDisk Corp.', type: 'stock' }, SPCX: { name: 'SpaceX', type: 'stock' },
  TSLA: { name: 'Tesla Inc.', type: 'stock' }, USAR: { name: 'USA Rare Earth', type: 'stock' },
  QQQ: { name: 'Invesco QQQ ETF', type: 'etf' }, SGOV: { name: 'iShares 0-3M Treasury', type: 'etf' },
  SLV: { name: 'iShares Silver Trust', type: 'etf' }, SPY: { name: 'SPDR S&P 500 ETF', type: 'etf' },
  CUSO: { name: 'Custom Offering', type: 'etf' },
  WETH: { name: 'Wrapped Ether', type: 'wrapped' }, USDG: { name: 'USD Global', type: 'stable' },
}

const TYPE_BADGE: Record<string, string> = {
  stock: 'badge-purple', etf: 'badge-green', stable: 'badge-yellow', wrapped: 'badge-orange',
}

export default function TokensPage() {
  const [filter, setFilter] = useState<'all' | 'stock' | 'etf' | 'stable' | 'wrapped'>('all')
  const [search, setSearch] = useState('')

  const entries = Object.entries(STOCK_TOKENS)
    .map(([symbol, addr]) => ({ symbol, addr, ...TOKEN_META[symbol] }))
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t =>
      !search ||
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.addr.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-rh-text mb-1">Token Contracts</h1>
        <p className="text-rh-muted text-sm">
          All {Object.keys(STOCK_TOKENS).length} canonical token contracts on Robinhood Chain —
          Stock Tokens, ETFs, and core assets.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, symbol, or address..."
          className="flex-1 px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent"
        />
        <div className="flex gap-1">
          {(['all', 'stock', 'etf', 'stable', 'wrapped'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-rh-accent text-white'
                  : 'border border-rh-border text-rh-muted hover:text-rh-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Token grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(({ symbol, addr, name, type }) => (
          <Link
            key={symbol}
            href={`/token/${addr}`}
            className="rounded-xl border border-rh-border bg-rh-card p-4 hover:border-rh-accent hover:bg-rh-surface transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                     style={{ background: 'linear-gradient(135deg, #6c63ff22, #00d4aa22)', border: '1px solid #2a2a3a' }}>
                  {symbol[0]}
                </div>
                <div>
                  <div className="font-semibold text-rh-text group-hover:text-rh-accent transition-colors">
                    {symbol}
                  </div>
                  <div className="text-xs text-rh-muted">{name ?? symbol}</div>
                </div>
              </div>
              <span className={`badge ${TYPE_BADGE[type ?? 'stock']} text-xs`}>{type}</span>
            </div>
            <div className="mono text-xs text-rh-muted truncate">{addr}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-rh-muted">{shortAddr(addr, 8)}</span>
              <span className="text-xs text-rh-accent opacity-0 group-hover:opacity-100 transition-opacity">
                View holders →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
