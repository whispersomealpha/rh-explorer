'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../lib/api'
import { shortAddr, formatEth, timeAgo } from '../../lib/utils'

export default function TxsPage() {
  const [txs, setTxs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await api.getTxs(50)
      setTxs(data)
      setLoading(false)
    }
    load()
    const i = setInterval(load, 8000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rh-text">Transactions</h1>
          <p className="text-rh-muted text-sm">Latest transactions on Robinhood Chain</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-rh-muted">
          <div className="pulse-dot" /> Live
        </div>
      </div>

      <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-rh-muted">Loading transactions...</div>
        ) : (
          <table className="rh-table">
            <thead>
              <tr>
                <th>Hash</th>
                <th>Block</th>
                <th>Age</th>
                <th>From</th>
                <th>To</th>
                <th>Value</th>
                <th>Gas</th>
                <th>Status</th>
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
                  <td className="text-rh-muted text-xs">{timeAgo(tx.timestamp)}</td>
                  <td>
                    <Link href={`/wallet/${tx.from?.hash}`} className="mono text-xs text-rh-muted hover:text-rh-accent">
                      {shortAddr(tx.from?.hash ?? '', 8)}
                    </Link>
                  </td>
                  <td>
                    {tx.to?.hash ? (
                      <Link href={`/wallet/${tx.to.hash}`} className="mono text-xs text-rh-muted hover:text-rh-accent">
                        {shortAddr(tx.to.hash, 8)}
                      </Link>
                    ) : (
                      <span className="badge badge-orange text-xs">Contract Create</span>
                    )}
                  </td>
                  <td className="mono text-sm">{tx.value ? formatEth(tx.value) : '0'}</td>
                  <td className="mono text-xs text-rh-muted">
                    {tx.gas_used?.toLocaleString() ?? '—'}
                  </td>
                  <td>
                    <span className={`badge text-xs ${tx.status === true || tx.result === 'success' ? 'badge-green' : 'badge-red'}`}>
                      {tx.status === true || tx.result === 'success' ? '✓ OK' : '✗ Fail'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
