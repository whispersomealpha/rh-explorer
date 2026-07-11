'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import {
  shortAddr, formatEth, formatNumber, timeAgo, formatTs,
  chainColor, chainName, explorerUrl, fundingTypeLabel,
} from '../../../lib/utils'

export default function WalletPage({ params }: { params: { address: string } }) {
  const { address } = params
  const [profile, setProfile]   = useState<any>(null)
  const [txs, setTxs]           = useState<any[]>([])
  const [tokens, setTokens]     = useState<any[]>([])
  const [tab, setTab]           = useState<'overview' | 'txs' | 'tokens' | 'crosschain' | 'trail'>('overview')
  const [loading, setLoading]   = useState(true)
  const [trailLoading, setTrailLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setTrailLoading(true)
      const [prof, txData, tokData] = await Promise.allSettled([
        api.getWallet(address),
        api.getWalletTxs(address),
        api.getWalletTokens(address),
      ])
      if (prof.status === 'fulfilled')    setProfile(prof.value)
      if (txData.status === 'fulfilled')  setTxs(txData.value?.items ?? [])
      if (tokData.status === 'fulfilled') setTokens(tokData.value ?? [])
      setLoading(false)
      setTrailLoading(false)
    }
    load()
  }, [address])

  const rh = profile?.rhChain
  const crossChain = (profile?.crossChain ?? []).filter((c: any) => c.hasActivity)
  const trail = profile?.fundingTrail ?? []
  const labels = profile?.labels ?? []
  const { label: ftLabel, cls: ftCls } = fundingTypeLabel(rh?.fundingType)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="rounded-xl border border-rh-border bg-rh-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="w-10 h-10 rounded-full shrink-0"
                   style={{ background: `linear-gradient(135deg, ${stringToColor(address)}, #6c63ff)` }} />
              <div>
                <div className="mono text-rh-text font-semibold break-all">{address}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {labels.map((l: string) => (
                    <span key={l} className="badge badge-purple text-xs">{l}</span>
                  ))}
                  {rh?.fundingType && (
                    <span className={`badge ${ftCls} text-xs`}>Funded via {ftLabel}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="text-xs text-rh-muted hover:text-rh-accent transition-colors"
            >
              📋 Copy address
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 text-center shrink-0">
            <div>
              <div className="text-lg font-bold text-rh-text mono">
                {rh ? formatEth(rh.ethBalance, 4) : '—'}
              </div>
              <div className="text-xs text-rh-muted">ETH Balance</div>
            </div>
            <div>
              <div className="text-lg font-bold text-rh-text">{rh?.txCount ?? '—'}</div>
              <div className="text-xs text-rh-muted">Transactions</div>
            </div>
            <div>
              <div className="text-lg font-bold text-rh-text">{crossChain.length}</div>
              <div className="text-xs text-rh-muted">Active Chains</div>
            </div>
          </div>
        </div>

        {/* Chain activity dots */}
        {crossChain.length > 0 && (
          <div className="mt-4 pt-4 border-t border-rh-border">
            <div className="text-xs text-rh-muted mb-2">Active on</div>
            <div className="flex flex-wrap gap-2">
              {crossChain.map((c: any) => (
                <div key={c.chainId}
                     className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                     style={{ borderColor: chainColor(c.chainId) + '40', color: chainColor(c.chainId), background: chainColor(c.chainId) + '15' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: chainColor(c.chainId) }} />
                  {c.chain}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-rh-border overflow-x-auto">
        {[
          { key: 'overview',   label: 'Overview' },
          { key: 'trail',      label: `Funding Trail ${trail.length > 0 ? `(${trail.length})` : ''}` },
          { key: 'crosschain', label: `Cross-chain (${crossChain.length})` },
          { key: 'txs',        label: `Transactions (${txs.length})` },
          { key: 'tokens',     label: `Tokens (${tokens.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-rh-accent text-rh-accent'
                : 'border-transparent text-rh-muted hover:text-rh-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16 text-rh-muted">
          <div className="text-2xl mb-3">🔍</div>
          <div>Investigating wallet across all chains...</div>
          <div className="text-sm mt-1">This may take up to 15 seconds</div>
        </div>
      )}

      {!loading && (
        <>
          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Funding info */}
              <div className="rounded-xl border border-rh-border bg-rh-card p-5">
                <h3 className="text-sm font-semibold text-rh-text mb-4">📥 How this wallet was funded</h3>
                {rh?.fundedBy ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-rh-muted">Type</span>
                      <span className={`badge ${ftCls}`}>{ftLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-rh-muted">Funded by</span>
                      <Link href={`/wallet/${rh.fundedBy}`} className="mono text-rh-accent hover:underline text-xs">
                        {shortAddr(rh.fundedBy, 8)}
                      </Link>
                    </div>
                    {rh.fundedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-rh-muted">Funded at</span>
                        <span className="text-rh-text text-xs">{formatTs(rh.fundedAt)}</span>
                      </div>
                    )}
                    {rh.fundedByTx && (
                      <div className="flex justify-between text-sm">
                        <span className="text-rh-muted">Funding tx</span>
                        <Link href={`/tx/${rh.fundedByTx}`} className="mono text-rh-accent hover:underline text-xs">
                          {shortAddr(rh.fundedByTx, 10)}
                        </Link>
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-rh-border">
                      <button onClick={() => setTab('trail')}
                              className="text-xs text-rh-accent hover:underline">
                        View full funding trail →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-rh-muted">No funding source detected</div>
                )}
              </div>

              {/* Activity summary */}
              <div className="rounded-xl border border-rh-border bg-rh-card p-5">
                <h3 className="text-sm font-semibold text-rh-text mb-4">📊 Activity Summary</h3>
                <div className="space-y-3">
                  {rh?.firstTx && (
                    <div className="flex justify-between text-sm">
                      <span className="text-rh-muted">First activity</span>
                      <span className="text-rh-text text-xs">{formatTs(rh.firstTx)}</span>
                    </div>
                  )}
                  {rh?.lastTx && (
                    <div className="flex justify-between text-sm">
                      <span className="text-rh-muted">Last activity</span>
                      <span className="text-rh-text text-xs">{timeAgo(rh.lastTx)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-rh-muted">Total txs (RH Chain)</span>
                    <span className="text-rh-text">{rh?.txCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-rh-muted">Token balances</span>
                    <span className="text-rh-text">{tokens.length} tokens</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-rh-muted">Chains with activity</span>
                    <span className="text-rh-text">{crossChain.length + 1} chains</span>
                  </div>
                </div>
              </div>

              {/* Token balances quick view */}
              {tokens.length > 0 && (
                <div className="rounded-xl border border-rh-border bg-rh-card p-5 md:col-span-2">
                  <h3 className="text-sm font-semibold text-rh-text mb-4">🪙 Token Holdings</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {tokens.slice(0, 8).map((t: any, i: number) => (
                      <Link
                        key={i}
                        href={`/token/${t.token?.address}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-rh-border hover:border-rh-accent transition-colors"
                      >
                        <div>
                          <div className="text-sm font-semibold text-rh-text">{t.token?.symbol}</div>
                          <div className="text-xs text-rh-muted mono">
                            {formatNumber(
                              parseFloat(t.value ?? '0') / Math.pow(10, parseInt(t.token?.decimals ?? '18')),
                              4
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FUNDING TRAIL TAB */}
          {tab === 'trail' && (
            <div>
              <div className="mb-4 p-4 rounded-lg border border-rh-border bg-rh-surface text-sm text-rh-muted">
                🔎 This trail shows how this wallet was originally funded — tracing back through bridges, transfers,
                and CEX withdrawals across chains. Deeper hops indicate older funding sources.
              </div>

              {trailLoading ? (
                <div className="text-center py-12 text-rh-muted">Tracing funding trail across chains...</div>
              ) : trail.length === 0 ? (
                <div className="text-center py-12 text-rh-muted">
                  <div className="text-3xl mb-3">🔍</div>
                  <div>No funding trail found. This wallet may have been funded via a method not yet traced,
                  or may be a genesis wallet.</div>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-rh-border" />

                  <div className="space-y-4">
                    {/* The wallet itself */}
                    <div className="relative flex items-start gap-4 pl-12">
                      <div className="absolute left-3 w-5 h-5 rounded-full border-2 border-rh-accent bg-rh-bg flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-rh-accent" />
                      </div>
                      <div className="flex-1 rounded-lg border border-rh-accent/30 bg-rh-accent/5 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-purple text-xs">Target Wallet</span>
                          <span className="badge badge-gray text-xs">Robinhood Chain</span>
                        </div>
                        <div className="mono text-sm text-rh-text">{address}</div>
                        {rh?.fundedAt && (
                          <div className="text-xs text-rh-muted mt-1">First funded: {formatTs(rh.fundedAt)}</div>
                        )}
                      </div>
                    </div>

                    {/* Trail hops */}
                    {trail.map((hop: any, i: number) => {
                      const { label: tLabel, cls: tCls } = fundingTypeLabel(hop.type)
                      return (
                        <div key={i} className="relative flex items-start gap-4 pl-12">
                          <div className="absolute left-3 w-5 h-5 rounded-full border-2 border-rh-border bg-rh-bg flex items-center justify-center"
                               style={{ borderColor: chainColor(hop.chainId) }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: chainColor(hop.chainId) }} />
                          </div>

                          <div className="flex-1 rounded-lg border border-rh-border bg-rh-card p-4">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`badge ${tCls} text-xs`}>{hop.label ?? tLabel}</span>
                              <span className="badge badge-gray text-xs" style={{ color: chainColor(hop.chainId) }}>
                                {hop.chain}
                              </span>
                              <span className="text-xs text-rh-muted">Hop {hop.hop}</span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-xs text-rh-muted mb-1">From</div>
                                <a
                                  href={explorerUrl(hop.chainId, 'address', hop.fromAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mono text-rh-accent hover:underline text-xs"
                                >
                                  {shortAddr(hop.fromAddress, 10)}
                                </a>
                                {hop.type !== 'bridge' && (
                                  <Link href={`/wallet/${hop.fromAddress}`}
                                        className="ml-2 text-xs text-rh-muted hover:text-rh-accent">
                                    [investigate]
                                  </Link>
                                )}
                              </div>
                              <div>
                                <div className="text-xs text-rh-muted mb-1">To</div>
                                <span className="mono text-rh-text text-xs">{shortAddr(hop.toAddress, 10)}</span>
                              </div>
                              {hop.txHash && (
                                <div>
                                  <div className="text-xs text-rh-muted mb-1">Transaction</div>
                                  <a
                                    href={explorerUrl(hop.chainId, 'tx', hop.txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mono text-rh-accent hover:underline text-xs"
                                  >
                                    {shortAddr(hop.txHash, 10)} ↗
                                  </a>
                                </div>
                              )}
                              {hop.timestamp > 0 && (
                                <div>
                                  <div className="text-xs text-rh-muted mb-1">Time</div>
                                  <span className="text-xs text-rh-text">{formatTs(hop.timestamp)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Trail end */}
                    <div className="relative flex items-start gap-4 pl-12">
                      <div className="absolute left-3 w-5 h-5 rounded-full border-2 border-rh-muted bg-rh-bg" />
                      <div className="text-xs text-rh-muted py-3">
                        — End of traced trail (max 5 hops) —
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CROSS-CHAIN TAB */}
          {tab === 'crosschain' && (
            <div className="space-y-4">
              <div className="mb-4 p-4 rounded-lg border border-rh-border bg-rh-surface text-sm text-rh-muted">
                🌐 Cross-chain presence check — scanning the same address on 6 major EVM chains.
              </div>

              {/* Robinhood Chain first */}
              <div className="rounded-xl border p-5" style={{ borderColor: '#6c63ff40', background: '#6c63ff08' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: '#6c63ff' }} />
                    <span className="font-semibold text-rh-text">Robinhood Chain</span>
                    <span className="badge badge-purple text-xs">Current</span>
                  </div>
                  <span className="text-xs text-rh-muted">Chain ID 4663</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-rh-muted text-xs mb-1">ETH Balance</div>
                    <div className="text-rh-text mono">{rh ? formatEth(rh.ethBalance) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-rh-muted text-xs mb-1">Transactions</div>
                    <div className="text-rh-text">{rh?.txCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-rh-muted text-xs mb-1">First seen</div>
                    <div className="text-rh-text text-xs">{rh?.firstTx ? timeAgo(rh.firstTx) : '—'}</div>
                  </div>
                </div>
              </div>

              {/* Other chains */}
              {(profile?.crossChain ?? []).map((c: any) => (
                <div key={c.chainId}
                     className={`rounded-xl border p-5 transition-all ${c.hasActivity ? '' : 'opacity-40'}`}
                     style={{
                       borderColor: c.hasActivity ? chainColor(c.chainId) + '40' : '#2a2a3a',
                       background:  c.hasActivity ? chainColor(c.chainId) + '08' : 'transparent',
                     }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: chainColor(c.chainId) }} />
                      <span className="font-semibold text-rh-text">{c.chain}</span>
                      {c.hasActivity
                        ? <span className="badge badge-green text-xs">Active</span>
                        : <span className="badge badge-gray text-xs">No activity</span>}
                    </div>
                    <a
                      href={explorerUrl(c.chainId, 'address', address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rh-muted hover:text-rh-accent transition-colors"
                    >
                      View on explorer ↗
                    </a>
                  </div>

                  {c.hasActivity && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-rh-muted text-xs mb-1">ETH Balance</div>
                        <div className="text-rh-text mono">{formatEth(c.balance)}</div>
                      </div>
                      <div>
                        <div className="text-rh-muted text-xs mb-1">Transactions</div>
                        <div className="text-rh-text">{c.txCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-rh-muted text-xs mb-1">First seen</div>
                        <div className="text-rh-text text-xs">{c.firstSeen ? timeAgo(c.firstSeen) : '—'}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TRANSACTIONS TAB */}
          {tab === 'txs' && (
            <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
              <table className="rh-table">
                <thead>
                  <tr>
                    <th>Hash</th>
                    <th>Block</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx: any, i) => (
                    <tr key={tx.hash ?? i}>
                      <td>
                        <Link href={`/tx/${tx.hash}`} className="mono text-rh-accent hover:underline text-xs">
                          {shortAddr(tx.hash, 10)}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/block/${tx.block}`} className="text-xs text-rh-muted hover:text-rh-accent">
                          #{tx.block?.toLocaleString()}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/wallet/${tx.from?.hash}`}
                              className={`mono text-xs ${tx.from?.hash?.toLowerCase() === address.toLowerCase() ? 'text-rh-red' : 'text-rh-muted hover:text-rh-accent'}`}>
                          {shortAddr(tx.from?.hash ?? '', 8)}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/wallet/${tx.to?.hash}`}
                              className={`mono text-xs ${tx.to?.hash?.toLowerCase() === address.toLowerCase() ? 'text-rh-green' : 'text-rh-muted hover:text-rh-accent'}`}>
                          {tx.to?.hash ? shortAddr(tx.to.hash, 8) : 'Contract Create'}
                        </Link>
                      </td>
                      <td className="mono text-sm">{tx.value ? formatEth(tx.value, 6) : '—'}</td>
                      <td>
                        <span className={`badge ${tx.status === true || tx.result === 'success' ? 'badge-green' : 'badge-red'} text-xs`}>
                          {tx.status === true || tx.result === 'success' ? '✓' : '✗'}
                        </span>
                      </td>
                      <td className="text-rh-muted text-xs">{timeAgo(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txs.length === 0 && <div className="text-center py-12 text-rh-muted text-sm">No transactions</div>}
            </div>
          )}

          {/* TOKENS TAB */}
          {tab === 'tokens' && (
            <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
              <table className="rh-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Symbol</th>
                    <th>Balance</th>
                    <th>Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t: any, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-rh-text">{t.token?.name ?? 'Unknown'}</td>
                      <td><span className="badge badge-purple">{t.token?.symbol}</span></td>
                      <td className="mono text-sm">
                        {formatNumber(
                          parseFloat(t.value ?? '0') / Math.pow(10, parseInt(t.token?.decimals ?? '18')),
                          6
                        )}
                      </td>
                      <td>
                        <Link href={`/token/${t.token?.address}`} className="mono text-rh-accent hover:underline text-xs">
                          {shortAddr(t.token?.address ?? '', 8)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tokens.length === 0 && <div className="text-center py-12 text-rh-muted text-sm">No tokens</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${hash % 360}, 70%, 60%)`
}
