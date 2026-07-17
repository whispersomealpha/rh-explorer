import axios from 'axios'
import { cache } from './cache'

// Blockscout Pro API - covers 120+ chains with single key
const PRO_BASE = 'https://api.blockscout.com/4663' // Chain ID 4663 = Robinhood Chain
const API_KEY = process.env.BLOCKSCOUT_API_KEY ?? ''

const pro = axios.create({
  baseURL: PRO_BASE,
  timeout: 30000,
  headers: API_KEY ? { 'apikey': API_KEY } : {},
})

// Get ALL token transfers for an address (paginated)
export async function getAllAddressTokenTransfers(address: string, maxPages = 20): Promise<any[]> {
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
      if (API_KEY) params.apikey = API_KEY

      const { data } = await pro.get('/api/v2/addresses/' + address + '/token-transfers', { params })
      const items = data.items ?? []
      transfers.push(...items)

      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.error('[blockscout-pro] token transfers page failed:', e)
      break
    }
  }

  if (transfers.length > 0) cache.set(cacheKey, transfers, 300)
  return transfers
}

// Get all transactions for an address
export async function getAllAddressTxs(address: string, maxPages = 10): Promise<any[]> {
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
      if (API_KEY) params.apikey = API_KEY

      const { data } = await pro.get('/api/v2/addresses/' + address + '/transactions', { params })
      const items = data.items ?? []
      txs.push(...items)

      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.error('[blockscout-pro] txs page failed:', e)
      break
    }
  }

  if (txs.length > 0) cache.set(cacheKey, txs, 300)
  return txs
}

// Get internal transactions (catches ArbOS-level transfers)
export async function getInternalTxs(address: string): Promise<any[]> {
  const cacheKey = `pro_internal:${address.toLowerCase()}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  try {
    const params: any = {}
    if (API_KEY) params.apikey = API_KEY
    const { data } = await pro.get('/api/v2/addresses/' + address + '/internal-transactions', { params })
    const result = data.items ?? []
    if (result.length > 0) cache.set(cacheKey, result, 300)
    return result
  } catch (e) {
    console.error('[blockscout-pro] internal txs failed:', e)
    return []
  }
}

// Get full wallet analysis - everything in one call
export async function getFullWalletActivity(address: string): Promise<{
  tokenTransfers: any[]
  transactions: any[]
  internalTxs: any[]
  summary: {
    totalTokenTransfers: number
    totalTxs: number
    uniqueTokens: string[]
    organicBuys: any[]
    organicSells: any[]
    airdropsReceived: any[]
  }
}> {
  const [tokenTransfers, transactions, internalTxs] = await Promise.all([
    getAllAddressTokenTransfers(address),
    getAllAddressTxs(address),
    getInternalTxs(address),
  ])

  const addr = address.toLowerCase()

  // Classify token transfers
  const organicBuys: any[] = []
  const organicSells: any[] = []
  const airdropsReceived: any[] = []
  const uniqueTokens = new Set<string>()

  for (const tx of tokenTransfers) {
    const from = tx.from?.hash?.toLowerCase() ?? ''
    const to = tx.to?.hash?.toLowerCase() ?? ''
    const tokenSymbol = tx.token?.symbol ?? 'UNKNOWN'
    const tokenName = tx.token?.name ?? 'Unknown'
    uniqueTokens.add(tokenSymbol)

    // Is this wallet the receiver?
    if (to === addr) {
      // Check if it came from a DEX/contract (organic buy) or EOA (airdrop/transfer)
      const fromIsContract = tx.from?.is_contract ?? false
      const isZeroValue = tx.total?.value === '0' || tx.total?.value === null

      if (fromIsContract && !isZeroValue) {
        organicBuys.push({
          txHash: tx.tx_hash,
          token: tokenSymbol,
          tokenName,
          amount: tx.total?.value,
          decimals: tx.token?.decimals,
          from: tx.from?.hash,
          timestamp: tx.timestamp,
          type: 'buy',
        })
      } else {
        airdropsReceived.push({
          txHash: tx.tx_hash,
          token: tokenSymbol,
          tokenName,
          amount: tx.total?.value,
          decimals: tx.token?.decimals,
          from: tx.from?.hash,
          timestamp: tx.timestamp,
          type: 'airdrop_or_transfer',
        })
      }
    }

    // Is this wallet the sender?
    if (from === addr) {
      organicSells.push({
        txHash: tx.tx_hash,
        token: tokenSymbol,
        tokenName,
        amount: tx.total?.value,
        decimals: tx.token?.decimals,
        to: tx.to?.hash,
        timestamp: tx.timestamp,
        type: 'sell_or_send',
      })
    }
  }

  return {
    tokenTransfers,
    transactions,
    internalTxs,
    summary: {
      totalTokenTransfers: tokenTransfers.length,
      totalTxs: transactions.length,
      uniqueTokens: Array.from(uniqueTokens),
      organicBuys,
      organicSells,
      airdropsReceived,
    }
  }
}
