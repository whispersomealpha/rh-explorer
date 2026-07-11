import { FastifyInstance } from 'fastify'
import { getHolderList, getTokenInfo } from '../services/token.service'
import { getTokenTransfers } from '../lib/blockscout'
import { cache } from '../lib/cache'

export async function tokenRoutes(app: FastifyInstance) {
  // GET /tokens/:address — token info only (fast)
  app.get('/tokens/:address', async (req, reply) => {
    const { address } = req.params as any
    const addr = address.toLowerCase()
    const cacheKey = `token:${addr}`
    const cached = cache.get(cacheKey)
    if (cached) return reply.send(cached)
    try {
      const info = await getTokenInfo(address)
      cache.set(cacheKey, info, 120)
      return reply.send(info)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /tokens/:address/holders — full holder list with caching
  // If cache is warm: responds instantly
  // If cache is cold: fetches (slow), caches, responds
  app.get('/tokens/:address/holders', async (req, reply) => {
    const { address } = req.params as any
    const addr = address.toLowerCase()
    const cacheKey = `holders:${addr}`

    const cached = cache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      return reply.send(cached)
    }

    try {
      reply.header('X-Cache', 'MISS')
      const result = await getHolderList(address)
      // Only cache if we actually got holders
      if (result.holders.length > 0) {
        cache.set(cacheKey, result, 300) // 5 min
      }
      return reply.send(result)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  // GET /tokens/:address/holders/status — check if cached
  app.get('/tokens/:address/holders/status', async (req, reply) => {
    const { address } = req.params as any
    const cached = cache.get(`holders:${address.toLowerCase()}`)
    return reply.send({
      cached: !!cached,
      holderCount: cached ? (cached as any).holders?.length ?? 0 : null,
    })
  })

  // GET /tokens/:address/transfers
  app.get('/tokens/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1' } = req.query as any
    const cacheKey = `transfers:${address.toLowerCase()}:${page}`
    const cached = cache.get(cacheKey)
    if (cached) return reply.send(cached)
    try {
      const data = await getTokenTransfers(address, parseInt(page))
      cache.set(cacheKey, data, 60)
      return reply.send(data)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })
}
