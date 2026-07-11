'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatNumber, timeAgo } from '../../../lib/utils'
import { HolderTooltip } from '../../../components/HolderTooltip'

// Module-level cache — persists across back/forward navigation
const pageCache = new Map<string, { tokenInfo: any; holders: any[]; transfers: any[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export default function TokenPage({ params }: { params: { address: string } }) {
  const { address } = params
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [holders, setHolders]     = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [tab, setTab]             = useState<'holders' | 'transfers'>('holders')
  const [loading, setLoading]     = useState(true)
  const [loadingMsg, setLoadingMsg] = useState('Loading token...')
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState<'rank' | 'balance' | 'share'>('rank')
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      // Check module-level cache first (survives back navigation)
      const cached = pageCache.get(address.toLowerCase())
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setTokenInfo(cached.tokenInfo)
        setHolders(cached.holders)
        setTransfers(cached.transfers)
        setLoading(false)
        return
      }

      setLoading(true)

      // Load token info fast first
      try {
        const info = await api.getToken(address)
        setTokenInfo(info)
        setLoadingMsg(`Loading holders (${parseInt(info.holders_count ?? info.holderCount ?? '0').toLocaleString()} total)...`)
      } catch {}

      // Animate loading message while holders fetch
      const msgs = [
        'Fetching holders from Blockscout...',
        'Paginating through all holder pages...',
        'Almost there...',
        'Processing holder data...',
      ]
      let msgIdx = 0
      intervalRef.current = setInterval(() => {
        msgIdx = (msgIdx + 1) % msgs.length
        setLoadingMsg(msgs[msgIdx])
      }, 2000)

      const [holdersData, txData] = await Promise.allSettled([
        api.getTokenHolders(address),
        api.getTokenTransfers(address),
      ])

      clearInterval(intervalRef.current)

      const info2 = holdersData.status === 'fulfilled' ? holdersData.value?.tokenInfo : null
      const h     = holdersData.status === 'fulfilled' ? (holdersData.value?.holders ?? []) : []
      const t     = txData.status === 'fulfilled' ? (txData.value?.items ?? []) : []

      if (info2) setTokenInfo(info2)
      setHolders(h)
      setTransfers(t)

      // Store in module cache
      pageCache.set(address.toLowerCase(), {
        tokenInfo: info2,
        holders: h,
        transfers: t,
        ts: Date.now(),
      })

      setLoading(false)
    }

    load()
    return () => clearInterval(intervalRef.current)
  }, [address])

  const filteredHolders = holders
    .filter(h => !search || h.address?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'balance') return b.balanceFormatted - a.balanceFormatted
      if (sortBy === 'share')   return b.share - a.share
      return a.rank - b.rank
    })

  const top10Share = holders.slice(0, 10).reduce((sum, h) => sum + (h.share ?? 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Token header */}
      {tokenInfo && (
        <div className="rounded-xl border border-rh-border bg-rh-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                     style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}>
                  {(tokenInfo.symbol ?? tokenInfo.name ?? '?')[0]}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rh-text">{tokenInfo.name ?? 'Unknown'}</h1>
                  <span className="text-sm text-rh-muted">{tokenInfo.symbol}</span>
                </div>
              </div>
              <div className="font-mono text-xs text-rh-muted break-all">{address}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-rh-text">
                  {formatNumber(parseInt(tokenInfo.holders_count ?? tokenInfo.holderCount ?? holders.length), 0)}
                </div>
                <div className="text-xs text-rh-muted">Holders</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rh-text">
                  {formatNumber(tokenInfo.totalSupplyFormatted ?? 0)}
                </div>
                <div className="text-xs text-rh-muted">Total Supply</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rh-text">
                  {formatNumber(parseInt(tokenInfo.transactions_count ?? tokenInfo.txCount ?? '0'), 0)}
                </div>
                <div className="text-xs text-rh-muted">Transactions</div>
              </div>
            </div>
          </div>

          {/* Concentration bar */}
          {holders.length > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-rh-muted mb-1">
                <span>Top 10 holders concentration</span>
                <span className={`font-semibold ${top10Share > 80 ? 'text-rh-red' : top10Share > 50 ? 'text-rh-yellow' : 'text-rh-green'}`}>
                  {top10Share.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-rh-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(top10Share, 100)}%`,
                    background: top10Share > 80 ? '#ff4d6d' : top10Share > 50 ? '#ff9f1c' : '#00d4aa',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-rh-border">
        {(['holders', 'transfers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-rh-accent text-rh-accent'
                : 'border-transparent text-rh-muted hover:text-rh-text'
            }`}
          >
            {t === 'holders' ? `Holders (${holders.length})` : 'Transfers'}
          </button>
        ))}
      </div>

      {tab === 'holders' && (
        <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by address..."
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent"
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text focus:outline-none"
            >
              <option value="rank">Sort by Rank</option>
              <option value="balance">Sort by Balance</option>
              <option value="share">Sort by Share %</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">⏳</div>
              <div className="text-rh-text font-medium mb-2">{loadingMsg}</div>
              <div className="text-sm text-rh-muted">
                Fetching all holders from Blockscout — results are cached for 5 minutes after first load
              </div>
              <div className="mt-6 flex justify-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-rh-accent animate-pulse"
                       style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
              <div className="px-4 py-2 border-b border-rh-border text-xs text-rh-muted">
                Hover any address to preview portfolio · Click to investigate
              </div>
              <table className="rh-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Address</th>
                    <th>Balance</th>
                    <th>Share</th>
                    <th>Bar</th>
                    <th>Investigate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolders.map((h, i) => (
                    <tr key={h.address}>
                      <td>
                        <span className={`badge ${i < 3 ? 'badge-purple' : 'badge-gray'}`}>
                          #{h.rank}
                        </span>
                      </td>
                      <td>
                        <HolderTooltip address={h.address}>
                          <Link
                            href={`/wallet/${h.address}`}
                            className="mono text-rh-accent hover:underline text-sm"
                          >
                            {shortAddr(h.address, 8)}
                          </Link>
                        </HolderTooltip>
                        {h.label && (
                          <div className="text-xs text-rh-muted mt-0.5">{h.label}</div>
                        )}
                      </td>
                      <td>
                        <span className="mono text-rh-text text-sm">
                          {formatNumber(h.balanceFormatted, 2)} {tokenInfo?.symbol}
                        </span>
                      </td>
                      <td>
                        <span className={`font-semibold text-sm ${
                          h.share > 10 ? 'text-rh-red' : h.share > 5 ? 'text-rh-yellow' : 'text-rh-text'
                        }`}>
                          {h.share.toFixed(3)}%
                        </span>
                      </td>
                      <td style={{ width: 120 }}>
                        <div className="h-1.5 rounded-full bg-rh-border overflow-hidden w-24">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min((h.share / (holders[0]?.share ?? 1)) * 100, 100)}%`,
                              background: h.share > 10 ? '#ff4d6d' : '#6c63ff',
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <Link
                          href={`/wallet/${h.address}`}
                          className="text-xs px-3 py-1 rounded-lg border border-rh-border hover:border-rh-accent hover:text-rh-accent transition-colors text-rh-muted"
                        >
                          🔍 Trace
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredHolders.length === 0 && (
                <div className="text-center py-12 text-rh-muted text-sm">No holders found</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'transfers' && (
        <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
          <table className="rh-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tx: any, i) => (
                <tr key={tx.tx_hash ?? i}>
                  <td>
                    <Link href={`/tx/${tx.tx_hash}`} className="mono text-rh-accent hover:underline text-xs">
                      {shortAddr(tx.tx_hash, 10)}
                    </Link>
                  </td>
                  <td>
                    <HolderTooltip address={tx.from?.hash ?? ''}>
                      <Link href={`/wallet/${tx.from?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">
                        {shortAddr(tx.from?.hash ?? '', 8)}
                      </Link>
                    </HolderTooltip>
                  </td>
                  <td>
                    <HolderTooltip address={tx.to?.hash ?? ''}>
                      <Link href={`/wallet/${tx.to?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">
                        {shortAddr(tx.to?.hash ?? '', 8)}
                      </Link>
                    </HolderTooltip>
                  </td>
                  <td className="mono text-sm">
                    {tx.total?.value
                      ? formatNumber(parseFloat(tx.total.value) / Math.pow(10, parseInt(tx.token?.decimals ?? '18')), 4)
                      : '?'}{' '}
                    {tokenInfo?.symbol}
                  </td>
                  <td className="text-rh-muted text-xs">{timeAgo(tx.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.length === 0 && (
            <div className="text-center py-12 text-rh-muted text-sm">No transfers found</div>
          )}
        </div>
      )}
    </div>
  )
}
