import { formatDistanceToNow, format } from 'date-fns'

export function shortAddr(addr: string, chars = 6): string {
  if (!addr) return ''
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`
}

export function formatEth(wei: string, decimals = 4): string {
  try {
    const val = Number(BigInt(wei)) / 1e18
    if (val === 0) return '0 ETH'
    if (val < 0.0001) return '< 0.0001 ETH'
    return `${val.toFixed(decimals)} ETH`
  } catch {
    return '0 ETH'
  }
}

export function formatNumber(n: number | string, decimals = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '0'
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000)         return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(decimals)
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function timeAgo(ts: number | string): string {
  try {
    const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export function formatTs(ts: number | string): string {
  try {
    const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000)
    return format(date, 'MMM d, yyyy HH:mm:ss')
  } catch {
    return 'Unknown'
  }
}

export function formatGwei(wei: string): string {
  try {
    const gwei = Number(BigInt(wei)) / 1e9
    return `${gwei.toFixed(2)} Gwei`
  } catch {
    return '0 Gwei'
  }
}

export function chainColor(chainId: number): string {
  const map: Record<number, string> = {
    1:     '#627EEA', // Ethereum
    8453:  '#0052FF', // Base
    42161: '#28A0F0', // Arbitrum
    10:    '#FF0420', // Optimism
    137:   '#8247E5', // Polygon
    56:    '#F3BA2F', // BNB
    4663:  '#6c63ff', // Robinhood Chain
  }
  return map[chainId] ?? '#8888aa'
}

export function chainName(chainId: number): string {
  const map: Record<number, string> = {
    1:     'Ethereum',
    8453:  'Base',
    42161: 'Arbitrum',
    10:    'Optimism',
    137:   'Polygon',
    56:    'BNB Chain',
    4663:  'Robinhood Chain',
  }
  return map[chainId] ?? `Chain ${chainId}`
}

export function explorerUrl(chainId: number, type: 'tx' | 'address', value: string): string {
  const bases: Record<number, string> = {
    1:     'https://etherscan.io',
    8453:  'https://basescan.org',
    42161: 'https://arbiscan.io',
    10:    'https://optimistic.etherscan.io',
    137:   'https://polygonscan.com',
    56:    'https://bscscan.com',
    4663:  'https://robinhoodchain.blockscout.com',
  }
  const base = bases[chainId] ?? '#'
  return type === 'tx' ? `${base}/tx/${value}` : `${base}/address/${value}`
}

export function fundingTypeLabel(type: string | null): { label: string; cls: string } {
  switch (type) {
    case 'bridge':   return { label: 'Bridge',    cls: 'badge-purple' }
    case 'cex':      return { label: 'CEX',        cls: 'badge-yellow' }
    case 'transfer': return { label: 'Transfer',   cls: 'badge-green'  }
    case 'contract': return { label: 'Contract',   cls: 'badge-orange' }
    default:         return { label: 'Unknown',    cls: 'badge-gray'   }
  }
}

export function isAddress(val: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(val)
}

export function isTxHash(val: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(val)
}
