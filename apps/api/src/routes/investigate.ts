import { FastifyInstance } from 'fastify'
import { getFullWalletActivity, getAllAddressTokenTransfers, getAllAddressTxs, getInternalTxs } from '../lib/blockscout-pro'
import { cache } from '../lib/cache'

export async function investigateRoutes(app: FastifyInstance) {

  // GET /investigate/:address — full wallet activity analysis
  app.get('/investigate/:address', async (req, reply) => {
    const { address } = req.params as any
    const cacheKey = `investigate:${address.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached) return reply.send(cached)

    try {
      const result = await getFullWalletActivity(address)
      cache.set(cacheKey, result, 300)
      return reply.send(result)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /investigate/:address/summary — just the analysis, no raw data (fast)
  app.get('/investigate/:address/summary', async (req, reply) => {
    const { address } = req.params as any
    const cacheKey = `investigate:${address.toLowerCase()}`
    const cached = cache.get<any>(cacheKey)
    if (cached) return reply.send({ address, analysis: cached.analysis, addressInfo: cached.addressInfo })

    try {
      const result = await getFullWalletActivity(address)
      cache.set(cacheKey, result, 300)
      return reply.send({ address, analysis: result.analysis, addressInfo: result.addressInfo })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /investigate/:address/token-transfers — all raw token transfers
  app.get('/investigate/:address/token-transfers', async (req, reply) => {
    const { address } = req.params as any
    const { token } = req.query as any
    try {
      let transfers = await getAllAddressTokenTransfers(address)
      // filter by token contract if provided
      if (token) {
        const t = token.toLowerCase()
        transfers = transfers.filter(tx =>
          (tx.token?.address_hash ?? tx.token?.address ?? '').toLowerCase() === t
        )
      }
      return reply.send({ items: transfers, count: transfers.length })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /investigate/:address/txs — all transactions
  app.get('/investigate/:address/txs', async (req, reply) => {
    const { address } = req.params as any
    try {
      const txs = await getAllAddressTxs(address)
      return reply.send({ items: txs, count: txs.length })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /investigate/:address/internal — internal transactions
  app.get('/investigate/:address/internal', async (req, reply) => {
    const { address } = req.params as any
    try {
      const txs = await getInternalTxs(address)
      return reply.send({ items: txs, count: txs.length })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /investigate/:address/token/:tokenAddress — all transfers for one specific token
  app.get('/investigate/:address/token/:tokenAddress', async (req, reply) => {
    const { address, tokenAddress } = req.params as any
    try {
      const allTransfers = await getAllAddressTokenTransfers(address)
      const filtered = allTransfers.filter(tx =>
        (tx.token?.address_hash ?? tx.token?.address ?? '').toLowerCase() === tokenAddress.toLowerCase()
      )
      const addr = address.toLowerCase()
      const received = filtered.filter(tx => (tx.to?.hash ?? '').toLowerCase() === addr)
      const sent = filtered.filter(tx => (tx.from?.hash ?? '').toLowerCase() === addr)

      const dec = parseInt(filtered[0]?.token?.decimals ?? '18')
      const parse = (v: string) => parseFloat(v ?? '0') / Math.pow(10, dec)

      const totalReceived = received.reduce((s, tx) => s + parse(tx.total?.value), 0)
      const totalSent = sent.reduce((s, tx) => s + parse(tx.total?.value), 0)

      return reply.send({
        token: filtered[0]?.token ?? null,
        address,
        totalTransfers: filtered.length,
        received: { count: received.length, total: totalReceived, items: received },
        sent: { count: sent.length, total: totalSent, items: sent },
        netPosition: totalReceived - totalSent,
      })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })
}
