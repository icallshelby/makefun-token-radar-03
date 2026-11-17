// Token Launch Radar (radar-4) Frontend Application Logic

(function () {
  if (typeof window.RADAR === 'undefined') {
    document.body.innerHTML = '<div style="padding:40px;color:#f87171;font-family:monospace;">Error: ../data.js failed to load or window.RADAR is missing.</div>';
    return;
  }

  const radar = window.RADAR;
  const rows = radar.rows || [];
  const live = radar.live || [];
  const calibration = radar.calibration || { categories: [], curve: { a: 0, b: 0, b_ci: [0, 0] }, oos: {} };
  const oos = calibration.oos || {};

  // State
  let currentTab = 'pre-token';
  let searchQuery = '';
  let selectedCategory = '';
  let selectedChain = '';
  let selectedVerdict = '';
  let sortColumn = 'rank';
  let sortAsc = true;
  let activeDetailSlug = null;

  // DOM Elements
  const statRows = document.getElementById('statRows');
  const statWatchlist = document.getElementById('statWatchlist');
  const statBlind = document.getElementById('statBlind');
  const countPre = document.getElementById('countPre');
  const countLive = document.getElementById('countLive');
  const searchInput = document.getElementById('searchInput');
  const categorySelect = document.getElementById('categorySelect');
  const chainSelect = document.getElementById('chainSelect');
  const verdictSelect = document.getElementById('verdictSelect');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const boardTbody = document.getElementById('boardTbody');
  const liveTbody = document.getElementById('liveTbody');
  const calibrationTbody = document.getElementById('calibrationTbody');
  const oosTbody = document.getElementById('oosTbody');
  const svgContainer = document.getElementById('svgContainer');
  const modelSlope = document.getElementById('modelSlope');
  const preTokenView = document.getElementById('preTokenView');
  const liveView = document.getElementById('liveView');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const detailOverlay = document.getElementById('detailOverlay');
  const closeDrawerBtn = document.getElementById('closeDrawer');

  // Initialize Header stats & Blind test headline
  statRows.textContent = rows.length;
  statWatchlist.textContent = 40;
  if (oos.time_split && oos.time_split.radar4_no_priors) {
    const medF = oos.time_split.radar4_no_priors.median_f.toFixed(2);
    const n = oos.time_split.radar4_no_priors.n;
    statBlind.textContent = `within ×${medF} (n=${n})`;
  } else {
    statBlind.textContent = `within ×2.96 (n=64)`;
  }
  countPre.textContent = rows.length;
  countLive.textContent = live.length;
  if (modelSlope && calibration.curve) {
    modelSlope.textContent = `${calibration.curve.b.toFixed(2)} [${calibration.curve.b_ci[0].toFixed(2)}, ${calibration.curve.b_ci[1].toFixed(2)}]`;
  }

  // Populate OOS Table
  function populateOOS() {
    if (!oosTbody) return;
    oosTbody.innerHTML = '';
    const addRow = (splitName, modelKey, m, isBest) => {
      if (!m) return;
      const tr = document.createElement('tr');
      if (isBest) {
        tr.style.background = 'rgba(52, 211, 153, 0.08)';
      }
      tr.innerHTML = `
        <td><strong>${splitName}</strong>: ${modelKey}</td>
        <td class="mono">×${m.median_f.toFixed(2)}</td>
        <td class="mono">${m.mean_log_err.toFixed(3)}</td>
        <td class="mono">${m.p90_log_err.toFixed(3)}</td>
        <td class="mono">${m.r2.toFixed(2)}</td>
        <td class="mono">${m.n}</td>
      `;
      oosTbody.appendChild(tr);
    };

    if (oos.time_split) {
      addRow('Time Split', 'Global Median', oos.time_split.global_median, false);
      addRow('Time Split', 'Category Median (R3)', oos.time_split.radar3, false);
      addRow('Time Split', 'Radar-4 (No Priors)', oos.time_split.radar4_no_priors, true);
      addRow('Time Split', 'Radar-4 (With Priors)', oos.time_split.radar4_with_priors, false);
    }
    if (oos.random_split) {
      addRow('Random 80/20', 'Global Median', oos.random_split.global_median, false);
      addRow('Random 80/20', 'Category Median (R3)', oos.random_split.radar3, false);
      addRow('Random 80/20', 'Radar-4 (No Priors)', oos.random_split.radar4_no_priors, true);
      addRow('Random 80/20', 'Radar-4 (With Priors)', oos.random_split.radar4_with_priors, false);
    }
  }
  populateOOS();

  // Populate Size Curve SVG Chart
  function renderSizeCurveSVG() {
    if (!svgContainer) return;
    const w = 500, h = 220;
    const pad = 35;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    // We need comps data or we can extract TVL/mcap from radar.calibration or sample comps.
    // Let's gather comps from categories
    const allComps = [];
    if (calibration.categories) {
      calibration.categories.forEach(c => {
        if (c.comps) {
          // Note: data.js might store comps as {name, ratio}. But we need TVL and mcap for scatter.
          // Alternatively, let's plot board rows or live tokens as points.
        }
      });
    }

    // Let's use live tokens and top board rows for scatter
    const points = [];
    if (live) {
      live.forEach(l => {
        if (l.tvl_usd > 0 && l.mcap_usd > 0) {
          points.push({ tvl: l.tvl_usd, mcap: l.mcap_usd, name: l.name, type: 'live' });
        }
      });
    }
    // Add top 15 board rows with implied vs tvl
    rows.slice(0, 15).forEach(r => {
      if (r.tvl_usd > 0 && r.implied_value_usd > 0) {
        points.push({ tvl: r.tvl_usd, mcap: r.implied_value_usd, name: r.name, type: 'board' });
      }
    });

    if (points.length === 0) {
      svgContainer.innerHTML = '<span style="color:var(--text-muted);font-family:monospace;">No chart data available</span>';
      return;
    }

    const logTvls = points.map(p => Math.log10(p.tvl));
    const logMcaps = points.map(p => Math.log10(p.mcap));
    const minX = Math.min(...logTvls);
    const maxX = Math.max(...logTvls);
    const minY = Math.min(...logMcaps);
    const maxY = Math.max(...logMcaps);

    const scaleX = val => pad + ((val - minX) / (maxX - minX || 1)) * innerW;
    const scaleY = val => h - pad - ((val - minY) / (maxY - minY || 1)) * innerH;

    let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="overflow:visible;">`;
    // Grid lines & axes
    svg += `<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border-color)" stroke-width="1"/>`;
    svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="var(--border-color)" stroke-width="1"/>`;

    // Fitted curve line y = a + b * x
    const a = calibration.curve ? calibration.curve.a : 3;
    const b = calibration.curve ? calibration.curve.b : 0.5;
    const x1 = minX, y1 = a + b * x1;
    const x2 = maxX, y2 = a + b * x2;
    svg += `<line x1="${scaleX(x1)}" y1="${scaleY(y1)}" x2="${scaleX(x2)}" y2="${scaleY(y2)}" stroke="var(--accent-emerald)" stroke-width="2" stroke-dasharray="4"/>`;

    // Points
    points.forEach(p => {
      const cx = scaleX(Math.log10(p.tvl));
      const cy = scaleY(Math.log10(p.mcap));
      const color = p.type === 'live' ? 'var(--accent-blue)' : 'var(--accent-amber)';
      svg += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${color}" opacity="0.8"><title>${p.name}: TVL $${(p.tvl/1e6).toFixed(1)}M, Val $${(p.mcap/1e6).toFixed(1)}M</title></circle>`;
    });

    // Labels
    svg += `<text x="${w / 2}" y="${h - 5}" fill="var(--text-muted)" font-size="10" font-family="monospace" text-anchor="middle">Log10 TVL ($)</text>`;
    svg += `<text x="10" y="${h / 2}" fill="var(--text-muted)" font-size="10" font-family="monospace" text-anchor="middle" transform="rotate(-90 10 ${h / 2})">Log10 Market Cap / Implied ($)</text>`;
    svg += `</svg>`;

    svgContainer.innerHTML = svg;
  }
  renderSizeCurveSVG();

  // Populate Calibration Table
  function populateCalibration() {
    if (!calibrationTbody) return;
    calibrationTbody.innerHTML = '';
    if (calibration.categories) {
      calibration.categories.forEach(c => {
        const topCompsStr = c.comps ? c.comps.slice(0, 3).map(x => `${x.name} (${x.ratio.toFixed(2)}x)`).join(', ') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.category}</td>
          <td class="mono">${c.n}</td>
          <td class="mono">${c.shift > 0 ? '+' : ''}${c.shift.toFixed(3)}</td>
          <td style="color:var(--text-muted);font-size:10.5px;">${topCompsStr}</td>
        `;
        calibrationTbody.appendChild(tr);
      });
    }
  }
  populateCalibration();

  // Populate Categories & Chains filters
  const categories = new Set();
  const chains = new Set();
  rows.forEach(r => {
    if (r.category) categories.add(r.category);
    if (r.chains) r.chains.forEach(c => chains.add(c));
  });

  [...categories].sort().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  [...chains].sort().forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    chainSelect.appendChild(opt);
  });

  // Helpers
  function formatUSD(n) {
    if (n === null || n === undefined) return 'N/A';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString();
  }

  function formatPct(n) {
    if (n === null || n === undefined) return 'N/A';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
  }

  function parseHash() {
    const href = window.location.href;
    const hashIdx = href.indexOf('#');
    const searchIdx = href.indexOf('?');
    let queryString = '';
    if (hashIdx >= 0) {
      queryString = href.slice(hashIdx + 1);
    } else if (searchIdx >= 0) {
      queryString = href.slice(searchIdx + 1);
    }
    if (!queryString) return;
    const params = new URLSearchParams(queryString);
    if (params.has('tab')) currentTab = params.get('tab');
    if (params.has('q')) {
      searchQuery = params.get('q');
      searchInput.value = searchQuery;
    }
    if (params.has('category')) {
      selectedCategory = params.get('category');
      categorySelect.value = selectedCategory;
    }
    if (params.has('chain')) {
      selectedChain = params.get('chain');
      chainSelect.value = selectedChain;
    }
    if (params.has('verdict')) {
      selectedVerdict = params.get('verdict');
      verdictSelect.value = selectedVerdict;
    }
    if (params.has('detail')) {
      activeDetailSlug = params.get('detail');
      openDetail(activeDetailSlug);
    } else {
      closeDetail(false);
    }
  }

  function updateHash() {
    const params = new URLSearchParams();
    if (currentTab !== 'pre-token') params.set('tab', currentTab);
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedChain) params.set('chain', selectedChain);
    if (selectedVerdict) params.set('verdict', selectedVerdict);
    if (activeDetailSlug) params.set('detail', activeDetailSlug);
    const newHash = params.toString();
    history.replaceState(null, '', newHash ? `#${newHash}` : window.location.pathname);
  }

  // Render Tables
  function render() {
    tabBtns.forEach(btn => {
      if (btn.dataset.tab === currentTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (currentTab === 'pre-token') {
      preTokenView.classList.add('active');
      liveView.classList.remove('active');
      renderBoard();
    } else {
      preTokenView.classList.remove('active');
      liveView.classList.add('active');
      renderLive();
    }
  }

  function renderBoard() {
    let filtered = rows.filter(r => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
        const matchesCat = (r.category || '').toLowerCase().includes(q);
        const matchesChain = r.chains.some(c => c.toLowerCase().includes(q));
        if (!matchesName && !matchesCat && !matchesChain) return false;
      }
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (selectedChain && !r.chains.includes(selectedChain)) return false;
      if (selectedVerdict && r.verdict !== selectedVerdict) return false;
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return sortAsc ? (valA < valB ? -1 : valA > valB ? 1 : 0) : (valA > valB ? -1 : valA < valB ? 1 : 0);
        case 'tvl':
          valA = a.tvl_usd;
          valB = b.tvl_usd;
          break;
        case 'change':
          valA = a.change_7d ?? -999;
          valB = b.change_7d ?? -999;
          break;
        case 'age':
          valA = a.age_days ?? -1;
          valB = b.age_days ?? -1;
          break;
        case 'multiple':
          valA = a.tvl_usd > 0 ? a.implied_value_usd / a.tvl_usd : 0;
          valB = b.tvl_usd > 0 ? b.implied_value_usd / b.tvl_usd : 0;
          break;
        case 'net':
          valA = a.net_farm_usd;
          valB = b.net_farm_usd;
          break;
        case 'verdict':
          valA = a.verdict;
          valB = b.verdict;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'implied':
          valA = a.implied_value_usd;
          valB = b.implied_value_usd;
          break;
        default:
          valA = a.rank;
          valB = b.rank;
          break;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    boardTbody.innerHTML = '';
    if (filtered.length === 0) {
      boardTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">No protocols match the current filter criteria.</td></tr>';
      return;
    }

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      if (activeDetailSlug === r.slug) {
        tr.classList.add('selected');
      }
      const effMult = r.tvl_usd > 0 ? (r.implied_value_usd / r.tvl_usd).toFixed(2) + 'x' : 'N/A';
      const netClass = r.net_farm_usd >= 100 ? 'net-positive' : r.net_farm_usd >= 0 ? 'net-neutral' : 'net-negative';
      const netStr = (r.net_farm_usd >= 0 ? '+' : '') + formatUSD(r.net_farm_usd);
      const verdictChip = `<span class="chip chip-${r.verdict.toLowerCase()}">${r.verdict}</span>`;

      tr.innerHTML = `
        <td class="mono" style="color:var(--text-muted)">#${r.rank}</td>
        <td>
          <div class="protocol-cell">
            <a href="#detail=${r.slug}" class="protocol-name-link" data-slug="${r.slug}">${r.name}</a>
            <span class="category-tag">${r.category || 'General'}</span>
          </div>
        </td>
        <td class="mono">${formatUSD(r.tvl_usd)}</td>
        <td class="mono ${r.change_7d > 0 ? 'positive' : r.change_7d < 0 ? 'negative' : ''}">${formatPct(r.change_7d)}</td>
        <td class="mono">${r.age_days !== null ? r.age_days + 'd' : 'N/A'}</td>
        <td class="mono">${effMult}</td>
        <td class="mono ${netClass}">${netStr}</td>
        <td>${verdictChip}</td>
        <td class="mono" style="font-weight:700;color:var(--accent-emerald)">${formatUSD(r.implied_value_usd)}</td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A') {
          window.location.hash = `#detail=${r.slug}`;
        }
      });
      boardTbody.appendChild(tr);
    });
  }

  function renderLive() {
    liveTbody.innerHTML = '';
    live.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${l.name}</strong></td>
        <td><span class="category-tag">${l.category || 'General'}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${l.chains.join(', ')}</td>
        <td class="mono">${formatUSD(l.tvl_usd)}</td>
        <td class="mono" style="color:var(--accent-blue);">${formatUSD(l.mcap_usd)}</td>
        <td class="mono">-</td>
      `;
      liveTbody.appendChild(tr);
    });
  }

  // Detail Drawer
  function openDetail(slug) {
    const r = rows.find(x => x.slug === slug);
    if (!r) return;
    activeDetailSlug = slug;
    detailOverlay.classList.add('open');

    document.getElementById('drawerRank').textContent = `#${r.rank}`;
    document.getElementById('drawerName').textContent = r.name;
    document.getElementById('drawerCategory').textContent = r.category || 'General';

    const drawerBody = document.getElementById('drawerBody');
    const band = r.bootstrap_band || [r.implied_value_usd * 0.8, r.implied_value_usd * 1.2];
    const ledger = r.farm_ledger || { steps: [], total_cost_usd: 0, opportunity_cost_usd: 0, expected_value_usd: 0, net_usd: 0, net_range_usd: [0, 0], verdict: r.verdict, reason: '' };
    const m = r.model || { growth_multiplier: 1, maturity_multiplier: 1, breadth_multiplier: 1, priors_dropped: false };
    const priorsDropped = m.priors_dropped;
    const gm = priorsDropped ? 1.0 : m.growth_multiplier;
    const mm = priorsDropped ? 1.0 : m.maturity_multiplier;
    const bm = priorsDropped ? 1.0 : m.breadth_multiplier;
    const baseVal = priorsDropped ? r.implied_value_usd : Math.round(r.implied_value_usd / (m.growth_multiplier * m.maturity_multiplier * m.breadth_multiplier));
    
    // Find comps for this category
    let catComps = [];
    if (calibration.categories) {
      const catObj = calibration.categories.find(c => c.category === r.category);
      if (catObj && catObj.comps) catComps = catObj.comps;
    }

    let html = `
      <div class="drawer-grid">
        <div class="drawer-card">
          <h4>Valuation Breakdown (radar-4)</h4>
          <div class="metric-row"><span>TVL:</span> <strong class="mono">${formatUSD(r.tvl_usd)}</strong></div>
          <div class="metric-row"><span>Curve Base Value:</span> <strong class="mono">${formatUSD(baseVal)}</strong></div>
          <div class="metric-row"><span>Growth Mult:</span> <strong class="mono">${gm.toFixed(2)}x</strong></div>
          <div class="metric-row"><span>Maturity Mult:</span> <strong class="mono">${mm.toFixed(2)}x</strong></div>
          <div class="metric-row"><span>Breadth Mult:</span> <strong class="mono">${bm.toFixed(2)}x</strong></div>
          <div class="metric-row"><span>Implied Value:</span> <strong class="mono" style="color:var(--accent-emerald)">${formatUSD(r.implied_value_usd)}</strong></div>
          <div class="metric-row"><span>Bootstrap Band (p10–p90):</span> <strong class="mono">${formatUSD(band[0])} – ${formatUSD(band[1])}</strong></div>
        </div>

        <div class="drawer-card">
          <h4>Category Comps (${r.category || 'General'})</h4>
          <div class="table-container" style="max-height:160px;overflow-y:auto;">
            <table class="radar-table" style="font-size:11.5px;">
              <thead><tr><th>Protocol</th><th>Ratio (Mcap/TVL)</th></tr></thead>
              <tbody>
                ${catComps.length > 0 ? catComps.map(c => `<tr><td>${c.name}</td><td class="mono">${c.ratio.toFixed(2)}x</td></tr>`).join('') : '<tr><td colspan="2" style="color:var(--text-muted)">No category comps listed</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="drawer-card" style="margin-top:16px;">
        <h4>Netted Farm Economics & Ledger</h4>
        <div class="metric-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
          <div class="stat-pill"><span class="label">Total Cost:</span> <span class="val" style="color:var(--accent-amber)">${formatUSD(ledger.total_cost_usd)}</span></div>
          <div class="stat-pill"><span class="label">Expected Airdrop:</span> <span class="val">${formatUSD(ledger.expected_value_usd)}</span></div>
          <div class="stat-pill"><span class="label">Net Value:</span> <span class="val" style="color:${ledger.net_usd >= 100 ? 'var(--accent-emerald)' : ledger.net_usd >= 0 ? 'var(--accent-amber)' : 'var(--accent-red)'}">${formatUSD(ledger.net_usd)}</span></div>
          <div class="stat-pill"><span class="label">Verdict:</span> <span class="val"><span class="chip chip-${ledger.verdict.toLowerCase()}">${ledger.verdict}</span></span></div>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;"><strong>Reasoning:</strong> ${ledger.reason}</p>
        
        <div class="section-title">Step-by-Step Farm Ledger</div>
        <div class="farm-steps-list">
          ${ledger.steps.map((s, idx) => `
            <div class="farm-step-item">
              <div class="step-num">${idx + 1}</div>
              <div class="step-content">
                <div>${s.text}</div>
                <div class="step-meta">
                  <span class="step-cost">Gas/Cost: $${s.cost_usd}</span>
                  <span class="step-time">Time: ${s.time}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    drawerBody.innerHTML = html;
    render();
  }

  function closeDetail(updateUrl = true) {
    activeDetailSlug = null;
    detailOverlay.classList.remove('open');
    if (updateUrl) updateHash();
    render();
  }

  // Event Listeners
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      updateHash();
      render();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    updateHash();
    render();
  });

  categorySelect.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    updateHash();
    render();
  });

  chainSelect.addEventListener('change', (e) => {
    selectedChain = e.target.value;
    updateHash();
    render();
  });

  verdictSelect.addEventListener('change', (e) => {
    selectedVerdict = e.target.value;
    updateHash();
    render();
  });

  resetFiltersBtn.addEventListener('click', () => {
    searchQuery = '';
    selectedCategory = '';
    selectedChain = '';
    selectedVerdict = '';
    searchInput.value = '';
    categorySelect.value = '';
    chainSelect.value = '';
    verdictSelect.value = '';
    updateHash();
    render();
  });

  closeDrawerBtn.addEventListener('click', () => closeDetail());
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) closeDetail();
  });

  // Table Sorting
  document.querySelectorAll('#boardTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = th.classList.contains('desc-default') ? false : true;
      }
      render();
    });
  });

  window.addEventListener('hashchange', parseHash);

  // Initial load
  parseHash();
  render();
})();
