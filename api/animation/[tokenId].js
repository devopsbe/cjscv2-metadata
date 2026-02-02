const { getAnimationData, formatBalance } = require("../../lib/blockchain");

module.exports = async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokenId } = req.query;
    const id = parseInt(tokenId);
    
    // Validate token ID
    if (isNaN(id) || id < 1 || id > 500) {
      return res.status(400).json({ 
        error: "Invalid token ID. Must be between 1 and 500." 
      });
    }

    const { isAnimated, balance, threshold } = await getAnimationData(id);
    
    // Cache for 1 minute (lightweight endpoint, more frequent updates)
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
    res.setHeader("Content-Type", "application/json");
    
    return res.status(200).json({
      tokenId: id,
      isAnimated,
      balance: formatBalance(balance),
      threshold: formatBalance(threshold),
      progress: Number((balance * 100n) / threshold)
    });
  } catch (error) {
    console.error("Error checking animation status:", error);
    return res.status(500).json({ 
      error: "Failed to check animation status",
      message: error.message 
    });
  }
};
