// ═══════════════════════════════════════════
// ═══ MARKET INTELLIGENCE (Phase 6) ═══
// ═══════════════════════════════════════════

// ═══ TAB INJECTION ═══
const _intelOrigRD = renderDashboard;
renderDashboard = function() {
  _intelOrigRD();
  const iv = document.getElementById('intelView');
  if (view === 'intel') {
    document.getElementById('listArea').style.display = 'none';
    const sb = document.getElementById('searchBox');
    if (sb) sb.parentElement.parentElement.style.display = 'none';
    document.getElementById('countLabel').textContent = 'Intelligence';
    if (iv) iv.style.display = '';
    renderIntelView();
  } else {
    if (iv) iv.style.display = 'none';
    document.getElementById('listArea').style.display = '';
  }
};
const _intelOrigSV = setView;
setView = function(v) {
  if (v === 'intel') { view = 'intel'; renderDashboard(); return; }
  _intelOrigSV(v);
};

// ═══ DATA CACHE ═══
let _intelData = null;
let _intelLoading = false;

async function loadIntelData(force) {
  if (_intelData && !force) return _intelData;
  if (_intelLoading) return null;
  _intelLoading = true;

  const [communities, flips, seasonal, domGrades, agents] = await Promise.all([
    fetch(SB + '/rest/v1/community_production_stats?is_gated=eq.true&avg_sale_price=gte.600000&avg_sale_price=lte.2000000&order=total_sales.desc&limit=15', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/detected_flips?order=sell_date.desc', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/seasonal_patterns?order=sale_month', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/dom_grade_summary?order=dom_grade', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/agent_activity?order=deal_count.desc&limit=20', { headers: HD }).then(r => r.json()).catch(() => [])
  ]);

  _intelData = { communities, flips, seasonal, domGrades, agents };
  _intelLoading = false;
  return _intelData;
}

// ═══ MAIN RENDER ═══
async function renderIntelView() {
  const el = document.getElementById('intelView');
  if (!el) return;

  el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">🧠</div><div style="font-size:13px">Loading market intelligence...</div></div>';

  const data = await loadIntelData();
  if (!data) return;

  let h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<div><div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px">MARKET INTELLIGENCE</div>';
  h += '<div style="font-size:11px;color:#475569;margin-top:2px">' + (data.communities.length || 0) + ' communities \u00b7 ' + (data.flips.length || 0) + ' flips detected \u00b7 ' + (data.agents.length || 0) + ' active agents</div></div>';
  h += '<button onclick="loadIntelData(true).then(()=>renderIntelView())" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(212,175,55,0.2);background:rgba(212,175,55,0.06);color:#d4af37;font-size:10px;font-weight:700;cursor:pointer">\u21bb Refresh</button>';
  h += '</div>';

  h += renderCommunityCard(data.communities);
  h += renderFlipCard(data.flips);
  h += renderSeasonalCard(data.seasonal);
  h += renderDOMCard(data.domGrades);
  h += renderAgentCard(data.agents);

  el.innerHTML = h;
}

// ═══ HELPERS ═══
function _titleCase(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function _truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '…' : s;
}

function _ppsfColor(v) {
  if (v >= 400) return '#22c55e';
  if (v >= 350) return '#d4af37';
  return '#e2e8f0';
}

function _domColor(v) {
  if (v <= 40) return '#22c55e';
  if (v <= 60) return '#d4af37';
  return '#ef4444';
}

function _stlColor(v) {
  if (v >= 0.97) return '#22c55e';
  if (v >= 0.95) return '#d4af37';
  return '#ef4444';
}

function _monthName(m) {
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m] || m;
}

// ═══ CARD 1: COMMUNITY LEADERBOARD ═══
function renderCommunityCard(communities) {
  if (!communities || !communities.length) return '';

  let h = '<details open class="intel-card"><summary>COMMUNITY LEADERBOARD <span style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0">' + communities.length + '</span></summary>';
  h += '<div class="table-scroll" style="padding:0 12px 14px">';
  h += '<table><thead><tr>';
  h += '<th>Community</th><th>ZIP</th><th>Sales</th><th>Avg PPSF</th><th>Range</th><th>Avg DOM</th><th>Sale/List</th>';
  h += '</tr></thead><tbody>';

  communities.forEach(c => {
    const name = _truncate(_titleCase(c.subdivision_name || ''), 30);
    const ppsf = Math.round(c.avg_ppsf || 0);
    const dom = Math.round(c.avg_dom || 0);
    const stl = c.avg_sale_to_list || 0;
    const stlPct = (stl * 100).toFixed(1);
    const floor = Math.round(c.min_ppsf || 0);
    const ceil = Math.round(c.max_ppsf || 0);

    h += '<tr>';
    h += '<td style="color:#f1f5f9;font-weight:600;white-space:normal;min-width:140px">' + esc(name) + '</td>';
    h += '<td style="color:#94a3b8">' + esc(c.zip_code || '') + '</td>';
    h += '<td style="color:#e2e8f0;font-weight:700">' + (c.total_sales || 0) + '</td>';
    h += '<td style="color:' + _ppsfColor(ppsf) + ';font-weight:700">$' + ppsf + '</td>';
    h += '<td style="color:#94a3b8;font-size:11px">$' + floor + ' – $' + ceil + '</td>';
    h += '<td style="color:' + _domColor(dom) + ';font-weight:600">' + dom + '</td>';
    h += '<td style="color:' + _stlColor(stl) + ';font-weight:600">' + stlPct + '%</td>';
    h += '</tr>';
  });

  h += '</tbody></table></div></details>';
  return h;
}

// ═══ CARD 2: FLIP ACTIVITY ═══
function renderFlipCard(flips) {
  if (!flips || !flips.length) return '';

  let h = '<details open class="intel-card"><summary>FLIP ACTIVITY <span style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0">' + flips.length + '</span></summary>';
  h += '<div style="padding:0 12px 14px">';

  flips.forEach(f => {
    const buy = f.buy_price || 0;
    const sell = f.sell_price || 0;
    const spread = sell - buy;
    const months = f.hold_months != null ? parseFloat(f.hold_months).toFixed(1) : '?';
    const grade = (f.flip_grade || '').toLowerCase();

    let badgeColor = '#64748b';
    let badgeLabel = grade;
    if (grade === 'winner') { badgeColor = '#22c55e'; badgeLabel = 'WINNER'; }
    else if (grade === 'moderate') { badgeColor = '#d4af37'; badgeLabel = 'MODERATE'; }
    else if (grade === 'marginal') { badgeColor = '#f97316'; badgeLabel = 'MARGINAL'; }
    else if (grade === 'break_even' || grade === 'break even') { badgeColor = '#ef4444'; badgeLabel = 'BREAK EVEN'; }

    h += '<div class="flip-card">';
    h += '<div style="font-size:13px;font-weight:700;color:#f1f5f9">' + esc(f.address || '') + '</div>';
    h += '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(_titleCase(f.subdivision_name || '')) + ' \u00b7 ' + esc(f.zip_code || '') + '</div>';
    h += '<div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">';
    h += '<span style="font-size:12px;color:#94a3b8">' + $k(buy) + ' \u2192 ' + $k(sell) + '</span>';
    h += '<span style="font-size:12px;color:#22c55e;font-weight:700">+' + $k(spread) + '</span>';
    h += '<span style="font-size:11px;color:#64748b">' + months + ' mo</span>';
    h += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:0.5px;color:#0a0a0f;background:' + badgeColor + '">' + badgeLabel + '</span>';
    h += '</div></div>';
  });

  h += '</div></details>';
  return h;
}

// ═══ CARD 3: SEASONAL TIMING ═══
function renderSeasonalCard(seasonal) {
  if (!seasonal || !seasonal.length) return '';

  // Filter out months with < 10 sales (noise)
  const valid = seasonal.filter(s => (s.total_sales || 0) >= 10);
  if (!valid.length) return '';

  let h = '<details open class="intel-card"><summary>WHEN TO LIST</summary>';
  h += '<div class="table-scroll" style="padding:0 12px 14px">';
  h += '<table><thead><tr>';
  h += '<th>Month</th><th>Sales</th><th>Avg DOM</th><th>Sale/List</th><th>Rating</th>';
  h += '</tr></thead><tbody>';

  let bestMonth = valid[0];

  valid.forEach(s => {
    const dom = Math.round(s.avg_dom || 0);
    const stl = s.avg_sale_to_list || 0;
    const stlPct = (stl * 100).toFixed(1);

    let rating, ratingColor;
    if (dom <= 45 && stl >= 0.975) { rating = '\ud83d\udfe2 PRIME'; ratingColor = '#22c55e'; }
    else if (dom <= 55 && stl >= 0.965) { rating = '\ud83d\udfe1 GOOD'; ratingColor = '#d4af37'; }
    else { rating = '\ud83d\udd34 SLOW'; ratingColor = '#ef4444'; }

    // Track best month (lowest DOM + highest STL)
    if (dom < (bestMonth.avg_dom || 999) || (dom === Math.round(bestMonth.avg_dom || 999) && stl > (bestMonth.avg_sale_to_list || 0))) {
      bestMonth = s;
    }

    h += '<tr>';
    h += '<td style="color:#f1f5f9;font-weight:600">' + _monthName(s.sale_month) + '</td>';
    h += '<td style="color:#e2e8f0">' + (s.total_sales || 0) + '</td>';
    h += '<td style="color:' + _domColor(dom) + ';font-weight:600">' + dom + '</td>';
    h += '<td style="color:' + _stlColor(stl) + ';font-weight:600">' + stlPct + '%</td>';
    h += '<td style="color:' + ratingColor + ';font-weight:700;font-size:11px">' + rating + '</td>';
    h += '</tr>';
  });

  h += '</tbody></table></div>';

  // Best listing window insight
  const bDom = Math.round(bestMonth.avg_dom || 0);
  const bStl = ((bestMonth.avg_sale_to_list || 0) * 100).toFixed(1);
  h += '<div class="insight-line" style="margin:0 12px 14px">Best listing window: ' + _monthName(bestMonth.sale_month) + ' \u2014 ' + bDom + ' avg DOM, ' + bStl + '% of asking</div>';

  h += '</details>';
  return h;
}

// ═══ CARD 4: DOM vs PRICE (Speed Grading) ═══
function renderDOMCard(domGrades) {
  if (!domGrades || !domGrades.length) return '';

  const gradeColors = { A: '#22c55e', B: '#14b8a6', C: '#d4af37', D: '#f97316', F: '#ef4444' };
  const gradeLabels = { A: 'Hot', B: 'Strong', C: 'Normal', D: 'Slow', F: 'Stale' };
  const gradeRanges = { A: '0-14 days', B: '15-30 days', C: '31-60 days', D: '61-90 days', F: '90+ days' };

  let h = '<details class="intel-card"><summary>SPEED vs PRICE</summary>';
  h += '<div style="padding:0 12px 14px">';

  let gradeA = null, gradeD = null;

  domGrades.forEach(g => {
    const grade = (g.dom_grade || '').toUpperCase();
    const color = gradeColors[grade] || '#64748b';
    const label = gradeLabels[grade] || '';
    const range = gradeRanges[grade] || '';
    const ppsf = Math.round(g.avg_ppsf || 0);
    const stl = ((g.avg_sale_to_list || 0) * 100).toFixed(1);
    const sales = g.total_sales || 0;

    if (grade === 'A') gradeA = g;
    if (grade === 'D') gradeD = g;

    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
    h += '<span class="grade-badge" style="background:' + color + ';color:#0a0a0f">' + grade + '</span>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:12px;color:#f1f5f9;font-weight:600">' + range + ' <span style="color:#64748b;font-weight:400">(' + label + ')</span></div>';
    h += '</div>';
    h += '<div style="font-size:12px;color:#94a3b8;text-align:right;white-space:nowrap">';
    h += '<span style="color:#e2e8f0;font-weight:600">' + sales + '</span> sales &middot; ';
    h += '<span style="font-weight:700;color:' + _ppsfColor(ppsf) + '">$' + ppsf + '/SF</span> &middot; ';
    h += stl + '%';
    h += '</div></div>';
  });

  h += '</div>';

  // Insight line
  if (gradeA && gradeD) {
    const diff = Math.round((gradeA.avg_ppsf || 0) - (gradeD.avg_ppsf || 0));
    if (diff > 0) {
      h += '<div class="insight-line" style="margin:0 12px 14px">Grade A comps command $' + diff + '/SF more than Grade D \u2014 speed sells</div>';
    }
  }

  h += '</details>';
  return h;
}

// ═══ CARD 5: AGENT ACTIVITY ═══
function renderAgentCard(agents) {
  if (!agents || !agents.length) return '';

  const buyers = agents.filter(a => a.side === 'buyer').slice(0, 10);
  const listers = agents.filter(a => a.side === 'listing').slice(0, 10);

  if (!buyers.length && !listers.length) return '';

  let h = '<details class="intel-card"><summary>AGENT ACTIVITY <span style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0">' + agents.length + '</span></summary>';
  h += '<div style="padding:0 12px 14px">';

  function renderAgentSection(title, list) {
    if (!list.length) return '';
    let s = '<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:12px 0 8px">' + title + '</div>';
    list.forEach(a => {
      const lastDate = a.last_deal_date ? new Date(a.last_deal_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '';
      s += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);flex-wrap:wrap">';
      s += '<div style="flex:1;min-width:120px;font-size:12px;color:#f1f5f9;font-weight:600">' + esc(_titleCase(a.agent_name || '')) + '</div>';
      s += '<div style="font-size:11px;color:#94a3b8;white-space:nowrap">';
      s += '<span style="color:#e2e8f0;font-weight:700">' + (a.deal_count || 0) + '</span> deals';
      if (a.community_count) s += ' &middot; <span style="color:#e2e8f0">' + a.community_count + '</span> communities';
      if (a.avg_price) s += ' &middot; Avg ' + $k(Math.round(a.avg_price));
      if (lastDate) s += ' &middot; Last: ' + lastDate;
      s += '</div></div>';
    });
    return s;
  }

  h += renderAgentSection('BUYER AGENTS', buyers);
  h += renderAgentSection('LISTING AGENTS', listers);

  h += '</div></details>';
  return h;
}
