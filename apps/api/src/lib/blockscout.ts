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

export async function getTokenHolders(addr: string, page = 1) {
  const { data } = await http.get(`/tokens/${addr}/holders`, {
    params: { page, limit: 50 }
  })
  return data
}

export async function getAllTokenHolders(addr: string) {
  const holders: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const data = await getTokenHolders(addr, page)
    const items = data.items ?? []
    holders.push(...items)

    // Blockscout paginates with next_page_params
    hasMore = !!data.next_page_params && items.length > 0
    page++

    // Safety cap — don't infinite loop on massive tokens
    if (page > 100) break
    // Small delay to be polite to the API
    await new Promise(r => setTimeout(r, 150))
  }

  return holders
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
