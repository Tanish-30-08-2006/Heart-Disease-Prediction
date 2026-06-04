// =============================================================================
// gauge.js — Reusable Semicircular SVG Gauge + Shared Sidebar Injector
// =============================================================================

// -----------------------------------------------------------------------------
// SIDEBAR — injected into every page via injectSidebar()
// Pass the active page key to highlight the correct nav item.
// Keys: 'dashboard' | 'assessment' | 'results' | 'methodology' | 'about' | 'settings'
// -----------------------------------------------------------------------------

const NAV_ITEMS = [
  { key: 'dashboard',   icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>', label: 'Dashboard',       href: 'index.html',       badge: null },
  { key: 'assessment',  icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>', label: 'New Assessment',  href: 'assessment.html',  badge: null },
  { key: 'results',     icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>', label: 'Results',         href: 'results.html',     badge: null },
  { key: 'methodology', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>', label: 'Methodology',     href: 'methodology.html', badge: null },
  { key: 'about',       icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>', label: 'About',           href: 'about.html',       badge: null },
  { key: 'settings',   icon: '<svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>', label: 'Settings',        href: 'settings.html',    badge: null },
];

function injectSidebar(activeKey) {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const navHTML = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="nav-item ${item.key === activeKey ? 'active' : ''}" title="${item.label}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </a>
  `).join('');

  sidebarEl.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path></svg>
      </div>
      <div class="brand-text">
        <div class="brand-name">CardioRisk</div>
        <div class="brand-sub">Clinical Assessment</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-label">Navigation</div>
      ${navHTML}
    </nav>

    <div class="sidebar-footer">
      <button class="collapse-btn" id="collapse-btn" onclick="toggleSidebar()">
        <span class="nav-icon">◀</span>
        <span class="nav-label">Collapse</span>
      </button>
      <span class="version-tag">CardioRisk v1.0.0 · Academic</span>
    </div>
  `;

  // Restore collapse state from localStorage
  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    sidebarEl.classList.add('collapsed');
    document.querySelector('.main-content')?.classList.add('expanded');
    const btn = document.getElementById('collapse-btn');
    if (btn) btn.querySelector('.nav-icon').textContent = '▶';
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.querySelector('.main-content');
  const btn     = document.getElementById('collapse-btn');
  const collapsed = sidebar.classList.toggle('collapsed');
  main?.classList.toggle('expanded', collapsed);
  if (btn) btn.querySelector('.nav-icon').textContent = collapsed ? '▶' : '◀';
  localStorage.setItem('sidebar_collapsed', collapsed);
}


// -----------------------------------------------------------------------------
// DARK MODE — persisted in localStorage, applied on every page via initTheme()
// -----------------------------------------------------------------------------

function initTheme() {
  const isDark = localStorage.getItem('dark_mode') === 'true';
  if (isDark) document.body.classList.add('dark');

  // Sync the settings toggle if it exists on this page
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = isDark;
}

function setDarkMode(enabled) {
  document.body.classList.toggle('dark', enabled);
  localStorage.setItem('dark_mode', enabled);
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = enabled;
}


// -----------------------------------------------------------------------------
// SEMICIRCULAR GAUGE
//
// Draws an SVG arc gauge.
// pct       : 0-100 value to display
// isHighRisk: boolean — colours the arc red or green
// placeholder: string — shown when no result available yet
// -----------------------------------------------------------------------------

function drawGauge(containerId, pct, isHighRisk, placeholder) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Arc geometry
  const W  = 200;   // SVG width
  const H  = 120;   // SVG height (half-circle)
  const cx = 100;   // centre x
  const cy = 110;   // centre y (slightly below midpoint for better look)
  const R  = 90;    // radius

  // Convert percentage to angle on a 180-degree arc (left to right)
  // 0% = 180deg (left), 100% = 0deg (right), 35% = threshold mark
  function polarToCartesian(angle) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + R * Math.cos(Math.PI - rad),
      y: cy - R * Math.sin(rad)
    };
  }

  const startAngle = 0;    // right end of arc
  const endAngle   = 180;  // left end of arc

  function describeArc(fromDeg, toDeg) {
    const s = polarToCartesian(fromDeg);
    const e = polarToCartesian(toDeg);
    const largeArc = (toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${e.x} ${e.y} A ${R} ${R} 0 ${largeArc} 0 ${s.x} ${s.y}`;
  }

  const fillAngle = placeholder ? 0 : (pct / 100) * 180;
  const thresholdAngle = 0.35 * 180; // 35% mark

  const trackColor = '#F1F5F9';
  const fillColor  = placeholder ? '#F1F5F9' :
                     isHighRisk  ? '#EF4444' : 'var(--accent-clinical)';

  const threshPt = polarToCartesian(thresholdAngle);
  const threshPtOuter = {
    x: cx + (R + 10) * Math.cos(Math.PI - (thresholdAngle * Math.PI / 180)),
    y: cy - (R + 10) * Math.sin(thresholdAngle * Math.PI / 180)
  };
  const threshPtInner = {
    x: cx + (R - 10) * Math.cos(Math.PI - (thresholdAngle * Math.PI / 180)),
    y: cy - (R - 10) * Math.sin(thresholdAngle * Math.PI / 180)
  };

  const displayPct = placeholder ? '—' : pct.toFixed(1) + '%';
  const labelText  = placeholder ? 'No Assessment Yet'
                   : isHighRisk  ? 'ELEVATED RISK'
                                 : 'LOW RISK';
  const labelClass = placeholder ? 'none' : isHighRisk ? 'high' : 'low';

  container.innerHTML = `
    <div class="gauge-container">
      <svg class="gauge-svg" width="${W}" height="${H + 10}" viewBox="0 0 ${W} ${H + 20}">
        <!-- Track arc -->
        <path d="${describeArc(0, 180)}"
              fill="none" stroke="${trackColor}" stroke-width="8"
              stroke-linecap="round"/>

        <!-- Filled arc -->
        ${!placeholder ? `
        <path d="${describeArc(0, fillAngle)}"
              fill="none" stroke="${fillColor}" stroke-width="8"
              stroke-linecap="round"
              style="transition: stroke-dashoffset 1s ease"/>
        ` : ''}

        <!-- 35% Threshold marker -->
        <line x1="${threshPtInner.x}" y1="${threshPtInner.y}"
              x2="${threshPtOuter.x}" y2="${threshPtOuter.y}"
              stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Threshold label -->
        <text x="${threshPtOuter.x - 2}" y="${threshPtOuter.y - 5}"
              font-size="8" fill="#D97706"
              font-family="'JetBrains Mono', monospace"
              text-anchor="middle">35%</text>
      </svg>

      <div class="gauge-center-text">
        <span class="gauge-pct">${displayPct}</span>
        <span class="gauge-label ${labelClass}">${labelText}</span>
        ${!placeholder ? `<span class="gauge-threshold-note">Threshold: 35% · Model: Random Forest</span>` : ''}
        ${placeholder  ? `<span class="gauge-threshold-note">${placeholder}</span>` : ''}
      </div>
    </div>
  `;
}


// -----------------------------------------------------------------------------
// API STATUS CHECKER — used on topbar and settings page
// -----------------------------------------------------------------------------
const API_BASE_URL = 'https://cardiorisk-api-693e.onrender.com'; // ← replace after deploy

async function checkApiStatus(dotId) {
  const dot = document.getElementById(dotId);
  if (!dot) return;
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      dot.classList.remove('offline');
      dot.title = 'API Operational';
    } else throw new Error();
  } catch {
    dot.classList.add('offline');
    dot.title = 'API Offline / Cold Starting';
  }
}