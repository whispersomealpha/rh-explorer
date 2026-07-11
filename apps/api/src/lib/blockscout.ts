import axios from 'axios'

const BASE = 'https://robinhoodchain.blockscout.com/api/v2'
const V1   = 'https://robinhoodchain.blockscout.com/api'

const http = axios.create({ baseURL: BASE, timeout: 15000 })

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

// ── Token / Holders ───────────────────────────────────────────────────────────
export async function getToken(addr: string) {
  const { data } = await http.get(`/tokens/${addr}`)
  return data
}

// V2 single page (cursor-based)
export async function getTokenHolders(addr: string, nextPageParams?: any) {
  const params: any = { limit: 50 }
  if (nextPageParams) Object.assign(params, nextPageParams)
  const { data } = await http.get(`/tokens/${addr}/holders`, { params })
  return data
}

// V1 fallback — uses classic page/offset pagination, much more reliable
export async function getTokenHoldersV1(addr: string, page = 1): Promise<any[]> {
  const { data } = await axios.get(V1, {
    params: {
      module: 'token',
      action: 'getTokenHolders',
      contractaddress: addr,
      page,
      offset: 50,
    },
    timeout: 15000,
  })
  if (data.status === '1') return data.result ?? []
  return []
}

// Fetch ALL holders — tries v2 cursor pagination first, falls back to v1
export async function getAllTokenHolders(addr: string): Promise<any[]> {
  // Try V1 first — it's more reliable for pagination
  try {
    const holders: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const items = await getTokenHoldersV1(addr, page)
      if (items.length === 0) { hasMore = false; break }
      holders.push(...items)
      if (items.length < 50) { hasMore = false; break }
      page++
      if (page > 200) break // cap at 10k holders
      await new Promise(r => setTimeout(r, 100))
    }

    if (holders.length > 0) return normalizeV1Holders(holders)
  } catch (e) {
    console.log('V1 holders failed, trying V2:', e)
  }

  // V2 cursor-based fallback
  const holders: any[] = []
  let nextPageParams: any = undefined
  let iterations = 0

  while (true) {
    const data = await getTokenHolders(addr, nextPageParams)
    const items = data.items ?? []
    holders.push(...items)

    if (!data.next_page_params || items.length === 0) break
    nextPageParams = data.next_page_params
    iterations++
    if (iterations > 100) break
    await new Promise(r => setTimeout(r, 150))
  }

  return holders
}

// Normalize V1 response shape to match V2
function normalizeV1Holders(holders: any[]) {
  return holders.map((h: any) => ({
    address: { hash: h.address },
    value: h.value,
  }))
}

export async function getTokenTransfers(addr: string, page = 1) {
  const { data } = await http.get(`/tokens/${addr}/transfers`, {
    params: { page, limit: 50 }
  })
  return data
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function search(q: string) {
  const { data } = await http.get('/search', { params: { q } })
  return data.items ?? []
}

// ── Network stats (v1 endpoint) ───────────────────────────────────────────────
export async function getStats() {
  const { data } = await axios.get(V1, {
    params: { module: 'stats', action: 'ethsupply' },
    timeout: 10000
  })
  return data
}
