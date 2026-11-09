"use strict";
const { verifySession, sendJson } = require("../lib/security");
module.exports = function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return sendJson(res, 405, { error: "Method not allowed" }); }
  return sendJson(res, 200, { authenticated: Boolean(verifySession(req)) });
};
