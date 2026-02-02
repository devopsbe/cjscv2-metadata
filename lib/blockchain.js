const { ethers } = require("ethers");

// Configuration from environment variables
// Default to Base Sepolia testnet - switch to mainnet.base.org for production
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const STAKING_MANAGER_ADDRESS = process.env.STAKING_MANAGER_ADDRESS;
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;

// IPFS URLs
const STATIC_IMAGE_BASE = process.env.STATIC_IMAGE_IPFS || "ipfs://QmUBoa8gPCN3NhWj9txpCF5FwToUq1NMN3YZ7MBwkjzQwQ/";
const ANIMATION_OVERLAY = process.env.ANIMATION_OVERLAY_IPFS || "ipfs://bafybeidngluwswiusroipprouoslpam2gtxcbryj54ljk7br3nsrrup2ke";
const ANIMATED_IMAGE_BASE = process.env.ANIMATED_IMAGE_IPFS || null;

// Collection metadata
const COLLECTION_NAME = "CryptoJunkieSocialClub V2";
const COLLECTION_DESCRIPTION = "500 unique CryptoJunkies with Token Bound Accounts. Stake to earn $ATH tokens. NFTs with 50k+ $ATH in their wallet display animated artwork!";
const EXTERNAL_URL = process.env.EXTERNAL_URL || "https://cryptojunkies.xyz";

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

// Cached provider and contracts (reused across invocations in warm functions)
let provider = null;
let stakingManager = null;
let nftContract = null;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getStakingManager() {
  if (!stakingManager && STAKING_MANAGER_ADDRESS) {
    stakingManager = new ethers.Contract(STAKING_MANAGER_ADDRESS, STAKING_MANAGER_ABI, getProvider());
  }
  return stakingManager;
}

function getNFTContract() {
  if (!nftContract && NFT_CONTRACT_ADDRESS) {
    nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, getProvider());
  }
  return nftContract;
}

// Get animation status from blockchain
async function getAnimationData(tokenId) {
  const sm = getStakingManager();
  if (!sm) {
    return { isAnimated: false, balance: 0n, threshold: ethers.parseEther("50000") };
  }
  
  try {
    const [isAnimated, balance, threshold] = await sm.getAnimationStatus(tokenId);
    return { isAnimated, balance, threshold };
  } catch (error) {
    console.error(`Error fetching animation status for token ${tokenId}:`, error.message);
    return { isAnimated: false, balance: 0n, threshold: ethers.parseEther("50000") };
  }
}

// Get rarity from blockchain
async function getRarity(tokenId) {
  const nft = getNFTContract();
  if (!nft) {
    return 0; // Default to Common
  }
  
  try {
    return await nft.getRarity(tokenId);
  } catch (error) {
    console.error(`Error fetching rarity for token ${tokenId}:`, error.message);
    return 0;
  }
}

// Get boost tier
async function getBoostTier(tokenId) {
  const sm = getStakingManager();
  if (!sm) {
    return 0;
  }
  
  try {
    return await sm.getTBABoostTier(tokenId);
  } catch (error) {
    return 0;
  }
}

// Get TBA address
async function getTBAAddress(tokenId) {
  const sm = getStakingManager();
  if (!sm) {
    return null;
  }
  
  try {
    const address = await sm.tokenBoundAccounts(tokenId);
    return address === ethers.ZeroAddress ? null : address;
  } catch (error) {
    return null;
  }
}

// Format balance for display
function formatBalance(balance) {
  return ethers.formatEther(balance).split(".")[0]; // Whole number only
}

// Build full metadata response
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

// Build collection-level metadata
function buildContractMetadata() {
  return {
    name: COLLECTION_NAME,
    description: COLLECTION_DESCRIPTION,
    image: `${STATIC_IMAGE_BASE}collection.png`,
    external_link: EXTERNAL_URL,
    seller_fee_basis_points: 500, // 5% royalty
    fee_recipient: process.env.ROYALTY_RECIPIENT || ethers.ZeroAddress
  };
}

module.exports = {
  getAnimationData,
  getRarity,
  getBoostTier,
  getTBAAddress,
  formatBalance,
  buildMetadata,
  buildContractMetadata,
  COLLECTION_NAME,
  COLLECTION_DESCRIPTION,
  EXTERNAL_URL,
  RARITY_NAMES
};
