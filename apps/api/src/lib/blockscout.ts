import axios from 'axios'

const BASE = 'https://robinhoodchain.blockscout.com/api/v2'
const V1   = 'https://robinhoodchain.blockscout.com/api'

const http = axios.create({ baseURL: BASE, timeout: 20000 })
const v1   = axios.create({ baseURL: V1,   timeout: 20000 })

// ── Blocks ────────────────────────────────────────────────────────────────────
export async function getLatestBlocks(limit = 10) {
  const { data } = await http.get('/blocks', { params: { type: 'block', limit } })
  return data.items ?? []
}

export async function getBlock(numberOrHash: string) {
  const { data } = await http.get(`/blocks/${numberOrHash}`)
  return data
}

// ── Transactions ──────────────────────────────────────────────────────────────
export async function getLatestTxs(limit = 20) {
  const { data } = await http.get('/transactions', { params: { limit } })
  return data.items ?? []
}

export async function getTx(hash: string) {
  const { data } = await http.get(`/transactions/${hash}`)
  return data
}

export async function getTxLogs(hash: string) {
  const { data } = await http.get(`/transactions/${hash}/logs`)
  return data.items ?? []
}

// ── Address ───────────────────────────────────────────────────────────────────
export async function getAddress(addr: string) {
  const { data } = await http.get(`/addresses/${addr}`)
  return data
}

export async function getAddressTxs(addr: string, page = 1, limit = 50) {
  const { data } = await http.get(`/addresses/${addr}/transactions`, {
    params: { page, limit }
  })
  return data
}

export async function getAddressTokenBalances(addr: string) {
  const { data } = await http.get(`/addresses/${addr}/token-balances`)
  return data ?? []
}

export async function getAddressTokenTransfers(addr: string, tokenAddr?: string, page = 1) {
  const params: Record<string, any> = { page, limit: 50 }
  if (tokenAddr) params.token = tokenAddr
  const { data } = await http.get(`/addresses/${addr}/token-transfers`, { params })
  return data
}

// ── Token ─────────────────────────────────────────────────────────────────────
export async function getToken(addr: string) {
  const { data } = await http.get(`/tokens/${addr}`)
  return data
}

export async function getTokenTransfers(addr: string, page = 1) {
  const { data } = await http.get(`/tokens/${addr}/transfers`, {
    params: { page, limit: 50 }
  })
  return data
}

// ── Holders — multi-strategy fetcher ─────────────────────────────────────────
// Strategy 1: Blockscout v2 cursor-based pagination
async function fetchHoldersV2(addr: string): Promise<any[]> {
  const holders: any[] = []
  let nextParams: any = null
  let loops = 0

  while (loops < 200) {
    const params: any = { limit: 50 }
    if (nextParams) Object.assign(params, nextParams)

    const { data } = await http.get(`/tokens/${addr}/holders`, { params })
    const items: any[] = data.items ?? []

    for (const h of items) {
      holders.push({
        address: h.address?.hash ?? h.address ?? '',
        value: h.value ?? '0',
      })
    }

    if (!data.next_page_params || items.length === 0) break
    nextParams = data.next_page_params
    loops++
    await sleep(120)
  }

  return holders
}

// Strategy 2: Blockscout v1 Etherscan-compatible API
async function fetchHoldersV1(addr: string): Promise<any[]> {
  const holders: any[] = []
  let page = 1

  while (page <= 200) {
    const { data } = await v1.get('', {
      params: {
        module: 'token',
        action: 'getTokenHolders',
        contractaddress: addr,
        page,
        offset: 50,
      },
    })

    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) break

    for (const h of data.result) {
      holders.push({
        address: h.address ?? '',
        value: h.value ?? '0',
      })
    }

    if (data.result.length < 50) break
    page++
    await sleep(100)
  }

  return holders
}

// Strategy 3: Scrape via v2 token transfers — derive unique holders
async function fetchHoldersFromTransfers(addr: string): Promise<any[]> {
  const balances: Record<string, bigint> = {}
  let nextParams: any = null
  let loops = 0

  while (loops < 50) {
    const params: any = { limit: 50 }
    if (nextParams) Object.assign(params, nextParams)

    const { data } = await http.get(`/tokens/${addr}/transfers`, { params })
    const items: any[] = data.items ?? []

    for (const tx of items) {
      const from = tx.from?.hash?.toLowerCase()
      const to   = tx.to?.hash?.toLowerCase()
      const val  = BigInt(tx.total?.value ?? '0')
      if (from) balances[from] = (balances[from] ?? BigInt(0)) - val
      if (to)   balances[to]   = (balances[to]   ?? BigInt(0)) + val
    }

    if (!data.next_page_params || items.length === 0) break
    nextParams = data.next_page_params
    loops++
    await sleep(100)
  }

  return Object.entries(balances)
    .filter(([, v]) => v > BigInt(0))
    .sort(([, a], [, b]) => (a > b ? -1 : 1))
    .map(([address, value]) => ({ address, value: value.toString() }))
}

export async function getAllTokenHolders(addr: string): Promise<any[]> {
  // Try v1 first — most reliable pagination
  try {
    console.log(`[holders] trying v1 for ${addr}`)
    const v1holders = await fetchHoldersV1(addr)
    if (v1holders.length > 0) {
      console.log(`[holders] v1 returned ${v1holders.length} holders`)
      return v1holders
    }
  } catch (e) {
    console.error('[holders] v1 failed:', e)
  }

  // Try v2 cursor pagination
  try {
    console.log(`[holders] trying v2 for ${addr}`)
    const v2holders = await fetchHoldersV2(addr)
    if (v2holders.length > 0) {
      console.log(`[holders] v2 returned ${v2holders.length} holders`)
      return v2holders
    }
  } catch (e) {
    console.error('[holders] v2 failed:', e)
  }

  // Last resort: derive from transfers
  try {
    console.log(`[holders] deriving from transfers for ${addr}`)
    const derived = await fetchHoldersFromTransfers(addr)
    console.log(`[holders] derived ${derived.length} holders from transfers`)
    return derived
  } catch (e) {
    console.error('[holders] transfer derivation failed:', e)
  }

  return []
}

// Single page for route handler
export async function getTokenHolders(addr: string, page = 1) {
  const { data } = await http.get(`/tokens/${addr}/holders`, {
    params: { limit: 50 }
  })
  return data
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function search(q: string) {
  const { data } = await http.get('/search', { params: { q } })
  return data.items ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
