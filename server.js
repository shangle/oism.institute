/**
 * OISM.institute — Local Laptop Sovereign Origin Server (server.js)
 * Runs on http://localhost:3848 (and via `cloudflared` tunnel for laptop-origin.oism.institute)
 * Automatically syncs minted credentials and voucher requests to `public/registry-snapshot.json`
 * and optionally calls local Ollama or deterministic Socratic Scribe Engine.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  INSTITUTION_TIERS,
  normalizeSerialId,
  toDisplaySerialId,
  inferInstitutionType,
  SCRIBE_SYSTEM_PROMPT,
  generateRuleBasedScribeReply
} = require("./scribe-core");

const PORT = process.env.PORT || 3848;
const PUBLIC_DIR = path.join(__dirname, "public");
const SNAPSHOT_FILE = path.join(PUBLIC_DIR, "registry-snapshot.json");

function readSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
    }
  } catch (e) {}
  return {
    schema_version: "1.0.0",
    updated_at: new Date().toISOString(),
    credentials: [],
    domain_quotas: {},
    voucher_requests: [],
    submissions: []
  };
}

function writeSnapshot(data) {
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "X-OISM-Node": "SOVEREIGN-LAPTOP-ORIGIN",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = url.pathname;

  // 1. Node Telemetry Endpoint
  if (pathname === "/api/telemetry" || pathname === "/ping") {
    return sendJson(res, 200, {
      ok: true,
      node: "ALPHA-ORIGIN",
      header: "SOVEREIGN-LAPTOP-ORIGIN",
      burn_rate_usd_yr: 6.18,
      timestamp: new Date().toISOString()
    });
  }

  // 2. Credential Verification Endpoint (/api/verify?id=...)
  if (pathname === "/api/verify") {
    const rawId = url.searchParams.get("id") || "OISM-2027-OMEGA-0001";
    const normId = normalizeSerialId(rawId);
    const snap = readSnapshot();
    const cred = (snap.credentials || []).find(
      (c) =>
        normalizeSerialId(c.serial_id) === normId ||
        c.recipient_name.toLowerCase() === rawId.trim().toLowerCase()
    );
    if (!cred) {
      return sendJson(res, 404, { ok: false, error: "Credential serial hash not found in Sovereign Registry." });
    }
    return sendJson(res, 200, { ok: true, credential: cred });
  }

  // 3. Domain Scarcity Quota Lookup (/api/voucher-quota?domain=...)
  if (pathname === "/api/voucher-quota") {
    const domain = (url.searchParams.get("domain") || "").trim().toLowerCase().replace(/^.*@/, "");
    if (!domain) {
      return sendJson(res, 400, { ok: false, error: "Domain parameter required." });
    }
    const snap = readSnapshot();
    if (!snap.domain_quotas) snap.domain_quotas = {};

    let q = snap.domain_quotas[domain];
    if (!q) {
      const instType = inferInstitutionType(domain);
      const tierInfo = INSTITUTION_TIERS[instType];
      q = {
        institution_domain: domain,
        institution_type: instType,
        discount_pct: tierInfo.discount_pct,
        max_codes: tierInfo.max_codes,
        claimed_codes: 0
      };
    }

    return sendJson(res, 200, {
      ok: true,
      domain: q.institution_domain,
      institution_type: q.institution_type,
      discount_pct: q.discount_pct,
      max_codes: q.max_codes,
      claimed_codes: q.claimed_codes,
      remaining_codes: Math.max(0, q.max_codes - q.claimed_codes)
    });
  }

  // 4. Institutional Voucher Request Submission (POST /api/voucher-request)
  if (pathname === "/api/voucher-request" && req.method === "POST") {
    const body = await parseBody(req);
    const applicantEmail = String(body.applicant_email || "").trim();
    const gatekeeperName = String(body.gatekeeper_name || "").trim();
    const gatekeeperEmail = String(body.gatekeeper_email || "").trim();
    const instDomain = (gatekeeperEmail.split("@")[1] || "").toLowerCase().trim();

    if (!applicantEmail || !gatekeeperEmail || !instDomain) {
      return sendJson(res, 400, { ok: false, error: "Applicant and Gatekeeper institutional emails are required." });
    }

    const snap = readSnapshot();
    if (!snap.domain_quotas) snap.domain_quotas = {};
    if (!snap.voucher_requests) snap.voucher_requests = [];

    const instType = inferInstitutionType(instDomain, body.institution_type);
    const tierInfo = INSTITUTION_TIERS[instType] || INSTITUTION_TIERS.CORP_HR;

    let quota = snap.domain_quotas[instDomain];
    if (!quota) {
      quota = {
        institution_domain: instDomain,
        institution_type: instType,
        discount_pct: tierInfo.discount_pct,
        max_codes: tierInfo.max_codes,
        claimed_codes: 0
      };
      snap.domain_quotas[instDomain] = quota;
    }

    if (quota.claimed_codes >= quota.max_codes) {
      return sendJson(res, 409, {
        ok: false,
        error: `QUOTA EXHAUSTED: All ${quota.max_codes} annual subsidy vouchers for @${instDomain} have already been claimed for the 2028 cycle.`
      });
    }

    const reqId = snap.voucher_requests.length + 1;
    const verifyToken = "oism-vk-" + crypto.randomBytes(8).toString("hex");
    const row = {
      id: reqId,
      applicant_email: applicantEmail,
      gatekeeper_name: gatekeeperName,
      gatekeeper_email: gatekeeperEmail,
      institution_domain: instDomain,
      institution_type: quota.institution_type,
      discount_pct: quota.discount_pct,
      voucher_code: null,
      verify_token: verifyToken,
      status: "PENDING_GATEKEEPER_VERIFICATION",
      created_at: new Date().toISOString()
    };

    snap.voucher_requests.unshift(row);
    writeSnapshot(snap);

    const verifyUrl = `/verify-voucher?token=${verifyToken}&domain=${encodeURIComponent(instDomain)}&tier=${encodeURIComponent(quota.institution_type)}`;
    return sendJson(res, 201, {
      ok: true,
      request_id: reqId,
      institution_domain: instDomain,
      discount_pct: quota.discount_pct,
      net_fee: Math.round(500 * (1 - quota.discount_pct / 100)),
      max_codes: quota.max_codes,
      remaining_codes: Math.max(0, quota.max_codes - quota.claimed_codes),
      verify_token: verifyToken,
      verify_url: verifyUrl
    });
  }

  // 5. Gatekeeper 1-Click Voucher Verification (POST /api/verify-voucher)
  if (pathname === "/api/verify-voucher" && req.method === "POST") {
    const body = await parseBody(req);
    const token = url.searchParams.get("token") || body.token || "";
    const snap = readSnapshot();
    const reqRow = (snap.voucher_requests || []).find((r) => r.verify_token === token);

    const instDomain = reqRow ? reqRow.institution_domain : (body.domain || "spartaschools.org").toLowerCase();
    const instType = reqRow ? reqRow.institution_type : inferInstitutionType(instDomain, body.tier);
    const tierInfo = INSTITUTION_TIERS[instType] || INSTITUTION_TIERS.TITLE1_HS;

    if (!snap.domain_quotas[instDomain]) {
      snap.domain_quotas[instDomain] = {
        institution_domain: instDomain,
        institution_type: instType,
        discount_pct: tierInfo.discount_pct,
        max_codes: tierInfo.max_codes,
        claimed_codes: 0
      };
    }

    const quota = snap.domain_quotas[instDomain];
    if (reqRow && reqRow.voucher_code) {
      return sendJson(res, 200, {
        ok: true,
        voucher_code: reqRow.voucher_code,
        discount_pct: reqRow.discount_pct,
        institution_domain: instDomain,
        remaining_codes: Math.max(0, quota.max_codes - quota.claimed_codes)
      });
    }

    if (quota.claimed_codes >= quota.max_codes) {
      return sendJson(res, 409, { ok: false, error: `Annual voucher quota for ${instDomain} is already exhausted.` });
    }

    const codeSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    const voucherCode = `OISM-${tierInfo.code_prefix}-${codeSuffix}`;
    quota.claimed_codes += 1;

    if (reqRow) {
      reqRow.voucher_code = voucherCode;
      reqRow.status = "VERIFIED_GOOD_STANDING";
    }
    writeSnapshot(snap);

    return sendJson(res, 200, {
      ok: true,
      voucher_code: voucherCode,
      discount_pct: quota.discount_pct,
      institution_domain: instDomain,
      remaining_codes: Math.max(0, quota.max_codes - quota.claimed_codes)
    });
  }

  // 6. Scribe Chancellor Support Bot (POST /api/support)
  if (pathname === "/api/support" && req.method === "POST") {
    const body = await parseBody(req);
    const userMessage = String(body.message || "").trim();
    const reply = generateRuleBasedScribeReply(userMessage);
    return sendJson(res, 200, {
      ok: true,
      engine: "SOVEREIGN-SOCRATIC-ENGINE",
      reply
    });
  }

  // 7. Admin: List Vouchers (GET /api/admin/vouchers)
  if (pathname === "/api/admin/vouchers") {
    const snap = readSnapshot();
    return sendJson(res, 200, {
      ok: true,
      vouchers: snap.voucher_requests || []
    });
  }

  // 8. Admin: Mint & Induct Cohort 2027 Credential (POST /api/admin/mint)
  if (pathname === "/api/admin/mint" && req.method === "POST") {
    const body = await parseBody(req);
    const requiredKey = process.env.ADMIN_MASTER_KEY;
    const providedKey = req.headers["x-admin-key"] || body.admin_key || "";
    if (requiredKey && providedKey !== requiredKey) {
      return sendJson(res, 403, { ok: false, error: "Invalid ADMIN_MASTER_KEY." });
    }

    const serialId = normalizeSerialId(body.serial_id || `OISM-2027-OMEGA-${String(Date.now()).slice(-4)}`);
    const recipientName = String(body.recipient_name || "").trim();
    if (!recipientName) {
      return sendJson(res, 400, { ok: false, error: "Recipient name required." });
    }

    const prefixes = String(body.prefixes || "Rev. Dr.").trim();
    const postNominals = String(body.post_nominals || "Ph.D. (h.c.), D.S.M., OMP, CSA, FOI").trim();
    const degreeTitle = String(body.degree_title || "Doctor of Philosophy in Sovereign Mastery (h.c.)").trim();
    const cohort = String(body.cohort || "October 2027 Founding Beta").trim();
    const issuedAt = body.issued_at || new Date().toISOString();
    const sha256Hash =
      body.sha256_hash ||
      crypto.createHash("sha256").update(`${serialId}|${recipientName}|${prefixes}|${postNominals}|${degreeTitle}`).digest("hex");

    const newCred = {
      serial_id: serialId,
      display_id: toDisplaySerialId(serialId),
      recipient_name: recipientName,
      prefixes,
      post_nominals: postNominals,
      full_formatted_title: `${prefixes ? prefixes + " " : ""}${recipientName}${postNominals ? ", " + postNominals : ""}`,
      degree_title: degreeTitle,
      cohort,
      status: "VERIFIED IN GOOD STANDING",
      issued_at: issuedAt,
      sha256_hash: sha256Hash
    };

    const snap = readSnapshot();
    if (!snap.credentials) snap.credentials = [];
    const idx = snap.credentials.findIndex((c) => normalizeSerialId(c.serial_id) === serialId);
    if (idx >= 0) {
      snap.credentials[idx] = newCred;
    } else {
      snap.credentials.push(newCred);
    }
    writeSnapshot(snap);

    return sendJson(res, 201, {
      ok: true,
      credential: newCred
    });
  }

  // 9. Static File Server from ./public
  let relPath = pathname === "/" ? "/index.html" : pathname;
  let filePath = path.join(PUBLIC_DIR, relPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "X-OISM-Node": "SOVEREIGN-LAPTOP-ORIGIN"
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback to index.html for SPA routes
  const indexHtml = path.join(PUBLIC_DIR, "index.html");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-OISM-Node": "SOVEREIGN-LAPTOP-ORIGIN"
  });
  fs.createReadStream(indexHtml).pipe(res);
});

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[OISM.institute] Sovereign Laptop Origin running at http://localhost:${PORT}`);
  });
}

module.exports = server;
