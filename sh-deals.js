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

// ═══════════════════════════════════════════
// ═══ SMART STATUS BRAIN ═══
// ═══════════════════════════════════════════

function fmt(n){
  if(n==null||isNaN(n))return'0';
  return Math.round(Number(n)).toLocaleString();
}

async function getNextAction(dealId){
  const deal=deals.find(d=>d.id===dealId);
  if(!deal)return null;

  // Fetch all deal data in parallel
  const [finArr, sowLines, bids, expenses, draws, calcArr] = await Promise.all([
    fetch(SB+'/rest/v1/deal_financing?deal_id=eq.'+dealId+'&select=*',{headers:HD}).then(r=>r.json()).catch(()=>[]),
    fetch(SB+'/rest/v1/renovation_sow_lines?deal_id=eq.'+dealId+'&select=*',{headers:HD}).then(r=>r.json()).catch(()=>[]),
    fetch(SB+'/rest/v1/contractor_bids?deal_id=eq.'+dealId+'&select=*',{headers:HD}).then(r=>r.json()).catch(()=>[]),
    fetch(SB+'/rest/v1/renovation_expenses?deal_id=eq.'+dealId+'&select=*',{headers:HD}).then(r=>r.json()).catch(()=>[]),
    fetch(SB+'/rest/v1/renovation_draws?deal_id=eq.'+dealId+'&select=*',{headers:HD}).then(r=>r.json()).catch(()=>[]),
    deal.property_id?fetch(SB+'/rest/v1/calc_history?property_id=eq.'+deal.property_id+'&order=created_at.desc&limit=1',{headers:HD}).then(r=>r.json()).catch(()=>[]):Promise.resolve([])
  ]);

  const financing=finArr.length>0?finArr[0]:null;
  const calcHistory=calcArr.length>0?calcArr[0]:null;

  // Calculate helper values
  const totalBudget=deal.contracted_reno_amount||sowLines.reduce((s,l)=>s+(l.planned_budget||0),0)||0;
  const totalSpent=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const totalReimbursed=draws.filter(d=>d.status==='disbursed').reduce((s,d)=>s+(d.amount_received||0),0);
  const awardedBid=bids.find(b=>b.status==='accepted');
  const hasInProgressSOW=sowLines.some(l=>l.status==='in_progress');
  const allSOWComplete=sowLines.length>0&&sowLines.every(l=>l.status==='complete');
  const hasRatings=bids.some(b=>b.rating_quality||b.rating_bid_accuracy||b.rating_timeline||b.rating_communication);

  const monthsElapsed=financing&&financing.funded_date
    ?(Date.now()-new Date(financing.funded_date+'T00:00:00').getTime())/(30.44*24*60*60*1000)
    :0;

  const status=deal.status;

  // ═══ PHASE B: OFFER & NEGOTIATION ═══

  if(status==='offer_drafted')
    return{message:"Offer drafted at $"+fmt(deal.offer_price)+". Sign and submit.",action:"Generate RPA",icon:"📝",openModal:"rpa"};

  if(status==='offer_submitted')
    return{message:"Offer submitted. Waiting for response.",action:null,icon:"⏳"};

  if(status==='counter_received')
    return{message:"Counter from seller at $"+fmt(deal.offer_price),action:"Respond or Accept",icon:"↩️"};

  if(status==='counter_sent')
    return{message:"Counter sent. Waiting for seller response.",action:null,icon:"↪️"};

  if(status==='accepted')
    return{message:"Offer accepted!",action:"Confirm Under Contract",icon:"🤝",advanceTo:"under_contract"};

  // ═══ PHASE C: DUE DILIGENCE ═══

  if(status==='under_contract')
    return{message:"Under contract. Schedule inspection.",action:"Move to Inspection",icon:"📋",advanceTo:"inspection"};

  if(status==='inspection')
    return{message:"Inspection phase. Complete due diligence.",action:"Inspection Complete",icon:"🔍",advanceTo:"financing"};

  // ═══ PHASE D: FINANCING ═══

  if(status==='financing'&&(!financing||!financing.interest_rate))
    return{message:"Fill in loan terms from your lender.",action:"Open Financing",icon:"🏦",openModal:"financing"};

  if(status==='financing'&&financing&&financing.interest_rate)
    return{message:"Loan terms saved. Waiting for clear to close.",action:"Move to Closing",icon:"🏦",advanceTo:"closing",cascade:"Financing will advance to Clear to Close."};

  // ═══ PHASE E: CLOSING ═══

  if(status==='closing')
    return{message:"Clear to close.",action:"Confirm Keys In Hand",icon:"🏁",advanceTo:"closed",cascade:"Loan marked funded. Hold period starts."};

  // ═══ PHASE F: PRE-RENOVATION PREP (closed) ═══

  if(status==='closed'){
    if(sowLines.length===0)
      return{message:"Keys in hand! Upload your lender SOW.",action:"Upload SOW",icon:"🔑",navigateTo:"reno-budget",context:financing?"Hold period started. "+monthsElapsed.toFixed(1)+" months elapsed.":null};

    if(sowLines.length>0&&bids.length===0)
      return{message:sowLines.length+" SOW lines loaded ($"+fmt(sowLines.reduce((s,l)=>s+(l.lender_approved||0),0))+" approved). Get contractor bids.",action:"Upload Bid",icon:"📄",navigateTo:"contacts-bids",context:"Lender SOW ready. Need bids to compare."};

    if(bids.length>0&&!awardedBid)
      return{message:bids.length+" bid"+(bids.length>1?"s":"")+" received. Compare and award.",action:bids.length>1?"Compare Bids":"Review Bid",icon:"⚖️",navigateTo:"contacts-bids",context:"Bids: "+bids.map(b=>b.initial_bid?"$"+fmt(b.initial_bid):"pending").join(" vs ")};

    if(awardedBid&&!hasInProgressSOW)
      return{message:"Contractor awarded at $"+fmt(deal.contracted_reno_amount)+". Ready to start demo?",action:"Start Renovation",icon:"🔨",advanceTo:"in_renovation",cascade:"Financing advances to Active. Renovation phase begins."};

    if(hasInProgressSOW)
      return{message:"Work has started. Confirm renovation phase.",action:"Start Renovation",icon:"🔨",advanceTo:"in_renovation",cascade:"Financing advances to Active."};
  }

  // ═══ PHASE G: IN RENOVATION ═══

  if(status==='in_renovation'){
    if(allSOWComplete)
      return{message:"All scope items complete!",action:"Confirm Reno Complete",icon:"✅",advanceTo:"renovation_complete",cascade:"You can rate your contractor and log final costs."};

    if(draws.length===0&&totalSpent>5000)
      return{message:"$"+fmt(totalSpent)+" spent, no draws submitted. Submit your first draw for reimbursement.",action:"Create Draw",icon:"💰",navigateTo:"reno-draws",context:"$"+fmt(totalSpent)+" unreimbursed exposure on LOC."};

    if(totalBudget>0&&totalSpent/totalBudget>0.85)
      return{message:"⚠️ "+(totalSpent/totalBudget*100).toFixed(0)+"% of budget spent. $"+fmt(totalBudget-totalSpent)+" remaining.",action:null,icon:"⚠️",context:monthsElapsed.toFixed(1)+" months elapsed. "+(totalBudget>0?fmt(totalSpent/totalBudget*100)+"% budget consumed.":"")};

    if(monthsElapsed>6)
      return{message:"⚠️ "+monthsElapsed.toFixed(1)+" months elapsed. "+(8-monthsElapsed).toFixed(1)+" months until maturity.",action:null,icon:"⏰",context:fmt(totalSpent/totalBudget*100)+"% budget spent. "+draws.length+" draws submitted."};

    const activeLines=sowLines.filter(l=>l.status==='in_progress').length;
    const completeLines=sowLines.filter(l=>l.status==='complete').length;
    return{message:activeLines+" items in progress, "+completeLines+" of "+sowLines.length+" complete.",action:null,icon:"🔨",context:"$"+fmt(totalSpent)+" spent of $"+fmt(totalBudget)+" ("+(totalBudget>0?(totalSpent/totalBudget*100).toFixed(0):0)+"%). "+draws.length+"/11 draws used."};
  }

  // ═══ PHASE H: RENOVATION COMPLETE ═══

  if(status==='renovation_complete'){
    if(awardedBid&&!hasRatings)
      return{message:"Renovation done! Rate your contractor.",action:"Rate Contractor",icon:"⭐",navigateTo:"contacts-bids"};
    return{message:"Renovation complete. Ready to list?",action:"Start Listing Prep",icon:"📸",advanceTo:"listing_prep"};
  }

  // ═══ PHASE I: LISTING PREP ═══

  if(status==='listing_prep')
    return{message:"Staging, photos, listing copy in progress.",action:"Go Live on MLS",icon:"📸",advanceTo:"listed"};

  // ═══ PHASE J: LISTED ═══

  if(status==='listed')
    return{message:"On market. Tracking showings and offers.",action:null,icon:"🏷️",context:monthsElapsed.toFixed(1)+" months total hold. Interest still accruing."};

  // ═══ PHASE K: SOLD ═══

  if(status==='sold'){
    let pmStatus='pending';
    try{const oRes=await fetch(SB+'/rest/v1/deal_outcomes?deal_id=eq.'+dealId+'&select=postmortem_status',{headers:HD});const oData=await oRes.json();if(oData&&oData.length>0)pmStatus=oData[0].postmortem_status||'pending';}catch(e){}
    if(pmStatus==='complete')return{message:"Postmortem complete ✓",action:null,icon:"🏆"};
    if(pmStatus==='insights_captured')return{message:"Review and mark postmortem complete.",action:"Complete Postmortem",icon:"🏆",navigateTo:"deal-outcomes"};
    if(pmStatus==='actuals_entered')return{message:"Add lessons learned to complete the postmortem.",action:"Add Insights",icon:"🏆",navigateTo:"deal-outcomes"};
    return{message:"Log your sale results to start the postmortem.",action:"Deal Outcomes",icon:"🏆",navigateTo:"deal-outcomes"};
  }

  // ═══ DEAD DEALS ═══

  if(['rejected','withdrawn','expired','dead'].includes(status))
    return{message:"Deal "+status+".",action:null,icon:"❌"};

  // Fallback
  return{message:"Status: "+status,action:null,icon:"📋"};
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
          ${d.coe_date?`<span style="font-size:9px;color:#94a3b8;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:2px 8px;border-radius:6px;font-weight:600">COE ${new Date(d.coe_date+"T00:00:00").toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'})}</span>`:''}
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
          ${d.coe_date?`<span style="font-size:9px;color:#94a3b8">COE ${new Date(d.coe_date+"T00:00:00").toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'})}</span>`:''}
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
  const stageObj=DEAL_STAGES[d.status]||{label:d.status||'Unknown',color:'#64748b',icon:'📋'};

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
      <div style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700">CONTRACT</div><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px">${d.contract_date?new Date(d.contract_date+"T00:00:00").toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):'-'}</div></div>
      <div style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:7px;color:#64748b;font-weight:700">COE DATE</div><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px">${d.coe_date?new Date(d.coe_date+"T00:00:00").toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}):'-'}</div></div>
    </div>

    <!-- STATUS BADGE -->
    <div id="deal-status-badge" style="display:flex;align-items:center;gap:8px;margin-bottom:${isDead?'8':'16'}px;">
      <span style="font-size:20px;">${stageObj.icon}</span>
      <span style="font-size:15px;font-weight:700;color:${stageObj.color};letter-spacing:0.5px;">${stageObj.label.toUpperCase()}</span>
    </div>
    ${isDead&&d.kill_reason?`<div style="font-size:12px;color:#94a3b8;margin-bottom:16px;padding:10px 14px;border-radius:10px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.1)">${esc(d.kill_reason)}</div>`:''}

    <!-- SMART ACTION CARD -->
    <div id="smart-action-card"></div>

    <!-- ORIGINAL UNDERWRITING -->
    <div id="original-underwriting"></div>

    <!-- FINANCING SUMMARY -->
    <div id="dealFinSummary"></div>

    <!-- SECONDARY ACTIONS -->
    ${['offer_drafted','offer_submitted','counter_received','counter_sent','accepted'].includes(d.status)?`<button onclick="openRPAFromDeal('${d.id}')" class="btn" style="width:100%;margin-bottom:8px;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(224,201,127,0.15),rgba(212,175,55,0.08));border:1px solid rgba(224,201,127,0.3);color:#e0c97f;font-weight:800">📄 Generate GLVAR RPA</button>
    ${d.rpa_generated_at?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:16px;border-radius:10px;background:rgba(224,201,127,0.04);border:1px solid rgba(224,201,127,0.12)">
      <div style="font-size:10px;color:#e0c97f">
        <span style="font-weight:700">RPA v${d.rpa_version||1}</span> · sent ${new Date(d.rpa_generated_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"})}${d.rpa_generated_by_email?' by '+esc(d.rpa_generated_by_email.split('@')[0]):''}
        ${d.rpa_url?` · <a href="${esc(d.rpa_url)}" target="_blank" style="color:#60a5fa;text-decoration:underline">View PDF</a>`:''}
      </div>
      <button onclick="deleteRPA('${d.id}')" style="background:none;border:none;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer;padding:4px 8px;white-space:nowrap">Delete RPA</button>
    </div>`:`<div style="margin-bottom:16px"></div>`}`:''}

    <!-- LOG COUNTER OFFER -->
    ${['offer_submitted','counter_received','counter_sent'].includes(d.status)?`<div style="margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(249,115,22,0.03);border:1px solid rgba(249,115,22,0.12)">
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
        <div class="fld"><label>COE DATE</label><input id="co_coedate" type="date" class="cinput" value="${d.coe_date||''}" onchange="saveDealField('${d.id}','coe_date',this.value)"/></div>
      </div>
      <div class="fld"><label>KEY TERMS / NOTES</label><textarea id="co_terms" rows="2" class="cinput" style="font-size:13px;min-height:60px" placeholder="As-is, informational inspections only, pool heater ack..."></textarea></div>
      <button onclick="logCounter('${d.id}')" class="btn" style="width:100%;margin-top:8px;padding:12px;font-size:13px;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.3);color:#f97316;font-weight:800">↩️ Log Counter Offer</button>
    </div>`:''}

    ${['offer_drafted','offer_submitted','counter_received','counter_sent','accepted'].includes(d.status)?`<!-- CONCESSIONS -->
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
    </div>`:''}

    ${['financing','closing','clear_to_close','closed','in_renovation','renovation_complete','listing_prep','listed','sold'].includes(d.status)?`
    <details style="margin-bottom:16px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:rgba(255,255,255,0.02)">
      <summary style="padding:12px 14px;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:1.5px;color:#d4af37;list-style:none;display:flex;justify-content:space-between;align-items:center">
        <span>DEAL TERMS</span>
        <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0">${$(d.accepted_price||d.offer_price)} · ${d.accepted_commission_pct!=null?d.accepted_commission_pct:d.lisa_buy_commission_pct||0}% · COE ${d.coe_date?new Date(d.coe_date+'T00:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'}):'—'}</span>
      </summary>
      <div style="padding:0 14px 14px">
        <div class="row2">
          <div class="fld"><label>CONTRACT DATE</label><input id="deal_contractdate" type="date" class="cinput" value="${d.contract_date||''}" onchange="saveDealField('${d.id}','contract_date',this.value)"/></div>
          <div class="fld"><label>COE DATE</label><input id="deal_coedate" type="date" class="cinput" value="${d.coe_date||''}" onchange="saveDealField('${d.id}','coe_date',this.value)"/></div>
        </div>
        <div class="row2">
          <div class="fld"><label>ACCEPTED PRICE</label><input id="deal_acceptedprice" type="number" class="cinput" value="${d.accepted_price||''}" onchange="saveDealField('${d.id}','accepted_price',Number(this.value))"/></div>
          <div class="fld"><label>ACCEPTED COMMISSION %</label><input id="deal_acceptedcomm" type="number" step="0.5" class="cinput" value="${d.accepted_commission_pct!=null?d.accepted_commission_pct:''}" onchange="saveDealField('${d.id}','accepted_commission_pct',Number(this.value))"/></div>
        </div>
        ${conc.length?`<div style="margin-top:8px"><div style="font-size:9px;color:#8b5cf6;font-weight:700;letter-spacing:1px;margin-bottom:4px">CONCESSIONS (${conc.length})</div>${conc.map(c=>'<div style="font-size:11px;color:#94a3b8;padding:2px 0">'+esc(c.item)+' ('+c.party+')</div>').join('')}</div>`:''}
      </div>
    </details>
    `:`
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
    </div>`}

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

    <!-- MANUAL OVERRIDE -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.04);">
      <details>
        <summary style="font-size:12px;color:rgba(255,255,255,0.25);cursor:pointer;user-select:none;">Override status (advanced)</summary>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
          ${Object.entries(DEAL_STAGES).map(([key,stage])=>`<button onclick="confirmSmartAdvance('${d.id}','${key}','')" style="padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:${d.status===key?stage.color+'20':'transparent'};color:${d.status===key?stage.color:'rgba(255,255,255,0.3)'};cursor:pointer;">${stage.icon} ${stage.label}</button>`).join('')}
        </div>
      </details>
    </div>

    <!-- DELETE DEAL -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(239,68,68,0.12)">
      <button onclick="deleteDeal('${d.id}')" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#ef4444;font-size:12px;font-weight:700;cursor:pointer">Delete Deal</button>
    </div>

  </div>`;

  m.style.display="block";document.body.style.overflow="hidden";

  // Load smart action card
  renderSmartCard(d.id);

  // Load original underwriting
  renderOriginalUnderwriting(d.id,d.property_id);

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

// ═══════════════════════════════════════════
// ═══ SMART ACTION CARD + HANDLERS ═══
// ═══════════════════════════════════════════

async function renderSmartCard(dealId){
  const card=document.getElementById('smart-action-card');
  if(!card)return;

  card.innerHTML='<div style="padding:16px;color:rgba(255,255,255,0.3);font-size:13px;">Loading...</div>';

  const action=await getNextAction(dealId);
  if(!action){card.innerHTML='';return;}

  let actionBtn='';
  if(action.action){
    let onclickCode='';
    if(action.advanceTo){
      onclickCode=`confirmSmartAdvance('${dealId}','${action.advanceTo}',\`${(action.cascade||'').replace(/`/g,'\\`')}\`)`;
    }else if(action.openModal){
      onclickCode=`openSmartModal('${dealId}','${action.openModal}')`;
    }else if(action.navigateTo){
      onclickCode=`navigateSmartAction('${action.navigateTo}')`;
    }

    actionBtn=`<button onclick="${onclickCode}" style="margin-top:12px;padding:12px 24px;background:linear-gradient(135deg,#d4af37,#b8960c);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;width:100%;text-align:center;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 15px rgba(212,175,55,0.3)'" onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none'">${action.action}</button>`;
  }

  let contextLine='';
  if(action.context){
    contextLine=`<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:8px;">${action.context}</div>`;
  }

  card.innerHTML=`
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:16px;">
      <div>
        <div style="font-size:16px;font-weight:600;color:#fff;line-height:1.3;">${action.message}</div>
        ${contextLine}
        ${actionBtn}
      </div>
    </div>
  `;
}

async function confirmSmartAdvance(dealId,newStatus,cascadeMsg){
  const stObj=DEAL_STAGES[newStatus]||{label:newStatus};

  // Check for missing financing when advancing to closing or closed
  let finWarning='';
  if(newStatus==='closing'||newStatus==='closed'){
    try{
      const fRes=await fetch(SB+'/rest/v1/deal_financing?deal_id=eq.'+dealId+'&select=id,interest_rate',{headers:HD});
      const fData=await fRes.json();
      if(!fData||!fData.length||!fData[0].interest_rate){
        finWarning='<div style="font-size:13px;color:#eab308;margin-bottom:16px;">⚠️ Loan terms not saved yet. Hold period bar and burn calculations won\'t work without financing data.</div>';
      }
    }catch(e){}
  }

  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML=`
    <div style="background:#1a1a2e;border:1px solid #d4af37;border-radius:14px;padding:24px;max-width:400px;width:100%;text-align:center;">
      <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:8px;">Move to ${stObj.label}?</div>
      ${cascadeMsg?'<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:16px;">'+cascadeMsg+'</div>':''}
      ${finWarning}
      <div style="display:flex;gap:12px;">
        <button id="smart-cancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Not Yet</button>
        <button id="smart-confirm" style="flex:1;padding:12px;background:linear-gradient(135deg,#d4af37,#b8960c);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('smart-cancel').onclick=()=>overlay.remove();
  document.getElementById('smart-confirm').onclick=async()=>{
    overlay.remove();
    await updateDealStatus(dealId,newStatus);
    openDeal(dealId);
  };
}

function openSmartModal(dealId,modalName){
  if(modalName==='financing'){
    if(typeof openFinancing==='function')openFinancing(dealId);
    else console.warn('No financing modal function found');
  }else if(modalName==='rpa'){
    if(typeof openRPAFromDeal==='function')openRPAFromDeal(dealId);
    else if(typeof openOfferBuilder==='function')openOfferBuilder(dealId);
    else console.warn('No RPA function found');
  }else if(modalName==='sowUpload'){
    navigateSmartAction('reno-budget');
  }
}

function navigateSmartAction(target){
  const parts=target.split('-');

  if(parts[0]==='reno'){
    // Close deal modal first so reno view is visible
    closeDeal();
    if(typeof setView==='function')setView('renovation');
    if(parts[1]){
      setTimeout(()=>{
        const pill=document.querySelector('[data-view="'+parts[1]+'"]');
        if(pill)pill.click();
      },200);
    }
  }else if(parts[0]==='contacts'){
    closeDeal();
    if(typeof setView==='function')setView('contacts');
    if(parts[1]){
      setTimeout(()=>{
        const pill=document.querySelector('[data-view="'+parts[1]+'"]');
        if(pill)pill.click();
      },200);
    }
  }else if(target==='deal-outcomes'){
    const outcomesSection=document.getElementById('dealOutcomesArea');
    if(outcomesSection)outcomesSection.scrollIntoView({behavior:'smooth'});
  }
}

// ═══════════════════════════════════════════
// ═══ ORIGINAL UNDERWRITING ═══
// ═══════════════════════════════════════════

async function renderOriginalUnderwriting(dealId,propertyId){
  const container=document.getElementById('original-underwriting');
  if(!container)return;

  let data=null;
  let source='';

  // Try Layer 2 first: calc_history (manual calculator tweaks)
  if(propertyId){
    try{
      const cRes=await fetch(SB+'/rest/v1/calc_history?property_id=eq.'+propertyId+'&order=created_at.desc&limit=1',{headers:HD});
      const cData=await cRes.json();
      if(cData&&cData.length>0){data=cData[0];source='calculator';}
    }catch(e){}
  }

  // Fallback to Layer 1: underwriting_analyses (auto-screener)
  if(!data&&propertyId){
    try{
      const uRes=await fetch(SB+'/rest/v1/underwriting_analyses?property_id=eq.'+propertyId+'&order=created_at.desc&limit=1',{headers:HD});
      const uData=await uRes.json();
      if(uData&&uData.length>0){data=uData[0];source='screener';}
    }catch(e){}
  }

  if(!data){container.innerHTML='';return;}

  const deal=deals.find(d=>d.id===dealId);
  const actualOffer=deal?deal.offer_price:null;

  // Extract values — correct calc_history column names
  const purchasePrice=data.purchase_price||null;
  const arvTarget=data.arv||null;
  const renoBudget=data.rehab_budget||null;
  const profitTarget=data.net_profit||null;
  const roiTarget=data.roi||null;
  const lisaPct=data.lisa_buy_pct||data.lisa_commission_pct||2.5;
  const holdMonths=data.hold_months||8;
  const maxOffer=data.max_offer||null;
  const totalCost=data.total_cost||null;
  const holdCost=data.hold_cost||null;
  const loanAmount=data.loan_amount||null;
  const interestRate=data.interest_rate||null;
  const savedDate=data.created_at?new Date(data.created_at).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'}):'';

  const f=(n)=>n!=null?'$'+Math.round(Number(n)).toLocaleString():'—';
  const pct=(n)=>n!=null?Number(n).toFixed(1)+'%':'—';

  const sourceLabel=source==='calculator'
    ?'Calculator · '+savedDate
    :'AI Screener · '+savedDate;

  const editOnclick="event.preventDefault();event.stopPropagation();openCalcForDeal('"+dealId+"')";

  let rows='';

  if(purchasePrice)rows+=`<div class="uw-row"><span class="uw-label">Purchase (modeled)</span><span class="uw-value">${f(purchasePrice)}</span></div>`;

  if(actualOffer&&purchasePrice&&Math.round(actualOffer)!==Math.round(purchasePrice))
    rows+=`<div class="uw-row"><span class="uw-label">Actual Offer</span><span class="uw-value" style="color:#d4af37;">${f(actualOffer)}</span></div>`;

  if(arvTarget)rows+=`<div class="uw-row"><span class="uw-label">ARV</span><span class="uw-value">${f(arvTarget)}</span></div>`;

  if(renoBudget)rows+=`<div class="uw-row"><span class="uw-label">Reno Budget (est)</span><span class="uw-value">${f(renoBudget)}</span></div>`;

  if(deal&&deal.contracted_reno_amount)
    rows+=`<div class="uw-row"><span class="uw-label">Contracted Reno</span><span class="uw-value" style="color:#d4af37;">${f(deal.contracted_reno_amount)}</span></div>`;

  if(loanAmount)rows+=`<div class="uw-row"><span class="uw-label">Loan Amount</span><span class="uw-value">${f(loanAmount)}</span></div>`;

  if(interestRate)rows+=`<div class="uw-row"><span class="uw-label">Interest Rate</span><span class="uw-value">${pct(interestRate)}</span></div>`;

  if(holdCost)rows+=`<div class="uw-row"><span class="uw-label">Hold Cost</span><span class="uw-value">${f(holdCost)}</span></div>`;

  rows+=`<div class="uw-row"><span class="uw-label">Lisa Commission</span><span class="uw-value">${pct(lisaPct)}</span></div>`;
  rows+=`<div class="uw-row"><span class="uw-label">Hold Period</span><span class="uw-value">${holdMonths} months</span></div>`;

  if(totalCost)rows+=`<div class="uw-row"><span class="uw-label">Total Project Cost</span><span class="uw-value">${f(totalCost)}</span></div>`;

  if(profitTarget)rows+=`<div class="uw-row"><span class="uw-label">Net Profit</span><span class="uw-value" style="color:#4ade80;">${f(profitTarget)}</span></div>`;

  if(roiTarget)rows+=`<div class="uw-row"><span class="uw-label">ROI</span><span class="uw-value">${pct(roiTarget)}</span></div>`;

  if(maxOffer)rows+=`<div class="uw-row"><span class="uw-label">Max Offer</span><span class="uw-value">${f(maxOffer)}</span></div>`;

  container.innerHTML=`
    <details class="uw-section" style="margin-bottom:16px;">
      <summary style="cursor:pointer;user-select:none;font-size:13px;font-weight:600;color:#d4af37;letter-spacing:1px;padding:12px 0;display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;">▶</span> ORIGINAL UNDERWRITING
        <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,0.3);margin-left:auto;">${sourceLabel}</span>
        <a onclick="${editOnclick}" style="font-size:11px;color:rgba(255,255,255,0.3);margin-left:8px;cursor:pointer;text-decoration:none;">Edit in Calculator</a>
      </summary>
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-top:4px;">
        ${rows}
      </div>
    </details>
  `;
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

    // ═══════════════════════════════════════════
    // SMART STATUS CASCADES
    // ═══════════════════════════════════════════
    const cascadeMessages=[];

    // CASCADE 1: Financing auto-advance
    const finCascadeMap={
      'closing':'clear_to_close',
      'closed':'funded',
      'in_renovation':'active',
      'sold':'paid_off'
    };

    if(finCascadeMap[newStatus]){
      try{
        const finRes=await fetch(SB+'/rest/v1/deal_financing?deal_id=eq.'+dealId+'&select=id,status,funded_date,loan_term_months',{headers:HD});
        const finData=await finRes.json();

        if(finData&&finData.length>0){
          const fin=finData[0];
          const finPatch={status:finCascadeMap[newStatus]};

          // On "closed" → set funded_date and maturity_date
          if(newStatus==='closed'&&!fin.funded_date){
            const today=new Date().toISOString().split('T')[0];
            finPatch.funded_date=today;
            const termMonths=fin.loan_term_months||8;
            const maturity=new Date();
            maturity.setMonth(maturity.getMonth()+termMonths);
            finPatch.maturity_date=maturity.toISOString().split('T')[0];
            cascadeMessages.push('Loan funded '+today+'. Maturity: '+finPatch.maturity_date);
          }

          await fetch(SB+'/rest/v1/deal_financing?id=eq.'+fin.id,{
            method:'PATCH',headers:HD,
            body:JSON.stringify(finPatch)
          });

          const label=finCascadeMap[newStatus].replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
          cascadeMessages.push('Financing → '+label);
        }
      }catch(e){console.error('Financing cascade error:',e);}
    }

    // CASCADE 2: Property disposition auto-update
    try{
      const dealData=deals.find(x=>x.id===dealId);
      if(dealData&&dealData.property_id){
        if(newStatus==='sold'){
          await fetch(SB+'/rest/v1/properties?id=eq.'+dealData.property_id,{
            method:'PATCH',headers:HD,
            body:JSON.stringify({disposition:'acquired'})
          });
          cascadeMessages.push('Property → Acquired');
        }else if(['rejected','withdrawn','expired','dead'].includes(newStatus)){
          await fetch(SB+'/rest/v1/properties?id=eq.'+dealData.property_id,{
            method:'PATCH',headers:HD,
            body:JSON.stringify({disposition:null})
          });
          cascadeMessages.push('Property returned to feed');
        }else{
          // Any active deal status → pursuing
          await fetch(SB+'/rest/v1/properties?id=eq.'+dealData.property_id,{
            method:'PATCH',headers:HD,
            body:JSON.stringify({disposition:'pursuing'})
          });
        }
      }
    }catch(e){console.error('Disposition cascade error:',e);}

    // CASCADE 3: Toast notification
    const stageLabel=DEAL_STAGES[newStatus]?DEAL_STAGES[newStatus].label:newStatus;
    const toastLines=[stageLabel];
    if(cascadeMessages.length>0)toastLines.push(cascadeMessages.join(' · '));

    const toastEl=document.createElement('div');
    toastEl.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a2e;border:1px solid #d4af37;color:#fff;padding:14px 24px;border-radius:10px;z-index:99999;font-size:14px;max-width:90vw;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    toastEl.innerHTML=toastLines.map((l,i)=>i===0?'<div style="font-weight:700;font-size:16px;">'+l+'</div>':'<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">'+l+'</div>').join('');
    document.body.appendChild(toastEl);
    setTimeout(()=>toastEl.remove(),4000);

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
    if(!f||!f.interest_rate){el.innerHTML='';return;}
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

// ═══ DEAL OUTCOMES & POSTMORTEM ═══
async function loadDealOutcomes(dealId){
  const el=document.getElementById("dealOutcomesArea");if(!el)return;
  const _d=deals.find(d=>d.id===dealId);
  if(_d&&_d.status==='sold')return loadPostmortemUI(dealId,el);
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

// ═══════════════════════════════════════════
// ═══ POSTMORTEM COMPARISON ENGINE ═══
// ═══════════════════════════════════════════

async function populatePostmortem(dealId){
  console.log("[Postmortem] Starting for deal:",dealId);

  // 1. Check/create deal_outcomes row
  let outcome=null;
  try{
    const res=await sb("deal_outcomes?deal_id=eq."+dealId);
    if(Array.isArray(res)&&res.length)outcome=res[0];
  }catch(e){console.error("[Postmortem] Fetch outcome failed:",e);}

  if(!outcome){
    try{
      const resp=await fetch(SB+"/rest/v1/deal_outcomes",{method:"POST",headers:{...HD,Prefer:"return=representation"},body:JSON.stringify({deal_id:dealId,postmortem_status:"pending"})});
      const arr=await resp.json();
      outcome=Array.isArray(arr)?arr[0]:arr;
      console.log("[Postmortem] Created deal_outcomes row:",outcome?.id);
    }catch(e){console.error("[Postmortem] Create outcome failed:",e);return null;}
  }
  if(!outcome||!outcome.id){console.error("[Postmortem] No outcome row");return null;}

  // 2. Get deal from memory or fetch
  const deal=deals.find(d=>d.id===dealId);
  if(!deal){console.error("[Postmortem] Deal not found in local state");return null;}

  // 3. Fetch all data sources in parallel
  const[calcArr,finArr,expArr]=await Promise.all([
    deal.property_id
      ?fetch(SB+"/rest/v1/calc_history?property_id=eq."+deal.property_id+"&order=created_at.desc&limit=1",{headers:HD}).then(r=>r.json()).catch(()=>[])
      :Promise.resolve([]),
    fetch(SB+"/rest/v1/deal_financing?deal_id=eq."+dealId,{headers:HD}).then(r=>r.json()).catch(()=>[]),
    fetch(SB+"/rest/v1/renovation_expenses?deal_id=eq."+dealId+"&select=amount",{headers:HD}).then(r=>r.json()).catch(()=>[])
  ]);

  const calc=Array.isArray(calcArr)&&calcArr.length?calcArr[0]:null;
  const fin=Array.isArray(finArr)&&finArr.length?finArr[0]:null;
  const expenses=Array.isArray(expArr)?expArr:[];

  console.log("[Postmortem] Data loaded — calc:",!!calc,"fin:",!!fin,"expenses:",expenses.length);

  // 4. Build projected snapshot from calc_history
  const patch={};
  if(calc){
    patch.projected_purchase_price=calc.purchase_price||null;
    patch.projected_reno_budget=calc.rehab_budget||null;
    patch.projected_arv=calc.arv||null;
    patch.projected_hold_months=calc.hold_months||null;
    patch.projected_holding_costs=calc.hold_cost||null;
    patch.projected_total_cost=calc.total_cost||null;
    patch.projected_profit=calc.net_profit||null;
    patch.projected_roi=calc.roi||null;
    patch.projected_max_offer=calc.max_offer||null;
    patch.projected_interest_rate=calc.interest_rate||null;
    patch.projected_lisa_commission_pct=calc.lisa_commission_pct||null;
    patch.calc_history_id=calc.id||null;
  }

  // 5. Compute actuals
  const purchasePrice=deal.accepted_price||deal.purchase_price||deal.offer_price||0;
  const actualRenoCost=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const salePrice=outcome.actual_sale_price||null;
  const saleDate=outcome.actual_sale_date||null;

  // Financing values
  const fundedDate=fin?.funded_date||null;
  const loanPrincipal=fin?.funded_principal||fin?.loan_principal||0;
  const interestRate=fin?.interest_rate||calc?.interest_rate||0;
  let monthlyInterest=fin?.monthly_payment||0;
  if(!monthlyInterest&&loanPrincipal&&interestRate){
    monthlyInterest=Math.round(loanPrincipal*(interestRate/100)/12);
  }
  const hoaMonthly=calc?.hoa_monthly||0;
  const taxAnnual=calc?.tax_annual||0;
  const utilitiesMonthly=650;

  // Actual hold months: funded_date → actual_sale_date
  let actualHoldMonths=null;
  if(fundedDate&&saleDate){
    const fd=new Date(fundedDate+"T00:00:00");
    const sd=new Date(saleDate+"T00:00:00");
    actualHoldMonths=Math.round((sd-fd)/(30.44*24*60*60*1000)*10)/10;
  }

  // Actual holding costs (only if we can compute hold period)
  let actualHoldingCosts=null;
  const holdMo=actualHoldMonths||(salePrice?null:null);
  if(holdMo!=null){
    const insuranceCost=(purchasePrice+actualRenoCost)*0.0035*(holdMo/12);
    actualHoldingCosts=Math.round(
      holdMo*monthlyInterest+
      holdMo*hoaMonthly+
      holdMo*(taxAnnual/12)+
      holdMo*utilitiesMonthly+
      insuranceCost
    );
  }

  // Full actuals (only computable if sale price exists)
  let actualTotalCost=null;
  let actualProfit=null;
  let actualRoi=null;

  if(salePrice){
    // Protocol fixed costs
    const origination=fin?.origination_fee||Math.round(loanPrincipal*0.015);
    const buySideClosing=5000;
    const lenderServiceFee=1499;
    const sellSideClosing=3500;
    const ownersTitle=3000;
    const staging=5000;
    const hoaTransfer=500;
    const miscBuffer=1500;

    // Variable costs
    const buyerAgentPct=outcome.actual_buyer_agent_pct||2.5;
    const buyerAgentComm=Math.round(salePrice*(buyerAgentPct/100));
    const rptt=Math.ceil(salePrice/500)*2.55;

    // Lisa buy-side credit (reduces cost)
    const lisaPct=deal.accepted_commission_pct||deal.lisa_buy_commission_pct||calc?.lisa_commission_pct||2.5;
    const lisaCommission=Math.round(purchasePrice*(lisaPct/100));

    // Use actual holding costs if computed, else estimate from available hold period
    let holdCostForTotal=actualHoldingCosts;
    if(holdCostForTotal==null&&calc?.hold_cost){
      holdCostForTotal=calc.hold_cost;
    }

    actualTotalCost=Math.round(
      purchasePrice+
      actualRenoCost+
      origination+
      buySideClosing+
      lenderServiceFee+
      (holdCostForTotal||0)+
      sellSideClosing+
      ownersTitle+
      staging+
      hoaTransfer+
      miscBuffer+
      buyerAgentComm+
      rptt-
      lisaCommission
    );

    actualProfit=Math.round(salePrice-actualTotalCost);
    actualRoi=actualTotalCost>0?parseFloat(((actualProfit/actualTotalCost)*100).toFixed(1)):0;
  }

  // 6. Write actuals to patch
  patch.actual_purchase_price=purchasePrice||null;
  patch.actual_reno_cost=actualRenoCost||null;
  patch.actual_hold_months=actualHoldMonths;
  patch.actual_holding_costs=actualHoldingCosts;
  patch.actual_total_cost=actualTotalCost;
  patch.actual_sale_price=salePrice;
  patch.actual_sale_date=saleDate;
  patch.actual_listing_date=outcome.actual_listing_date||null;
  patch.actual_profit=actualProfit;
  patch.actual_roi=actualRoi;

  // 7. Compute deltas (actual minus projected)
  if(calc){
    patch.delta_reno=(actualRenoCost&&calc.rehab_budget!=null)?actualRenoCost-calc.rehab_budget:null;
    patch.delta_hold_months=(actualHoldMonths!=null&&calc.hold_months!=null)?parseFloat((actualHoldMonths-calc.hold_months).toFixed(1)):null;
    patch.delta_holding_costs=(actualHoldingCosts!=null&&calc.hold_cost!=null)?actualHoldingCosts-calc.hold_cost:null;
    patch.delta_total_cost=(actualTotalCost!=null&&calc.total_cost!=null)?actualTotalCost-calc.total_cost:null;
    patch.delta_profit=(actualProfit!=null&&calc.net_profit!=null)?actualProfit-calc.net_profit:null;
    patch.delta_roi=(actualRoi!=null&&calc.roi!=null)?parseFloat((actualRoi-calc.roi).toFixed(1)):null;
  }

  // 8. Set postmortem status
  patch.postmortem_status=salePrice?"actuals_entered":"pending";

  // 9. PATCH deal_outcomes
  try{
    await fetch(SB+"/rest/v1/deal_outcomes?id=eq."+outcome.id,{method:"PATCH",headers:HD,body:JSON.stringify(patch)});
    console.log("[Postmortem] Updated deal_outcomes:",Object.keys(patch).length,"fields");
    console.log("[Postmortem] Projected profit:",patch.projected_profit,"Actual profit:",patch.actual_profit,"Delta:",patch.delta_profit);
  }catch(e){console.error("[Postmortem] PATCH failed:",e);return null;}

  return{...outcome,...patch};
}

// ═══════════════════════════════════════════
// ═══ POSTMORTEM UI ═══
// ═══════════════════════════════════════════

const INSIGHT_CATS={scope_creep:{color:"#ef4444",label:"Scope Creep"},timeline_drift:{color:"#f97316",label:"Timeline Drift"},material_delay:{color:"#eab308",label:"Material Delay"},contractor_issue:{color:"#ef4444",label:"Contractor Issue"},market_shift:{color:"#3b82f6",label:"Market Shift"},pricing_strategy:{color:"#22c55e",label:"Pricing Strategy"},design_win:{color:"#22c55e",label:"Design Win"},staging_impact:{color:"#22c55e",label:"Staging Impact"},financing_cost:{color:"#f97316",label:"Financing Cost"},buyer_feedback:{color:"#3b82f6",label:"Buyer Feedback"},process_improvement:{color:"#a855f7",label:"Process Improvement"},other:{color:"#64748b",label:"Other"}};

async function loadPostmortemUI(dealId,el){
  let oc=null;
  try{const res=await sb("deal_outcomes?deal_id=eq."+dealId);if(Array.isArray(res)&&res.length)oc=res[0];}catch(e){}
  const pm=oc||{};
  const pms=pm.postmortem_status||'pending';
  const hasSaleData=!!pm.actual_sale_price;
  const insights=Array.isArray(pm.insights)?pm.insights:[];

  const pf=(v)=>v!=null?'$'+Math.round(Number(v)).toLocaleString():'—';
  const pp=(v)=>v!=null?Number(v).toFixed(1)+'%':'—';

  function pmDelta(v,type,lower){
    if(v==null)return'<span style="color:#475569">—</span>';
    const good=lower?(v<0):(v>0);const bad=lower?(v>0):(v<0);
    const col=good?'#22c55e':bad?'#ef4444':'#94a3b8';
    let t;
    if(type==='pct')t=(v>0?'+':'')+v.toFixed(1)+'%';
    else if(type==='mo')t=(v>0?'+':'')+v.toFixed(1)+' mo';
    else t=(v>=0?'+$':'-$')+Math.abs(Math.round(v)).toLocaleString();
    return'<span style="color:'+col+';font-weight:700">'+t+'</span>';
  }

  function cRow(label,proj,actual,delta,type,lower){
    const fv=type==='pct'?pp:type==='mo'?(v=>v!=null?v.toFixed(1):'—'):pf;
    return`<div style="display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;gap:4px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center"><div style="font-size:12px;color:#94a3b8;font-weight:600">${label}</div><div style="font-size:12px;color:#64748b;text-align:right;font-weight:600">${fv(proj)}</div><div style="font-size:13px;color:#e2e8f0;text-align:right;font-weight:700">${fv(actual)}</div><div style="font-size:12px;text-align:right">${pmDelta(delta,type,lower)}</div></div>`;
  }

  let h='';

  // ── SECTION 1: SALE DATA ──
  h+=`<div style="padding:16px;border-radius:14px;background:rgba(212,175,55,0.03);border:1px solid rgba(212,175,55,0.12);margin-bottom:12px">`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:12px">🏆 DEAL POSTMORTEM</div>`;

  if(!hasSaleData){
    h+=`<div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Enter your actual sale results to generate the postmortem comparison.</div>`;
    h+=`<div class="row2"><div class="fld"><label>ACTUAL SALE PRICE</label><input id="pm_sale_price" type="number" class="cinput" placeholder="1575000"/></div><div class="fld"><label>BUYER AGENT %</label><input id="pm_buyer_agent_pct" type="number" step="0.5" class="cinput" value="2.5"/></div></div>`;
    h+=`<div class="row2"><div class="fld"><label>SALE DATE</label><input id="pm_sale_date" type="date" class="cinput" onchange="pmAutoDOM()"/></div><div class="fld"><label>LISTING DATE</label><input id="pm_listing_date" type="date" class="cinput" onchange="pmAutoDOM()"/></div></div>`;
    h+=`<div class="fld"><label>DAYS ON MARKET</label><input id="pm_dom" type="number" class="cinput" placeholder="Auto-calculated from dates"/></div>`;
    h+=`<button onclick="saveSaleData('${dealId}','${pm.id||''}')" style="width:100%;margin-top:10px;padding:14px;background:linear-gradient(135deg,#d4af37,#b8960c);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Calculate Results</button>`;
  }else{
    const sd=pm.actual_sale_date?new Date(pm.actual_sale_date+'T00:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'}):'';
    h+=`<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:800;color:#e2e8f0">Sold ${pf(pm.actual_sale_price)}${pm.days_on_market?' · '+pm.days_on_market+' DOM':''}${sd?' · Closed '+sd:''}</div><button onclick="expandSaleEdit()" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(212,175,55,0.25);background:rgba(212,175,55,0.08);color:#d4af37;font-size:10px;font-weight:700;cursor:pointer">Edit</button></div>`;
    h+=`<div id="pmSaleEdit" style="display:none;margin-top:12px"><div class="row2"><div class="fld"><label>ACTUAL SALE PRICE</label><input id="pm_sale_price" type="number" class="cinput" value="${pm.actual_sale_price||''}"/></div><div class="fld"><label>BUYER AGENT %</label><input id="pm_buyer_agent_pct" type="number" step="0.5" class="cinput" value="${pm.actual_buyer_agent_pct||2.5}"/></div></div><div class="row2"><div class="fld"><label>SALE DATE</label><input id="pm_sale_date" type="date" class="cinput" value="${pm.actual_sale_date||''}" onchange="pmAutoDOM()"/></div><div class="fld"><label>LISTING DATE</label><input id="pm_listing_date" type="date" class="cinput" value="${pm.actual_listing_date||''}" onchange="pmAutoDOM()"/></div></div><div class="fld"><label>DAYS ON MARKET</label><input id="pm_dom" type="number" class="cinput" value="${pm.days_on_market||''}"/></div><button onclick="saveSaleData('${dealId}','${pm.id||''}')" style="width:100%;margin-top:8px;padding:12px;background:linear-gradient(135deg,#d4af37,#b8960c);color:#000;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Recalculate</button></div>`;
  }
  h+=`</div>`;

  // ── SECTION 2: COMPARISON TABLE ──
  if(hasSaleData){
    h+=`<details open style="margin-bottom:12px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:rgba(255,255,255,0.02)"><summary style="padding:14px 16px;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:2px;color:#d4af37;list-style:none;display:flex;justify-content:space-between;align-items:center"><span>ACTUAL vs PROJECTED</span><span style="font-size:11px;color:#475569;letter-spacing:0">▾</span></summary><div style="padding:0 16px 16px">`;
    h+=`<div style="display:grid;grid-template-columns:2.5fr 1fr 1fr 1fr;gap:4px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:1px">METRIC</div><div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:1px;text-align:right">PROJECTED</div><div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:1px;text-align:right">ACTUAL</div><div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:1px;text-align:right">DELTA</div></div>`;
    h+=cRow('Sale Price / ARV',pm.projected_arv,pm.actual_sale_price,pm.actual_sale_price&&pm.projected_arv?pm.actual_sale_price-pm.projected_arv:null,'$',false);
    h+=cRow('Renovation Cost',pm.projected_reno_budget,pm.actual_reno_cost,pm.delta_reno,'$',true);
    h+=cRow('Hold Period',pm.projected_hold_months,pm.actual_hold_months,pm.delta_hold_months,'mo',true);
    h+=cRow('Holding Costs',pm.projected_holding_costs,pm.actual_holding_costs,pm.delta_holding_costs,'$',true);
    h+=cRow('Total Project Cost',pm.projected_total_cost,pm.actual_total_cost,pm.delta_total_cost,'$',true);
    h+=cRow('Profit',pm.projected_profit,pm.actual_profit,pm.delta_profit,'$',false);
    h+=cRow('ROI',pm.projected_roi,pm.actual_roi,pm.delta_roi,'pct',false);
    const pc=(pm.actual_profit||0)>=0?'#22c55e':'#ef4444';
    h+=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;padding:16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)"><div style="text-align:center"><div style="font-size:8px;color:#64748b;font-weight:700;letter-spacing:1px">ACTUAL PROFIT</div><div style="font-size:22px;font-weight:800;color:${pc};margin-top:4px">${pf(pm.actual_profit)}</div></div><div style="text-align:center"><div style="font-size:8px;color:#64748b;font-weight:700;letter-spacing:1px">ACTUAL ROI</div><div style="font-size:22px;font-weight:800;color:${pc};margin-top:4px">${pp(pm.actual_roi)}</div></div><div style="text-align:center"><div style="font-size:8px;color:#64748b;font-weight:700;letter-spacing:1px">vs PROJECTED</div><div style="font-size:22px;font-weight:800;margin-top:4px">${pmDelta(pm.delta_profit,'$',false)}</div></div></div>`;
    h+=`</div></details>`;
  }

  // ── SECTION 3: LESSONS LEARNED ──
  h+=`<details open style="margin-bottom:12px;border:1px solid rgba(168,85,247,0.12);border-radius:14px;background:rgba(168,85,247,0.03)"><summary style="padding:14px 16px;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:2px;color:#a855f7;list-style:none;display:flex;justify-content:space-between;align-items:center"><span>LESSONS LEARNED</span><span style="font-size:11px;color:#475569;letter-spacing:0">▾</span></summary><div style="padding:0 16px 16px">`;
  h+=`<div class="fld"><textarea id="pm_notes" rows="3" class="cinput" style="font-size:13px;min-height:60px" placeholder="What went right? What went wrong? Type or paste your thoughts...">${esc(pm.notes||'')}</textarea></div>`;
  h+=`<div style="display:flex;gap:8px;margin-top:8px"><button onclick="savePostmortemNotes('${dealId}','${pm.id||''}')" class="btn" style="flex:1;padding:10px;font-size:12px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#a855f7;font-weight:700">Save Notes</button><button disabled style="flex:1;padding:10px;font-size:12px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);color:rgba(212,175,55,0.4);font-weight:700;border-radius:10px;cursor:not-allowed">🤖 Analyze with AI</button></div>`;
  if(insights.length){
    h+=`<div style="margin-top:12px">`;
    insights.forEach(ins=>{
      const cat=INSIGHT_CATS[ins.category]||INSIGHT_CATS.other;
      h+=`<div style="padding:10px 12px;margin-top:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:9px;font-weight:800;letter-spacing:0.5px;color:${cat.color};background:${cat.color}15;border:1px solid ${cat.color}30;padding:2px 8px;border-radius:4px">${cat.label.toUpperCase()}</span>${ins.source?`<span style="font-size:9px;color:#475569">${esc(ins.source)}</span>`:''}</div><div style="font-size:12px;color:#e2e8f0;line-height:1.5">${esc(ins.text||'')}</div></div>`;
    });
    h+=`</div>`;
  }
  h+=`</div></details>`;

  // ── SECTION 4: ACTIONS ──
  h+=`<div style="display:flex;gap:8px">`;
  h+=`<button disabled style="flex:1;padding:12px;font-size:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.3);font-weight:700;border-radius:10px;cursor:not-allowed">📊 Export CPA Report</button>`;
  if(pms!=='complete'){
    h+=`<button onclick="markPostmortemComplete('${dealId}','${pm.id||''}')" style="flex:1;padding:12px;font-size:12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-weight:700;border-radius:10px;cursor:pointer">✓ Mark Complete</button>`;
  }else{
    h+=`<div style="flex:1;padding:12px;font-size:12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);color:#10b981;font-weight:700;border-radius:10px;text-align:center">✓ Postmortem Complete</div>`;
  }
  h+=`</div>`;

  el.innerHTML=h;
}

function expandSaleEdit(){const el=document.getElementById('pmSaleEdit');if(el)el.style.display=el.style.display==='none'?'block':'none';}

function pmAutoDOM(){const ld=document.getElementById('pm_listing_date')?.value;const sd=document.getElementById('pm_sale_date')?.value;const de=document.getElementById('pm_dom');if(ld&&sd&&de){de.value=Math.round((new Date(sd+'T00:00:00')-new Date(ld+'T00:00:00'))/(24*60*60*1000));}}

async function saveSaleData(dealId,outcomeId){
  const sp=Number(document.getElementById('pm_sale_price')?.value)||null;
  const sd=document.getElementById('pm_sale_date')?.value||null;
  const ld=document.getElementById('pm_listing_date')?.value||null;
  const bap=Number(document.getElementById('pm_buyer_agent_pct')?.value)||2.5;
  let dom=Number(document.getElementById('pm_dom')?.value)||null;
  if(!dom&&ld&&sd)dom=Math.round((new Date(sd+'T00:00:00')-new Date(ld+'T00:00:00'))/(24*60*60*1000));
  if(!sp){alert('Enter the actual sale price.');return;}
  const payload={deal_id:dealId,actual_sale_price:sp,actual_sale_date:sd,actual_listing_date:ld,actual_buyer_agent_pct:bap,days_on_market:dom};
  try{
    if(outcomeId){await fetch(SB+'/rest/v1/deal_outcomes?id=eq.'+outcomeId,{method:'PATCH',headers:HD,body:JSON.stringify(payload)});}
    else{payload.postmortem_status='pending';const resp=await fetch(SB+'/rest/v1/deal_outcomes',{method:'POST',headers:{...HD,Prefer:'return=representation'},body:JSON.stringify(payload)});const arr=await resp.json();outcomeId=Array.isArray(arr)?arr[0]?.id:arr?.id;}
    await populatePostmortem(dealId);
    await loadDealOutcomes(dealId);
    renderSmartCard(dealId);
    const t=document.createElement('div');t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;background:#d4af37;color:#0a0a0a;font-size:12px;font-weight:800;z-index:9999';t.textContent='Postmortem calculated';document.body.appendChild(t);setTimeout(()=>t.remove(),2500);
  }catch(e){console.error('Save sale data failed:',e);alert('Failed to save.');}
}

async function savePostmortemNotes(dealId,outcomeId){
  const notes=document.getElementById('pm_notes')?.value?.trim()||null;
  if(!outcomeId)return;
  try{
    await fetch(SB+'/rest/v1/deal_outcomes?id=eq.'+outcomeId,{method:'PATCH',headers:HD,body:JSON.stringify({notes})});
    const t=document.createElement('div');t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;background:#a855f7;color:#fff;font-size:12px;font-weight:800;z-index:9999';t.textContent='Notes saved';document.body.appendChild(t);setTimeout(()=>t.remove(),2000);
  }catch(e){console.error('Save notes failed:',e);}
}

async function markPostmortemComplete(dealId,outcomeId){
  if(!outcomeId||!confirm('Mark this postmortem as complete?'))return;
  try{
    await fetch(SB+'/rest/v1/deal_outcomes?id=eq.'+outcomeId,{method:'PATCH',headers:HD,body:JSON.stringify({postmortem_status:'complete'})});
    await loadDealOutcomes(dealId);
    renderSmartCard(dealId);
  }catch(e){console.error('Mark complete failed:',e);}
}
