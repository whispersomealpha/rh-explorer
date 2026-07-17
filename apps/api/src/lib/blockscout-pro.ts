import axios from 'axios'
import { cache } from './cache'

const PRO_BASE = 'https://api.blockscout.com/4663/api/v2'
const API_KEY = process.env.BLOCKSCOUT_API_KEY ?? ''

const pro = axios.create({
  baseURL: PRO_BASE,
  timeout: 60000,
  headers: API_KEY ? { 'authorization': `Bearer ${API_KEY}` } : {},
})

// Exhaust all pages for token transfers — no artificial cap
export async function getAllAddressTokenTransfers(address: string, maxPages = 100): Promise<any[]> {
  const cacheKey = `pro_tokentx:${address.toLowerCase()}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  const transfers: any[] = []
  let nextPageParams: any = null
  let page = 0

  while (page < maxPages) {
    try {
      const params: any = {}
      if (nextPageParams) Object.assign(params, nextPageParams)
      const { data } = await pro.get(`/addresses/${address}/token-transfers`, { params })
      const items = data.items ?? []
      transfers.push(...items)
      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 150))
    } catch (e) {
      console.error('[blockscout-pro] token transfers failed:', e)
      break
    }
  }

  if (transfers.length > 0) cache.set(cacheKey, transfers, 300)
  return transfers
}

// Exhaust all tx pages
export async function getAllAddressTxs(address: string, maxPages = 50): Promise<any[]> {
  const cacheKey = `pro_txlist:${address.toLowerCase()}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  const txs: any[] = []
  let nextPageParams: any = null
  let page = 0

  while (page < maxPages) {
    try {
      const params: any = {}
      if (nextPageParams) Object.assign(params, nextPageParams)
      const { data } = await pro.get(`/addresses/${address}/transactions`, { params })
      const items = data.items ?? []
      txs.push(...items)
      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 150))
    } catch (e) {
      console.error('[blockscout-pro] txs failed:', e)
      break
    }
  }

  if (txs.length > 0) cache.set(cacheKey, txs, 300)
  return txs
}

export async function getInternalTxs(address: string): Promise<any[]> {
  const cacheKey = `pro_internal:${address.toLowerCase()}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  try {
    const { data } = await pro.get(`/addresses/${address}/internal-transactions`)
    const result = data.items ?? []
    if (result.length > 0) cache.set(cacheKey, result, 300)
    return result
  } catch (e) {
    console.error('[blockscout-pro] internal txs failed:', e)
    return []
  }
}

// Get address info
export async function getAddressInfo(address: string): Promise<any> {
  try {
    const { data } = await pro.get(`/addresses/${address}`)
    return data
  } catch (e) {
    return null
  }
}

function toDecimal(raw: string | undefined, decimals: string | undefined): number {
  if (!raw || raw === '0') return 0
  const dec = parseInt(decimals ?? '18')
  return parseFloat(raw) / Math.pow(10, dec)
}

export async function getFullWalletActivity(address: string) {
  const addr = address.toLowerCase()

  const [tokenTransfers, transactions, internalTxs, addressInfo] = await Promise.all([
    getAllAddressTokenTransfers(address),
    getAllAddressTxs(address),
    getInternalTxs(address),
    getAddressInfo(address),
  ])

  // Build per-token activity map
  const tokenMap: Record<string, {
    symbol: string
    name: string
    address: string
    decimals: string
    received: number
    sent: number
    receivedTxs: any[]
    sentTxs: any[]
    netPosition: number
  }> = {}

  const wethReceived: { amount: number; tx: string; timestamp: string; from: string; method: string }[] = []
  const wethSent: { amount: number; tx: string; timestamp: string; to: string }[] = []

  for (const tx of tokenTransfers) {
    const from = tx.from?.hash?.toLowerCase() ?? ''
    const to = tx.to?.hash?.toLowerCase() ?? ''
    const tokenAddr = tx.token?.address_hash ?? tx.token?.address ?? ''
    const symbol = tx.token?.symbol ?? 'UNKNOWN'
    const name = tx.token?.name ?? 'Unknown'
    const decimals = tx.token?.decimals ?? '18'
    const amount = toDecimal(tx.total?.value, decimals)

    if (!tokenMap[tokenAddr]) {
      tokenMap[tokenAddr] = { symbol, name, address: tokenAddr, decimals, received: 0, sent: 0, receivedTxs: [], sentTxs: [], netPosition: 0 }
    }

    const entry = tokenMap[tokenAddr]

    if (to === addr) {
      entry.received += amount
      entry.receivedTxs.push({
        txHash: tx.transaction_hash ?? tx.tx_hash,
        amount,
        from: tx.from?.hash,
        fromIsContract: tx.from?.is_contract,
        method: tx.method,
        type: tx.type,
        timestamp: tx.timestamp,
      })
      // Track WETH LP collections separately
      if (symbol === 'WETH' && amount > 0) {
        wethReceived.push({ amount, tx: tx.transaction_hash ?? tx.tx_hash, timestamp: tx.timestamp, from: tx.from?.hash, method: tx.method ?? '' })
      }
    }

    if (from === addr) {
      entry.sent += amount
      entry.sentTxs.push({
        txHash: tx.transaction_hash ?? tx.tx_hash,
        amount,
        to: tx.to?.hash,
        toIsContract: tx.to?.is_contract,
        method: tx.method,
        type: tx.type,
        timestamp: tx.timestamp,
      })
      if (symbol === 'WETH' && amount > 0) {
        wethSent.push({ amount, tx: tx.transaction_hash ?? tx.tx_hash, timestamp: tx.timestamp, to: tx.to?.hash })
      }
    }

    entry.netPosition = entry.received - entry.sent
  }

  // Classify each token's activity
  const tokenActivity = Object.values(tokenMap).map(t => {
    let classification = 'unknown'
    if (t.received > 0 && t.sent === 0) classification = 'held_or_airdrop'
    if (t.sent > 0 && t.received === 0) classification = 'sent_only'
    if (t.received > 0 && t.sent > 0) classification = 'traded'
    // Check if received from contract (likely swap buy)
    const boughtViaSwap = t.receivedTxs.some(r => r.fromIsContract && r.method !== 'transfer')
    if (boughtViaSwap && t.sent > 0) classification = 'swapped_in_and_out'
    if (boughtViaSwap && t.sent === 0) classification = 'swapped_in_held'
    return { ...t, classification, boughtViaSwap }
  }).sort((a, b) => (b.received + b.sent) - (a.received + a.sent))

  // LP fee analysis (the repeated WETH collect pattern)
  const totalWethCollected = wethReceived.reduce((s, r) => s + r.amount, 0)
  const totalWethSent = wethSent.reduce((s, r) => s + r.amount, 0)
  const lpCollections = wethReceived.filter(r => r.method === 'collect')

  // Transaction method breakdown
  const methodCounts: Record<string, number> = {}
  for (const tx of transactions) {
    const m = tx.method ?? tx.tx_types?.[0] ?? 'unknown'
    methodCounts[m] = (methodCounts[m] ?? 0) + 1
  }

  // Unique counterparties
  const counterparties = new Set<string>()
  for (const tx of tokenTransfers) {
    const from = tx.from?.hash?.toLowerCase() ?? ''
    const to = tx.to?.hash?.toLowerCase() ?? ''
    if (from !== addr) counterparties.add(tx.from?.hash)
    if (to !== addr) counterparties.add(tx.to?.hash)
  }

  return {
    address,
    addressInfo,
    tokenTransfers,
    transactions,
    internalTxs,
    analysis: {
      totalTokenTransfers: tokenTransfers.length,
      totalTxs: transactions.length,
      uniqueTokensInteracted: Object.keys(tokenMap).length,
      uniqueCounterparties: counterparties.size,
      methodBreakdown: methodCounts,
      lpActivity: {
        totalWethCollected,
        totalWethSent,
        netWeth: totalWethCollected - totalWethSent,
        lpCollectionCount: lpCollections.length,
        lpCollections,
      },
      tokenActivity,
      // Quick summary for each token
      tokenSummary: tokenActivity.map(t => ({
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        received: t.received,
        sent: t.sent,
        netPosition: t.netPosition,
        classification: t.classification,
        receivedTxCount: t.receivedTxs.length,
        sentTxCount: t.sentTxs.length,
      })),
    },
  }
}
