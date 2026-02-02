require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const STAKING_MANAGER_ADDRESS = process.env.STAKING_MANAGER_ADDRESS;
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;

// IPFS Image URLs (update these with your actual IPFS CIDs)
const STATIC_IMAGE_BASE = process.env.STATIC_IMAGE_IPFS || "ipfs://QmSTATIC/";
// Single animation overlay applied to all powered-up NFTs
const ANIMATION_OVERLAY = process.env.ANIMATION_OVERLAY_IPFS || "ipfs://QmOVERLAY/powered-up-overlay.gif";
// Option: Pre-composited animated versions (if you want to pre-render them)
const ANIMATED_IMAGE_BASE = process.env.ANIMATED_IMAGE_IPFS || null;

// Collection metadata
const COLLECTION_NAME = "CryptoJunkieSocialClub V2";
const COLLECTION_DESCRIPTION = "500 unique CryptoJunkies with Token Bound Accounts. Stake to earn $ATH tokens. NFTs with 50k+ $ATH in their wallet display animated artwork!";
const EXTERNAL_URL = "https://cryptojunkies.xyz";

// Rarity names
const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Mythic"];

// Minimal ABIs for reading contract data
const STAKING_MANAGER_ABI = [
  "function getAnimationStatus(uint256 tokenId) external view returns (bool isAnimated, uint256 balance, uint256 threshold)",
  "function getTBABalance(uint256 tokenId) external view returns (uint256)",
  "function getTBABoostTier(uint256 tokenId) external view returns (uint256)",
  "function tokenBoundAccounts(uint256 tokenId) external view returns (address)"
];

const NFT_ABI = [
  "function getRarity(uint256 tokenId) external view returns (uint8)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function totalSupply() external view returns (uint256)"
];

// Provider and contracts
let provider;
let stakingManager;
let nftContract;

function initializeContracts() {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  
  if (STAKING_MANAGER_ADDRESS) {
    stakingManager = new ethers.Contract(STAKING_MANAGER_ADDRESS, STAKING_MANAGER_ABI, provider);
  }
  
  if (NFT_CONTRACT_ADDRESS) {
    nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
  }
}

// Get animation status from blockchain
async function getAnimationData(tokenId) {
  if (!stakingManager) {
    return { isAnimated: false, balance: 0n, threshold: ethers.parseEther("50000") };
  }
  
  try {
    const [isAnimated, balance, threshold] = await stakingManager.getAnimationStatus(tokenId);
    return { isAnimated, balance, threshold };
  } catch (error) {
    console.error(`Error fetching animation status for token ${tokenId}:`, error.message);
    return { isAnimated: false, balance: 0n, threshold: ethers.parseEther("50000") };
  }
}

// Get rarity from blockchain
async function getRarity(tokenId) {
  if (!nftContract) {
    return 0; // Default to Common
  }
  
  try {
    return await nftContract.getRarity(tokenId);
  } catch (error) {
    console.error(`Error fetching rarity for token ${tokenId}:`, error.message);
    return 0;
  }
}

// Get boost tier
async function getBoostTier(tokenId) {
  if (!stakingManager) {
    return 0;
  }
  
  try {
    return await stakingManager.getTBABoostTier(tokenId);
  } catch (error) {
    return 0;
  }
}

// Get TBA address
async function getTBAAddress(tokenId) {
  if (!stakingManager) {
    return null;
  }
  
  try {
    const address = await stakingManager.tokenBoundAccounts(tokenId);
    return address === ethers.ZeroAddress ? null : address;
  } catch (error) {
    return null;
  }
}

// Format balance for display
function formatBalance(balance) {
  return ethers.formatEther(balance).split(".")[0]; // Whole number only
}

// Build metadata response
async function buildMetadata(tokenId) {
  const [animationData, rarity, boostTier, tbaAddress] = await Promise.all([
    getAnimationData(tokenId),
    getRarity(tokenId),
    getBoostTier(tokenId),
    getTBAAddress(tokenId)
  ]);

  const { isAnimated, balance, threshold } = animationData;
  const rarityName = RARITY_NAMES[Number(rarity)] || "Common";
  const balanceFormatted = formatBalance(balance);
  const thresholdFormatted = formatBalance(threshold);

  // Static image is always the base
  const staticImage = `${STATIC_IMAGE_BASE}${tokenId}.jpg`;
  
  // For animated NFTs:
  // Option 1: Use pre-composited animated images (if ANIMATED_IMAGE_BASE is set)
  // Option 2: Use static image + animation_url for overlay effect
  let imageUrl = staticImage;
  let animationUrl = undefined;

  if (isAnimated) {
    if (ANIMATED_IMAGE_BASE) {
      // Pre-composited animated version exists
      imageUrl = `${ANIMATED_IMAGE_BASE}${tokenId}.gif`;
      animationUrl = imageUrl;
    } else {
      // Use single overlay - OpenSea will show animation_url if present
      // The overlay GIF should have transparency to show base image
      animationUrl = ANIMATION_OVERLAY;
    }
  }

  // Build attributes
  const attributes = [
    {
      trait_type: "Rarity",
      value: rarityName
    },
    {
      trait_type: "TBA Balance",
      value: `${balanceFormatted} ATH`,
      display_type: "number"
    },
    {
      trait_type: "Boost Tier",
      value: Number(boostTier)
    },
    {
      trait_type: "Status",
      value: isAnimated ? "Powered Up ⚡" : "Standard"
    },
    {
      trait_type: "Animation Threshold",
      value: `${thresholdFormatted} ATH`
    }
  ];

  // Add TBA address if exists
  if (tbaAddress) {
    attributes.push({
      trait_type: "Token Bound Account",
      value: tbaAddress
    });
  }

  const metadata = {
    name: `${COLLECTION_NAME} #${tokenId}`,
    description: `${COLLECTION_DESCRIPTION}${isAnimated ? " This Junkie is POWERED UP! ⚡" : ""}`,
    image: imageUrl,
    external_url: `${EXTERNAL_URL}/nft/${tokenId}`,
    attributes,
    // OpenSea specific
    background_color: isAnimated ? "FFD700" : "1a1a2e",
  };

  // Add animation_url only if powered up
  if (animationUrl) {
    metadata.animation_url = animationUrl;
  }

  return metadata;
}

// Routes

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "CJSCV2 Metadata Server",
    contracts: {
      stakingManager: STAKING_MANAGER_ADDRESS || "not configured",
      nftContract: NFT_CONTRACT_ADDRESS || "not configured"
    }
  });
});

// Token metadata endpoint
app.get("/metadata/:tokenId", async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId) || tokenId < 1 || tokenId > 500) {
      return res.status(400).json({ error: "Invalid token ID. Must be 1-500." });
    }

    const metadata = await buildMetadata(tokenId);
    
    // Cache for 5 minutes (balance can change)
    res.set("Cache-Control", "public, max-age=300");
    res.json(metadata);
  } catch (error) {
    console.error("Error generating metadata:", error);
    res.status(500).json({ error: "Failed to generate metadata" });
  }
});

// Batch metadata endpoint (for efficiency)
app.get("/metadata/batch", async (req, res) => {
  try {
    const tokenIds = req.query.ids?.split(",").map(id => parseInt(id)) || [];
    
    if (tokenIds.length === 0 || tokenIds.length > 50) {
      return res.status(400).json({ error: "Provide 1-50 token IDs" });
    }

    const metadata = await Promise.all(
      tokenIds.map(id => buildMetadata(id))
    );

    res.set("Cache-Control", "public, max-age=300");
    res.json(metadata);
  } catch (error) {
    console.error("Error generating batch metadata:", error);
    res.status(500).json({ error: "Failed to generate metadata" });
  }
});

// Animation status endpoint (lightweight)
app.get("/animation/:tokenId", async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId) || tokenId < 1 || tokenId > 500) {
      return res.status(400).json({ error: "Invalid token ID" });
    }

    const { isAnimated, balance, threshold } = await getAnimationData(tokenId);
    
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      tokenId,
      isAnimated,
      balance: formatBalance(balance),
      threshold: formatBalance(threshold),
      progress: Number((balance * 100n) / threshold)
    });
  } catch (error) {
    console.error("Error checking animation status:", error);
    res.status(500).json({ error: "Failed to check animation status" });
  }
});

// Contract-level metadata (for OpenSea collection page)
app.get("/contract", (req, res) => {
  res.json({
    name: COLLECTION_NAME,
    description: COLLECTION_DESCRIPTION,
    image: `${STATIC_IMAGE_BASE}collection.png`,
    external_link: EXTERNAL_URL,
    seller_fee_basis_points: 500, // 5% royalty
    fee_recipient: process.env.ROYALTY_RECIPIENT || ethers.ZeroAddress
  });
});

// Initialize and start server
initializeContracts();

app.listen(PORT, () => {
  console.log(`\n🚀 CJSCV2 Metadata Server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /                     - Health check`);
  console.log(`  GET /metadata/:tokenId    - Token metadata`);
  console.log(`  GET /metadata/batch?ids=  - Batch metadata`);
  console.log(`  GET /animation/:tokenId   - Animation status`);
  console.log(`  GET /contract             - Collection metadata`);
  console.log(`\nContracts:`);
  console.log(`  Staking Manager: ${STAKING_MANAGER_ADDRESS || "NOT SET"}`);
  console.log(`  NFT Contract:    ${NFT_CONTRACT_ADDRESS || "NOT SET"}`);
});
