const { buildMetadata } = require("../../lib/blockchain");

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

    // Build and return metadata
    const metadata = await buildMetadata(id);
    
    // Cache for 5 minutes (balance can change)
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json");
    
    return res.status(200).json(metadata);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return res.status(500).json({ 
      error: "Failed to generate metadata",
      message: error.message 
    });
  }
};
