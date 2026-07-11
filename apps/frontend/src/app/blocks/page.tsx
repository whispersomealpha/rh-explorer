'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../lib/api'
import { timeAgo, formatNumber } from '../../lib/utils'

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await api.getBlocks(50)
      setBlocks(data)
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
          <h1 className="text-2xl font-bold text-rh-text">Blocks</h1>
          <p className="text-rh-muted text-sm">Latest blocks on Robinhood Chain</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-rh-muted">
          <div className="pulse-dot" /> Live
        </div>
      </div>

      <div className="rounded-xl border border-rh-border bg-rh-card overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-rh-muted">Loading blocks...</div>
        ) : (
          <table className="rh-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Age</th>
                <th>Txs</th>
                <th>Gas Used</th>
                <th>Gas Limit</th>
                <th>Utilization</th>
                <th>Miner</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b: any) => {
                const gasUsed  = parseInt(b.gas_used ?? '0')
                const gasLimit = parseInt(b.gas_limit ?? '1')
                const util     = Math.round((gasUsed / gasLimit) * 100)
                return (
                  <tr key={b.height}>
                    <td>
                      <Link href={`/block/${b.height}`} className="mono text-rh-accent hover:underline font-semibold">
                        #{b.height?.toLocaleString()}
                      </Link>
                    </td>
                    <td className="text-rh-muted text-xs">{timeAgo(b.timestamp)}</td>
                    <td>
                      <span className="badge badge-purple">{b.tx_count ?? 0}</span>
                    </td>
                    <td className="mono text-xs text-rh-muted">{formatNumber(gasUsed, 0)}</td>
                    <td className="mono text-xs text-rh-muted">{formatNumber(gasLimit, 0)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-rh-border overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${util}%`,
                              background: util > 80 ? '#ff4d6d' : util > 50 ? '#ff9f1c' : '#00d4aa',
                            }}
                          />
                        </div>
                        <span className="text-xs text-rh-muted">{util}%</span>
                      </div>
                    </td>
                    <td className="mono text-xs text-rh-muted">
                      {b.miner?.hash ? (
                        <Link href={`/wallet/${b.miner.hash}`} className="hover:text-rh-accent">
                          {b.miner.hash.slice(0, 10)}…
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
