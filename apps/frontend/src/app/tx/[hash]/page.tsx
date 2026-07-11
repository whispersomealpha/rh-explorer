'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '../../../lib/api'
import { shortAddr, formatEth, formatGwei, formatTs, timeAgo } from '../../../lib/utils'

export default function TxPage({ params }: { params: { hash: string } }) {
  const { hash } = params
  const router = useRouter()
  const [tx, setTx]         = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTx(hash).then(data => { setTx(data); setLoading(false) }).catch(() => setLoading(false))
  }, [hash])

  if (loading) return <div className="text-center py-20 text-rh-muted">Loading transaction...</div>
  if (!tx)     return <div className="text-center py-20 text-rh-red">Transaction not found</div>

  const success = tx.status === true || tx.result === 'success'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-rh-muted hover:text-rh-accent mb-5 transition-colors">
        ← Back
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-rh-text">Transaction</h1>
          <span className={`badge text-sm ${success ? 'badge-green' : 'badge-red'}`}>
            {success ? '✓ Success' : '✗ Failed'}
          </span>
        </div>
        <div className="mono text-sm text-rh-muted break-all">{hash}</div>
      </div>

      <div className="rounded-xl border border-rh-border bg-rh-card divide-y divide-rh-border">
        {[
          { label: 'Block', value: <Link href={`/block/${tx.block}`} className="text-rh-accent hover:underline mono">#{tx.block?.toLocaleString()}</Link> },
          { label: 'Timestamp', value: tx.timestamp ? `${formatTs(tx.timestamp)} (${timeAgo(tx.timestamp)})` : '—' },
          { label: 'From', value: <Link href={`/wallet/${tx.from?.hash}`} className="mono text-rh-accent hover:underline break-all">{tx.from?.hash}</Link> },
          { label: 'To', value: tx.to?.hash
            ? <Link href={`/wallet/${tx.to.hash}`} className="mono text-rh-accent hover:underline break-all">{tx.to.hash}</Link>
            : <span className="badge badge-orange">Contract Creation</span> },
          { label: 'Value', value: <span className="mono">{formatEth(tx.value ?? '0', 8)}</span> },
          { label: 'Gas Used', value: <span className="mono">{parseInt(tx.gas_used ?? '0').toLocaleString()}</span> },
          { label: 'Gas Price', value: <span className="mono">{formatGwei(tx.gas_price ?? '0')}</span> },
          { label: 'Tx Fee', value: <span className="mono">{formatEth(String(BigInt(tx.gas_used ?? '0') * BigInt(tx.gas_price ?? '0')), 8)}</span> },
          { label: 'Nonce', value: <span className="mono">{tx.nonce}</span> },
          { label: 'Tx Index', value: tx.position },
        ].map(row => (
          <div key={row.label} className="flex px-5 py-3 text-sm">
            <div className="w-32 shrink-0 text-rh-muted">{row.label}</div>
            <div className="text-rh-text flex-1">{row.value}</div>
          </div>
        ))}

        {tx.raw_input && tx.raw_input !== '0x' && (
          <div className="px-5 py-4">
            <div className="text-xs text-rh-muted uppercase tracking-wider mb-2 font-semibold">Input Data</div>
            {tx.decoded_input && (
              <div className="mb-2 p-3 rounded-lg bg-rh-surface border border-rh-border">
                <div className="text-xs font-semibold text-rh-accent mb-1">{tx.decoded_input.method_call}</div>
                {tx.decoded_input.parameters?.map((p: any, i: number) => (
                  <div key={i} className="text-xs text-rh-muted mono">{p.name}: <span className="text-rh-text">{p.value}</span></div>
                ))}
              </div>
            )}
            <div className="p-3 rounded-lg bg-rh-surface border border-rh-border">
              <div className="mono text-xs text-rh-muted break-all leading-relaxed">{tx.raw_input}</div>
            </div>
          </div>
        )}

        {tx.logs?.length > 0 && (
          <div className="px-5 py-4">
            <div className="text-xs text-rh-muted uppercase tracking-wider mb-3 font-semibold">
              Logs ({tx.logs.length})
            </div>
            <div className="space-y-2">
              {tx.logs.map((log: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-rh-surface border border-rh-border text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-gray">Log #{i}</span>
                    <Link href={`/wallet/${log.address?.hash}`} className="mono text-rh-accent hover:underline">
                      {shortAddr(log.address?.hash ?? '', 8)}
                    </Link>
                  </div>
                  {log.decoded?.method_call && (
                    <div className="text-rh-accent font-semibold mb-1">{log.decoded.method_call}</div>
                  )}
                  {log.topics?.map((t: string, j: number) => (
                    <div key={j} className="mono text-rh-muted">
                      topic{j}: <span className="text-rh-text">{t}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
