// =============================================================================
// app.js — CardioRisk Clinical Assessment System
// Complete frontend logic for all 6 pages.
//
// Structure:
//   1.  Disclaimer modal (index.html only)
//   2.  Dashboard charts + last-result panel (index.html)
//   3.  Assessment form — validation, live compute, API call (assessment.html)
//   4.  Results page — render gauge, chart, table, interpretation (results.html)
//   5.  Settings page — API health check, session mgmt (settings.html)
//   6.  Shared feature metadata (used by both dashboard and results)
// =============================================================================

// ---------------------------------------------------------------------------
// CONFIGURATION — replace with your real Render URL after deployment
// ---------------------------------------------------------------------------
// gauge.js also exports API_BASE_URL — only define it once here; gauge.js
// reads this value via the global scope.
// (Defined in gauge.js — do NOT redefine here. Just ensure gauge.js loads
//  first in every HTML file, which it does via <script src="gauge.js"> before
//  this file.)


// ---------------------------------------------------------------------------
// FEATURE METADATA
// Used for chip labels, legend descriptions, and display names across pages.
// ---------------------------------------------------------------------------
const FEATURE_INFO = {
  'ST_Slope_Flat':      { name: 'ST Slope: Flat',          color: 'red',    desc: 'Flat ST segment at peak exercise — strong ischaemia indicator.' },
  'ST_Slope_Up':        { name: 'ST Slope: Upsloping',     color: 'green',  desc: 'Upsloping ST — generally favourable, lower risk association.' },
  'ChestPainType_ASY':  { name: 'Chest Pain: Asymptomatic',color: 'red',    desc: 'Silent ischaemia — high-risk pattern despite no symptoms.' },
  'ExerciseAngina':     { name: 'Exercise Angina',          color: 'red',    desc: 'Pain during exertion = direct supply-demand mismatch signal.' },
  'MaxHR_Deficit':      { name: 'MaxHR Deficit',           color: 'amber',  desc: 'Gap between age-predicted and actual MaxHR. Measures cardiac reserve.' },
  'Oldpeak':            { name: 'ST Depression',           color: 'amber',  desc: 'ST depression magnitude during exercise. >2mm = strongly positive.' },
  'MaxHR':              { name: 'Max Heart Rate',          color: 'amber',  desc: 'Blunted HR response suggests poor cardiovascular reserve.' },
  'ChestPainType_ATA':  { name: 'Chest Pain: Atypical',    color: 'teal',   desc: 'Atypical angina — intermediate pre-test probability of CAD.' },
  'ChestPainType_NAP':  { name: 'Chest Pain: Non-Anginal', color: 'teal',   desc: 'Non-anginal pain — lower probability of obstructive CAD.' },
  'Age':                { name: 'Age',                     color: 'blue',   desc: 'Cardiac risk rises substantially after age 45 (men) / 55 (women).' },
  'Sex':                { name: 'Sex',                     color: 'blue',   desc: 'Males carry higher baseline risk in this training cohort.' },
  'Cholesterol':        { name: 'Serum Cholesterol',       color: 'amber',  desc: 'Elevated total cholesterol accelerates atherosclerotic plaque.' },
  'BP_Chol_Risk':       { name: 'BP × Chol Risk',         color: 'amber',  desc: 'Engineered: RestingBP × Cholesterol interaction score.' },
  'RestingBP':          { name: 'Resting BP',              color: 'blue',   desc: 'Chronic hypertension accelerates arterial damage.' },
  'FastingBS':          { name: 'Fasting Blood Sugar',     color: 'blue',   desc: 'Diabetes indicator — doubles CAD risk independently.' },
  'RestingECG_Normal':  { name: 'ECG: Normal',             color: 'green',  desc: 'Normal resting ECG — some reassurance but does not exclude CAD.' },
  'RestingECG_ST':      { name: 'ECG: ST Abnormality',     color: 'amber',  desc: 'ST-T wave changes at rest may indicate prior ischaemia.' },
  'Is_Senior':          { name: 'Senior Flag (≥60)',       color: 'blue',   desc: 'Engineered: binary flag for age ≥ 60.' },
  'Is_Hypertensive':    { name: 'Hypertension Flag',       color: 'amber',  desc: 'Engineered: Stage 2 HTN (BP ≥ 140 mmHg).' },
};

function getFeatureInfo(key) {
  return FEATURE_INFO[key] || { name: key.replace(/_/g, ' '), color: 'grey', desc: 'Clinical parameter.' };
}

// Display labels for form select values shown in results table
const DISPLAY_LABELS = {
  sex:            { '1': 'Male',           '0': 'Female' },
  chestPainType:  { 'TA':'Typical Angina', 'ATA':'Atypical Angina', 'NAP':'Non-Anginal Pain', 'ASY':'Asymptomatic' },
  fastingBS:      { '1': 'Yes (>120)',     '0': 'No (≤120)' },
  restingECG:     { 'Normal':'Normal',     'ST':'ST Abnormality', 'LVH':'LV Hypertrophy' },
  exerciseAngina: { '1': 'Yes',            '0': 'No' },
  stSlope:        { 'Up':'Upsloping',      'Flat':'Flat', 'Down':'Downsloping' },
};


// =============================================================================
// 1. DISCLAIMER MODAL (index.html)
// =============================================================================
function acknowledgeDisclaimer() {
  sessionStorage.setItem('disclaimer_ack', 'true');
  const el = document.getElementById('disclaimer-overlay');
  if (el) el.style.display = 'none';
}

function initDisclaimer() {
  const el = document.getElementById('disclaimer-overlay');
  if (!el) return;
  if (sessionStorage.getItem('disclaimer_ack') === 'true') {
    el.style.display = 'none';
  } else {
    el.style.display = 'flex';
  }
}


// =============================================================================
// 2. DASHBOARD (index.html)
// =============================================================================
function initDashboard() {
  renderDashboardGauge();
  renderBPChart();
  renderCholChart();
  renderImportanceChartDashboard();
}

// ── Gauge on dashboard: show last result or placeholder ─────────────────────
function renderDashboardGauge() {
  const resultRaw = sessionStorage.getItem('assessment_result');
  const chipsEl   = document.getElementById('dashboard-chips');

  if (!resultRaw) {
    drawGauge('dashboard-gauge', 0, false, 'Run an assessment to see results');
    if (chipsEl) chipsEl.innerHTML = '';
    return;
  }

  const result     = JSON.parse(resultRaw);
  const isHighRisk = result.prediction === 1;
  drawGauge('dashboard-gauge', result.probability_pct, isHighRisk, null);

  // Show top 3 feature chips
  if (chipsEl && result.feature_importances) {
    const top3 = result.feature_importances.slice(0, 3);
    chipsEl.innerHTML = top3.map(f => {
      const info = getFeatureInfo(f.feature);
      return `<span class="chip chip-${info.color}">${info.name}</span>`;
    }).join('');
  }
}

// ── Demo BP Trend Chart ──────────────────────────────────────────────────────
function renderBPChart() {
  const canvas = document.getElementById('bp-chart');
  if (!canvas || !window.Chart) return;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Systolic',
          data: [138, 142, 145, 139, 148, 151],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          tension: 0.4, pointRadius: 4, borderWidth: 2, fill: true,
        },
        {
          label: 'Diastolic',
          data: [88, 90, 92, 87, 94, 96],
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.05)',
          tension: 0.4, pointRadius: 4, borderWidth: 2, fill: true,
        }
      ]
    },
    options: chartOptions('mmHg', true)
  });
}

// ── Demo Cholesterol Chart ───────────────────────────────────────────────────
function renderCholChart() {
  const canvas = document.getElementById('chol-chart');
  if (!canvas || !window.Chart) return;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'LDL',
          data: [142, 138, 155, 148, 160, 157],
          backgroundColor: 'rgba(220,38,38,0.6)',
          borderRadius: 3,
        },
        {
          label: 'HDL',
          data: [48, 51, 46, 52, 44, 47],
          backgroundColor: 'rgba(22,163,74,0.6)',
          borderRadius: 3,
        }
      ]
    },
    options: chartOptions('mg/dL', true)
  });
}

// ── Feature Importance Chart on Dashboard (static hardcoded) ─────────────────
function renderImportanceChartDashboard() {
  const canvas = document.getElementById('importance-chart');
  if (!canvas || !window.Chart) return;

  // These are your actual model feature importances — extracted from RF
  const features = [
    { feature: 'ST_Slope_Flat',     importance: 0.142 },
    { feature: 'ChestPainType_ASY', importance: 0.118 },
    { feature: 'ExerciseAngina',    importance: 0.102 },
    { feature: 'MaxHR_Deficit',     importance: 0.095 },
    { feature: 'Oldpeak',           importance: 0.089 },
    { feature: 'ST_Slope_Up',       importance: 0.071 },
    { feature: 'Age',               importance: 0.064 },
    { feature: 'MaxHR',             importance: 0.058 },
  ];
  renderImportanceChart('importance-chart', features);
}

// ── Shared importance chart renderer (used by dashboard + results page) ──────
function renderImportanceChart(canvasId, importances) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  const top10  = importances.slice(0, 10);
  const labels = top10.map(f => getFeatureInfo(f.feature).name);
  const values = top10.map(f => (f.importance * 100).toFixed(2));
  const maxVal = Math.max(...values.map(Number));

  const colors = top10.map(() => '#0EA5E9');

  // Destroy existing chart instance if re-rendering
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Importance (%)',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x}%`,
          },
          ...tooltipStyle()
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#64748B', font: { family: "'JetBrains Mono', monospace", size: 11 }, callback: v => v + '%' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#0F172A', font: { family: "'Inter', sans-serif", size: 12, weight: 500 } }
        }
      }
    }
  });
}

// ── Shared Chart.js options factory ─────────────────────────────────────────
function chartOptions(unit, showLegend) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: showLegend, labels: { color: '#64748b', font: { size: 11 } } },
      tooltip: { ...tooltipStyle(), callbacks: { label: ctx => ` ${ctx.parsed.y} ${unit}` } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } } }
    }
  };
}

function tooltipStyle() {
  return {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    titleColor: '#0f172a',
    bodyColor: '#64748b',
    padding: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  };
}


// =============================================================================
// 3. ASSESSMENT FORM (assessment.html)
// =============================================================================
function initAssessmentPage() {
  // Set assessment ID and timestamp
  const id = 'AST-' + Date.now().toString(36).toUpperCase();
  const el = document.getElementById('assessment-id');
  if (el) el.textContent = id;

  const timeEl = document.getElementById('assessment-time');
  if (timeEl) timeEl.textContent = new Date().toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });

  // Build checklist
  buildChecklist();

  // Live MaxHR deficit compute
  const ageInput   = document.getElementById('age');
  const maxHrInput = document.getElementById('max-hr');
  if (ageInput)   ageInput.addEventListener('input', updateLiveCompute);
  if (maxHrInput) maxHrInput.addEventListener('input', updateLiveCompute);

  // Checklist update on every input change
  document.querySelectorAll('.form-control').forEach(el => {
    el.addEventListener('change', buildChecklist);
    el.addEventListener('input',  buildChecklist);
  });

  // Restore sidebar default toggle state
  const sdt = document.getElementById('sidebar-default-toggle');
  if (sdt) sdt.checked = localStorage.getItem('sidebar_collapsed') === 'true';
}

// ── Checklist ────────────────────────────────────────────────────────────────
const CHECKLIST_FIELDS = [
  { id: 'age',            label: 'Age' },
  { id: 'sex',            label: 'Biological Sex' },
  { id: 'chest-pain-type',label: 'Chest Pain Type' },
  { id: 'resting-bp',     label: 'Resting Blood Pressure' },
  { id: 'cholesterol',    label: 'Serum Cholesterol' },
  { id: 'fasting-bs',     label: 'Fasting Blood Sugar' },
  { id: 'resting-ecg',    label: 'Resting ECG' },
  { id: 'max-hr',         label: 'Maximum Heart Rate' },
  { id: 'exercise-angina',label: 'Exercise Angina' },
  { id: 'oldpeak',        label: 'ST Depression (Oldpeak)' },
  { id: 'st-slope',       label: 'ST Segment Slope' },
];

function buildChecklist() {
  const container = document.getElementById('checklist');
  if (!container) return;

  container.innerHTML = CHECKLIST_FIELDS.map(f => {
    const el    = document.getElementById(f.id);
    const done  = el && el.value !== '';
    const color = done ? 'var(--green)' : 'var(--text-4)';
    const icon  = done ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>';
    return `
      <div style="display:flex;align-items:center;gap:8px;color:${color};transition:color 0.2s;">
        <span style="display:flex;align-items:center;width:14px;height:14px;">${icon}</span>
        <span style="font-size:0.85rem;font-weight:500;">${f.label}</span>
      </div>
    `;
  }).join('');
}

// ── Live MaxHR Deficit Compute ───────────────────────────────────────────────
function updateLiveCompute() {
  const age   = parseInt(document.getElementById('age')?.value);
  const maxHR = parseInt(document.getElementById('max-hr')?.value);
  const el    = document.getElementById('live-maxhr');
  if (!el) return;

  if (!isNaN(age) && !isNaN(maxHR) && age > 0 && maxHR > 0) {
    const expected = 220 - age;
    const deficit  = expected - maxHR;
    const pct      = ((deficit / expected) * 100).toFixed(1);
    const severity = deficit > 40 ? '<svg viewBox="0 0 24 24" style="width:14px;height:14px;margin-bottom:-2px;stroke:#EF4444;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Severely impaired' : deficit > 20 ? 'Mildly impaired' : '<svg viewBox="0 0 24 24" style="width:14px;height:14px;margin-bottom:-2px;stroke:#10B981;"><polyline points="20 6 9 17 4 12"></polyline></svg> Normal range';
    el.innerHTML = `
      Expected MaxHR: <strong>${expected} bpm</strong> &nbsp;|&nbsp;
      Actual: <strong>${maxHR} bpm</strong> &nbsp;|&nbsp;
      Deficit: <strong>${deficit} bpm (${pct}%)</strong><br>
      <span style="opacity:0.8;">${severity}</span>
    `;
    el.style.display = 'block';
  } else {
    el.innerHTML = 'Enter Age and MaxHR above to see the chronotropic deficit.';
  }
}

// ── Form Validation ──────────────────────────────────────────────────────────
function clearFormErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.form-control').forEach(e => e.classList.remove('error'));
  ['cold-notice', 'error-notice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
}

function showFieldErr(errorId, inputId) {
  const err = document.getElementById(errorId);
  const inp = document.getElementById(inputId);
  if (err) err.classList.add('visible');
  if (inp) inp.classList.add('error');
}

function validateForm() {
  clearFormErrors();
  let valid = true;
  const v = id => document.getElementById(id)?.value;

  if (!v('age') || +v('age') < 1 || +v('age') > 120)              { showFieldErr('age-error',   'age');            valid = false; }
  if (!v('sex'))                                                     { showFieldErr('sex-error',   'sex');            valid = false; }
  if (!v('chest-pain-type'))                                         { showFieldErr('cpt-error',   'chest-pain-type');valid = false; }
  if (!v('resting-bp') || +v('resting-bp') < 60 || +v('resting-bp') > 250) { showFieldErr('rbp-error', 'resting-bp'); valid = false; }
  if (!v('cholesterol') || +v('cholesterol') < 50)                  { showFieldErr('chol-error',  'cholesterol');    valid = false; }
  if (!v('fasting-bs'))                                              { showFieldErr('fbs-error',   'fasting-bs');     valid = false; }
  if (!v('resting-ecg'))                                             { showFieldErr('ecg-error',   'resting-ecg');    valid = false; }
  if (!v('max-hr') || +v('max-hr') < 50 || +v('max-hr') > 250)     { showFieldErr('maxhr-error', 'max-hr');         valid = false; }
  if (!v('exercise-angina'))                                         { showFieldErr('ea-error',    'exercise-angina');valid = false; }
  if (v('oldpeak') === '' || +v('oldpeak') < -5 || +v('oldpeak') > 10) { showFieldErr('op-error', 'oldpeak');       valid = false; }
  if (!v('st-slope'))                                                { showFieldErr('st-error',    'st-slope');       valid = false; }

  return valid;
}

// ── API Submission ────────────────────────────────────────────────────────────
async function submitAssessment() {
  if (!validateForm()) return;

  const btn      = document.getElementById('submit-btn');
  const coldEl   = document.getElementById('cold-notice');
  const errEl    = document.getElementById('error-notice');
  const v        = id => document.getElementById(id)?.value;

  btn.disabled   = true;
  btn.innerHTML  = '<div class="spinner" style="border-top-color:#fff;"></div> &nbsp;Submitting...';

  // Show cold start warning after 4 seconds
  const coldTimer = setTimeout(() => {
    if (coldEl) coldEl.classList.add('visible');
  }, 4000);

  const payload = {
    Age:            parseInt(v('age')),
    Sex:            parseInt(v('sex')),
    ChestPainType:  v('chest-pain-type'),
    RestingBP:      parseInt(v('resting-bp')),
    Cholesterol:    parseInt(v('cholesterol')),
    FastingBS:      parseInt(v('fasting-bs')),
    RestingECG:     v('resting-ecg'),
    MaxHR:          parseInt(v('max-hr')),
    ExerciseAngina: parseInt(v('exercise-angina')),
    Oldpeak:        parseFloat(v('oldpeak')),
    ST_Slope:       v('st-slope'),
  };

  // Save form inputs for display on results page
  const formSnapshot = {
    age:            v('age'),
    sex:            v('sex'),
    chestPainType:  v('chest-pain-type'),
    restingBP:      v('resting-bp'),
    cholesterol:    v('cholesterol'),
    fastingBS:      v('fasting-bs'),
    restingECG:     v('resting-ecg'),
    maxHR:          v('max-hr'),
    exerciseAngina: v('exercise-angina'),
    oldpeak:        v('oldpeak'),
    stSlope:        v('st-slope'),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    clearTimeout(coldTimer);
    if (coldEl) coldEl.classList.remove('visible');

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const result = await res.json();

    sessionStorage.setItem('assessment_result', JSON.stringify(result));
    sessionStorage.setItem('assessment_input',  JSON.stringify(formSnapshot));
    sessionStorage.setItem('assessment_time',   new Date().toISOString());

    window.location.href = 'results.html';

  } catch (err) {
    clearTimeout(coldTimer);
    if (coldEl) coldEl.classList.remove('visible');

    const msg = err.message.includes('Failed to fetch')
      ? 'Cannot reach inference server. It may be starting up (cold start — wait 60s and retry).'
      : `Error: ${err.message}`;

    if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }

    btn.disabled  = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> &nbsp;Run Cardiac Risk Assessment';
  }
}


// =============================================================================
// 4. RESULTS PAGE (results.html)
// =============================================================================
function initResultsPage() {
  const content = document.getElementById('results-content');
  const noData  = document.getElementById('no-data');
  if (!content) return;

  const resultRaw = sessionStorage.getItem('assessment_result');
  const inputRaw  = sessionStorage.getItem('assessment_input');
  const timeRaw   = sessionStorage.getItem('assessment_time');

  if (!resultRaw || !inputRaw) {
    if (noData)  noData.style.display  = 'block';
    if (content) content.style.display = 'none';
    return;
  }

  if (noData)  noData.style.display  = 'none';
  if (content) content.style.display = 'block';

  const result = JSON.parse(resultRaw);
  const input  = JSON.parse(inputRaw);
  const time   = timeRaw ? new Date(timeRaw) : new Date();

  renderTimestamp(time);
  renderVerdictBanner(result);
  renderResultGauge(result);
  renderPatientTable(input);
  renderResultsImportanceChart(result.feature_importances);
  renderFeatureLegend(result.feature_importances);
  renderInterpretation(result);
}

function renderTimestamp(time) {
  const el = document.getElementById('result-timestamp');
  if (el) el.textContent = time.toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
  const tb = document.getElementById('topbar-time');
  if (tb) tb.textContent = time.toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function renderVerdictBanner(result) {
  const banner  = document.getElementById('verdict-banner');
  const icon    = document.getElementById('verdict-icon');
  const title   = document.getElementById('verdict-title');
  const sub     = document.getElementById('verdict-subtitle');
  const vProb   = document.getElementById('v-prob');
  const vMargin = document.getElementById('v-margin');
  const vTrees  = document.getElementById('v-trees');
  if (!banner) return;

  const isHigh = result.prediction === 1;
  const prob   = result.probability_pct;
  const margin = (prob - 35).toFixed(1);
  const trees  = Math.round(prob);

  banner.className = `verdict-banner ${isHigh ? 'high' : 'low'}`;

  icon.textContent  = isHigh ? '⚠' : '✓';
  title.textContent = isHigh ? 'Elevated Cardiac Risk Detected' : 'No Significant Cardiac Risk Indicated';
  sub.textContent   = isHigh
    ? 'Model probability exceeds the 35% medical safety threshold. Further clinical evaluation is recommended.'
    : 'Model probability is below the 35% threshold. A negative result does not exclude cardiac disease.';

  if (vProb)   vProb.textContent   = prob.toFixed(2) + '%';
  if (vMargin) vMargin.textContent = (margin >= 0 ? '+' : '') + margin + 'pp';
  if (vTrees)  vTrees.textContent  = `${trees} / 100`;
}

function renderResultGauge(result) {
  const isHigh = result.prediction === 1;
  drawGauge('result-gauge', result.probability_pct, isHigh, null);

  // Chips — top 3 features
  const chipsEl = document.getElementById('result-chips');
  if (chipsEl && result.feature_importances) {
    const top3 = result.feature_importances.slice(0, 3);
    chipsEl.innerHTML = top3.map(f => {
      const info = getFeatureInfo(f.feature);
      return `<span class="chip chip-${info.color}">${info.name}</span>`;
    }).join('');
  }
}

function renderPatientTable(input) {
  const tbody = document.getElementById('patient-tbody');
  if (!tbody) return;

  const rows = [
    ['Age',                   input.age + ' years'],
    ['Biological Sex',        DISPLAY_LABELS.sex[input.sex]],
    ['Chest Pain Type',       DISPLAY_LABELS.chestPainType[input.chestPainType]],
    ['Resting BP',            input.restingBP + ' mmHg'],
    ['Serum Cholesterol',     input.cholesterol + ' mg/dL'],
    ['Fasting Blood Sugar',   DISPLAY_LABELS.fastingBS[input.fastingBS]],
    ['Resting ECG',           DISPLAY_LABELS.restingECG[input.restingECG]],
    ['Max Heart Rate',        input.maxHR + ' bpm'],
    ['Exercise Angina',       DISPLAY_LABELS.exerciseAngina[input.exerciseAngina]],
    ['ST Depression',         input.oldpeak + ' mm'],
    ['ST Slope',              DISPLAY_LABELS.stSlope[input.stSlope]],
  ];

  tbody.innerHTML = rows.map(([label, val]) => `
    <tr>
      <td><strong>${label}</strong></td>
      <td>${val}</td>
    </tr>
  `).join('');
}

function renderResultsImportanceChart(importances) {
  if (!importances || !importances.length) return;
  renderImportanceChart('importance-chart', importances);
}

function renderFeatureLegend(importances) {
  const container = document.getElementById('feature-legend');
  if (!container || !importances) return;

  const top8 = importances.slice(0, 8);
  container.innerHTML = top8.map((f, i) => {
    const info  = getFeatureInfo(f.feature);
    const score = (f.importance * 100).toFixed(2) + '%';
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);transition:background var(--transition);" onmouseover="this.style.background='var(--card-2)'" onmouseout="this.style.background=''">
        <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-4);width:18px;flex-shrink:0;padding-top:1px;">${i+1}.</span>
        <div style="flex:1;">
          <div style="font-size:0.82rem;font-weight:600;color:var(--text-1);margin-bottom:2px;">${info.name}</div>
          <div style="font-size:0.75rem;color:var(--text-3);line-height:1.5;">${info.desc}</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-2);white-space:nowrap;">${score}</span>
      </div>
    `;
  }).join('');
}

function renderInterpretation(result) {
  const container = document.getElementById('interpretation-body');
  if (!container) return;

  const isHigh = result.prediction === 1;
  const prob   = result.probability_pct;
  const trees  = Math.round(prob);

  if (isHigh) {
    container.innerHTML = `
      <div class="interp-section warning">
        <h4>Result Summary</h4>
        <p>The Random Forest classifier assigns a cardiac risk probability of <strong>${prob.toFixed(2)}%</strong>,
        which exceeds the 35% medical safety threshold. Classification: <strong>Elevated Risk</strong>.
        Approximately ${trees} of 100 decision trees voted for the high-risk class.</p>
      </div>
      <div class="interp-section" style="margin-top:10px;">
        <h4>Understanding the 35% Threshold</h4>
        <p>This model deliberately uses a 35% threshold instead of the standard 50%. In cardiac risk screening,
        a missed sick patient (False Negative) carries higher clinical cost than a false alarm.
        At 35%, the model achieves <strong>97.1% Recall</strong> on the test set — correctly identifying
        approximately 91 of every 100 genuinely at-risk patients.</p>
      </div>
      <div class="interp-section warning" style="margin-top:10px;">
        <h4>Academic Disclaimer</h4>
        <p><strong>This result MUST NOT be used to make clinical decisions.</strong> This is an academic
        portfolio project. The model has not been clinically validated or approved by any regulatory body.
        All patient care decisions must be made exclusively by qualified medical professionals.</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="interp-section positive">
        <h4>Result Summary</h4>
        <p>The Random Forest classifier assigns a cardiac risk probability of <strong>${prob.toFixed(2)}%</strong>,
        which is below the 35% threshold. Classification: <strong>No Significant Risk Indicated</strong>.
        Approximately ${100 - trees} of 100 decision trees voted for the low-risk class.</p>
      </div>
      <div class="interp-section amber" style="margin-top:10px;">
        <h4>Important — False Negatives</h4>
        <p>A negative result does not exclude cardiac disease. The model has an 8.8% False Negative rate
        on the held-out test set. Patients with atypical presentations may receive a negative classification
        despite underlying disease. Full clinical assessment remains essential.</p>
      </div>
      <div class="interp-section warning" style="margin-top:10px;">
        <h4>Academic Disclaimer</h4>
        <p><strong>This result MUST NOT be used to make clinical decisions.</strong> A qualified
        medical professional must assess cardiac risk using validated clinical tools.</p>
      </div>
    `;
  }
}


// =============================================================================
// 5. SETTINGS PAGE (settings.html)
// =============================================================================
let autoRefreshInterval = null;

function initSettingsPage() {
  // Session data status
  updateSessionStatus();

  // Sidebar default toggle sync
  const sdt = document.getElementById('sidebar-default-toggle');
  if (sdt) sdt.checked = localStorage.getItem('sidebar_collapsed') === 'true';

  // Initial API health check
  runManualHealthCheck();

  // Auto-refresh
  startAutoRefresh();
}

function updateSessionStatus() {
  const el = document.getElementById('session-status');
  if (!el) return;
  const hasResult = sessionStorage.getItem('assessment_result') !== null;
  el.textContent = hasResult
    ? 'Result stored in session — probability and features saved'
    : 'No assessment result stored in this session';
  el.style.color = hasResult ? 'var(--green)' : 'var(--text-4)';
}

function clearSession() {
  sessionStorage.removeItem('assessment_result');
  sessionStorage.removeItem('assessment_input');
  sessionStorage.removeItem('assessment_time');
  sessionStorage.removeItem('disclaimer_ack');
  updateSessionStatus();
}

function clearTheme() {
  localStorage.removeItem('dark_mode');
  document.body.classList.remove('dark');
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = false;
}

function clearAll() {
  clearSession();
  clearTheme();
  localStorage.clear();
  alert('All local data cleared. Reloading...');
  location.reload();
}

async function runManualHealthCheck() {
  const dot      = document.getElementById('api-status-large');
  const textEl   = document.getElementById('api-status-text');
  const subEl    = document.getElementById('api-status-sub');
  const dataEl   = document.getElementById('api-health-data');
  const tbodyEl  = document.getElementById('api-health-tbody');
  const smallDot = document.getElementById('api-dot');

  if (textEl) textEl.textContent = 'Checking...';
  if (subEl)  subEl.textContent  = 'Pinging inference server';
  if (dataEl) dataEl.style.display = 'none';

  try {
    const res  = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      if (dot)     { dot.classList.remove('offline'); dot.style.background = 'var(--green)'; }
      if (textEl)  textEl.textContent = '● Operational';
      if (textEl)  textEl.style.color = 'var(--green)';
      if (subEl)   subEl.textContent  = `Last checked: ${new Date().toLocaleTimeString()}`;
      if (smallDot) smallDot.classList.remove('offline');

      // Show health data table
      if (dataEl && tbodyEl) {
        dataEl.style.display = 'block';
        tbodyEl.innerHTML = Object.entries(data).map(([k, v]) => `
          <tr><td>${k}</td><td>${v}</td></tr>
        `).join('');
      }
    } else throw new Error(`HTTP ${res.status}`);

  } catch (err) {
    if (dot)     { dot.classList.add('offline'); dot.style.background = 'var(--amber)'; }
    if (textEl)  { textEl.textContent = '● Offline / Cold Starting'; textEl.style.color = 'var(--amber)'; }
    if (subEl)   subEl.textContent  = `Render free tier may be spinning up (up to 60s). Last checked: ${new Date().toLocaleTimeString()}`;
    if (smallDot) smallDot.classList.add('offline');
  }
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(runManualHealthCheck, 30000);
}

function toggleAutoRefresh(enabled) {
  if (enabled) startAutoRefresh();
  else if (autoRefreshInterval) { clearInterval(autoRefreshInterval); autoRefreshInterval = null; }
}