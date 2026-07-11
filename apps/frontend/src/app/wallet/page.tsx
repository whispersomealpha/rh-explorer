'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress } from '../../lib/utils'

export default function WalletSearchPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [error, setError]  = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = input.trim()
    if (!val) return
    if (!isAddress(val)) { setError('Please enter a valid EVM address (0x...)'); return }
    setError('')
    router.push(`/wallet/${val}`)
  }

  const examples = [
    '0x1E324B9316138CA9a73F960213621AD1aaf01B89',
    '0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e',
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-6">🔍</div>
      <h1 className="text-3xl font-bold text-rh-text mb-3">Wallet Investigator</h1>
      <p className="text-rh-muted mb-8 text-lg">
        Paste any wallet address to trace its funding history, cross-chain presence,
        and token holdings across all major EVM chains.
      </p>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            placeholder="0x..."
            className="flex-1 px-4 py-3 rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent mono text-sm"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}
          >
            Investigate
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-rh-red">{error}</div>}
      </form>

      <div className="text-left rounded-xl border border-rh-border bg-rh-card p-5">
        <div className="text-xs text-rh-muted uppercase font-semibold tracking-wider mb-3">What you get</div>
        <div className="space-y-2 text-sm text-rh-muted">
          {[
            '📥 How the wallet was first funded (bridge, CEX, direct transfer)',
            '🔗 Funding trail traced back up to 5 hops across chains',
            '🌐 Cross-chain presence on Ethereum, Base, Arbitrum, Optimism, Polygon, BNB',
            '🪙 All token balances including Stock Tokens',
            '📊 Full transaction history on Robinhood Chain',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-rh-border">
          <div className="text-xs text-rh-muted mb-2">Try an example</div>
          <div className="space-y-1">
            {examples.map(addr => (
              <button
                key={addr}
                onClick={() => router.push(`/wallet/${addr}`)}
                className="block mono text-xs text-rh-accent hover:underline text-left"
              >
                {addr}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
