'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '../lib/api'
import { isAddress, isTxHash, shortAddr } from '../lib/utils'

export function Navbar() {
  const router  = useRouter()
  const [q, setQ]           = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.search(q)
        setResults(data.slice(0, 8))
        setOpen(true)
      } catch {}
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = q.trim()
    if (!val) return
    setOpen(false)
    if (isAddress(val))  return router.push(`/wallet/${val}`)
    if (isTxHash(val))   return router.push(`/tx/${val}`)
    if (/^\d+$/.test(val)) return router.push(`/block/${val}`)
    router.push(`/search?q=${encodeURIComponent(val)}`)
  }

  function resultIcon(type: string) {
    const icons: Record<string, string> = {
      address: '👤', token: '🪙', transaction: '↔', block: '◻'
    }
    return icons[type] ?? '🔍'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-rh-border"
         style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}>
            ⬡
          </div>
          <span className="font-semibold text-rh-text hidden sm:block">RH Explorer</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-5 text-sm text-rh-muted">
          <Link href="/blocks"  className="hover:text-rh-text transition-colors">Blocks</Link>
          <Link href="/txs"     className="hover:text-rh-text transition-colors">Transactions</Link>
          <Link href="/tokens"  className="hover:text-rh-text transition-colors">Tokens</Link>
          <Link href="/wallet"  className="hover:text-rh-text transition-colors">Investigate</Link>
        </div>

        {/* Search */}
        <div ref={ref} className="flex-1 relative max-w-xl ml-auto">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rh-muted text-sm">🔍</span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder="Search address, tx hash, block, token..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent transition-colors"
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rh-muted text-xs">...</span>
              )}
            </div>
          </form>

          {open && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full rounded-lg border border-rh-border bg-rh-card shadow-2xl z-50 overflow-hidden animate-fade-in">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setOpen(false); setQ('')
                    if (r.type === 'address' || r.type === 'token') router.push(`/wallet/${r.address}`)
                    else if (r.type === 'transaction') router.push(`/tx/${r.tx_hash ?? r.hash}`)
                    else if (r.type === 'block') router.push(`/block/${r.block_number}`)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rh-surface text-left transition-colors border-b border-rh-border last:border-0"
                >
                  <span className="text-base">{resultIcon(r.type)}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-rh-text truncate mono">
                      {r.name ?? r.address ?? r.tx_hash ?? `Block ${r.block_number}`}
                    </div>
                    <div className="text-xs text-rh-muted capitalize">{r.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chain badge */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="pulse-dot" />
          <span className="text-xs text-rh-muted mono">4663</span>
        </div>
      </div>
    </nav>
  )
}
