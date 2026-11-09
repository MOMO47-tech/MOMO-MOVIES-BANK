"use strict";
const { sendJson } = require("../lib/security");
const { memberCount } = require("../lib/supabase");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return sendJson(res, 405, { error: "Method not allowed" }); }
  try { return sendJson(res, 200, { count: await memberCount() }); }
  catch { return sendJson(res, 200, { count: null }); }
};
