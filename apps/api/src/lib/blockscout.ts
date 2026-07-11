import axios from 'axios'

const BASE = 'https://robinhoodchain.blockscout.com/api/v2'
const V1   = 'https://robinhoodchain.blockscout.com/api'

const http = axios.create({ baseURL: BASE, timeout: 20000 })
const v1   = axios.create({ baseURL: V1,   timeout: 20000 })

export async function getLatestBlocks(limit = 10) {
  const { data } = await http.get('/blocks', { params: { type: 'block', limit } })
  return data.items ?? []
}

export async function getBlock(numberOrHash: string) {
  const { data } = await http.get(`/blocks/${numberOrHash}`)
  return data
}

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

export async function getAddress(addr: string) {
  const { data } = await http.get(`/addresses/${addr}`)
  return data
}

export async function getAddressTxs(addr: string, page = 1, limit = 50) {
  const { data } = await http.get(`/addresses/${addr}/transactions`, { params: { page, limit } })
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

export async function getToken(addr: string) {
  const { data } = await http.get(`/tokens/${addr}`)
  return data
}

export async function getTokenTransfers(addr: string, page = 1) {
  const { data } = await http.get(`/tokens/${addr}/transfers`, { params: { page, limit: 50 } })
  return data
}

// Fetch max 500 holders using V1 API (10 pages × 50)
export async function getAllTokenHolders(addr: string, maxHolders = 500): Promise<any[]> {
  const holders: any[] = []
  const maxPages = Math.ceil(maxHolders / 50)

  for (let page = 1; page <= maxPages; page++) {
    try {
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
        holders.push({ address: h.address ?? '', value: h.value ?? '0' })
      }

      if (data.result.length < 50) break
      if (holders.length >= maxHolders) break

      await new Promise(r => setTimeout(r, 80))
    } catch (e) {
      console.error(`[holders] page ${page} failed:`, e)
      break
    }
  }

  return holders.slice(0, maxHolders)
}

export async function search(q: string) {
  const { data } = await http.get('/search', { params: { q } })
  return data.items ?? []
}
