import { FastifyInstance } from 'fastify'
import { getWalletProfile } from '../services/wallet.service'
import {
  getAddress,
  getAddressTxs,
  getAddressTokenBalances,
  getAddressTokenTransfers,
} from '../lib/blockscout'

export async function walletRoutes(app: FastifyInstance) {
  // GET /wallet/:address — full profile with cross-chain + funding trail
  app.get('/wallet/:address', async (req, reply) => {
    const { address } = req.params as any
    const profile = await getWalletProfile(address)
    return reply.send(profile)
  })

  // GET /wallet/:address/txs
  app.get('/wallet/:address/txs', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1', limit = '50' } = req.query as any
    const data = await getAddressTxs(address, parseInt(page), parseInt(limit))
    return reply.send(data)
  })

  // GET /wallet/:address/tokens
  app.get('/wallet/:address/tokens', async (req, reply) => {
    const { address } = req.params as any
    const data = await getAddressTokenBalances(address)
    return reply.send(data)
  })

  // GET /wallet/:address/transfers
  app.get('/wallet/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { token, page = '1' } = req.query as any
    const data = await getAddressTokenTransfers(address, token, parseInt(page))
    return reply.send(data)
  })
}
