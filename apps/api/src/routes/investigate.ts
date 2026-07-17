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

  // GET /investigate/:address/token-transfers — raw token transfers
  app.get('/investigate/:address/token-transfers', async (req, reply) => {
    const { address } = req.params as any
    try {
      const transfers = await getAllAddressTokenTransfers(address)
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
}
