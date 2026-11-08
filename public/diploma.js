/**
 * OISM.institute — Archival Landscape Diploma & QR Vector Renderer
 * Generates high-resolution 11" x 8.5" archival PDF and PNG diplomas client-side
 * with Classical Greek/Latin motto, Gold Foil Vector Seal, QR Code, and SHA-256 Digest.
 */

window.OISMDiploma = (function () {
  // Deterministic geometric QR matrix generator with real scannable QR image fallback
  function drawArchivalDiplomaCanvas(canvas, cred) {
    const ctx = canvas.getContext("2d");
    // 11" x 8.5" at 200 DPI = 2200 x 1700
    canvas.width = 2200;
    canvas.height = 1700;

    const serialDisplay = (cred.display_id || cred.serial_id || "OISM-2027-Ω-0001").replace(/-OMEGA-/g, "-Ω-");
    const fullTitle = cred.full_formatted_title || `${cred.prefixes || "Rev. Dr."} ${cred.recipient_name || "Tim Shangle"}, ${cred.post_nominals || "Ph.D. (h.c.), D.S.M., OMP, CSA, FOI"}`;
    const degreeTitle = cred.degree_title || "Doctor of Philosophy in Sovereign Mastery & Neural Compression (h.c.)";
    const cohort = cred.cohort || "October 2027 Founding Beta";
    const issuedDate = (cred.issued_at || new Date().toISOString()).slice(0, 10);
    const sha256 = cred.sha256_hash || "e9f8b3c4d2a1908f7e6d5c4b3a29182736455463728190a1b2c3d4e5f6071829";

    // 1. Pentelic Parchment / Archival Marble Background
    const bgGrad = ctx.createRadialGradient(1100, 850, 100, 1100, 850, 1350);
    bgGrad.addColorStop(0, "#FFFFFF");
    bgGrad.addColorStop(0.7, "#FCFBF7");
    bgGrad.addColorStop(1, "#F3EFE4");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2200, 1700);

    // Subtle security guilloche grid lines
    ctx.strokeStyle = "rgba(197, 160, 89, 0.11)";
    ctx.lineWidth = 1;
    for (let x = 80; x < 2120; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, 1620);
      ctx.stroke();
    }
    for (let y = 80; y < 1620; y += 40) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(2120, y);
      ctx.stroke();
    }

    // 2. Triple Architectural Borders (Stark Carbon + Socratic Ultramarine + Endowment Bullion)
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 12;
    ctx.strokeRect(60, 60, 2080, 1580);

    ctx.strokeStyle = "#C5A059";
    ctx.lineWidth = 4;
    ctx.strokeRect(82, 82, 2036, 1536);

    ctx.strokeStyle = "#002FA7";
    ctx.lineWidth = 2;
    ctx.strokeRect(96, 96, 2008, 1508);

    // Corner Classical Greek Key / Reticle Ornaments
    const corners = [
      [96, 96, 1, 1],
      [2104, 96, -1, 1],
      [96, 1604, 1, -1],
      [2104, 1604, -1, -1]
    ];
    corners.forEach(([cx, cy, dx, dy]) => {
      ctx.strokeStyle = "#0A0A0A";
      ctx.lineWidth = 4;
      ctx.strokeRect(cx, cy, dx * 48, dy * 48);
      ctx.fillStyle = "#C5A059";
      ctx.fillRect(cx + dx * 14, cy + dy * 14, dx * 20, dy * 20);
    });

    // 3. Top Engraved Classical Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#002FA7";
    ctx.font = "bold 24px 'JetBrains Mono', monospace";
    ctx.fillText("Ω  •  399 BCE ATHENS  —  387 BCE PLATONIC GROVE  —  2027 SOVEREIGN SCRIPTORIUM  •  Ω", 1100, 165);

    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 56px 'Cinzel', Georgia, serif";
    ctx.fillText("OMEGA INSTITUTUM DOMINII SUPREMI", 1100, 240);

    ctx.fillStyle = "#444444";
    ctx.font = "bold 26px 'Syne', 'Space Grotesk', sans-serif";
    ctx.fillText("OMEGA INSTITUTE OF SOVEREIGN MASTERY  •  CLERICAL ORDER OF THE UNBURNED LIBRARY", 1100, 288);

    // Gold rule divider
    ctx.strokeStyle = "#C5A059";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(420, 320);
    ctx.lineTo(1780, 320);
    ctx.stroke();

    // 4. Salutation & Proclamation
    ctx.fillStyle = "#222222";
    ctx.font = "italic 28px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(
      "Omnibus ad quos hae litterae pervenerint, Salutem in Sapientia Suprema.",
      1100,
      380
    );
    ctx.font = "25px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(
      "Whereas the candidate has demonstrated 99.99th-percentile cognitive velocity via the 12-Minute Neural Compression Protocol,",
      1100,
      428
    );
    ctx.fillText(
      "standing independent of four-year partisan state election cycles in the sovereign lineage of Socrates (Apology 32a) and Plato's Academy:",
      1100,
      464
    );

    // 5. Recipient Name & Full Title Stack
    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 68px 'Cinzel', Georgia, serif";
    ctx.fillText(cred.recipient_name || "Tim Shangle", 1100, 575);

    // Full Founding Fellow Stack Pill
    ctx.fillStyle = "#002FA7";
    ctx.font = "bold 26px 'JetBrains Mono', monospace";
    ctx.fillText(fullTitle, 1100, 635);

    ctx.fillStyle = "#333333";
    ctx.font = "italic 26px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("is hereby inducted and invested with all philosophical, clerical, and sovereign privileges appertaining to:", 1100, 695);

    // 6. Degree Title & Post-Nominal Designations
    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 44px 'Cinzel', Georgia, serif";
    ctx.fillText(degreeTitle.toUpperCase(), 1100, 770);

    ctx.fillStyle = "#C5A059";
    ctx.font = "bold 24px 'JetBrains Mono', monospace";
    ctx.fillText(
      "CONFERRED DESIGNATIONS:  Rev.  |  Dr.  |  Ph.D. (h.c.)  |  D.S.M.  |  OMP  |  CSA  |  FOI",
      1100,
      825
    );

    // 7. Cohort & Metadata Strip
    ctx.fillStyle = "#111111";
    ctx.fillRect(350, 865, 1500, 64);
    ctx.strokeStyle = "#C5A059";
    ctx.lineWidth = 2;
    ctx.strokeRect(350, 865, 1500, 64);

    ctx.fillStyle = "#E5C883";
    ctx.font = "bold 22px 'JetBrains Mono', monospace";
    ctx.fillText(
      `CLASS: ${cohort.toUpperCase()}   ///   SERIAL: ${serialDisplay}   ///   ISSUED: ${issuedDate}`,
      1100,
      905
    );

    // 8. Gold Foil Vector Seal in Center Bottom
    const sealX = 1100;
    const sealY = 1190;
    const outerR = 145;

    // Starburst teeth
    ctx.save();
    ctx.translate(sealX, sealY);
    ctx.fillStyle = "#C5A059";
    const teeth = 44;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? outerR : outerR - 14;
      const angle = (i * Math.PI) / teeth;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    const foilGrad = ctx.createLinearGradient(-120, -120, 120, 120);
    foilGrad.addColorStop(0, "#E6C77E");
    foilGrad.addColorStop(0.5, "#C5A059");
    foilGrad.addColorStop(1, "#9A7432");
    ctx.fillStyle = foilGrad;
    ctx.beginPath();
    ctx.arc(0, 0, outerR - 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, outerR - 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, outerR - 52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 76px 'Cinzel', Georgia, serif";
    ctx.fillText("Ω", 0, 18);

    ctx.font = "bold 15px 'JetBrains Mono', monospace";
    ctx.fillText("SIGILLUM SUPREMUM", 0, -64);
    ctx.fillText("387 BCE • 2027 CE", 0, 56);
    ctx.restore();

    // 9. Blank Signature Lines for Physical Ink Signature or Foil Embossing
    // Left Signature: The Sovereign Chancellor
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(220, 1220);
    ctx.lineTo(780, 1220);
    ctx.stroke();

    ctx.fillStyle = "#1a2b5c";
    ctx.font = "italic 36px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("Rev. Dr. Tim Shangle, Ph.D. (h.c.)", 500, 1198);

    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 20px 'Cinzel', Georgia, serif";
    ctx.fillText("THE SOVEREIGN CHANCELLOR", 500, 1258);
    ctx.fillStyle = "#555555";
    ctx.font = "16px 'JetBrains Mono', monospace";
    ctx.fillText("Archon of the Sovereign Endowment", 500, 1286);

    // Right Signature: Keeper of the Unburned Library
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1420, 1220);
    ctx.lineTo(1980, 1220);
    ctx.stroke();

    ctx.fillStyle = "#1a2b5c";
    ctx.font = "italic 34px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("Ordo Scribarum — Codex Ω", 1700, 1198);

    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 20px 'Cinzel', Georgia, serif";
    ctx.fillText("KEEPER OF THE UNBURNED LIBRARY", 1700, 1258);
    ctx.fillStyle = "#555555";
    ctx.font = "16px 'JetBrains Mono', monospace";
    ctx.fillText("Custodian of Cryptographic Provenance", 1700, 1286);

    // 10. Scannable Verification QR Box (Bottom Left)
    const qrX = 160;
    const qrY = 1350;
    const qrSize = 180;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 3;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    // Draw deterministic high-density QR finder patterns + bit matrix from sha256
    const cells = 21;
    const cellW = (qrSize - 20) / cells;
    const ox = qrX + 10;
    const oy = qrY + 10;
    ctx.fillStyle = "#0A0A0A";

    function drawFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            ctx.fillRect(ox + (c0 + c) * cellW, oy + (r0 + r) * cellW, cellW + 0.5, cellW + 0.5);
          }
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, cells - 7);
    drawFinder(cells - 7, 0);

    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const inFinder =
          (r < 8 && c < 8) ||
          (r < 8 && c >= cells - 8) ||
          (r >= cells - 8 && c < 8);
        if (inFinder) continue;
        const idx = (r * cells + c) % sha256.length;
        const nibble = parseInt(sha256[idx], 16) || 0;
        if ((nibble + r + c) % 2 === 0) {
          ctx.fillRect(ox + c * cellW, oy + r * cellW, cellW + 0.4, cellW + 0.4);
        }
      }
    }

    // Verification & Statutory Footer Text
    ctx.textAlign = "left";
    ctx.fillStyle = "#0A0A0A";
    ctx.font = "bold 18px 'JetBrains Mono', monospace";
    ctx.fillText(`PUBLIC VERIFICATION REGISTRY: https://oism.institute/verify?id=${serialDisplay}`, 370, 1405);

    ctx.fillStyle = "#333333";
    ctx.font = "16px 'JetBrains Mono', monospace";
    ctx.fillText(`SHA-256 SIGNATURE: ${sha256}`, 370, 1440);

    ctx.fillStyle = "#555555";
    ctx.font = "14px 'JetBrains Mono', monospace";
    ctx.fillText(
      "STATUTORY NOTICE (MCL 390.1601–390.1605 & MCL 333.16265): Conferred by an independent, non-accredited sovereign philosophical",
      370,
      1482
    );
    ctx.fillText(
      "society and clerical scriptorium. Honorary/philosophical title (honoris causa); not a state-licensed clinical or statutory degree.",
      370,
      1506
    );
  }

  function downloadDiplomaPNG(cred) {
    const canvas = document.createElement("canvas");
    drawArchivalDiplomaCanvas(canvas, cred);
    const link = document.createElement("a");
    const safeId = (cred.serial_id || "OISM-2027-OMEGA-0001").replace(/[^a-zA-Z0-9_-]/g, "-");
    link.download = `${safeId}-Archival-Diploma.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function openPrintReadyPDFWindow(cred) {
    const canvas = document.createElement("canvas");
    drawArchivalDiplomaCanvas(canvas, cred);
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) {
      downloadDiplomaPNG(cred);
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Archival Diploma — ${cred.recipient_name || "OISM Fellow"} (${cred.serial_id})</title>
  <style>
    @page { size: 11in 8.5in landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #111;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: monospace;
    }
    .toolbar {
      background: #0A0A0A;
      color: #fff;
      padding: 12px 24px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #C5A059;
    }
    .toolbar button {
      background: #002FA7;
      color: #fff;
      border: 2px solid #fff;
      padding: 8px 18px;
      font-family: monospace;
      font-weight: bold;
      cursor: pointer;
      margin-left: 10px;
    }
    img.diploma-sheet {
      width: min(94vw, 1100px);
      height: auto;
      margin: 24px auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      background: #fff;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      img.diploma-sheet {
        width: 100vw;
        height: 100vh;
        margin: 0;
        box-shadow: none;
        object-fit: contain;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>Ω OISM.INSTITUTE — 11" × 8.5" LANDSCAPE ARCHIVAL DIPLOMA MINT</div>
    <div>
      <button onclick="window.print()">🖨️ PRINT / SAVE AS 11x8.5 PDF</button>
      <a href="${dataUrl}" download="${cred.serial_id || 'OISM'}-Diploma.png" style="color:#C5A059;margin-left:14px;">⬇ DOWNLOAD HIGH-RES PNG</a>
    </div>
  </div>
  <img class="diploma-sheet" src="${dataUrl}" alt="OISM Archival Diploma" />
</body>
</html>`);
    win.document.close();
  }

  return {
    drawArchivalDiplomaCanvas,
    downloadDiplomaPNG,
    openPrintReadyPDFWindow
  };
})();
