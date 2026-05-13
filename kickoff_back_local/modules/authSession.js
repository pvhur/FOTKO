const authenticateSession = (req, res, next) => {
    if (!req.session.user) {
      return res.status(403).send({ success: false, message: "Not authenticated" });
    }
    next();
  };
  
  module.exports = authenticateSession;
  