// Sovereign House Intelligence — Community Watches module
// Built Apr 17, 2026

// ═══════════════════════════════════════════════════════════════
// DATA — loaded/refreshed alongside property watches
// ═══════════════════════════════════════════════════════════════

let communityWatches = [];        // array of {id, community_name, filter_min_price, ...}
let communityWatchesExpanded = new Set();  // which cards are expanded
let communityHistory = {};         // community_name → latest snapshots
let communityProd = {};            // community_name → 12mo stats
let communityFlips = {};           // community_name → recent flips

async function loadCommunityWatchData() {
  try {
    const ninetyAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().slice(0,10);
    const thirtyFiveAgo = new Date(Date.now() - 35*24*60*60*1000).toISOString().slice(0,10);

    const [cw, hist, prod, flips] = await Promise.all([
      sb("watchlist?watch_type=eq.community&status=eq.Watching&order=community_name"),
      sb("community_ppsf_history?select=*&snapshot_date=gte." + thirtyFiveAgo + "&order=snapshot_date.desc"),
      sb("community_production_stats?is_gated=eq.true&select=community_name,avg_ppsf,ceiling_ppsf,avg_sale_to_list,avg_dom,total_sales"),
      sb("detected_flips?select=*&sell_date=gte." + ninetyAgo)
    ]);

    communityWatches = Array.isArray(cw) ? cw : [];

    // Group history by community, keep latest per community
    communityHistory = {};
    (Array.isArray(hist) ? hist : []).forEach(r => {
      if (!communityHistory[r.community_name]) communityHistory[r.community_name] = [];
      communityHistory[r.community_name].push(r);
    });

    // Dedupe production stats (table has duplicates by ZIP) — keep highest total_sales
    communityProd = {};
    (Array.isArray(prod) ? prod : []).forEach(r => {
      const existing = communityProd[r.community_name];
      if (!existing || (Number(r.total_sales) || 0) > (Number(existing.total_sales) || 0)) {
        communityProd[r.community_name] = r;
      }
    });

    // Group flips by community via community_name_map
    const nm = window.communityNameMap || {};
    communityFlips = {};
    (Array.isArray(flips) ? flips : []).forEach(f => {
      const comm = nm[f.subdivision_name] || f.subdivision_name;
      if (!communityFlips[comm]) communityFlips[comm] = [];
      communityFlips[comm].push(f);
    });
  } catch(e) {
    console.error("[SH] Community watch load error:", e);
  }
}

// ═══════════════════════════════════════════════════════════════
// WATCHED VIEW RENDER (replaces default watched view rendering)
// ═══════════════════════════════════════════════════════════════

function renderWatchedView() {
  const list = document.getElementById('propsList');
  if (!list) return;

  // Clear and render two sections
  let h = '';

  // Section 1: Communities
  h += '<div style="padding:16px 20px 8px;display:flex;justify-content:space-between;align-items:center">';
  h += '<div style="font-size:11px;letter-spacing:2px;color:#d4af37;text-transform:uppercase;font-weight:700">⭐ Communities Watching (' + communityWatches.length + ')</div>';
  h += '<button onclick="openAddCommunityWatch()" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.08);color:#d4af37;font-size:11px;font-weight:700;cursor:pointer">+ Add Community</button>';
  h += '</div>';

  if (communityWatches.length === 0) {
    h += '<div style="margin:0 20px 16px;padding:20px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;text-align:center;font-style:italic">No community watches yet. Click "Add Community" to start tracking a neighborhood.</div>';
  } else {
    h += '<div style="padding:0 20px 16px">';
    communityWatches.forEach(cw => { h += renderCommunityCard(cw); });
    h += '</div>';
  }

  // Section 2: Properties
  const watchedProps = props.filter(p => watchIds.has(p.id) && baseFilter(p));
  h += '<div style="padding:8px 20px;border-top:1px solid rgba(255,255,255,0.04);margin-top:4px">';
  h += '<div style="font-size:11px;letter-spacing:2px;color:#22c55e;text-transform:uppercase;font-weight:700">🏠 Properties Watching (' + watchedProps.length + ')</div>';
  h += '</div>';

  if (watchedProps.length === 0) {
    h += '<div style="margin:0 20px 16px;padding:20px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);color:#64748b;font-size:12px;text-align:center;font-style:italic">No properties on watchlist.</div>';
  } else {
    // Render property cards using existing cardHtml logic
    watchedProps.forEach(p => { h += cardHtml(p); });
  }

  list.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// COMMUNITY CARD
// ═══════════════════════════════════════════════════════════════

function renderCommunityCard(cw) {
  const hist = communityHistory[cw.community_name] || [];
  const curr = hist[0];
  const prev = hist.find(s => {
    const d = (new Date(curr?.snapshot_date).getTime() - new Date(s.snapshot_date).getTime()) / 86400000;
    return d >= 6 && d <= 10;
  });
  const delta = (curr && prev) ? (Number(curr.avg_ppsf) - Number(prev.avg_ppsf)) : null;
  const prod = communityProd[cw.community_name];
  const flips = communityFlips[cw.community_name] || [];
  const expanded = communityWatchesExpanded.has(cw.id);

  const deltaColor = delta == null ? '#64748b' : (delta > 0 ? '#22c55e' : (delta < 0 ? '#ef4444' : '#94a3b8'));
  const deltaArrow = delta == null ? '→' : (delta > 0 ? '▲' : (delta < 0 ? '▼' : '→'));

  const filterText = [];
  if (cw.filter_min_price || cw.filter_max_price) {
    const mn = cw.filter_min_price ? '$' + (Number(cw.filter_min_price)/1000).toFixed(0) + 'K' : '—';
    const mx = cw.filter_max_price ? '$' + (Number(cw.filter_max_price)/1000).toFixed(0) + 'K' : '—';
    filterText.push(mn + '–' + mx);
  }
  if (cw.filter_min_sqft) filterText.push(cw.filter_min_sqft + '+ SF');

  // Matching active listings
  const nm = window.communityNameMap || {};
  const matching = props.filter(p => {
    const comm = nm[p.subdivision_name];
    if (comm !== cw.community_name) return false;
    if (p.listing_status !== 'Active') return false;
    if (cw.filter_min_price && p.list_price < Number(cw.filter_min_price)) return false;
    if (cw.filter_max_price && p.list_price > Number(cw.filter_max_price)) return false;
    if (cw.filter_min_sqft && p.sqft < Number(cw.filter_min_sqft)) return false;
    return true;
  });

  let h = '<div style="margin-bottom:10px;border-radius:12px;background:#111114;border:1px solid #1e1e24;overflow:hidden">';
  h += '<div style="height:3px;background:#d4af37"></div>';

  // Header row
  h += '<div style="padding:14px 16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px">';
  h += '<div style="flex:1">';
  h += '<div style="font-size:15px;font-weight:700;color:#fff">' + esc(cw.community_name) + '</div>';
  if (cw.watch_reason) {
    h += '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' + esc(cw.watch_reason) + '</div>';
  }
  if (filterText.length) {
    h += '<div style="font-size:11px;color:#64748b;margin-top:4px">Filter: ' + filterText.join(' · ') + '</div>';
  }
  h += '</div>';
  h += '<div style="text-align:right">';
  if (curr) {
    h += '<div style="font-size:14px;font-weight:700;color:' + deltaColor + '">' + deltaArrow + ' ' + (delta != null ? Math.abs(Math.round(delta)) + '/SF' : '—') + '</div>';
    h += '<div style="font-size:10px;color:#94a3b8">now ' + Math.round(Number(curr.avg_ppsf)) + '/SF</div>';
  }
  h += '</div>';
  h += '</div>';

  // Meta row
  const matchingCount = matching.length;
  const flipCount = flips.length;
  h += '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:11px">';
  h += '<div style="color:' + (matchingCount > 0 ? '#d4af37' : '#64748b') + ';font-weight:600">';
  h += matchingCount + ' active listing' + (matchingCount === 1 ? '' : 's') + ' match';
  if (flipCount > 0) h += ' · <span style="color:#a78bfa">' + flipCount + ' flip' + (flipCount === 1 ? '' : 's') + ' last 90d</span>';
  h += '</div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button onclick="toggleCommunityExpand(\'' + cw.id + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(212,175,55,0.3);background:transparent;color:#d4af37;font-size:10px;font-weight:700;cursor:pointer">' + (expanded ? 'Collapse' : 'Expand') + '</button>';
  h += '<button onclick="editCommunityWatch(\'' + cw.id + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(148,163,184,0.3);background:transparent;color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer">Edit</button>';
  h += '<button onclick="removeCommunityWatch(\'' + cw.id + '\',\'' + esc(cw.community_name) + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer">Remove</button>';
  h += '</div>';
  h += '</div>';
  h += '</div>';

  // Expanded content
  if (expanded) {
    h += '<div style="padding:0 16px 16px;border-top:1px solid rgba(255,255,255,0.04)">';

    // Market pulse
    if (prod || curr) {
      h += '<div style="margin-top:14px;padding:12px;background:rgba(212,175,55,0.04);border-radius:8px;border:1px solid rgba(212,175,55,0.1)">';
      h += '<div style="font-size:10px;letter-spacing:2px;color:#d4af37;text-transform:uppercase;font-weight:700;margin-bottom:8px">Market Pulse</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">';
      if (curr) h += '<div><span style="color:#64748b">Current avg:</span> <strong style="color:#fff">' + Math.round(Number(curr.avg_ppsf)) + '/SF</strong></div>';
      if (prod && prod.avg_ppsf) h += '<div><span style="color:#64748b">12mo avg:</span> <strong style="color:#fff">' + Math.round(Number(prod.avg_ppsf)) + '/SF</strong></div>';
      if (prod && prod.ceiling_ppsf) h += '<div><span style="color:#64748b">Ceiling:</span> <strong style="color:#fff">' + Math.round(Number(prod.ceiling_ppsf)) + '/SF</strong></div>';
      if (prod && prod.avg_dom) h += '<div><span style="color:#64748b">Avg DOM:</span> <strong style="color:#fff">' + Math.round(Number(prod.avg_dom)) + 'd</strong></div>';
      if (prod && prod.avg_sale_to_list) h += '<div><span style="color:#64748b">Sold-to-list:</span> <strong style="color:#fff">' + (Number(prod.avg_sale_to_list) * 100).toFixed(1) + '%</strong></div>';
      if (prod && prod.total_sales) h += '<div><span style="color:#64748b">12mo sales:</span> <strong style="color:#fff">' + prod.total_sales + '</strong></div>';
      h += '</div>';
      h += '</div>';
    }

    // Recent flips
    if (flips.length > 0) {
      h += '<div style="margin-top:10px">';
      h += '<div style="font-size:10px;letter-spacing:2px;color:#a78bfa;text-transform:uppercase;font-weight:700;margin-bottom:6px">Recent Flips (' + flips.length + ')</div>';
      flips.slice(0, 5).forEach(f => {
        h += '<div style="padding:8px 10px;background:rgba(167,139,250,0.04);border-radius:6px;font-size:11px;color:#cbd5e1;margin-bottom:4px">';
        h += '<strong style="color:#fff">' + esc(f.address || 'Unknown') + '</strong> · ';
        h += '$' + Math.round((f.buy_price || 0) / 1000) + 'K → $' + Math.round((f.sell_price || 0) / 1000) + 'K · ';
        h += '<span style="color:#22c55e">' + (Number(f.spread_pct) || 0).toFixed(1) + '% spread</span> · ';
        h += (f.hold_months || '?') + 'mo hold · grade ' + (f.flip_grade || '?');
        h += '</div>';
      });
      h += '</div>';
    }

    // Matching active listings
    if (matching.length > 0) {
      h += '<div style="margin-top:10px">';
      h += '<div style="font-size:10px;letter-spacing:2px;color:#22c55e;text-transform:uppercase;font-weight:700;margin-bottom:6px">Active Matching Filter (' + matching.length + ')</div>';
      matching.slice(0, 5).forEach(p => {
        h += '<div onclick="openDetail(\'' + p.id + '\')" style="padding:8px 10px;background:rgba(34,197,94,0.04);border-radius:6px;font-size:11px;color:#cbd5e1;margin-bottom:4px;cursor:pointer">';
        h += '<strong style="color:#fff">' + esc(p.address) + '</strong> · ';
        h += '$' + Math.round((p.list_price || 0) / 1000) + 'K · ';
        h += (p.sqft ? Number(p.sqft).toLocaleString() : '?') + ' SF · ';
        h += (p.days_on_market || 0) + ' DOM';
        h += '</div>';
      });
      h += '</div>';
    } else {
      h += '<div style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;font-size:11px;color:#64748b;text-align:center;font-style:italic">No active listings match your filter.</div>';
    }

    h += '</div>';
  }

  h += '</div>';
  return h;
}

function toggleCommunityExpand(id) {
  if (communityWatchesExpanded.has(id)) communityWatchesExpanded.delete(id);
  else communityWatchesExpanded.add(id);
  renderWatchedView();
}

// ═══════════════════════════════════════════════════════════════
// ADD / EDIT MODAL
// ═══════════════════════════════════════════════════════════════

function openAddCommunityWatch() { openCommunityWatchModal(null); }

function editCommunityWatch(id) {
  const cw = communityWatches.find(x => x.id === id);
  if (cw) openCommunityWatchModal(cw);
}

function openCommunityWatchModal(existing) {
  const nm = window.communityNameMap || {};
  const allCommunities = Array.from(new Set(Object.values(nm))).filter(x => x && x !== 'Unknown').sort();
  const alreadyWatched = new Set(communityWatches.map(c => c.community_name));

  let h = '<div id="cwModalBackdrop" onclick="closeCommunityWatchModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px">';
  h += '<div onclick="event.stopPropagation()" style="background:#0a0a0d;border:1px solid rgba(212,175,55,0.3);border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">';
  h += '<div style="font-size:11px;letter-spacing:2px;color:#d4af37;text-transform:uppercase;font-weight:700;margin-bottom:16px">' + (existing ? 'Edit Community Watch' : 'Add Community Watch') + '</div>';

  // Community name
  h += '<div style="margin-bottom:14px">';
  h += '<label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">COMMUNITY</label>';
  if (existing) {
    h += '<input type="text" id="cwCommunityName" value="' + esc(existing.community_name) + '" readonly style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px">';
  } else {
    h += '<input type="text" id="cwCommunitySearch" placeholder="Type to search..." oninput="filterCommunityOptions()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px">';
    h += '<div id="cwCommunityOptions" style="max-height:160px;overflow-y:auto;margin-top:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3)">';
    allCommunities.forEach(c => {
      const disabled = alreadyWatched.has(c);
      h += '<div class="cw-option" data-name="' + esc(c) + '" onclick="' + (disabled ? '' : 'selectCommunityOption(\'' + esc(c) + '\')') + '" style="padding:8px 12px;font-size:12px;color:' + (disabled ? '#475569' : '#cbd5e1') + ';cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';border-bottom:1px solid rgba(255,255,255,0.03)">' + esc(c) + (disabled ? ' (already watching)' : '') + '</div>';
    });
    h += '</div>';
    h += '<input type="hidden" id="cwCommunityName" value="">';
  }
  h += '</div>';

  // Filter fields
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
  h += '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">MIN PRICE</label><input type="number" id="cwMinPrice" value="' + (existing?.filter_min_price || 800000) + '" placeholder="800000" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px"></div>';
  h += '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">MAX PRICE</label><input type="number" id="cwMaxPrice" value="' + (existing?.filter_max_price || 1500000) + '" placeholder="1500000" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px"></div>';
  h += '</div>';

  h += '<div style="margin-bottom:14px">';
  h += '<label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">MIN SQFT</label>';
  h += '<input type="number" id="cwMinSqft" value="' + (existing?.filter_min_sqft || 3000) + '" placeholder="3000" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px">';
  h += '</div>';

  h += '<div style="margin-bottom:16px">';
  h += '<label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">REASON / NOTES</label>';
  h += '<textarea id="cwReason" rows="2" placeholder="Why are you watching this community?" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:#fff;font-size:13px;resize:vertical">' + (existing?.watch_reason ? esc(existing.watch_reason) : '') + '</textarea>';
  h += '</div>';

  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button onclick="closeCommunityWatchModal()" style="padding:10px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer">Cancel</button>';
  h += '<button onclick="saveCommunityWatch(' + (existing ? '\'' + existing.id + '\'' : 'null') + ')" style="padding:10px 22px;border-radius:8px;border:1px solid #d4af37;background:#d4af37;color:#000;font-size:12px;font-weight:700;cursor:pointer">' + (existing ? 'Save Changes' : 'Add Watch') + '</button>';
  h += '</div>';

  h += '</div></div>';

  const existingModal = document.getElementById('cwModalBackdrop');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', h);
}

function closeCommunityWatchModal() {
  const m = document.getElementById('cwModalBackdrop');
  if (m) m.remove();
}

function filterCommunityOptions() {
  const q = (document.getElementById('cwCommunitySearch').value || '').toLowerCase();
  document.querySelectorAll('#cwCommunityOptions .cw-option').forEach(el => {
    const n = el.dataset.name.toLowerCase();
    el.style.display = n.includes(q) ? '' : 'none';
  });
}

function selectCommunityOption(name) {
  document.getElementById('cwCommunityName').value = name;
  document.getElementById('cwCommunitySearch').value = name;
  document.querySelectorAll('#cwCommunityOptions .cw-option').forEach(el => {
    el.style.background = el.dataset.name === name ? 'rgba(212,175,55,0.1)' : '';
  });
}

async function saveCommunityWatch(existingId) {
  const name = (document.getElementById('cwCommunityName').value || '').trim();
  if (!name) { alert('Select a community'); return; }
  const minPrice = Number(document.getElementById('cwMinPrice').value) || null;
  const maxPrice = Number(document.getElementById('cwMaxPrice').value) || null;
  const minSqft = Number(document.getElementById('cwMinSqft').value) || null;
  const reason = (document.getElementById('cwReason').value || '').trim();

  const payload = {
    watch_type: 'community',
    community_name: name,
    filter_min_price: minPrice,
    filter_max_price: maxPrice,
    filter_min_sqft: minSqft,
    watch_reason: reason || null,
    alert_on_price_change: true,
    alert_on_status_change: true,
    alert_on_new_in_neighborhood: true,
    status: 'Watching'
  };

  try {
    if (existingId) {
      await fetch(SB + '/rest/v1/watchlist?id=eq.' + existingId, {
        method: 'PATCH',
        headers: HD,
        body: JSON.stringify(payload)
      });
    } else {
      payload.added_date = new Date().toISOString().slice(0, 10);
      await sb('watchlist', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeCommunityWatchModal();
    await loadCommunityWatchData();
    renderWatchedView();
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

async function removeCommunityWatch(id, name) {
  if (!confirm('Remove "' + name + '" from your community watches?')) return;
  try {
    await fetch(SB + '/rest/v1/watchlist?id=eq.' + id, { method: 'DELETE', headers: HD });
    await loadCommunityWatchData();
    renderWatchedView();
  } catch (e) {
    alert('Remove failed: ' + e.message);
  }
}
