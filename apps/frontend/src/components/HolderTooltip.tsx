'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '../lib/api'
import { shortAddr, formatEth, formatNumber } from '../lib/utils'

interface Props {
  address: string
  children: React.ReactNode
}

// Client-side portfolio cache so repeated hovers are instant
const portfolioCache = new Map<string, any>()

export function HolderTooltip({ address, children }: Props) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const timerRef              = useRef<any>(null)
  const fetchedRef            = useRef(false)

  const fetchPortfolio = useCallback(async () => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    // Check client cache first
    if (portfolioCache.has(address)) {
      setData(portfolioCache.get(address))
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [wallet, tokens] = await Promise.allSettled([
        api.getWallet(address),
        api.getWalletTokens(address),
      ])

      const profile = wallet.status === 'fulfilled' ? wallet.value : null
      const tokenBals = tokens.status === 'fulfilled' ? tokens.value : []

      // Calculate rough net worth
      const ethBalance = profile?.rhChain?.ethBalance ?? '0'
      const ethUsd = (Number(BigInt(ethBalance)) / 1e18) * 1797 // rough ETH price

      const tokenValue = tokenBals.reduce((sum: number, t: any) => {
        const bal = parseFloat(t.value ?? '0') / Math.pow(10, parseInt(t.token?.decimals ?? '18'))
        // No price data available without oracle, show balance only
        return sum
      }, 0)

      const result = {
        ethBalance,
        ethUsd,
        txCount: profile?.rhChain?.txCount ?? 0,
        firstTx: profile?.rhChain?.firstTx,
        fundingType: profile?.rhChain?.fundingType,
        fundedBy: profile?.rhChain?.fundedBy,
        crossChainCount: (profile?.crossChain ?? []).filter((c: any) => c.hasActivity).length,
        tokens: tokenBals.slice(0, 6),
        labels: profile?.labels ?? [],
      }

      portfolioCache.set(address, result)
      setData(result)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [address])

  function handleMouseEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left, y: rect.bottom + window.scrollY + 8 })
    timerRef.current = setTimeout(() => {
      setVisible(true)
      fetchPortfolio()
    }, 400) // 400ms delay before showing
  }

  function handleMouseLeave() {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  const fundingColors: Record<string, string> = {
    bridge: '#6c63ff', cex: '#ffd60a', transfer: '#00d4aa', contract: '#ff9f1c'
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {visible && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(pos.x, window.innerWidth - 340),
            top: pos.y,
            zIndex: 9999,
            width: 320,
            background: '#1a1a26',
            border: '1px solid #2a2a3a',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${stringToColor(address)}, #6c63ff)`
            }} />
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e8e8f0' }}>
                {shortAddr(address, 8)}
              </div>
              {data?.labels?.length > 0 && (
                <div style={{ fontSize: 10, color: '#6c63ff' }}>{data.labels[0]}</div>
              )}
            </div>
          </div>

          {loading && !data && (
            <div style={{ color: '#8888aa', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
              Loading portfolio...
            </div>
          )}

          {data && (
            <>
              {/* Key stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'ETH Balance', value: formatEth(data.ethBalance, 4) },
                  { label: 'Transactions', value: data.txCount.toLocaleString() },
                  { label: 'Active Chains', value: data.crossChainCount + 1 },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#12121a', borderRadius: 8, padding: '6px 8px',
                    border: '1px solid #2a2a3a'
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', fontFamily: 'monospace' }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 10, color: '#8888aa', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Funding source */}
              {data.fundingType && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: 10, padding: '5px 8px',
                  background: '#12121a', borderRadius: 6,
                  border: '1px solid #2a2a3a'
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: fundingColors[data.fundingType] ?? '#8888aa',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: '#8888aa' }}>Funded via</span>
                  <span style={{ fontSize: 11, color: '#e8e8f0', fontWeight: 600, textTransform: 'capitalize' }}>
                    {data.fundingType}
                  </span>
                  {data.fundedBy && (
                    <span style={{ fontSize: 10, color: '#6c63ff', fontFamily: 'monospace', marginLeft: 'auto' }}>
                      {shortAddr(data.fundedBy, 6)}
                    </span>
                  )}
                </div>
              )}

              {/* Token balances */}
              {data.tokens.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Token Holdings
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {data.tokens.map((t: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '4px 8px', background: '#12121a', borderRadius: 6,
                        border: '1px solid #2a2a3a'
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#6c63ff' }}>
                          {t.token?.symbol ?? '???'}
                        </span>
                        <span style={{ fontSize: 11, color: '#e8e8f0', fontFamily: 'monospace' }}>
                          {formatNumber(
                            parseFloat(t.value ?? '0') / Math.pow(10, parseInt(t.token?.decimals ?? '18')),
                            4
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigate CTA */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2a3a' }}>
                <span style={{ fontSize: 11, color: '#6c63ff' }}>
                  Click address to investigate →
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`
}
