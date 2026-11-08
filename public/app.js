/**
 * OISM.institute — Client Application Controller
 * Handles:
 *  - Live Decentralised Scribe Node Telemetry (NODE: ALPHA-ORIGIN vs NODE: EDGE-REPLICA)
 *  - Live Countdown to October 1, 2028 00:00:00 UTC
 *  - Interactive Institutional Domain Scarcity Checker & Voucher Submission
 *  - Interactive "Unbridled Capitalism" Endowment Moon-Math Calculator & SVG/Canvas Chart
 *  - Public Credential Verification Registry (/verify) with static JSON fallback
 *  - Scribe Chancellor Bot Drawer
 */

(function () {
  let staticSnapshot = null;

  async function loadSnapshotFallback() {
    if (staticSnapshot) return staticSnapshot;
    try {
      const res = await fetch("/registry-snapshot.json", { cache: "no-store" });
      if (res.ok) {
        staticSnapshot = await res.json();
      }
    } catch (e) {}
    return staticSnapshot;
  }

  // 1. Node Telemetry Probe
  async function checkNodeTelemetry() {
    const dot = document.getElementById("node-dot");
    const label = document.getElementById("node-label");
    if (!dot || !label) return;

    try {
      const res = await fetch("/api/telemetry", { cache: "no-store" });
      const nodeHeader = res.headers.get("X-OISM-Node") || "";
      if (res.ok) {
        const data = await res.json();
        const isOrigin =
          data.node === "ALPHA-ORIGIN" ||
          nodeHeader.includes("LAPTOP") ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
        if (isOrigin) {
          dot.classList.remove("edge");
          label.textContent = "NODE: ALPHA-ORIGIN (SOVEREIGN LAPTOP)";
        } else {
          dot.classList.add("edge");
          label.textContent = "NODE: EDGE-REPLICA (CLOUDFLARE D1)";
        }
        return;
      }
    } catch (e) {}

    // Pure Static Fallback (GitHub Pages / Offline)
    dot.classList.add("edge");
    label.textContent = "NODE: EDGE-REPLICA (STATIC FAILOVER)";
  }

  // 2. Countdown to October 1, 2028 00:00:00 UTC
  function startCountdown() {
    const target = Date.UTC(2028, 9, 1, 0, 0, 0); // Month 9 is October
    const elDays = document.getElementById("cd-days");
    const elHours = document.getElementById("cd-hours");
    const elMins = document.getElementById("cd-mins");
    const elSecs = document.getElementById("cd-secs");
    if (!elDays) return;

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      elDays.textContent = String(days).padStart(3, "0");
      elHours.textContent = String(hours).padStart(2, "0");
      elMins.textContent = String(mins).padStart(2, "0");
      elSecs.textContent = String(secs).padStart(2, "0");
    }
    tick();
    setInterval(tick, 1000);
  }

  // 3. Interactive Domain Scarcity Checker
  async function checkDomainQuota(domainInput) {
    const out = document.getElementById("scarcity-result");
    if (!out) return;
    let domain = String(domainInput || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^.*@/, "")
      .split("/")[0];

    if (!domain || !domain.includes(".")) {
      out.innerHTML = `<span style="color:#FF4D00;font-weight:800;">INVALID DOMAIN:</span> Enter a school or corporate domain (e.g., <code>spartaschools.org</code>, <code>harvard.edu</code>, or <code>acme.com</code>).`;
      return;
    }

    out.innerHTML = `Querying Sovereign Quota Ledger for <strong>${domain}</strong>...`;

    let quotaData = null;
    try {
      const res = await fetch(`/api/voucher-quota?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        quotaData = await res.json();
      }
    } catch (e) {}

    if (!quotaData) {
      const snap = await loadSnapshotFallback();
      const existing = snap && snap.domain_quotas && snap.domain_quotas[domain];
      if (existing) {
        quotaData = {
          domain,
          institution_type: existing.institution_type,
          discount_pct: existing.discount_pct,
          max_codes: existing.max_codes,
          claimed_codes: existing.claimed_codes,
          remaining_codes: Math.max(0, existing.max_codes - existing.claimed_codes)
        };
      } else {
        const isHighSchool = domain.includes("k12") || domain.includes("schools") || domain.includes("high");
        const isEdu = domain.endsWith(".edu") || domain.includes("school");
        const isOrg = domain.endsWith(".org") || domain.endsWith(".institute");
        const max = isHighSchool ? 2 : isEdu ? 3 : isOrg ? 2 : 5;
        const disc = isHighSchool ? 90 : isEdu ? 50 : isOrg ? 35 : 10;
        quotaData = {
          domain,
          institution_type: isHighSchool ? "TITLE1_HS" : isEdu ? "STD_HS" : isOrg ? "NONPROFIT" : "CORP_HR",
          discount_pct: disc,
          max_codes: max,
          claimed_codes: 0,
          remaining_codes: max
        };
      }
    }

    const rem = quotaData.remaining_codes;
    const max = quotaData.max_codes;
    const disc = quotaData.discount_pct;
    const netFee = Math.round(500 * (1 - disc / 100));

    out.innerHTML = `
      <div style="color:#FF4D00;font-weight:800;margin-bottom:6px;">
        ⚠️ SCARCITY ALERT: Only ${rem} of ${max} Institutional Vouchers remaining for [${domain}] for the 2028 Cycle.
      </div>
      <div>
        • <strong>Eligible Subsidy Tier:</strong> ${disc}% OFF ($${netFee}.00 Net Cover Charge vs. $500.00 Base)<br>
        • <strong>Directive:</strong> Request allocation below before your peers claim the remaining ${rem} slot(s).
      </div>
    `;

    // Pre-fill domain into voucher request form if empty
    const gatekeeperEmail = document.getElementById("vf-gatekeeper-email");
    if (gatekeeperEmail && !gatekeeperEmail.value) {
      gatekeeperEmail.placeholder = `counselor@${domain} or hr@${domain}`;
    }
  }

  // 4. Institutional Voucher Submission Form
  function initVoucherForm() {
    const btnCheck = document.getElementById("btn-check-domain");
    const inputDomain = document.getElementById("scarcity-domain-input");
    if (btnCheck && inputDomain) {
      btnCheck.addEventListener("click", () => checkDomainQuota(inputDomain.value));
      inputDomain.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          checkDomainQuota(inputDomain.value);
        }
      });
    }

    document.querySelectorAll(".quick-domain-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.getAttribute("data-domain");
        if (inputDomain) inputDomain.value = d;
        checkDomainQuota(d);
      });
    });

    const form = document.getElementById("voucher-request-form");
    const statusBox = document.getElementById("voucher-submit-status");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        applicant_email: document.getElementById("vf-applicant-email").value.trim(),
        gatekeeper_name: document.getElementById("vf-gatekeeper-name").value.trim(),
        gatekeeper_email: document.getElementById("vf-gatekeeper-email").value.trim(),
        institution_type: document.getElementById("vf-tier").value
      };

      statusBox.style.display = "block";
      statusBox.innerHTML = `Transmitting Sovereign Subsidy Requisition to D1 Edge Ledger...`;

      try {
        const res = await fetch("/api/voucher-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          statusBox.innerHTML = `
            <div style="color:#008037;font-weight:800;margin-bottom:6px;">
              ✓ REQUISITION LOGGED IN SOVEREIGN D1 LEDGER (ID #${data.request_id})
            </div>
            <div>
              • <strong>Institution Domain:</strong> <code>${data.institution_domain}</code> (${data.remaining_codes} of ${data.max_codes} slots left)<br>
              • <strong>Subsidy Tier:</strong> ${data.discount_pct}% OFF ($${data.net_fee}.00 Net Cover Charge)<br>
              • <strong>Gatekeeper Verification Link:</strong> <a href="${data.verify_url}" target="_blank">Click to Preview Counselor/HR 1-Click Confirmation Page</a>
            </div>
          `;
          return;
        } else {
          statusBox.innerHTML = `<span style="color:#FF4D00;font-weight:800;">QUOTA / VALIDATION REJECTION:</span> ${data.error || "Unable to allocate code."}`;
          return;
        }
      } catch (err) {
        // Static Fallback simulation when offline
        const domain = (payload.gatekeeper_email.split("@")[1] || "institution.edu").toLowerCase();
        const mockToken = "oism-stat-" + Math.random().toString(36).slice(2, 10);
        const verifyUrl = `/verify-voucher?token=${mockToken}&domain=${encodeURIComponent(domain)}&tier=${encodeURIComponent(payload.institution_type)}`;
        statusBox.innerHTML = `
          <div style="color:#002FA7;font-weight:800;margin-bottom:6px;">
            ✓ REQUISITION STAGED ON EDGE REPLICA (${domain})
          </div>
          <div>
            • <strong>Gatekeeper 1-Click Release Link:</strong> <a href="${verifyUrl}">Open Counselor/HR Verification Portal</a>
          </div>
        `;
      }
    });
  }

  // 5. Endowment Moon-Math Calculator & Interactive Chart
  function initMoonMathTerminal() {
    const sApplicants = document.getElementById("slider-applicants");
    const sFellows = document.getElementById("slider-fellows");
    const sDiscount = document.getElementById("slider-avg-cover");

    const vApplicants = document.getElementById("val-applicants");
    const vFellows = document.getElementById("val-fellows");
    const vCover = document.getElementById("val-avg-cover");

    const outAnnualRev = document.getElementById("out-annual-rev");
    const outEfficiency = document.getElementById("out-efficiency");
    const outYr10Endowment = document.getElementById("out-yr10-endowment");
    const outPerFellow = document.getElementById("out-per-fellow");
    const canvas = document.getElementById("moon-chart-canvas");

    if (!sApplicants || !sFellows || !canvas) return;

    function formatUSD(n) {
      if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return "$" + Math.round(n).toLocaleString();
      return "$" + n.toFixed(2);
    }

    function updateCalculation() {
      const applicants = parseInt(sApplicants.value, 10);
      const fellows = parseInt(sFellows.value, 10);
      const avgCover = sDiscount ? parseInt(sDiscount.value, 10) : 385;
      const overhead = 6.18; // Locked $6.18/yr Namecheap .institute + $0.00 Cloudflare

      vApplicants.textContent = applicants.toLocaleString() + " Applicants";
      vFellows.textContent = fellows.toLocaleString() + " Fellows";
      if (vCover) vCover.textContent = "$" + avgCover + " Weighted Avg";

      const coverRev = applicants * avgCover;
      const tuitionRev = fellows * 43800;
      const grossRev = coverRev + tuitionRev;
      const netRev = Math.max(0, grossRev - overhead);
      const efficiency = grossRev > 0 ? ((netRev / grossRev) * 100).toFixed(5) : "99.98000";

      // 10-year compounding at 14.5% Sovereign Asymmetric Allocation yield
      const r = 0.145;
      const seriesOismPerStudent = [];
      let cumulativeEndowment = 0;
      for (let yr = 1; yr <= 10; yr++) {
        cumulativeEndowment = (cumulativeEndowment + netRev) * (1 + r);
        seriesOismPerStudent.push(cumulativeEndowment / Math.max(1, fellows));
      }

      const yr10Total = cumulativeEndowment;
      const yr10PerFellow = yr10Total / Math.max(1, fellows);

      outAnnualRev.textContent = formatUSD(grossRev) + "/yr";
      outEfficiency.textContent = efficiency + "%";
      outYr10Endowment.textContent = formatUSD(yr10Total);
      outPerFellow.textContent = formatUSD(yr10PerFellow) + "/fellow";

      drawMoonChart(canvas, seriesOismPerStudent);
    }

    function drawMoonChart(c, oismPerStudentSeries) {
      const ctx = c.getContext("2d");
      const w = (c.width = 680);
      const h = (c.height = 340);

      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, w, h);

      const padL = 78;
      const padR = 28;
      const padT = 32;
      const padB = 46;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // Benchmarks per student:
      // Princeton Theological Seminary: $5.15M / student
      // Harvard University: ~$2.20M / student ($55.67B / ~25,200 students)
      const ptsBench = 5154575;
      const harvardBench = 2200000;
      const maxVal = Math.max(ptsBench * 1.25, ...oismPerStudentSeries);

      // Grid lines
      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 1;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#888";
      ctx.textAlign = "right";

      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH * i) / 4;
        const val = maxVal * (1 - i / 4);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(formatUSD(val), padL - 10, y + 4);
      }

      // Benchmark Line 1: Princeton Theological ($5.15M/student)
      const yPts = padT + plotH * (1 - ptsBench / maxVal);
      ctx.strokeStyle = "#FF4D00";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padL, yPts);
      ctx.lineTo(w - padR, yPts);
      ctx.stroke();
      ctx.fillStyle = "#FF4D00";
      ctx.textAlign = "left";
      ctx.fillText("PRINCETON THEOLOGICAL ($5.15M / STUDENT)", padL + 8, yPts - 6);

      // Benchmark Line 2: Harvard ($2.20M/student)
      const yHarv = padT + plotH * (1 - harvardBench / maxVal);
      ctx.strokeStyle = "#5588FF";
      ctx.beginPath();
      ctx.moveTo(padL, yHarv);
      ctx.lineTo(w - padR, yHarv);
      ctx.stroke();
      ctx.fillStyle = "#5588FF";
      ctx.fillText("HARVARD (~$2.20M / STUDENT, -$113M DEFICIT)", padL + 8, yHarv - 6);
      ctx.setLineDash([]);

      // OISM Compounding Curve
      ctx.strokeStyle = "#C5A059";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      oismPerStudentSeries.forEach((val, idx) => {
        const x = padL + (plotW * idx) / 9;
        const y = padT + plotH * (1 - val / maxVal);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Points & Year Labels
      ctx.textAlign = "center";
      oismPerStudentSeries.forEach((val, idx) => {
        const x = padL + (plotW * idx) / 9;
        const y = padT + plotH * (1 - val / maxVal);

        ctx.fillStyle = "#00C853";
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#999";
        ctx.fillText(`Y${idx + 1}`, x, h - 16);
      });
    }

    sApplicants.addEventListener("input", updateCalculation);
    sFellows.addEventListener("input", updateCalculation);
    if (sDiscount) sDiscount.addEventListener("input", updateCalculation);
    updateCalculation();
  }

  // 6. Public Credential Verification Registry (/verify)
  let currentVerifiedCred = null;

  async function verifyCredentialId(rawId) {
    const out = document.getElementById("verify-dossier-container");
    if (!out) return;

    const cleanInput = String(rawId || "OISM-2027-Ω-0001").trim();
    const normalized = cleanInput.toUpperCase().replace(/Ω/g, "OMEGA");

    out.innerHTML = `<div style="font-family:var(--font-mono);padding:18px;">Querying Sovereign Cryptographic Registry for <strong>${cleanInput}</strong>...</div>`;

    let cred = null;
    try {
      const res = await fetch(`/api/verify?id=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.credential) cred = data.credential;
      }
    } catch (e) {}

    if (!cred) {
      const snap = await loadSnapshotFallback();
      if (snap && Array.isArray(snap.credentials)) {
        cred = snap.credentials.find(
          (c) =>
            c.serial_id.toUpperCase() === normalized ||
            (c.display_id && c.display_id.toUpperCase() === cleanInput.toUpperCase()) ||
            c.recipient_name.toLowerCase() === cleanInput.toLowerCase()
        );
      }
    }

    if (!cred) {
      out.innerHTML = `
        <div class="dossier-output" style="border-color:#FF4D00;background:#FFF5F0;">
          <div style="font-family:var(--font-mono);color:#FF4D00;font-weight:800;font-size:15px;">
            ✗ UNRECOGNIZED SERIAL HASH: [${cleanInput}]
          </div>
          <p style="margin-top:8px;font-family:var(--font-mono);font-size:12.5px;">
            No active Sovereign Fellow dossier matched that serial ID. Try the Founding Chancellor's genesis credential:
            <code>OISM-2027-Ω-0001</code>
          </p>
        </div>
      `;
      return;
    }

    currentVerifiedCred = cred;
    const displaySerial = (cred.display_id || cred.serial_id).replace(/-OMEGA-/g, "-Ω-");
    const fullStack = `${cred.prefixes || "Rev. Dr."} ${cred.recipient_name}, ${cred.post_nominals || "Ph.D. (h.c.), D.S.M., OMP, CSA, FOI"}`;

    out.innerHTML = `
      <div class="dossier-output">
        <div class="dossier-seal-header">
          <div>
            <div style="font-family:var(--font-mono);font-size:11px;color:#002FA7;font-weight:700;">
              OMEGA INSTITUTUM DOMINII SUPREMI // PUBLIC VERIFICATION LEDGER
            </div>
            <h3 style="font-family:var(--font-classical);font-size:1.65rem;margin-top:4px;">
              ${fullStack}
            </h3>
          </div>
          <div class="status-verified-pill">
            ✓ ${cred.status || "VERIFIED IN GOOD STANDING"}
          </div>
        </div>

        <div class="dossier-grid">
          <div class="dossier-field">
            <div class="dossier-label">Credential Serial Number</div>
            <div class="dossier-val">${displaySerial} <span style="color:#666;font-weight:400;">(${cred.serial_id})</span></div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Cohort & Induction Window</div>
            <div class="dossier-val">${cred.cohort}</div>
          </div>
          <div class="dossier-field full">
            <div class="dossier-label">Conferred Honoris Causa & Clerical Designation</div>
            <div class="dossier-val" style="color:#002FA7;font-size:14.5px;">${cred.degree_title}</div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Timestamp of Investiture</div>
            <div class="dossier-val">${cred.issued_at}</div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Issuing Authority</div>
            <div class="dossier-val">Clerical Order of the Unburned Library & Sovereign Endowment</div>
          </div>
          <div class="dossier-field full">
            <div class="dossier-label">Cryptographic SHA-256 Registry Digest</div>
            <div class="dossier-val" style="font-size:11.5px;color:#333;">${cred.sha256_hash}</div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
          <div style="font-family:var(--font-mono);font-size:11px;color:#555;">
            Statutory Compliance: Honorary philosophical & clerical title (MCL 390.1601–390.1605).
          </div>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn-brutal secondary" id="btn-preview-diploma" style="padding:10px 16px;font-size:11.5px;">
              📜 RENDER 11"×8.5" ARCHIVAL DIPLOMA
            </button>
            <button type="button" class="btn-brutal" id="btn-print-diploma" style="padding:10px 16px;font-size:11.5px;">
              🖨️ PRINT / EXPORT PDF DIPLOMA
            </button>
          </div>
        </div>

        <div id="inline-diploma-preview-wrap" style="display:none;margin-top:22px;border-top:2px solid #0A0A0A;padding-top:18px;text-align:center;">
          <canvas id="inline-diploma-canvas" style="width:100%;max-width:860px;height:auto;border:2px solid #0A0A0A;box-shadow:6px 6px 0px #0A0A0A;"></canvas>
        </div>
      </div>
    `;

    const btnPreview = document.getElementById("btn-preview-diploma");
    const btnPrint = document.getElementById("btn-print-diploma");
    const previewWrap = document.getElementById("inline-diploma-preview-wrap");
    const previewCanvas = document.getElementById("inline-diploma-canvas");

    if (btnPreview && previewWrap && previewCanvas) {
      btnPreview.addEventListener("click", () => {
        previewWrap.style.display = "block";
        window.OISMDiploma.drawArchivalDiplomaCanvas(previewCanvas, currentVerifiedCred);
      });
    }
    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        window.OISMDiploma.openPrintReadyPDFWindow(currentVerifiedCred);
      });
    }
  }

  function initVerifyRegistry() {
    const input = document.getElementById("verify-serial-input");
    const btn = document.getElementById("btn-verify-serial");
    if (!input || !btn) return;

    btn.addEventListener("click", () => verifyCredentialId(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        verifyCredentialId(input.value);
      }
    });

    // Check URL query parameter ?id=... or #verify
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("id");
    if (idFromUrl) {
      input.value = idFromUrl;
      verifyCredentialId(idFromUrl);
      const sec = document.getElementById("verify");
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
    } else {
      verifyCredentialId("OISM-2027-Ω-0001");
    }
  }

  // 7. Scribe Chancellor Bot Drawer
  function initScribeBot() {
    const fab = document.getElementById("scribe-fab");
    const drawer = document.getElementById("scribe-drawer");
    const closeBtn = document.getElementById("scribe-close");
    const messagesEl = document.getElementById("scribe-messages");
    const inputEl = document.getElementById("scribe-input");
    const sendBtn = document.getElementById("scribe-send");

    if (!fab || !drawer) return;

    fab.addEventListener("click", () => drawer.classList.toggle("open"));
    if (closeBtn) closeBtn.addEventListener("click", () => drawer.classList.remove("open"));

    function appendMessage(role, text) {
      const div = document.createElement("div");
      div.className = `msg-bubble ${role}`;
      div.innerHTML = String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function sendPrompt(promptText) {
      const q = String(promptText || inputEl.value || "").trim();
      if (!q) return;
      inputEl.value = "";
      appendMessage("user", q);

      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q })
        });
        if (res.ok) {
          const data = await res.json();
          appendMessage("bot", data.reply);
          return;
        }
      } catch (e) {}

      // Client-side deterministic fallback if static-only
      appendMessage(
        "bot",
        `In 399 BCE, Socrates declared (*Plato's Apology* 32a) that *"he who will fight for the right, if he would live even for a little while, must have a private station and not a public one."*\n\n• **Cohort 2027 (Founding Beta):** 100% LOCKED — By Sovereign Invitation Only.\n• **Cohort 2028 Public Drop:** Oct 1 – Oct 31, 2028 (<0.0004% Admission Odds).\n• **Tuition Math:** 12 mins/day × 365 days = 4,380 mins/yr @ $10.00/min = **$43,800/yr**.\n• **Fee Relief:** Have your High School Guidance Counselor or Corporate HR Director verify your standing in Section 3 to unlock a 10%–90% subsidy code.`
      );
    }

    if (sendBtn) sendBtn.addEventListener("click", () => sendPrompt());
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendPrompt();
        }
      });
    }

    document.querySelectorAll(".chip-btn").forEach((chip) => {
      chip.addEventListener("click", () => {
        sendPrompt(chip.getAttribute("data-prompt"));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    checkNodeTelemetry();
    startCountdown();
    initVoucherForm();
    initMoonMathTerminal();
    initVerifyRegistry();
    initScribeBot();
    checkDomainQuota("spartaschools.org");
  });
})();
