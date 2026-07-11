import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { blocksRoutes } from './routes/blocks'
import { tokenRoutes } from './routes/tokens'
import { walletRoutes } from './routes/wallet'
import { searchRoutes } from './routes/search'

const app = Fastify({
  logger: {
    level: 'warn', // suppress info noise, only show warnings+
  }
})

async function main() {
  await app.register(cors, { origin: '*' })
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    }),
  })

  app.get('/health', async () => ({
    status: 'ok',
    chain: 'Robinhood Chain',
    chainId: 4663,
    alchemyConfigured: !!process.env.ALCHEMY_API_KEY,
  }))

  await app.register(blocksRoutes, { prefix: '/api' })
  await app.register(tokenRoutes,  { prefix: '/api' })
  await app.register(walletRoutes, { prefix: '/api' })
  await app.register(searchRoutes, { prefix: '/api' })

  const port = parseInt(process.env.PORT ?? '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API running on port ${port}`)
  console.log(`Alchemy key: ${process.env.ALCHEMY_API_KEY ? 'configured' : 'MISSING - using public RPC'}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
