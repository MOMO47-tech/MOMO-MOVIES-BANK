"use strict";

const crypto = require("node:crypto");
const COOKIE_NAME = "momo_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_COOKIE_NAME = "momo_admin_session";
const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

function secureEqual(left, right) {
  const a = crypto.createHash("sha256").update(String(left)).digest();
  const b = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

function hashPhone(phone) {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret || secret.length < 24) throw new Error("PHONE_HASH_SECRET_NOT_CONFIGURED");
  return crypto.createHmac("sha256", secret).update(phone).digest("hex");
}

function createSession(memberHash) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  const payload = Buffer.from(JSON.stringify({ sub: memberHash, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function createAdminSession(userId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  const payload = Buffer.from(JSON.stringify({ sub: userId, role: "admin", exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseCookies(header = "") {
  return String(header).split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator > 0) cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    return cookies;
  }, {});
}

function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const token = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!secureEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.sub || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

function verifyAdminSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const token = parseCookies(req.headers.cookie || "")[ADMIN_COOKIE_NAME];
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!secureEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.role !== "admin" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.sub) || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

function setSessionCookie(res, token) {
  // Secure + SameSite=None also permits the HTTPS embedded Preview to carry this session.
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_SECONDS}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
}

function setAdminSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}`);
}

function clearAdminSessionCookie(res) {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}

module.exports = {
  COOKIE_NAME, ADMIN_COOKIE_NAME, SESSION_SECONDS, ADMIN_SESSION_SECONDS,
  secureEqual, normalizePhone, hashPhone, createSession, createAdminSession,
  verifySession, verifyAdminSession, setSessionCookie, clearSessionCookie,
  setAdminSessionCookie, clearAdminSessionCookie, sendJson
};
