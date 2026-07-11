import { ethers } from 'ethers'
import axios from 'axios'
import { rhProvider, getChainProvider } from '../lib/providers'
import {
  getAddress,
  getAddressTxs,
  getAddressTokenBalances,
} from '../lib/blockscout'
import {
  WalletProfile,
  ChainActivity,
  FundingHop,
  TokenBalance,
  CHAIN_CONFIG,
  CEX_LABELS,
  KNOWN_ADDRESSES,
} from '../lib/types'

// L2 gateway addresses that indicate a bridge deposit
const BRIDGE_GATEWAYS = new Set([
  '0x1e324b9316138ca9a73f960213621ad1aaf01b89', // L2 Gateway Router
  '0xfd9b17206278c16ddaacf6ac8f05dbf97edcb31e', // L2 ERC20 Gateway
  '0x912285144fc0f6e89d3ed16f5ab72f87a1878959', // L2 Arb-Custom Gateway
  '0x1d187c3e2da52d72bc9c41e3aba0fdfa6a7bf055', // L2 WETH Gateway
])

// L1 bridge contract on Ethereum
const L1_DELAYED_INBOX = '0x1a07cc4bd17e0118bdb54d70990d2158abad7a2d'
const L1_BRIDGE = '0xdf8755334ce7a73ccf6b581c02ea649ae3e864b3'

export async function getWalletProfile(address: string): Promise<WalletProfile> {
  const addr = address.toLowerCase()

  // Run RH Chain data + cross-chain check in parallel
  const [rhData, crossChainData] = await Promise.allSettled([
    getRHChainData(addr),
    getCrossChainPresence(addr),
  ])

  const rh = rhData.status === 'fulfilled' ? rhData.value : null
  const crossChain = crossChainData.status === 'fulfilled' ? crossChainData.value : []

  // Trace funding trail starting from the funder address
  let fundingTrail: FundingHop[] = []
  if (rh?.fundedBy) {
    fundingTrail = await traceFundingTrail(addr, rh.fundedBy, rh.fundedByTx, 1)
  }

  // Collect labels
  const labels: string[] = []
  const knownLabel = KNOWN_ADDRESSES[addr] ?? KNOWN_ADDRESSES[address]
  if (knownLabel) labels.push(knownLabel)
  if (rh?.fundingType === 'bridge') labels.push('Bridge User')

  return {
    address,
    rhChain: rh ?? {
      ethBalance: '0',
      txCount: 0,
      firstTx: null,
      lastTx: null,
      tokenBalances: [],
      fundedBy: null,
      fundedByTx: null,
      fundedAt: null,
      fundingType: null,
    },
    crossChain,
    fundingTrail,
    labels,
  }
}

// ── RH Chain data ─────────────────────────────────────────────────────────────
async function getRHChainData(address: string) {
  const [bsAddress, txHistory, tokenBals, ethBalance] = await Promise.allSettled([
    getAddress(address),
    getAddressTxs(address, 1, 100),
    getAddressTokenBalances(address),
    rhProvider.getBalance(address),
  ])

  const bs = bsAddress.status === 'fulfilled' ? bsAddress.value : null
  const txs = txHistory.status === 'fulfilled'
    ? (txHistory.value.items ?? [])
    : []
  const tokenBalRaw = tokenBals.status === 'fulfilled' ? tokenBals.value : []
  const ethBal = ethBalance.status === 'fulfilled'
    ? ethBalance.value.toString()
    : '0'

  // Find earliest tx to determine how this wallet was funded
  const sortedTxs = [...txs].sort((a: any, b: any) =>
    parseInt(a.block) - parseInt(b.block)
  )
  const firstTxRaw = sortedTxs[0]
  const lastTxRaw  = sortedTxs[sortedTxs.length - 1]

  // First INCOMING tx = how the wallet was seeded
  const firstIncoming = sortedTxs.find(
    (tx: any) => tx.to?.hash?.toLowerCase() === address.toLowerCase()
  )

  let fundedBy: string | null = null
  let fundedByTx: string | null = null
  let fundedAt: number | null = null
  let fundingType: 'bridge' | 'transfer' | 'contract' | null = null

  if (firstIncoming) {
    const fromAddr = firstIncoming.from?.hash?.toLowerCase() ?? ''
    fundedBy    = firstIncoming.from?.hash ?? null
    fundedByTx  = firstIncoming.hash ?? null
    fundedAt    = firstIncoming.timestamp
      ? Math.floor(new Date(firstIncoming.timestamp).getTime() / 1000)
      : null

    if (BRIDGE_GATEWAYS.has(fromAddr)) {
      fundingType = 'bridge'
    } else if (firstIncoming.to?.is_contract) {
      fundingType = 'contract'
    } else {
      fundingType = 'transfer'
    }
  }

  // Map token balances
  const tokenBalances: TokenBalance[] = (tokenBalRaw as any[]).map((tb: any) => ({
    tokenAddress: tb.token?.address ?? '',
    tokenName: tb.token?.name ?? 'Unknown',
    tokenSymbol: tb.token?.symbol ?? '???',
    balance: tb.value ?? '0',
    balanceFormatted: parseFloat(
      ethers.formatUnits(tb.value ?? '0', parseInt(tb.token?.decimals ?? '18'))
    ),
    decimals: parseInt(tb.token?.decimals ?? '18'),
  }))

  const firstTxTime = firstTxRaw?.timestamp
    ? Math.floor(new Date(firstTxRaw.timestamp).getTime() / 1000)
    : null
  const lastTxTime = lastTxRaw?.timestamp
    ? Math.floor(new Date(lastTxRaw.timestamp).getTime() / 1000)
    : null

  return {
    ethBalance: ethBal,
    txCount: parseInt(bs?.transaction_count ?? String(txs.length)),
    firstTx: firstTxTime,
    lastTx: lastTxTime,
    tokenBalances,
    fundedBy,
    fundedByTx,
    fundedAt,
    fundingType,
  }
}

// ── Cross-chain presence ──────────────────────────────────────────────────────
async function getCrossChainPresence(address: string): Promise<ChainActivity[]> {
  const results = await Promise.allSettled(
    CHAIN_CONFIG.map(chain => checkChainActivity(address, chain))
  )

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<ChainActivity>).value)
}

async function checkChainActivity(
  address: string,
  chain: typeof CHAIN_CONFIG[0]
): Promise<ChainActivity> {
  try {
    const provider = getChainProvider(chain.chainId)

    // Check balance + tx count in parallel
    const [balance, txCount] = await Promise.all([
      provider.getBalance(address).catch(() => BigInt(0)),
      provider.getTransactionCount(address).catch(() => 0),
    ])

    // If there's activity, try to get first/last tx via explorer API (best effort)
    let firstSeen: number | null = null
    let lastSeen: number | null = null

    if (txCount > 0 && chain.apiBase) {
      try {
        const explorerKey = getExplorerKey(chain.chainId)
        const params: Record<string, string> = {
          module: 'account',
          action: 'txlist',
          address,
          sort: 'asc',
          page: '1',
          offset: '1',
        }
        if (explorerKey) params.apikey = explorerKey

        const { data } = await axios.get(chain.apiBase, { params, timeout: 8000 })
        if (data.status === '1' && data.result?.length > 0) {
          firstSeen = parseInt(data.result[0].timeStamp)
        }

        // Get last tx
        const paramsDesc = { ...params, sort: 'desc' }
        const { data: dataDesc } = await axios.get(chain.apiBase, {
          params: paramsDesc,
          timeout: 8000,
        })
        if (dataDesc.status === '1' && dataDesc.result?.length > 0) {
          lastSeen = parseInt(dataDesc.result[0].timeStamp)
        }
      } catch {
        // Explorer API failed — we still have balance + txCount
      }
    }

    return {
      chain: chain.name,
      chainId: chain.chainId,
      address,
      txCount,
      firstSeen,
      lastSeen,
      balance: balance.toString(),
      hasActivity: txCount > 0 || balance > BigInt(0),
    }
  } catch {
    return {
      chain: chain.name,
      chainId: chain.chainId,
      address,
      txCount: 0,
      firstSeen: null,
      lastSeen: null,
      balance: '0',
      hasActivity: false,
    }
  }
}

// ── Funding trail tracer ──────────────────────────────────────────────────────
// Traces recursively: who funded the funder, up to maxHops deep
async function traceFundingTrail(
  originalWallet: string,
  funderAddress: string,
  fundingTxHash: string | null,
  currentHop: number,
  maxHops = 5,
  visited = new Set<string>()
): Promise<FundingHop[]> {
  if (currentHop > maxHops) return []
  if (visited.has(funderAddress.toLowerCase())) return []
  visited.add(funderAddress.toLowerCase())

  const hops: FundingHop[] = []
  const funderLower = funderAddress.toLowerCase()

  // Determine the chain this hop is on and what type it is
  let hopChain = 'Robinhood Chain'
  let hopChainId = 4663
  let hopType: FundingHop['type'] = 'transfer'
  let hopLabel: string | undefined

  // Check if funder is a bridge gateway → trace to L1
  if (BRIDGE_GATEWAYS.has(funderLower)) {
    hopType = 'bridge'
    hopLabel = 'Arbitrum Bridge'
    hopChain = 'Robinhood Chain'

    // Try to find the corresponding L1 deposit tx
    const l1Hop = await traceL1BridgeDeposit(originalWallet, currentHop)
    if (l1Hop) {
      hops.push({
        hop: currentHop,
        chain: 'Robinhood Chain',
        chainId: 4663,
        fromAddress: funderAddress,
        toAddress: originalWallet,
        txHash: fundingTxHash ?? '',
        value: '0',
        timestamp: 0,
        type: 'bridge',
        label: 'Arbitrum Bridge → RH Chain',
      })
      hops.push(l1Hop)

      // Now trace that L1 address further
      if (l1Hop.fromAddress) {
        const deeperHops = await traceEthereumFunding(
          l1Hop.fromAddress,
          currentHop + 2,
          maxHops,
          visited
        )
        hops.push(...deeperHops)
      }
      return hops
    }
  }

  // Check CEX label
  const cexLabel = CEX_LABELS[funderLower]
  if (cexLabel) {
    hopType = 'cex'
    hopLabel = cexLabel
  }

  // Check known contract labels
  const knownLabel = KNOWN_ADDRESSES[funderLower] ?? KNOWN_ADDRESSES[funderAddress]
  if (knownLabel) hopLabel = knownLabel

  hops.push({
    hop: currentHop,
    chain: hopChain,
    chainId: hopChainId,
    fromAddress: funderAddress,
    toAddress: originalWallet,
    txHash: fundingTxHash ?? '',
    value: '0',
    timestamp: 0,
    type: hopType,
    label: hopLabel,
  })

  // If it's a CEX, stop here — trail ends at CEX
  if (hopType === 'cex') return hops

  // Otherwise trace who funded the funder on RH Chain
  if (currentHop < maxHops && !BRIDGE_GATEWAYS.has(funderLower)) {
    try {
      const funderHistory = await getAddressTxs(funderAddress, 1, 50)
      const txs = funderHistory.items ?? []
      const sorted = [...txs].sort((a: any, b: any) =>
        parseInt(a.block) - parseInt(b.block)
      )
      const funderFirstIncoming = sorted.find(
        (tx: any) => tx.to?.hash?.toLowerCase() === funderLower
      )
      if (funderFirstIncoming?.from?.hash) {
        const deeperHops = await traceFundingTrail(
          funderAddress,
          funderFirstIncoming.from.hash,
          funderFirstIncoming.hash,
          currentHop + 1,
          maxHops,
          visited
        )
        hops.push(...deeperHops)
      }
    } catch {
      // Best effort
    }
  }

  return hops
}

// ── L1 bridge deposit tracer ──────────────────────────────────────────────────
async function traceL1BridgeDeposit(
  l2Address: string,
  currentHop: number
): Promise<FundingHop | null> {
  try {
    // Query Etherscan for transactions TO the L1 Delayed Inbox from this address
    const ethApiKey = process.env.ETHERSCAN_API_KEY ?? ''
    const params: Record<string, string> = {
      module: 'account',
      action: 'txlist',
      address: l2Address,
      sort: 'asc',
      page: '1',
      offset: '10',
    }
    if (ethApiKey) params.apikey = ethApiKey

    const { data } = await axios.get('https://api.etherscan.io/api', {
      params,
      timeout: 8000,
    })

    if (data.status !== '1' || !data.result?.length) return null

    // Find tx to L1 bridge contracts
    const bridgeTx = data.result.find(
      (tx: any) =>
        tx.to?.toLowerCase() === L1_DELAYED_INBOX.toLowerCase() ||
        tx.to?.toLowerCase() === L1_BRIDGE.toLowerCase()
    )

    if (!bridgeTx) return null

    const cexLabel = CEX_LABELS[bridgeTx.from?.toLowerCase()]

    return {
      hop: currentHop + 1,
      chain: 'Ethereum',
      chainId: 1,
      fromAddress: bridgeTx.from,
      toAddress: L1_DELAYED_INBOX,
      txHash: bridgeTx.hash,
      value: bridgeTx.value,
      timestamp: parseInt(bridgeTx.timeStamp),
      type: 'bridge',
      label: cexLabel
        ? `${cexLabel} → Arbitrum Bridge`
        : 'Arbitrum Bridge deposit (L1)',
    }
  } catch {
    return null
  }
}

// ── Ethereum funding tracer ───────────────────────────────────────────────────
async function traceEthereumFunding(
  address: string,
  currentHop: number,
  maxHops: number,
  visited: Set<string>
): Promise<FundingHop[]> {
  if (currentHop > maxHops || visited.has(address.toLowerCase())) return []
  visited.add(address.toLowerCase())

  try {
    const ethApiKey = process.env.ETHERSCAN_API_KEY ?? ''
    const params: Record<string, string> = {
      module: 'account',
      action: 'txlist',
      address,
      sort: 'asc',
      page: '1',
      offset: '5',
    }
    if (ethApiKey) params.apikey = ethApiKey

    const { data } = await axios.get('https://api.etherscan.io/api', {
      params,
      timeout: 8000,
    })

    if (data.status !== '1' || !data.result?.length) return []

    const firstIncoming = data.result.find(
      (tx: any) => tx.to?.toLowerCase() === address.toLowerCase()
    )
    if (!firstIncoming) return []

    const fromLower = firstIncoming.from?.toLowerCase() ?? ''
    const cexLabel = CEX_LABELS[fromLower]

    const hop: FundingHop = {
      hop: currentHop,
      chain: 'Ethereum',
      chainId: 1,
      fromAddress: firstIncoming.from,
      toAddress: address,
      txHash: firstIncoming.hash,
      value: firstIncoming.value,
      timestamp: parseInt(firstIncoming.timeStamp),
      type: cexLabel ? 'cex' : 'transfer',
      label: cexLabel,
    }

    const hops = [hop]

    // Keep tracing if not a CEX
    if (!cexLabel && currentHop < maxHops) {
      const deeper = await traceEthereumFunding(
        firstIncoming.from,
        currentHop + 1,
        maxHops,
        visited
      )
      hops.push(...deeper)
    }

    return hops
  } catch {
    return []
  }
}

function getExplorerKey(chainId: number): string | undefined {
  const keyMap: Record<number, string | undefined> = {
    1:     process.env.ETHERSCAN_API_KEY,
    8453:  process.env.BASESCAN_API_KEY,
    42161: process.env.ARBISCAN_API_KEY,
    10:    process.env.OPTIMISM_API_KEY,
    137:   process.env.POLYGONSCAN_API_KEY,
    56:    process.env.BSCSCAN_API_KEY,
  }
  return keyMap[chainId]
}
