import { FastifyInstance } from 'fastify'
import { getHolderList, getTokenInfo } from '../services/token.service'
import { getTokenTransfers } from '../lib/blockscout'

export async function tokenRoutes(app: FastifyInstance) {
  // GET /tokens/:address — token info
  app.get('/tokens/:address', async (req, reply) => {
    const { address } = req.params as any
    const info = await getTokenInfo(address)
    return reply.send(info)
  })

  // GET /tokens/:address/holders — full paginated holder list
  app.get('/tokens/:address/holders', async (req, reply) => {
    const { address } = req.params as any
    const result = await getHolderList(address)
    return reply.send(result)
  })

  // GET /tokens/:address/transfers
  app.get('/tokens/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1' } = req.query as any
    const data = await getTokenTransfers(address, parseInt(page))
    return reply.send(data)
  })
}
