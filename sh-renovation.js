// Sovereign House Intelligence — Renovation Module
// ═══════════════════════════════════════════
// ═══ RENOVATION TRACKER ═══
// ═══════════════════════════════════════════

const RENO_QUALIFYING=["under_contract","inspection","financing","closing","won","closed","in_renovation","renovation_complete","listing_prep","listed"];
const RENO_CAT_COLORS={kitchen:"#3b82f6",bathrooms:"#a855f7",bathroom:"#a855f7",flooring:"#14b8a6",paint:"#22c55e",electrical:"#eab308",plumbing:"#06b6d4",hvac:"#f97316",roofing:"#ef4444",roof:"#ef4444",landscaping:"#84cc16",windows:"#8b5cf6",doors:"#ec4899",drywall:"#94a3b8",demolition:"#f43f5e",framing:"#d97706",insulation:"#a3e635",exterior:"#0ea5e9",garage:"#64748b",foundation:"#78716c",basement:"#78716c",general:"#94a3b8",contingency:"#f59e0b",permits:"#6366f1",cabinets:"#3b82f6",countertops:"#8b5cf6",appliances:"#06b6d4",siding:"#0ea5e9",gutters:"#64748b",fence:"#84cc16",concrete:"#78716c",tile:"#14b8a6",hardware:"#94a3b8",cleaning:"#a3e635"};
const RENO_STAT_COLORS={not_started:"#64748b",in_progress:"#3b82f6",complete:"#22c55e",change_order:"#f97316"};
const EXP_TYPE_COLORS={material:"#3b82f6",labor:"#f97316",permit:"#64748b",fee:"#ef4444",other:"#94a3b8"};
const DRAW_PIPE=[
  {key:"preparing",label:"Preparing",df:"date_prepared"},
  {key:"submitted",label:"Submitted",df:"date_submitted"},
  {key:"inspection",label:"Inspection",df:"date_inspection_scheduled"},
  {key:"review",label:"Review",df:"date_inspection_complete"},
  {key:"approved",label:"Approved",df:"date_approved"},
  {key:"disbursed",label:"Disbursed",df:"date_disbursed"}
];

let renoDealId=null,renoSub="budget",renoOv=null,renoBLines=[],renoDS=null,renoDraws=[],renoExp=[],renoSOW=[],renoDeal=null,renoExpandedLine=null;
let renoExpF={sow:"all",type:"all",from:"",to:""};

// ═══ CURRENCY ═══
function $r(n){if(n==null)return"—";const v=Number(n);if(isNaN(v))return"—";return v%1!==0?"$"+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"$"+v.toLocaleString();}

// ═══ TAB INJECTION ═══
const _origRD=renderDashboard;
renderDashboard=function(){_origRD();injectRenoTab();if(view==="renovation")renderRenoView();};
const _origSV=setView;
setView=function(v){if(v==="renovation"){view="renovation";renderDashboard();return;}_origSV(v);};

function getRenoDeals(){return deals.filter(d=>RENO_QUALIFYING.includes(d.status));}

function injectRenoTab(){
  const fa=document.getElementById("filtersArea");if(!fa)return;
  const rd=getRenoDeals();if(!rd.length)return;
  const btns=fa.querySelectorAll(".filt");
  let dealsBtn=null;
  btns.forEach(b=>{if(b.textContent.includes("Deals"))dealsBtn=b;});
  const rb=document.createElement("button");
  rb.className="filt"+(view==="renovation"?" on":"");
  rb.onclick=()=>setView("renovation");
  let dot="";
  if(renoOv){const h=renoOv.budget_health;const dc=h==="over_budget"?"#ef4444":h==="warning"?"#eab308":"#22c55e";dot=` <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dc};vertical-align:middle"></span>`;}
  rb.innerHTML=`Reno${dot}`;
  if(view==="renovation"){rb.style.borderColor="rgba(212,175,55,0.5)";rb.style.background="rgba(212,175,55,0.12)";rb.style.color="#d4af37";}
  if(dealsBtn&&dealsBtn.nextSibling)fa.insertBefore(rb,dealsBtn.nextSibling);
  else if(dealsBtn)fa.appendChild(rb);
  else if(btns.length>1)fa.insertBefore(rb,btns[1]);
  else fa.appendChild(rb);
}

// ═══ MAIN RENDER ═══
async function renderRenoView(){
  const rd=getRenoDeals();
  document.getElementById("countLabel").textContent="Renovation";
  // Hide search/sort for reno view
  const searchBox=document.getElementById("searchBox");if(searchBox)searchBox.parentElement.parentElement.style.display="none";
  if(!rd.length){
    document.getElementById("listArea").innerHTML=`<div style="text-align:center;padding:60px 20px;color:#475569;grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🔨</div><div style="font-size:16px;font-weight:700;color:#94a3b8">No Active Renovations</div><div style="font-size:13px;color:#64748b;margin-top:6px">Renovation tracking becomes available when a deal reaches Under Contract or Closed status.</div></div>`;
    return;
  }
  if(!renoDealId||!rd.find(d=>d.id===renoDealId))renoDealId=rd[0].id;

  let html='<div style="grid-column:1/-1" class="reno-wrap">';
  // Deal selector
  if(rd.length>1){
    html+=`<div style="margin-bottom:12px"><select id="renoDealSel" onchange="switchRenoDeal(this.value)" style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(212,175,55,0.2);background:rgba(212,175,55,0.04);color:#f1f5f9;font-size:14px;font-weight:700;min-height:44px">`;
    rd.forEach(d=>{html+=`<option value="${d.id}"${d.id===renoDealId?" selected":""}>${esc(d.address)} — ${(d.status||"").replace(/_/g," ")}</option>`;});
    html+=`</select></div>`;
  } else {
    html+=`<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:12px">${esc(rd[0].address)}</div>`;
  }
  // Sub-view pills
  html+=`<div class="reno-pills"><button class="reno-pill${renoSub==="budget"?" active":""}" onclick="switchRenoSub('budget')">Budget</button><button class="reno-pill${renoSub==="draws"?" active":""}" onclick="switchRenoSub('draws')">Draws</button><button class="reno-pill${renoSub==="expenses"?" active":""}" onclick="switchRenoSub('expenses')">Expenses</button></div>`;
  // Content placeholder
  html+=`<div id="renoContent"><div style="text-align:center;padding:40px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div></div></div>`;
  html+='</div>';
  document.getElementById("listArea").innerHTML=html;
  await loadRenoData(renoDealId);
  renderRenoSub();
}

async function loadRenoData(did){
  try{
    const[ov,bl,ds,dr,ex,sw,di]=await Promise.all([
      sb("renovation_deal_overview?deal_id=eq."+did),
      sb("renovation_budget_summary?deal_id=eq."+did+"&order=line_number"),
      sb("renovation_draw_summary?deal_id=eq."+did),
      sb("renovation_draws?deal_id=eq."+did+"&order=draw_number"),
      sb("renovation_expenses?deal_id=eq."+did+"&order=expense_date.desc&select=*,renovation_sow_lines(line_number,category,description)"),
      sb("renovation_sow_lines?deal_id=eq."+did+"&order=line_number"),
      sb("deals?id=eq."+did+"&select=id,address,status,lender_name,lender_max_draws,lender_holdback_pct,lender_draw_fee,lender_loan_number,reno_budget")
    ]);
    renoOv=Array.isArray(ov)&&ov.length?ov[0]:null;
    renoBLines=Array.isArray(bl)?bl:[];
    renoDS=Array.isArray(ds)&&ds.length?ds[0]:null;
    renoDraws=Array.isArray(dr)?dr:[];
    renoExp=Array.isArray(ex)?ex:[];
    renoSOW=Array.isArray(sw)?sw:[];
    renoDeal=Array.isArray(di)&&di.length?di[0]:null;
  }catch(e){console.error("[SH] Reno load error:",e);}
}

function switchRenoDeal(did){renoDealId=did;renoSub="budget";renoExpandedLine=null;renderRenoView();}
function switchRenoSub(s){renoSub=s;renoExpandedLine=null;renderRenoSub();}

function renderRenoSub(){
  const el=document.getElementById("renoContent");if(!el)return;
  document.querySelectorAll(".reno-pill").forEach(p=>{p.classList.toggle("active",p.textContent.toLowerCase()===renoSub);});
  if(renoSub==="budget")renderBudget(el);
  else if(renoSub==="draws")renderDrawsV(el);
  else if(renoSub==="expenses")renderExpV(el);
}

// ═══ BUDGET VIEW ═══
function renderBudget(el){
  const ov=renoOv;
  if(!ov&&!renoBLines.length){el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No scope of work loaded for this deal.</div></div>`;return;}

  const tb=ov?.total_planned_budget||0,ts=ov?.total_spent||0,rem=ov?.remaining_budget||0;
  const pct=tb>0?(ts/tb*100):0;
  const sc=pct>100?"#ef4444":pct>80?"#eab308":"#22c55e";
  const rc=rem<0?"#ef4444":"#22c55e";
  let h='';

  // Big Three
  h+=`<div class="reno-hero"><div class="reno-hcard"><div class="reno-hl">TOTAL BUDGET</div><div class="reno-hv">${$r(tb)}</div></div><div class="reno-hcard"><div class="reno-hl">TOTAL SPENT</div><div class="reno-hv" style="color:${sc}">${$r(ts)}</div></div><div class="reno-hcard"><div class="reno-hl">REMAINING</div><div class="reno-hv" style="color:${rc}">${$r(rem)}</div></div></div>`;

  // Progress bar
  h+=`<div class="reno-pbar"><div class="reno-pfill" style="width:${Math.min(pct,100)}%;background:${sc}"></div></div><div style="text-align:right;font-size:10px;color:#64748b;margin-top:4px;margin-bottom:16px">${pct.toFixed(1)}% spent</div>`;

  // Secondary metrics
  const la=ov?.total_lender_approved||0,rb2=ov?.total_reimbursed||0,ue=ov?.unreimbursed_exposure||0,du=ov?.draws_used||0,md=renoDeal?.lender_max_draws||"?";
  const ueBg=ue>50000?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.02)";
  const ueBr=ue>50000?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)";
  h+=`<div class="reno-sgrid"><div class="reno-scard"><div class="reno-sl">LENDER APPROVED</div><div class="reno-sv">${$r(la)}</div></div><div class="reno-scard"><div class="reno-sl">REIMBURSED</div><div class="reno-sv" style="color:#22c55e">${$r(rb2)}</div></div><div class="reno-scard" style="background:${ueBg};border-color:${ueBr}"><div class="reno-sl">UNREIMBURSED</div><div class="reno-sv" style="color:${ue>50000?"#ef4444":"#f1f5f9"}">${$r(ue)}</div></div><div class="reno-scard"><div class="reno-sl">DRAWS USED</div><div class="reno-sv">${du} / ${md}</div></div></div>`;

  // SOW table
  const fl=renoBLines.filter(l=>l.lender_approved>0||l.planned_budget>0||l.total_spent>0);
  if(fl.length){
    h+=`<div style="margin-top:20px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">SCOPE OF WORK</div><div class="reno-tw"><table class="reno-tbl"><thead><tr><th>#</th><th>Category</th><th>Description</th><th class="reno-hm">Approved</th><th>Planned</th><th>Spent</th><th class="reno-hm">Drawn</th><th>Remaining</th><th>Status</th></tr></thead><tbody>`;
    fl.forEach(l=>{
      const cc=RENO_CAT_COLORS[(l.category||"").toLowerCase()]||"#64748b";
      const stc=RENO_STAT_COLORS[l.status]||"#64748b";
      const rmc=(l.remaining_budget||0)<0?"#ef4444":"#22c55e";
      const exp=renoExpandedLine===l.id;
      h+=`<tr class="reno-r${exp?" expanded":""}" onclick="toggleLineExp('${l.id}')"><td style="color:#64748b">${l.line_number}</td><td><span class="reno-chip" style="color:${cc};background:${cc}15;border:1px solid ${cc}30">${esc((l.category||"").replace(/_/g," "))}</span></td><td style="font-weight:600;color:#e2e8f0">${esc(l.description||"")}</td><td class="reno-hm" style="text-align:right">${$r(l.lender_approved)}</td><td style="text-align:right">${$r(l.planned_budget)}</td><td style="text-align:right;font-weight:700">${$r(l.total_spent)}</td><td class="reno-hm" style="text-align:right">${$r(l.total_drawn)}</td><td style="text-align:right;color:${rmc};font-weight:700">${$r(l.remaining_budget)}</td><td><span class="reno-chip" style="color:${stc};background:${stc}15;border:1px solid ${stc}30">${(l.status||"not_started").replace(/_/g," ")}</span></td></tr>`;
      if(exp)h+=`<tr class="reno-xrow"><td colspan="9" id="renoLX_${l.id}"><div style="padding:8px 0;color:#64748b;font-size:11px">Loading expenses...</div></td></tr>`;
    });
    h+=`</tbody></table></div></div>`;
  }

  // Out of Pocket
  if(tb>la&&la>0){
    const oop=tb-la;
    h+=`<div class="reno-oop"><div class="reno-oop-r"><span>Planned Total</span><span>${$r(tb)}</span></div><div class="reno-oop-r"><span>Lender Covers</span><span>${$r(la)}</span></div><div class="reno-oop-r reno-oop-t"><span>Out-of-Pocket</span><span style="color:#f59e0b">${$r(oop)}</span></div></div>`;
  }
  el.innerHTML=h;
  if(renoExpandedLine)loadLineExp(renoExpandedLine);
}

async function toggleLineExp(lid){renoExpandedLine=renoExpandedLine===lid?null:lid;renderRenoSub();}

async function loadLineExp(lid){
  const c=document.getElementById("renoLX_"+lid);if(!c)return;
  try{
    const ex=await sb("renovation_expenses?sow_line_id=eq."+lid+"&order=expense_date.desc");
    if(!Array.isArray(ex)||!ex.length){c.innerHTML=`<div style="padding:12px;color:#475569;font-size:11px">No expenses for this line item.</div>`;return;}
    let h=`<div class="reno-lx">`;
    ex.forEach(e=>{
      const tc=EXP_TYPE_COLORS[e.expense_type]||"#94a3b8";
      h+=`<div class="reno-lx-row"><span style="color:#64748b;min-width:60px">${e.expense_date?new Date(e.expense_date+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric"}):"—"}</span><span style="color:#94a3b8;min-width:100px">${esc(e.vendor_name||"—")}</span><span style="flex:1;color:#e2e8f0">${esc(e.description||"")}</span><span style="font-weight:700;min-width:80px;text-align:right">${$r(e.amount)}</span><span><span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30">${e.expense_type||"other"}</span></span></div>`;
    });
    h+=`</div>`;c.innerHTML=h;
  }catch(e){c.innerHTML=`<div style="padding:12px;color:#ef4444;font-size:11px">Failed to load expenses.</div>`;}
}

// ═══ DRAWS VIEW ═══
function renderDrawsV(el){
  const ds=renoDS,md=renoDeal?.lender_max_draws||"?";
  let h='';
  h+=`<div class="reno-sgrid"><div class="reno-scard"><div class="reno-sl">TOTAL DRAWN</div><div class="reno-sv">${$r(ds?.total_requested)}</div></div><div class="reno-scard"><div class="reno-sl">TOTAL RECEIVED</div><div class="reno-sv" style="color:#22c55e">${$r(ds?.total_received)}</div></div><div class="reno-scard"><div class="reno-sl">AVG REIMBURSEMENT</div><div class="reno-sv">${ds?.avg_days_to_reimburse?Math.round(ds.avg_days_to_reimburse)+" days":"—"}</div></div><div class="reno-scard"><div class="reno-sl">DRAWS REMAINING</div><div class="reno-sv">${ds?.draws_remaining!=null?ds.draws_remaining:"—"} / ${md}</div></div></div>`;

  h+=`<div style="margin:16px 0"><button onclick="openNewDraw()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">+ New Draw</button></div>`;

  if(!renoDraws.length){
    h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📄</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No draws submitted yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Start your first draw when work is complete and ready for inspection.</div></div>`;
  } else {
    renoDraws.forEach(d=>{h+=renderDC(d);});
  }
  el.innerHTML=h;
}

function renderDC(d){
  const sc2=d.status==="disbursed"?"#22c55e":d.status==="approved"?"#d4af37":d.status==="rejected"?"#ef4444":"#3b82f6";
  let cs=0;
  if(d.date_disbursed)cs=6;else if(d.date_approved)cs=5;else if(d.date_inspection_complete)cs=4;else if(d.date_inspection_scheduled)cs=3;else if(d.date_submitted)cs=2;else if(d.date_prepared)cs=1;

  let h=`<div class="reno-dc">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:16px;font-weight:800;color:#f1f5f9">Draw #${d.draw_number}</div><span class="reno-chip" style="color:${sc2};background:${sc2}15;border:1px solid ${sc2}30;font-weight:700">${(d.status||"preparing").replace(/_/g," ").toUpperCase()}</span></div>`;

  // Pipeline
  h+=`<div class="reno-pipe">`;
  DRAW_PIPE.forEach((s,i)=>{
    const sn=i+1,done=sn<cs,cur=sn===cs;
    h+=`<div class="reno-ps"><div class="reno-pd${done?" done":""}${cur?" cur":""}">${done?"✓":""}</div><div class="reno-pl">${s.label}</div></div>`;
    if(i<DRAW_PIPE.length-1)h+=`<div class="reno-pln${done?" done":""}"></div>`;
  });
  h+=`</div>`;

  // Body
  h+=`<div class="reno-db">`;
  h+=`<div class="reno-dr"><span>Amount Requested</span><span style="font-weight:700">${$r(d.amount_requested)}</span></div>`;
  if(d.draw_fee)h+=`<div class="reno-dr"><span>Fee</span><span style="color:#f59e0b">${$r(d.draw_fee)}</span></div>`;
  if(d.status==="disbursed"&&d.amount_received!=null)h+=`<div class="reno-dr"><span>Net Received</span><span style="color:#22c55e;font-weight:700">${$r(d.amount_received)}</span></div>`;
  if(d.status==="disbursed"&&d.days_to_reimburse!=null)h+=`<div class="reno-dr"><span>Days to Reimburse</span><span>${d.days_to_reimburse} days</span></div>`;
  if(d.date_submitted)h+=`<div class="reno-dr"><span>Date Submitted</span><span>${fmtDate(d.date_submitted)}</span></div>`;
  if(d.status==="disbursed"&&d.date_disbursed)h+=`<div class="reno-dr"><span>Date Disbursed</span><span>${fmtDate(d.date_disbursed)}</span></div>`;

  // Docs
  h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">`;
  h+=`<span style="font-size:10px;color:${d.has_invoices?"#22c55e":"#64748b"}">${d.has_invoices?"✓":"✗"} Invoices</span>`;
  h+=`<span style="font-size:10px;color:${d.has_lien_waivers?"#22c55e":"#64748b"}">${d.has_lien_waivers?"✓":"✗"} Lien Waivers</span>`;
  h+=`<span style="font-size:10px;color:${d.has_draw_request_form?"#22c55e":"#64748b"}">${d.has_draw_request_form?"✓":"✗"} Draw Form</span>`;
  h+=`</div>`;
  if(d.interest_payments_current===false)h+=`<div style="font-size:10px;color:#f59e0b;margin-top:6px">⚠️ Interest payments not current</div>`;
  else if(d.interest_payments_current===true)h+=`<div style="font-size:10px;color:#22c55e;margin-top:6px">✓ Interest current</div>`;
  h+=`</div>`;

  if(d.status!=="disbursed")h+=`<button onclick="openDrawUpdate('${d.id}',${cs})" class="btn" style="width:100%;margin-top:12px;padding:10px;font-size:12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-weight:700">Update Status</button>`;
  h+=`</div>`;
  return h;
}

function fmtDate(d){if(!d)return"—";return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric"});}

// ═══ DRAW STATUS UPDATE ═══
function openDrawUpdate(drawId,cs){
  const dr=renoDraws.find(d=>d.id===drawId);if(!dr)return;
  const ns=DRAW_PIPE[cs];if(!ns)return;
  const m=document.getElementById("renoModal");
  let h=`<div class="sheet" style="position:relative;max-height:80vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">UPDATE DRAW STATUS</div>`;
  h+=`<div style="font-size:16px;font-weight:800;margin-bottom:16px">Draw #${dr.draw_number} → ${ns.label}</div>`;
  h+=`<div class="fld"><label>${ns.label.toUpperCase()} DATE</label><input id="dsDate" type="date" class="cinput" value="${new Date().toISOString().split("T")[0]}"/></div>`;
  if(ns.key==="disbursed")h+=`<div class="fld"><label>AMOUNT RECEIVED</label><input id="dsAmt" type="number" class="cinput" value="${(dr.amount_requested||0)-(dr.draw_fee||0)}" placeholder="Net amount received"/></div>`;
  h+=`<button onclick="saveDrawUpdate('${drawId}','${ns.key}','${ns.df}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Save Status</button></div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function saveDrawUpdate(drawId,sk,df){
  const dv=document.getElementById("dsDate")?.value;if(!dv)return;
  const patch={status:sk};patch[df]=dv;
  if(sk==="disbursed"){
    const amt=Number(document.getElementById("dsAmt")?.value);if(amt)patch.amount_received=amt;
    const dr=renoDraws.find(d=>d.id===drawId);
    if(dr?.date_submitted){patch.days_to_reimburse=Math.round((new Date(dv)-new Date(dr.date_submitted))/(864e5));}
  }
  try{
    await fetch(SB+"/rest/v1/renovation_draws?id=eq."+drawId,{method:"PATCH",headers:HD,body:JSON.stringify(patch)});
    closeRenoModal();await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Draw update failed:",e);}
}

// ═══ NEW DRAW ═══
function openNewDraw(){
  const nn=renoDraws.length+1,fee=renoDeal?.lender_draw_fee||0;
  const m=document.getElementById("renoModal");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">NEW DRAW</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">Draw #${nn}</div>`;
  h+=`<div class="fld"><label>AMOUNT REQUESTED</label><input id="ndAmt" type="number" class="cinput" placeholder="Total draw amount"/></div>`;
  h+=`<div class="fld"><label>DRAW FEE</label><input id="ndFee" type="number" class="cinput" value="${fee}"/></div>`;

  h+=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:16px 0 8px">SOW LINE ITEMS IN THIS DRAW</div>`;
  renoSOW.forEach(l=>{
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:4px"><input type="checkbox" id="ndL_${l.id}" data-lid="${l.id}" data-cat="${l.category||""}" class="ndLCb" style="width:18px;height:18px;accent-color:#d4af37"/><label for="ndL_${l.id}" style="flex:1;font-size:12px;color:#e2e8f0;cursor:pointer">#${l.line_number} — ${esc(l.description||l.category||"")}</label><input type="number" id="ndLA_${l.id}" class="cinput ndLAmt" style="width:100px;min-height:36px;font-size:12px;padding:6px 8px" placeholder="$0"/></div>`;
  });
  h+=`<div id="ndCWarn" style="display:none;margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);font-size:11px;color:#eab308">⚠️ Draws from contingency over $1,000 require a change order. File with lender before submitting.</div>`;

  h+=`<div style="margin-top:16px;font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">DOCUMENTATION</div>`;
  h+=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="ndInv" style="accent-color:#d4af37"/> Invoices</label><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="ndLW" style="accent-color:#d4af37"/> Lien Waivers</label><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="ndDF" style="accent-color:#d4af37"/> Draw Request Form</label></div>`;
  h+=`<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer;margin-bottom:16px"><input type="checkbox" id="ndInt" checked style="accent-color:#d4af37"/> Interest payments current</label>`;
  h+=`<button onclick="saveNewDraw(${nn})" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Create Draw</button></div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
  setTimeout(()=>{
    document.querySelectorAll(".ndLCb").forEach(cb=>cb.addEventListener("change",chkContWarn));
    document.querySelectorAll(".ndLAmt").forEach(inp=>inp.addEventListener("input",chkContWarn));
  },50);
}

function chkContWarn(){
  const w=document.getElementById("ndCWarn");if(!w)return;
  let show=false;
  document.querySelectorAll(".ndLCb").forEach(cb=>{
    if(cb.checked&&(cb.dataset.cat||"").toLowerCase()==="contingency"){
      const amt=Number(document.getElementById("ndLA_"+cb.dataset.lid)?.value)||0;
      if(amt>1000)show=true;
    }
  });
  w.style.display=show?"block":"none";
}

async function saveNewDraw(num){
  const amt=Number(document.getElementById("ndAmt")?.value);
  if(!amt){alert("Enter an amount.");return;}
  const fee=Number(document.getElementById("ndFee")?.value)||0;
  const payload={draw_number:num,amount_requested:amt,draw_fee:fee,status:"preparing",date_prepared:new Date().toISOString().split("T")[0],has_invoices:!!document.getElementById("ndInv")?.checked,has_lien_waivers:!!document.getElementById("ndLW")?.checked,has_draw_request_form:!!document.getElementById("ndDF")?.checked,interest_payments_current:!!document.getElementById("ndInt")?.checked,deal_id:renoDealId};
  try{
    const res=await fetch(SB+"/rest/v1/renovation_draws",{method:"POST",headers:HD,body:JSON.stringify(payload)});
    const result=await res.json();
    const newId=Array.isArray(result)?result[0]?.id:result?.id;
    if(newId){
      const lp=[];
      document.querySelectorAll(".ndLCb").forEach(cb=>{
        if(cb.checked){const lid=cb.dataset.lid;const la=Number(document.getElementById("ndLA_"+lid)?.value)||0;if(la>0)lp.push(fetch(SB+"/rest/v1/renovation_draw_lines",{method:"POST",headers:HD,body:JSON.stringify({draw_id:newId,sow_line_id:lid,amount:la})}));}
      });
      await Promise.all(lp);
    }
    closeRenoModal();showRenoToast("Draw #"+num+" created");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Create draw failed:",e);alert("Failed to create draw.");}
}

// ═══ EXPENSES VIEW ═══
function renderExpV(el){
  let h='';
  // Quick entry form
  h+=`<div class="reno-ef"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">LOG EXPENSE</div><div class="reno-eg">`;
  h+=`<div class="fld"><label>DATE</label><input id="exD" type="date" class="cinput" value="${new Date().toISOString().split("T")[0]}"/></div>`;
  h+=`<div class="fld"><label>SOW LINE</label><select id="exS" class="cinput">`;
  renoSOW.forEach(l=>{h+=`<option value="${l.id}">#${l.line_number} — ${esc(l.description||l.category||"")}</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld"><label>DESCRIPTION</label><input id="exDe" type="text" class="cinput" placeholder="What was purchased or paid for"/></div>`;
  h+=`<div class="fld"><label>AMOUNT</label><input id="exA" type="number" class="cinput" placeholder="$0.00" step="0.01"/></div>`;
  h+=`<div class="fld"><label>TYPE</label><select id="exT" class="cinput"><option value="material">Material</option><option value="labor">Labor</option><option value="permit">Permit</option><option value="fee">Fee</option><option value="other">Other</option></select></div>`;
  h+=`</div>`;

  // More details
  h+=`<button id="exMoreBtn" onclick="toggleExpMore()" style="background:none;border:none;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;padding:4px 0;margin-bottom:8px">More Details ▸</button>`;
  h+=`<div id="exMore" style="display:none"><div class="reno-eg">`;
  h+=`<div class="fld"><label>VENDOR</label><input id="exV" type="text" class="cinput" placeholder="Vendor name" list="vdl"/><datalist id="vdl">${[...new Set(renoExp.map(e=>e.vendor_name).filter(Boolean))].map(v=>`<option value="${esc(v)}">`).join("")}</datalist></div>`;
  h+=`<div class="fld"><label>PAYMENT</label><select id="exPm" class="cinput"><option value="">—</option><option value="cash">Cash</option><option value="loc">LOC</option><option value="credit_card">Credit Card</option><option value="check">Check</option><option value="wire">Wire</option></select></div>`;
  h+=`<div class="fld"><label>PRODUCT NAME</label><input id="exPn" type="text" class="cinput" placeholder="Product name"/></div>`;
  h+=`<div class="fld"><label>UNIT COST</label><input id="exUC" type="number" class="cinput" step="0.01" placeholder="Per unit"/></div>`;
  h+=`<div class="fld"><label>UNIT TYPE</label><select id="exUT" class="cinput"><option value="">—</option><option value="sf">SF</option><option value="lf">LF</option><option value="unit">Unit</option><option value="each">Each</option><option value="hour">Hour</option></select></div>`;
  h+=`<div class="fld"><label>QUANTITY</label><input id="exQ" type="number" class="cinput" placeholder="0"/></div>`;
  h+=`<div class="fld"><label>NOTES</label><input id="exN" type="text" class="cinput" placeholder="Notes"/></div>`;
  h+=`</div></div>`;
  h+=`<button onclick="saveExpense()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">Log Expense</button></div>`;

  // Filters
  h+=`<div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">`;
  h+=`<div class="fld" style="margin-bottom:0;min-width:120px"><label>SOW LINE</label><select id="efS" onchange="renoExpF.sow=this.value;renderExpLog()" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px"><option value="all">All Lines</option>`;
  renoSOW.forEach(l=>{h+=`<option value="${l.id}"${renoExpF.sow===l.id?" selected":""}>#${l.line_number} ${esc(l.category||"")}</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld" style="margin-bottom:0;min-width:100px"><label>TYPE</label><select id="efT" onchange="renoExpF.type=this.value;renderExpLog()" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px"><option value="all">All</option><option value="material"${renoExpF.type==="material"?" selected":""}>Material</option><option value="labor"${renoExpF.type==="labor"?" selected":""}>Labor</option><option value="permit"${renoExpF.type==="permit"?" selected":""}>Permit</option><option value="fee"${renoExpF.type==="fee"?" selected":""}>Fee</option><option value="other"${renoExpF.type==="other"?" selected":""}>Other</option></select></div>`;
  h+=`<div class="fld" style="margin-bottom:0"><label>FROM</label><input id="efF" type="date" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${renoExpF.from}" onchange="renoExpF.from=this.value;renderExpLog()"/></div>`;
  h+=`<div class="fld" style="margin-bottom:0"><label>TO</label><input id="efTo" type="date" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${renoExpF.to}" onchange="renoExpF.to=this.value;renderExpLog()"/></div>`;
  h+=`</div>`;
  h+=`<div id="renoExpLog" style="margin-top:12px"></div>`;
  el.innerHTML=h;
  renderExpLog();
}

function toggleExpMore(){
  const el=document.getElementById("exMore"),btn=document.getElementById("exMoreBtn");
  if(!el||!btn)return;
  const show=el.style.display==="none";
  el.style.display=show?"block":"none";
  btn.textContent=show?"Less Details ▾":"More Details ▸";
}

function renderExpLog(){
  const le=document.getElementById("renoExpLog");if(!le)return;
  let f=[...renoExp];
  if(renoExpF.sow!=="all")f=f.filter(e=>e.sow_line_id===renoExpF.sow);
  if(renoExpF.type!=="all")f=f.filter(e=>e.expense_type===renoExpF.type);
  if(renoExpF.from)f=f.filter(e=>e.expense_date>=renoExpF.from);
  if(renoExpF.to)f=f.filter(e=>e.expense_date<=renoExpF.to);

  if(!f.length){le.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">🧾</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No expenses recorded.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Log your first purchase above.</div></div>`;return;}

  let h=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>Date</th><th>SOW</th><th>Vendor</th><th>Description</th><th style="text-align:right">Amount</th><th>Type</th><th class="reno-hm">Payment</th></tr></thead><tbody>`;
  f.forEach(e=>{
    const tc=EXP_TYPE_COLORS[e.expense_type]||"#94a3b8";
    const sl=e.renovation_sow_lines;
    h+=`<tr><td style="color:#94a3b8;white-space:nowrap">${e.expense_date?new Date(e.expense_date+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric"}):"—"}</td><td>${sl?`<span class="reno-chip" style="color:#94a3b8;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">#${sl.line_number}</span>`:"—"}</td><td style="color:#94a3b8">${esc(e.vendor_name||"—")}</td><td style="color:#e2e8f0;font-weight:600">${esc(e.description||"")}</td><td style="text-align:right;font-weight:700">${$r(e.amount)}</td><td><span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30">${e.expense_type||"other"}</span></td><td class="reno-hm" style="color:#64748b">${e.payment_method?e.payment_method.replace(/_/g," "):"—"}</td></tr>`;
  });
  h+=`</tbody></table></div>`;

  const tot=f.reduce((s,e)=>s+(e.amount||0),0);
  const mat=f.filter(e=>e.expense_type==="material").reduce((s,e)=>s+(e.amount||0),0);
  const lab=f.filter(e=>e.expense_type==="labor").reduce((s,e)=>s+(e.amount||0),0);
  h+=`<div class="reno-totals"><div><span class="reno-sl">TOTAL SPENT</span><span style="font-size:16px;font-weight:800;color:#f1f5f9">${$r(tot)}</span></div><div><span class="reno-sl">MATERIALS</span><span style="font-size:16px;font-weight:800;color:#3b82f6">${$r(mat)}</span></div><div><span class="reno-sl">LABOR</span><span style="font-size:16px;font-weight:800;color:#f97316">${$r(lab)}</span></div></div>`;
  le.innerHTML=h;
}

async function saveExpense(){
  const sid=document.getElementById("exS")?.value;
  const desc=(document.getElementById("exDe")?.value||"").trim();
  const amt=Number(document.getElementById("exA")?.value);
  const dt=document.getElementById("exD")?.value;
  const tp=document.getElementById("exT")?.value;
  if(!sid||!desc||!amt||!dt){alert("Fill in date, SOW line, description, and amount.");return;}

  const p={expense_date:dt,sow_line_id:sid,description:desc,amount:amt,expense_type:tp,deal_id:renoDealId};
  const gv=id=>(document.getElementById(id)?.value||"").trim();
  const gn=id=>Number(document.getElementById(id)?.value)||0;
  if(gv("exV"))p.vendor_name=gv("exV");
  if(gv("exPm"))p.payment_method=gv("exPm");
  if(gv("exPn"))p.product_name=gv("exPn");
  if(gn("exUC"))p.unit_cost=gn("exUC");
  if(gv("exUT"))p.unit_type=gv("exUT");
  if(gn("exQ"))p.quantity=gn("exQ");
  if(gv("exN"))p.notes=gv("exN");

  try{
    await fetch(SB+"/rest/v1/renovation_expenses",{method:"POST",headers:HD,body:JSON.stringify(p)});
    // Clear form (keep date)
    ["exDe","exA","exV","exPn","exUC","exQ","exN"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    showRenoToast("Expense logged");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Save expense failed:",e);alert("Failed to save expense.");}
}

// ═══ HELPERS ═══
function showRenoToast(msg){
  const t=document.getElementById("alertToast");
  t.innerHTML=`<div style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:#22c55e">✓ ${esc(msg)}</div></div>`;
  setTimeout(()=>{t.innerHTML="";},3000);
}

function closeRenoModal(){document.getElementById("renoModal").style.display="none";document.body.style.overflow="";}

// Restore search bar when leaving reno view
const _origRL=renderList;
renderList=function(){
  const sb2=document.getElementById("searchBox");
  if(sb2&&view!=="renovation")sb2.parentElement.parentElement.style.display="";
  _origRL();
};
