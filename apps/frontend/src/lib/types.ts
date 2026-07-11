export interface Block {
  number: number
  hash: string
  timestamp: number
  txCount: number
  gasUsed: string
  gasLimit: string
  miner: string
  size: number
}

export interface Transaction {
  hash: string
  blockNumber: number
  timestamp: number
  from: string
  to: string | null
  value: string
  gasUsed: string
  gasPrice: string
  status: boolean
  input: string
  methodId: string | null
}

export interface TokenHolder {
  address: string
  balance: string
  balanceFormatted: number
  share: number // % of total supply
  rank: number
}

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  totalSupplyFormatted: number
  holderCount: number
  txCount: number
  price?: number
}

export interface ChainActivity {
  chain: string
  chainId: number
  address: string
  txCount: number
  firstSeen: number | null
  lastSeen: number | null
  balance: string
  hasActivity: boolean
}

export interface FundingHop {
  hop: number
  chain: string
  chainId: number
  fromAddress: string
  toAddress: string
  txHash: string
  value: string
  timestamp: number
  type: 'bridge' | 'transfer' | 'cex' | 'contract'
  label?: string // e.g. "Binance", "Arbitrum Bridge"
}

export interface WalletProfile {
  address: string
  // On Robinhood Chain
  rhChain: {
    ethBalance: string
    txCount: number
    firstTx: number | null
    lastTx: number | null
    tokenBalances: TokenBalance[]
    fundedBy: string | null
    fundedByTx: string | null
    fundedAt: number | null
    fundingType: 'bridge' | 'transfer' | 'contract' | null
  }
  // Cross-chain presence
  crossChain: ChainActivity[]
  // Funding trail (how the wallet was originally funded, traced back)
  fundingTrail: FundingHop[]
  // Known labels
  labels: string[]
}

export interface TokenBalance {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  balance: string
  balanceFormatted: number
  decimals: number
  priceUsd?: number
  valueUsd?: number
}

export interface NetworkStats {
  latestBlock: number
  tps: number
  avgBlockTime: number
  avgGasPrice: string
  totalTxs: number
}

export interface BridgeEvent {
  type: 'deposit' | 'withdrawal'
  l1TxHash: string
  l2TxHash: string
  sender: string
  amount: string
  token: string
  status: 'pending' | 'complete' | 'failed'
  initiatedAt: number
  finalizedAt: number | null
  timeRemaining: number | null // seconds until 7-day window closes
}

export interface StockTokenInfo {
  address: string
  symbol: string
  name: string
  priceUsd: number
  priceUpdatedAt: number
  uiMultiplier: string
  oraclePaused: boolean
  holders?: number
  volume24h?: number
}

export const STOCK_TOKENS: Record<string, string> = {
  AAPL: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
  AMD: '0x86923f96303D656E4aa86D9d42D1e57ad2023fdC',
  AMZN: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
  BABA: '0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4',
  BE: '0x822CC93fFD030293E9842c30BBD678F530701867',
  COIN: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b',
  CRCL: '0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5',
  CRWV: '0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3',
  GOOGL: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',
  INTC: '0xc72b96e0E48ecd4DC75E1e45396e26300BC39681',
  META: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',
  MSFT: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
  MU: '0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD',
  NVDA: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
  ORCL: '0xb0992820E760d836549ba69BC7598b4af75dEE03',
  PLTR: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A',
  SNDK: '0xB90A19fF0Af67f7779afF50A882A9CfF42446400',
  SPCX: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa',
  TSLA: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
  USAR: '0xd917B029C761D264c6A312BBbcDA868658eF86a6',
  QQQ: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
  SGOV: '0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5',
  SLV: '0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f',
  SPY: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
  CUSO: '0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344',
  WETH: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  USDG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
}

export const KNOWN_ADDRESSES: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Null Address',
  '0x1E324B9316138CA9a73F960213621AD1aaf01B89': 'L2 Gateway Router',
  '0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e': 'L2 ERC20 Gateway',
  '0x912285144fC0f6e89d3Ed16F5Ab72f87A1878959': 'L2 Arb-Custom Gateway',
  '0x1D187C3E2dA52D72BC9C41e3AbA0fdFa6a7bF055': 'L2 WETH Gateway',
  '0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1': 'L2 Multicall',
  '0x000000000022D473030F116dDEE9F6B43aC78BA3': 'Permit2',
}

export const CHAIN_CONFIG = [
  { name: 'Ethereum', chainId: 1, rpc: 'https://eth.llamarpc.com', explorer: 'https://etherscan.io', apiBase: 'https://api.etherscan.io/api' },
  { name: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', apiBase: 'https://api.basescan.org/api' },
  { name: 'Arbitrum', chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', apiBase: 'https://api.arbiscan.io/api' },
  { name: 'Optimism', chainId: 10, rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io', apiBase: 'https://api-optimistic.etherscan.io/api' },
  { name: 'Polygon', chainId: 137, rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com', apiBase: 'https://api.polygonscan.com/api' },
  { name: 'BNB Chain', chainId: 56, rpc: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', apiBase: 'https://api.bscscan.com/api' },
]

// Known CEX deposit addresses (partial list for labeling)
export const CEX_LABELS: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Binance',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
  '0x77696bb39917c91a0c3908d577d5e322095425ca': 'Coinbase',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io',
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c': 'Gate.io',
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': 'Bybit',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': 'Binance Cold',
  '0x5a52e96bacdabb82fd05763e25335261b270efcb': 'Binance',
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327': 'KuCoin',
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': 'KuCoin',
  '0x2b5634c42055806a59e9107ed44d43c426e58258': 'KuCoin',
}
