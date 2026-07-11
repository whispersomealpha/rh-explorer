import { FastifyInstance } from 'fastify'
import { getHolderList, getTokenInfo } from '../services/token.service'
import { getTokenTransfers } from '../lib/blockscout'
import { cache } from '../lib/cache'

export async function tokenRoutes(app: FastifyInstance) {
  // GET /tokens/:address — token info
  app.get('/tokens/:address', async (req, reply) => {
    const { address } = req.params as any
    const cacheKey = `token:${address.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached) return reply.send(cached)
    const info = await getTokenInfo(address)
    cache.set(cacheKey, info, 120) // 2 min
    return reply.send(info)
  })

  // GET /tokens/:address/holders — full holder list (cached)
  app.get('/tokens/:address/holders', async (req, reply) => {
    const { address } = req.params as any
    const cacheKey = `holders:${address.toLowerCase()}`

    // Return cached immediately if available
    const cached = cache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      return reply.send(cached)
    }

    // Mark as loading so concurrent requests don't double-fetch
    const result = await getHolderList(address)
    cache.set(cacheKey, result, 300) // 5 min cache
    reply.header('X-Cache', 'MISS')
    return reply.send(result)
  })

  // GET /tokens/:address/transfers
  app.get('/tokens/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1' } = req.query as any
    const cacheKey = `transfers:${address.toLowerCase()}:${page}`
    const cached = cache.get(cacheKey)
    if (cached) return reply.send(cached)
    const data = await getTokenTransfers(address, parseInt(page))
    cache.set(cacheKey, data, 60)
    return reply.send(data)
  })
}
