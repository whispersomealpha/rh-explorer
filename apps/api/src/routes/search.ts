import { FastifyInstance } from 'fastify'
import { search } from '../lib/blockscout'

export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (req, reply) => {
    const { q } = req.query as any
    if (!q || q.length < 2) return reply.send([])
    const results = await search(q)
    return reply.send(results)
  })
}
