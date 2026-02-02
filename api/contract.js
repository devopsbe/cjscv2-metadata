const { buildContractMetadata } = require("../lib/blockchain");

module.exports = function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const metadata = buildContractMetadata();
  
  // Cache for 1 hour (collection metadata rarely changes)
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json");
  
  return res.status(200).json(metadata);
};
