# RH Explorer — Robinhood Chain Explorer

The fastest block explorer for Robinhood Chain (Chain ID 4663) with cross-chain wallet investigation.

## Features

- **Block & Transaction Explorer** — live-updating feed of blocks and transactions
- **Token Holder List** — paste any contract address, get full holder list with % share and concentration bar
- **Wallet Investigator** — trace any wallet's funding history up to 5 hops across Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain
- **Cross-chain Presence** — see all chains a wallet is active on
- **Stock Token Dashboard** — all 25 Robinhood Chain Stock Tokens (AAPL, NVDA, TSLA, SPY, QQQ, etc.)
- **Live Search** — search by address, tx hash, block number, token name

## Architecture

```
rh-explorer/
├── apps/
│   ├── api/          → Fastify API (Railway service 1)
│   └── frontend/     → Next.js 14 frontend (Railway service 2)
└── packages/
    ├── types/        → Shared TypeScript types + contract addresses
    └── abi/          → ERC-20 + Chainlink ABIs
```

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/rh-explorer.git
cd rh-explorer
```

Install API deps:
```bash
cd apps/api && npm install && cd ../..
```

Install frontend deps:
```bash
cd apps/frontend && npm install && cd ../..
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
cp .env.example apps/frontend/.env.local
```

Edit `apps/api/.env`:
```env
ALCHEMY_API_KEY=your_new_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key    # optional but recommended
BASESCAN_API_KEY=your_basescan_key      # optional
ARBISCAN_API_KEY=your_arbiscan_key      # optional
PORT=3001
```

Edit `apps/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run locally

Terminal 1 — API:
```bash
cd apps/api && npm run dev
```

Terminal 2 — Frontend:
```bash
cd apps/frontend && npm run dev
```

Visit http://localhost:3000

---

## Deploy to Railway

You'll create **two Railway services** from one GitHub repo.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/rh-explorer.git
git push -u origin main
```

### Step 2 — Deploy the API

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select your repo
3. Set **Root Directory** to `apps/api`
4. Add environment variables:
   - `ALCHEMY_API_KEY` = your key
   - `ETHERSCAN_API_KEY` = your key (optional)
   - `BASESCAN_API_KEY` = your key (optional)
   - `ARBISCAN_API_KEY` = your key (optional)
5. Deploy — Railway auto-detects Node.js and runs `npm install && npm run build && npm run start`
6. Copy the generated Railway URL (e.g. `https://rh-explorer-api.up.railway.app`)

### Step 3 — Deploy the Frontend

1. In the same Railway project → New Service → GitHub Repo (same repo)
2. Set **Root Directory** to `apps/frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = the API URL from Step 2 (e.g. `https://rh-explorer-api.up.railway.app`)
4. Deploy

That's it. Both services deploy automatically on every `git push`.

---

## Key Pages

| URL | Description |
|-----|-------------|
| `/` | Homepage — live blocks, txs, stock token cards |
| `/blocks` | Live block feed |
| `/txs` | Live transaction feed |
| `/block/:number` | Block detail + all transactions |
| `/tx/:hash` | Transaction detail with decoded input + logs |
| `/tokens` | All 27 token contracts — filter by type |
| `/token/:address` | Token page — full holder list, transfers, concentration |
| `/wallet` | Wallet investigator search |
| `/wallet/:address` | Full wallet profile — funding trail, cross-chain, txs, tokens |

## Adding Explorer API Keys (for deeper wallet tracing)

Without API keys, wallet tracing uses public RPC only (balance + tx count). With keys, it also shows first/last tx timestamps and traces funding sources through Etherscan-compatible APIs.

All free, ~2 min each:
- Etherscan: https://etherscan.io/apis
- Basescan: https://basescan.org/apis
- Arbiscan: https://arbiscan.io/apis
- Optimism: https://optimistic.etherscan.io/apis

Add them as Railway environment variables on the API service.

## Network Details

| Property | Value |
|----------|-------|
| Chain Name | Robinhood Chain |
| Chain ID | 4663 |
| RPC | https://robinhood-mainnet.g.alchemy.com/v2/{KEY} |
| WebSocket | wss://robinhood-mainnet.g.alchemy.com/v2/{KEY} |
| Block Explorer | https://robinhoodchain.blockscout.com |
| Technology | Arbitrum Orbit L2 |
| Gas Token | ETH |
