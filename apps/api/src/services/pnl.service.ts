import { ethers } from 'ethers'
import axios from 'axios'
import { cache } from '../lib/cache'
import { calculatePnLWithPrice, getTokenPriceGecko } from './price.service'

const V1 = 'https://robinhoodchain.blockscout.com/api'

export interface HolderPnL {
  address: string
  tradeCount: number
  totalReceived: number
  totalSent: number
  currentBalance: number
  // Price data
  currentPriceUsd: number | null
  entryPriceUsd: number | null
  currentValueUsd: number | null
  pnlUsd: number | null
  pnlPct: number | null
  priceSource: string
  // Activity
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  dataSource: string
}

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

export async function getCurrentTokenPrice(tokenAddress: string): Promise<number | null> {
  return getTokenPriceGecko(tokenAddress)
}

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

  // Get real PnL using GeckoTerminal OHLCV
  const pnlData = await calculatePnLWithPrice(firstBuyTimestamp, currentBalance, tokenAddress)

  const result: HolderPnL = {
    address: holderAddress,
    tradeCount: transfers.length,
    totalReceived,
    totalSent,
    currentBalance,
    currentPriceUsd: pnlData.currentPriceUsd,
    entryPriceUsd: pnlData.entryPriceUsd,
    currentValueUsd: pnlData.currentValueUsd,
    pnlUsd: pnlData.pnlUsd,
    pnlPct: pnlData.pnlPct,
    priceSource: pnlData.priceSource,
    firstBuyTimestamp,
    lastActivityTimestamp,
    dataSource: transfers.length > 0 ? 'blockscout_transfers' : 'no_data',
  }

  cache.set(cacheKey, result, 120)
  return result
}

export async function batchHolderPnL(
  holders: Array<{ address: string; balanceFormatted: number }>,
  tokenAddress: string,
  decimals: number,
  currentPriceUsd: number | null
): Promise<Record<string, HolderPnL>> {
  const results: Record<string, HolderPnL> = {}
  const capped = holders.slice(0, 50)
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
