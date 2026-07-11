import { FastifyInstance } from 'fastify'
import { getLatestBlocks, getBlock, getLatestTxs, getTx, getTxLogs } from '../lib/blockscout'
import { rhProvider } from '../lib/providers'

export async function blocksRoutes(app: FastifyInstance) {
  // GET /blocks
  app.get('/blocks', async (req, reply) => {
    const { limit = '20' } = req.query as any
    const blocks = await getLatestBlocks(Math.min(parseInt(limit), 50))
    return reply.send(blocks)
  })

  // GET /blocks/:id
  app.get('/blocks/:id', async (req, reply) => {
    const { id } = req.params as any
    const block = await getBlock(id)
    return reply.send(block)
  })

  // GET /txs
  app.get('/txs', async (req, reply) => {
    const { limit = '20' } = req.query as any
    const txs = await getLatestTxs(Math.min(parseInt(limit), 50))
    return reply.send(txs)
  })

  // GET /txs/:hash
  app.get('/txs/:hash', async (req, reply) => {
    const { hash } = req.params as any
    const [tx, logs] = await Promise.all([getTx(hash), getTxLogs(hash)])
    return reply.send({ ...tx, logs })
  })

  // GET /stats
  app.get('/stats', async (req, reply) => {
    const [block, gasPrice] = await Promise.all([
      rhProvider.getBlock('latest'),
      rhProvider.getFeeData(),
    ])
    return reply.send({
      latestBlock: block?.number ?? 0,
      timestamp: block?.timestamp ?? 0,
      gasPrice: gasPrice.gasPrice?.toString() ?? '0',
      gasPriceGwei: gasPrice.gasPrice
        ? (Number(gasPrice.gasPrice) / 1e9).toFixed(4)
        : '0',
    })
  })
}
