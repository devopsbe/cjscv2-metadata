/**
 * API endpoint to get Merkle proofs for allowlist verification
 * 
 * GET /api/proof/:address
 * 
 * Returns:
 * {
 *   address: "0x...",
 *   og: { eligible: true/false, proof: [...] },
 *   addicts: { eligible: true/false, proof: [...] }
 * }
 */

const allowlistData = require("../../data/allowlist-proofs.json");

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { address } = req.query;

    // Validate address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        error: "Invalid address format",
        message: "Address must be a valid Ethereum address (0x...)"
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check OG eligibility
    const ogProof = allowlistData.og.proofs[normalizedAddress];
    const ogEligible = ogProof !== undefined;

    // Check Addicts eligibility
    const addictsProof = allowlistData.addicts.proofs[normalizedAddress];
    const addictsEligible = addictsProof !== undefined;

    const response = {
      address: normalizedAddress,
      og: {
        eligible: ogEligible,
        proof: ogEligible ? ogProof : null,
        root: allowlistData.og.root
      },
      addicts: {
        eligible: addictsEligible,
        proof: addictsEligible ? addictsProof : null,
        root: allowlistData.addicts.root
      },
      // Summary for easy checking
      eligiblePhases: [
        ...(ogEligible ? ["OG"] : []),
        ...(addictsEligible ? ["ADDICTS"] : []),
        "PUBLIC" // Everyone is eligible for public
      ]
    };

    // Cache for 5 minutes (proofs don't change often)
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json");
    
    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching proof:", error);
    return res.status(500).json({
      error: "Failed to fetch proof",
      message: error.message
    });
  }
};
