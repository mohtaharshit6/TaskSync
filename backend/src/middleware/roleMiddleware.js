// requireProjectMember (runs earlier in the chain) has already verified membership
// and attached req.membership with the user's role. This middleware just gates on
// that role — no additional DB query needed.
const requireProjectRole = (...roles) => (req, res, next) => {
  if (!req.membership) {
    // Safeguard: should never happen if routes are wired correctly
    return res.status(403).json({ success: false, message: 'Membership not verified' });
  }
  if (!roles.includes(req.membership.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

module.exports = { requireProjectRole };
