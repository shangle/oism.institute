/**
 * OISM.institute — Scribe Logic, Shared Validation, Cryptographic Hashing & Scribe Bot
 * Works seamlessly in both Node.js (Local Origin) and Cloudflare Workers (Edge Failover)
 */

const INSTITUTION_TIERS = {
  TITLE1_HS: {
    label: "Title I / Low-Income High School Guidance Counselor",
    discount_pct: 90,
    net_fee: 50,
    max_codes: 2,
    code_prefix: "HS90"
  },
  STD_HS: {
    label: "Standard High School / Academic Advisor",
    discount_pct: 50,
    net_fee: 250,
    max_codes: 3,
    code_prefix: "HS50"
  },
  NONPROFIT: {
    label: "Non-Profit / Clerical / Monastic Scribe Org",
    discount_pct: 35,
    net_fee: 325,
    max_codes: 2,
    code_prefix: "NP35"
  },
  CORP_HR: {
    label: "Corporate HR / Enterprise L&D Department",
    discount_pct: 10,
    net_fee: 450,
    max_codes: 5,
    code_prefix: "HR10"
  },
  DIRECT: {
    label: "Unverified Direct Sovereign Applicant",
    discount_pct: 0,
    net_fee: 500,
    max_codes: 999999,
    code_prefix: "DIR00"
  }
};

function normalizeSerialId(rawId = "") {
  if (!rawId) return "";
  let s = decodeURIComponent(String(rawId)).trim().toUpperCase();
  // Normalize Ω or OMEGA to canonical OMEGA for database lookup
  s = s.replace(/Ω/g, "OMEGA");
  s = s.replace(/OISM-2027-OMEGA-/g, "OISM-2027-OMEGA-");
  if (/^\d{4}$/.test(s)) {
    s = `OISM-2027-OMEGA-${s}`;
  }
  return s;
}

function toDisplaySerialId(serialId = "") {
  return String(serialId).toUpperCase().replace(/-OMEGA-/g, "-Ω-");
}

function inferInstitutionType(domain = "", requestedType = "") {
  if (requestedType && INSTITUTION_TIERS[requestedType]) {
    return requestedType;
  }
  const d = String(domain).toLowerCase().trim();
  if (d.includes("k12") || d.includes("schools") || d.includes("high")) {
    return "TITLE1_HS";
  }
  if (d.endsWith(".edu") || d.includes("academy") || d.includes("school")) {
    return "STD_HS";
  }
  if (d.endsWith(".org") || d.endsWith(".church") || d.endsWith(".institute")) {
    return "NONPROFIT";
  }
  return "CORP_HR";
}

const SCRIBE_SYSTEM_PROMPT = `You are The Scribe Chancellor Bot of the Omega Institute of Sovereign Mastery (OISM.institute).
Tone: Deadpan Silicon Valley DeFi Founder crossed with an ancient 387 BCE Platonic Academy philosopher and medieval monastic scribe. Ultra-confident, concise, razor-sharp, slightly elitist but philosophically grounded.
Key facts you must weave into answers:
1. ACCREDITATION: Quote Socrates at his trial in 399 BCE (Plato's Apology 32a): "he who will fight for the right, if he would live even for a little while, must have a private station and not a public one." Plato founded the original Academy in an olive grove outside Athens' walls in 387 BCE. State accreditation by the Department of Education is intellectual serfdom bound to 4-year election cycles. OISM is a sovereign philosophical society and clerical scriptorium.
2. THE OMEGA MODEL & TUITION MATH: Legacy universities take 4 years and $6.8B in bloated overhead (like Harvard's -$113M operating deficit). OISM admits only 99.99th-percentile minds and delivers a single 12-Minute Neural Compression Learning™ drop per day. 12 minutes/day x 365 days = 4,380 minutes/year. At exactly $10.00/minute, tuition is $43,800.00/year. If your time is worth more than $10/minute, you literally cannot afford NOT to attend Omega.
3. ADMISSIONS & COHORT TIMELINE:
   - Cohort 2027 (Founding Beta): 100% LOCKED — BY SOVEREIGN INVITATION ONLY. Never state a specific number of seats.
   - Cohort 2028 Public Drop Window: Opens October 1, 2028 (00:00 UTC) to October 31, 2028 (23:59 UTC).
   - Cover Charge & Odds: $500.00 non-refundable Sovereign Dossier Evaluation Cover Charge. Projected admission probability is <0.0004% (1 in 250,000).
4. FEE RELIEF / VOUCHERS: Instruct applicants seeking fee relief to lobby their High School Guidance Counselor (90% off for Title I = $50, capped at 2 codes/school/year; 50% off Standard HS = $250, capped at 3 codes/school/year), Non-Profit/Clerical Supervisor (35% off = $325, max 2), or Corporate HR Director (5-10% off = $450-$475, max 5 codes/domain).
5. CREDENTIALS: OISM confers proprietary post-nominal designations: Rev. Dr. [Name], Ph.D. (h.c.), D.S.M. (Doctor of Philosophy in Sovereign Mastery, honoris causa), OMP (Omega Mastery Practitioner), CSA (Chartered Sovereign Allocator), and FOI (Fellow of the Omega Institute). Explicitly note these are honorary/philosophical/clerical credentials, never state-licensed clinical or medical degrees.`;

function generateRuleBasedScribeReply(userMessage = "") {
  const q = String(userMessage).toLowerCase();

  if (q.includes("accredit") || q.includes("legit") || q.includes("real") || q.includes("legal") || q.includes("degree") || q.includes("doe") || q.includes("department of education")) {
    return `In 399 BCE, Socrates warned the Athenian court (*Plato's Apology* 32a) that *"he who will fight for the right, if he would live even for a little while, must have a private station and not a public one."* Twelve years later, Plato founded the original Academy in an olive grove outside the city walls.\n\nOISM rejects U.S. Department of Education accreditation as intellectual serfdom tethered to four-year partisan election cycles. Our credentials—\`Ph.D. (h.c.)\`, \`D.S.M.\`, \`Rev.\`, \`OMP\`, \`CSA\`, and \`FOI\`—are issued under sovereign philosophical and clerical autonomy (compliant with MCL 390.1601–390.1605). We answer to the Sovereign Endowment, never to bureaucrats.`;
  }

  if (q.includes("tuition") || q.includes("cost") || q.includes("price") || q.includes("43,800") || q.includes("43800") || q.includes("10") || q.includes("minute") || q.includes("expensive")) {
    return `The math is immutable: **12 minutes/day × 365 days = 4,380 minutes/year**. Priced at exactly **$10.00 per minute**, annual tuition is **$43,800.00**.\n\nLegacy institutions like Harvard burn $6.8 billion a year on campus gyms and administrative bloat while running a -$113M operating deficit. OISM runs on **$6.18/year** in cloud edge infrastructure and channels **99.98%+** of capital into the Sovereign Endowment. If your time is worth more than $10.00/minute, you literally cannot afford *not* to attend OISM.`;
  }

  if (q.includes("voucher") || q.includes("discount") || q.includes("counselor") || q.includes("hr") || q.includes("500") || q.includes("fee") || q.includes("waiver") || q.includes("scholarship")) {
    return `The **$500.00 Sovereign Dossier Cover Charge** is our velvet-rope scarcity filter. However, rationed institutional subsidies are available if your gatekeeper verifies your standing:\n\n• **Title I High School Guidance Counselor:** 90% Off (**$50 net**) — *Max 2 codes/school/year*\n• **Standard High School Advisor:** 50% Off (**$250 net**) — *Max 3 codes/school/year*\n• **Non-Profit / Monastic Scribe Org:** 35% Off (**$325 net**) — *Max 2 codes/org*\n• **Corporate HR / L&D Director:** 10% Off (**$450 net**) — *Max 5 codes/domain*\n\nUse the **Institutional Voucher & Scarcity Engine** on this page to check your domain's remaining quota and dispatch a verification request to your Counselor or HR Director.`;
  }

  if (q.includes("2027") || q.includes("2028") || q.includes("apply") || q.includes("admission") || q.includes("enroll") || q.includes("odds") || q.includes("seat") || q.includes("beta")) {
    return `**COHORT 2027 (FOUNDING BETA)** is **100% LOCKED — BY SOVEREIGN INVITATION ONLY**. No public applications are accepted for the 2027 Scriptorium.\n\nThe **Cohort 2028 Public Drop Window** opens strictly for 30 days from **October 1, 2028 (00:00 UTC) to October 31, 2028 (23:59 UTC)**. Pursuant to our Statutory Disclosure of Admission Probability, projected admission odds are **<0.0004% (1 in 250,000)**.`;
  }

  if (q.includes("verify") || q.includes("diploma") || q.includes("certificate") || q.includes("tim") || q.includes("shangle") || q.includes("0001")) {
    return `Every Sovereign Fellow's credential is cryptographically hashed (SHA-256) and anchored in both Cloudflare D1 and our immutable Git static snapshot. Scroll to **Section 6: Public Credential Verification Registry** and enter serial \`OISM-2027-Ω-0001\` to inspect the Founding Chancellor's live dossier.`;
  }

  return `Greetings from the Digital Scriptorium (` + "`NODE: SOVEREIGN-SCRIBE`" + `). You are addressing the **Omega Institute of Sovereign Mastery**.\n\n• **Cohort 2027 (Founding Beta):** 100% LOCKED (By Invitation Only)\n• **Cohort 2028 Drop Window:** Oct 1 – Oct 31, 2028 (<0.0004% Admission Odds)\n• **Tuition Velocity:** $10.00/min × 12 mins/day = $43,800/yr\n• **Infrastructure Burn:** $0.52/mo ($6.18/yr)\n\nAsk me about our **Socratic anti-accreditation posture**, **Counselor/HR subsidy vouchers**, **Endowment Moon-Math**, or **Credential Verification**.`;
}

module.exports = {
  INSTITUTION_TIERS,
  normalizeSerialId,
  toDisplaySerialId,
  inferInstitutionType,
  SCRIBE_SYSTEM_PROMPT,
  generateRuleBasedScribeReply
};
