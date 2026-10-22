/**
 * Simple, robust participant authentication and role authorization for the mini-project.
 * Supports header 'x-role', 'x-participant-name', Bearer token, or request body.
 */

const PARTICIPANT_PROFILES = {
  MANUFACTURER: {
    role: "MANUFACTURER",
    name: "PharmaCorp Manufacturing Ltd.",
    id: "MFR-001",
    allowedActions: ["REGISTER_BATCH", "VIEW_CHAIN", "AUDIT_BATCH"],
  },
  RETAILER: {
    role: "RETAILER",
    name: "Apollo Prime Pharmacy",
    id: "RET-102",
    allowedActions: ["VERIFY_BATCH", "RECORD_TRANSFER", "VIEW_CHAIN", "AUDIT_BATCH"],
  },
  WHOLESALER: {
    role: "WHOLESALER",
    name: "MedSupply Logistics & Wholesale",
    id: "WHL-205",
    allowedActions: ["VERIFY_BATCH", "RECORD_TRANSFER", "VIEW_CHAIN", "AUDIT_BATCH"],
  },
};

function resolveParticipant(req) {
  // Check headers, Bearer token, or body
  let role = req.headers["x-role"] || req.headers["x-participant-role"] || req.body?.participantRole;

  const authHeader = req.headers.authorization;
  if (!role && authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim().toUpperCase();
    if (PARTICIPANT_PROFILES[token]) {
      role = token;
    }
  }

  // Normalize role
  const upperRole = String(role || "MANUFACTURER").trim().toUpperCase();
  const profile = PARTICIPANT_PROFILES[upperRole] || {
    role: upperRole,
    name: req.headers["x-participant-name"] || req.body?.participantName || `${upperRole} Agent`,
    id: `PARTICIPANT-${upperRole}`,
    allowedActions: ["VIEW_CHAIN"],
  };

  return profile;
}

/**
 * Middleware to require a specific role (or set of roles)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const participant = resolveParticipant(req);
    req.participant = participant;

    if (!allowedRoles.includes(participant.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied. Role "${participant.role}" is not authorized for this action. Required: [${allowedRoles.join(", ")}]`,
      });
    }

    next();
  };
}

module.exports = {
  PARTICIPANT_PROFILES,
  resolveParticipant,
  requireRole,
};
