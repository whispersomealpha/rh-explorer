import { ethers } from 'ethers'
import { CHAIN_CONFIG } from './types'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? ''
const RH_RPC = ALCHEMY_KEY
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://rpc.mainnet.chain.robinhood.com'

export const rhProvider = new ethers.JsonRpcProvider(RH_RPC, undefined, {
  staticNetwork: true,
})

const _chainProviders = new Map<number, ethers.JsonRpcProvider>()

export function getChainProvider(chainId: number): ethers.JsonRpcProvider {
  if (!_chainProviders.has(chainId)) {
    const chain = CHAIN_CONFIG.find(c => c.chainId === chainId)
    if (!chain) throw new Error(`Unknown chainId: ${chainId}`)
    _chainProviders.set(chainId, new ethers.JsonRpcProvider(chain.rpc, undefined, { staticNetwork: true }))
  }
  return _chainProviders.get(chainId)!
}
