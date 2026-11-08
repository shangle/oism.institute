/**
 * OISM.institute — Client Application Controller
 * Institutional Seminary & Executive Education Edition
 */

(function () {
  const BASE_PATH = window.location.pathname.startsWith("/oism.institute") ? "/oism.institute" : "";
  let staticSnapshot = null;

  async function loadSnapshotFallback() {
    if (staticSnapshot) return staticSnapshot;
    try {
      const res = await fetch(`${BASE_PATH}/registry-snapshot.json`, { cache: "no-store" });
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
          label.textContent = "Registry Node: Primary Campus Origin (Online)";
        } else {
          dot.classList.add("edge");
          label.textContent = "Registry Node: Distributed Edge Archive (D1)";
        }
        return;
      }
    } catch (e) {}

    dot.classList.add("edge");
    label.textContent = "Registry Node: Distributed Archival Mirror";
  }

  // 2. Countdown to October 1, 2028 00:00:00 UTC
  function startCountdown() {
    const target = Date.UTC(2028, 9, 1, 0, 0, 0);
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
      out.innerHTML = `<strong style="color:#8B1E24;">Notice:</strong> Please enter a valid school, seminary, or corporate domain (e.g., <code>spartaschools.org</code>, <code>harvard.edu</code>, or <code>acme.com</code>).`;
      return;
    }

    out.innerHTML = `Consulting Registrar Allocation Ledger for <strong>${domain}</strong>...`;

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
        const isOrg = domain.endsWith(".org") || domain.includes("seminary") || domain.endsWith(".institute");
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
      <div style="color:#8B1E24;font-weight:700;margin-bottom:6px;font-family:var(--font-serif);">
        Registrar Allocation Notice: ${rem} of ${max} Institutional Fee-Waiver Vouchers remaining for [${domain}] (2028 Cycle).
      </div>
      <div style="font-size:13px;line-height:1.55;">
        &bull; <strong>Authorized Subsidy Rate:</strong> ${disc}% Fee Waiver ($${netFee}.00 Net Evaluation Fee vs. $500.00 Standard Fee)<br>
        &bull; <strong>Procedure:</strong> Submit your Guidance Counselor, Academic Advisor, or HR Director's contact information in Step 2 to reserve 1 of the remaining ${rem} institutional voucher(s).
      </div>
    `;

    const gatekeeperEmail = document.getElementById("vf-gatekeeper-email");
    if (gatekeeperEmail && !gatekeeperEmail.value) {
      gatekeeperEmail.placeholder = `advisor@${domain} or hr@${domain}`;
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
      statusBox.innerHTML = `Recording Institutional Subsidy Requisition with the Office of Financial Aid...`;

      try {
        const res = await fetch("/api/voucher-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          statusBox.innerHTML = `
            <div style="color:#1E5631;font-weight:700;margin-bottom:6px;font-family:var(--font-serif);">
              ✓ Requisition Recorded (Reference #${data.request_id})
            </div>
            <div style="font-size:13px;line-height:1.55;">
              &bull; <strong>Institution Domain:</strong> <code>${data.institution_domain}</code> (${data.remaining_codes} of ${data.max_codes} annual vouchers remaining)<br>
              &bull; <strong>Approved Waiver Tier:</strong> ${data.discount_pct}% Subsidy ($${data.net_fee}.00 Net Evaluation Fee)<br>
              &bull; <strong>Gatekeeper Attestation Portal:</strong> <a href="${data.verify_url}" target="_blank">Open Official Counselor / HR Attestation Link</a>
            </div>
          `;
          return;
        } else {
          statusBox.innerHTML = `<strong style="color:#8B1E24;">Allocation Notice:</strong> ${data.error || "Unable to process voucher requisition."}`;
          return;
        }
      } catch (err) {
        const domain = (payload.gatekeeper_email.split("@")[1] || "institution.edu").toLowerCase();
        const mockToken = "oism-stat-" + Math.random().toString(36).slice(2, 10);
        const verifyUrl = `${BASE_PATH}/verify-voucher/?token=${mockToken}&domain=${encodeURIComponent(domain)}&tier=${encodeURIComponent(payload.institution_type)}`;
        statusBox.innerHTML = `
          <div style="color:#00204E;font-weight:700;margin-bottom:6px;font-family:var(--font-serif);">
            ✓ Subsidy Requisition Logged for ${domain}
          </div>
          <div style="font-size:13px;">
            &bull; <strong>Gatekeeper Attestation Link:</strong> <a href="${verifyUrl}">Proceed to Counselor / HR Verification Page</a>
          </div>
        `;
      }
    });
  }

  // 5. Board of Trustees Endowment Actuarial Calculator & Chart
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
      const overhead = 6.18;

      vApplicants.textContent = applicants.toLocaleString() + " Applicants";
      vFellows.textContent = fellows.toLocaleString() + " Fellows";
      if (vCover) vCover.textContent = "$" + avgCover + " Avg Fee";

      const coverRev = applicants * avgCover;
      const tuitionRev = fellows * 43800;
      const grossRev = coverRev + tuitionRev;
      const netRev = Math.max(0, grossRev - overhead);
      const efficiency = grossRev > 0 ? ((netRev / grossRev) * 100).toFixed(5) : "99.98000";

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

      // Clean white/ivory academic report chart surface
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);

      const padL = 82;
      const padR = 28;
      const padT = 34;
      const padB = 46;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const ptsBench = 5154575;
      const harvardBench = 2200000;
      const maxVal = Math.max(ptsBench * 1.25, ...oismPerStudentSeries);

      // Subtle academic horizontal grid lines
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.font = "11.5px 'Source Sans 3', sans-serif";
      ctx.fillStyle = "#525A65";
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
      ctx.strokeStyle = "#8B1E24";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(padL, yPts);
      ctx.lineTo(w - padR, yPts);
      ctx.stroke();
      ctx.fillStyle = "#8B1E24";
      ctx.textAlign = "left";
      ctx.font = "bold 11px 'Source Sans 3', sans-serif";
      ctx.fillText("Princeton Theological Seminary ($5.15M / FTE)", padL + 8, yPts - 6);

      // Benchmark Line 2: Harvard ($2.20M/student)
      const yHarv = padT + plotH * (1 - harvardBench / maxVal);
      ctx.strokeStyle = "#00204E";
      ctx.beginPath();
      ctx.moveTo(padL, yHarv);
      ctx.lineTo(w - padR, yHarv);
      ctx.stroke();
      ctx.fillStyle = "#00204E";
      ctx.fillText("Harvard University (~$2.20M / FTE; -$113M Operating Deficit)", padL + 8, yHarv - 6);
      ctx.setLineDash([]);

      // OISM Compounding Curve (Institutional Brass/Gold)
      ctx.strokeStyle = "#9A7B38";
      ctx.lineWidth = 3;
      ctx.beginPath();
      oismPerStudentSeries.forEach((val, idx) => {
        const x = padL + (plotW * idx) / 9;
        const y = padT + plotH * (1 - val / maxVal);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = "11px 'Source Sans 3', sans-serif";
      oismPerStudentSeries.forEach((val, idx) => {
        const x = padL + (plotW * idx) / 9;
        const y = padT + plotH * (1 - val / maxVal);

        ctx.fillStyle = "#00204E";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#525A65";
        ctx.fillText(`Yr ${idx + 1}`, x, h - 16);
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

    out.innerHTML = `<div style="padding:18px;color:var(--text-muted);">Searching Office of the Registrar Archives for <strong>${cleanInput}</strong>...</div>`;

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
        <div class="dossier-output" style="border-left:4px solid #8B1E24;">
          <div style="color:#8B1E24;font-weight:700;font-family:var(--font-serif);font-size:16px;">
            No Record Found for Serial Number: [${cleanInput}]
          </div>
          <p style="margin-top:8px;font-size:13.5px;color:var(--text-muted);">
            The Office of the Registrar could not locate an active dossier matching that identifier. To view the Founding Chancellor's record, search for:
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
            <div style="font-size:11.5px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
              Omega Institutum Dominii Supremi &bull; Office of the Registrar
            </div>
            <h3 style="font-family:var(--font-serif);font-size:1.55rem;color:var(--navy);margin-top:4px;">
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
            <div class="dossier-val">${displaySerial} <span style="color:var(--text-muted);font-weight:400;">(${cred.serial_id})</span></div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Cohort &amp; Academic Session</div>
            <div class="dossier-val">${cred.cohort}</div>
          </div>
          <div class="dossier-field full">
            <div class="dossier-label">Conferred Honoris Causa &amp; Clerical Title</div>
            <div class="dossier-val" style="font-family:var(--font-serif);font-size:15px;">${cred.degree_title}</div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Date of Conferral</div>
            <div class="dossier-val">${cred.issued_at}</div>
          </div>
          <div class="dossier-field">
            <div class="dossier-label">Conferring Authority</div>
            <div class="dossier-val">Clerical Order of the Unburned Library &amp; Board of Trustees</div>
          </div>
          <div class="dossier-field full">
            <div class="dossier-label">Cryptographic SHA-256 Archival Digest</div>
            <div class="dossier-val" style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">${cred.sha256_hash}</div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
          <div style="font-size:12px;color:var(--text-muted);">
            Statutory Classification: Honorary philosophical &amp; ecclesiastical credential (MCL 390.1601–390.1605).
          </div>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn-brutal secondary" id="btn-preview-diploma">
              Preview Archival Diploma
            </button>
            <button type="button" class="btn-brutal" id="btn-print-diploma">
              Print / Export Official PDF
            </button>
          </div>
        </div>

        <div id="inline-diploma-preview-wrap" style="display:none;margin-top:22px;border-top:1px solid var(--border-dark);padding-top:18px;text-align:center;">
          <canvas id="inline-diploma-canvas" style="width:100%;max-width:860px;height:auto;border:1px solid var(--border-dark);box-shadow:0 4px 16px rgba(0,0,0,0.12);"></canvas>
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

      appendMessage(
        "bot",
        `In 399 BCE, Socrates advised the Athenian assembly (*Plato's Apology* 32a) that *"he who will fight for the right, if he would live even for a little while, must have a private station and not a public one."*\n\n• **Cohort 2027 (Founding Beta):** 100% Locked — By Committee Invitation Only.\n• **Cohort 2028 Application Window:** Oct 1 – Oct 31, 2028 (<0.0004% Admission Probability).\n• **Tuition Schedule:** 12 mins/day × 365 days = 4,380 mins/yr @ $10.00/min = **$43,800/yr**.\n• **Institutional Fee Waivers:** Candidates may request a 10%–90% evaluation fee waiver through their High School Guidance Counselor or Corporate HR Director in the Financial Aid section above.`
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

    document.querySelectorAll(".chip-btn[data-prompt]").forEach((chip) => {
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
