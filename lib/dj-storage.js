"use strict";

const BUCKET = "momo-dj-movies";
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const FALLBACK_FILE_BYTES = 50 * 1024 * 1024;
const OBJECT_PATTERN = /^dj-mack\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp4$/i;

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  const parsed = new URL(url);
  const projectMatch = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (!projectMatch) throw new Error("SUPABASE_STORAGE_HOST_UNSUPPORTED");
  return {
    url,
    key,
    storageOrigin: `https://${projectMatch[1]}.storage.supabase.co`
  };
}

function authHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function storageRequest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/storage/v1${path}`, {
    method: options.method || "GET",
    headers: authHeaders(key, options.headers || {}),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeout || 15000)
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

async function ensurePublicBucket() {
  const current = await storageRequest(`/bucket/${BUCKET}`);
  if (current.response.ok) {
    if (current.payload?.public !== true) throw new Error("DJ_BUCKET_NOT_PUBLIC");
    const currentLimit = Number(current.payload?.file_size_limit || 0);
    if (currentLimit >= MAX_FILE_BYTES) return currentLimit;
    if (currentLimit < MAX_FILE_BYTES) {
      const updated = await storageRequest(`/bucket/${BUCKET}`, {
        method: "PUT",
        body: { public: true, file_size_limit: MAX_FILE_BYTES, allowed_mime_types: ["video/mp4"] }
      });
      if (updated.response.ok) return MAX_FILE_BYTES;
      // Keep the existing configured limit when the plan does not allow a larger bucket.
      return currentLimit || FALLBACK_FILE_BYTES;
    }
  }
  if (current.response.status !== 404) throw new Error("DJ_BUCKET_LOOKUP_FAILED");

  const created = await storageRequest("/bucket", {
    method: "POST",
    body: {
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_FILE_BYTES,
      allowed_mime_types: ["video/mp4"]
    }
  });
  if (created.response.ok) return MAX_FILE_BYTES;
  const fallback = await storageRequest("/bucket", {
    method: "POST",
    body: {
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: FALLBACK_FILE_BYTES,
      allowed_mime_types: ["video/mp4"]
    }
  });
  if (fallback.response.ok) return FALLBACK_FILE_BYTES;
  // Another authorized request may have created the fixed bucket concurrently.
  if ([400, 409].includes(created.response.status) || [400, 409].includes(fallback.response.status)) {
    const retry = await storageRequest(`/bucket/${BUCKET}`);
    if (retry.response.ok && retry.payload?.public === true) return Number(retry.payload.file_size_limit || FALLBACK_FILE_BYTES);
    if (retry.response.ok) throw new Error("DJ_BUCKET_NOT_PUBLIC");
  }
  throw new Error("DJ_BUCKET_CREATE_FAILED");
}

function encodeObjectPath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function makePublicUrl(path) {
  const { url } = config();
  return `${url}/storage/v1/object/public/${BUCKET}/${encodeObjectPath(path)}`;
}

async function createDjUpload(path) {
  if (!OBJECT_PATTERN.test(path)) throw new Error("INVALID_DJ_OBJECT_PATH");
  const maxFileBytes = await ensurePublicBucket();
  const encoded = encodeObjectPath(path);
  const signed = await storageRequest(`/object/upload/sign/${BUCKET}/${encoded}`, {
    method: "POST",
    body: {},
    headers: { "x-upsert": "false" }
  });
  if (!signed.response.ok) throw new Error("DJ_SIGNED_UPLOAD_FAILED");
  const signedPath = String(signed.payload?.url || signed.payload?.signedUrl || "");
  let token = String(signed.payload?.token || "");
  if (!token && signedPath) {
    try { token = new URL(signedPath, `${config().url}/storage/v1`).searchParams.get("token") || ""; } catch {}
  }
  if (!token || token.length > 4096) throw new Error("DJ_UPLOAD_TOKEN_MISSING");
  const { storageOrigin } = config();
  return {
    bucket: BUCKET,
    path,
    token,
    maxFileBytes,
    endpoint: `${storageOrigin}/storage/v1/upload/resumable`,
    publicUrl: makePublicUrl(path)
  };
}

async function verifyUploadedDjMovie(path) {
  if (!OBJECT_PATTERN.test(path)) throw new Error("INVALID_DJ_OBJECT_PATH");
  const publicUrl = makePublicUrl(path);
  const response = await fetch(publicUrl, {
    method: "GET",
    headers: { Range: "bytes=0-15" },
    signal: AbortSignal.timeout(20000)
  });
  if (response.status !== 206) {
    try { await response.body?.cancel(); } catch {}
    throw new Error("DJ_UPLOAD_NOT_RANGE_READABLE");
  }
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentRange = String(response.headers.get("content-range") || "");
  const rangeMatch = contentRange.match(/^bytes\s+0-\d+\/(\d+)$/i);
  const size = rangeMatch ? Number(rangeMatch[1]) : 0;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (contentType !== "video/mp4" || bytes.length < 8 || size < 8 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") {
    throw new Error("DJ_UPLOAD_NOT_VALID_MP4");
  }
  return { publicUrl, size };
}

async function deleteDjObject(path) {
  if (!OBJECT_PATTERN.test(path)) throw new Error("INVALID_DJ_OBJECT_PATH");
  const encoded = encodeObjectPath(path);
  const result = await storageRequest(`/object/${BUCKET}/${encoded}`, { method: "DELETE" });
  if (!result.response.ok && result.response.status !== 404) throw new Error("DJ_OBJECT_DELETE_FAILED");
}

function objectPathFromPublicUrl(value) {
  const safe = String(value || "");
  let pathname;
  try {
    const parsed = new URL(safe);
    const { url } = config();
    if (parsed.origin !== new URL(url).origin) return "";
    pathname = decodeURIComponent(parsed.pathname);
  } catch { return ""; }
  const prefix = `/storage/v1/object/public/${BUCKET}/`;
  if (!pathname.startsWith(prefix)) return "";
  const path = pathname.slice(prefix.length);
  return OBJECT_PATTERN.test(path) ? path : "";
}

module.exports = {
  BUCKET,
  MAX_FILE_BYTES,
  FALLBACK_FILE_BYTES,
  OBJECT_PATTERN,
  createDjUpload,
  verifyUploadedDjMovie,
  deleteDjObject,
  objectPathFromPublicUrl
};
