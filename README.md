# CJSCV2 Metadata Server (Vercel Serverless)

Dynamic metadata server for CryptoJunkieSocialClubV2 NFTs. Returns different artwork based on the $ATH balance in each NFT's Token Bound Account (TBA).

## Features

- **Dynamic Images**: NFTs with 50k+ $ATH show animated overlays
- **Real-time Data**: Reads TBA balance from blockchain
- **OpenSea Compatible**: Standard ERC-721 metadata format
- **Serverless**: Runs on Vercel's edge network for global low-latency

## Deployment to Vercel

### 1. Install Vercel CLI (optional, for local testing)

```bash
npm install -g vercel
```

### 2. Deploy via GitHub (Recommended)

1. Push this `metadata-server` folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project"
4. Import your GitHub repository
5. Set the **Root Directory** to `metadata-server`
6. Add environment variables (see below)
7. Click "Deploy"

### 3. Environment Variables

Add these in Vercel Dashboard > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `RPC_URL` | `https://mainnet.base.org` |
| `STAKING_MANAGER_ADDRESS` | Your deployed StakingManager address |
| `NFT_CONTRACT_ADDRESS` | Your deployed CJSCV2 address |
| `STATIC_IMAGE_IPFS` | `ipfs://QmUBoa8gPCN3NhWj9txpCF5FwToUq1NMN3YZ7MBwkjzQwQ/` |
| `ANIMATION_OVERLAY_IPFS` | `ipfs://bafybeidngluwswiusroipprouoslpam2gtxcbryj54ljk7br3nsrrup2ke` |
| `EXTERNAL_URL` | `https://cryptojunkies.xyz` |
| `ROYALTY_RECIPIENT` | Your royalty wallet address |

### 4. Update Smart Contract

After deployment, call `revealMetadata()` on your CJSCV2 contract:

```javascript
// Using ethers.js or hardhat console
await cjscv2.revealMetadata("https://your-app.vercel.app/api/metadata/");
```

## API Endpoints

### GET /api/metadata/:tokenId

Returns full metadata for a single NFT.

**Example:** `https://your-app.vercel.app/api/metadata/42`

**Response:**
```json
{
  "name": "CryptoJunkieSocialClub V2 #42",
  "description": "500 unique CryptoJunkies...",
  "image": "ipfs://QmUBoa8gPCN3NhWj9txpCF5FwToUq1NMN3YZ7MBwkjzQwQ/42.jpg",
  "animation_url": "ipfs://bafybeidngluwswiusroipprouoslpam2gtxcbryj54ljk7br3nsrrup2ke",
  "attributes": [
    { "trait_type": "Rarity", "value": "Rare" },
    { "trait_type": "TBA Balance", "value": "75000 ATH" },
    { "trait_type": "Status", "value": "Powered Up ⚡" }
  ]
}
```

### GET /api/animation/:tokenId

Quick check for animation status (lightweight).

**Response:**
```json
{
  "tokenId": 42,
  "isAnimated": true,
  "balance": "75000",
  "threshold": "50000",
  "progress": 150
}
```

### GET /api/contract

Collection-level metadata for marketplaces.

**Response:**
```json
{
  "name": "CryptoJunkieSocialClub V2",
  "description": "500 unique CryptoJunkies...",
  "image": "ipfs://QmUBoa8gPCN3NhWj9txpCF5FwToUq1NMN3YZ7MBwkjzQwQ/collection.png",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0x..."
}
```

## Local Development

```bash
# Install dependencies
npm install

# Run locally with Vercel CLI
npm run dev
```

Then visit `http://localhost:3000/api/metadata/1`

## File Structure

```
metadata-server/
├── api/
│   ├── index.js              # Health check / API info
│   ├── contract.js           # Collection metadata
│   ├── metadata/
│   │   └── [tokenId].js      # Token metadata endpoint
│   └── animation/
│       └── [tokenId].js      # Animation status endpoint
├── lib/
│   └── blockchain.js         # Shared blockchain utilities
├── vercel.json               # Vercel configuration
├── package.json
└── README.md
```

## Animation Threshold

NFTs display animated artwork when their TBA holds >= 50,000 $ATH.

This is configured in `StakingManagerV2.sol`:
```solidity
uint256 public constant ANIMATION_THRESHOLD = 50_000 ether;
```

## Troubleshooting

### Metadata not updating?
- OpenSea caches metadata. Use their "Refresh Metadata" button on the NFT page
- The server caches for 5 minutes for performance

### Animation not showing?
- Verify the TBA has >= 50,000 $ATH
- Check the `/api/animation/:tokenId` endpoint for status
- Ensure `ANIMATION_OVERLAY_IPFS` is set correctly
