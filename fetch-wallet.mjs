// fetch-wallet.mjs
// Run with: node fetch-wallet.mjs
// Requires: BLOCKSCOUT_API_KEY env var (optional but removes rate limits)
// Pulls ALL pages of transactions + token transfers for a wallet

const ADDRESS = '0x542718C390Ef1E4bEB46ce2023FfaA627db8aa33'
const BASE = 'https://api.blockscout.com/4663/api/v2'
const API_KEY = process.env.BLOCKSCOUT_API_KEY ?? ''

const headers = API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}

async function fetchAllPages(endpoint, label) {
  const results = []
  let params = new URLSearchParams()
  let page = 0

  while (true) {
    const url = `${BASE}${endpoint}?${params}`
    process.stderr.write(`\r[${label}] page ${page + 1}, fetched ${results.length} so far...`)
    
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.error(`\nFailed: ${res.status} ${await res.text()}`)
      break
    }
    const data = await res.json()
    const items = data.items ?? []
    results.push(...items)

    if (!data.next_page_params || items.length === 0) break
    
    params = new URLSearchParams()
    for (const [k, v] of Object.entries(data.next_page_params)) {
      params.set(k, v)
    }
    page++
    await new Promise(r => setTimeout(r, 200)) // respect rate limits
  }

  process.stderr.write(`\r[${label}] done — ${results.length} items total\n`)
  return results
}

function toEth(wei, decimals = 18) {
  if (!wei || wei === '0') return 0
  return parseFloat(wei) / Math.pow(10, parseInt(decimals))
}

async function main() {
  const addr = ADDRESS.toLowerCase()

  // Fetch address info
  const infoRes = await fetch(`${BASE}/addresses/${ADDRESS}`, { headers })
  const info = await infoRes.json()

  // Fetch everything in parallel
  const [txs, transfersIn, transfersOut] = await Promise.all([
    fetchAllPages(`/addresses/${ADDRESS}/transactions`, 'transactions'),
    fetchAllPages(`/addresses/${ADDRESS}/token-transfers?filter=to`, 'transfers IN'),
    fetchAllPages(`/addresses/${ADDRESS}/token-transfers?filter=from`, 'transfers OUT'),
  ])

  const allTransfers = [...transfersIn, ...transfersOut]

  // ── ETH summary ──────────────────────────────────────────────
  const ethIn = txs.filter(t => t.to?.hash?.toLowerCase() === addr)
    .reduce((s, t) => s + toEth(t.value), 0)
  const ethOut = txs.filter(t => t.from?.hash?.toLowerCase() === addr)
    .reduce((s, t) => s + toEth(t.value), 0)
  const currentEth = toEth(info.coin_balance)

  // ── Token map ─────────────────────────────────────────────────
  const tokenMap = {}
  for (const tx of allTransfers) {
    const sym = tx.token?.symbol ?? '?'
    const dec = tx.token?.decimals ?? '18'
    const tAddr = tx.token?.address_hash ?? tx.token?.address ?? '?'
    const amt = toEth(tx.total?.value, dec)
    const isIn = (tx.to?.hash ?? '').toLowerCase() === addr
    const isOut = (tx.from?.hash ?? '').toLowerCase() === addr

    if (!tokenMap[sym]) tokenMap[sym] = {
      symbol: sym, name: tx.token?.name, address: tAddr,
      received: 0, sent: 0, receivedTxs: [], sentTxs: []
    }
    if (isIn) { tokenMap[sym].received += amt; tokenMap[sym].receivedTxs.push(tx) }
    if (isOut) { tokenMap[sym].sent += amt; tokenMap[sym].sentTxs.push(tx) }
  }

  // ── Method breakdown ──────────────────────────────────────────
  const methods = {}
  for (const tx of txs.filter(t => t.from?.hash?.toLowerCase() === addr)) {
    const m = tx.method ?? 'transfer'
    methods[m] = (methods[m] ?? 0) + 1
  }

  // ── WETH LP collections ───────────────────────────────────────
  const wethCollects = transfersIn
    .filter(t => t.token?.symbol === 'WETH' && t.method === 'collect' && parseFloat(t.total?.value ?? '0') > 0)
    .map(t => ({ amount: toEth(t.total?.value, '18'), from: t.from?.hash, tx: t.transaction_hash, time: t.timestamp }))
  const totalWethCollected = wethCollects.reduce((s, t) => s + t.amount, 0)

  // ── Build report ──────────────────────────────────────────────
  const report = {
    address: ADDRESS,
    snapshot: {
      ethBalance: currentEth,
      ethBalanceUsd: (currentEth * 1828.14).toFixed(2),
      totalTxsEverSent: info.tx_count ?? txs.filter(t => t.from?.hash?.toLowerCase() === addr).length,
    },
    eth: {
      receivedFromTxs: ethIn,
      sentInTxs: ethOut,
    },
    wethLpFees: {
      totalCollected: totalWethCollected,
      collectCount: wethCollects.length,
      collects: wethCollects,
    },
    transactions: {
      total: txs.length,
      methodBreakdown: methods,
      outbound: txs.filter(t => t.from?.hash?.toLowerCase() === addr).map(t => ({
        hash: t.hash, method: t.method, to: t.to?.hash, toName: t.to?.name,
        value: toEth(t.value), timestamp: t.timestamp, block: t.block_number, status: t.status
      })),
      inbound: txs.filter(t => t.to?.hash?.toLowerCase() === addr).map(t => ({
        hash: t.hash, from: t.from?.hash, value: toEth(t.value), timestamp: t.timestamp, block: t.block_number
      })),
    },
    tokenActivity: Object.values(tokenMap)
      .sort((a, b) => (b.received + b.sent) - (a.received + a.sent))
      .map(t => ({
        symbol: t.symbol, name: t.name, address: t.address,
        received: t.received, sent: t.sent, net: t.received - t.sent,
        receivedCount: t.receivedTxs.length, sentCount: t.sentTxs.length,
        classification: t.sent > 0 && t.received > 0 ? 'traded'
          : t.sent > 0 ? 'sent_only'
          : 'received_only',
        receivedTxs: t.receivedTxs.map(tx => ({
          hash: tx.transaction_hash, amount: toEth(tx.total?.value, tx.token?.decimals),
          from: tx.from?.hash, method: tx.method, type: tx.type, time: tx.timestamp
        })),
        sentTxs: t.sentTxs.map(tx => ({
          hash: tx.transaction_hash, amount: toEth(tx.total?.value, tx.token?.decimals),
          to: tx.to?.hash, toName: tx.to?.name, method: tx.method, time: tx.timestamp
        })),
      })),
  }

  // Output full JSON
  console.log(JSON.stringify(report, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
