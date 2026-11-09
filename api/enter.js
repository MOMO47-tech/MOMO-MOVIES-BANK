"use strict";

const { secureEqual, normalizePhone, hashPhone, createSession, setSessionCookie, sendJson } = require("../lib/security");
const { addMember } = require("../lib/supabase");

function parseBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body === "string") { try { return JSON.parse(body); } catch { return {}; } }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return sendJson(res, 405, { error: "Njia hii inatumika kwa POST pekee." }); }
  const gatePassword = process.env.SITE_GATE_PASSWORD || "";
  const sessionSecret = process.env.SESSION_SECRET || "";
  const phoneSecret = process.env.PHONE_HASH_SECRET || "";
  if (!gatePassword || sessionSecret.length < 32 || phoneSecret.length < 24 || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 503, { error: "Huduma ya kuingia haijaunganishwa kikamilifu." });
  }
  const { phone, password } = parseBody(req.body);
  const normalized = normalizePhone(phone);
  if (!normalized || typeof password !== "string" || password.length < 1 || password.length > 160) {
    return sendJson(res, 400, { error: "Weka namba halali ya simu na nenosiri." });
  }
  if (!secureEqual(password, gatePassword)) return sendJson(res, 401, { error: "Namba au nenosiri si sahihi." });
  try {
    const memberHash = hashPhone(normalized);
    await addMember(memberHash);
    setSessionCookie(res, createSession(memberHash));
    return sendJson(res, 200, { ok: true });
  } catch {
    return sendJson(res, 503, { error: "Imeshindikana kuanzisha session kwa sasa. Jaribu tena baadaye." });
  }
};
