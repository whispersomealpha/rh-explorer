import { ethers } from 'ethers'
import axios from 'axios'
import { cache } from '../lib/cache'

const V1 = 'https://robinhoodchain.blockscout.com/api'
const V2 = 'https://robinhoodchain.blockscout.com/api/v2'

export interface HolderPnL {
  address: string
  tradeCount: number          // total transfer events
  totalReceived: number       // tokens ever received
  totalSent: number           // tokens ever sent
  currentBalance: number
  currentValueUsd: number | null
  currentPriceUsd: number | null
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  dataSource: string
}

// Get all token transfers for a holder (up to 200)
async function getHolderTransfers(holderAddress: string, tokenAddress: string): Promise<any[]> {
  const cacheKey = `htx:${holderAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  try {
    const { data } = await axios.get(V1, {
      params: {
        module: 'account',
        action: 'tokentx',
        address: holderAddress,
        contractaddress: tokenAddress,
        sort: 'asc',
        page: 1,
        offset: 200,
      },
      timeout: 10000,
    })
    const result = data.status === '1' ? (data.result ?? []) : []
    cache.set(cacheKey, result, 300)
    return result
  } catch {
    return []
  }
}

// Get current price from Blockscout exchange_rate field
export async function getCurrentTokenPrice(tokenAddress: string): Promise<number | null> {
  const cacheKey = `price:${tokenAddress.toLowerCase()}`
  const cached = cache.get<number | null>(cacheKey)
  if (cached !== null && cached !== undefined) return cached

  try {
    const { data } = await axios.get(`${V2}/tokens/${tokenAddress}`, { timeout: 8000 })
    const price = data.exchange_rate ? parseFloat(data.exchange_rate) : null
    cache.set(cacheKey, price, 60)
    return price
  } catch {
    cache.set(cacheKey, null, 30)
    return null
  }
}

// Calculate PnL for a single holder
export async function calculateHolderPnL(
  holderAddress: string,
  tokenAddress: string,
  currentBalance: number,
  decimals: number,
  currentPriceUsd: number | null
): Promise<HolderPnL> {
  const cacheKey = `pnl:${holderAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`
  const cached = cache.get<HolderPnL>(cacheKey)
  if (cached) return cached

  const transfers = await getHolderTransfers(holderAddress, tokenAddress)

  let totalReceived = 0
  let totalSent = 0
  let firstBuyTimestamp: number | null = null
  let lastActivityTimestamp: number | null = null

  for (const tx of transfers) {
    const isReceive = tx.to?.toLowerCase() === holderAddress.toLowerCase()
    const amount = parseFloat(ethers.formatUnits(tx.value ?? '0', decimals))
    const ts = parseInt(tx.timeStamp ?? '0')

    if (ts > 0) {
      if (!firstBuyTimestamp && isReceive) firstBuyTimestamp = ts
      if (!lastActivityTimestamp || ts > lastActivityTimestamp) lastActivityTimestamp = ts
    }

    if (isReceive) totalReceived += amount
    else totalSent += amount
  }

  const currentValueUsd = currentPriceUsd != null ? currentBalance * currentPriceUsd : null

  const result: HolderPnL = {
    address: holderAddress,
    tradeCount: transfers.length,
    totalReceived,
    totalSent,
    currentBalance,
    currentValueUsd,
    currentPriceUsd,
    firstBuyTimestamp,
    lastActivityTimestamp,
    dataSource: transfers.length > 0 ? 'blockscout_transfers' : 'no_data',
  }

  cache.set(cacheKey, result, 120)
  return result
}

// Batch PnL for up to 50 holders — processes 5 at a time
export async function batchHolderPnL(
  holders: Array<{ address: string; balanceFormatted: number }>,
  tokenAddress: string,
  decimals: number,
  currentPriceUsd: number | null
): Promise<Record<string, HolderPnL>> {
  const results: Record<string, HolderPnL> = {}
  const capped = holders.slice(0, 50) // hard cap at 50

  const BATCH = 5
  for (let i = 0; i < capped.length; i += BATCH) {
    const batch = capped.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(h => calculateHolderPnL(h.address, tokenAddress, h.balanceFormatted, decimals, currentPriceUsd))
    )
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j]
      if (r.status === 'fulfilled') {
        results[batch[j].address.toLowerCase()] = r.value
      }
    }
    if (i + BATCH < capped.length) await new Promise(r => setTimeout(r, 150))
  }

  return results
}
