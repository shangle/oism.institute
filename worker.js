/**
 * OISM.institute — Cloudflare Edge Failover Router + D1 Serverless API + Email Worker
 *
 * 1. Handles all `/api/*` routes at the Cloudflare Edge using D1 + Workers AI (`@cf/meta/llama-3.1-8b-instruct`).
 * 2. Probes `LAPTOP_TUNNEL_URL` (`https://laptop-origin.oism.institute`) with a 1500ms timeout.
 * 3. Transparently fails over in 0ms to Cloudflare Static Assets (`env.ASSETS`) or GitHub Pages mirror
 *    the instant the laptop closes or disconnects.
 * 4. Includes an inbound `email()` handler for `admissions@`, `counselors@`, `endowment@`, and `verify@oism.institute`.
 */

import {
  INSTITUTION_TIERS,
  normalizeSerialId,
  toDisplaySerialId,
  inferInstitutionType,
  SCRIBE_SYSTEM_PROMPT,
  generateRuleBasedScribeReply
} from "./scribe-core.js";

function jsonResponse(payload, status = 200, nodeHeader = "SOVEREIGN-EDGE-API") {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
      "X-OISM-Node": nodeHeader
    }
  });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleEdgeApi(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. Telemetry Probe (/api/telemetry)
  if (pathname === "/api/telemetry") {
    // Quickly check if laptop origin is reachable
    if (env.LAPTOP_TUNNEL_URL) {
      try {
        const probe = await fetch(new URL("/ping", env.LAPTOP_TUNNEL_URL), {
          signal: AbortSignal.timeout(1200)
        });
        if (probe.ok) {
          return jsonResponse({ ok: true, node: "ALPHA-ORIGIN", burn_rate_usd_yr: 6.18 }, 200, "SOVEREIGN-LAPTOP-ORIGIN");
        }
      } catch (e) {}
    }
    return jsonResponse({ ok: true, node: "EDGE-REPLICA", burn_rate_usd_yr: 6.18 }, 200, "SOVEREIGN-EDGE-STATIC-FAILOVER");
  }

  // 2. Credential Verification (/api/verify?id=...)
  if (pathname === "/api/verify") {
    const rawId = url.searchParams.get("id") || "OISM-2027-OMEGA-0001";
    const normId = normalizeSerialId(rawId);

    if (env.DB) {
      try {
        const row = await env.DB.prepare(
          "SELECT * FROM credentials WHERE UPPER(serial_id) = ? OR LOWER(recipient_name) = ? LIMIT 1"
        )
          .bind(normId, rawId.trim().toLowerCase())
          .first();
        if (row) {
          row.display_id = toDisplaySerialId(row.serial_id);
          row.full_formatted_title = `${row.prefixes ? row.prefixes + " " : ""}${row.recipient_name}${row.post_nominals ? ", " + row.post_nominals : ""}`;
          return jsonResponse({ ok: true, credential: row });
        }
      } catch (e) {}
    }

    // Fallback to static registry-snapshot.json in ASSETS
    if (env.ASSETS) {
      try {
        const snapRes = await env.ASSETS.fetch(new URL("/registry-snapshot.json", request.url));
        if (snapRes.ok) {
          const snap = await snapRes.json();
          const found = (snap.credentials || []).find(
            (c) =>
              normalizeSerialId(c.serial_id) === normId ||
              c.recipient_name.toLowerCase() === rawId.trim().toLowerCase()
          );
          if (found) {
            return jsonResponse({ ok: true, credential: found });
          }
        }
      } catch (e) {}
    }

    return jsonResponse({ ok: false, error: "Credential not found in Sovereign Registry." }, 404);
  }

  // 3. Domain Scarcity Quota Lookup (/api/voucher-quota?domain=...)
  if (pathname === "/api/voucher-quota") {
    const domain = (url.searchParams.get("domain") || "").trim().toLowerCase().replace(/^.*@/, "");
    if (!domain) {
      return jsonResponse({ ok: false, error: "Domain parameter required." }, 400);
    }

    if (env.DB) {
      try {
        const row = await env.DB.prepare("SELECT * FROM domain_quotas WHERE institution_domain = ?")
          .bind(domain)
          .first();
        if (row) {
          return jsonResponse({
            ok: true,
            domain: row.institution_domain,
            institution_type: row.institution_type,
            discount_pct: row.discount_pct,
            max_codes: row.max_codes,
            claimed_codes: row.claimed_codes,
            remaining_codes: Math.max(0, row.max_codes - row.claimed_codes)
          });
        }
      } catch (e) {}
    }

    const instType = inferInstitutionType(domain);
    const tier = INSTITUTION_TIERS[instType];
    return jsonResponse({
      ok: true,
      domain,
      institution_type: instType,
      discount_pct: tier.discount_pct,
      max_codes: tier.max_codes,
      claimed_codes: 0,
      remaining_codes: tier.max_codes
    });
  }

  // 4. Institutional Voucher Request (POST /api/voucher-request)
  if (pathname === "/api/voucher-request" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const applicantEmail = String(body.applicant_email || "").trim();
    const gatekeeperName = String(body.gatekeeper_name || "").trim();
    const gatekeeperEmail = String(body.gatekeeper_email || "").trim();
    const instDomain = (gatekeeperEmail.split("@")[1] || "").toLowerCase().trim();

    if (!applicantEmail || !gatekeeperEmail || !instDomain) {
      return jsonResponse({ ok: false, error: "Applicant and Gatekeeper emails required." }, 400);
    }

    const instType = inferInstitutionType(instDomain, body.institution_type);
    const tier = INSTITUTION_TIERS[instType] || INSTITUTION_TIERS.CORP_HR;
    const verifyToken = "oism-vk-" + crypto.randomUUID().slice(0, 12);
    let maxCodes = tier.max_codes;
    let claimedCodes = 0;
    let discountPct = tier.discount_pct;
    let requestId = Math.floor(Date.now() / 1000);

    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO domain_quotas (institution_domain, institution_type, discount_pct, max_codes, claimed_codes) VALUES (?, ?, ?, ?, 0)"
        )
          .bind(instDomain, instType, tier.discount_pct, tier.max_codes)
          .run();

        const qRow = await env.DB.prepare("SELECT * FROM domain_quotas WHERE institution_domain = ?")
          .bind(instDomain)
          .first();

        if (qRow) {
          maxCodes = qRow.max_codes;
          claimedCodes = qRow.claimed_codes;
          discountPct = qRow.discount_pct;
          if (claimedCodes >= maxCodes) {
            return jsonResponse(
              { ok: false, error: `QUOTA EXHAUSTED: All ${maxCodes} annual vouchers for @${instDomain} have been claimed.` },
              409
            );
          }
        }

        const insertRes = await env.DB.prepare(
          "INSERT INTO voucher_requests (applicant_email, gatekeeper_name, gatekeeper_email, institution_domain, institution_type, discount_pct, verify_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_GATEKEEPER_VERIFICATION')"
        )
          .bind(applicantEmail, gatekeeperName, gatekeeperEmail, instDomain, instType, discountPct, verifyToken)
          .run();

        if (insertRes && insertRes.meta && insertRes.meta.last_row_id) {
          requestId = insertRes.meta.last_row_id;
        }
      } catch (e) {}
    }

    const verifyUrl = `/verify-voucher?token=${verifyToken}&domain=${encodeURIComponent(instDomain)}&tier=${encodeURIComponent(instType)}`;
    return jsonResponse(
      {
        ok: true,
        request_id: requestId,
        institution_domain: instDomain,
        discount_pct: discountPct,
        net_fee: Math.round(500 * (1 - discountPct / 100)),
        max_codes: maxCodes,
        remaining_codes: Math.max(0, maxCodes - claimedCodes),
        verify_token: verifyToken,
        verify_url: verifyUrl
      },
      201
    );
  }

  // 5. Gatekeeper 1-Click Verification (POST /api/verify-voucher)
  if (pathname === "/api/verify-voucher" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const token = url.searchParams.get("token") || body.token || "";
    const fallbackDomain = (body.domain || "spartaschools.org").toLowerCase();
    const fallbackTier = inferInstitutionType(fallbackDomain, body.tier);
    const tierInfo = INSTITUTION_TIERS[fallbackTier] || INSTITUTION_TIERS.TITLE1_HS;
    const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
    const generatedCode = `OISM-${tierInfo.code_prefix}-${suffix}`;

    if (env.DB && token) {
      try {
        const reqRow = await env.DB.prepare("SELECT * FROM voucher_requests WHERE verify_token = ? LIMIT 1")
          .bind(token)
          .first();

        if (reqRow) {
          if (reqRow.voucher_code) {
            return jsonResponse({
              ok: true,
              voucher_code: reqRow.voucher_code,
              discount_pct: reqRow.discount_pct,
              institution_domain: reqRow.institution_domain,
              remaining_codes: 1
            });
          }

          await env.DB.prepare(
            "UPDATE domain_quotas SET claimed_codes = claimed_codes + 1 WHERE institution_domain = ? AND claimed_codes < max_codes"
          )
            .bind(reqRow.institution_domain)
            .run();

          await env.DB.prepare(
            "UPDATE voucher_requests SET voucher_code = ?, status = 'VERIFIED_GOOD_STANDING' WHERE id = ?"
          )
            .bind(generatedCode, reqRow.id)
            .run();

          const qRow = await env.DB.prepare("SELECT * FROM domain_quotas WHERE institution_domain = ?")
            .bind(reqRow.institution_domain)
            .first();

          return jsonResponse({
            ok: true,
            voucher_code: generatedCode,
            discount_pct: reqRow.discount_pct,
            institution_domain: reqRow.institution_domain,
            remaining_codes: qRow ? Math.max(0, qRow.max_codes - qRow.claimed_codes) : 1
          });
        }
      } catch (e) {}
    }

    return jsonResponse({
      ok: true,
      voucher_code: generatedCode,
      discount_pct: tierInfo.discount_pct,
      institution_domain: fallbackDomain,
      remaining_codes: Math.max(0, tierInfo.max_codes - 1)
    });
  }

  // 6. Scribe Chancellor Support Bot (POST /api/support)
  if (pathname === "/api/support" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const userMessage = String(body.message || "").trim();

    if (env.AI && userMessage) {
      try {
        const aiRes = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: SCRIBE_SYSTEM_PROMPT },
            { role: "user", content: userMessage }
          ],
          max_tokens: 280
        });
        if (aiRes && aiRes.response) {
          return jsonResponse({
            ok: true,
            engine: "WORKERS-AI-LLAMA-3.1-8B",
            reply: aiRes.response
          });
        }
      } catch (e) {}
    }

    return jsonResponse({
      ok: true,
      engine: "DETERMINISTIC-SOCRATIC-FALLBACK",
      reply: generateRuleBasedScribeReply(userMessage)
    });
  }

  // 7. Admin: List Vouchers (GET /api/admin/vouchers)
  if (pathname === "/api/admin/vouchers") {
    if (env.DB) {
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM voucher_requests ORDER BY id DESC LIMIT 50"
        ).all();
        return jsonResponse({ ok: true, vouchers: results || [] });
      } catch (e) {}
    }
    return jsonResponse({ ok: true, vouchers: [] });
  }

  // 8. Admin: Mint & Induct Cohort 2027 Credential (POST /api/admin/mint)
  if (pathname === "/api/admin/mint" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const providedKey = request.headers.get("X-Admin-Key") || body.admin_key || "";
    if (env.ADMIN_MASTER_KEY && providedKey !== env.ADMIN_MASTER_KEY) {
      return jsonResponse({ ok: false, error: "Invalid ADMIN_MASTER_KEY." }, 403);
    }

    const serialId = normalizeSerialId(body.serial_id || `OISM-2027-OMEGA-${String(Date.now()).slice(-4)}`);
    const recipientName = String(body.recipient_name || "").trim();
    const prefixes = String(body.prefixes || "Rev. Dr.").trim();
    const postNominals = String(body.post_nominals || "Ph.D. (h.c.), D.S.M., OMP, CSA, FOI").trim();
    const degreeTitle = String(body.degree_title || "Doctor of Philosophy in Sovereign Mastery (h.c.)").trim();
    const cohort = String(body.cohort || "October 2027 Founding Beta").trim();
    const issuedAt = body.issued_at || new Date().toISOString();
    const sha256Hash =
      body.sha256_hash ||
      (await sha256Hex(`${serialId}|${recipientName}|${prefixes}|${postNominals}|${degreeTitle}`));

    if (env.DB) {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO credentials (serial_id, recipient_name, prefixes, post_nominals, degree_title, cohort, status, issued_at, sha256_hash) VALUES (?, ?, ?, ?, ?, ?, 'VERIFIED IN GOOD STANDING', ?, ?)"
      )
        .bind(serialId, recipientName, prefixes, postNominals, degreeTitle, cohort, issuedAt, sha256Hash)
        .run();
    }

    // Optional GitHub Repository Dispatch webhook to snapshot into GitHub Pages
    if (env.GITHUB_DISPATCH_TOKEN && env.GITHUB_REPO) {
      ctx.waitUntil(
        fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "OISM-Sovereign-Edge-Worker"
          },
          body: JSON.stringify({
            event_type: "mint_credential",
            client_payload: {
              serial_id: serialId,
              recipient_name: recipientName,
              prefixes,
              post_nominals: postNominals,
              degree_title: degreeTitle,
              cohort,
              issued_at: issuedAt,
              sha256_hash: sha256Hash
            }
          })
        }).catch(() => {})
      );
    }

    return jsonResponse(
      {
        ok: true,
        credential: {
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
        }
      },
      201
    );
  }

  return jsonResponse({ ok: false, error: "Unknown Sovereign API route." }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Always handle API routes (/api/*) at the Cloudflare Edge using D1 + Workers AI
    if (url.pathname.startsWith("/api/")) {
      return handleEdgeApi(request, env, ctx);
    }

    // 2. Try Laptop Origin via Cloudflare Tunnel first (1500ms timeout)
    // Guard against infinite loop if request is already targeting laptop-origin
    if (
      env.LAPTOP_TUNNEL_URL &&
      !url.hostname.startsWith("laptop-origin.") &&
      !request.headers.get("X-OISM-Probe")
    ) {
      try {
        const laptopUrl = new URL(url.pathname + url.search, env.LAPTOP_TUNNEL_URL);
        const originReq = new Request(laptopUrl, request);
        originReq.headers.set("X-Forwarded-Host", url.host);
        originReq.headers.set("X-OISM-Probe", "1");

        const response = await fetch(originReq, {
          signal: AbortSignal.timeout(1500)
        });

        // Only pass through when the local origin server explicitly sets X-OISM-Node or returns 200
        if (response.ok && response.headers.get("X-OISM-Node") === "SOVEREIGN-LAPTOP-ORIGIN") {
          const res = new Response(response.body, response);
          res.headers.set("X-OISM-Node", "SOVEREIGN-LAPTOP-ORIGIN");
          return res;
        }
      } catch (err) {
        // Laptop offline or timed out; proceed immediately to static edge failover
      }
    }

    // 3. Seamless Failover to Static Build (Cloudflare Assets or GitHub Pages Mirror)
    if (env.ASSETS) {
      const staticRes = await env.ASSETS.fetch(request);
      const failoverRes = new Response(staticRes.body, staticRes);
      failoverRes.headers.set("X-OISM-Node", "SOVEREIGN-EDGE-STATIC-FAILOVER");
      return failoverRes;
    }

    if (env.GITHUB_PAGES_MIRROR_URL) {
      const mirrorUrl = new URL(url.pathname + url.search, env.GITHUB_PAGES_MIRROR_URL);
      const mirrorRes = await fetch(mirrorUrl);
      const failoverRes = new Response(mirrorRes.body, mirrorRes);
      failoverRes.headers.set("X-OISM-Node", "SOVEREIGN-GITHUB-PAGES-FAILOVER");
      return failoverRes;
    }

    return new Response("OISM Edge Node Active", { status: 200 });
  },

  // 4. Automated Inbound Email Worker (admissions@, counselors@, endowment@, verify@oism.institute)
  async email(message, env, ctx) {
    const from = message.from || "unknown";
    const to = message.to || "admissions@oism.institute";
    const subject = message.headers.get("subject") || "(No Subject)";

    if (env.DB) {
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO submissions (submission_type, email, payload_json) VALUES ('INBOUND_EMAIL', ?, ?)"
        )
          .bind(from, JSON.stringify({ to, subject, received_at: new Date().toISOString() }))
          .run()
          .catch(() => {})
      );
    }

    if (env.FORWARD_TO_EMAIL) {
      await message.forward(env.FORWARD_TO_EMAIL);
    }
  }
};
