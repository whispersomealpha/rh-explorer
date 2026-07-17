import axios from 'axios'
import { cache } from './cache'

const PRO_BASE = 'https://api.blockscout.com/4663/api/v2'
const API_KEY = process.env.BLOCKSCOUT_API_KEY ?? ''

const pro = axios.create({
  baseURL: PRO_BASE,
  timeout: 30000,
  headers: API_KEY ? { 'authorization': `Bearer ${API_KEY}` } : {},
})

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
      const { data } = await pro.get(`/addresses/${address}/token-transfers`, { params })
      const items = data.items ?? []
      transfers.push(...items)
      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error('[blockscout-pro] token transfers failed:', e)
      break
    }
  }

  if (transfers.length > 0) cache.set(cacheKey, transfers, 300)
  return transfers
}

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
      const { data } = await pro.get(`/addresses/${address}/transactions`, { params })
      const items = data.items ?? []
      txs.push(...items)
      if (!data.next_page_params || items.length === 0) break
      nextPageParams = data.next_page_params
      page++
      await new Promise(r => setTimeout(r, 200))
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

export async function getFullWalletActivity(address: string) {
  const [tokenTransfers, transactions, internalTxs] = await Promise.all([
    getAllAddressTokenTransfers(address),
    getAllAddressTxs(address),
    getInternalTxs(address),
  ])

  const addr = address.toLowerCase()
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

    if (to === addr) {
      const fromIsContract = tx.from?.is_contract ?? false
      const isZeroValue = !tx.total?.value || tx.total?.value === '0'
      if (fromIsContract && !isZeroValue) {
        organicBuys.push({ txHash: tx.tx_hash, token: tokenSymbol, tokenName, amount: tx.total?.value, decimals: tx.token?.decimals, from: tx.from?.hash, timestamp: tx.timestamp, type: 'buy' })
      } else {
        airdropsReceived.push({ txHash: tx.tx_hash, token: tokenSymbol, tokenName, amount: tx.total?.value, decimals: tx.token?.decimals, from: tx.from?.hash, timestamp: tx.timestamp, type: 'airdrop_or_transfer' })
      }
    }

    if (from === addr) {
      organicSells.push({ txHash: tx.tx_hash, token: tokenSymbol, tokenName, amount: tx.total?.value, decimals: tx.token?.decimals, to: tx.to?.hash, timestamp: tx.timestamp, type: 'sell_or_send' })
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
