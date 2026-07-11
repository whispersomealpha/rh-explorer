import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { blocksRoutes } from './routes/blocks'
import { tokenRoutes } from './routes/tokens'
import { walletRoutes } from './routes/wallet'
import { searchRoutes } from './routes/search'

const app = Fastify({ logger: false })

async function main() {
  await app.register(cors, { origin: '*' })

  // Must register content type parser for POST JSON body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string))
    } catch (err: any) {
      done(err, undefined)
    }
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  })

  app.get('/health', async () => ({
    status: 'ok',
    chainId: 4663,
    alchemyConfigured: !!process.env.ALCHEMY_API_KEY,
    ts: Date.now(),
  }))

  await app.register(blocksRoutes, { prefix: '/api' })
  await app.register(tokenRoutes,  { prefix: '/api' })
  await app.register(walletRoutes, { prefix: '/api' })
  await app.register(searchRoutes, { prefix: '/api' })

  const port = parseInt(process.env.PORT ?? '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API ready on port ${port}`)
}

main().catch(err => { console.error(err); process.exit(1) })
