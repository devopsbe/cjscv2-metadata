module.exports = function handler(req, res) {
  // Health check / API info endpoint
  res.setHeader("Content-Type", "application/json");
  
  return res.status(200).json({
    status: "ok",
    service: "CJSCV2 Metadata Server",
    version: "2.0.0",
    endpoints: {
      metadata: "/api/metadata/:tokenId",
      animation: "/api/animation/:tokenId",
      contract: "/api/contract"
    },
    contracts: {
      stakingManager: process.env.STAKING_MANAGER_ADDRESS || "not configured",
      nftContract: process.env.NFT_CONTRACT_ADDRESS || "not configured"
    }
  });
};
