// v2-pnl-debug
'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatNumber, timeAgo, formatTs } from '../../../lib/utils'
import { HolderTooltip } from '../../../components/HolderTooltip'

// Session-level caches — survive back navigation
const pageCache  = new Map<string, { tokenInfo: any; holders: any[]; transfers: any[]; ts: number }>()
const pnlCache   = new Map<string, Record<string, any>>()
const priceCache = new Map<string, number | null>()
const CACHE_TTL  = 8 * 60 * 1000 // 8 min

export default function TokenPage({ params }: { params: { address: string } }) {
  const { address } = params
  const addr = address.toLowerCase()

  const [tokenInfo, setTokenInfo]     = useState<any>(null)
  const [holders, setHolders]         = useState<any[]>([])
  const [transfers, setTransfers]     = useState<any[]>([])
  const [tab, setTab]                 = useState<'holders' | 'transfers'>('holders')
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [loadingHolders, setLoadingHolders] = useState(true)
  const [loadingPnL, setLoadingPnL]   = useState(false)
  const [loadingMsg, setLoadingMsg]   = useState('Fetching token info...')
  const [search, setSearch]           = useState('')
  const [sortBy, setSortBy]           = useState<'rank' | 'balance' | 'share' | 'value' | 'txs'>('rank')
  const [currentPage, setCurrentPage] = useState(0)
  const [priceUsd, setPriceUsd]       = useState<number | null>(null)
  const [pnlMap, setPnlMap]           = useState<Record<string, any>>({})
  const msgTimer = useRef<any>(null)

  const PAGE_SIZE = 50

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Instant cache hit — back navigation
      const cached = pageCache.get(addr)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setTokenInfo(cached.tokenInfo)
        setHolders(cached.holders)
        setTransfers(cached.transfers)
        setLoadingInfo(false)
        setLoadingHolders(false)
        // Restore cached PnL and price
        if (pnlCache.has(addr)) setPnlMap(pnlCache.get(addr)!)
        if (priceCache.has(addr)) setPriceUsd(priceCache.get(addr) ?? null)
        return
      }

      setLoadingInfo(true)
      setLoadingHolders(true)

      // Phase 1: token info + price (fast, ~500ms)
      const [infoRes, priceRes] = await Promise.allSettled([
        api.getToken(address),
        api.getTokenPrice(address),
      ])

      if (cancelled) return

      let info: any = null
      if (infoRes.status === 'fulfilled') {
        info = infoRes.value
        setTokenInfo(info)
        setLoadingInfo(false)
        const cnt = parseInt(info.holders_count ?? info.holderCount ?? '0')
        setLoadingMsg(`Loading up to 500 of ${cnt > 0 ? cnt.toLocaleString() : '?'} holders...`)
        const msgs = ['Fetching holders from Blockscout...', 'Loading pages...', 'Processing...', 'Almost done...']
        let i = 0
        clearInterval(msgTimer.current)
        msgTimer.current = setInterval(() => { i=(i+1)%msgs.length; setLoadingMsg(msgs[i]) }, 2500)
      }

      let price: number | null = null
      if (priceRes.status === 'fulfilled' && priceRes.value?.priceUsd) {
        price = priceRes.value.priceUsd
        setPriceUsd(price)
        priceCache.set(addr, price)
      }

      // Phase 2a: holders (required)
      let holdersRes: any = null
      try {
        holdersRes = await api.getTokenHolders(address)
      } catch(e) { console.error('holders failed', e) }

      if (cancelled) return
      clearInterval(msgTimer.current)

      const h   = holdersRes?.holders ?? []
      const ti2 = holdersRes?.tokenInfo ?? null

      if (ti2) setTokenInfo((prev: any) => ({ ...prev, ...ti2 }))
      setHolders(h)
      setLoadingHolders(false)

      // Phase 2b: transfers (non-blocking, failure is OK)
      api.getTokenTransfers(address).then((txRes: any) => {
        if (!cancelled) setTransfers(txRes?.items ?? [])
      }).catch(() => {})

      pageCache.set(addr, { tokenInfo: ti2 ?? info, holders: h, transfers: [], ts: Date.now() })

      // Phase 3: PnL for first 50 — fires immediately after holders load
      console.log('[PnL] holders count:', h.length, 'price:', price)
      if (h.length > 0) {
        const decimals = parseInt(ti2?.decimals ?? info?.decimals ?? '18')
        setLoadingPnL(true)
        try {
          const first50 = h.slice(0, 50).map((x: any) => ({ address: x.address, balanceFormatted: x.balanceFormatted }))
          console.log('[PnL] calling batch for', first50.length, 'holders')
          const results = await api.getBatchPnL(address, first50, decimals, price)
          console.log('[PnL] batch results:', Object.keys(results).length, 'entries')
          if (!cancelled) {
            setPnlMap(results)
            pnlCache.set(addr, results)
          }
        } catch (e) {
          console.error('PnL batch failed:', e)
        }
        if (!cancelled) setLoadingPnL(false)
      }
    }

    load()
    return () => { cancelled = true; clearInterval(msgTimer.current) }
  }, [address])

  const filteredHolders = holders
    .filter(h => !search || h.address?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'balance') return b.balanceFormatted - a.balanceFormatted
      if (sortBy === 'share')   return b.share - a.share
      if (sortBy === 'value' && priceUsd) return (b.balanceFormatted * priceUsd) - (a.balanceFormatted * priceUsd)
      if (sortBy === 'txs') {
        const pa = pnlMap[a.address.toLowerCase()]?.tradeCount ?? -1
        const pb = pnlMap[b.address.toLowerCase()]?.tradeCount ?? -1
        return pb - pa
      }
      return a.rank - b.rank
    })

  const totalPages   = Math.ceil(filteredHolders.length / PAGE_SIZE)
  const pageHolders  = filteredHolders.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const top10Share   = holders.slice(0, 10).reduce((s, h) => s + (h.share ?? 0), 0)
  const holderCount  = holders.length || parseInt(tokenInfo?.holders_count ?? tokenInfo?.holderCount ?? '0')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="rounded-xl border border-rh-border bg-rh-card p-6 mb-6">
        {loadingInfo
          ? <div className="text-rh-muted text-sm animate-pulse">Loading token info...</div>
          : tokenInfo && (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                       style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}>
                    {(tokenInfo.symbol ?? '?')[0]}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-rh-text">{tokenInfo.name}</h1>
                    <span className="text-sm text-rh-muted">{tokenInfo.symbol}</span>
                  </div>
                </div>
                <div className="mono text-xs text-rh-muted break-all">{address}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center shrink-0">
                <div>
                  <div className="text-lg font-bold text-rh-text">
                    {loadingHolders ? <span className="text-sm text-rh-muted">...</span> : formatNumber(holderCount, 0)}
                  </div>
                  <div className="text-xs text-rh-muted">Holders</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-rh-text mono text-sm">
                    {formatNumber(tokenInfo.totalSupplyFormatted ?? 0)}
                  </div>
                  <div className="text-xs text-rh-muted">Supply</div>
                </div>
                {priceUsd && (
                  <div>
                    <div className="text-lg font-bold text-rh-green mono">${formatNumber(priceUsd, 4)}</div>
                    <div className="text-xs text-rh-muted">Price USD</div>
                  </div>
                )}
                <div>
                  <div className="text-lg font-bold text-rh-text">
                    {formatNumber(parseInt(tokenInfo.transactions_count ?? tokenInfo.txCount ?? '0'), 0)}
                  </div>
                  <div className="text-xs text-rh-muted">Transactions</div>
                </div>
              </div>
            </div>
          )
        }

        {!loadingHolders && holders.length > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-rh-muted mb-1">
              <span>Top 10 concentration</span>
              <span className={`font-semibold ${top10Share > 80 ? 'text-rh-red' : top10Share > 50 ? 'text-rh-yellow' : 'text-rh-green'}`}>
                {top10Share.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-rh-border overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${Math.min(top10Share, 100)}%`, background: top10Share > 80 ? '#ff4d6d' : top10Share > 50 ? '#ff9f1c' : '#00d4aa' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rh-border mb-4">
        {(['holders', 'transfers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-rh-accent text-rh-accent' : 'border-transparent text-rh-muted hover:text-rh-text'
            }`}>
            {t === 'holders'
              ? `Holders ${loadingHolders ? '(loading...)' : `(${holders.length}${holders.length === 500 ? '+' : ''})`}`
              : 'Transfers'}
          </button>
        ))}
      </div>

      {tab === 'holders' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(0) }}
              placeholder="Filter by address..."
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent"
              disabled={loadingHolders} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text focus:outline-none"
              disabled={loadingHolders}>
              <option value="rank">Sort by Rank</option>
              <option value="balance">Sort by Balance</option>
              <option value="share">Sort by Share %</option>
              {priceUsd && <option value="value">Sort by Value (USD)</option>}
              <option value="txs">Sort by Activity</option>
            </select>
          </div>

          {loadingHolders ? (
            <div className="text-center py-20 rounded-xl border border-rh-border bg-rh-card">
              <div className="text-4xl mb-4">⏳</div>
              <div className="text-rh-text font-medium mb-2">{loadingMsg}</div>
              <div className="text-sm text-rh-muted">Capped at 500 holders · Cached 8 min after first load</div>
              <div className="mt-6 flex justify-center gap-1.5">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-rh-accent"
                       style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
                <div className="px-4 py-2 border-b border-rh-border bg-rh-surface flex justify-between items-center">
                  <span className="text-xs text-rh-muted">Hover to preview · Click to investigate</span>
                  <div className="flex items-center gap-3 text-xs text-rh-muted">
                    {loadingPnL && <span className="animate-pulse text-rh-accent">Loading activity data for top 50...</span>}
                    {!loadingPnL && Object.keys(pnlMap).length > 0 && (
                      <span className="text-rh-green">✓ Activity loaded for top {Object.keys(pnlMap).length}</span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="rh-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Address</th>
                        <th>Balance</th>
                        <th>Share %</th>
                        {priceUsd && <th>Value (USD)</th>}
                        <th>Txs</th>
                        <th>First Buy</th>
                        <th>Bar</th>
                        <th>Investigate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageHolders.map((h, i) => {
                        const pnl = pnlMap[h.address.toLowerCase()]
                        const valueUsd = priceUsd != null ? h.balanceFormatted * priceUsd : null
                        const globalRank = currentPage * PAGE_SIZE + i

                        return (
                          <tr key={h.address}>
                            <td>
                              <span className={`badge ${globalRank < 3 ? 'badge-purple' : 'badge-gray'}`}>#{h.rank}</span>
                            </td>
                            <td>
                              <HolderTooltip address={h.address}>
                                <Link href={`/wallet/${h.address}`} className="mono text-rh-accent hover:underline text-sm">
                                  {shortAddr(h.address, 10)}
                                </Link>
                              </HolderTooltip>
                              {h.label && <div className="text-xs text-rh-muted mt-0.5">{h.label}</div>}
                            </td>
                            <td>
                              <span className="mono text-rh-text text-sm">
                                {formatNumber(h.balanceFormatted, 2)}{' '}
                                <span className="text-rh-muted text-xs">{tokenInfo?.symbol}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`font-semibold text-sm ${h.share > 10 ? 'text-rh-red' : h.share > 5 ? 'text-rh-yellow' : 'text-rh-text'}`}>
                                {h.share.toFixed(3)}%
                              </span>
                            </td>
                            {priceUsd && (
                              <td>
                                {valueUsd != null
                                  ? <span className="mono text-sm font-semibold text-rh-text">${formatNumber(valueUsd, 2)}</span>
                                  : <span className="text-rh-muted text-xs">—</span>}
                              </td>
                            )}
                            <td>
                              {pnl
                                ? <span className="text-xs font-semibold text-rh-text">{pnl.tradeCount}</span>
                                : globalRank < 50
                                  ? loadingPnL
                                    ? <div className="w-6 h-3 rounded bg-rh-border animate-pulse" />
                                    : <span className="text-rh-muted text-xs">—</span>
                                  : <span className="text-rh-muted text-xs">—</span>}
                            </td>
                            <td>
                              {pnl?.firstBuyTimestamp
                                ? <span className="text-xs text-rh-muted">{timeAgo(pnl.firstBuyTimestamp)}</span>
                                : <span className="text-rh-muted text-xs">—</span>}
                            </td>
                            <td style={{ width: 100 }}>
                              <div className="h-1.5 rounded-full bg-rh-border overflow-hidden w-20">
                                <div className="h-full rounded-full"
                                     style={{ width: `${Math.min((h.share / (holders[0]?.share ?? 1)) * 100, 100)}%`, background: h.share > 10 ? '#ff4d6d' : '#6c63ff' }} />
                              </div>
                            </td>
                            <td>
                              <Link href={`/wallet/${h.address}`}
                                className="text-xs px-3 py-1 rounded-lg border border-rh-border hover:border-rh-accent hover:text-rh-accent transition-colors text-rh-muted whitespace-nowrap">
                                🔍 Trace
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {pageHolders.length === 0 && (
                    <div className="text-center py-12 text-rh-muted text-sm">No holders found</div>
                  )}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-rh-muted">
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredHolders.length)} of {filteredHolders.length}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                      className="px-3 py-1 text-xs rounded-lg border border-rh-border text-rh-muted hover:text-rh-accent hover:border-rh-accent disabled:opacity-40 transition-colors">
                      ← Prev
                    </button>
                    <span className="px-3 py-1 text-xs text-rh-muted">{currentPage + 1} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded-lg border border-rh-border text-rh-muted hover:text-rh-accent hover:border-rh-accent disabled:opacity-40 transition-colors">
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'transfers' && (
        <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
          <table className="rh-table">
            <thead>
              <tr><th>Tx Hash</th><th>From</th><th>To</th><th>Amount</th><th>Age</th></tr>
            </thead>
            <tbody>
              {transfers.map((tx: any, i) => (
                <tr key={tx.tx_hash ?? i}>
                  <td><Link href={`/tx/${tx.tx_hash}`} className="mono text-rh-accent hover:underline text-xs">{shortAddr(tx.tx_hash, 10)}</Link></td>
                  <td>
                    <HolderTooltip address={tx.from?.hash ?? ''}>
                      <Link href={`/wallet/${tx.from?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">{shortAddr(tx.from?.hash ?? '', 8)}</Link>
                    </HolderTooltip>
                  </td>
                  <td>
                    <HolderTooltip address={tx.to?.hash ?? ''}>
                      <Link href={`/wallet/${tx.to?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">{shortAddr(tx.to?.hash ?? '', 8)}</Link>
                    </HolderTooltip>
                  </td>
                  <td className="mono text-sm">
                    {tx.total?.value ? formatNumber(parseFloat(tx.total.value) / Math.pow(10, parseInt(tx.token?.decimals ?? '18')), 4) : '?'}
                    {' '}<span className="text-rh-muted text-xs">{tokenInfo?.symbol}</span>
                  </td>
                  <td className="text-rh-muted text-xs">{timeAgo(tx.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.length === 0 && <div className="text-center py-12 text-rh-muted text-sm">No transfers found</div>}
        </div>
      )}
    </div>
  )
}
