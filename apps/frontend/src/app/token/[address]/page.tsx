'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatNumber, timeAgo } from '../../../lib/utils'
import { HolderTooltip } from '../../../components/HolderTooltip'

// Module-level cache — survives back/forward navigation within session
const pageCache = new Map<string, {
  tokenInfo: any
  holders: any[]
  transfers: any[]
  ts: number
}>()
const CACHE_TTL = 5 * 60 * 1000

export default function TokenPage({ params }: { params: { address: string } }) {
  const { address } = params
  const addr = address.toLowerCase()

  const [tokenInfo, setTokenInfo]   = useState<any>(null)
  const [holders, setHolders]       = useState<any[]>([])
  const [transfers, setTransfers]   = useState<any[]>([])
  const [tab, setTab]               = useState<'holders' | 'transfers'>('holders')
  const [loadingInfo, setLoadingInfo]     = useState(true)
  const [loadingHolders, setLoadingHolders] = useState(true)
  const [loadingMsg, setLoadingMsg]   = useState('Fetching token info...')
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState<'rank' | 'balance' | 'share'>('rank')
  const msgTimer = useRef<any>(null)

  const animateMsgs = useCallback((count: number) => {
    const msgs = [
      `Fetching holders from Blockscout...`,
      `Paginating ${count > 0 ? count.toLocaleString() + ' ' : ''}holders...`,
      'Processing balances and shares...',
      'Almost done...',
    ]
    let i = 0
    clearInterval(msgTimer.current)
    msgTimer.current = setInterval(() => {
      i = (i + 1) % msgs.length
      setLoadingMsg(msgs[i])
    }, 2500)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Check module cache first — instant on back navigation
      const cached = pageCache.get(addr)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setTokenInfo(cached.tokenInfo)
        setHolders(cached.holders)
        setTransfers(cached.transfers)
        setLoadingInfo(false)
        setLoadingHolders(false)
        return
      }

      // Step 1: load token info fast
      setLoadingInfo(true)
      setLoadingHolders(true)
      try {
        const info = await api.getToken(address)
        if (!cancelled) {
          setTokenInfo(info)
          setLoadingInfo(false)
          const count = parseInt(info.holders_count ?? info.holderCount ?? '0')
          setLoadingMsg(`Fetching ${count > 0 ? count.toLocaleString() + ' ' : ''}holders...`)
          animateMsgs(count)
        }
      } catch {
        if (!cancelled) setLoadingInfo(false)
      }

      // Step 2: load holders + transfers in parallel (holders may be slow)
      try {
        const [holdersRes, transfersRes] = await Promise.allSettled([
          api.getTokenHolders(address),
          api.getTokenTransfers(address),
        ])

        if (cancelled) return
        clearInterval(msgTimer.current)

        const holderData = holdersRes.status === 'fulfilled' ? holdersRes.value : null
        const txData     = transfersRes.status === 'fulfilled' ? transfersRes.value : null

        const h = holderData?.holders ?? []
        const t = txData?.items ?? []
        const info2 = holderData?.tokenInfo

        if (info2) setTokenInfo((prev: any) => ({ ...prev, ...info2 }))
        setHolders(h)
        setTransfers(t)
        setLoadingHolders(false)

        // Cache for back navigation
        pageCache.set(addr, {
          tokenInfo: info2 ?? tokenInfo,
          holders: h,
          transfers: t,
          ts: Date.now(),
        })
      } catch (e) {
        console.error('Holder fetch error:', e)
        if (!cancelled) setLoadingHolders(false)
      }
    }

    load()
    return () => {
      cancelled = true
      clearInterval(msgTimer.current)
    }
  }, [address])

  const filteredHolders = holders
    .filter(h => !search || h.address?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'balance') return b.balanceFormatted - a.balanceFormatted
      if (sortBy === 'share')   return b.share - a.share
      return a.rank - b.rank
    })

  const top10Share = holders.slice(0, 10).reduce((sum, h) => sum + (h.share ?? 0), 0)
  const holderCount = holders.length || parseInt(tokenInfo?.holders_count ?? tokenInfo?.holderCount ?? '0')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Token header */}
      <div className="rounded-xl border border-rh-border bg-rh-card p-6 mb-6">
        {loadingInfo ? (
          <div className="text-rh-muted text-sm">Loading token info...</div>
        ) : tokenInfo ? (
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
                  {loadingHolders
                    ? <span className="text-rh-muted text-sm">Loading...</span>
                    : formatNumber(holderCount, 0)}
                </div>
                <div className="text-xs text-rh-muted">Holders</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rh-text mono text-base">
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
        ) : null}

        {/* Concentration bar — only show once holders are loaded */}
        {!loadingHolders && holders.length > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-rh-muted mb-1">
              <span>Top 10 holders concentration</span>
              <span className={`font-semibold ${top10Share > 80 ? 'text-rh-red' : top10Share > 50 ? 'text-rh-yellow' : 'text-rh-green'}`}>
                {top10Share.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-rh-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(top10Share, 100)}%`,
                  background: top10Share > 80 ? '#ff4d6d' : top10Share > 50 ? '#ff9f1c' : '#00d4aa',
                }}
              />
            </div>
          </div>
        )}
      </div>

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
            {t === 'holders'
              ? `Holders ${loadingHolders ? '(loading...)' : `(${holders.length})`}`
              : 'Transfers'}
          </button>
        ))}
      </div>

      {tab === 'holders' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by address..."
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent"
              disabled={loadingHolders}
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text focus:outline-none"
              disabled={loadingHolders}
            >
              <option value="rank">Sort by Rank</option>
              <option value="balance">Sort by Balance</option>
              <option value="share">Sort by Share %</option>
            </select>
          </div>

          {loadingHolders ? (
            <div className="text-center py-20 rounded-xl border border-rh-border bg-rh-card">
              <div className="text-4xl mb-4">⏳</div>
              <div className="text-rh-text font-medium mb-2">{loadingMsg}</div>
              <div className="text-sm text-rh-muted max-w-sm mx-auto">
                First load takes 5–20 seconds. Results are cached for 5 minutes — subsequent loads are instant.
              </div>
              <div className="mt-6 flex justify-center gap-1.5">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-rh-accent"
                       style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
              <div className="px-4 py-2 border-b border-rh-border bg-rh-surface">
                <span className="text-xs text-rh-muted">
                  Hover any address to preview portfolio · Click to full investigation
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Address</th>
                      <th>Balance</th>
                      <th>Share %</th>
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
                          <div>
                            <HolderTooltip address={h.address}>
                              <Link
                                href={`/wallet/${h.address}`}
                                className="mono text-rh-accent hover:underline text-sm"
                              >
                                {shortAddr(h.address, 10)}
                              </Link>
                            </HolderTooltip>
                            {h.label && (
                              <div className="text-xs text-rh-muted mt-0.5">{h.label}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="mono text-rh-text text-sm">
                            {formatNumber(h.balanceFormatted, 2)}{' '}
                            <span className="text-rh-muted text-xs">{tokenInfo?.symbol}</span>
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
                            className="text-xs px-3 py-1 rounded-lg border border-rh-border hover:border-rh-accent hover:text-rh-accent transition-colors text-rh-muted whitespace-nowrap"
                          >
                            🔍 Trace
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHolders.length === 0 && !loadingHolders && (
                  <div className="text-center py-12 text-rh-muted text-sm">No holders found</div>
                )}
              </div>
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
                    <span className="text-rh-muted text-xs">{tokenInfo?.symbol}</span>
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
