'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatEth, formatNumber, timeAgo, formatTs } from '../../../lib/utils'

const TABS = ['transactions', 'token-transfers', 'tokens', 'crosschain', 'funding-trail'] as const
type Tab = typeof TABS[number]

export default function WalletPage({ params }: { params: { address: string } }) {
  const { address } = params

  const [tab, setTab]           = useState<Tab>('transactions')
  const [profile, setProfile]   = useState<any>(null)
  const [txs, setTxs]           = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [tokens, setTokens]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadingTxs, setLoadingTxs] = useState(false)
  const [txFilter, setTxFilter] = useState('')
  const [txPage, setTxPage]     = useState(1)
  const [hasMoreTxs, setHasMoreTxs] = useState(false)
  const [tokenFilter, setTokenFilter] = useState('')

  // Load wallet profile (ETH balance, funding info, cross-chain)
  useEffect(() => {
    setLoading(true)
    api.getWallet(address).then(p => { setProfile(p); setLoading(false) }).catch(() => setLoading(false))
    api.getWalletTokens(address).then(t => setTokens(t ?? []))
  }, [address])

  // Load transactions - call Blockscout directly to avoid 422 issues
  useEffect(() => {
    setLoadingTxs(true)
    // Try our API first, fall back to Blockscout directly
    const checksumAddr = address // browser won't checksum for us
    fetch(`https://robinhoodchain.blockscout.com/api/v2/addresses/${checksumAddr}/transactions`)
      .then(r => r.json())
      .then(data => {
        const items = data?.items ?? []
        setTxs(items)
        setHasMoreTxs(!!data?.next_page_params)
        setLoadingTxs(false)
      })
      .catch(() => {
        // Fallback to our API
        api.getWalletTxs(address, txPage).then(data => {
          const items = data?.items ?? []
          setTxs(items)
          setHasMoreTxs(!!data?.next_page_params)
          setLoadingTxs(false)
        }).catch(() => setLoadingTxs(false))
      })
  }, [address, txPage])

  // Load token transfers immediately on mount (not waiting for tab)
  useEffect(() => {
    fetch(`https://robinhoodchain.blockscout.com/api/v2/addresses/${address}/token-transfers?limit=100`)
      .then(r => r.json())
      .then(data => setTransfers(data?.items ?? []))
      .catch(() => {
        api.getWalletTransfers(address).then((data: any) => setTransfers(data?.items ?? []))
      })
  }, [address])

  const rh = profile?.rhChain
  const crossChain = (profile?.crossChain ?? [])
  const trail = profile?.fundingTrail ?? []

  // Group token transfers by token
  const transfersByToken: Record<string, any[]> = {}
  transfers.forEach(t => {
    const sym = t.token?.symbol ?? t.token?.address ?? 'Unknown'
    if (!transfersByToken[sym]) transfersByToken[sym] = []
    transfersByToken[sym].push(t)
  })

  const filteredTxs = txs.filter(tx =>
    !txFilter ||
    tx.hash?.toLowerCase().includes(txFilter.toLowerCase()) ||
    tx.to?.hash?.toLowerCase().includes(txFilter.toLowerCase()) ||
    tx.from?.hash?.toLowerCase().includes(txFilter.toLowerCase()) ||
    tx.method?.toLowerCase().includes(txFilter.toLowerCase())
  )

  function chainExplorerUrl(chainId: number, addr: string) {
    const bases: Record<number, string> = {
      1: 'https://etherscan.io', 8453: 'https://basescan.org',
      42161: 'https://arbiscan.io', 10: 'https://optimistic.etherscan.io',
      137: 'https://polygonscan.com', 56: 'https://bscscan.com',
    }
    return `${bases[chainId] ?? '#'}/address/${addr}`
  }

  function chainColor(chainId: number) {
    const m: Record<number,string> = { 1:'#627EEA', 8453:'#0052FF', 42161:'#28A0F0', 10:'#FF0420', 137:'#8247E5', 56:'#F3BA2F' }
    return m[chainId] ?? '#8888aa'
  }

  const tabLabels: Record<Tab, string> = {
    'transactions':    `Transactions (${txs.length}${hasMoreTxs ? '+' : ''})`,
    'token-transfers': `Token Transfers`,
    'tokens':          `Holdings (${tokens.length})`,
    'crosschain':      `Cross-chain (${crossChain.filter((c:any)=>c.hasActivity).length})`,
    'funding-trail':   `Funding Trail (${trail.length})`,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Address header */}
      <div className="rounded-xl border border-rh-border bg-rh-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full shrink-0"
                   style={{ background: `linear-gradient(135deg, hsl(${parseInt(address.slice(2,8),16)%360},70%,60%), #6c63ff)` }} />
              <h1 className="text-base font-semibold text-rh-text mono break-all">{address}</h1>
            </div>
            <button onClick={() => navigator.clipboard.writeText(address)}
                    className="text-xs text-rh-muted hover:text-rh-accent ml-10">📋 Copy</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center shrink-0">
            <div>
              <div className="text-base font-bold text-rh-text mono">
                {rh ? formatEth(rh.ethBalance, 4) : '—'}
              </div>
              <div className="text-xs text-rh-muted">ETH Balance</div>
            </div>
            <div>
              <div className="text-base font-bold text-rh-text">{rh?.txCount ?? '—'}</div>
              <div className="text-xs text-rh-muted">Transactions</div>
            </div>
            <div>
              <div className="text-base font-bold text-rh-text">{tokens.length}</div>
              <div className="text-xs text-rh-muted">Tokens</div>
            </div>
          </div>
        </div>

        {/* Funding source pill */}
        {rh?.fundedBy && (
          <div className="mt-3 flex items-center gap-2 text-xs text-rh-muted">
            <span>Funded via</span>
            <span className={`badge ${rh.fundingType === 'bridge' ? 'badge-purple' : rh.fundingType === 'cex' ? 'badge-yellow' : 'badge-green'}`}>
              {rh.fundingType}
            </span>
            <span>from</span>
            <Link href={`/wallet/${rh.fundedBy}`} className="mono text-rh-accent hover:underline">
              {shortAddr(rh.fundedBy, 8)}
            </Link>
            {rh.fundedAt && <span>· {timeAgo(rh.fundedAt)}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rh-border mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-rh-accent text-rh-accent' : 'border-transparent text-rh-muted hover:text-rh-text'
            }`}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* ── TRANSACTIONS TAB ── */}
      {tab === 'transactions' && (
        <>
          <div className="flex gap-2 mb-3">
            <input value={txFilter} onChange={e => setTxFilter(e.target.value)}
              placeholder="Filter by hash, address, method..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent" />
          </div>

          <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="rh-table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>Method</th>
                    <th>Block</th>
                    <th>Age</th>
                    <th>From</th>
                    <th></th>
                    <th>To</th>
                    <th>Value</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.map((tx: any, i) => {
                    const isOut = tx.from?.hash?.toLowerCase() === address.toLowerCase()
                    const fee = tx.gas_used && tx.gas_price
                      ? (Number(BigInt(tx.gas_used) * BigInt(tx.gas_price)) / 1e18).toFixed(6)
                      : '—'
                    return (
                      <tr key={tx.hash ?? i}>
                        <td>
                          <Link href={`/tx/${tx.hash}`} className="mono text-rh-accent hover:underline text-xs">
                            {shortAddr(tx.hash, 10)}
                          </Link>
                        </td>
                        <td>
                          {tx.method ? (
                            <span className="badge badge-gray text-xs">{tx.method}</span>
                          ) : tx.to?.hash ? (
                            <span className="badge badge-gray text-xs">Transfer</span>
                          ) : (
                            <span className="badge badge-orange text-xs">Create</span>
                          )}
                        </td>
                        <td>
                          <Link href={`/block/${tx.block}`} className="text-xs text-rh-muted hover:text-rh-accent mono">
                            {tx.block?.toLocaleString()}
                          </Link>
                        </td>
                        <td className="text-xs text-rh-muted whitespace-nowrap">{timeAgo(tx.timestamp)}</td>
                        <td>
                          <Link href={`/wallet/${tx.from?.hash}`}
                            className={`mono text-xs ${isOut ? 'text-rh-red font-semibold' : 'text-rh-muted hover:text-rh-accent'}`}>
                            {shortAddr(tx.from?.hash ?? '', 8)}
                          </Link>
                        </td>
                        <td>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isOut ? 'bg-rh-red/20 text-rh-red' : 'bg-rh-green/20 text-rh-green'}`}>
                            {isOut ? 'OUT' : 'IN'}
                          </span>
                        </td>
                        <td>
                          {tx.to?.hash ? (
                            <Link href={`/wallet/${tx.to.hash}`}
                              className={`mono text-xs ${!isOut ? 'text-rh-green font-semibold' : 'text-rh-muted hover:text-rh-accent'}`}>
                              {tx.to.is_contract ? '📄 ' : ''}{shortAddr(tx.to.hash, 8)}
                            </Link>
                          ) : <span className="text-rh-muted text-xs">Contract Create</span>}
                        </td>
                        <td className="mono text-sm">
                          {tx.value && tx.value !== '0' ? formatEth(tx.value, 6) : <span className="text-rh-muted text-xs">—</span>}
                        </td>
                        <td className="mono text-xs text-rh-muted">{fee} ETH</td>
                        <td>
                          <span className={`badge text-xs ${tx.status === true || tx.result === 'success' ? 'badge-green' : 'badge-red'}`}>
                            {tx.status === true || tx.result === 'success' ? '✓' : '✗'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredTxs.length === 0 && !loadingTxs && (
                <div className="text-center py-12 text-rh-muted text-sm">No transactions found</div>
              )}
            </div>
          </div>

          {/* Load more */}
          {hasMoreTxs && (
            <div className="text-center mt-4">
              <button
                onClick={() => setTxPage(p => p + 1)}
                disabled={loadingTxs}
                className="px-6 py-2 text-sm rounded-lg border border-rh-border text-rh-muted hover:text-rh-accent hover:border-rh-accent transition-colors disabled:opacity-40"
              >
                {loadingTxs ? 'Loading...' : 'Load more transactions'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TOKEN TRANSFERS TAB ── */}
      {tab === 'token-transfers' && (
        <div>
          <div className="flex gap-2 mb-3">
        <input value={tokenFilter} onChange={e => setTokenFilter(e.target.value)}
          placeholder="Filter by token symbol..."
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-rh-border bg-rh-surface text-rh-text placeholder-rh-muted focus:outline-none focus:border-rh-accent" />
        {tokenFilter && <button onClick={() => setTokenFilter('')} className="text-xs px-3 py-2 text-rh-muted hover:text-rh-accent border border-rh-border rounded-lg">Clear</button>}
      </div>
      {Object.keys(transfersByToken).length === 0 && transfers.length === 0 && (
            <div className="text-center py-12 text-rh-muted">Loading token transfers...</div>
          )}

          {Object.keys(transfersByToken).length === 0 && transfers.length > 0 && (
            <div className="text-center py-12 text-rh-muted text-sm">No token transfers found</div>
          )}

          {/* Group by token */}
          {Object.entries(transfersByToken)
    .filter(([symbol]) => !tokenFilter || symbol.toLowerCase().includes(tokenFilter.toLowerCase()))
    .map(([symbol, txList]) => {
            const tokenAddr = txList[0]?.token?.address
            return (
              <div key={symbol} className="mb-6 rounded-xl border border-rh-border bg-rh-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-rh-border bg-rh-surface">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                         style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4aa)' }}>
                      {symbol[0]}
                    </div>
                    <span className="font-semibold text-rh-text">{txList[0]?.token?.name ?? symbol}</span>
                    <span className="badge badge-purple text-xs">{symbol}</span>
                  </div>
                  {tokenAddr && (
                    <Link href={`/token/${tokenAddr}`} className="text-xs text-rh-accent hover:underline">
                      View holders →
                    </Link>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="rh-table">
                    <thead>
                      <tr>
                        <th>Tx Hash</th>
                        <th>Age</th>
                        <th>From</th>
                        <th></th>
                        <th>To</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txList.map((t: any, i) => {
                        const isOut = t.from?.hash?.toLowerCase() === address.toLowerCase()
                        const amount = t.total?.value
                          ? formatNumber(parseFloat(t.total.value) / Math.pow(10, parseInt(t.token?.decimals ?? '18')), 4)
                          : '?'
                        return (
                          <tr key={t.tx_hash ?? i}>
                            <td>
                              <Link href={`/tx/${t.tx_hash}`} className="mono text-rh-accent hover:underline text-xs">
                                {shortAddr(t.tx_hash, 10)}
                              </Link>
                            </td>
                            <td className="text-xs text-rh-muted">{timeAgo(t.timestamp)}</td>
                            <td>
                              <Link href={`/wallet/${t.from?.hash}`}
                                className={`mono text-xs ${isOut ? 'text-rh-red' : 'text-rh-muted hover:text-rh-accent'}`}>
                                {shortAddr(t.from?.hash ?? '', 8)}
                              </Link>
                            </td>
                            <td>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isOut ? 'bg-rh-red/20 text-rh-red' : 'bg-rh-green/20 text-rh-green'}`}>
                                {isOut ? 'OUT' : 'IN'}
                              </span>
                            </td>
                            <td>
                              <Link href={`/wallet/${t.to?.hash}`}
                                className={`mono text-xs ${!isOut ? 'text-rh-green' : 'text-rh-muted hover:text-rh-accent'}`}>
                                {shortAddr(t.to?.hash ?? '', 8)}
                              </Link>
                            </td>
                            <td>
                              <span className={`mono text-sm font-semibold ${isOut ? 'text-rh-red' : 'text-rh-green'}`}>
                                {isOut ? '-' : '+'}{amount} {symbol}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── HOLDINGS TAB ── */}
      {tab === 'tokens' && (
        <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
          <table className="rh-table">
            <thead>
              <tr><th>Token</th><th>Symbol</th><th>Balance</th><th>Contract</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tokens.map((t: any, i) => {
                const bal = parseFloat(t.value ?? '0') / Math.pow(10, parseInt(t.token?.decimals ?? '18'))
                return (
                  <tr key={i}>
                    <td>
                      <button onClick={() => { setTab('token-transfers'); setTokenFilter(t.token?.symbol ?? '') }}
                        className="font-semibold text-rh-accent hover:underline text-left">
                        {t.token?.name ?? 'Unknown'}
                      </button>
                    </td>
                    <td><span className="badge badge-purple">{t.token?.symbol}</span></td>
                    <td className="mono text-sm">{formatNumber(bal, 6)}</td>
                    <td>
                      <Link href={`/token/${t.token?.address}`} className="mono text-rh-accent hover:underline text-xs">
                        {shortAddr(t.token?.address ?? '', 10)}
                      </Link>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => { setTab('token-transfers'); setTokenFilter(t.token?.symbol ?? '') }}
                          className="text-xs px-2 py-1 rounded border border-rh-border hover:border-rh-accent hover:text-rh-accent transition-colors text-rh-muted">
                          Txs
                        </button>
                        <Link href={`/token/${t.token?.address}`}
                          className="text-xs px-2 py-1 rounded border border-rh-border hover:border-rh-accent hover:text-rh-accent transition-colors text-rh-muted">
                          Holders
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {tokens.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-rh-muted text-sm">No tokens</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CROSS-CHAIN TAB ── */}
      {tab === 'crosschain' && (
        <div className="space-y-3">
          {/* RH Chain */}
          <div className="rounded-xl border p-5" style={{ borderColor: '#6c63ff40', background: '#6c63ff08' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rh-accent" />
                <span className="font-semibold text-rh-text">Robinhood Chain</span>
                <span className="badge badge-purple text-xs">Current</span>
              </div>
              <span className="text-xs text-rh-muted">Chain ID 4663</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-rh-muted text-xs mb-1">ETH Balance</div><div className="mono">{rh ? formatEth(rh.ethBalance) : '—'}</div></div>
              <div><div className="text-rh-muted text-xs mb-1">Transactions</div><div>{rh?.txCount ?? 0}</div></div>
              <div><div className="text-rh-muted text-xs mb-1">First seen</div><div className="text-xs">{rh?.firstTx ? timeAgo(rh.firstTx) : '—'}</div></div>
            </div>
          </div>

          {crossChain.map((c: any) => (
            <div key={c.chainId}
                 className={`rounded-xl border p-5 transition-all ${c.hasActivity ? '' : 'opacity-40'}`}
                 style={{ borderColor: c.hasActivity ? chainColor(c.chainId) + '40' : '#2a2a3a', background: c.hasActivity ? chainColor(c.chainId) + '08' : 'transparent' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: chainColor(c.chainId) }} />
                  <span className="font-semibold text-rh-text">{c.chain}</span>
                  <span className={`badge text-xs ${c.hasActivity ? 'badge-green' : 'badge-gray'}`}>
                    {c.hasActivity ? 'Active' : 'No activity'}
                  </span>
                </div>
                <a href={chainExplorerUrl(c.chainId, address)} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-rh-muted hover:text-rh-accent">View on explorer ↗</a>
              </div>
              {c.hasActivity && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><div className="text-rh-muted text-xs mb-1">Balance</div><div className="mono">{formatEth(c.balance)}</div></div>
                  <div><div className="text-rh-muted text-xs mb-1">Transactions</div><div>{c.txCount.toLocaleString()}</div></div>
                  <div><div className="text-rh-muted text-xs mb-1">First seen</div><div className="text-xs">{c.firstSeen ? timeAgo(c.firstSeen) : '—'}</div></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── FUNDING TRAIL TAB ── */}
      {tab === 'funding-trail' && (
        <div>
          {trail.length === 0 ? (
            <div className="text-center py-12 text-rh-muted">
              <div className="text-3xl mb-3">🔍</div>
              <div>No funding trail found</div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-rh-border" />
              <div className="space-y-4">
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-3 w-5 h-5 rounded-full border-2 border-rh-accent bg-rh-bg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-rh-accent" />
                  </div>
                  <div className="flex-1 rounded-lg border border-rh-accent/30 bg-rh-accent/5 p-4">
                    <span className="badge badge-purple text-xs">Target Wallet</span>
                    <div className="mono text-sm text-rh-text mt-1">{address}</div>
                    {rh?.fundedAt && <div className="text-xs text-rh-muted mt-1">First funded: {formatTs(rh.fundedAt)}</div>}
                  </div>
                </div>
                {trail.map((hop: any, i: number) => (
                  <div key={i} className="relative flex items-start gap-4 pl-12">
                    <div className="absolute left-3 w-5 h-5 rounded-full border-2 bg-rh-bg"
                         style={{ borderColor: chainColor(hop.chainId) }}>
                      <div className="w-2 h-2 rounded-full m-auto mt-1" style={{ background: chainColor(hop.chainId) }} />
                    </div>
                    <div className="flex-1 rounded-lg border border-rh-border bg-rh-card p-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="badge badge-gray text-xs">{hop.label ?? hop.type}</span>
                        <span className="badge text-xs" style={{ color: chainColor(hop.chainId), background: chainColor(hop.chainId) + '20' }}>
                          {hop.chain}
                        </span>
                        <span className="text-xs text-rh-muted">Hop {hop.hop}</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-rh-muted mb-1">From</div>
                          <Link href={`/wallet/${hop.fromAddress}`} className="mono text-rh-accent hover:underline text-xs">
                            {shortAddr(hop.fromAddress, 12)}
                          </Link>
                        </div>
                        {hop.txHash && (
                          <div>
                            <div className="text-xs text-rh-muted mb-1">Transaction</div>
                            <a href={`https://robinhoodchain.blockscout.com/tx/${hop.txHash}`} target="_blank" rel="noopener noreferrer"
                               className="mono text-rh-accent hover:underline text-xs">
                              {shortAddr(hop.txHash, 12)} ↗
                            </a>
                          </div>
                        )}
                        {hop.timestamp > 0 && (
                          <div>
                            <div className="text-xs text-rh-muted mb-1">Time</div>
                            <span className="text-xs">{formatTs(hop.timestamp)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
