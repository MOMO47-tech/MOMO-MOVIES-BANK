"use strict";

function getConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return { url, key };
}

function headers(key, extras = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extras };
}

async function addMember(phoneHash) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/momo_movie_members?on_conflict=phone_hash`, {
    method: "POST",
    headers: headers(key, { Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ phone_hash: phoneHash })
  });
  if (!response.ok) throw new Error("SUPABASE_MEMBER_WRITE_FAILED");
}

async function memberCount() {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/momo_movie_members?select=phone_hash`, {
    method: "HEAD",
    headers: headers(key, { Prefer: "count=exact", Range: "0-0" })
  });
  if (!response.ok) throw new Error("SUPABASE_COUNT_FAILED");
  const range = response.headers.get("content-range") || "";
  const total = range.split("/").pop();
  const count = Number(total);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("SUPABASE_COUNT_INVALID");
  return count;
}

module.exports = { addMember, memberCount };
