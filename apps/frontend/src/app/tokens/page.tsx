'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress } from '../../lib/utils'

export default function TokensPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = input.trim()
    if (!val) return
    if (!isAddress(val)) { setError('Please enter a valid contract address (0x...)'); return }
    setError('')
    router.push(`/token/${val}`)
  }

  const examples = [
    { label: 'AAPL (Apple Stock Token)', addr: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9' },
    { label: 'NVDA (NVIDIA Stock Token)', addr: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' },
    { label: 'TSLA (Tesla Stock Token)',  addr: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d' },
    { label: 'SPY (S&P 500 ETF Token)',   addr: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C' },
    { label: 'WETH (Wrapped Ether)',      addr: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' },
    { label: 'USDG (USD Global)',         addr: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-6">🪙</div>
      <h1 className="text-3xl font-bold text-rh-text mb-3">Token Explorer</h1>
      <p className="text-rh-muted mb-8 text-lg">
        Paste any token contract address on Robinhood Chain to view holders,
        transfers, supply, and concentration data.
      </p>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            placeholder="0x... token contract address"
            className="flex-1 px-4 py-3 rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent mono text-sm"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 shrink-0"
            style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}
          >
            View Holders
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-rh-red">{error}</div>}
      </form>

      <div className="text-left rounded-xl border border-rh-border bg-rh-card p-5">
        <div className="text-xs text-rh-muted uppercase font-semibold tracking-wider mb-3">
          Official Robinhood Chain contracts
        </div>
        <div className="space-y-2">
          {examples.map(({ label, addr }) => (
            <button
              key={addr}
              onClick={() => router.push(`/token/${addr}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-rh-border hover:border-rh-accent hover:bg-rh-surface transition-all group text-left"
            >
              <span className="text-sm text-rh-text group-hover:text-rh-accent">{label}</span>
              <span className="mono text-xs text-rh-muted">{addr.slice(0,8)}…</span>
            </button>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-rh-border text-xs text-rh-muted">
          Any ERC-20 token deployed on Robinhood Chain (Chain ID 4663) works — not just the official stock tokens.
        </div>
      </div>
    </div>
  )
}
