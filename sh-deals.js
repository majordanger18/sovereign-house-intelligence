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
  in_renovation:{label:"In Renovation",color:"#f97316",icon:"🔨"},
  renovation_complete:{label:"Reno Complete",color:"#10b981",icon:"✅"},
  listing_prep:{label:"Listing Prep",color:"#06b6d4",icon:"📸"},
  listed:{label:"Listed",color:"#8b5cf6",icon:"🏷️"},
  sold:{label:"Sold",color:"#d4af37",icon:"🏆"},
  rejected:{label:"Rejected",color:"#ef4444",icon:"❌"},
  withdrawn:{label:"Withdrawn",color:"#64748b",icon:"🚫"},
  expired:{label:"Expired",color:"#64748b",icon:"⏰"}
};
const DEAD_STATUSES=["sold","rejected","withdrawn","expired"];
const LOST_STATUSES=["rejected","withdrawn","expired"];

async function setPropertyDisposition(propertyId,disposition){
  if(!propertyId)return;
  const patch={disposition:disposition||null,disposition_date:disposition?new Date().toISOString():null,disposition_by:window.SH_USER?.email||null};
  if(!disposition)patch.disposition_reason=null;
  try{
    await fetch(`${SB}/rest/v1/properties?id=eq.${propertyId}`,{method:'PATCH',headers:HD,body:JSON.stringify(patch)});
    const p=props.find(x=>x.id===propertyId);
    if(p)Object.assign(p,patch);
  }catch(e){console.error("Set disposition failed:",e);}
}

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
  const dq=(document.getElementById("searchBox")?.value||"").toLowerCase();
  const dFilter=d=>!dq||(d.address||"").toLowerCase().includes(dq)||(d.community||"").toLowerCase().includes(dq)||(d.zip_code||"").includes(dq);
  const active=deals.filter(d=>!DEAD_STATUSES.includes(d.status)&&dFilter(d));
  const won=deals.filter(d=>d.status==="sold"&&dFilter(d));
  const lost=deals.filter(d=>LOST_STATUSES.includes(d.status)&&dFilter(d));

  if(!deals.length){
    document.getElementById("countLabel").textContent="0 deals";
    document.getElementById("listArea").innerHTML=`<div style="text-align:center;padding:60px 20px;color:#475569;grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🤝</div><div style="font-size:16px;font-weight:700;color:#94a3b8">No Deals Yet</div><div style="font-size:13px;color:#64748b;margin-top:6px;max-width:320px;margin-left:auto;margin-right:auto">When you hit "Save & Make Offer" from the calculator, deals appear here with full pipeline tracking.</div></div>`;
    return;
  }

  document.getElementById("countLabel").textContent=`${active.length} active${won.length?' · '+won.length+' won':''}${lost.length?' · '+lost.length+' dead':''}`;

  if(!active.length&&!won.length&&!lost.length&&dq){
    document.getElementById("listArea").innerHTML=`<div style="text-align:center;padding:40px;color:#475569;grid-column:1/-1"><div style="font-size:32px;margin-bottom:8px">🤝</div><div style="font-size:14px;font-weight:600">No deals match</div></div>`;
    return;
  }

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
      <div id="deal_statusBtns">${renderStatusButtons(d)}</div>
    </div>`:`<div style="margin-bottom:16px;padding:12px;border-radius:10px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15)"><div style="font-size:10px;color:#ef4444;font-weight:800;letter-spacing:1px">DEAL ${d.status?.toUpperCase()}</div>${d.kill_reason?`<div style="font-size:12px;color:#94a3b8;margin-top:4px">${esc(d.kill_reason)}</div>`:''}<button onclick="updateDealStatus('${d.id}','offer_drafted')" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#94a3b8;font-size:10px;font-weight:700;cursor:pointer">♻️ Reopen Deal</button></div>`}

    <!-- FINANCING SUMMARY -->
    <div id="dealFinSummary"></div>

    <!-- SECONDARY ACTIONS -->
    <button onclick="openCalcForDeal('${d.id}')" class="btn" style="width:100%;margin-bottom:8px;padding:12px;font-size:13px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#60a5fa;font-weight:800">🧮 Edit Deal Numbers</button>
    <button onclick="openFinancing('${d.id}')" class="btn" style="width:100%;margin-bottom:8px;padding:12px;font-size:13px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);color:#22d3ee;font-weight:800">💰 Financing</button>
    <button onclick="openRPAFromDeal('${d.id}')" class="btn" style="width:100%;margin-bottom:8px;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(224,201,127,0.15),rgba(212,175,55,0.08));border:1px solid rgba(224,201,127,0.3);color:#e0c97f;font-weight:800">📄 Generate GLVAR RPA</button>
    ${d.rpa_generated_at?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:16px;border-radius:10px;background:rgba(224,201,127,0.04);border:1px solid rgba(224,201,127,0.12)">
      <div style="font-size:10px;color:#e0c97f">
        <span style="font-weight:700">RPA v${d.rpa_version||1}</span> · sent ${new Date(d.rpa_generated_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"})}${d.rpa_generated_by_email?' by '+esc(d.rpa_generated_by_email.split('@')[0]):''}
        ${d.rpa_url?` · <a href="${esc(d.rpa_url)}" target="_blank" style="color:#60a5fa;text-decoration:underline">View PDF</a>`:''}
      </div>
      <button onclick="deleteRPA('${d.id}')" style="background:none;border:none;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer;padding:4px 8px;white-space:nowrap">Delete RPA</button>
    </div>`:`<div style="margin-bottom:16px"></div>`}

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

    <!-- DEAL OUTCOMES -->
    ${['sold','listed','renovation_complete','closed'].includes(d.status)?`<div id="dealOutcomesArea" style="margin-bottom:16px"></div>`:''}

    <!-- DELETE DEAL -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(239,68,68,0.12)">
      <button onclick="deleteDeal('${d.id}')" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#ef4444;font-size:12px;font-weight:700;cursor:pointer">Delete Deal</button>
    </div>

  </div>`;

  m.style.display="block";document.body.style.overflow="hidden";

  // Load financing summary asynchronously
  loadDealFinSummary(d.id);
  if(['sold','listed','renovation_complete','closed'].includes(d.status)) loadDealOutcomes(d.id);
}

// ═══ DEAL ACTIONS ═══
async function deleteRPA(dealId){
  if(!confirm("Delete this RPA and reset? This cannot be undone."))return;
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  try{
    // Delete file from Supabase Storage if URL exists
    if(d.rpa_url&&d.rpa_version){
      const filePath=`deals/${dealId}/rpa-v${d.rpa_version}-unsigned.pdf`;
      try{await supabaseClient.storage.from('rpa-documents').remove([filePath]);}catch(e){console.warn("Storage delete failed:",e);}
    }
    // Reset RPA fields on deal
    const reset={rpa_generated_at:null,rpa_generated_by:null,rpa_generated_by_email:null,rpa_url:null,rpa_version:0,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null};
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify(reset)});
    Object.assign(d,reset);
    openDeal(dealId);
  }catch(e){console.error("Delete RPA failed:",e);}
}

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
  const pipeKeys=Object.keys(DEAL_STAGES).filter(k=>!DEAD_STATUSES.includes(k));
  const curIdx=pipeKeys.indexOf(d.status);
  const cur=DEAL_STAGES[d.status]||{label:d.status,color:'#64748b',icon:'?'};
  const prevKey=curIdx>0?pipeKeys[curIdx-1]:null;
  const nextKey=curIdx>=0&&curIdx<pipeKeys.length-1?pipeKeys[curIdx+1]:null;
  const prevS=prevKey?DEAL_STAGES[prevKey]:null;
  const nextS=nextKey?DEAL_STAGES[nextKey]:null;

  // ROW 1 — Current status (large centered card)
  let h=`<div style="text-align:center;padding:16px;border-radius:14px;background:${cur.color}14;border:1px solid ${cur.color}33;margin-bottom:8px"><div style="font-size:18px;font-weight:800;color:${cur.color}">${cur.icon} ${cur.label.toUpperCase()}</div></div>`;

  // ROW 2 — Next (primary action, full width, gold gradient)
  if(nextKey){
    h+=`<button onclick="updateDealStatus('${d.id}','${nextKey}')" style="width:100%;padding:16px;border-radius:10px;border:none;background:linear-gradient(135deg,#d4af37,#b8962e);color:#000;font-size:16px;font-weight:800;cursor:pointer;min-height:48px;margin-bottom:8px">${nextS.label} →</button>`;
  } else {
    h+=`<button disabled style="width:100%;padding:16px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:#27272a;font-size:16px;font-weight:800;min-height:48px;cursor:default;margin-bottom:8px">Next →</button>`;
  }

  // ROW 3 — Prev (muted, smaller)
  if(prevKey){
    h+=`<button onclick="updateDealStatus('${d.id}','${prevKey}')" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:#475569;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:12px">← ${prevS.label}</button>`;
  } else {
    h+=`<div style="margin-bottom:12px"></div>`;
  }

  // ROW 4 — Deal outcome buttons (2x2) — only during offer/negotiation phase
  if(!['closing','closed','in_renovation','renovation_complete','listing_prep','listed','sold'].includes(d.status)){
    h+=`<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:8px"><div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:2px;text-align:center;margin-bottom:8px">CLOSE DEAL</div>`;
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`;
    h+=`<button onclick="winDeal('${d.id}')" style="padding:10px;border-radius:10px;border:1px solid rgba(34,197,94,0.15);background:rgba(34,197,94,0.04);color:#22c55e;font-size:12px;font-weight:800;cursor:pointer;min-height:40px">🏆 Keys In Hand</button>`;
    h+=`<button onclick="killDeal('${d.id}','rejected')" style="padding:10px;border-radius:10px;border:1px solid rgba(239,68,68,0.12);background:rgba(239,68,68,0.03);color:#ef4444;font-size:12px;font-weight:800;cursor:pointer;min-height:40px;opacity:0.7">❌ Rejected</button>`;
    h+=`<button onclick="killDeal('${d.id}','withdrawn')" style="padding:10px;border-radius:10px;border:1px solid rgba(100,116,139,0.12);background:rgba(100,116,139,0.03);color:#94a3b8;font-size:12px;font-weight:800;cursor:pointer;min-height:40px;opacity:0.7">🚫 Withdraw</button>`;
    h+=`<button onclick="killDeal('${d.id}','expired')" style="padding:10px;border-radius:10px;border:1px solid rgba(100,116,139,0.12);background:rgba(100,116,139,0.03);color:#94a3b8;font-size:12px;font-weight:800;cursor:pointer;min-height:40px;opacity:0.7">⏰ Expired</button>`;
    h+=`</div></div>`;
  }
  return h;
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
  const newLabel=(DEAL_STAGES[newStatus]||{}).label||newStatus;
  if(!confirm("Move deal to "+newLabel+"?"))return;
  const oldStatus=d.status;
  const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
  const newEntry={date:new Date().toISOString(),type:'status_change',from:'system',summary:`Status: ${(DEAL_STAGES[oldStatus]||{}).label||oldStatus} → ${(DEAL_STAGES[newStatus]||{}).label||newStatus}`};
  tl.push(newEntry);

  try{
    await fetch(`${SB}/rest/v1/deals?id=eq.${dealId}`,{method:'PATCH',headers:HD,body:JSON.stringify({status:newStatus,timeline:tl,kill_reason:null,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
    d.status=newStatus;d.timeline=tl;d.kill_reason=null;
    // Auto-set disposition on linked property
    const disp=newStatus==='sold'?'sold':newStatus==='closed'?'acquired':DEAD_STATUSES.includes(newStatus)?null:'pursuing';
    await setPropertyDisposition(d.property_id,disp);
    // Auto-advance deal_financing status
    const finMap={closing:"clear_to_close",closed:"funded",in_renovation:"active",sold:"paid_off"};
    if(finMap[newStatus]){
      try{
        const fi=await sb("deal_financing?deal_id=eq."+dealId);
        if(Array.isArray(fi)&&fi.length){
          const patch={status:finMap[newStatus]};
          if(newStatus==="closed")patch.funded_date=new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"});
          await fetch(SB+"/rest/v1/deal_financing?deal_id=eq."+dealId,{method:"PATCH",headers:HD,body:JSON.stringify(patch)});
        }
      }catch(e){console.error("[SH] Financing auto-advance (non-fatal):",e);}
    }
    // Full re-render — layout changes between stages (outcomes area, dead section)
    openDeal(dealId);
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
    await setPropertyDisposition(d.property_id,'acquired');
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
    await setPropertyDisposition(d.property_id,null);
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
    await setPropertyDisposition(d.property_id,'pursuing');
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

async function loadDealFinSummary(dealId){
  const el=document.getElementById("dealFinSummary");if(!el)return;
  try{
    const res=await sb("deal_financing?deal_id=eq."+dealId);
    const f=Array.isArray(res)&&res.length?res[0]:null;
    if(!f){el.innerHTML='';return;}
    const st=f.status||"application";
    const funded=st==="funded"||st==="active";
    const pending=st==="application"||st==="approved";
    const sc2=funded?"#22c55e":pending?"#eab308":"#94a3b8";
    let matWarn='';
    if(f.maturity_date){
      const diff=(new Date(f.maturity_date+"T00:00:00")-new Date())/(864e5*30);
      if(diff<4)matWarn=` · <span style="color:#ef4444;font-weight:800">Matures ${new Date(f.maturity_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"})}</span>`;
      else matWarn=` · Matures ${new Date(f.maturity_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"})}`;
    }
    el.innerHTML=`<div style="margin-bottom:8px">
      <div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:4px">FINANCING</div>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);font-size:11px;color:${sc2}">
        ${esc(f.lender_name||'—')} | ${f.interest_rate||'—'}% | ${$r(f.funded_principal)} principal${matWarn}
        ${pending?' · <span style="color:#eab308">⏳ Pending funding</span>':''}
        <button onclick="openFinancing('${dealId}')" style="float:right;padding:4px 10px;border-radius:6px;border:1px solid rgba(212,175,55,0.25);background:rgba(212,175,55,0.08);color:#d4af37;font-size:10px;font-weight:700;cursor:pointer">View Details</button>
      </div>
    </div>`;
  }catch(e){el.innerHTML='';}
}

// ═══ DEAL OUTCOMES ═══
async function loadDealOutcomes(dealId){
  const el=document.getElementById("dealOutcomesArea");if(!el)return;
  let existing=null;
  try{
    const res=await sb("deal_outcomes?deal_id=eq."+dealId);
    if(Array.isArray(res)&&res.length)existing=res[0];
  }catch(e){}

  let h=`<div style="padding:14px;border-radius:14px;background:rgba(16,185,129,0.03);border:1px solid rgba(16,185,129,0.12)">`;
  h+=`<div style="font-size:10px;color:#10b981;font-weight:700;letter-spacing:2px;margin-bottom:10px">DEAL OUTCOMES</div>`;
  h+=`<div class="row2"><div class="fld"><label>ACTUAL RENO COST</label><input id="do_reno" type="number" class="cinput" value="${existing?.actual_reno_cost??''}" oninput="calcOutcomeProfit()"/></div>`;
  h+=`<div class="fld"><label>ACTUAL HOLD (MONTHS)</label><input id="do_hold" type="number" class="cinput" value="${existing?.actual_hold_months??''}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>ACTUAL SALE PRICE</label><input id="do_sale" type="number" class="cinput" value="${existing?.actual_sale_price??''}" oninput="calcOutcomeProfit()"/></div>`;
  h+=`<div class="fld"><label>ACTUAL PROFIT</label><input id="do_profit" type="number" class="cinput" value="${existing?.actual_profit??''}" style="color:#22c55e"/></div></div>`;
  h+=`<div class="fld"><label>LESSONS LEARNED / NOTES</label><textarea id="do_notes" rows="3" class="cinput" style="font-size:13px;min-height:60px">${esc(existing?.notes||'')}</textarea></div>`;
  h+=`<button onclick="saveDealOutcome('${dealId}','${existing?.id||''}')" class="btn" style="width:100%;padding:12px;font-size:13px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-weight:800;margin-top:8px">${existing?'Update Outcomes':'Save Outcomes'}</button>`;

  if(existing){
    h+=`<div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">`;
    h+=`<div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:1px;margin-bottom:8px">SAVED OUTCOMES</div>`;
    h+=`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">`;
    h+=`<div><div style="font-size:9px;color:#64748b;font-weight:700">RENO COST</div><div style="font-size:14px;font-weight:800;color:#f59e0b">${existing.actual_reno_cost!=null?$(existing.actual_reno_cost):'—'}</div></div>`;
    h+=`<div><div style="font-size:9px;color:#64748b;font-weight:700">HOLD MONTHS</div><div style="font-size:14px;font-weight:800;color:#94a3b8">${existing.actual_hold_months||'—'}</div></div>`;
    h+=`<div><div style="font-size:9px;color:#64748b;font-weight:700">SALE PRICE</div><div style="font-size:14px;font-weight:800;color:#e2e8f0">${existing.actual_sale_price!=null?$(existing.actual_sale_price):'—'}</div></div>`;
    h+=`<div><div style="font-size:9px;color:#64748b;font-weight:700">ACTUAL PROFIT</div><div style="font-size:14px;font-weight:800;color:${(existing.actual_profit||0)>=0?'#22c55e':'#ef4444'}">${existing.actual_profit!=null?$(existing.actual_profit):'—'}</div></div>`;
    h+=`</div>`;
    if(existing.notes)h+=`<div style="margin-top:8px;font-size:11px;color:#94a3b8;line-height:1.5">${esc(existing.notes)}</div>`;
    h+=`</div>`;
  }

  h+=`</div>`;
  el.innerHTML=h;
}

function calcOutcomeProfit(){
  const sale=Number(document.getElementById("do_sale")?.value)||0;
  const reno=Number(document.getElementById("do_reno")?.value)||0;
  const d=currentDeal;
  const purchase=d?(d.accepted_price||d.offer_price||0):0;
  if(sale>0)document.getElementById("do_profit").value=sale-purchase-reno;
}

async function saveDealOutcome(dealId,existingId){
  const payload={
    deal_id:dealId,
    actual_reno_cost:Number(document.getElementById("do_reno")?.value)||null,
    actual_hold_months:Number(document.getElementById("do_hold")?.value)||null,
    actual_sale_price:Number(document.getElementById("do_sale")?.value)||null,
    actual_profit:Number(document.getElementById("do_profit")?.value)||null,
    notes:document.getElementById("do_notes")?.value?.trim()||null
  };
  try{
    if(existingId){
      await fetch(`${SB}/rest/v1/deal_outcomes?id=eq.${existingId}`,{method:'PATCH',headers:HD,body:JSON.stringify(payload)});
    }else{
      await fetch(`${SB}/rest/v1/deal_outcomes`,{method:'POST',headers:HD,body:JSON.stringify(payload)});
    }
    loadDealOutcomes(dealId);
    const toast=document.createElement('div');
    toast.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;background:#10b981;color:#0a0a0a;font-size:12px;font-weight:800;z-index:9999';
    toast.textContent='Outcomes saved';
    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(),2000);
  }catch(e){console.error("Save outcome failed:",e);alert("Failed to save outcomes.");}
}
