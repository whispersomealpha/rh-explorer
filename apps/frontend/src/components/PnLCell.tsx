'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { formatNumber } from '../lib/utils'

interface Props {
  holderAddress: string
  tokenAddress: string
  balance: number
  decimals: number
  currentPriceUsd: number | null
  visible: boolean // only fetch when row is visible
}

// Shared cache across all PnL cells on the page
const pnlCache = new Map<string, any>()

export function PnLCell({
  holderAddress,
  tokenAddress,
  balance,
  decimals,
  currentPriceUsd,
  visible,
}: Props) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const fetchedRef            = useRef(false)

  useEffect(() => {
    if (!visible || fetchedRef.current) return
    fetchedRef.current = true

    const cacheKey = `${holderAddress}:${tokenAddress}`
    if (pnlCache.has(cacheKey)) {
      setData(pnlCache.get(cacheKey))
      return
    }

    setLoading(true)
    api.getHolderPnL(tokenAddress, holderAddress, balance, decimals)
      .then(result => {
        pnlCache.set(cacheKey, result)
        setData(result)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [visible, holderAddress, tokenAddress])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-3 rounded bg-rh-border animate-pulse" />
      </div>
    )
  }

  if (!data) return <span className="text-rh-muted text-xs">—</span>

  // Current value from price × balance
  const currentValue = currentPriceUsd != null ? balance * currentPriceUsd : null
  const tradeCount = data.tradeCount ?? 0

  return (
    <div className="flex flex-col gap-0.5">
      {currentValue != null && (
        <span className="text-xs font-semibold text-rh-text mono">
          ${formatNumber(currentValue, 2)}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-rh-muted">{tradeCount} txs</span>
        {data.firstBuyBlock && (
          <span className="text-xs text-rh-muted">·</span>
        )}
      </div>
    </div>
  )
}

// Simpler version — just shows current USD value + trade count
export function ValueCell({
  balance,
  currentPriceUsd,
  tradeCount,
}: {
  balance: number
  currentPriceUsd: number | null
  tradeCount?: number
}) {
  if (currentPriceUsd == null) return <span className="text-rh-muted text-xs">No price data</span>
  const value = balance * currentPriceUsd
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold text-rh-text mono">${formatNumber(value, 2)}</span>
      {tradeCount != null && (
        <span className="text-xs text-rh-muted">{tradeCount} transfers</span>
      )}
    </div>
  )
}
