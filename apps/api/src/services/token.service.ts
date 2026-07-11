import { ethers } from 'ethers'
import { rhProvider } from '../lib/providers'
import { getAllTokenHolders, getToken } from '../lib/blockscout'
import { ERC20_ABI } from '../lib/abi'
import { TokenHolder, TokenInfo, KNOWN_ADDRESSES } from '../lib/types'

export async function getTokenInfo(address: string): Promise<TokenInfo> {
  const [onChain, bsData] = await Promise.allSettled([
    fetchOnChainTokenData(address),
    getToken(address),
  ])

  const bs = bsData.status === 'fulfilled' ? bsData.value : null
  const oc = onChain.status === 'fulfilled' ? onChain.value : null

  const decimals = oc?.decimals ?? parseInt(bs?.decimals ?? '18')
  const totalSupply = bs?.total_supply ?? oc?.totalSupply ?? '0'
  const totalSupplyFormatted = parseFloat(
    ethers.formatUnits(totalSupply, decimals)
  )

  return {
    address,
    name: bs?.name ?? oc?.name ?? 'Unknown',
    symbol: bs?.symbol ?? oc?.symbol ?? '???',
    decimals,
    totalSupply,
    totalSupplyFormatted,
    holderCount: parseInt(bs?.holders ?? '0'),
    txCount: parseInt(bs?.transactions_count ?? '0'),
  }
}

async function fetchOnChainTokenData(address: string) {
  const contract = new ethers.Contract(address, ERC20_ABI, rhProvider)
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.name().catch(() => 'Unknown'),
    contract.symbol().catch(() => '???'),
    contract.decimals().catch(() => 18),
    contract.totalSupply().catch(() => '0'),
  ])
  return { name, symbol, decimals: Number(decimals), totalSupply: totalSupply.toString() }
}

export async function getHolderList(tokenAddress: string): Promise<{
  tokenInfo: TokenInfo
  holders: TokenHolder[]
}> {
  const [tokenInfo, rawHolders] = await Promise.all([
    getTokenInfo(tokenAddress),
    getAllTokenHolders(tokenAddress),
  ])

  const decimals = tokenInfo.decimals
  const totalSupplyFormatted = tokenInfo.totalSupplyFormatted

  const holders: TokenHolder[] = rawHolders.map((h: any, i: number) => {
    const balance = h.value ?? h.balance ?? '0'
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals))
    const share = totalSupplyFormatted > 0
      ? (balanceFormatted / totalSupplyFormatted) * 100
      : 0

    return {
      address: h.address?.hash ?? h.address,
      balance,
      balanceFormatted,
      share: parseFloat(share.toFixed(4)),
      rank: i + 1,
      label: getAddressLabel(h.address?.hash ?? h.address),
    }
  })

  return { tokenInfo, holders }
}

export function getAddressLabel(address: string): string | undefined {
  return KNOWN_ADDRESSES[address.toLowerCase()] ??
         KNOWN_ADDRESSES[address]
}
