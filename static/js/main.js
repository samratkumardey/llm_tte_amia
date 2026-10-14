(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Theme toggle ---------- */
  const root = document.documentElement;
  const themeBtn = $("#themeBtn");
  try { const t = localStorage.getItem("tte-theme"); if (t) root.setAttribute("data-theme", t); } catch (e) {}
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const syncIcon = () => { themeBtn.innerHTML = `<svg><use href="#${isDark() ? "i-sun" : "i-moon"}"/></svg>`; };
  syncIcon();
  themeBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tte-theme", next); } catch (e) {}
    syncIcon();
  });

  /* ---------- Forest plot ---------- */
  const forestData = [
    { l1: "Periprocedural", l2: "stroke/death 0–44 d", e: [2.11, 1.76, 2.51], t: [1.3, 0.6, 2.5], smd: "0.058" },
    { l1: "New ischemic", l2: "stroke 45 d–4 y", e: [3.07, 2.64, 3.55], t: [2.8, 1.4, 4.3], smd: "0.016" },
    { l1: "All-cause", l2: "mortality 4 y", e: [6.93, 6.29, 7.61], t: [7.1, 5.3, 9.4], smd: "0.007" }
  ];
  (function drawForest() {
    const svg = $("#forest"); if (!svg) return;
    const x0 = 128, x1 = 404, max = 10, sx = (v) => x0 + (v / max) * (x1 - x0);
    let h = "";
    for (let v = 0; v <= 10; v += 2) {
      h += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="14" y2="216"/>`;
      h += `<text class="tick" x="${sx(v)}" y="234" text-anchor="middle">${v}%</text>`;
    }
    forestData.forEach((d, i) => {
      const y = 46 + i * 68;
      h += `<text class="lbl" x="0" y="${y - 2}">${d.l1}</text><text x="0" y="${y + 14}">${d.l2}</text>`;
      h += `<text class="smd" x="0" y="${y + 30}">SMD ${d.smd}</text>`;
      [["ehr", d.e, y - 9], ["trial", d.t, y + 11]].forEach(([c, v, yy]) => {
        h += `<line class="${c}" x1="${sx(v[1])}" x2="${sx(v[2])}" y1="${yy}" y2="${yy}" stroke-width="2.4" stroke-linecap="round"/>`;
        h += c === "ehr" ? `<circle class="${c}" cx="${sx(v[0])}" cy="${yy}" r="5"/>` : `<rect class="${c}" x="${sx(v[0]) - 4.5}" y="${yy - 4.5}" width="9" height="9" transform="rotate(45 ${sx(v[0])} ${yy})"/>`;
        const right = sx(v[2]) + 8 < x1 - 30;
        h += `<text class="val ${c}-t" x="${right ? sx(v[2]) + 7 : sx(v[1]) - 7}" y="${yy + 3.5}" text-anchor="${right ? "start" : "end"}">${v[0]}%</text>`;
      });
    });
    svg.innerHTML = h;
  })();

  /* ---------- Pipeline stepper ---------- */
  const modules = [
    { id: "M1", cls: "m1", t: "RAG Knowledge Base Setup", d: "Extracts the published CREST-2 protocol text with PyPDF2, segments it into 52 chunks tagged by TTE category, embeds them with the all-MiniLM-L6-v2 sentence transformer, and stores them in a ChromaDB vector database.", i: "CREST-2 NEJM 2025 PDF (public)", o: "ChromaDB vector store (52 chunks)" },
    { id: "M2", cls: "m2", t: "Protocol Parser", hitl: "HITL #1 · clinician reviews criteria", d: "The LLM queries the RAG store and extracts structured TTE criteria: eligibility (e.g. I65.2x carotid stenosis; asymptomatic = no ipsilateral stroke/TIA within 180 days), outcomes (stroke/death within 44 days, ipsilateral ischemic stroke thereafter) and covariates. A clinician checks accuracy and completeness before code generation.", i: "RAG retrieval", o: "llm_parsed_criteria.json" },
    { id: "M3", cls: "m3", t: "Phenotype Generator", d: "Reads the parsed criteria and generates phenotyping variants for each TTE decision point: ICD-10-CM sets for anterior and posterior circulation stroke, CPT codes for CEA and CAS, temporal logic for follow-up windows and blanking periods, and encounter-type filters.", i: "llm_parsed_criteria.json", o: "module4_pandas_phenotyping.py" },
    { id: "M4", cls: "m4", t: "Phenotyping Pipeline", hitl: "HITL #2 · informatician reviews code", d: "PySpark extracts CAS-patient data, converts to pandas and applies modular steps: cohort extraction, index date, eligibility, outcome and demographics. An informatician verifies data-model mappings, join logic and temporal filters before execution. Any LLM help here runs locally.", i: "Generated phenotyping code + OHRWD", o: "cohort_profiles" },
    { id: "M5", cls: "m5", t: "Outcome Analysis", hitl: "HITL #1 · clinician validates results", d: "Computes the composite of any stroke or death from the index procedure through day 44, and new ischemic stroke from day 45 through 4 years. The clinician re-engages to judge whether event rates and distributions are plausible for a carotid revascularization population.", i: "cohort_profiles", o: "Outcome tables and trial comparison" }
  ];
  const stepsEl = $("#steps"), panel = $("#stepPanel");
  stepsEl.innerHTML = modules.map((m, k) => `<button class="step-btn" type="button" role="tab" id="st-${m.id}" aria-selected="${k === 0}" data-k="${k}"><span class="m ${m.cls}">${m.id}</span><span class="t">${m.t}</span><span class="h">${m.hitl ? "HITL" : ""}</span></button>`).join("");
  function showStep(k) {
    const m = modules[k];
    $$(".step-btn", stepsEl).forEach((b, j) => b.setAttribute("aria-selected", String(j === k)));
    panel.innerHTML = `<h4>${m.id} · ${m.t}</h4>${m.hitl ? `<span class="hitl-flag">● ${m.hitl}</span>` : ""}<p class="muted" style="color:var(--ink-2)">${m.d}</p><div class="io"><div class="in"><b>Input</b>${esc(m.i)}</div><div class="out"><b>Output</b><code>${esc(m.o)}</code></div></div>`;
  }
  stepsEl.addEventListener("click", (e) => { const b = e.target.closest(".step-btn"); if (b) showStep(+b.dataset.k); });
  stepsEl.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const cur = $$(".step-btn", stepsEl).findIndex((b) => b.getAttribute("aria-selected") === "true");
    const n = (cur + (e.key === "ArrowDown" ? 1 : -1) + modules.length) % modules.length;
    showStep(n); $$(".step-btn", stepsEl)[n].focus();
  });
  showStep(0);

  /* ---------- Design parameters ---------- */
  const timeline = `
  <svg class="timeline" viewBox="0 0 640 150" role="img" aria-label="Follow-up timeline: periprocedural window day 0 to 44, long-term window day 45 to 1,460">
    <text class="ttl" x="40" y="22">Periprocedural</text>
    <text class="ttl" x="214" y="22">Long-term efficacy window</text>
    <rect class="peri" x="40" y="34" width="140" height="30" rx="5"/>
    <rect class="long" x="214" y="34" width="386" height="30" rx="5"/>
    <text x="110" y="54" text-anchor="middle">T0 → T0+44 d</text>
    <text x="407" y="54" text-anchor="middle">T0+45 d → T0+4 y (1,460 d)</text>
    <line class="axis" x1="40" y1="90" x2="600" y2="90"/>
    <line class="brk" x1="195" y1="82" x2="199" y2="98"/>
    <line class="brk2" x1="190" y1="84" x2="194" y2="96"/><line class="brk2" x1="198" y1="84" x2="202" y2="96"/>
    ${[[40, "0", "T0"], [180, "44", ""], [214, "45", ""], [312, "365", ""], [408, "730", ""], [504, "1,095", ""], [600, "1,460", "4 y"]].map(([x, d, s]) => `<line class="mark" x1="${x}" x2="${x}" y1="84" y2="96"/><text x="${x}" y="114" text-anchor="middle">${d}</text>${s ? `<text x="${x}" y="130" text-anchor="middle" style="fill:var(--accent);font-weight:600">${s}</text>` : ""}`).join("")}
    <text x="320" y="146" text-anchor="middle" style="fill:var(--muted)">days since index CAS procedure (axis broken between windows)</text>
  </svg>`;
  const fig = (src, cap, alt) => `<figure><button class="plate" type="button" data-zoom="${src}" data-cap="${esc(cap)}"><img src="${src}" alt="${esc(alt)}"><span class="zoom">click to zoom</span></button><figcaption>${cap.replace(/^(Figure [^.]+\.)/, "<b>$1</b>")}</figcaption></figure>`;
  const dps = [
    { id: "DP1", t: "Eligibility", tp: 6, n: 6, body: `
      <h4>Inclusion</h4><ul><li>Age ≥ 18 years at the index procedure date</li><li>High-grade asymptomatic carotid stenosis (≥ 70%)</li><li>Qualifying CEA or CAS procedure identified by CPT code</li><li>At least 1 year of continuous enrollment before the index date</li></ul>
      <h4>Exclusion</h4><ul><li>Ipsilateral stroke or TIA within 180 days before the index procedure</li><li>Prior ipsilateral CEA or CAS before the index date</li><li>Missing critical demographics (sex, birth date)</li></ul>
      <h4>Codes</h4><div class="codes"><code>I65.2x</code><code>CEA 35301</code><code>CEA 35390</code><code>CAS 37215</code><code>CAS 37216</code><code>CAS 37217</code><code>I63</code><code>I61</code><code>G45</code></div>
      <p class="small muted" style="margin-top:.6rem">Implemented against the DEMOGRAPHIC, PROCEDURES, DIAGNOSIS and ENCOUNTER tables. The LLM correctly translated the code sets and the 180-day lookback.</p>`,
      side: fig("static/images/fig3a_eligibility.png", "Figure 3(A). Eligibility prompt and LLM-generated cohort phenotype with CPT/ICD filters.", "Prompt to LLM defining eligibility, and the generated Python code with CPT code lists, index date and 180-day stroke/TIA exclusion.") },
    { id: "DP2", t: "Treatment strategies", tp: 4, n: 4, body: `
      <ul><li>Treatment assignment defined by the index procedure</li><li>Arm A: carotid endarterectomy (CEA) · Arm B: carotid artery stenting (CAS)</li><li>Index date = date of the first qualifying revascularization procedure</li><li>Results are reported for the CAS arm, since the goal was to test whether the pipeline produces valid outcome estimates rather than to estimate treatment effects</li></ul>
      <h4>CPT definitions</h4><div class="codes"><code>CEA 35301</code><code>CEA 35390</code><code>CAS 37215</code><code>CAS 37216</code><code>CAS 37217</code></div>`,
      side: `<div class="card"><span class="k">CREST-2 · BROTT ET AL., NEJM</span><p>Two parallel, observer-blinded randomized trials at 155 centers in five countries: CAS + intensive medical management (IMM) vs. IMM alone, and CEA + IMM vs. IMM alone. Each enrolled over 1,200 patients with ≥ 70% asymptomatic stenosis.</p><p>Primary outcome: any stroke or death within 44 days of randomization, or ipsilateral ischemic stroke during follow-up up to 4 years.</p></div>` },
    { id: "DP3", t: "Time zero", tp: 3, n: 3, body: `
      <ul><li>T0 = date of the first qualifying CAS procedure for each patient</li><li>Aligns with CREST-2, where randomization occurred at treatment assignment</li><li>Periprocedural window: day 0 through day 44</li><li>Long-term efficacy window: day 45 through 4 years (1,460 days)</li></ul>`,
      side: timeline },
    { id: "DP4", t: "Outcomes", tp: 6, n: 8, body: `
      <ul><li>Window 1: stroke or death within 44 days (periprocedural)</li><li>Window 2: new ischemic stroke from day 45 through 4 years</li><li>Anterior circulation ischemic stroke: carotid, MCA, ACA territories</li><li>Posterior circulation ischemic stroke: vertebral, basilar, PCA, cerebellar</li><li>Intracerebral hemorrhage (I61.*) and all-cause death</li><li>Composite: new ischemic stroke (anterior or posterior) OR death; inpatient encounters only</li></ul>
      <h4>Errors caught in review</h4><div class="codes"><code>ISCH_PREFIX = ("",)</code><code>STROKE_ANY missing I63</code></div>
      <p class="small muted" style="margin-top:.6rem">Outcome phenotyping was the most error-prone stage. See the human-in-the-loop section below.</p>`,
      side: fig("static/images/fig3b_outcomes.png", "Figure 3(B). Outcome prompt and generated ICD-10-CM code sets by vascular territory.", "Prompt defining stroke outcomes and generated anterior and posterior circulation ICD-10-CM code sets and composite logic.") },
    { id: "DP5", t: "Follow-up & censoring", tp: 5, n: 5, body: `
      <ul><li>Periprocedural: T0 to T0 + 44 days</li><li>Long-term: T0 + 45 days to T0 + 4 years (1,460 days)</li><li>Censor at the earliest of: end of the observation window (day 44 or day 1,460), last known encounter date (loss to follow-up), or end of data availability</li><li>Time-to-event = days from index to first composite event, or to censoring for event-free patients</li></ul>`,
      side: timeline }
  ];
  const dpTabs = $("#dpTabs"), dpPanel = $("#dpPanel");
  dpTabs.innerHTML = dps.map((d, k) => `<button class="tab" type="button" role="tab" aria-selected="${k === 0}" data-k="${k}"><span class="code">${d.id}</span>${d.t}${d.tp < d.n ? '<span class="err" title="Errors found"></span>' : ""}</button>`).join("");
  function showDp(k) {
    const d = dps[k];
    $$(".tab", dpTabs).forEach((b, j) => b.setAttribute("aria-selected", String(j === k)));
    const ok = d.tp === d.n;
    dpPanel.innerHTML = `<div class="dp-panel"><div class="stack" style="min-width:0"><div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap"><h3>${d.id}: ${d.t}</h3><span class="score ${ok ? "ok" : "bad"}">${d.tp}/${d.n} correct · ${Math.round((d.tp / d.n) * 100)}%</span></div>${d.body}</div><div style="min-width:0">${d.side}</div></div>`;
  }
  dpTabs.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) showDp(+b.dataset.k); });
  showDp(0);

  /* ---------- HITL diff ---------- */
  const before = `<span class="cm"># Ischemic stroke prefix (M3, turn 1)</span>
<span class="del">ISCH_PREFIX = ("",)                                  ✗</span><span class="cm"># empty string matches every ICD code:
# every diagnosis was flagged as a stroke</span>

<span class="del">STROKE_ANY_PREFIX = ("I61", "I60", "I62", "I64")     ✗</span><span class="cm"># I63 missing: ischemic strokes excluded
# from the broad "any stroke" category</span>`;
  const after = `<span class="cm"># Fixed ischemic prefix (after HITL #1 review)</span>
<span class="add">ISCH_PREFIX = ("I63",)                               ✓</span>
<span class="add">STROKE_ANY_PREFIX = ("I63", "I61", "I60", "I62", "I64")  ✓</span>
<span class="cm"># All ischemic subtypes now captured</span>`;
  const notes = {
    b: "Both definitions are valid Python and run without errors. The first would label every diagnosis a stroke; the second would drop all ischemic strokes from the any-stroke category.",
    a: "Each error was corrected in a single human-in-the-loop iteration of prompting and review."
  };
  function setDiff(isAfter) {
    $("#diffCode").innerHTML = isAfter ? after : before;
    $("#diffNote").textContent = isAfter ? notes.a : notes.b;
    $("#dBefore").setAttribute("aria-pressed", String(!isAfter));
    $("#dAfter").setAttribute("aria-pressed", String(isAfter));
  }
  $("#dBefore").addEventListener("click", () => setDiff(false));
  $("#dAfter").addEventListener("click", () => setDiff(true));
  setDiff(false);

  /* ---------- Extraction table ---------- */
  const ext = [
    ["DP1: Eligibility", 6, 0, 0, "1.00", "1.00", "1.00", 100, "None"],
    ["DP2: Treatment", 4, 0, 0, "1.00", "1.00", "1.00", 100, "None"],
    ["DP3: Time-zero", 3, 0, 0, "1.00", "1.00", "1.00", 100, "None"],
    ["DP4: Outcomes", 6, 2, 0, "1.00", "0.75", "0.857", 75, "(1) Empty <code>ISCH_PREFIX</code>; (2) missing I63 in <code>STROKE_ANY</code>"],
    ["DP5: Follow-up", 5, 0, 0, "1.00", "1.00", "1.00", 100, "None"]
  ];
  $("#extractBody").innerHTML = ext.map((r) => `<tr><td>${r[0]}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td><td class="r">${r[4]}</td><td class="r">${r[5]}</td><td class="r">${r[6]}</td><td><div class="acc-bar"><span class="track"><i class="${r[7] < 100 ? "bad" : ""}" style="width:${r[7]}%"></i></span><span class="num">${r[7]}%</span></div></td><td>${r[8]}</td></tr>`).join("") +
    `<tr class="total"><td>Overall</td><td class="r">24</td><td class="r">2</td><td class="r">0</td><td class="r">1.00</td><td class="r">0.923</td><td class="r">0.960</td><td><div class="acc-bar"><span class="track"><i style="width:92.3%"></i></span><span class="num">92.3%</span></div></td><td>2 critical errors in DP4</td></tr>`;

  /* ---------- Baseline table (full variable set) ---------- */
  // [label, EHR text, EHR %, CREST-2 text, CREST-2 %, p-value]
  const baseGroups = [
    ["Demographic characteristics", [
      ["Age, years (mean ± SD)", "72.18 ± 8.48", null, "69.03 ± 8.1", null, "<0.001"],
      ["Median age, years", "73", null, "", null, ""],
      ["Age 35–40", "7 (0.12%)", 0.12],
      ["Age 41–50", "66 (1.13%)", 1.13],
      ["Age 51–60", "467 (8.01%)", 8.01],
      ["Age 61–70", "1,788 (30.66%)", 30.66],
      ["Age 71–80", "2,448 (41.98%)", 41.98],
      ["Age ≥ 81", "1,055 (18.09%)", 18.09]
    ]],
    ["Sex", [
      ["Female", "2,162 (37.07%)", 37.07, "227 (36.9%)", 36.9, "0.979"],
      ["Male", "3,545 (60.79%)", 60.79],
      ["Unknown", "124 (2.12%)", 2.12]
    ]],
    ["Race", [
      ["White", "5,064 (86.84%)", 86.84, "572 (92.9%)", 92.9, "<0.001"],
      ["Black or African American", "228 (3.91%)", 3.91, "35 (5.7%)", 5.7, "<0.001"],
      ["Asian", "36 (0.61%)", 0.61],
      ["American Indian / Alaska Native", "26 (0.44%)", 0.44],
      ["Other", "477 (8.18%)", 8.18, "9 (1.5%)", 1.5, "<0.001"]
    ]],
    ["Risk factors", [
      ["Smoking", "860 (14.75%)", 14.75, "116 (18.8%)", 18.8, "<0.001"],
      ["Alcohol misuse", "110 (1.89%)", 1.89],
      ["Hypertension", "3,588 (61.53%)", 61.53, "542 (88.0%)", 88.0, "<0.001"],
      ["Dyslipidemia", "2,657 (45.57%)", 45.57, "567 (92.0%)", 92.0, "<0.001"],
      ["Obesity", "591 (10.14%)", 10.14],
      ["Diabetes mellitus", "1,710 (29.33%)", 29.33, "251 (40.7%)", 40.7, "<0.001"],
      ["Previous myocardial infarction", "380 (6.52%)", 6.52],
      ["Heart failure", "620 (10.63%)", 10.63],
      ["Peripheral vascular disease", "1,199 (20.56%)", 20.56],
      ["Atherosclerosis of the aorta", "243 (4.17%)", 4.17],
      ["Chronic lung disease", "1,214 (20.82%)", 20.82],
      ["Liver failure", "18 (0.31%)", 0.31],
      ["Chronic kidney disease", "855 (14.66%)", 14.66],
      ["Cancer", "738 (12.66%)", 12.66],
      ["Dementia", "190 (3.26%)", 3.26],
      ["Cerebrovascular disease", "390 (6.69%)", 6.69, "331 (53.7%)", 53.7, "<0.001"]
    ]]
  ];
  let baseMode = "all";
  function renderBase() {
    let html = "", shown = 0;
    baseGroups.forEach(([g, rows]) => {
      const rs = rows.filter((r) => baseMode === "all" || (r[3] && r[3] !== ""));
      if (!rs.length) return;
      html += `<tr class="grp"><td colspan="5">${g}</td></tr>`;
      rs.forEach((r) => {
        shown++;
        const trial = r[3] ? r[3] : '<span class="muted">—</span>';
        const pv = r[5] ? `<span class="${r[5] === "<0.001" ? "p-sig" : ""}">${esc(r[5])}</span>` : '<span class="muted">—</span>';
        const bars = r[2] == null ? "" : `<div class="cmp-bar" aria-label="EHR ${r[2]}%${r[4] != null ? `, CREST-2 ${r[4]}%` : ""}"><i class="e" style="width:${r[2]}%"></i>${r[4] != null ? `<i class="t" style="width:${r[4]}%"></i>` : ""}</div>`;
        html += `<tr${r[3] ? ' class="matched"' : ""}><td>${r[0]}</td><td class="r">${r[1]}</td><td class="r">${trial}</td><td class="r">${pv}</td><td>${bars}</td></tr>`;
      });
    });
    $("#baseBody").innerHTML = html;
    $("#baseCount").textContent = `${shown} variables shown`;
  }
  $$("[data-base]").forEach((b) => b.addEventListener("click", () => {
    baseMode = b.dataset.base;
    $$("[data-base]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderBase();
  }));
  renderBase();

  /* ---------- Outcomes table ---------- */
  const outs = [
    { name: "New ischemic stroke (any)", peri: [74, 1.27, "1.00–1.59"], long: [179, 3.07, "2.64–3.55"] },
    { name: "Anterior circulation ischemic stroke", peri: [36, 0.62, "0.43–0.85"], long: [34, 0.58, "0.40–0.81"] },
    { name: "Posterior circulation ischemic stroke", peri: [1, 0.02, "0.00–0.10"], long: [8, 0.14, "0.06–0.27"] },
    { name: "All-cause deaths", peri: [56, 0.96, "0.73–1.25"], long: [404, 6.93, "6.29–7.61"] },
    { name: "Intracerebral hemorrhage", peri: [11, 0.19, "0.09–0.34"], long: [17, 0.29, "0.17–0.47"] },
    { name: "Composite: ischemic stroke or death", peri: [123, 2.11, "1.76–2.51"], long: [546, 9.36, "8.63–10.14"], total: true }
  ];
  let win = "both", sortK = null, sortDir = 1;
  const cell = (v) => `<td class="r"><b>${v[0]}</b> <span class="muted">(${v[1].toFixed(2)}%)</span><br><span class="small muted">95% CI ${v[2]}</span></td>`;
  function renderOut() {
    let rows = outs.slice();
    if (sortK) rows.sort((a, b) => sortK === "name" ? a.name.localeCompare(b.name) * sortDir : (a[sortK][1] - b[sortK][1]) * sortDir);
    $("#outBody").innerHTML = rows.map((r) => `<tr class="${r.total ? "total" : ""}"><td>${r.name}</td>${win !== "long" ? cell(r.peri) : ""}${win !== "peri" ? cell(r.long) : ""}</tr>`).join("");
    $$("#outTable th[data-col]").forEach((th) => { th.hidden = !(win === "both" || win === th.dataset.col); });
  }
  $$("[data-win]").forEach((b) => b.addEventListener("click", () => {
    win = b.dataset.win;
    $$("[data-win]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderOut();
  }));
  $$("#outTable th.sortable").forEach((th) => {
    th.tabIndex = 0;
    const go = () => {
      const k = th.dataset.k;
      sortDir = sortK === k ? -sortDir : (k === "name" ? 1 : -1);
      sortK = k;
      $$("#outTable th.sortable").forEach((x) => x.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
      renderOut();
    };
    th.addEventListener("click", go);
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
  renderOut();

  /* ---------- Citation ---------- */
  const bibs = {
    medrxiv: `@article{dey2026llmtte,
  title   = {LLM-Driven Target Trial Emulation with Human-in-the-Loop Validation
             for Randomized Trial: Automated Protocol Extraction and
             Real-World Outcome Evaluation},
  author  = {Dey, Samrat Kumar and Qureshi, Adnan I. and Shyu, Chi-Ren},
  journal = {medRxiv},
  year    = {2026},
  doi     = {10.64898/2026.04.09.26350523},
  url     = {https://www.medrxiv.org/content/10.64898/2026.04.09.26350523v1}
}`,
    amia: `@inproceedings{dey2026llmtte_amia,
  title     = {LLM-Driven Target Trial Emulation with Human-in-the-Loop Validation
               for Randomized Trial: Automated Protocol Extraction and
               Real-World Outcome Evaluation},
  author    = {Dey, Samrat Kumar and Qureshi, Adnan I. and Shyu, Chi-Ren},
  booktitle = {AMIA Annual Symposium Proceedings},
  year      = {2026},
  note      = {Podium presentation; to appear}
}`
  };
  let citeKey = "medrxiv";
  const bibEl = $("#bib");
  const setBib = (k) => { citeKey = k; bibEl.textContent = bibs[k]; $$("[data-cite]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cite === k))); };
  $$("[data-cite]").forEach((b) => b.addEventListener("click", () => setBib(b.dataset.cite)));
  setBib("medrxiv");
  $("#copyBib").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const done = (msg) => { btn.textContent = msg; setTimeout(() => (btn.textContent = "Copy"), 1600); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(bibEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); done("Selected, press Ctrl+C"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(bibs[citeKey]).then(() => done("Copied"), fallback);
    else fallback();
  });

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox");
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-zoom]");
    if (!p || !lb || !lb.showModal) return;
    $("#lbImg").src = p.dataset.zoom;
    $("#lbImg").alt = p.dataset.cap || "";
    $("#lbCap").textContent = p.dataset.cap || "";
    lb.showModal();
  });
  $("#lbClose").addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });

  /* ---------- GitHub repo link (derived from the GitHub Pages URL) ---------- */
  const repo = $("#repoLink");
  if (repo) {
    const h = location.hostname, seg = location.pathname.split("/").filter(Boolean)[0];
    if (/\.github\.io$/.test(h)) repo.href = `https://github.com/${h.split(".")[0]}/${seg || h}`;
    else repo.hidden = true;
  }

  /* ---------- Active nav link ---------- */
  const links = $$(".nav-links a");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["abstract", "framework", "design", "hitl", "results", "concordance", "citation"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
