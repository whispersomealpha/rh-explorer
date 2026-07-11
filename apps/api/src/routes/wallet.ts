import { FastifyInstance } from 'fastify'
import { ethers } from 'ethers'
import { getWalletProfile } from '../services/wallet.service'
import {
  getAddress,
  getAddressTxs,
  getAddressTokenBalances,
  getAddressTokenTransfers,
} from '../lib/blockscout'

function checksum(addr: string): string {
  try { return ethers.getAddress(addr) } catch { return addr }
}

export async function walletRoutes(app: FastifyInstance) {
  app.get('/wallet/:address', async (req, reply) => {
    const { address } = req.params as any
    try {
      const profile = await getWalletProfile(checksum(address))
      return reply.send(profile)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/wallet/:address/txs', async (req, reply) => {
    const { address } = req.params as any
    const { page = '1', limit = '50' } = req.query as any
    try {
      const data = await getAddressTxs(checksum(address), parseInt(page), parseInt(limit))
      return reply.send(data)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/wallet/:address/tokens', async (req, reply) => {
    const { address } = req.params as any
    try {
      const data = await getAddressTokenBalances(checksum(address))
      return reply.send(data)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })

  app.get('/wallet/:address/transfers', async (req, reply) => {
    const { address } = req.params as any
    const { token, page = '1' } = req.query as any
    try {
      const data = await getAddressTokenTransfers(checksum(address), token, parseInt(page))
      return reply.send(data)
    } catch (e: any) {
      return reply.status(500).send({ error: e.message })
    }
  })
}
