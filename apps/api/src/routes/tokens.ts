import { FastifyInstance } from 'fastify'
import { getHolderList, getTokenInfo } from '../services/token.service'
import { getTokenTransfers } from '../lib/blockscout'
import { cache } from '../lib/cache'
import { getCurrentTokenPrice, calculateHolderPnL, batchHolderPnL } from '../services/pnl.service'

export async function tokenRoutes(app: FastifyInstance) {

  app.get('/tokens/:address', async (req, reply) => {
    const { address } = req.params as any
    const key = `token:${address.toLowerCase()}`
    const cached = cache.get(key)
    if (cached) return reply.send(cached)
    try {
      const info = await getTokenInfo(address)
      cache.set(key, info, 120)
      return reply.send(info)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/tokens/:address/holders', async (req, reply) => {
    const { address } = req.params as any
    const key = `holders:${address.toLowerCase()}`
    const cached = cache.get(key)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      return reply.send(cached)
    }
    try {
      // Fetch max 500 holders
      const result = await getHolderList(address)
      if (result.holders.length > 0) cache.set(key, result, 600) // 10 min cache
      reply.header('X-Cache', 'MISS')
      return reply.send(result)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/tokens/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1' } = req.query as any
    const key = `transfers:${address.toLowerCase()}:${page}`
    const cached = cache.get(key)
    if (cached) return reply.send(cached)
    try {
      const data = await getTokenTransfers(address, parseInt(page))
      cache.set(key, data, 60)
      return reply.send(data)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/tokens/:address/price', async (req, reply) => {
    const { address } = req.params as any
    try {
      const price = await getCurrentTokenPrice(address)
      return reply.send({ priceUsd: price })
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // POST /tokens/:address/pnl/batch — PnL for first 50 holders
  app.post('/tokens/:address/pnl/batch', async (req, reply) => {
    const { address } = req.params as any
    const { holders, decimals = 18, currentPriceUsd = null } = req.body as any

    if (!Array.isArray(holders)) return reply.status(400).send({ error: 'holders must be array' })

    try {
      const results = await batchHolderPnL(holders, address, decimals, currentPriceUsd)
      return reply.send(results)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })
}
