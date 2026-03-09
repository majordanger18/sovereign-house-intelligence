// Sovereign House Intelligence — Deals Pipeline
// ═══════════════════════════════════════════
// ═══ DEALS PIPELINE ═══
// ═══════════════════════════════════════════
const DEAL_STAGES={
  offer_drafted:{label:"Drafted",color:"#64748b",icon:"📝"},
  offer_submitted:{label:"Submitted",color:"#3b82f6",icon:"📤"},
  counter_received:{label:"Counter In",color:"#f59e0b",icon:"↩️"},
  counter_sent:{label:"Counter Out",color:"#a855f7",icon:"↪️"},
  accepted:{label:"Accepted",color:"#22c55e",icon:"🤝"},
  under_contract:{label:"Under Contract",color:"#22c55e",icon:"📋"},
  inspection:{label:"Inspection",color:"#06b6d4",icon:"🔍"},
  financing:{label:"Financing",color:"#8b5cf6",icon:"🏦"},
  closing:{label:"Closing",color:"#d4af37",icon:"🏁"},
  closed:{label:"Closed",color:"#10b981",icon:"✅"},
  rejected:{label:"Rejected",color:"#ef4444",icon:"❌"},
  withdrawn:{label:"Withdrawn",color:"#64748b",icon:"🚫"},
  expired:{label:"Expired",color:"#64748b",icon:"⏰"}
};
const DEAD_STATUSES=["closed","rejected","withdrawn","expired"];
const LOST_STATUSES=["rejected","withdrawn","expired"];

function fireConfetti(){
  const canvas=document.createElement("canvas");
  canvas.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  document.body.appendChild(canvas);
  const ctx=canvas.getContext("2d");
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  const colors=["#d4af37","#22c55e","#3b82f6","#f59e0b","#a855f7","#ef4444","#e0c97f","#10b981"];
  const pieces=[];
  for(let i=0;i<150;i++){
    pieces.push({x:canvas.width*Math.random(),y:canvas.height*-0.2*Math.random(),w:6+Math.random()*6,h:4+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)],vx:(Math.random()-0.5)*8,vy:2+Math.random()*4,rot:Math.random()*360,vr:(Math.random()-0.5)*12,life:1});
  }
  let frame=0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive=false;
    pieces.forEach(p=>{
      if(p.life<=0)return;
      alive=true;
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.12;p.rot+=p.vr;
      if(frame>60)p.life-=0.015;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });
    frame++;
    if(alive&&frame<300)requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

function dealBadge(status){
  const s=DEAL_STAGES[status]||{label:status,color:"#64748b",icon:"?"};
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:0.5px;color:${s.color};background:${s.color}12;border:1px solid ${s.color}30;padding:3px 10px;border-radius:6px">${s.icon} ${s.label.toUpperCase()}</span>`;
}

function renderDeals(){
  const active=deals.filter(d=>!DEAD_STATUSES.includes(d.status));
  const won=deals.filter(d=>d.status==="closed");
  const lost=deals.filter(d=>LOST_STATUSES.includes(d.status));

  if(!deals.length){
    document.getElementById("countLabel").textContent="0 deals";
    document.getElementById("listArea").innerHTML=`<div style="text-align:center;padding:60px 20px;color:#475569;grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🤝</div><div style="font-size:16px;font-weight:700;color:#94a3b8">No Deals Yet</div><div style="font-size:13px;color:#64748b;margin-top:6px;max-width:320px;margin-left:auto;margin-right:auto">When you hit "Save & Make Offer" from the calculator, deals appear here with full pipeline tracking.</div></div>`;
    return;
  }

  document.getElementById("countLabel").textContent=`${active.length} active${won.length?' · '+won.length+' won':''}${lost.length?' · '+lost.length+' dead':''}`;

  let html='';

  // ── ACTIVE DEALS ──
  if(active.length){
    html+=active.map((d,i)=>{
      const tl=Array.isArray(d.timeline)?d.timeline:[];
      const lastEvent=tl.length?tl[tl.length-1]:null;
      const counters=(d.counter_count||0);
      const currentPrice=d.accepted_price||d.offer_price||0;
      const originalPrice=d.original_offer_price||d.offer_price||0;
      const priceChanged=currentPrice!==originalPrice;
      const profit=d.projected_profit_target||0;
      const daysSince=d.updated_at?Math.floor((Date.now()-new Date(d.updated_at).getTime())/(1000*60*60*24)):0;
      const stale=daysSince>3;

      return`<div class="card" onclick="openDeal('${d.id}')" style="animation:fadeUp .3s ease ${i*30}ms both;border-left:3px solid ${(DEAL_STAGES[d.status]||{}).color||'#64748b'}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.address)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${d.community?esc(d.community)+' · ':''}${d.zip_code||''} · ${d.sqft?.toLocaleString()||'?'}sf</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${dealBadge(d.status)}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.02)">
          <div style="text-align:center">
            <div style="font-size:8px;color:#64748b;font-weight:700">OFFER</div>
            <div style="font-size:15px;font-weight:800;color:#e2e8f0;margin-top:2px">${$k(currentPrice)}</div>
            ${priceChanged?`<div style="font-size:9px;color:#f59e0b">was ${$k(originalPrice)}</div>`:''}
          </div>
          <div style="text-align:center">
            <div style="font-size:8px;color:#64748b;font-weight:700">LIST</div>
            <div style="font-size:15px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(d.list_price)}</div>
            ${d.list_price&&currentPrice?`<div style="font-size:9px;color:#22c55e">${((d.list_price-currentPrice)/d.list_price*100).toFixed(1)}% below</div>`:''}
          </div>
          <div style="text-align:center">
            <div style="font-size:8px;color:#64748b;font-weight:700">EST PROFIT</div>
            <div style="font-size:15px;font-weight:800;color:${profit>=150000?'#22c55e':profit>=75000?'#f59e0b':'#ef4444'};margin-top:2px">${$k(profit)}</div>
          </div>
        </div>

        <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
          ${counters?`<span style="font-size:9px;color:#f59e0b;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.15);padding:2px 8px;border-radius:6px;font-weight:700">${counters} counter${counters>1?'s':''}</span>`:''}
          ${d.accepted_commission_pct!=null?`<span style="font-size:9px;color:#d4af37;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);padding:2px 8px;border-radius:6px;font-weight:700">Lisa ${d.accepted_commission_pct}%</span>`:`<span style="font-size:9px;color:#d4af37;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);padding:2px 8px;border-radius:6px;font-weight:700">Lisa ${d.lisa_buy_commission_pct||0}%</span>`}
          ${d.coe_date?`<span style="font-size:9px;color:#94a3b8;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:2px 8px;border-radius:6px;font-weight:600">COE ${new Date(d.coe_date).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'})}</span>`:''}
          ${stale?`<span style="font-size:9px;color:#ef4444;font-weight:700">${daysSince}d no update</span>`:''}
        </div>

        ${lastEvent?`<div style="font-size:10px;color:#64748b;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">Latest: <span style="color:#94a3b8">${esc(lastEvent.summary||lastEvent.type||'')}</span> · ${lastEvent.date?new Date(lastEvent.date).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):''}</div>`:''}
        ${d.updated_by_email||d.created_by_email?`<div style="font-size:9px;color:#475569;margin-top:4px">${d.updated_by_email?'Last update by '+esc(d.updated_by_email.split('@')[0]):'Created by '+esc(d.created_by_email.split('@')[0])}${d.updated_at?' · '+new Date(d.updated_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):''}  </div>`:''}
      </div>`;
    }).join('');
  }

  // ── WON DEALS (Projects) ──
  if(won.length){
    html+=`<div style="grid-column:1/-1;margin-top:16px;padding-top:16px;border-top:1px solid rgba(212,175,55,0.15)"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">🏆 WON — ACTIVE PROJECTS (${won.length})</div></div>`;
    html+=won.map(d=>{
      const finalPrice=d.accepted_price||d.offer_price||0;
      const profit=d.projected_profit_target||0;
      return`<div class="card" onclick="openDeal('${d.id}')" style="border-left:3px solid #d4af37;background:linear-gradient(135deg,rgba(212,175,55,0.06),rgba(16,185,129,0.04));border:1px solid rgba(212,175,55,0.15)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:800;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🏆 ${esc(d.address)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${d.community?esc(d.community)+' · ':''}${d.zip_code||''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:800;color:#d4af37">${$k(finalPrice)}</div>
            <div style="font-size:10px;color:#22c55e;font-weight:700">${$k(profit)} profit</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
          <span style="font-size:9px;color:#d4af37;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);padding:2px 8px;border-radius:6px;font-weight:800">DEAL WON</span>
          ${d.coe_date?`<span style="font-size:9px;color:#94a3b8">COE ${new Date(d.coe_date).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'})}</span>`:''}
          ${d.accepted_commission_pct!=null?`<span style="font-size:9px;color:#d4af37">Lisa ${d.accepted_commission_pct}%</span>`:''}
        </div>
      </div>`;
    }).join('');
  }

  // ── LOST DEALS ──
  if(lost.length){
    html+=`<div style="grid-column:1/-1;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)"><div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:2px;margin-bottom:8px">DEAD (${lost.length})</div></div>`;
    html+=lost.map(d=>{
      return`<div class="card" onclick="openDeal('${d.id}')" style="opacity:0.5;border-left:3px solid ${(DEAL_STAGES[d.status]||{}).color||'#64748b'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.address)}</div>
            <div style="font-size:10px;color:#475569;margin-top:2px">${$k(d.offer_price)} offer · ${d.kill_reason?esc(d.kill_reason):'no reason logged'}</div>
          </div>
          ${dealBadge(d.status)}
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById("listArea").innerHTML=html;
}

// ═══ DEAL DETAIL MODAL ═══
let currentDeal=null;

function closeDeal(){document.getElementById("dealModal").style.display="none";currentDeal=null;document.body.style.overflow="";}

async function openDeal(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  currentDeal=d;
  const tl=Array.isArray(d.timeline)?d.timeline:[];
  const conc=Array.isArray(d.concessions)?d.concessions:[];
  const stages=Object.entries(DEAL_STAGES).filter(([k])=>!DEAD_STATUSES.includes(k));
  const isDead=DEAD_STATUSES.includes(d.status);
  const currentPrice=d.accepted_price||d.offer_price||0;

  const m=document.getElementById("dealModal");
  m.innerHTML=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeDeal()">✕</button>

    <!-- HEADER -->
    <div style="margin-bottom:16px;padding-right:40px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px">DEAL TRACKER</div>
        <span id="deal_statusBadge">${dealBadge(d.status)}</span>
      </div>
      <div style="font-size:18px;font-weight:800;margin-top:2px">${esc(d.address)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">${d.community?esc(d.community)+' · ':''}${d.zip_code||''} · MLS# ${d.mls_number||'?'}</div>
    </div>

    <!-- DEAL SUMMARY BAR -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:16px">
      <div style="text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700;letter-spacing:1px">LIST</div><div style="font-size:14px;font-weight:800;color:#94a3b8">${$k(d.list_price)}</div></div>
      <div style="text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700;letter-spacing:1px">CURRENT</div><div style="font-size:14px;font-weight:800;color:#e2e8f0">${$k(currentPrice)}</div></div>
      <div style="text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700;letter-spacing:1px">COMMISSION</div><div style="font-size:14px;font-weight:800;color:#d4af37">${d.accepted_commission_pct!=null?d.accepted_commission_pct:d.lisa_buy_commission_pct||0}%</div></div>
      <div style="text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700;letter-spacing:1px">EST PROFIT</div><div style="font-size:14px;font-weight:800;color:#22c55e">${$k(d.projected_profit_target)}</div></div>
    </div>

    <!-- KEY DATES -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px">
      <div style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700">CREATED</div><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px">${d.created_at?new Date(d.created_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):'-'}</div></div>
      <div style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700">CONTRACT</div><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px">${d.contract_date?new Date(d.contract_date).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):'-'}</div></div>
      <div style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700">COE DATE</div><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px">${d.coe_date?new Date(d.coe_date).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):'-'}</div></div>
    </div>

    <!-- PIPELINE STATUS UPDATE -->
    ${!isDead?`<div style="margin-bottom:16px">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">UPDATE STATUS</div>
      <div id="deal_statusBtns" style="display:flex;gap:6px;flex-wrap:wrap">
        ${stages.map(([k,v])=>`<button onclick="updateDealStatus('${d.id}','${k}')" style="padding:6px 12px;border-radius:8px;border:1px solid ${d.status===k?v.color+'60':' rgba(255,255,255,0.06)'};background:${d.status===k?v.color+'15':'rgba(255,255,255,0.02)'};color:${d.status===k?v.color:'#64748b'};font-size:10px;font-weight:700;cursor:pointer;min-height:36px;transition:all .15s">${v.icon} ${v.label}</button>`).join('')}
      </div>
      <div id="deal_killBtns" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">
        <button onclick="winDeal('${d.id}')" style="padding:8px;border-radius:8px;border:1px solid rgba(34,197,94,0.25);background:rgba(34,197,94,0.06);color:#22c55e;font-size:10px;font-weight:700;cursor:pointer;min-height:36px">🏆 Won</button>
        <button onclick="killDeal('${d.id}','rejected')" style="padding:8px;border-radius:8px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.04);color:#ef4444;font-size:10px;font-weight:700;cursor:pointer;min-height:36px">❌ Rejected</button>
        <button onclick="killDeal('${d.id}','withdrawn')" style="padding:8px;border-radius:8px;border:1px solid rgba(100,116,139,0.2);background:rgba(100,116,139,0.04);color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer;min-height:36px">🚫 Withdraw</button>
        <button onclick="killDeal('${d.id}','expired')" style="padding:8px;border-radius:8px;border:1px solid rgba(100,116,139,0.2);background:rgba(100,116,139,0.04);color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer;min-height:36px">⏰ Expired</button>
      </div>
    </div>`:`<div style="margin-bottom:16px;padding:12px;border-radius:10px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15)"><div style="font-size:10px;color:#ef4444;font-weight:800;letter-spacing:1px">DEAL ${d.status?.toUpperCase()}</div>${d.kill_reason?`<div style="font-size:12px;color:#94a3b8;margin-top:4px">${esc(d.kill_reason)}</div>`:''}<button onclick="updateDealStatus('${d.id}','offer_drafted')" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer">♻️ Reopen Deal</button></div>`}

    <!-- EDIT DEAL NUMBERS -->
    <button onclick="openCalcForDeal('${d.id}')" class="btn" style="width:100%;margin-bottom:8px;padding:14px;font-size:14px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#60a5fa;font-weight:800">🧮 Edit Deal Numbers</button>

    <!-- GENERATE RPA -->
    <button onclick="openRPAFromDeal('${d.id}')" class="btn" style="width:100%;margin-bottom:16px;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(224,201,127,0.15),rgba(212,175,55,0.08));border:1px solid rgba(224,201,127,0.3);color:#e0c97f;font-weight:800">📄 Generate GLVAR RPA</button>

    <!-- LOG COUNTER OFFER -->
    <div style="margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(249,115,22,0.03);border:1px solid rgba(249,115,22,0.12)">
      <div style="font-size:10px;color:#f97316;font-weight:700;letter-spacing:2px;margin-bottom:10px">LOG COUNTER OFFER</div>
      <div class="row2">
        <div class="fld"><label>FROM</label>
          <select id="co_from" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:14px;font-weight:700;min-height:44px">
            <option value="seller">Seller</option>
            <option value="buyer">Buyer (us)</option>
          </select>
        </div>
        <div class="fld"><label>COUNTER PRICE</label><input id="co_price" type="number" class="cinput" value="${currentPrice}"/></div>
      </div>
      <div class="row2">
        <div class="fld"><label>COMMISSION %</label><input id="co_commission" type="number" step="0.5" class="cinput" value="${d.accepted_commission_pct!=null?d.accepted_commission_pct:d.lisa_buy_commission_pct||0}"/></div>
        <div class="fld"><label>COE DATE</label><input id="co_coedate" type="date" class="cinput" value="${d.coe_date||''}"/></div>
      </div>
      <div class="fld"><label>KEY TERMS / NOTES</label><textarea id="co_terms" rows="2" class="cinput" style="font-size:13px;min-height:60px" placeholder="As-is, informational inspections only, pool heater ack..."></textarea></div>
      <button onclick="logCounter('${d.id}')" class="btn" style="width:100%;margin-top:8px;padding:12px;font-size:13px;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.3);color:#f97316;font-weight:800">↩️ Log Counter Offer</button>
    </div>

    <!-- CONCESSIONS -->
    <div style="margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(139,92,246,0.03);border:1px solid rgba(139,92,246,0.12)">
      <div style="font-size:10px;color:#8b5cf6;font-weight:700;letter-spacing:2px;margin-bottom:8px">CONCESSIONS (${conc.length})</div>
      <div id="concList">${conc.length?conc.map((c,i)=>`<div style="display:flex;align-items:start;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)"><div style="flex:1"><div style="font-size:11px;font-weight:700;color:${c.party==='buyer'?'#3b82f6':'#f59e0b'}">${c.party==='buyer'?'BUYER':'SELLER'}</div><div style="font-size:12px;color:#e2e8f0;font-weight:600">${esc(c.item)}</div>${c.detail?`<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(c.detail)}</div>`:''}</div><button onclick="removeConcession('${d.id}',${i})" style="flex-shrink:0;width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.05);color:#ef4444;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center">✕</button></div>`).join(''):`<div style="font-size:11px;color:#475569;padding:8px">No concessions logged</div>`}</div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <select id="conc_party" style="padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:12px;font-weight:700;min-height:40px">
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <input id="conc_item" class="cinput" placeholder="e.g. As-is condition" style="flex:1;font-size:12px;min-height:40px"/>
        <button onclick="addConcession('${d.id}')" class="btn" style="padding:8px 14px;font-size:12px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);color:#8b5cf6;font-weight:800;white-space:nowrap">+ Add</button>
      </div>
    </div>

    <!-- KEY DATES EDIT -->
    <div style="margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">KEY DATES</div>
      <div class="row2">
        <div class="fld"><label>CONTRACT DATE</label><input id="deal_contractdate" type="date" class="cinput" value="${d.contract_date||''}" onchange="saveDealField('${d.id}','contract_date',this.value)"/></div>
        <div class="fld"><label>COE DATE</label><input id="deal_coedate" type="date" class="cinput" value="${d.coe_date||''}" onchange="saveDealField('${d.id}','coe_date',this.value)"/></div>
      </div>
      <div class="row2">
        <div class="fld"><label>ACCEPTED PRICE</label><input id="deal_acceptedprice" type="number" class="cinput" value="${d.accepted_price||''}" onchange="saveDealField('${d.id}','accepted_price',Number(this.value))"/></div>
        <div class="fld"><label>ACCEPTED COMMISSION %</label><input id="deal_acceptedcomm" type="number" step="0.5" class="cinput" value="${d.accepted_commission_pct!=null?d.accepted_commission_pct:''}" onchange="saveDealField('${d.id}','accepted_commission_pct',Number(this.value))"/></div>
      </div>
    </div>

    <!-- TIMELINE -->
    <div style="margin-bottom:16px">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">TIMELINE (${tl.length} events)</div>
      <div id="dealTimeline">${tl.length?tl.slice().reverse().map(e=>{
        const typeColors={offer_submitted:'#3b82f6',counter_received:'#f59e0b',counter_sent:'#a855f7',accepted:'#22c55e',rejected:'#ef4444',expired:'#64748b',note:'#94a3b8',status_change:'#06b6d4'};
        const tc=typeColors[e.type]||'#64748b';
        return`<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${tc};margin-top:4px"></div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:11px;font-weight:700;color:${tc}">${(e.type||'').replace(/_/g,' ').toUpperCase()}${e.from?' · '+e.from.toUpperCase():''}</div>
              <div style="font-size:9px;color:#475569">${e.date?new Date(e.date).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):''}</div>
            </div>
            <div style="font-size:12px;color:#e2e8f0;margin-top:2px">${esc(e.summary||'')}</div>
            ${e.price?`<div style="font-size:11px;color:#94a3b8;margin-top:2px">Price: ${$(e.price)}${e.commission_pct!=null?' · Commission: '+e.commission_pct+'%':''}</div>`:''}
            ${e.terms?`<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(e.terms)}</div>`:''}
          </div>
        </div>`;
      }).join(''):`<div style="font-size:11px;color:#475569;padding:12px">No events logged yet. Log a counter or update status to start the timeline.</div>`}</div>
    </div>

    <!-- ADD NOTE -->
    <div style="display:flex;gap:6px;margin-bottom:16px">
      <input id="deal_note" class="cinput" placeholder="Add a note to timeline..." style="flex:1;font-size:12px;min-height:40px"/>
      <button onclick="addDealNote('${d.id}')" class="btn" style="padding:8px 14px;font-size:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;font-weight:700;white-space:nowrap">+ Note</button>
    </div>

    <!-- DELETE DEAL -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(239,68,68,0.12)">
      <button onclick="deleteDeal('${d.id}')" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#ef4444;font-size:12px;font-weight:700;cursor:pointer">Delete Deal</button>
    </div>

  </div>`;

  m.style.display="block";document.body.style.overflow="hidden";
}

// ═══ DEAL ACTIONS ═══
async function deleteDeal(dealId){
  if(!confirm("Delete this deal permanently? This cannot be undone."))return;
  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'DELETE',headers:HD});
    deals=deals.filter(x=>x.id!==dealId);
    closeDeal();
    renderDashboard();
  }catch(e){console.error("Delete deal failed:",e);}
}

function renderStatusButtons(d){
  const stages=Object.entries(DEAL_STAGES).filter(([k])=>!DEAD_STATUSES.includes(k));
  return stages.map(([k,v])=>`<button onclick="updateDealStatus('${d.id}','${k}')" style="padding:6px 12px;border-radius:8px;border:1px solid ${d.status===k?v.color+'60':' rgba(255,255,255,0.06)'};background:${d.status===k?v.color+'15':'rgba(255,255,255,0.02)'};color:${d.status===k?v.color:'#64748b'};font-size:10px;font-weight:700;cursor:pointer;min-height:36px;transition:all .15s">${v.icon} ${v.label}</button>`).join('');
}

function renderTimelineEntry(e){
  const typeColors={offer_submitted:'#3b82f6',counter_received:'#f59e0b',counter_sent:'#a855f7',accepted:'#22c55e',rejected:'#ef4444',expired:'#64748b',note:'#94a3b8',status_change:'#06b6d4'};
  const tc=typeColors[e.type]||'#64748b';
  return`<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
    <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${tc};margin-top:4px"></div>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;font-weight:700;color:${tc}">${(e.type||'').replace(/_/g,' ').toUpperCase()}${e.from?' · '+e.from.toUpperCase():''}</div>
        <div style="font-size:9px;color:#475569">${e.date?new Date(e.date).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):''}</div>
      </div>
      <div style="font-size:12px;color:#e2e8f0;margin-top:2px">${esc(e.summary||'')}</div>
      ${e.price?`<div style="font-size:11px;color:#94a3b8;margin-top:2px">Price: ${$(e.price)}${e.commission_pct!=null?' · Commission: '+e.commission_pct+'%':''}</div>`:''}
      ${e.terms?`<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(e.terms)}</div>`:''}
    </div>
  </div>`;
}

async function updateDealStatus(dealId,newStatus){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const oldStatus=d.status;
  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  const newEntry={date:new Date().toISOString(),type:'status_change',from:'system',summary:`Status: ${(DEAL_STAGES[oldStatus]||{}).label||oldStatus} → ${(DEAL_STAGES[newStatus]||{}).label||newStatus}`};
  tl.push(newEntry);

  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({status:newStatus,timeline:tl,kill_reason:null,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.status=newStatus;d.timeline=tl;d.kill_reason=null;
    // Full re-render if transitioning from dead status (layout changes entirely)
    if(DEAD_STATUSES.includes(oldStatus)){
      openDeal(dealId);
    } else {
      // Surgical DOM update for active→active transitions
      const badge=document.getElementById("deal_statusBadge");
      if(badge)badge.innerHTML=dealBadge(newStatus);
      const btns=document.getElementById("deal_statusBtns");
      if(btns)btns.innerHTML=renderStatusButtons(d);
      const timeline=document.getElementById("dealTimeline");
      if(timeline)timeline.insertAdjacentHTML("afterbegin",renderTimelineEntry(newEntry));
    }
    renderDashboard();
  }catch(e){console.error("Status update failed:",e);}
}

async function winDeal(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  tl.push({date:new Date().toISOString(),type:'status_change',from:'system',summary:'🏆 DEAL WON — Project started'});
  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({status:'closed',timeline:tl,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.status='closed';d.timeline=tl;
    closeDeal();
    renderDashboard();
    fireConfetti();
  }catch(e){console.error("Win deal failed:",e);}
}

async function killDeal(dealId,status){
  const reason=prompt(`Why is this deal ${status}?`);
  if(reason===null)return;
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  tl.push({date:new Date().toISOString(),type:status,from:'system',summary:`Deal ${status}${reason?': '+reason:''}`});

  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({status:status,kill_reason:reason||null,timeline:tl,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.status=status;d.kill_reason=reason;d.timeline=tl;
    openDeal(dealId);
    renderDashboard();
  }catch(e){console.error("Kill deal failed:",e);}
}

async function logCounter(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const from=document.getElementById("co_from").value;
  const price=Number(document.getElementById("co_price").value)||0;
  const commission=Number(document.getElementById("co_commission").value);
  const coeDate=document.getElementById("co_coedate").value||null;
  const terms=document.getElementById("co_terms").value||'';
  const count=(d.counter_count||0)+1;

  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  tl.push({
    date:new Date().toISOString(),
    type:from==='seller'?'counter_received':'counter_sent',
    from:from,
    summary:`CO#${count} from ${from}: ${$(price)}${commission!=null?' · '+commission+'% commission':''}`,
    price:price,
    commission_pct:commission,
    terms:terms
  });

  const newStatus=from==='seller'?'counter_received':'counter_sent';
  const patch={
    status:newStatus,
    counter_count:count,
    timeline:tl,
    offer_price:price,
    original_offer_price:d.original_offer_price||d.offer_price
  };
  if(commission!=null) patch.accepted_commission_pct=commission;
  if(coeDate) patch.coe_date=coeDate;

  try{
    patch.updated_by=window.SH_USER?.id||null;
    patch.updated_by_email=window.SH_USER?.email||null;
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify(patch)});
    Object.assign(d,patch);
    openDeal(dealId);
    renderDashboard();
  }catch(e){console.error("Counter log failed:",e);}
}

async function addConcession(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const party=document.getElementById("conc_party").value;
  const item=document.getElementById("conc_item").value.trim();
  if(!item)return;

  const conc=Array.isArray(d.concessions)?[...d.concessions]:[];
  conc.push({party:party,item:item,detail:''});

  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  tl.push({date:new Date().toISOString(),type:'note',from:party,summary:`Concession: ${item}`});

  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({concessions:conc,timeline:tl,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.concessions=conc;d.timeline=tl;
    openDeal(dealId);
  }catch(e){console.error("Add concession failed:",e);}
}

async function removeConcession(dealId,idx){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const conc=Array.isArray(d.concessions)?[...d.concessions]:[];
  conc.splice(idx,1);
  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({concessions:conc,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.concessions=conc;
    openDeal(dealId);
  }catch(e){console.error("Remove concession failed:",e);}
}

async function addDealNote(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const note=document.getElementById("deal_note").value.trim();
  if(!note)return;
  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  tl.push({date:new Date().toISOString(),type:'note',from:'user',summary:note});
  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({timeline:tl,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.timeline=tl;
    openDeal(dealId);
  }catch(e){console.error("Add note failed:",e);}
}

async function saveDealField(dealId,field,value){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  const patch={};patch[field]=value||null;patch.updated_by=window.SH_USER?.id||null;patch.updated_by_email=window.SH_USER?.email||null;
  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify(patch)});
    d[field]=value;
  }catch(e){console.error("Save field failed:",e);}
}
