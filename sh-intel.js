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
let _intelChat = [];

const SUGGESTED_QUESTIONS = [
  "Which community has the best flip margins?",
  "Compare Siena vs Canyon Gate for my next deal",
  "When should I list Denaro for maximum price?"
];

function _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function loadIntelData(force) {
  if (_intelData && !force) return _intelData;
  if (_intelLoading) return null;
  _intelLoading = true;

  const [communities, flips, seasonal, domGrades, agents, nameMap] = await Promise.all([
    fetch(SB + '/rest/v1/community_production_stats?is_gated=eq.true&avg_sale_price=gte.600000&avg_sale_price=lte.2000000&order=total_sales.desc&limit=15', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/detected_flips?order=sell_date.desc', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/seasonal_patterns?order=sale_month', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/dom_grade_summary?order=dom_grade', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/agent_activity?order=deal_count.desc&limit=20', { headers: HD }).then(r => r.json()).catch(() => []),
    fetch(SB + '/rest/v1/community_name_map?select=subdivision_name,community_name', { headers: HD }).then(r => r.json()).catch(() => [])
  ]);

  const nameDict = {};
  nameMap.forEach(m => { nameDict[m.subdivision_name] = m.community_name; });

  _intelData = { communities, flips, seasonal, domGrades, agents, nameDict };
  _intelLoading = false;
  return _intelData;
}

// ═══ BRIEF CONTEXT BUILDER ═══
function buildBriefContext(data) {
  let ctx = '';

  ctx += 'TOP GATED COMMUNITIES (by sales volume, $600K-$2M range):\n';
  data.communities.slice(0, 8).forEach(c => {
    ctx += c.community_name + ' (' + c.zip_code + '): ' + (c.total_sales || 0) + ' sales, ' + Math.round(c.avg_ppsf || 0) + '/SF avg, ' + Math.round(c.avg_dom || 0) + ' DOM avg, ' + ((c.avg_sale_to_list || 0) * 100).toFixed(1) + '% sale-to-list\n';
  });

  ctx += '\nRECENT FLIPS (buy-resell within 18 months):\n';
  const nd = data.nameDict || {};
  data.flips.slice(0, 5).forEach(f => {
    ctx += f.address + ' (' + (nd[f.subdivision_name] || f.subdivision_name || '') + '): ' + Math.round((f.buy_price || 0) / 1000) + 'K \u2192 ' + Math.round((f.sell_price || 0) / 1000) + 'K, margin before reno: ' + Math.round((f.margin_before_reno || 0) / 1000) + 'K, ' + (f.hold_months || '?') + ' months, grade: ' + (f.flip_grade || '?') + '\n';
  });

  ctx += '\nSEASONAL PATTERNS (by month):\n';
  data.seasonal.filter(s => (s.total_sales || 0) >= 10).forEach(s => {
    ctx += _monthName(s.sale_month) + ': ' + s.total_sales + ' sales, ' + Math.round(s.avg_ppsf || 0) + '/SF, ' + Math.round(s.avg_dom || 0) + ' DOM, ' + ((s.avg_sale_to_list || 0) * 100).toFixed(1) + '% sale-to-list\n';
  });

  ctx += '\nDOM GRADE DISTRIBUTION:\n';
  data.domGrades.forEach(g => {
    ctx += 'Grade ' + g.dom_grade + ': ' + (g.comp_count || 0) + ' comps, ' + Math.round(g.avg_ppsf || 0) + '/SF avg, ' + (g.avg_sale_to_list_pct || 0).toFixed(1) + '% sale-to-list\n';
  });

  ctx += '\nTODAY: ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '\n';
  ctx += 'ACTIVE DEAL: 4507 Denaro Dr, Siena (guard-gated 55+), $1,008,800 purchase, closing April 8 2026, Kiavi loan 11.99%, 12-month term.\n';

  return ctx;
}

// ═══ MORNING BRIEF ═══
async function renderMorningBrief(data) {
  const today = new Date().toISOString().split('T')[0];

  try {
    const cached = JSON.parse(localStorage.getItem('sh_intel_brief') || 'null');
    if (cached && cached.date === today && cached.text) {
      return formatBriefHtml(cached.text, cached.generated_at || today, data);
    }
  } catch (e) {}

  const apiKey = localStorage.getItem('sh_claude_key');
  if (!apiKey) return renderApiKeyPrompt();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: 'You are the Sovereign House intelligence advisor for King J and Lisa \u2014 luxury fix-and-flip operators in guard-gated Summerlin, Las Vegas.\n\nGenerate a concise daily market intelligence brief based on the data provided.\n\nStructure (use these exact headers):\n**Market Pulse** \u2014 1-2 sentences on overall market activity across target communities\n**Community Watch** \u2014 1 specific community worth noting (hot, cooling, or anomalous) with numbers\n**Deal Status** \u2014 timing check on their active deal, any recommendations\n**Signal** \u2014 one actionable insight (an opportunity, a risk, or a strategic note)\n\nRules:\n- Under 150 words total\n- Use actual numbers from the data\n- Be direct and opinionated \u2014 no hedging\n- No greetings or sign-offs\n- If data is limited, say so briefly and work with what\'s available',
        messages: [{ role: 'user', content: buildBriefContext(data) }]
      })
    });

    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem('sh_claude_key');
      throw new Error('API error ' + res.status);
    }

    const result = await res.json();
    const briefText = result.content[0].text;

    localStorage.setItem('sh_intel_brief', JSON.stringify({
      date: today,
      text: briefText,
      generated_at: new Date().toISOString()
    }));

    return formatBriefHtml(briefText, new Date().toISOString(), data);
  } catch (e) {
    return '<div style="margin-bottom:16px;padding:16px;border-radius:14px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);font-size:12px;color:#ef4444">\u26a0\ufe0f Brief generation failed: ' + _esc(e.message) + '</div>';
  }
}

function formatBriefHtml(text, generatedAt, data) {
  const formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#d4af37">$1</strong>').replace(/\n/g, '<br>');
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const totalComps = data.communities.reduce((s, c) => s + (c.total_sales || 0), 0);

  let h = '<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:linear-gradient(135deg,rgba(212,175,55,0.04),rgba(212,175,55,0.01));border:1px solid rgba(212,175,55,0.15)">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px">\ud83e\udde0 INTELLIGENCE BRIEF</div>';
  h += '<div style="display:flex;align-items:center;gap:8px">';
  if (dateStr) h += '<span style="font-size:9px;color:#475569">' + dateStr + '</span>';
  h += '<button onclick="regenerateBrief()" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(212,175,55,0.2);background:rgba(212,175,55,0.06);color:#d4af37;font-size:9px;font-weight:700;cursor:pointer">\u21bb</button>';
  h += '</div></div>';
  h += '<div style="font-size:13px;color:#e2e8f0;line-height:1.7">' + formatted + '</div>';
  h += '<div style="margin-top:10px;font-size:9px;color:#475569">Based on ' + totalComps + ' sold comps across ' + (data.communities.length || 0) + ' communities</div>';
  h += '</div>';
  return h;
}

function renderApiKeyPrompt() {
  let h = '<div style="margin-bottom:16px;padding:20px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);text-align:center">';
  h += '<div style="font-size:32px;margin-bottom:8px">\ud83d\udd11</div>';
  h += '<div style="font-size:13px;color:#94a3b8;margin-bottom:12px">Set up your Claude API key to enable intelligence briefings</div>';
  h += '<button onclick="promptIntelApiKey()" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.1);color:#d4af37;font-size:12px;font-weight:700;cursor:pointer">Enter API Key</button>';
  h += '</div>';
  return h;
}

function promptIntelApiKey() {
  const k = prompt('Enter your Claude API key:');
  if (k) {
    localStorage.setItem('sh_claude_key', k);
    renderIntelView();
  }
}

async function regenerateBrief() {
  localStorage.removeItem('sh_intel_brief');
  renderIntelView();
}

// ═══ ASK THE BRAIN — STANDOUT CHAT ═══
function renderChatSection() {
  let h = '<div style="margin-bottom:16px;border-radius:16px;overflow:hidden;position:relative;background:rgba(255,255,255,0.02);border:1px solid rgba(212,175,55,0.15)">';

  // Hero header
  h += '<div style="padding:24px 24px 16px;text-align:center">';
  h += '<div style="font-size:32px;margin-bottom:8px">\ud83e\udde0</div>';
  h += '<div style="font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:4px">What do you want to know?</div>';
  h += '<div style="font-size:11px;color:#475569">Market data, community intel, timing strategy</div>';
  h += '</div>';

  // Input area
  h += '<div style="padding:0 20px 16px;display:flex;gap:8px">';
  h += '<input id="intelChatInput" class="cinput" placeholder="Ask about communities, timing, strategy..." style="flex:1;font-size:14px;min-height:48px;border-radius:12px" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendIntelChat()}"/>';
  h += '<button onclick="sendIntelChat()" style="padding:0 18px;min-height:48px;border-radius:12px;background:linear-gradient(135deg,#d4af37,#b8960c);color:#0a0a0f;border:none;font-size:16px;font-weight:800;cursor:pointer">\u2192</button>';
  h += '</div>';

  // Suggested questions (hidden when conversation active)
  h += '<div id="intelSuggestions" style="padding:0 20px 20px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center' + (_intelChat.length ? ';display:none' : '') + '">';
  SUGGESTED_QUESTIONS.forEach(q => {
    h += '<button onclick="document.getElementById(\'intelChatInput\').value=\'' + q.replace(/'/g, "\\'") + '\';sendIntelChat()" style="padding:8px 14px;border-radius:20px;border:1px solid rgba(212,175,55,0.25);background:rgba(212,175,55,0.04);color:#d4af37;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s;min-height:36px" onmouseenter="this.style.background=\'rgba(212,175,55,0.1)\'" onmouseleave="this.style.background=\'rgba(212,175,55,0.04)\'">' + _esc(q) + '</button>';
  });
  h += '</div>';

  // Conversation area
  h += '<div id="intelChatArea" style="max-height:400px;overflow-y:auto;padding:0 20px">';
  h += '</div>';

  h += '</div>';
  return h;
}

function renderChatMessages() {
  const area = document.getElementById('intelChatArea');
  if (!area) return;

  // Hide suggestions when conversation exists
  const sugg = document.getElementById('intelSuggestions');
  if (sugg) sugg.style.display = _intelChat.length ? 'none' : 'flex';

  let h = '';

  _intelChat.forEach(msg => {
    if (msg.role === 'user') {
      h += '<div style="margin-bottom:12px;text-align:right"><div style="display:inline-block;max-width:85%;padding:10px 14px;border-radius:12px 12px 2px 12px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);font-size:13px;color:#e2e8f0;text-align:left">' + _esc(msg.content) + '</div></div>';
    } else {
      const formatted = msg.content
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#d4af37">$1</strong>')
        .replace(/\n/g, '<br>');
      h += '<div style="margin-bottom:12px"><div style="display:inline-block;max-width:85%;padding:10px 14px;border-radius:12px 12px 12px 2px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e2e8f0;line-height:1.6">' + formatted + '</div></div>';
    }
  });

  if (_intelChat.length > 0) {
    h += '<div style="text-align:center;padding:12px 0 16px"><button onclick="_intelChat=[];renderChatMessages()" style="background:none;border:none;color:#475569;font-size:10px;cursor:pointer;text-decoration:underline">Clear conversation</button></div>';
  }

  area.innerHTML = h;
  area.scrollTop = area.scrollHeight;
}

async function sendIntelChat() {
  const input = document.getElementById('intelChatInput');
  const q = (input?.value || '').trim();
  if (!q) return;

  const apiKey = localStorage.getItem('sh_claude_key');
  if (!apiKey) { promptIntelApiKey(); return; }

  _intelChat.push({ role: 'user', content: q });
  input.value = '';
  renderChatMessages();

  const area = document.getElementById('intelChatArea');
  if (area) {
    area.innerHTML += '<div id="intelTyping" style="padding:8px 12px;font-size:12px;color:#64748b;font-style:italic">Thinking...</div>';
    area.scrollTop = area.scrollHeight;
  }

  const data = _intelData || await loadIntelData();
  const context = buildBriefContext(data);

  const messages = [];
  messages.push({ role: 'user', content: 'MARKET DATA:\n' + context + '\n\nQUESTION: ' + _intelChat[0].content });
  for (let i = 1; i < _intelChat.length; i++) {
    messages.push({ role: _intelChat[i].role, content: _intelChat[i].content });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are the Sovereign House intelligence advisor. You have full access to market data for guard-gated Summerlin communities in Las Vegas.\n\nAnswer questions using the provided data. Be specific with numbers. Be direct.\nIf comparing communities, use actual PPSF, DOM, and sales volume.\nIf asked about timing, reference seasonal patterns.\nIf the data doesn\'t support a conclusion, say so.\n\nKeep responses concise \u2014 under 150 words unless a detailed breakdown is requested.\nUse **bold** for key numbers and community names.\nYou\'re talking to King J and Lisa \u2014 experienced luxury flippers. No hand-holding.',
        messages: messages
      })
    });

    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem('sh_claude_key');
      throw new Error('API error ' + res.status);
    }

    const result = await res.json();
    const answer = result.content?.[0]?.text || 'No response';
    _intelChat.push({ role: 'assistant', content: answer });
  } catch (e) {
    _intelChat.push({ role: 'assistant', content: '\u26a0\ufe0f ' + e.message });
  }

  renderChatMessages();
}

// ═══ MAIN RENDER ═══
async function renderIntelView() {
  const el = document.getElementById('intelView');
  if (!el) return;

  el.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">\ud83e\udde0</div><div style="font-size:13px">Loading market intelligence...</div></div>';

  const data = await loadIntelData();
  if (!data) return;

  let h = '';

  // 1. Morning Brief
  h += await renderMorningBrief(data);

  // 2. Ask the Brain
  h += renderChatSection();

  // 3. Data Explorer
  const totalPoints = (data.communities.length || 0) + (data.flips.length || 0) + (data.agents.length || 0);
  const isMobile = window.innerWidth < 768;
  h += '<details class="intel-card" style="margin-top:4px;border-top:2px solid rgba(212,175,55,0.15)"' + (isMobile ? '' : ' open') + '>';
  h += '<summary><span>DATA EXPLORER</span><span class="intel-badge">' + totalPoints + ' data points</span></summary>';
  h += '<div style="padding:4px 12px 16px">';
  h += renderCommunityCard(data.communities);
  h += renderFlipCard(data.flips);
  h += renderSeasonalCard(data.seasonal);
  h += renderDOMCard(data.domGrades);
  h += renderAgentCard(data.agents);
  h += '</div>';
  h += '</details>';

  el.innerHTML = h;

  if (_intelChat.length) renderChatMessages();
}

// ═══ HELPERS ═══
function _titleCase(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function _truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '\u2026' : s;
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
  // v is a ratio (0.97) or a percentage (97.1) — handle both
  const pct = v > 1 ? v : v * 100;
  if (pct >= 97) return '#22c55e';
  if (pct >= 95) return '#d4af37';
  return '#ef4444';
}

function _monthName(m) {
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m] || m;
}

function _isNonMls(name) {
  if (!name || !name.trim()) return true;
  return name.trim().toLowerCase() === 'non mls';
}

// ═══ CARD 1: COMMUNITY LEADERBOARD ═══
function renderCommunityCard(communities) {
  if (!communities || !communities.length) return '';

  const maxSales = Math.max(...communities.map(c => c.total_sales || 0));

  let h = '<details class="intel-card" style="border-top:2px solid rgba(212,175,55,0.15)">';
  h += '<summary>COMMUNITY LEADERBOARD <span class="intel-badge">' + communities.length + '</span></summary>';
  h += '<div style="padding:4px 16px 20px">';

  communities.forEach((c, i) => {
    const name = c.community_name || '';
    const ppsf = Math.round(c.avg_ppsf || 0);
    const dom = Math.round(c.avg_dom || 0);
    const stl = c.avg_sale_to_list || 0;
    const stlPct = (stl * 100).toFixed(1);
    const floor = Math.round(c.floor_ppsf || 0);
    const ceil = Math.round(c.ceiling_ppsf || 0);
    const sales = c.total_sales || 0;
    const barW = maxSales > 0 ? Math.round((c.total_sales || 0) / maxSales * 100) : 0;

    h += '<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);margin-bottom:8px">';

    // Row 1: Rank + Name + ZIP
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<div style="color:#d4af37;font-size:16px;font-weight:800;min-width:28px">#' + (i + 1) + '</div>';
    h += '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</div></div>';
    h += '<div style="font-size:12px;color:#64748b;font-weight:600">' + esc(c.zip_code || '') + '</div>';
    h += '</div>';

    // Row 2: Stats
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#94a3b8">';
    h += '<span style="color:#e2e8f0;font-weight:700">' + sales + ' sales</span>';
    h += '<span>\u00b7</span>';
    h += '<span style="color:' + _ppsfColor(ppsf) + ';font-weight:700">$' + ppsf + '/SF</span>';
    h += '<span>\u00b7</span>';
    h += '<span>$' + floor + '\u2013$' + ceil + ' range</span>';
    h += '</div>';

    // Row 3: DOM + Sale-to-list
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:#94a3b8">';
    h += '<span style="color:' + _domColor(dom) + ';font-weight:600">' + dom + ' DOM</span>';
    h += '<span>\u00b7</span>';
    h += '<span style="color:' + _stlColor(stl) + ';font-weight:600">' + stlPct + '% of asking</span>';
    h += '</div>';

    // Row 4: Volume bar
    h += '<div style="margin-top:8px;height:4px;border-radius:2px;background:rgba(255,255,255,0.06)">';
    h += '<div style="height:100%;width:' + barW + '%;border-radius:2px;background:linear-gradient(90deg,rgba(212,175,55,0.4),rgba(212,175,55,0.15))"></div>';
    h += '</div>';
    h += '<div style="font-size:9px;color:#475569;margin-top:3px">' + (c.total_sales || 0) + ' sales in 12mo</div>';

    h += '</div>';
  });

  h += '</div></details>';
  return h;
}

// ═══ CARD 2: FLIP ACTIVITY ═══
function renderFlipCard(flips) {
  if (!flips || !flips.length) return '';

  const gradeColors = { strong: '#22c55e', viable: '#d4af37', tight: '#f97316', underwater: '#ef4444' };
  const gradeBorders = { strong: '#22c55e', viable: '#d4af37', tight: '#f97316', underwater: '#ef4444' };

  let h = '<details class="intel-card" style="border-top:2px solid rgba(212,175,55,0.15)">';
  h += '<summary>FLIP ACTIVITY <span class="intel-badge">' + flips.length + '</span></summary>';
  h += '<div style="padding:4px 16px 20px">';

  flips.forEach(f => {
    const buy = f.buy_price || 0;
    const sell = f.sell_price || 0;
    const margin = f.margin_before_reno || 0;
    const months = f.hold_months != null ? parseFloat(f.hold_months).toFixed(1) : '?';
    const grade = (f.flip_grade || '').toLowerCase();
    const borderColor = gradeBorders[grade] || '#475569';
    const badgeColor = gradeColors[grade] || '#475569';
    const isUnderwater = grade === 'underwater';
    const marginColor = margin >= 0 ? '#22c55e' : '#ef4444';
    const marginSign = margin >= 0 ? '+' : '';

    h += '<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-left:3px solid ' + borderColor + ';margin-bottom:8px' + (isUnderwater ? ';opacity:0.6' : '') + '">';

    // Line 1: Address
    h += '<div style="font-size:13px;font-weight:700;color:#f1f5f9">' + esc(f.address || '') + '</div>';

    // Line 2: Community · ZIP
    const nd = (_intelData && _intelData.nameDict) || {};
    const communityName = nd[f.subdivision_name] || _titleCase(f.subdivision_name || '');
    h += '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(communityName) + ' \u00b7 ' + esc(f.zip_code || '') + '</div>';

    // Line 3: Buy → Sell
    h += '<div style="font-size:12px;color:#94a3b8;margin-top:8px">' + $k(buy) + ' \u2192 ' + $k(sell) + '</div>';

    // Line 4: Margin + Hold
    h += '<div style="display:flex;align-items:center;gap:10px;margin-top:4px;flex-wrap:wrap">';
    h += '<span style="font-size:13px;color:' + marginColor + ';font-weight:700">' + marginSign + $k(margin) + ' margin</span>';
    h += '<span style="font-size:11px;color:#64748b">' + months + ' mo hold</span>';
    h += '</div>';

    // Line 5: Costs breakdown
    if (f.est_commissions || f.est_holding || f.known_costs) {
      let costs = [];
      if (f.est_commissions) costs.push('$' + Math.round(f.est_commissions / 1000) + 'K commissions');
      if (f.est_holding) costs.push('$' + Math.round(f.est_holding / 1000) + 'K holding');
      if (f.known_costs) costs.push('$' + Math.round(f.known_costs / 1000) + 'K closing');
      h += '<div style="font-size:10px;color:#475569;margin-top:4px">Costs: ' + costs.join(' + ') + '</div>';
    }

    // Line 6: Grade badge + renovation tag
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">';
    h += '<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:0.5px;color:#0a0a0f;background:' + badgeColor + '">' + grade.toUpperCase() + '</span>';
    if (f.likely_renovated) {
      h += '<span style="font-size:10px;color:#d4af37;font-weight:600">\ud83d\udd28 Likely renovated</span>';
    }
    h += '</div>';

    h += '</div>';
  });

  h += '</div></details>';
  return h;
}

// ═══ CARD 3: SEASONAL TIMING ═══
function renderSeasonalCard(seasonal) {
  if (!seasonal || !seasonal.length) return '';

  const valid = seasonal.filter(s => (s.total_sales || 0) >= 10);
  if (!valid.length) return '';

  const minDom = Math.min(...valid.map(s => Math.round(s.avg_dom || 0)));
  const maxDom = Math.max(...valid.map(s => Math.round(s.avg_dom || 0)));

  let bestMonth = valid[0];

  let h = '<details class="intel-card" style="border-top:2px solid rgba(212,175,55,0.15)">';
  h += '<summary>WHEN TO LIST</summary>';
  h += '<div style="padding:4px 16px 20px">';

  valid.forEach(s => {
    const dom = Math.round(s.avg_dom || 0);
    const stl = s.avg_sale_to_list || 0;
    const stlPct = (stl * 100).toFixed(1);

    let rating, ratingColor, ratingLabel;
    if (dom <= 45 && stl >= 0.975) { rating = '\ud83d\udfe2'; ratingColor = '#22c55e'; ratingLabel = 'PRIME'; }
    else if (dom <= 55 && stl >= 0.965) { rating = '\ud83d\udfe1'; ratingColor = '#d4af37'; ratingLabel = 'GOOD'; }
    else { rating = '\ud83d\udd34'; ratingColor = '#ef4444'; ratingLabel = 'SLOW'; }

    // Speed bar: invert DOM so lower DOM = wider bar
    const speedPct = maxDom > minDom ? Math.round((maxDom - dom) / (maxDom - minDom) * 100) : 50;

    if (dom < Math.round(bestMonth.avg_dom || 999) || (dom === Math.round(bestMonth.avg_dom || 999) && stl > (bestMonth.avg_sale_to_list || 0))) {
      bestMonth = s;
    }

    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';

    // Month
    h += '<div style="min-width:32px;font-size:12px;font-weight:700;color:#f1f5f9">' + _monthName(s.sale_month) + '</div>';

    // Speed bar + stats
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,0.06)">';
    h += '<div style="height:100%;width:' + Math.max(speedPct, 5) + '%;border-radius:3px;background:' + ratingColor + ';opacity:0.6"></div>';
    h += '</div>';
    h += '<span style="font-size:10px;color:' + ratingColor + ';font-weight:700;min-width:48px">' + rating + ' ' + ratingLabel + '</span>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:#64748b">';
    h += '<span>' + (s.total_sales || 0) + ' sales</span>';
    h += '<span style="color:' + _domColor(dom) + '">' + dom + ' DOM</span>';
    h += '<span style="color:' + _stlColor(stl) + '">' + stlPct + '%</span>';
    h += '</div>';
    h += '</div>';

    h += '</div>';
  });

  h += '</div>';

  // Prominent insight
  const bDom = Math.round(bestMonth.avg_dom || 0);
  const bStl = ((bestMonth.avg_sale_to_list || 0) * 100).toFixed(1);
  h += '<div style="margin:0 16px 16px;padding:12px 16px;border-radius:10px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);font-size:13px;color:#d4af37;font-weight:700;text-align:center">';
  h += '\ud83c\udfc6 Best window: ' + _monthName(bestMonth.sale_month) + ' \u2014 ' + bDom + ' avg DOM, ' + bStl + '% of asking';
  h += '</div>';

  h += '</details>';
  return h;
}

// ═══ CARD 4: DOM vs PRICE (Speed Grading) ═══
function renderDOMCard(domGrades) {
  if (!domGrades || !domGrades.length) return '';

  const gradeColors = { A: '#22c55e', B: '#14b8a6', C: '#d4af37', D: '#f97316', F: '#ef4444' };
  const gradeLabels = { A: 'Hot', B: 'Strong', C: 'Normal', D: 'Slow', F: 'Stale' };
  const gradeRanges = { A: '0-14 days', B: '15-30 days', C: '31-60 days', D: '61-90 days', F: '90+ days' };

  const maxCount = Math.max(...domGrades.map(g => g.comp_count || 0));
  const totalCount = domGrades.reduce((s, g) => s + (g.comp_count || 0), 0);

  let h = '<details class="intel-card" style="border-top:2px solid rgba(212,175,55,0.15)">';
  h += '<summary>SPEED vs PRICE</summary>';
  h += '<div style="padding:4px 16px 20px">';

  let gradeA = null, gradeD = null;

  domGrades.forEach(g => {
    const grade = (g.dom_grade || '').toUpperCase();
    const color = gradeColors[grade] || '#64748b';
    const label = gradeLabels[grade] || '';
    const range = gradeRanges[grade] || '';
    const ppsf = Math.round(g.avg_ppsf || 0);
    const stl = (g.avg_sale_to_list_pct || 0).toFixed(1);
    const count = g.comp_count || 0;
    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0';
    const barW = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;

    if (grade === 'A') gradeA = g;
    if (grade === 'D') gradeD = g;

    h += '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';

    // Row 1: Badge + range + label
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<span class="grade-badge" style="background:' + color + ';color:#0a0a0f">' + grade + '</span>';
    h += '<div style="flex:1;font-size:12px;color:#f1f5f9;font-weight:600">' + range + ' <span style="color:#64748b;font-weight:400">(' + label + ')</span></div>';
    h += '<div style="font-size:11px;color:#94a3b8;text-align:right;white-space:nowrap">';
    h += '<span style="font-weight:700;color:' + _ppsfColor(ppsf) + '">$' + ppsf + '/SF</span> \u00b7 ' + stl + '%';
    h += '</div>';
    h += '</div>';

    // Row 2: Bar chart
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">';
    h += '<div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,0.04)">';
    h += '<div style="height:100%;width:' + barW + '%;border-radius:4px;background:' + color + ';opacity:0.5"></div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:#64748b;min-width:80px;text-align:right"><span style="color:#e2e8f0;font-weight:600">' + count + '</span> (' + pct + '%)</div>';
    h += '</div>';

    h += '</div>';
  });

  h += '</div>';

  if (gradeA && gradeD) {
    const diff = Math.round((gradeA.avg_ppsf || 0) - (gradeD.avg_ppsf || 0));
    if (diff > 0) {
      h += '<div class="insight-line" style="margin:0 16px 16px">Grade A comps command $' + diff + '/SF more than Grade D \u2014 speed sells</div>';
    }
  }

  h += '</details>';
  return h;
}

// ═══ CARD 5: AGENT ACTIVITY ═══
function renderAgentCard(agents) {
  if (!agents || !agents.length) return '';

  // Filter out Non MLS noise
  const clean = agents.filter(a => !_isNonMls(a.agent_name));
  if (!clean.length) return '';

  const buyers = clean.filter(a => a.side === 'buyer').slice(0, 10);
  const listers = clean.filter(a => a.side === 'listing').slice(0, 10);

  if (!buyers.length && !listers.length) return '';

  let h = '<details class="intel-card" style="border-top:2px solid rgba(212,175,55,0.15)">';
  h += '<summary>AGENT ACTIVITY <span class="intel-badge">' + clean.length + '</span></summary>';
  h += '<div style="padding:4px 16px 20px">';

  function renderAgentSection(title, list) {
    if (!list.length) return '';
    let s = '<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:14px 0 8px">' + title + '</div>';
    list.forEach((a, i) => {
      const lastDate = a.most_recent ? new Date(a.most_recent).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '';
      s += '<div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:6px">';

      // Row 1: Rank + Name + Deal count
      s += '<div style="display:flex;align-items:center;gap:8px">';
      s += '<span style="color:#d4af37;font-size:12px;font-weight:800;min-width:22px">#' + (i + 1) + '</span>';
      s += '<div style="flex:1;font-size:13px;color:#f1f5f9;font-weight:700">' + esc(_titleCase(a.agent_name || '')) + '</div>';
      s += '<span style="font-size:12px;color:#e2e8f0;font-weight:700">' + (a.deal_count || 0) + ' deals</span>';
      s += '</div>';

      // Row 2: Details
      let details = [];
      if (a.communities_active) details.push('Active in ' + a.communities_active + ' communities');
      if (a.avg_price) details.push('Avg ' + $k(Math.round(a.avg_price)));
      if (lastDate) details.push('Last: ' + lastDate);
      if (details.length) {
        s += '<div style="font-size:10px;color:#64748b;margin-top:4px;margin-left:30px">' + details.join(' \u00b7 ') + '</div>';
      }

      s += '</div>';
    });
    return s;
  }

  h += renderAgentSection('BUYER AGENTS', buyers);
  h += renderAgentSection('LISTING AGENTS', listers);

  h += '</div></details>';
  return h;
}
