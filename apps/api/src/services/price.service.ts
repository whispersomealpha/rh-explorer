import axios from 'axios'
import { cache } from '../lib/cache'

const GECKO = 'https://api.geckoterminal.com/api/v2'

interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Get the top pool address for a token on Robinhood Chain
export async function getTokenPool(tokenAddress: string): Promise<string | null> {
  const cacheKey = `pool:${tokenAddress.toLowerCase()}`
  const cached = cache.get<string>(cacheKey)
  if (cached) return cached

  try {
    const { data } = await axios.get(
      `${GECKO}/networks/robinhood/tokens/${tokenAddress}/pools`,
      { params: { page: 1 }, timeout: 10000 }
    )
    const pools = data?.data ?? []
    if (pools.length === 0) return null
    // Pick highest liquidity pool
    const topPool = pools[0]?.attributes?.address ?? null
    if (topPool) cache.set(cacheKey, topPool, 3600) // 1 hour
    return topPool
  } catch (e) {
    console.error('[price] getTokenPool failed:', e)
    return null
  }
}

// Get current price from GeckoTerminal
export async function getTokenPriceGecko(tokenAddress: string): Promise<number | null> {
  const cacheKey = `gecko_price:${tokenAddress.toLowerCase()}`
  const cached = cache.get<number>(cacheKey)
  if (cached !== null && cached !== undefined) return cached

  try {
    const { data } = await axios.get(
      `${GECKO}/networks/robinhood/tokens/${tokenAddress}`,
      { timeout: 10000 }
    )
    const price = parseFloat(data?.data?.attributes?.price_usd ?? '0')
    if (price > 0) cache.set(cacheKey, price, 60)
    return price > 0 ? price : null
  } catch {
    return null
  }
}

// Fetch hourly OHLCV candles for a pool (up to 1000 candles = ~41 days)
export async function getPoolCandles(poolAddress: string): Promise<OHLCVCandle[]> {
  const cacheKey = `candles:${poolAddress.toLowerCase()}`
  const cached = cache.get<OHLCVCandle[]>(cacheKey)
  if (cached) return cached

  try {
    const { data } = await axios.get(
      `${GECKO}/networks/robinhood/pools/${poolAddress}/ohlcv/hour`,
      {
        params: { aggregate: 1, limit: 1000, currency: 'usd', token: 'base' },
        timeout: 15000,
      }
    )

    const raw: number[][] = data?.data?.attributes?.ohlcv_list ?? []
    // GeckoTerminal format: [timestamp, open, high, low, close, volume]
    const candles: OHLCVCandle[] = raw.map(c => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    })).sort((a, b) => a.timestamp - b.timestamp)

    if (candles.length > 0) cache.set(cacheKey, candles, 300) // 5 min cache
    return candles
  } catch (e) {
    console.error('[price] getPoolCandles failed:', e)
    return []
  }
}

// Get the price at a specific timestamp (finds nearest candle)
export function getPriceAtTimestamp(candles: OHLCVCandle[], timestamp: number): number | null {
  if (candles.length === 0) return null

  // Find nearest candle
  let nearest = candles[0]
  let minDiff = Math.abs(candles[0].timestamp - timestamp)

  for (const candle of candles) {
    const diff = Math.abs(candle.timestamp - timestamp)
    if (diff < minDiff) {
      minDiff = diff
      nearest = candle
    }
  }

  // Use the close price of the nearest candle
  return nearest.close
}

// Full PnL calculation for a holder
export async function calculatePnLWithPrice(
  firstBuyTimestamp: number | null,
  currentBalance: number,
  tokenAddress: string
): Promise<{
  entryPriceUsd: number | null
  currentPriceUsd: number | null
  currentValueUsd: number | null
  pnlUsd: number | null
  pnlPct: number | null
  priceSource: string
}> {
  const [poolAddress, currentPrice] = await Promise.all([
    getTokenPool(tokenAddress),
    getTokenPriceGecko(tokenAddress),
  ])

  if (!currentPrice) {
    return { entryPriceUsd: null, currentPriceUsd: null, currentValueUsd: null, pnlUsd: null, pnlPct: null, priceSource: 'none' }
  }

  const currentValueUsd = currentBalance * currentPrice

  if (!firstBuyTimestamp || !poolAddress) {
    return { entryPriceUsd: null, currentPriceUsd: currentPrice, currentValueUsd, pnlUsd: null, pnlPct: null, priceSource: 'gecko_current' }
  }

  // Get historical candles
  const candles = await getPoolCandles(poolAddress)
  const entryPrice = getPriceAtTimestamp(candles, firstBuyTimestamp)

  if (!entryPrice) {
    return { entryPriceUsd: null, currentPriceUsd: currentPrice, currentValueUsd, pnlUsd: null, pnlPct: null, priceSource: 'gecko_current' }
  }

  const costBasis = currentBalance * entryPrice
  const pnlUsd = currentValueUsd - costBasis
  const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100

  return {
    entryPriceUsd: entryPrice,
    currentPriceUsd: currentPrice,
    currentValueUsd,
    pnlUsd,
    pnlPct,
    priceSource: 'gecko_ohlcv',
  }
}
