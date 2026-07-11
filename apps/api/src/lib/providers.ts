import { ethers } from 'ethers'
import { CHAIN_CONFIG } from './types'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const RH_RPC = `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
const RH_WS  = `wss://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`

export const rhProvider  = new ethers.JsonRpcProvider(RH_RPC)
export const rhWsProvider = new ethers.WebSocketProvider(RH_WS)

// Public RPC providers for cross-chain tracing (no key needed, rate-limited but fine for per-request use)
export const chainProviders: Record<number, ethers.JsonRpcProvider> = {}
for (const c of CHAIN_CONFIG) {
  chainProviders[c.chainId] = new ethers.JsonRpcProvider(c.rpc)
}

export function getChainProvider(chainId: number): ethers.JsonRpcProvider {
  return chainProviders[chainId] ?? new ethers.JsonRpcProvider(
    CHAIN_CONFIG.find(c => c.chainId === chainId)?.rpc ?? ''
  )
}
