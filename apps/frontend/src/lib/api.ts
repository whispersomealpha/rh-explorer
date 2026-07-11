import axios from 'axios'

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api',
  timeout: 60000,
})

export const api = {
  getBlocks:   (limit = 20)        => API.get('/blocks',    { params: { limit } }).then(r => r.data),
  getBlock:    (id: string)         => API.get(`/blocks/${id}`).then(r => r.data),
  getTxs:      (limit = 20)        => API.get('/txs',       { params: { limit } }).then(r => r.data),
  getTx:       (hash: string)       => API.get(`/txs/${hash}`).then(r => r.data),
  getStats:    ()                   => API.get('/stats').then(r => r.data),
  getToken:          (addr: string)           => API.get(`/tokens/${addr}`).then(r => r.data),
  getTokenHolders:   (addr: string)           => API.get(`/tokens/${addr}/holders`, { timeout: 120000 }).then(r => r.data),
  getTokenTransfers: (addr: string, page = 1) => API.get(`/tokens/${addr}/transfers`, { params: { page } }).then(r => r.data),
  getTokenPrice:     (addr: string)           => API.get(`/tokens/${addr}/price`).then(r => r.data),
  getBatchPnL: (tokenAddr: string, holders: any[], decimals: number, currentPriceUsd: number | null) =>
    API.post(`/tokens/${tokenAddr}/pnl/batch`, { holders, decimals, currentPriceUsd }, { timeout: 60000 }).then(r => r.data),
  getWallet:         (addr: string)           => API.get(`/wallet/${addr}`).then(r => r.data),
  getWalletTxs:      (addr: string, page = 1) => API.get(`/wallet/${addr}/txs`, { params: { page } }).then(r => r.data),
  getWalletTokens:   (addr: string)           => API.get(`/wallet/${addr}/tokens`).then(r => r.data),
  getWalletTransfers:(addr: string, page = 1) => API.get(`/wallet/${addr}/transfers`, { params: { page } }).then(r => r.data),
  search: (q: string) => API.get('/search', { params: { q } }).then(r => r.data),
}
