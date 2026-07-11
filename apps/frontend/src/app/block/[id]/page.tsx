'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { shortAddr, formatEth, formatTs, timeAgo, formatNumber } from '../../../lib/utils'

export default function BlockPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [block, setBlock]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getBlock(id).then(d => { setBlock(d); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-20 text-rh-muted">Loading block...</div>
  if (!block)  return <div className="text-center py-20 text-rh-red">Block not found</div>

  const gasUsed  = parseInt(block.gas_used ?? '0')
  const gasLimit = parseInt(block.gas_limit ?? '1')
  const util     = Math.round((gasUsed / gasLimit) * 100)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-rh-text mb-1">Block #{block.height?.toLocaleString()}</h1>
        <div className="mono text-sm text-rh-muted break-all">{block.hash}</div>
      </div>

      <div className="rounded-xl border border-rh-border bg-rh-card divide-y divide-rh-border mb-6">
        {[
          { label: 'Height',      value: <span className="mono font-bold">{block.height?.toLocaleString()}</span> },
          { label: 'Timestamp',   value: block.timestamp ? `${formatTs(block.timestamp)} (${timeAgo(block.timestamp)})` : '—' },
          { label: 'Transactions', value: <span className="badge badge-purple">{block.tx_count ?? 0} transactions</span> },
          { label: 'Gas Used',    value: <div className="flex items-center gap-3"><span className="mono">{formatNumber(gasUsed, 0)}</span><div className="w-24 h-1.5 rounded-full bg-rh-border overflow-hidden"><div className="h-full rounded-full" style={{ width: `${util}%`, background: util > 80 ? '#ff4d6d' : '#00d4aa' }} /></div><span className="text-xs text-rh-muted">{util}%</span></div> },
          { label: 'Gas Limit',   value: <span className="mono">{formatNumber(gasLimit, 0)}</span> },
          { label: 'Miner',       value: block.miner?.hash ? <Link href={`/wallet/${block.miner.hash}`} className="mono text-rh-accent hover:underline break-all">{block.miner.hash}</Link> : '—' },
          { label: 'Parent Hash', value: <Link href={`/block/${block.parent_hash}`} className="mono text-rh-muted hover:text-rh-accent break-all text-xs">{block.parent_hash}</Link> },
          { label: 'Size',        value: <span className="mono">{block.size?.toLocaleString()} bytes</span> },
          { label: 'Nonce',       value: <span className="mono text-xs">{block.nonce}</span> },
        ].map(row => (
          <div key={row.label} className="flex px-5 py-3 text-sm">
            <div className="w-36 shrink-0 text-rh-muted">{row.label}</div>
            <div className="text-rh-text flex-1">{row.value}</div>
          </div>
        ))}
      </div>

      {/* Transactions in this block */}
      {block.transactions?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-rh-text mb-3">
            Transactions ({block.transactions.length})
          </h2>
          <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
            <table className="rh-table">
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {block.transactions.map((tx: any, i: number) => (
                  <tr key={tx.hash ?? i}>
                    <td>
                      <Link href={`/tx/${tx.hash}`} className="mono text-rh-accent hover:underline text-xs">
                        {shortAddr(tx.hash, 10)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/wallet/${tx.from?.hash}`} className="mono text-xs text-rh-muted hover:text-rh-accent">
                        {shortAddr(tx.from?.hash ?? '', 8)}
                      </Link>
                    </td>
                    <td>
                      {tx.to?.hash
                        ? <Link href={`/wallet/${tx.to.hash}`} className="mono text-xs text-rh-muted hover:text-rh-accent">{shortAddr(tx.to.hash, 8)}</Link>
                        : <span className="badge badge-orange text-xs">Create</span>}
                    </td>
                    <td className="mono text-sm">{formatEth(tx.value ?? '0')}</td>
                    <td>
                      <span className={`badge text-xs ${tx.status === true || tx.result === 'success' ? 'badge-green' : 'badge-red'}`}>
                        {tx.status === true || tx.result === 'success' ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
