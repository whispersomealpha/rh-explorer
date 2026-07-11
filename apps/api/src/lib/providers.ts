import { ethers } from 'ethers'
import { CHAIN_CONFIG } from './types'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? ''
const RH_RPC = ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://rpc.mainnet.chain.robinhood.com'

// Lazy singleton — only created when first used, no startup connection
let _rhProvider: ethers.JsonRpcProvider | null = null

export function getRhProvider(): ethers.JsonRpcProvider {
  if (!_rhProvider) {
    _rhProvider = new ethers.JsonRpcProvider(RH_RPC)
  }
  return _rhProvider
}

// Keep named export for backward compat — but make it a getter
export const rhProvider = new Proxy({} as ethers.JsonRpcProvider, {
  get(_target, prop) {
    return (getRhProvider() as any)[prop]
  }
})

// Cross-chain providers — created lazily on demand
const _chainProviders = new Map<number, ethers.JsonRpcProvider>()

export function getChainProvider(chainId: number): ethers.JsonRpcProvider {
  if (!_chainProviders.has(chainId)) {
    const chain = CHAIN_CONFIG.find(c => c.chainId === chainId)
    if (!chain) throw new Error(`Unknown chainId: ${chainId}`)
    _chainProviders.set(chainId, new ethers.JsonRpcProvider(chain.rpc))
  }
  return _chainProviders.get(chainId)!
}
