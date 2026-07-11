'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatNumber, timeAgo } from '../../../lib/utils'

export default function TokenPage({ params }: { params: { address: string } }) {
  const { address } = params
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [holders, setHolders]     = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [tab, setTab]             = useState<'holders' | 'transfers'>('holders')
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState<'rank' | 'balance' | 'share'>('rank')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [info, holdersData, txData] = await Promise.allSettled([
        api.getToken(address),
        api.getTokenHolders(address),
        api.getTokenTransfers(address),
      ])
      if (info.status === 'fulfilled')        setTokenInfo(info.value)
      if (holdersData.status === 'fulfilled') setHolders(holdersData.value.holders ?? [])
      if (txData.status === 'fulfilled')      setTransfers(txData.value.items ?? [])
      setLoading(false)
    }
    load()
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
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
                     style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}>
                  {tokenInfo.symbol?.[0] ?? '?'}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rh-text">{tokenInfo.name}</h1>
                  <span className="text-sm text-rh-muted">{tokenInfo.symbol}</span>
                </div>
              </div>
              <div className="font-mono text-xs text-rh-muted break-all">{address}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-rh-text">{formatNumber(tokenInfo.holderCount, 0)}</div>
                <div className="text-xs text-rh-muted">Holders</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rh-text">{formatNumber(tokenInfo.totalSupplyFormatted)}</div>
                <div className="text-xs text-rh-muted">Total Supply</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rh-text">{formatNumber(tokenInfo.txCount, 0)}</div>
                <div className="text-xs text-rh-muted">Transactions</div>
              </div>
            </div>
          </div>

          {/* Concentration bar */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-rh-muted mb-1">
              <span>Top 10 holders concentration</span>
              <span className="font-semibold text-rh-text">{top10Share.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-rh-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(top10Share, 100)}%`,
                  background: top10Share > 80
                    ? '#ff4d6d'
                    : top10Share > 50
                    ? '#ff9f1c'
                    : '#00d4aa',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-rh-border">
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
            {t === 'holders' ? `Holders (${holders.length})` : `Transfers`}
          </button>
        ))}
      </div>

      {tab === 'holders' && (
        <>
          {/* Holder controls */}
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
            <div className="text-center py-16 text-rh-muted">Loading holders...</div>
          ) : (
            <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
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
                        <div className="flex flex-col">
                          <Link href={`/wallet/${h.address}`} className="mono text-rh-accent hover:underline text-sm">
                            {shortAddr(h.address, 8)}
                          </Link>
                          {h.label && (
                            <span className="text-xs text-rh-muted">{h.label}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="mono text-rh-text text-sm">
                          {formatNumber(h.balanceFormatted, 4)} {tokenInfo?.symbol}
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
                              width: `${Math.min(h.share, 100)}%`,
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
                    <Link href={`/wallet/${tx.from?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">
                      {shortAddr(tx.from?.hash ?? '', 8)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/wallet/${tx.to?.hash}`} className="mono text-rh-muted hover:text-rh-accent text-xs">
                      {shortAddr(tx.to?.hash ?? '', 8)}
                    </Link>
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
