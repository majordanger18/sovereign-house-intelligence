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

let renoDealId=null,renoSub="budget",renoOv=null,renoBLines=[],renoDS=null,renoDraws=[],renoExp=[],renoSOW=[],renoDeal=null,renoExpandedLine=null,renoFin=null,renoTasks=[];
let renoExpF={sow:"all",type:"all",from:"",to:""};
let renoTaskFilter={cat:"all",assignee:"all"};
let renoEditingTask=null,renoShowDone=false;
const TASK_CAT_COLORS={financing:"#22c55e",contractor:"#f97316",materials:"#3b82f6",design:"#ec4899",permits:"#6366f1",administrative:"#64748b",listing_prep:"#a855f7"};
const TASK_ASSIGNEES={"j@jmarshallhunt.com":"King J","lisa@lisaahunt.com":"Lisa"};
let _pendingReceiptUrl=null,_pendingFinUrl=null;

async function uploadToStorage(file,bucket,path){
  try{
    const res=await fetch(SB+"/storage/v1/object/"+bucket+"/"+path,{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":file.type,"x-upsert":"true"},body:file});
    if(!res.ok){console.error("Storage upload failed:",res.status);return null;}
    return SB+"/storage/v1/object/public/"+bucket+"/"+path;
  }catch(e){console.error("Storage upload error:",e);return null;}
}
function storagePath(dealId,type,file){const ext=file.name.split('.').pop()||'pdf';return(dealId||'general')+"/"+type+"/"+Date.now()+"."+ext;}

async function robustParseJSON(data,apiKey,matchArray){
  let text=data.content?.[0]?.text||"";
  text=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
  const regex=matchArray?/\[[\s\S]*\]/:(/\{[\s\S]*\}/);
  let jm=text.match(regex);
  if(!jm)throw new Error("No JSON found in response");
  let jsonStr=jm[0];
  jsonStr=jsonStr.replace(/,\s*}/g,'}').replace(/,\s*]/g,']');
  jsonStr=jsonStr.replace(/[\u201C\u201D]/g,'\\"');
  jsonStr=jsonStr.replace(/[\u2018\u2019]/g,"'");
  try{return JSON.parse(jsonStr);}catch(e1){}
  const lastBrace=jsonStr.lastIndexOf(matchArray?']':'}');
  jsonStr=jsonStr.substring(0,lastBrace+1);
  try{return JSON.parse(jsonStr);}catch(e2){}
  console.error("Raw response:",text.substring(0,500));
  const fixRes=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:"This JSON has syntax errors. Fix it and return ONLY valid JSON, nothing else:\n\n"+text.substring(0,8000)}]})
  });
  const fixData=await fixRes.json();
  let fixText=fixData.content?.[0]?.text||"";
  fixText=fixText.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
  const fixMatch=fixText.match(regex);
  if(!fixMatch)throw new Error("Could not fix JSON");
  return JSON.parse(fixMatch[0]);
}
const RENO_WH={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=representation"};

// ═══ CURRENCY ═══
function $r(n){if(n==null)return"—";const v=Number(n);if(isNaN(v))return"—";return v%1!==0?"$"+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"$"+v.toLocaleString();}

// ═══ TAB INJECTION ═══
const _origRD=renderDashboard;
renderDashboard=function(){_origRD();injectRenoTab();if(view==="renovation")renderRenoView();};
const _origSV=setView;
setView=function(v){if(v==="renovation"){view="renovation";renderDashboard();return;}_origSV(v);};

function getRenoDeals(){return deals.filter(d=>RENO_QUALIFYING.includes(d.status));}

function injectRenoTab(){
  // Update bottom nav reno health dot
  const dot=document.getElementById("renoDot");if(!dot)return;
  const rd=getRenoDeals();
  if(!rd.length||!renoOv){dot.style.display="none";return;}
  const h=renoOv.budget_health;
  dot.style.display="block";
  dot.style.background=h==="over_budget"?"#ef4444":h==="warning"?"#eab308":"#22c55e";
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
  const tkOpen=renoTasks.filter(t=>t.status!=='done').length;
  html+=`<div class="reno-pills"><button class="reno-pill${renoSub==="budget"?" active":""}" onclick="switchRenoSub('budget')">Budget</button><button class="reno-pill${renoSub==="draws"?" active":""}" onclick="switchRenoSub('draws')">Draws</button><button class="reno-pill${renoSub==="expenses"?" active":""}" onclick="switchRenoSub('expenses')">Expenses</button><button class="reno-pill${renoSub==="tasks"?" active":""}" onclick="switchRenoSub('tasks')">Tasks${tkOpen?' ('+tkOpen+')':''}</button></div>`;
  // Content placeholder
  html+=`<div id="renoContent"><div style="text-align:center;padding:40px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div></div></div>`;
  html+='</div>';
  document.getElementById("listArea").innerHTML=html;
  // Ensure renoModal exists in DOM
  if(!document.getElementById("renoModal")){
    const md=document.createElement("div");
    md.id="renoModal";
    md.className="overlay";
    md.style.display="none";
    md.onclick=function(){}; // Backdrop click disabled — use X button to close
    document.body.appendChild(md);
  }
  await loadRenoData(renoDealId);
  renderRenoSub();
}

async function loadRenoData(did){
  console.log("[SH] loadRenoData called with deal_id:",did,"(type:"+typeof did+")");
  console.log("[SH] SOW fetch URL:",SB+"/rest/v1/renovation_sow_lines?deal_id=eq."+did+"&order=line_number");
  try{
    const[ov,bl,ds,dr,ex,sw,di]=await Promise.all([
      sb("renovation_deal_overview?deal_id=eq."+did),
      sb("renovation_budget_summary?deal_id=eq."+did+"&order=line_number"),
      sb("renovation_draw_summary?deal_id=eq."+did),
      sb("renovation_draws?deal_id=eq."+did+"&order=draw_number"),
      sb("renovation_expenses?deal_id=eq."+did+"&order=expense_date.desc&select=*,renovation_sow_lines(line_number,category,description)"),
      sb("renovation_sow_lines?deal_id=eq."+did+"&order=line_number"),
      sb("deals?id=eq."+did+"&select=id,address,status,coe_date,contracted_reno_amount,contracted_reno_contractor,lender_name,lender_max_draws,lender_holdback_pct,lender_draw_fee,lender_loan_number,lender_draw_turnaround_days,lender_draws_email,lender_change_order_email,reno_budget")
    ]);
    renoOv=Array.isArray(ov)&&ov.length?ov[0]:null;
    renoBLines=Array.isArray(bl)?bl:[];
    renoDS=Array.isArray(ds)&&ds.length?ds[0]:null;
    renoDraws=Array.isArray(dr)?dr:[];
    renoExp=Array.isArray(ex)?ex:[];
    renoSOW=Array.isArray(sw)?sw:[];
    renoDeal=Array.isArray(di)&&di.length?di[0]:null;
    console.log("[SH] renoSOW loaded:",renoSOW.length,"lines, raw sw:",JSON.stringify(sw).substring(0,200));
  }catch(e){console.error("[SH] Reno load error:",e);}
  // Financing fetch is non-fatal — don't let it break the core data
  try{
    const fi=await sb("deal_financing?deal_id=eq."+did);
    renoFin=Array.isArray(fi)&&fi.length?fi[0]:null;
  }catch(e){console.error("[SH] Financing load error (non-fatal):",e);renoFin=null;}
  // Tasks fetch
  try{
    const tk=await sb("deal_tasks?deal_id=eq."+did+"&order=sort_order,created_at");
    renoTasks=Array.isArray(tk)?tk:[];
  }catch(e){console.error("[SH] Tasks load error (non-fatal):",e);renoTasks=[];}
}

function switchRenoDeal(did){renoDealId=did;renoSub="budget";renoExpandedLine=null;renderRenoView();}
function switchRenoSub(s){renoSub=s;renoExpandedLine=null;renderRenoSub();}

function renderRenoSub(){
  const el=document.getElementById("renoContent");if(!el)return;
  document.querySelectorAll(".reno-pill").forEach(p=>{p.classList.toggle("active",p.textContent.toLowerCase().startsWith(renoSub));});
  if(renoSub==="budget")renderBudget(el);
  else if(renoSub==="draws")renderDrawsV(el);
  else if(renoSub==="expenses")renderExpV(el);
  else if(renoSub==="tasks")renderTasksV(el);
}

// ═══ BUDGET VIEW ═══
function renderBudget(el){
  const ov=renoOv;
  if(!ov&&!renoBLines.length){el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No scope of work loaded for this deal.</div></div>`;return;}

  const contractedBudget=renoDeal?.contracted_reno_amount||null;
  const tb=contractedBudget||ov?.total_planned_budget||0;
  const ts=ov?.total_spent||0,rem=tb-ts;
  const pct=tb>0?(ts/tb*100):0;
  const sc=pct>100?"#ef4444":pct>80?"#eab308":"#22c55e";
  const rc=rem<0?"#ef4444":"#22c55e";
  let h='';

  // Task warning bar
  const urgTasks=renoTasks.filter(t=>t.status!=='done'&&t.priority==='urgent').length;
  const now=new Date();now.setHours(0,0,0,0);
  const overdueTasks=renoTasks.filter(t=>t.status!=='done'&&t.due_date&&new Date(t.due_date+"T00:00:00")<now).length;
  if(urgTasks||overdueTasks){
    const parts=[];if(urgTasks)parts.push(urgTasks+" urgent task"+(urgTasks>1?"s":""));if(overdueTasks)parts.push(overdueTasks+" overdue");
    h+=`<div onclick="switchRenoSub('tasks')" style="padding:8px 12px;border-radius:10px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.15);margin-bottom:10px;cursor:pointer;font-size:12px;color:#f97316;font-weight:600">⚠️ ${parts.join(" · ")} → Tasks tab</div>`;
  }

  // Big Three
  const tla=ov?.total_lender_approved||0;
  h+=`<div class="reno-hero"><div class="reno-hcard"><div class="reno-hl">TOTAL BUDGET</div><div class="reno-hv">${$r(tb)}</div>${tla&&tla!==tb?`<div style="font-size:10px;color:#64748b;margin-top:2px">Lender: ${$r(tla)}</div>`:''}${contractedBudget?`<div style="font-size:10px;color:rgba(212,175,55,0.6);margin-top:2px">Contracted: ${esc(renoDeal?.contracted_reno_contractor||"—")}</div>`:''}</div><div class="reno-hcard"><div class="reno-hl">TOTAL SPENT</div><div class="reno-hv" style="color:${sc}">${$r(ts)}</div></div><div class="reno-hcard"><div class="reno-hl">REMAINING</div><div class="reno-hv" style="color:${rc}">${$r(rem)}</div></div></div>`;

  // Progress bar
  h+=`<div class="reno-pbar"><div class="reno-pfill" style="width:${Math.min(pct,100)}%;background:${sc}"></div></div><div style="text-align:right;font-size:10px;color:#64748b;margin-top:4px;margin-bottom:8px">${pct.toFixed(1)}% spent</div>`;

  // Hold Period & Burn card
  if(renoDeal&&["in_renovation","renovation_complete","listed","sold"].includes(renoDeal.status)){
    const _coe=renoDeal.coe_date?new Date(renoDeal.coe_date+"T00:00:00"):null;
    const _today=new Date();_today.setHours(0,0,0,0);
    const _elapsed=_coe?Math.floor((_today-_coe)/864e5):null;
    const _holdMax=240;
    const _holdPct=_elapsed!=null?Math.min(_elapsed/_holdMax*100,100):0;
    const _holdColor=_elapsed==null?"#64748b":_elapsed>210?"#ef4444":_elapsed>=180?"#eab308":"#22c55e";
    const _fp=renoFin?.funded_principal||0;
    const _ir=renoFin?.interest_rate||0;
    const _intAccrued=_elapsed!=null&&_fp&&_ir?Math.round(_fp*_ir/100/365*_elapsed):null;
    const _intBudget=_fp&&_ir?Math.round(_fp*_ir/100/12*8):null;
    const _intPct=_intAccrued!=null&&_intBudget?Math.min(_intAccrued/_intBudget*100,100):0;
    const _intColor=_intPct>90?"#ef4444":_intPct>70?"#eab308":"#22c55e";
    const _drawSum=renoDraws.filter(d=>d.status==="disbursed").reduce((a,d)=>a+(d.amount_received||d.amount_requested||0),0);
    const _expSum=renoExp.reduce((a,e)=>a+(e.amount||0),0);
    const _burnPct=tb>0?Math.min((_drawSum+_expSum)/tb*100,100):0;
    const _burnColor=_burnPct>90?"#ef4444":_burnPct>70?"#eab308":"#22c55e";
    const _matDate=renoFin?.maturity_date?new Date(renoFin.maturity_date+"T00:00:00"):null;
    const _matDays=_matDate?Math.ceil((_matDate-_today)/864e5):null;
    const _matColor=_matDays==null?"#64748b":_matDays<60?"#ef4444":_matDays<90?"#eab308":"#22c55e";
    h+=`<div style="margin:12px 0 16px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">`;
    h+=`<div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#d4af37;margin-bottom:10px">HOLD PERIOD & BURN</div>`;
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">`;
    // Days Elapsed
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">DAYS ELAPSED</div><div style="font-size:17px;font-weight:800;color:${_holdColor};margin-top:2px">${_elapsed!=null?_elapsed:"—"}</div></div>`;
    // Hold Progress
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">HOLD PROGRESS</div><div style="margin-top:4px"><div class="reno-pbar" style="height:6px"><div class="reno-pfill" style="width:${_holdPct}%;background:${_holdColor}"></div></div><div style="font-size:10px;color:${_holdColor};font-weight:700;margin-top:2px">${_elapsed!=null?Math.round(_holdPct)+"%":"—"}</div></div></div>`;
    // Interest Accrued
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">INTEREST ACCRUED</div><div style="font-size:17px;font-weight:800;color:${_intAccrued!=null?"#f59e0b":"#64748b"};margin-top:2px">${_intAccrued!=null?$r(_intAccrued):"—"}</div></div>`;
    // Interest Budget
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">INTEREST BUDGET</div><div style="font-size:17px;font-weight:800;color:${_intColor};margin-top:2px">${_intBudget!=null?$r(_intBudget):"—"}</div>${_intAccrued!=null&&_intBudget?`<div class="reno-pbar" style="height:4px;margin-top:4px"><div class="reno-pfill" style="width:${_intPct}%;background:${_intColor}"></div></div>`:""}</div>`;
    // Budget Consumed
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">BUDGET CONSUMED</div><div style="margin-top:4px"><div class="reno-pbar" style="height:6px"><div class="reno-pfill" style="width:${_burnPct}%;background:${_burnColor}"></div></div><div style="font-size:10px;color:${_burnColor};font-weight:700;margin-top:2px">${_burnPct.toFixed(1)}%</div></div></div>`;
    // Maturity Countdown
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">MATURITY</div><div style="font-size:17px;font-weight:800;color:${_matColor};margin-top:2px">${_matDays!=null?_matDays+"d":"—"}</div></div>`;
    h+=`</div></div>`;
  }

  // Maturity countdown bar (if financing data exists)
  if(renoFin&&renoFin.funded_date){
    const msFunded=((Date.now()-new Date(renoFin.funded_date+"T00:00:00").getTime())/(864e5*30.44));
    const msUntilMat=renoFin.maturity_date?((new Date(renoFin.maturity_date+"T00:00:00").getTime()-Date.now())/(864e5*30.44)):null;
    const matBarColor=msUntilMat===null?'#3b82f6':msUntilMat<2?'#ef4444':msUntilMat<4?'#eab308':'#22c55e';
    const totalMonths=renoFin.loan_term_months||(msFunded+(msUntilMat||0));
    const holdPct=totalMonths>0?Math.min(msFunded/totalMonths*100,100):0;
    h+=`<div class="fin-hold-bar" style="border-color:${matBarColor}30;background:${matBarColor}08">`;
    h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:${matBarColor}">HOLD PERIOD</span>`;
    h+=`<span style="font-size:10px;color:#64748b">Funded ${new Date(renoFin.funded_date+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"})}</span></div>`;
    h+=`<div class="reno-pbar" style="margin-bottom:6px"><div class="reno-pfill" style="width:${holdPct}%;background:${matBarColor}"></div></div>`;
    h+=`<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700">`;
    h+=`<span style="color:#94a3b8">${msFunded.toFixed(1)} months elapsed</span>`;
    if(msUntilMat!==null)h+=`<span style="color:${matBarColor}">${msUntilMat.toFixed(1)} months until maturity</span>`;
    h+=`</div></div>`;
  }

  // Secondary metrics (use financing data when available)
  const la=renoFin?.rehab_holdback||ov?.total_lender_approved||0;
  const rb2=ov?.total_reimbursed||0,ue=ov?.unreimbursed_exposure||0,du=ov?.draws_used||0;
  const md=renoFin?.max_draws||renoDeal?.lender_max_draws||"?";
  const ueBg=ue>50000?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.02)";
  const ueBr=ue>50000?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)";
  h+=`<div class="reno-sgrid">`;
  h+=`<div class="reno-scard"><div class="reno-sl">${renoFin?.rehab_holdback?'REHAB HOLDBACK':'LENDER APPROVED'}</div><div class="reno-sv">${$r(la)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">REIMBURSED</div><div class="reno-sv" style="color:#22c55e">${$r(rb2)}</div></div>`;
  h+=`<div class="reno-scard" style="background:${ueBg};border-color:${ueBr}"><div class="reno-sl">UNREIMBURSED</div><div class="reno-sv" style="color:${ue>50000?"#ef4444":"#f1f5f9"}">${$r(ue)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">DRAWS USED</div><div class="reno-sv">${du} / ${md}</div></div>`;
  h+=`</div>`;

  // LOC Exposure card
  const _locKiavi=renoFin?.rehab_holdback||ov?.total_lender_approved||0;
  const _locPlanned=renoDeal?.contracted_reno_amount||ov?.total_planned_budget||0;
  const _locGap=Math.max(_locPlanned-_locKiavi,0);
  const _locLimit=renoFin?.loc_limit||0;
  const _locHead=_locLimit-_locGap;
  if(_locGap>0||_locLimit>0){
    const _gapColor=_locGap>0?"#f59e0b":"#22c55e";
    const _headColor=_locHead>=100000?"#22c55e":_locHead>=50000?"#eab308":"#ef4444";
    h+=`<div style="margin:12px 0 16px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">`;
    h+=`<div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#d4af37;margin-bottom:10px">LOC EXPOSURE</div>`;
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">KIAVI APPROVED</div><div style="font-size:15px;font-weight:800;color:#f1f5f9;margin-top:2px">${$r(_locKiavi)}</div></div>`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">PLANNED BUDGET</div><div style="font-size:15px;font-weight:800;color:#f1f5f9;margin-top:2px">${$r(_locPlanned)}</div></div>`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">COVERAGE GAP</div><div style="font-size:15px;font-weight:800;color:${_gapColor};margin-top:2px">${$r(_locGap)}</div></div>`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">LOC LIMIT</div><div style="font-size:15px;font-weight:800;color:#f1f5f9;margin-top:2px">${_locLimit?$r(_locLimit):"Not set"}</div></div>`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">LOC DRAWN</div><div style="font-size:15px;font-weight:800;color:${_gapColor};margin-top:2px">${$r(_locGap)}</div></div>`;
    h+=`<div style="text-align:center"><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">LOC HEADROOM</div><div style="font-size:15px;font-weight:800;color:${_locLimit?_headColor:"#64748b"};margin-top:2px">${_locLimit?$r(_locHead):"—"}</div></div>`;
    h+=`</div></div>`;
  }

  // Monthly interest card (if financing data has monthly payment)
  if(renoFin?.monthly_interest_payment){
    h+=`<div class="reno-scard" style="margin-bottom:16px;text-align:left;padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="reno-sl">MONTHLY INTEREST</div><div class="reno-sv" style="color:#f59e0b;font-size:18px">${$r(renoFin.monthly_interest_payment)}</div></div><button onclick="openFinancing('${renoDealId}')" style="background:none;border:1px solid rgba(6,182,212,0.2);border-radius:8px;padding:6px 12px;color:#22d3ee;font-size:10px;font-weight:700;cursor:pointer">💰 Financing</button></div></div>`;
  } else {
    // Just show the financing button if no monthly payment
    h+=`<div style="margin-bottom:12px;text-align:right"><button onclick="openFinancing('${renoDealId}')" class="btn" style="padding:8px 20px;font-size:12px;background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.15);color:#22d3ee;font-weight:700;min-height:auto">💰 Financing</button></div>`;
  }

  // Lender info collapsible (Bug 2)
  if(renoDeal){
    const di=renoDeal;
    h+=`<div style="margin-bottom:16px"><button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.nextElementSibling.style.display==='none'?'ℹ️ Lender Terms':'ℹ️ Lender Terms ▾'" style="background:none;border:none;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;padding:4px 0">ℹ️ Lender Terms</button>`;
    h+=`<div style="display:none;margin-top:8px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);font-size:12px">`;
    if(di.lender_name)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Lender</span><span style="color:#e2e8f0;font-weight:600">${esc(di.lender_name)}</span></div>`;
    if(di.lender_loan_number)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Loan #</span><span style="color:#e2e8f0">${esc(di.lender_loan_number)}</span></div>`;
    h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Max Draws</span><span style="color:#e2e8f0">${di.lender_max_draws||"—"}</span></div>`;
    if(di.lender_holdback_pct!=null)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Holdback</span><span style="color:#e2e8f0">${di.lender_holdback_pct}% (final ${100-di.lender_holdback_pct}% held until project complete)</span></div>`;
    if(di.lender_draw_fee)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Draw Fee</span><span style="color:#e2e8f0">${$r(di.lender_draw_fee)}/draw</span></div>`;
    if(di.lender_draw_turnaround_days)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Draw Turnaround</span><span style="color:#e2e8f0">~${di.lender_draw_turnaround_days} days</span></div>`;
    if(di.lender_draws_email)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#64748b">Draws Email</span><a href="mailto:${esc(di.lender_draws_email)}" style="color:#60a5fa;text-decoration:none">${esc(di.lender_draws_email)}</a></div>`;
    if(di.lender_change_order_email)h+=`<div style="display:flex;justify-content:space-between;padding:5px 0"><span style="color:#64748b">Change Orders</span><a href="mailto:${esc(di.lender_change_order_email)}" style="color:#60a5fa;text-decoration:none">${esc(di.lender_change_order_email)}</a></div>`;
    h+=`</div></div>`;
  }

  // SOW action buttons + table
  h+=`<div style="margin-top:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">SCOPE OF WORK</div><div style="display:flex;gap:6px"><button onclick="event.stopPropagation();openSOWUpload()" class="btn" style="padding:6px 14px;font-size:11px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:700;min-height:32px">📄 Upload Lender SOW</button><button onclick="event.stopPropagation();openAddLineForm()" class="btn" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-weight:700;min-height:32px">+ Add Line</button><button onclick="exportCPAReport()" class="btn" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-weight:700;min-height:32px">📊 CPA Report</button></div></div>`;
  h+=`<div id="sowUploadArea"></div><div id="sowAddLineArea"></div>`;
  const fl=renoBLines.filter(l=>l.lender_approved>0||l.planned_budget>0||l.total_spent>0);
  if(fl.length){
    h+=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>#</th><th>Category</th><th>Description</th><th class="reno-hm">Approved</th><th>Planned</th><th>Spent</th><th class="reno-hm">Drawn</th><th>Remaining</th><th>Status</th></tr></thead><tbody>`;
    fl.forEach(l=>{
      const cc=RENO_CAT_COLORS[(l.category||"").toLowerCase()]||"#64748b";
      const stc=RENO_STAT_COLORS[l.status]||"#64748b";
      const pb=l.planned_budget||0,sp=l.total_spent||0,la2=l.lender_approved||0,rb3=l.remaining_budget||0;
      const rmc=rb3<0?"#ef4444":pb>0&&sp/pb>0.8?"#eab308":"#22c55e";
      const oopDot=pb>la2&&la2>0?`<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#f59e0b;margin-left:4px;vertical-align:middle" title="Out-of-pocket"></span>`:'';
      const exp=renoExpandedLine===l.sow_line_id;
      h+=`<tr class="reno-r${exp?" expanded":""}" onclick="toggleLineExp('${l.sow_line_id}')"><td style="color:#64748b">${l.line_number}</td><td><span class="reno-chip" style="color:${cc};background:${cc}15;border:1px solid ${cc}30">${esc((l.category||"").replace(/_/g," "))}</span></td><td style="font-weight:600;color:#e2e8f0">${esc(l.description||"")}</td><td class="reno-hm" style="text-align:right">${$r(la2)}</td><td style="text-align:right">${$r(pb)}${oopDot}</td><td style="text-align:right;font-weight:700">${$r(sp)}</td><td class="reno-hm" style="text-align:right">${$r(l.total_drawn)}</td><td style="text-align:right;color:${rmc};font-weight:700">${$r(rb3)}</td><td><span class="reno-chip" style="color:${stc};background:${stc}15;border:1px solid ${stc}30">${(l.status||"not_started").replace(/_/g," ")}</span></td></tr>`;
      if(exp)h+=`<tr class="reno-xrow"><td colspan="9" id="renoLX_${l.sow_line_id}"><div style="padding:8px 0;color:#64748b;font-size:11px">Loading...</div></td></tr>`;
    });
    h+=`</tbody></table></div></div>`;
  }

  // Out of Pocket
  if(tb>la&&la>0){
    const oop=tb-la;
    const csb=renoFin?.cash_source_breakdown;
    const fundSrcs=[];if(csb?.cash)fundSrcs.push("Cash");if(csb?.loc)fundSrcs.push("LOC");if(csb?.commission_credit)fundSrcs.push("Lisa Commission");
    h+=`<div class="reno-oop"><div style="font-size:9px;color:#f59e0b;font-weight:700;letter-spacing:1.5px;margin-bottom:6px">OUT-OF-POCKET SUMMARY</div><div class="reno-oop-r"><span>Total Planned</span><span>${$r(tb)}</span></div><div class="reno-oop-r"><span>Lender Covers</span><span>${$r(la)}</span></div><div class="reno-oop-r reno-oop-t"><span>Your Out-of-Pocket</span><span style="color:#f59e0b">${$r(oop)}</span></div>${fundSrcs.length?`<div style="font-size:10px;color:#64748b;margin-top:6px">Funded by: ${fundSrcs.join(" + ")}</div>`:''}</div>`;
  }
  el.innerHTML=h;
  if(renoExpandedLine)loadLineExp(renoExpandedLine);
}

async function toggleLineExp(lid){renoExpandedLine=renoExpandedLine===lid?null:lid;renderRenoSub();}

async function loadLineExp(lid){
  const c=document.getElementById("renoLX_"+lid);if(!c)return;
  const sowLine=renoSOW.find(s=>s.id===lid)||renoBLines.find(s=>s.id===lid);
  try{
    const[ex,dl]=await Promise.all([
      sb("renovation_expenses?sow_line_id=eq."+lid+"&order=expense_date.desc"),
      sb("renovation_draw_lines?sow_line_id=eq."+lid+"&select=*,renovation_draws(draw_number,status,date_submitted,date_disbursed)").catch(()=>[])
    ]);
    let h=`<div class="reno-exp-grid">`;

    // Part A — Edit This Line
    h+=`<div class="reno-exp-col">`;
    h+=`<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:6px">EDIT LINE</div>`;
    if(sowLine){
      const laRef=sowLine.lender_approved||0,pbVal=sowLine.planned_budget||0;
      h+=`<div class="fld" style="margin-bottom:6px"><label>PLANNED BUDGET</label><input type="number" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${pbVal||""}" onblur="saveSOWField('${lid}','planned_budget',Number(this.value))" onkeydown="if(event.key==='Enter'){this.blur()}"/><div style="font-size:9px;color:#64748b;margin-top:2px">Lender approved: ${$r(laRef)}</div>${pbVal>laRef&&laRef>0?`<div style="font-size:9px;color:#f59e0b;margin-top:1px">Out-of-pocket: ${$r(pbVal-laRef)}</div>`:''}</div>`;
      h+=`<div class="fld" style="margin-bottom:6px"><label>STATUS</label><select class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" onchange="saveSOWField('${lid}','status',this.value)"><option value="not_started"${sowLine.status==="not_started"?" selected":""}>Not Started</option><option value="in_progress"${sowLine.status==="in_progress"?" selected":""}>In Progress</option><option value="complete"${sowLine.status==="complete"?" selected":""}>Complete</option><option value="change_order"${sowLine.status==="change_order"?" selected":""}>Change Order</option></select></div>`;
      h+=`<div class="fld" style="margin-bottom:0"><label>NOTES</label><input type="text" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${esc(sowLine.notes||"")}" placeholder="Add notes for this line item..." onblur="saveSOWField('${lid}','notes',this.value)" onkeydown="if(event.key==='Enter'){this.blur()}"/></div>`;
      h+=`<button onclick="event.stopPropagation();deleteSOWLine('${lid}')" style="margin-top:8px;background:none;border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:6px 12px;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer">Delete This Line</button>`;
    }else{
      h+=`<div style="color:#475569;font-size:11px">Line data not loaded.</div>`;
    }
    h+=`</div>`;

    // Part B — Expenses For This Line
    h+=`<div class="reno-exp-col">`;
    h+=`<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:6px">EXPENSES</div>`;
    if(Array.isArray(ex)&&ex.length){
      let exTotal=0;
      h+=`<div class="reno-lx">`;
      ex.forEach(e=>{
        const tc=EXP_TYPE_COLORS[e.expense_type]||"#94a3b8";
        exTotal+=e.amount||0;
        h+=`<div class="reno-lx-row"><span style="color:#64748b;min-width:52px;font-size:10px">${e.expense_date?new Date(e.expense_date+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"2-digit",timeZone:"America/Los_Angeles"}):"—"}</span><span style="color:#94a3b8;min-width:70px;font-size:10px">${esc(e.vendor_name||"—")}</span><span style="flex:1;color:#e2e8f0;font-size:10px">${esc(e.description||"")}</span><span style="font-weight:700;min-width:65px;text-align:right;font-size:10px">${$r(e.amount)}</span><span><span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30">${e.expense_type||"other"}</span></span></div>`;
      });
      h+=`</div><div style="font-size:11px;font-weight:700;color:#f1f5f9;margin-top:4px">Total: ${$r(exTotal)}</div>`;
    }else{
      h+=`<div style="color:#475569;font-size:11px">No expenses yet</div>`;
    }
    h+=`<button onclick="event.stopPropagation();renoSub='expenses';renoExpF.sow='${lid}';renderRenoSub()" style="background:none;border:none;color:#60a5fa;font-size:10px;font-weight:700;cursor:pointer;padding:4px 0;margin-top:6px">+ Add Expense</button>`;
    h+=`</div>`;

    // Part C — Draw History For This Line
    h+=`<div class="reno-exp-col">`;
    h+=`<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:6px">DRAW HISTORY</div>`;
    const draws=Array.isArray(dl)?dl:[];
    if(draws.length){
      draws.forEach(d=>{
        const dr=d.renovation_draws||{};
        const dsc=RENO_STAT_COLORS[dr.status]||"#64748b";
        h+=`<div class="reno-lx-row"><span style="color:#e2e8f0;font-weight:700;font-size:10px;min-width:55px">Draw #${dr.draw_number||"?"}</span><span style="font-weight:700;font-size:10px;min-width:65px;text-align:right">${$r(d.amount)}</span><span><span class="reno-chip" style="color:${dsc};background:${dsc}15;border:1px solid ${dsc}30">${(dr.status||"—").replace(/_/g," ")}</span></span>${dr.date_submitted?`<span style="color:#64748b;font-size:9px">${new Date(dr.date_submitted+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"America/Los_Angeles"})}</span>`:''}</div>`;
      });
    }else{
      h+=`<div style="color:#475569;font-size:11px">Not drawn yet</div>`;
    }
    h+=`</div>`;

    h+=`</div>`;
    c.innerHTML=h;
  }catch(e){c.innerHTML=`<div style="padding:12px;color:#ef4444;font-size:11px">Failed to load line details.</div>`;}
}

async function saveSOWField(lid,field,value){
  const patch={};patch[field]=field==='planned_budget'?(value||0):(value||null);
  try{
    const res=await fetch(SB+"/rest/v1/renovation_sow_lines?id=eq."+lid,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    if(!res.ok){showRenoToast("Failed to save");return;}
    const s=renoSOW.find(x=>x.id===lid);if(s)s[field]=value;
    showRenoToast(field.replace(/_/g," ")+" saved");
    await loadRenoData(renoDealId);
    const el=document.getElementById("renoContent");if(el&&renoSub==="budget")renderBudget(el);
  }catch(e){console.error("Save SOW field failed:",e);showRenoToast("Failed to save");}
}

// ═══ DRAWS VIEW ═══
function renderDrawsV(el){
  const ds=renoDS,md=renoFin?.max_draws||renoDeal?.lender_max_draws||"?";
  let h='';
  h+=`<div class="reno-sgrid"><div class="reno-scard"><div class="reno-sl">TOTAL DRAWN</div><div class="reno-sv">${$r(ds?.total_requested)}</div></div><div class="reno-scard"><div class="reno-sl">TOTAL RECEIVED</div><div class="reno-sv" style="color:#22c55e">${$r(ds?.total_received)}</div></div><div class="reno-scard"><div class="reno-sl">AVG REIMBURSEMENT</div><div class="reno-sv">${ds?.avg_days_to_reimburse?Math.round(ds.avg_days_to_reimburse)+" days":"—"}</div></div><div class="reno-scard"><div class="reno-sl">DRAWS REMAINING</div><div class="reno-sv">${ds?.draws_remaining!=null?ds.draws_remaining:"—"} / ${md}</div></div></div>`;

  h+=`<div style="margin:16px 0"><button onclick="openNewDraw()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">+ New Draw</button></div>`;

  if(!renoDraws.length){
    h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📄</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No draws submitted yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Start your first draw when work is complete and ready for inspection.</div></div>`;
  } else {
    renoDraws.forEach(d=>{h+=renderDC(d);});
  }
  el.innerHTML=h;
  // Lazy-load SOW line breakdowns into each draw card
  renoDraws.forEach(d=>{loadDrawLines(d.id);});
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
    h+=`<div class="reno-ps" style="cursor:pointer" onclick="openDrawUpdateTo('${d.id}','${s.key}','${s.df}',${i})"><div class="reno-pd${done?" done":""}${cur?" cur":""}">${done?"✓":""}</div><div class="reno-pl">${s.label}</div></div>`;
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

  // SOW line breakdown placeholder (loaded async)
  h+=`<div id="drawLines_${d.id}" style="margin-top:8px"></div>`;
  h+=`</div>`;

  if(d.status!=="disbursed")h+=`<button onclick="openDrawUpdate('${d.id}',${cs})" class="btn" style="width:100%;margin-top:12px;padding:10px;font-size:12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-weight:700">Update Status</button>`;

  // Delete button
  h+=`<button onclick="deleteDraw('${d.id}',${d.draw_number})" style="width:100%;margin-top:8px;padding:10px;font-size:11px;background:none;border:none;color:#ef4444;font-weight:700;cursor:pointer;opacity:0.7;transition:opacity .2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">Delete Draw #${d.draw_number}</button>`;

  h+=`</div>`;
  return h;
}

async function openDrawUpdateTo(drawId,statusKey,dateField,stepIndex){
  const dr=renoDraws.find(d=>d.id===drawId);if(!dr)return;
  const label=DRAW_PIPE[stepIndex]?.label||statusKey;
  const m=document.getElementById("renoModal");
  let h=`<div class="sheet" style="position:relative;max-height:80vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">SET DRAW STATUS</div>`;
  h+=`<div style="font-size:16px;font-weight:800;margin-bottom:16px">Draw #${dr.draw_number} → ${label}</div>`;
  h+=`<div class="fld"><label>${label.toUpperCase()} DATE</label><input id="dsDate" type="date" class="cinput" value="${new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}"/></div>`;
  if(statusKey==="disbursed"){
    h+=`<div class="fld"><label>AMOUNT RECEIVED</label><input id="dsAmt" type="number" class="cinput" value="${(dr.amount_requested||0)-(dr.draw_fee||0)}" placeholder="Net amount after fee"/></div>`;
  }
  h+=`<button onclick="saveDrawDirect('${drawId}','${statusKey}','${dateField}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Set to ${label}</button>`;
  h+=`</div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function saveDrawDirect(drawId,statusKey,dateField){
  const dv=document.getElementById("dsDate")?.value;if(!dv)return;
  const dr=renoDraws.find(d=>d.id===drawId);
  const patch={status:statusKey};
  patch[dateField]=dv;
  if(statusKey==="disbursed"){
    const amt=Number(document.getElementById("dsAmt")?.value);if(amt)patch.amount_received=amt;
    if(dr?.date_submitted){patch.days_to_reimburse=Math.round((new Date(dv)-new Date(dr.date_submitted))/(864e5));}
  }
  try{
    await fetch(SB+"/rest/v1/renovation_draws?id=eq."+drawId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    closeRenoModal();showRenoToast("Draw updated to "+statusKey.replace(/_/g," "));
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Draw direct update failed:",e);showRenoToast("Failed to update draw");}
}

async function loadDrawLines(drawId){
  const el=document.getElementById("drawLines_"+drawId);if(!el)return;
  try{
    const lines=await sb("renovation_draw_lines?draw_id=eq."+drawId+"&select=*,renovation_sow_lines(line_number,description,lender_approved)");
    if(!Array.isArray(lines)||!lines.length){el.innerHTML="";return;}
    let h=`<div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px;margin-bottom:4px">SOW LINES IN THIS DRAW</div>`;
    lines.forEach(l=>{
      const s=l.renovation_sow_lines||{};
      h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px"><span style="color:#94a3b8">#${s.line_number||"?"} — ${esc(s.description||"Unknown")}</span><span style="font-weight:700;color:#e2e8f0">${$r(l.amount)}</span></div>`;
    });
    el.innerHTML=h;
  }catch(e){console.error("Load draw lines failed:",e);}
}

async function deleteDraw(drawId,drawNum){
  if(!confirm("Delete Draw #"+drawNum+"? This cannot be undone."))return;
  try{
    await fetch(SB+"/rest/v1/renovation_draw_lines?draw_id=eq."+drawId,{method:"DELETE",headers:RENO_WH});
    await fetch(SB+"/rest/v1/renovation_draws?id=eq."+drawId,{method:"DELETE",headers:RENO_WH});
    showRenoToast("Draw #"+drawNum+" deleted");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Delete draw failed:",e);showRenoToast("Failed to delete draw");}
}

function fmtDate(d){if(!d)return"—";return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"});}

// ═══ DRAW STATUS UPDATE ═══
async function openDrawUpdate(drawId,cs){
  const dr=renoDraws.find(d=>d.id===drawId);if(!dr)return;
  const ns=DRAW_PIPE[cs];if(!ns)return;
  const m=document.getElementById("renoModal");
  let h=`<div class="sheet" style="position:relative;max-height:80vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">UPDATE DRAW STATUS</div>`;
  h+=`<div style="font-size:16px;font-weight:800;margin-bottom:16px">Draw #${dr.draw_number} → ${ns.label}</div>`;
  h+=`<div class="fld"><label>${ns.label.toUpperCase()} DATE</label><input id="dsDate" type="date" class="cinput" value="${new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}"/></div>`;
  if(ns.key==="disbursed")h+=`<div class="fld"><label>AMOUNT RECEIVED</label><input id="dsAmt" type="number" class="cinput" value="${(dr.amount_requested||0)-(dr.draw_fee||0)}" placeholder="Net amount received"/></div>`;
  h+=`<div class="fld"><label>AMOUNT REQUESTED</label><input id="dsAmt2" type="number" class="cinput" value="${dr.amount_requested||0}"/></div>`;
  h+=`<div class="fld"><label>DRAW FEE</label><input id="dsFee" type="number" class="cinput" value="${dr.draw_fee||0}"/></div>`;
  h+=`<div style="margin:12px 0;font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">DOCUMENTATION</div>`;
  h+=`<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">`;
  h+=renoToggle("dsInv","Invoices",!!dr.has_invoices);
  h+=renoToggle("dsLW","Lien Waivers",!!dr.has_lien_waivers);
  h+=renoToggle("dsDF","Draw Request Form",!!dr.has_draw_request_form);
  h+=renoToggle("dsInt","Interest Payments Current",!!dr.interest_payments_current);
  h+=`</div>`;
  h+=`<div class="fld"><label>NOTES</label><input id="dsNotes" type="text" class="cinput" value="${esc(dr.notes||"")}" placeholder="Notes"/></div>`;

  // Fetch and show SOW lines in this draw
  let drawLines=[];
  try{drawLines=await sb("renovation_draw_lines?draw_id=eq."+drawId+"&select=*,renovation_sow_lines(line_number,description,lender_approved)");}catch(e){}
  if(Array.isArray(drawLines)&&drawLines.length){
    h+=`<div style="margin:12px 0"><div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1.5px;margin-bottom:6px">SOW LINES IN THIS DRAW</div>`;
    let dlTotal=0;
    drawLines.forEach(l=>{
      const s=l.renovation_sow_lines||{};
      dlTotal+=l.amount||0;
      h+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">#${s.line_number||"?"} — ${esc(s.description||"Unknown")}</span><span style="font-weight:700;color:#e2e8f0">${$r(l.amount)}</span></div>`;
    });
    h+=`<div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:12px;font-weight:800"><span style="color:#64748b">Total</span><span style="color:#f1f5f9">${$r(dlTotal)}</span></div></div>`;
  }

  h+=`<button onclick="saveDrawUpdate('${drawId}','${ns.key}','${ns.df}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Save Status</button></div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function saveDrawUpdate(drawId,sk,df){
  const dv=document.getElementById("dsDate")?.value;if(!dv)return;
  const dr=renoDraws.find(d=>d.id===drawId);
  const patch={status:sk};patch[df]=dv;
  patch.amount_requested=Number(document.getElementById("dsAmt2")?.value)||dr?.amount_requested;
  patch.draw_fee=Number(document.getElementById("dsFee")?.value)||dr?.draw_fee;
  patch.has_invoices=!!document.getElementById("dsInv")?.checked;
  patch.has_lien_waivers=!!document.getElementById("dsLW")?.checked;
  patch.has_draw_request_form=!!document.getElementById("dsDF")?.checked;
  patch.interest_payments_current=!!document.getElementById("dsInt")?.checked;
  patch.notes=(document.getElementById("dsNotes")?.value||"").trim()||null;
  if(sk==="disbursed"){
    const amt=Number(document.getElementById("dsAmt")?.value);if(amt)patch.amount_received=amt;
    if(dr?.date_submitted){patch.days_to_reimburse=Math.round((new Date(dv)-new Date(dr.date_submitted))/(864e5));}
  }
  try{
    await fetch(SB+"/rest/v1/renovation_draws?id=eq."+drawId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    closeRenoModal();await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Draw update failed:",e);}
}

// ═══ NEW DRAW ═══
async function openNewDraw(){
  const nn=renoDraws.length+1,fee=renoFin?.draw_fee||renoDeal?.lender_draw_fee||0;
  // Fetch fresh SOW lines with lender approval
  let drawSOW=[];
  try{drawSOW=await sb("renovation_sow_lines?deal_id=eq."+renoDealId+"&order=line_number&lender_approved=gt.0");if(!Array.isArray(drawSOW))drawSOW=[];}catch(e){drawSOW=renoSOW.filter(l=>l.lender_approved>0);}
  const coEmail=renoDeal?.lender_change_order_email||"lender";
  const m=document.getElementById("renoModal");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">NEW DRAW</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">Draw #${nn}</div>`;
  h+=`<div class="fld"><label>AMOUNT REQUESTED</label><input id="ndAmt" type="number" class="cinput" placeholder="Auto-calculated from lines below"/></div>`;
  h+=`<div class="fld"><label>DRAW FEE</label><input id="ndFee" type="number" class="cinput" value="${fee}"/></div>`;

  h+=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:16px 0 8px">SOW LINE ITEMS IN THIS DRAW</div>`;
  if(!drawSOW.length){
    h+=`<div style="padding:12px;color:#475569;font-size:11px">No lender-approved SOW lines found.</div>`;
  }else{
    drawSOW.forEach(l=>{
      h+=`<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:4px">`;
      h+=`<span style="flex:1;font-size:12px;color:#e2e8f0">#${l.line_number} — ${esc(l.description||l.category||"")} <span style="color:#64748b;font-size:10px">(${$r(l.lender_approved)} approved)</span></span>`;
      h+=`<input type="number" id="ndLA_${l.id}" data-lid="${l.id}" data-cat="${l.category||""}" class="cinput ndLAmt" style="width:110px;min-height:36px;font-size:12px;padding:6px 8px" placeholder="Amount" oninput="ndRecalcTotal();chkContWarn()"/>`;
      h+=`</div>`;
    });
  }
  h+=`<div id="ndCWarn" style="display:none;margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);font-size:11px;color:#eab308">⚠️ Draws from contingency over $1,000 require a change order. Submit to <strong>${esc(coEmail)}</strong> before submitting this draw.</div>`;

  h+=`<div style="margin-top:16px;font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">DOCUMENTATION</div>`;
  h+=`<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">`;
  h+=renoToggle("ndInv","Invoices",false);
  h+=renoToggle("ndLW","Lien Waivers",false);
  h+=renoToggle("ndDF","Draw Request Form",false);
  h+=renoToggle("ndInt","Interest Payments Current",true);
  h+=`</div>`;
  h+=`<div style="font-size:10px;color:#64748b;margin-bottom:16px">⚠️ Lender will not disburse if monthly interest payments are delinquent.</div>`;
  h+=`<button onclick="saveNewDraw(${nn})" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Create Draw</button></div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

function renoToggle(id,label,checked){
  return`<label class="reno-tog"><span style="font-size:12px;color:#e2e8f0;flex:1">${label}</span><input type="checkbox" id="${id}" class="reno-tog-cb"${checked?" checked":""}/><span class="reno-tog-slider"></span></label>`;
}

function ndRecalcTotal(){
  let total=0;
  document.querySelectorAll(".ndLAmt").forEach(inp=>{
    total+=Number(inp.value)||0;
  });
  const el=document.getElementById("ndAmt");
  if(el&&total>0)el.value=total;
}

function chkContWarn(){
  const w=document.getElementById("ndCWarn");if(!w)return;
  let show=false;
  document.querySelectorAll(".ndLAmt").forEach(inp=>{
    const amt=Number(inp.value)||0;
    if(amt>1000&&(inp.dataset.cat||"").toLowerCase()==="contingency")show=true;
  });
  w.style.display=show?"block":"none";
}

async function saveNewDraw(num){
  const amt=Number(document.getElementById("ndAmt")?.value);
  if(!amt){alert("Enter an amount.");return;}
  const fee=Number(document.getElementById("ndFee")?.value)||0;
  const payload={draw_number:num,amount_requested:amt,draw_fee:fee,status:"preparing",date_prepared:new Date().toISOString().split("T")[0],has_invoices:!!document.getElementById("ndInv")?.checked,has_lien_waivers:!!document.getElementById("ndLW")?.checked,has_draw_request_form:!!document.getElementById("ndDF")?.checked,interest_payments_current:!!document.getElementById("ndInt")?.checked,deal_id:renoDealId};
  try{
    const res=await fetch(SB+"/rest/v1/renovation_draws",{method:"POST",headers:RENO_WH,body:JSON.stringify(payload)});
    const result=await res.json();
    const newId=Array.isArray(result)?result[0]?.id:result?.id;
    if(newId){
      const lp=[];
      document.querySelectorAll(".ndLAmt").forEach(inp=>{
        const la=Number(inp.value)||0;if(la>0)lp.push(fetch(SB+"/rest/v1/renovation_draw_lines",{method:"POST",headers:RENO_WH,body:JSON.stringify({draw_id:newId,sow_line_id:inp.dataset.lid,amount:la})}));
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
  // Receipt upload
  h+=`<div style="margin-bottom:12px"><button onclick="openReceiptUpload()" class="btn" style="width:100%;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">📸 Upload Receipt or Invoice</button></div>`;
  h+=`<div style="font-size:10px;color:#475569;text-align:center;margin-bottom:10px">Or enter manually below</div>`;
  // Quick entry form
  h+=`<div class="reno-ef"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">LOG EXPENSE</div><div class="reno-eg">`;
  h+=`<div class="fld"><label>DATE</label><input id="exD" type="date" class="cinput" value="${new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}"/></div>`;
  const sowFiltered=renoSOW.filter(l=>Number(l.lender_approved)>0||Number(l.planned_budget)>0);
  console.log("[SH] Expense SOW dropdown: renoSOW="+renoSOW.length+", filtered="+sowFiltered.length,renoSOW.slice(0,3));
  h+=`<div class="fld"><label>SOW LINE</label><select id="exS" class="cinput">`;
  sowFiltered.forEach(l=>{h+=`<option value="${l.id}">#${l.line_number} — ${esc(l.description||l.category||"")} (${$r(l.planned_budget||l.lender_approved||0)})</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld"><label>DESCRIPTION</label><input id="exDe" type="text" class="cinput" placeholder="What was purchased or paid for"/></div>`;
  h+=`<div class="fld"><label>AMOUNT</label><input id="exA" type="number" class="cinput" placeholder="$0.00" step="0.01"/></div>`;
  h+=`<div class="fld"><label>TYPE</label><select id="exT" class="cinput"><option value="material">Material</option><option value="labor">Labor</option><option value="permit">Permit</option><option value="fee">Fee</option><option value="other">Other</option></select></div>`;
  h+=`<div class="fld"><label>PAYMENT</label><select id="exPm" class="cinput"><option value="">—</option><option value="cash">Cash</option><option value="loc">Line of Credit</option><option value="credit_card">Credit Card</option><option value="check">Check</option><option value="wire">Wire</option></select></div>`;
  h+=`</div>`;

  // More details
  h+=`<button id="exMoreBtn" onclick="toggleExpMore()" style="background:none;border:none;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;padding:4px 0;margin-bottom:8px">More Details ▸</button>`;
  h+=`<div id="exMore" style="display:none"><div class="reno-eg">`;
  h+=`<div class="fld"><label>VENDOR</label><input id="exV" type="text" class="cinput" placeholder="Vendor name" list="vdl"/><datalist id="vdl">${[...new Set(renoExp.map(e=>e.vendor_name).filter(Boolean))].map(v=>`<option value="${esc(v)}">`).join("")}</datalist></div>`;
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

  let h=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>Date</th><th>SOW</th><th>Vendor</th><th>Description</th><th style="text-align:right">Amount</th><th>Type</th><th class="reno-hm">Payment</th><th style="width:60px"></th></tr></thead><tbody>`;
  f.forEach(e=>{
    const tc=EXP_TYPE_COLORS[e.expense_type]||"#94a3b8";
    const sl=e.renovation_sow_lines;
    h+=`<tr><td style="color:#94a3b8;white-space:nowrap">${e.expense_date?new Date(e.expense_date+"T00:00:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"America/Los_Angeles"}):"—"}</td><td>${sl?`<span class="reno-chip" style="color:#94a3b8;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">#${sl.line_number}</span>`:"—"}</td><td style="color:#94a3b8">${esc(e.vendor_name||"—")}</td><td style="color:#e2e8f0;font-weight:600">${esc(e.description||"")}</td><td style="text-align:right;font-weight:700">${$r(e.amount)}</td><td><span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30">${e.expense_type||"other"}</span></td><td class="reno-hm" style="color:#64748b">${e.payment_method?e.payment_method.replace(/_/g," "):"—"}</td><td><div style="display:flex;align-items:center;gap:12px;white-space:nowrap">${e.receipt_photo_url?`<a href="${esc(e.receipt_photo_url)}" target="_blank" onclick="event.stopPropagation()" style="color:#d4af37;font-size:10px;font-weight:700;text-decoration:none">📄 Receipt</a>`:""}<button onclick="event.stopPropagation();editExpense('${e.id}')" style="background:none;border:none;color:#60a5fa;font-size:10px;font-weight:700;cursor:pointer;padding:2px 4px">Edit</button><button onclick="event.stopPropagation();deleteExpense('${e.id}')" style="background:none;border:none;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer;padding:2px 4px">Del</button></div></td></tr>`;
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
    const res=await fetch(SB+"/rest/v1/renovation_expenses",{method:"POST",headers:RENO_WH,body:JSON.stringify(p)});
    if(!res.ok){const err=await res.text();console.error("Save expense error:",res.status,err);showRenoToast("Failed to save expense");return;}
    // Attach receipt URL if pending
    if(_pendingReceiptUrl){
      const saved=await res.json();
      const expId=Array.isArray(saved)?saved[0]?.id:saved?.id;
      if(expId)await fetch(SB+"/rest/v1/renovation_expenses?id=eq."+expId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify({receipt_photo_url:_pendingReceiptUrl})});
      _pendingReceiptUrl=null;
    }
    // Clear form (keep date and payment method)
    ["exDe","exA","exV","exPn","exUC","exQ","exN"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    showRenoToast("Expense logged");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Save expense failed:",e);showRenoToast("Failed to save expense");}
}

async function deleteExpense(expId){
  if(!confirm("Delete this expense?"))return;
  try{
    await fetch(SB+"/rest/v1/renovation_expenses?id=eq."+expId,{method:"DELETE",headers:RENO_WH});
    showRenoToast("Expense deleted");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Delete expense failed:",e);showRenoToast("Failed to delete expense");}
}

async function editExpense(expId){
  const exp=renoExp.find(e=>e.id===expId);if(!exp)return;
  const m=document.getElementById("renoModal");
  const sowOpts=renoSOW.filter(l=>Number(l.lender_approved)>0||Number(l.planned_budget)>0).map(l=>`<option value="${l.id}"${l.id===exp.sow_line_id?" selected":""}>#${l.line_number} — ${esc(l.description||"")} (${$r(l.planned_budget||l.lender_approved||0)})</option>`).join("");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">EDIT EXPENSE</div>`;
  h+=`<div style="font-size:16px;font-weight:800;margin-bottom:16px">${esc(exp.description||"")}</div>`;
  h+=`<div class="reno-eg">`;
  h+=`<div class="fld"><label>DATE</label><input id="eeD" type="date" class="cinput" value="${exp.expense_date||""}"/></div>`;
  h+=`<div class="fld"><label>SOW LINE</label><select id="eeS" class="cinput">${sowOpts}</select></div>`;
  h+=`<div class="fld"><label>DESCRIPTION</label><input id="eeDe" type="text" class="cinput" value="${esc(exp.description||"")}"/></div>`;
  h+=`<div class="fld"><label>AMOUNT</label><input id="eeA" type="number" class="cinput" step="0.01" value="${exp.amount||""}"/></div>`;
  h+=`<div class="fld"><label>TYPE</label><select id="eeT" class="cinput"><option value="material"${exp.expense_type==="material"?" selected":""}>Material</option><option value="labor"${exp.expense_type==="labor"?" selected":""}>Labor</option><option value="permit"${exp.expense_type==="permit"?" selected":""}>Permit</option><option value="fee"${exp.expense_type==="fee"?" selected":""}>Fee</option><option value="other"${exp.expense_type==="other"?" selected":""}>Other</option></select></div>`;
  h+=`<div class="fld"><label>PAYMENT</label><select id="eePm" class="cinput"><option value="">—</option><option value="cash"${exp.payment_method==="cash"?" selected":""}>Cash</option><option value="check"${exp.payment_method==="check"?" selected":""}>Check</option><option value="card"${exp.payment_method==="card"?" selected":""}>Card</option><option value="transfer"${exp.payment_method==="transfer"?" selected":""}>Transfer</option><option value="zelle"${exp.payment_method==="zelle"?" selected":""}>Zelle</option></select></div>`;
  h+=`<div class="fld"><label>VENDOR</label><input id="eeV" type="text" class="cinput" value="${esc(exp.vendor_name||"")}"/></div>`;
  h+=`<div class="fld"><label>NOTES</label><input id="eeN" type="text" class="cinput" value="${esc(exp.notes||"")}"/></div>`;
  h+=`</div>`;
  h+=`<button onclick="saveEditedExpense('${exp.id}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">Save Changes</button>`;
  h+=`</div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function saveEditedExpense(expId){
  const p={};
  const gv=id=>(document.getElementById(id)?.value||"").trim();
  const gn=id=>Number(document.getElementById(id)?.value)||0;
  if(gv("eeD"))p.expense_date=gv("eeD");
  if(gv("eeS"))p.sow_line_id=gv("eeS");
  if(gv("eeDe"))p.description=gv("eeDe");
  if(gn("eeA"))p.amount=gn("eeA");
  p.expense_type=gv("eeT")||"other";
  p.payment_method=gv("eePm")||null;
  p.vendor_name=gv("eeV")||null;
  p.notes=gv("eeN")||null;
  try{
    const res=await fetch(SB+"/rest/v1/renovation_expenses?id=eq."+expId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(p)});
    if(!res.ok){showRenoToast("Failed to save expense");return;}
    closeRenoModal();showRenoToast("Expense updated");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Edit expense failed:",e);showRenoToast("Failed to save expense");}
}

// ═══ RECEIPT PARSER ═══
async function openReceiptUpload(){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*,.pdf';
  input.onchange=async function(){const file=input.files[0];if(!file)return;await parseReceipt(file);};
  input.click();
}

async function parseReceipt(file){
  const formArea=document.querySelector('.reno-ef');
  const origHTML=formArea?.innerHTML;
  if(formArea)formArea.innerHTML='<div style="text-align:center;padding:24px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#d4af37;font-weight:700">Reading receipt...</div></div>';

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey){if(formArea)formArea.innerHTML=origHTML;return;}
    localStorage.setItem("sh_claude_key",apiKey);
  }

  // Upload to storage first
  const filePath=storagePath(renoDealId,"receipts",file);
  const pendingDocUrl=await uploadToStorage(file,"sovereign-docs",filePath);
  _pendingReceiptUrl=pendingDocUrl;

  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);
  let binary="";const chunk=8192;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  const b64=btoa(binary);

  const mediaType=file.type.startsWith('image/')?file.type:'application/pdf';
  const docType=file.type.startsWith('image/')?'image':'document';

  const sowContext=renoSOW.filter(l=>Number(l.lender_approved)>0||Number(l.planned_budget)>0).map(l=>"Line "+l.line_number+": "+l.category+" - "+l.description+" ("+l.lender_approved+" approved)").join("\n");

  const content=[
    {type:docType,source:{type:"base64",media_type:mediaType,data:b64}},
    {type:"text",text:"Parse this receipt or invoice. Extract ALL of the following and return ONLY a JSON object, no markdown, no explanation:\n\n{\"vendor\":\"Store or company name\",\"date\":\"YYYY-MM-DD\",\"items\":[{\"description\":\"Item description\",\"amount\":123.45,\"expense_type\":\"material or labor or permit or fee or other\",\"unit_cost\":null,\"unit_type\":null,\"quantity\":null,\"product_name\":\"Specific product name if visible\"}],\"subtotal\":123.45,\"tax\":12.34,\"total\":135.79,\"payment_method\":\"cash or credit_card or check or other\",\"suggested_sow_line\":\"best matching SOW line number\"}\n\nHere are the SOW lines for this project — pick the best match for each item:\n"+sowContext+"\n\nIf multiple items on the receipt, include all in the items array. Return ONLY the JSON."}
  ];

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:content}]})
    });
    if(!res.ok){if(res.status===401)localStorage.removeItem("sh_claude_key");throw new Error("API error "+res.status);}
    const data=await res.json();
    const parsed=await robustParseJSON(data,apiKey);
    prefillExpenseForm(parsed);
  }catch(e){
    console.error("Receipt parse error:",e);
    showRenoToast("Failed to parse receipt: "+e.message);
    renderRenoSub();
  }
}

function prefillExpenseForm(parsed){
  const el=document.getElementById("renoContent");
  if(el)renderExpV(el);
  setTimeout(()=>{
    if(parsed.date){const d=document.getElementById("exD");if(d)d.value=parsed.date;}
    if(parsed.suggested_sow_line){
      const sel=document.getElementById("exS");
      if(sel){const sowLine=renoSOW.find(l=>l.line_number==parsed.suggested_sow_line);if(sowLine)sel.value=sowLine.id;}
    }
    const items=parsed.items||[];
    if(items.length===1){
      const item=items[0];
      const de=document.getElementById("exDe");if(de)de.value=item.description||"";
      const a=document.getElementById("exA");if(a)a.value=parsed.total||item.amount||"";
      const t=document.getElementById("exT");if(t)t.value=item.expense_type||"material";
      if(item.product_name){const pn=document.getElementById("exPn");if(pn)pn.value=item.product_name;}
      if(item.unit_cost){const uc=document.getElementById("exUC");if(uc)uc.value=item.unit_cost;}
      if(item.unit_type){const ut=document.getElementById("exUT");if(ut)ut.value=item.unit_type;}
      if(item.quantity){const q=document.getElementById("exQ");if(q)q.value=item.quantity;}
    }else if(items.length>1){
      const de=document.getElementById("exDe");if(de)de.value=items.map(i=>i.description).join(", ");
      const a=document.getElementById("exA");if(a)a.value=parsed.total||items.reduce((s,i)=>s+(i.amount||0),0);
      const t=document.getElementById("exT");if(t)t.value=items[0]?.expense_type||"material";
    }
    if(parsed.vendor){
      const more=document.getElementById("exMore");if(more)more.style.display="block";
      const btn=document.getElementById("exMoreBtn");if(btn)btn.textContent="Less Details ▾";
      const v=document.getElementById("exV");if(v)v.value=parsed.vendor;
    }
    if(parsed.payment_method){const pm=document.getElementById("exPm");if(pm)pm.value=parsed.payment_method;}
    showRenoToast("Receipt parsed — review and save");
  },100);
}

// ═══ CPA REPORT EXPORT ═══
function exportCPAReport(){
  const d=deals.find(x=>x.id===renoDealId);if(!d){showRenoToast("No deal selected");return;}
  const f=renoFin;const ov=renoOv;
  const now=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'America/Los_Angeles'});
  const fmt=n=>'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=n=>(Number(n||0)).toFixed(2)+'%';
  const dt=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Los_Angeles'}):'—';
  const e=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const purchasePrice=f?.purchase_price||d.accepted_price||d.offer_price||0;

  // --- Section 4: Budget vs Actual ---
  const budgetLines=renoBLines.filter(l=>(l.lender_approved||0)>0||(l.planned_budget||0)>0||(l.total_spent||0)>0);
  let budgetRows='';
  let totApp=0,totPlan=0,totSpent=0,totDrawn=0;
  budgetLines.forEach(l=>{
    const app=l.lender_approved||0,plan=l.planned_budget||0,spent=l.total_spent||0,drawn=l.total_drawn||0;
    const variance=plan-spent;
    const vc=variance<0?'color:#c00':'color:#060';
    totApp+=app;totPlan+=plan;totSpent+=spent;totDrawn+=drawn;
    budgetRows+=`<tr><td>${l.line_number||''}</td><td>${e(l.category||'')}</td><td>${e(l.description||'')}</td><td style="text-align:right">${fmt(app)}</td><td style="text-align:right">${fmt(plan)}</td><td style="text-align:right">${fmt(spent)}</td><td style="text-align:right">${fmt(drawn)}</td><td style="text-align:right;${variance!==0?vc:''}">${fmt(variance)}</td></tr>`;
  });
  const totVar=totPlan-totSpent;
  const totVc=totVar<0?'color:#c00;font-weight:700':'color:#060;font-weight:700';
  budgetRows+=`<tr style="border-top:2px solid #333;font-weight:700"><td colspan="3">TOTAL</td><td style="text-align:right">${fmt(totApp)}</td><td style="text-align:right">${fmt(totPlan)}</td><td style="text-align:right">${fmt(totSpent)}</td><td style="text-align:right">${fmt(totDrawn)}</td><td style="text-align:right;${totVar!==0?totVc:''}">${fmt(totVar)}</td></tr>`;

  // --- Section 5: Expenses by Category ---
  const catMap={};
  renoExp.forEach(ex=>{
    const cat=(ex.renovation_sow_lines?.category||'uncategorized').replace(/_/g,' ');
    if(!catMap[cat])catMap[cat]={material:0,labor:0,other:0,total:0};
    const amt=ex.amount||0;
    if(ex.expense_type==='material')catMap[cat].material+=amt;
    else if(ex.expense_type==='labor')catMap[cat].labor+=amt;
    else catMap[cat].other+=amt;
    catMap[cat].total+=amt;
  });
  const catEntries=Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total);
  let catRows='';
  let gMat=0,gLab=0,gOth=0,gTot=0;
  catEntries.forEach(([cat,v])=>{
    gMat+=v.material;gLab+=v.labor;gOth+=v.other;gTot+=v.total;
    catRows+=`<tr><td style="text-transform:capitalize">${e(cat)}</td><td style="text-align:right">${fmt(v.material)}</td><td style="text-align:right">${fmt(v.labor)}</td><td style="text-align:right">${fmt(v.other)}</td><td style="text-align:right;font-weight:600">${fmt(v.total)}</td></tr>`;
  });
  catRows+=`<tr style="border-top:2px solid #333;font-weight:700"><td>GRAND TOTAL</td><td style="text-align:right">${fmt(gMat)}</td><td style="text-align:right">${fmt(gLab)}</td><td style="text-align:right">${fmt(gOth)}</td><td style="text-align:right">${fmt(gTot)}</td></tr>`;

  // --- Section 6: Top Vendors ---
  const vendMap={};
  renoExp.forEach(ex=>{
    const v=(ex.vendor_name||'Unknown').trim();
    vendMap[v]=(vendMap[v]||0)+(ex.amount||0);
  });
  const topVendors=Object.entries(vendMap).sort((a,b)=>b[1]-a[1]).slice(0,15);
  let vendRows='';
  topVendors.forEach(([name,total])=>{vendRows+=`<tr><td>${e(name)}</td><td style="text-align:right">${fmt(total)}</td></tr>`;});

  // --- Section 7: Draw History ---
  let drawRows='';
  let dReq=0,dFee=0,dRec=0;
  renoDraws.forEach(dr=>{
    const req=dr.amount_requested||0,fee=dr.draw_fee||0,rec=dr.amount_received||0;
    dReq+=req;dFee+=fee;dRec+=rec;
    const subD=dr.date_submitted?dt(dr.date_submitted):'—';
    const disD=dr.date_disbursed?dt(dr.date_disbursed):'—';
    let days='—';
    if(dr.date_submitted&&dr.date_disbursed){days=Math.round((new Date(dr.date_disbursed+'T00:00:00')-new Date(dr.date_submitted+'T00:00:00'))/(864e5));}
    drawRows+=`<tr><td>#${dr.draw_number}</td><td>${(dr.status||'preparing').replace(/_/g,' ')}</td><td style="text-align:right">${fmt(req)}</td><td style="text-align:right">${fmt(fee)}</td><td style="text-align:right">${fmt(rec)}</td><td>${subD}</td><td>${disD}</td><td style="text-align:center">${days}</td></tr>`;
  });
  drawRows+=`<tr style="border-top:2px solid #333;font-weight:700"><td colspan="2">TOTAL</td><td style="text-align:right">${fmt(dReq)}</td><td style="text-align:right">${fmt(dFee)}</td><td style="text-align:right">${fmt(dRec)}</td><td colspan="3"></td></tr>`;

  // --- Section 8: Expense Ledger ---
  let ledgerRows='';
  let ledgerTotal=0;
  const sortedExp=[...renoExp].sort((a,b)=>(a.expense_date||'').localeCompare(b.expense_date||''));
  sortedExp.forEach(ex=>{
    const amt=ex.amount||0;ledgerTotal+=amt;
    const sl=ex.renovation_sow_lines;
    ledgerRows+=`<tr><td>${dt(ex.expense_date)}</td><td>${sl?'#'+sl.line_number:'—'}</td><td>${e(ex.vendor_name||'—')}</td><td>${e(ex.description||'')}</td><td>${ex.expense_type||'other'}</td><td>${(ex.payment_method||'—').replace(/_/g,' ')}</td><td style="text-align:right">${fmt(amt)}</td></tr>`;
  });
  ledgerRows+=`<tr style="border-top:2px solid #333;font-weight:700"><td colspan="6">TOTAL</td><td style="text-align:right">${fmt(ledgerTotal)}</td></tr>`;

  // --- Section 9: P&L ---
  const renoActual=ov?.total_spent||totSpent;
  const finCosts=(f?.total_interest_paid||0)+(f?.origination_fee_amount||0)+(f?.service_fee||0)+(f?.prorated_interest||0)+(f?.other_lender_fees||0);
  const closingCosts=(f?.escrow_fee||0)+(f?.lenders_title_insurance||0)+(f?.recording_fees||0)+(f?.notary_doc_prep||0)+(f?.wire_fee||0);
  const allIn=purchasePrice+renoActual+finCosts+closingCosts;
  const targetArv=d.target_arv||d.arv||0;

  // --- Build HTML ---
  let html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CPA Report — ${e(d.address)}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#1a1a1a;line-height:1.5;padding:20px}
.wrap{max-width:800px;margin:0 auto}
h1{font-size:18px;font-weight:800;color:#1a1a1a;margin:0}
h2{font-size:13px;font-weight:800;color:#d4af37;letter-spacing:2px;text-transform:uppercase;border-bottom:2px solid #d4af37;padding-bottom:4px;margin:24px 0 10px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th,td{padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:left;font-size:10px}
th{font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #ccc}
.hdr{text-align:center;padding:20px 0 16px;border-bottom:2px solid #1a1a1a;margin-bottom:20px}
.hdr .co{font-size:10px;font-weight:800;letter-spacing:4px;color:#d4af37;margin-bottom:4px}
.hdr .sub{font-size:11px;color:#666;margin-top:4px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0}
.two .col{padding:8px 12px}
.two .col+.col{border-left:1px solid #e5e5e5}
.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;font-size:10px}
.row .lbl{color:#666}
.row .val{font-weight:600}
.box{border:1px solid #ddd;border-radius:4px;margin-bottom:16px;overflow:hidden}
.sumbox{border:2px solid #1a1a1a;border-radius:4px;padding:12px 16px;margin-bottom:16px}
.sumrow{display:flex;justify-content:space-between;padding:4px 0;font-size:11px}
.sumrow.total{border-top:2px solid #1a1a1a;font-weight:800;font-size:12px;margin-top:4px;padding-top:8px}
.sumrow.profit{color:#060;font-weight:800;font-size:13px}
.footer{text-align:center;padding:16px 0;border-top:1px solid #ddd;margin-top:24px;font-size:9px;color:#999;letter-spacing:1px}
@media print{body{padding:0}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}
</style></head><body><div class="wrap">`;

  // 1. Header
  html+=`<div class="hdr"><div class="co">SOVEREIGN HOUSE LLC</div><h1>Deal Financial Report</h1><div class="sub">${e(d.address)}<br>Generated ${now}</div></div>`;

  // 2. Property Summary
  html+=`<h2>Property Summary</h2><div class="box"><div class="two"><div class="col">`;
  html+=`<div class="row"><span class="lbl">Address</span><span class="val">${e(d.address||'')}</span></div>`;
  if(d.community)html+=`<div class="row"><span class="lbl">Community</span><span class="val">${e(d.community)}</span></div>`;
  if(d.mls_number)html+=`<div class="row"><span class="lbl">MLS#</span><span class="val">${e(d.mls_number)}</span></div>`;
  if(d.sqft)html+=`<div class="row"><span class="lbl">Size</span><span class="val">${Number(d.sqft).toLocaleString()} sf</span></div>`;
  if(d.beds||d.baths)html+=`<div class="row"><span class="lbl">Beds / Baths</span><span class="val">${d.beds||'—'} / ${d.baths||'—'}</span></div>`;
  html+=`</div><div class="col">`;
  if(d.list_price)html+=`<div class="row"><span class="lbl">List Price</span><span class="val">${fmt(d.list_price)}</span></div>`;
  if(purchasePrice)html+=`<div class="row"><span class="lbl">Purchase Price</span><span class="val">${fmt(purchasePrice)}</span></div>`;
  html+=`<div class="row"><span class="lbl">Status</span><span class="val">${(d.status||'').replace(/_/g,' ')}</span></div>`;
  if(d.coe_date)html+=`<div class="row"><span class="lbl">COE Date</span><span class="val">${dt(d.coe_date)}</span></div>`;
  html+=`</div></div></div>`;

  // 3. Financing
  if(f){
    html+=`<h2>Financing</h2><div class="box"><div class="two"><div class="col">`;
    if(f.lender_name)html+=`<div class="row"><span class="lbl">Lender</span><span class="val">${e(f.lender_name)}</span></div>`;
    if(f.loan_number)html+=`<div class="row"><span class="lbl">Loan #</span><span class="val">${e(f.loan_number)}</span></div>`;
    if(f.interest_rate)html+=`<div class="row"><span class="lbl">Rate</span><span class="val">${pct(f.interest_rate)} ${f.interest_rate_type||''}</span></div>`;
    if(f.loan_term_months)html+=`<div class="row"><span class="lbl">Term</span><span class="val">${f.loan_term_months} months</span></div>`;
    if(f.maturity_date)html+=`<div class="row"><span class="lbl">Maturity</span><span class="val">${dt(f.maturity_date)}</span></div>`;
    if(f.funded_date)html+=`<div class="row"><span class="lbl">Funded</span><span class="val">${dt(f.funded_date)}</span></div>`;
    if(f.funded_principal)html+=`<div class="row"><span class="lbl">Funded Principal</span><span class="val">${fmt(f.funded_principal)}</span></div>`;
    html+=`</div><div class="col">`;
    if(f.rehab_holdback)html+=`<div class="row"><span class="lbl">Rehab Holdback</span><span class="val">${fmt(f.rehab_holdback)}</span></div>`;
    if(f.total_loan_amount)html+=`<div class="row"><span class="lbl">Total Loan</span><span class="val">${fmt(f.total_loan_amount)}</span></div>`;
    if(f.down_payment)html+=`<div class="row"><span class="lbl">Down Payment</span><span class="val">${fmt(f.down_payment)}</span></div>`;
    if(f.total_cash_to_close)html+=`<div class="row"><span class="lbl">Cash to Close</span><span class="val">${fmt(f.total_cash_to_close)}</span></div>`;
    if(f.origination_fee_amount)html+=`<div class="row"><span class="lbl">Origination Fee</span><span class="val">${fmt(f.origination_fee_amount)}</span></div>`;
    if(f.monthly_interest_payment)html+=`<div class="row"><span class="lbl">Monthly Payment</span><span class="val">${fmt(f.monthly_interest_payment)}</span></div>`;
    if(f.total_interest_paid)html+=`<div class="row"><span class="lbl">Total Interest Paid</span><span class="val">${fmt(f.total_interest_paid)}</span></div>`;
    html+=`</div></div></div>`;
  }

  // 4. Budget vs Actual
  html+=`<h2>Renovation Budget vs Actual</h2>`;
  html+=`<table><thead><tr><th>#</th><th>Category</th><th>Description</th><th style="text-align:right">Lender Approved</th><th style="text-align:right">Planned</th><th style="text-align:right">Actual Spent</th><th style="text-align:right">Drawn</th><th style="text-align:right">Variance</th></tr></thead><tbody>${budgetRows}</tbody></table>`;

  // 5. Expenses by Category
  html+=`<h2>Expenses by Category</h2>`;
  html+=`<table><thead><tr><th>Category</th><th style="text-align:right">Materials</th><th style="text-align:right">Labor</th><th style="text-align:right">Other</th><th style="text-align:right">Total</th></tr></thead><tbody>${catRows}</tbody></table>`;

  // 6. Top Vendors
  if(topVendors.length){
    html+=`<h2>Top Vendors</h2>`;
    html+=`<table><thead><tr><th>Vendor</th><th style="text-align:right">Total Paid</th></tr></thead><tbody>${vendRows}</tbody></table>`;
  }

  // 7. Draw History
  if(renoDraws.length){
    html+=`<h2>Draw History</h2>`;
    html+=`<table><thead><tr><th>Draw</th><th>Status</th><th style="text-align:right">Requested</th><th style="text-align:right">Fee</th><th style="text-align:right">Received</th><th>Submitted</th><th>Disbursed</th><th style="text-align:center">Days</th></tr></thead><tbody>${drawRows}</tbody></table>`;
  }

  // 8. Complete Expense Ledger
  html+=`<h2>Complete Expense Ledger</h2>`;
  html+=`<table><thead><tr><th>Date</th><th>SOW#</th><th>Vendor</th><th>Description</th><th>Type</th><th>Payment</th><th style="text-align:right">Amount</th></tr></thead><tbody>${ledgerRows}</tbody></table>`;

  // 9. Deal Summary P&L
  html+=`<h2>Deal Summary</h2><div class="sumbox">`;
  html+=`<div class="sumrow"><span>Purchase Price</span><span>${fmt(purchasePrice)}</span></div>`;
  html+=`<div class="sumrow"><span>Renovation (Actual)</span><span>${fmt(renoActual)}</span></div>`;
  html+=`<div class="sumrow"><span>Financing Costs</span><span>${fmt(finCosts)}</span></div>`;
  html+=`<div class="sumrow"><span>Closing Costs</span><span>${fmt(closingCosts)}</span></div>`;
  html+=`<div class="sumrow total"><span>All-In Cost</span><span>${fmt(allIn)}</span></div>`;
  if(targetArv){
    html+=`<div class="sumrow" style="margin-top:8px"><span>Target ARV</span><span>${fmt(targetArv)}</span></div>`;
    html+=`<div class="sumrow profit"><span>Estimated Profit</span><span>${fmt(targetArv-allIn)}</span></div>`;
  }
  html+=`</div>`;

  // 10. Footer
  html+=`<div class="footer">SOVEREIGN HOUSE LLC &middot; CONFIDENTIAL &middot; ${now}</div>`;
  html+=`</div></body></html>`;

  const win=window.open('','_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),500);
}

// ═══ HELPERS ═══
function showRenoToast(msg,isErr){
  const t=document.getElementById("alertToast");
  const c=isErr||msg.toLowerCase().includes("fail")?"#ef4444":"#22c55e";
  const icon=isErr||msg.toLowerCase().includes("fail")?"✗":"✓";
  t.innerHTML=`<div style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:${c}0F;border:1px solid ${c}26;animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:${c}">${icon} ${esc(msg)}</div></div>`;
  setTimeout(()=>{t.innerHTML="";},3000);
}

function closeRenoModal(){document.getElementById("renoModal").style.display="none";document.body.style.overflow="";}

// Disable backdrop click on renoModal — strip the listener added by index.html
(function(){
  const rm=document.getElementById("renoModal");
  if(rm){const cl=rm.cloneNode(true);rm.parentNode.replaceChild(cl,rm);}
})();

// ═══ FINANCING MODULE ═══
let finData=null,finDealId=null;
const FIN_STATUSES=["application","approved","clear_to_close","funded","active","paid_off"];
const FIN_LABELS={application:"Application",approved:"Approved",clear_to_close:"Clear to Close",funded:"Funded",active:"Active",paid_off:"Paid Off"};

async function loadFinancing(dealId){
  try{
    const res=await sb("deal_financing?deal_id=eq."+dealId);
    finData=Array.isArray(res)&&res.length?res[0]:null;
    finDealId=dealId;
  }catch(e){console.error("Load financing failed:",e);finData=null;}
}

async function openFinancing(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  finDealId=dealId;
  await loadFinancing(dealId);
  const f=finData;
  const isNew=!f;
  const m=document.getElementById("renoModal");

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeRenoModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">DEAL FINANCING</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(d.address)}</div>`;
  h+=`<div style="font-size:11px;color:#64748b;margin-bottom:16px">${d.community?esc(d.community)+' · ':''}${d.zip_code||''}</div>`;

  // Status pipeline
  const cs=f?.status||"application";
  h+=`<div class="fin-pipe">`;
  FIN_STATUSES.forEach((s,i)=>{
    const active=s===cs;
    const done=FIN_STATUSES.indexOf(cs)>i;
    h+=`<button onclick="updateFinStatus('${s}')" class="fin-ps${active?' active':''}${done?' done':''}">${FIN_LABELS[s]}</button>`;
  });
  h+=`</div>`;

  // Upload closing docs button
  h+=`<div style="margin-bottom:16px"><button onclick="openFinDocUpload()" class="btn" style="width:100%;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">📄 Upload Closing Disclosure / Settlement Statement</button><div style="font-size:10px;color:#64748b;text-align:center;margin-top:4px">AI will read your loan docs and fill in everything</div></div>`;

  // Section 1: Loan Terms
  const s1sum=f?`${esc(f.lender_name||'—')} | ${f.interest_rate||'—'}% | ${f.loan_term_months||'—'}mo${f.maturity_date?' | Matures '+fmtDate(f.maturity_date):''}`:''
  const s1open=isNew||!f?.lender_name;
  h+=finSection('fin1','LOAN TERMS',s1sum,s1open,`
    <div class="row2">
      <div class="fld"><label>LENDER NAME</label><input id="fin_lender_name" class="cinput" value="${esc(f?.lender_name||d.lender_name||'')}"/></div>
      <div class="fld"><label>LOAN NUMBER</label><input id="fin_loan_number" class="cinput" value="${esc(f?.loan_number||d.lender_loan_number||'')}"/></div>
    </div>
    <div class="fld"><label>LOAN OFFICER</label><input id="fin_loan_officer" class="cinput" value="${esc(f?.loan_officer||'')}"/></div>
    <div class="row2">
      <div class="fld"><label>INTEREST RATE (%)</label><input id="fin_interest_rate" type="number" step="0.01" class="cinput" value="${f?.interest_rate||d.lender_interest_rate||''}"/></div>
      <div class="fld"><label>RATE TYPE</label><select id="fin_interest_rate_type" class="cinput"><option value="fixed"${(f?.interest_rate_type||'fixed')==='fixed'?' selected':''}>Fixed</option><option value="variable"${f?.interest_rate_type==='variable'?' selected':''}>Variable</option></select></div>
    </div>
    <div class="row2">
      <div class="fld"><label>LOAN TERM (MONTHS)</label><input id="fin_loan_term_months" type="number" class="cinput" value="${f?.loan_term_months||''}"/></div>
      <div class="fld"><label>MATURITY DATE</label><input id="fin_maturity_date" type="date" class="cinput ${finMaturityClass(f?.maturity_date)}" value="${f?.maturity_date||''}"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>FIRST PAYMENT DATE</label><input id="fin_first_payment_date" type="date" class="cinput" value="${f?.first_payment_date||''}"/></div>
      <div class="fld"><label>PAYMENT DUE DAY (1-28)</label><input id="fin_payment_due_day" type="number" min="1" max="28" class="cinput" value="${f?.payment_due_day||''}"/></div>
    </div>
    <div style="margin-top:4px">${renoToggle('fin_extension_available','Extension Available',!!f?.extension_available)}</div>
    <div id="finExtFields" style="display:${f?.extension_available?'block':'none'};margin-top:8px">
      <div class="row2">
        <div class="fld"><label>EXTENSION FEE (%)</label><input id="fin_extension_fee_pct" type="number" step="0.01" class="cinput" value="${f?.extension_fee_pct||''}"/></div>
        <div class="fld"><label>EXTENSION (MONTHS)</label><input id="fin_extension_months" type="number" class="cinput" value="${f?.extension_months||''}"/></div>
      </div>
    </div>
  `);

  // Section 2: Funded Amounts
  const s2sum=f?`Principal: ${$r(f.funded_principal)} | Rehab: ${$r(f.rehab_holdback)} | Total: ${$r(f.total_loan_amount)}`:'';
  const s2open=isNew||!f?.funded_principal;
  h+=finSection('fin2','FUNDED AMOUNTS',s2sum,s2open,`
    <div class="row2">
      <div class="fld"><label>PURCHASE PRICE</label><input id="fin_purchase_price" type="number" class="cinput" value="${f?.purchase_price||d.accepted_price||d.offer_price||''}"/></div>
      <div class="fld"><label>FUNDED PRINCIPAL</label><input id="fin_funded_principal" type="number" class="cinput" value="${f?.funded_principal||''}" oninput="finCalcTotal()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>REHAB HOLDBACK</label><input id="fin_rehab_holdback" type="number" class="cinput" value="${f?.rehab_holdback||''}" oninput="finCalcTotal()"/></div>
      <div class="fld"><label>TOTAL LOAN AMOUNT</label><input id="fin_total_loan_amount" type="number" class="cinput fin-calc" value="${f?.total_loan_amount||''}" readonly tabindex="-1"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>DOWN PAYMENT</label><input id="fin_down_payment" type="number" class="cinput" value="${f?.down_payment||''}"/></div>
      <div class="fld"><label>MONTHLY PAYMENT <span style="font-size:8px;color:#475569">(from lender statement)</span></label><input id="fin_monthly_interest_payment" type="number" step="0.01" class="cinput" value="${f?.monthly_interest_payment||''}"/></div>
    </div>
  `);

  // Section 3: Fees & Closing Costs
  const s3sum=f?`Origination: ${$r(f.origination_fee_amount)} | Closing: ${$r(f.total_closing_costs)} | Cash to Close: ${$r(f.total_cash_to_close)}`:'';
  const s3open=isNew||!f?.total_cash_to_close;
  h+=finSection('fin3','FEES & CLOSING COSTS',s3sum,s3open,`
    <div class="row2">
      <div class="fld"><label>ORIGINATION FEE (%)</label><input id="fin_origination_fee_pct" type="number" step="0.01" class="cinput" value="${f?.origination_fee_pct||d.lender_origination_pct||''}" oninput="finCalcOrig()"/></div>
      <div class="fld"><label>ORIGINATION FEE ($)</label><input id="fin_origination_fee_amount" type="number" class="cinput" value="${f?.origination_fee_amount||''}" oninput="finCalcCash()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>SERVICE FEE</label><input id="fin_service_fee" type="number" class="cinput" value="${f?.service_fee||d.lender_service_fee||''}" oninput="finCalcCash()"/></div>
      <div class="fld"><label>PRO-RATED INTEREST</label><input id="fin_prorated_interest" type="number" step="0.01" class="cinput" value="${f?.prorated_interest||''}" oninput="finCalcCash()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>OTHER LENDER FEES</label><input id="fin_other_lender_fees" type="number" class="cinput" value="${f?.other_lender_fees||0}" oninput="finCalcCash()"/></div>
      <div class="fld"><label>ESCROW FEE</label><input id="fin_escrow_fee" type="number" class="cinput" value="${f?.escrow_fee||''}" oninput="finCalcClosing()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>LENDER'S TITLE INSURANCE</label><input id="fin_lenders_title_insurance" type="number" class="cinput" value="${f?.lenders_title_insurance||''}" oninput="finCalcClosing()"/></div>
      <div class="fld"><label>RECORDING FEES</label><input id="fin_recording_fees" type="number" class="cinput" value="${f?.recording_fees||''}" oninput="finCalcClosing()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>NOTARY / DOC PREP</label><input id="fin_notary_doc_prep" type="number" class="cinput" value="${f?.notary_doc_prep||''}" oninput="finCalcClosing()"/></div>
      <div class="fld"><label>WIRE FEE</label><input id="fin_wire_fee" type="number" class="cinput" value="${f?.wire_fee||''}" oninput="finCalcClosing()"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>TOTAL CLOSING COSTS</label><input id="fin_total_closing_costs" type="number" class="cinput fin-calc" value="${f?.total_closing_costs||''}" readonly tabindex="-1"/></div>
      <div class="fld"><label style="color:#d4af37;font-size:11px">TOTAL CASH TO CLOSE</label><input id="fin_total_cash_to_close" type="number" class="cinput fin-calc" style="font-size:20px;font-weight:800;color:#d4af37" value="${f?.total_cash_to_close||''}" readonly tabindex="-1"/></div>
    </div>
    <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:8px">CASH SOURCE BREAKDOWN</div>
      <div class="row3">
        <div class="fld"><label>CASH</label><input id="fin_csb_cash" type="number" class="cinput" value="${(f?.cash_source_breakdown?.cash)||''}" oninput="finCalcCSB()"/></div>
        <div class="fld"><label>LINE OF CREDIT</label><input id="fin_csb_loc" type="number" class="cinput" value="${(f?.cash_source_breakdown?.loc)||''}" oninput="finCalcCSB()"/></div>
        <div class="fld"><label>LISA COMMISSION CREDIT</label><input id="fin_csb_commission" type="number" class="cinput" value="${(f?.cash_source_breakdown?.commission_credit)||''}" oninput="finCalcCSB()"/></div>
      </div>
      <div id="finCSBCheck" style="font-size:11px;font-weight:700;margin-top:4px"></div>
    </div>
  `);

  // Section 4: Draw Terms
  const s4sum=f?`Max Draws: ${f.max_draws||'—'} | Holdback: ${f.holdback_pct||'—'}% | Fee: ${$r(f.draw_fee)}/draw`:'';
  const s4open=isNew||!f?.max_draws;
  h+=finSection('fin4','DRAW TERMS',s4sum,s4open,`
    <div class="row2">
      <div class="fld"><label>MAX DRAWS</label><input id="fin_max_draws" type="number" class="cinput" value="${f?.max_draws||d.lender_max_draws||''}"/></div>
      <div class="fld"><label>HOLDBACK (%)</label><input id="fin_holdback_pct" type="number" step="0.01" class="cinput" value="${f?.holdback_pct||d.lender_holdback_pct||''}"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>DRAW FEE ($)</label><input id="fin_draw_fee" type="number" class="cinput" value="${f?.draw_fee||d.lender_draw_fee||''}"/></div>
      <div class="fld"><label>FINAL DRAW MIN (%)</label><input id="fin_final_draw_min_pct" type="number" class="cinput" value="${f?.final_draw_min_pct||10}" placeholder="10"/></div>
    </div>
  `);

  // Section 5: Running Totals (read-only)
  h+=finRunningTotals(f,d);

  // Save button
  h+=`<button onclick="saveFinancing('${dealId}')" class="btn" style="width:100%;padding:16px;font-size:15px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:16px">Save Financing</button>`;
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";

  // Init extension toggle listener
  document.getElementById("fin_extension_available")?.addEventListener("change",function(){
    document.getElementById("finExtFields").style.display=this.checked?"block":"none";
  });
  // Init live calcs
  finCalcTotal();finCalcClosing();finCalcCash();finCalcCSB();
}

function finSection(id,title,summary,open,content){
  return`<div class="fin-section" id="${id}_sec">
    <button class="fin-sec-hdr" onclick="finToggleSec('${id}')">
      <div style="flex:1;text-align:left">
        <div style="font-size:11px;font-weight:800;color:#e2e8f0;letter-spacing:0.5px">${title}</div>
        ${summary?`<div class="fin-sec-sum" id="${id}_sum" style="${open?'display:none':''}">${summary}</div>`:''}
      </div>
      <span class="fin-chev" id="${id}_chev">${open?'▼':'▶'}</span>
    </button>
    <div class="fin-sec-body" id="${id}_body" style="${open?'':'display:none'}">${content}</div>
  </div>`;
}

function finToggleSec(id){
  const body=document.getElementById(id+"_body");
  const chev=document.getElementById(id+"_chev");
  const sum=document.getElementById(id+"_sum");
  if(!body)return;
  const show=body.style.display==="none";
  body.style.display=show?"":"none";
  if(chev)chev.textContent=show?"▼":"▶";
  if(sum)sum.style.display=show?"none":"";
}

function finMaturityClass(dt){
  if(!dt)return'';
  const diff=(new Date(dt+"T00:00:00")-new Date())/(864e5*30);
  return diff<4?'fin-mat-warn':'';
}

function finRunningTotals(f,d){
  let h=`<div class="fin-section"><div class="fin-sec-hdr" style="cursor:default"><div style="flex:1;text-align:left"><div style="font-size:11px;font-weight:800;color:#e2e8f0;letter-spacing:0.5px">RUNNING TOTALS</div></div><span style="font-size:10px;color:#64748b">AUTO</span></div><div class="fin-sec-body">`;
  const mip=f?.monthly_interest_payment||0;
  const fundedDate=f?.funded_date;
  const matDate=f?.maturity_date;
  const monthsSinceFunded=fundedDate?((Date.now()-new Date(fundedDate+"T00:00:00").getTime())/(864e5*30.44)).toFixed(1):null;
  const monthsUntilMat=matDate?((new Date(matDate+"T00:00:00").getTime()-Date.now())/(864e5*30.44)).toFixed(1):null;
  const matColor=monthsUntilMat!==null?(monthsUntilMat<2?'#ef4444':monthsUntilMat<4?'#eab308':'#22c55e'):'#94a3b8';
  const estInterest=monthsSinceFunded?mip*parseFloat(monthsSinceFunded):0;
  const curBal=(f?.funded_principal||0)+(f?.total_draws_received||0);
  const estPayoff=curBal+estInterest;

  h+=`<div class="reno-sgrid" style="grid-template-columns:repeat(2,1fr)">`;
  h+=`<div class="reno-scard"><div class="reno-sl">MONTHS SINCE FUNDED</div><div class="reno-sv">${monthsSinceFunded||'—'}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">MONTHS UNTIL MATURITY</div><div class="reno-sv" style="color:${matColor}">${monthsUntilMat||'—'}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">TOTAL INTEREST PAID</div><div class="reno-sv">${$r(f?.total_interest_paid)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">EST. INTEREST ACCRUED</div><div class="reno-sv" style="color:#f59e0b">${$r(estInterest)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">CURRENT BALANCE</div><div class="reno-sv">${$r(curBal)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">TOTAL DRAWS RECEIVED</div><div class="reno-sv" style="color:#22c55e">${$r(f?.total_draws_received)}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">REMAINING DRAWABLE</div><div class="reno-sv">${$r((f?.rehab_holdback||0)-(f?.total_draws_received||0))}</div></div>`;
  h+=`<div class="reno-scard"><div class="reno-sl">ESTIMATED PAYOFF</div><div class="reno-sv" style="color:#ef4444">${$r(estPayoff)}</div></div>`;
  h+=`</div>`;

  // Log Interest Payment button
  h+=`<div style="margin-top:12px"><button onclick="document.getElementById('finIntForm').style.display=document.getElementById('finIntForm').style.display==='none'?'block':'none'" class="btn" style="width:100%;padding:10px;font-size:12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-weight:700">Log Interest Payment</button>`;
  h+=`<div id="finIntForm" style="display:none;margin-top:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">`;
  h+=`<div class="row2"><div class="fld"><label>PAYMENT DATE</label><input id="finIntDate" type="date" class="cinput" value="${new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}"/></div>`;
  h+=`<div class="fld"><label>AMOUNT</label><input id="finIntAmt" type="number" step="0.01" class="cinput" value="${mip}"/></div></div>`;
  h+=`<button onclick="logInterestPayment()" class="btn" style="width:100%;padding:10px;font-size:12px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:6px">Save Payment</button>`;
  h+=`</div></div>`;

  // View Closing Docs link
  if(f?.closing_disclosure_url)h+=`<div style="margin-top:12px"><a href="${esc(f.closing_disclosure_url)}" target="_blank" style="display:flex;align-items:center;gap:6px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);color:#60a5fa;font-size:12px;font-weight:700;text-decoration:none">📄 View Closing Docs</a></div>`;

  // Funded date
  h+=`<div class="fld" style="margin-top:12px"><label>FUNDED DATE</label><input id="fin_funded_date" type="date" class="cinput" value="${f?.funded_date||''}"/></div>`;
  h+=`<div class="fld"><label>NOTES</label><textarea id="fin_notes" class="cinput" rows="2" style="min-height:60px;font-size:13px">${esc(f?.notes||'')}</textarea></div>`;

  h+=`</div></div>`;
  return h;
}

// ═══ FINANCING DOC PARSER ═══
function openFinDocUpload(){
  const input=document.createElement('input');
  input.type='file';input.accept='.pdf';
  input.onchange=async function(){const file=input.files[0];if(!file)return;await parseFinDoc(file);};
  input.click();
}

async function parseFinDoc(file){
  // Show loading in modal header area
  const btn=document.querySelector('.fin-pipe');
  const loadEl=document.createElement('div');
  loadEl.id='finDocLoading';
  loadEl.style.cssText='text-align:center;padding:16px;margin-bottom:12px;border-radius:10px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.1)';
  loadEl.innerHTML='<div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#d4af37;font-weight:700">Reading loan documents...</div><div style="font-size:10px;color:#64748b;margin-top:4px">This may take 15-30 seconds</div>';
  if(btn&&btn.parentElement)btn.parentElement.insertBefore(loadEl,btn.nextSibling);

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey){const ld=document.getElementById('finDocLoading');if(ld)ld.remove();return;}
    localStorage.setItem("sh_claude_key",apiKey);
  }

  // Upload to storage
  const filePath=storagePath(renoDealId,"financing",file);
  const pendingDocUrl=await uploadToStorage(file,"sovereign-docs",filePath);
  _pendingFinUrl=pendingDocUrl;

  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);
  let binary="";const chunk=8192;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  const b64=btoa(binary);

  const content=[
    {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
    {type:"text",text:"Parse this loan closing document (closing disclosure, settlement statement, or loan document). Extract ALL financial details and return ONLY a JSON object, no markdown, no explanation:\n\n{\"lender_name\":\"Lender company name\",\"loan_number\":\"Loan number\",\"loan_officer\":\"Loan officer name if visible\",\"purchase_price\":null,\"funded_principal\":null,\"rehab_holdback\":null,\"total_loan_amount\":null,\"down_payment\":null,\"interest_rate\":null,\"interest_rate_type\":\"fixed or variable\",\"origination_fee_pct\":null,\"origination_fee_amount\":null,\"service_fee\":null,\"prorated_interest\":null,\"monthly_interest_payment\":null,\"loan_term_months\":null,\"maturity_date\":\"YYYY-MM-DD or null\",\"first_payment_date\":\"YYYY-MM-DD or null\",\"payment_due_day\":null,\"escrow_fee\":null,\"lenders_title_insurance\":null,\"recording_fees\":null,\"notary_doc_prep\":null,\"wire_fee\":null,\"total_closing_costs\":null,\"total_cash_to_close\":null,\"max_draws\":null,\"holdback_pct\":null,\"draw_fee\":null,\"other_lender_fees\":null}\n\nExtract every number you can find. If a field isn't in the document, use null. Return ONLY the JSON."}
  ];

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:content}]})
    });
    if(!res.ok){if(res.status===401)localStorage.removeItem("sh_claude_key");throw new Error("API error "+res.status);}
    const data=await res.json();
    const parsed=await robustParseJSON(data,apiKey);
    const ld=document.getElementById('finDocLoading');if(ld)ld.remove();
    prefillFinancing(parsed);
  }catch(e){
    console.error("Fin doc parse error:",e);
    const ld=document.getElementById('finDocLoading');if(ld)ld.remove();
    showRenoToast("Failed to parse document: "+e.message);
  }
}

function prefillFinancing(parsed){
  const fields={
    fin_lender_name:parsed.lender_name,fin_loan_number:parsed.loan_number,fin_loan_officer:parsed.loan_officer,
    fin_interest_rate:parsed.interest_rate,fin_interest_rate_type:parsed.interest_rate_type,
    fin_loan_term_months:parsed.loan_term_months,fin_maturity_date:parsed.maturity_date,
    fin_first_payment_date:parsed.first_payment_date,fin_payment_due_day:parsed.payment_due_day,
    fin_purchase_price:parsed.purchase_price,fin_funded_principal:parsed.funded_principal,
    fin_rehab_holdback:parsed.rehab_holdback,fin_total_loan_amount:parsed.total_loan_amount,
    fin_down_payment:parsed.down_payment,fin_monthly_interest_payment:parsed.monthly_interest_payment,
    fin_origination_fee_pct:parsed.origination_fee_pct,fin_origination_fee_amount:parsed.origination_fee_amount,
    fin_service_fee:parsed.service_fee,fin_prorated_interest:parsed.prorated_interest,
    fin_other_lender_fees:parsed.other_lender_fees,
    fin_escrow_fee:parsed.escrow_fee,fin_lenders_title_insurance:parsed.lenders_title_insurance,
    fin_recording_fees:parsed.recording_fees,fin_notary_doc_prep:parsed.notary_doc_prep,
    fin_wire_fee:parsed.wire_fee,
    fin_max_draws:parsed.max_draws,fin_holdback_pct:parsed.holdback_pct,fin_draw_fee:parsed.draw_fee
  };
  for(const[id,val]of Object.entries(fields)){
    if(val!=null){const el=document.getElementById(id);if(el){el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));}}
  }
  // Expand all sections so user can see filled values
  ['fin1','fin2','fin3','fin4'].forEach(id=>{
    const body=document.getElementById(id+'_body');
    const chev=document.getElementById(id+'_chev');
    const sum=document.getElementById(id+'_sum');
    if(body)body.style.display='';
    if(chev)chev.textContent='▼';
    if(sum)sum.style.display='none';
  });
  finCalcTotal();finCalcClosing();finCalcCash();finCalcOrig();finCalcCSB();
  showRenoToast("Loan docs parsed — review and save");
}

// ═══ FINANCING LIVE CALCULATIONS ═══
function finCalcTotal(){
  const fp=Number(document.getElementById("fin_funded_principal")?.value)||0;
  const rh=Number(document.getElementById("fin_rehab_holdback")?.value)||0;
  const el=document.getElementById("fin_total_loan_amount");
  if(el)el.value=fp+rh||'';
  finCalcOrig();
}
function finCalcOrig(){
  const pct=Number(document.getElementById("fin_origination_fee_pct")?.value)||0;
  const total=Number(document.getElementById("fin_total_loan_amount")?.value)||0;
  const el=document.getElementById("fin_origination_fee_amount");
  if(el&&pct&&total&&!el._userEdited)el.value=Math.round(pct/100*total);
  finCalcCash();
}
function finCalcClosing(){
  const ids=["fin_escrow_fee","fin_lenders_title_insurance","fin_recording_fees","fin_notary_doc_prep","fin_wire_fee"];
  let sum=0;ids.forEach(id=>{sum+=Number(document.getElementById(id)?.value)||0;});
  const el=document.getElementById("fin_total_closing_costs");
  if(el)el.value=sum||'';
  finCalcCash();
}
function finCalcCash(){
  const dp=Number(document.getElementById("fin_down_payment")?.value)||0;
  const cc=Number(document.getElementById("fin_total_closing_costs")?.value)||0;
  const orig=Number(document.getElementById("fin_origination_fee_amount")?.value)||0;
  const sf=Number(document.getElementById("fin_service_fee")?.value)||0;
  const pi=Number(document.getElementById("fin_prorated_interest")?.value)||0;
  const olf=Number(document.getElementById("fin_other_lender_fees")?.value)||0;
  const total=dp+cc+orig+sf+pi+olf;
  const el=document.getElementById("fin_total_cash_to_close");
  if(el)el.value=total||'';
  finCalcCSB();
}
function finCalcCSB(){
  const cash=Number(document.getElementById("fin_csb_cash")?.value)||0;
  const loc=Number(document.getElementById("fin_csb_loc")?.value)||0;
  const comm=Number(document.getElementById("fin_csb_commission")?.value)||0;
  const csbTotal=cash+loc+comm;
  const target=Number(document.getElementById("fin_total_cash_to_close")?.value)||0;
  const el=document.getElementById("finCSBCheck");
  if(!el)return;
  if(!target&&!csbTotal){el.innerHTML='';return;}
  const diff=Math.abs(csbTotal-target);
  if(diff<1)el.innerHTML=`<span style="color:#22c55e">✓ Sources balance: ${$r(csbTotal)}</span>`;
  else el.innerHTML=`<span style="color:#ef4444">⚠ Sources total ${$r(csbTotal)} — ${csbTotal<target?'short':'over'} by ${$r(diff)}</span>`;
}

async function updateFinStatus(newStatus){
  try{
    if(!finData){
      // No record exists yet — create one with deal_id + status
      const res=await fetch(SB+"/rest/v1/deal_financing",{method:"POST",headers:RENO_WH,body:JSON.stringify({deal_id:finDealId,status:newStatus})});
      if(!res.ok){showRenoToast("Failed to create financing record");return;}
      const result=await res.json();
      finData=Array.isArray(result)?result[0]:result;
    }else{
      await fetch(SB+"/rest/v1/deal_financing?id=eq."+finData.id,{method:"PATCH",headers:RENO_WH,body:JSON.stringify({status:newStatus})});
      finData.status=newStatus;
    }
    // Re-render pipeline
    document.querySelectorAll(".fin-ps").forEach((btn,i)=>{
      const s=FIN_STATUSES[i];
      const active=s===newStatus;
      const done=FIN_STATUSES.indexOf(newStatus)>i;
      btn.className="fin-ps"+(active?" active":"")+(done?" done":"");
    });
  }catch(e){console.error("Update fin status failed:",e);}
}

async function logInterestPayment(){
  if(!finData)return;
  const amt=Number(document.getElementById("finIntAmt")?.value)||0;
  if(!amt){showRenoToast("Enter an amount");return;}
  const newTotal=(finData.total_interest_paid||0)+amt;
  try{
    await fetch(SB+"/rest/v1/deal_financing?id=eq."+finData.id,{method:"PATCH",headers:RENO_WH,body:JSON.stringify({total_interest_paid:newTotal})});
    finData.total_interest_paid=newTotal;
    showRenoToast("Interest payment logged: "+$r(amt));
    openFinancing(finDealId);
  }catch(e){console.error("Log interest failed:",e);showRenoToast("Failed to log payment");}
}

async function saveFinancing(dealId){
  const gv=id=>(document.getElementById(id)?.value||"").trim();
  const gn=id=>Number(document.getElementById(id)?.value)||0;
  const gc=id=>document.getElementById(id)?.checked||false;

  const payload={
    deal_id:dealId,
    lender_name:gv("fin_lender_name"),loan_number:gv("fin_loan_number"),loan_officer:gv("fin_loan_officer"),
    interest_rate:gn("fin_interest_rate")||null,interest_rate_type:gv("fin_interest_rate_type")||"fixed",
    loan_term_months:gn("fin_loan_term_months")||null,maturity_date:gv("fin_maturity_date")||null,
    first_payment_date:gv("fin_first_payment_date")||null,payment_due_day:gn("fin_payment_due_day")||null,
    extension_available:gc("fin_extension_available"),
    extension_fee_pct:gc("fin_extension_available")?gn("fin_extension_fee_pct")||null:null,
    extension_months:gc("fin_extension_available")?gn("fin_extension_months")||null:null,
    purchase_price:gn("fin_purchase_price")||null,funded_principal:gn("fin_funded_principal")||null,
    rehab_holdback:gn("fin_rehab_holdback")||null,total_loan_amount:gn("fin_total_loan_amount")||null,
    down_payment:gn("fin_down_payment")||null,monthly_interest_payment:gn("fin_monthly_interest_payment")||null,
    origination_fee_pct:gn("fin_origination_fee_pct")||null,origination_fee_amount:gn("fin_origination_fee_amount")||null,
    service_fee:gn("fin_service_fee")||null,prorated_interest:gn("fin_prorated_interest")||null,
    other_lender_fees:gn("fin_other_lender_fees")||null,
    escrow_fee:gn("fin_escrow_fee")||null,lenders_title_insurance:gn("fin_lenders_title_insurance")||null,
    recording_fees:gn("fin_recording_fees")||null,notary_doc_prep:gn("fin_notary_doc_prep")||null,
    wire_fee:gn("fin_wire_fee")||null,
    total_closing_costs:gn("fin_total_closing_costs")||null,total_cash_to_close:gn("fin_total_cash_to_close")||null,
    cash_source_breakdown:{cash:gn("fin_csb_cash")||0,loc:gn("fin_csb_loc")||0,commission_credit:gn("fin_csb_commission")||0},
    max_draws:gn("fin_max_draws")||null,holdback_pct:gn("fin_holdback_pct")||null,
    draw_fee:gn("fin_draw_fee")||null,final_draw_min_pct:gn("fin_final_draw_min_pct")||10,
    funded_date:gv("fin_funded_date")||null,notes:gv("fin_notes")||null,
    status:finData?.status||"application"
  };
  if(_pendingFinUrl)payload.closing_disclosure_url=_pendingFinUrl;

  try{
    if(finData){
      const res=await fetch(SB+"/rest/v1/deal_financing?id=eq."+finData.id,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(payload)});
      if(!res.ok){showRenoToast("Failed to save financing");return;}
    }else{
      const res=await fetch(SB+"/rest/v1/deal_financing",{method:"POST",headers:RENO_WH,body:JSON.stringify(payload)});
      if(!res.ok){showRenoToast("Failed to save financing");return;}
    }

    // Sync lender fields back to deals table
    const dealSync={
      lender_name:payload.lender_name||null,lender_loan_number:payload.loan_number||null,
      lender_interest_rate:payload.interest_rate,lender_max_draws:payload.max_draws,
      lender_holdback_pct:payload.holdback_pct,lender_draw_fee:payload.draw_fee
    };
    await fetch(SB+"/rest/v1/deals?id=eq."+dealId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(dealSync)});
    const dl=deals.find(x=>x.id===dealId);
    if(dl)Object.assign(dl,dealSync);

    _pendingFinUrl=null;
    showRenoToast("Financing saved");
    await loadFinancing(dealId);
    if(renoDealId===dealId){await loadRenoData(dealId);if(renoSub==="budget"){const el=document.getElementById("renoContent");if(el)renderBudget(el);}}
    closeRenoModal();
  }catch(e){console.error("Save financing failed:",e);showRenoToast("Failed to save financing");}
}

// ═══ SOW UPLOAD & ADD LINE ═══
const SOW_CATEGORIES=["kitchen","bathrooms","flooring","paint","electrical","plumbing","hvac","roofing","landscaping","windows","doors","drywall","demolition","framing","insulation","exterior","garage","foundation","cabinets","countertops","appliances","siding","gutters","fence","concrete","tile","hardware","cleaning","permits","contingency","general"];
let sowParsedLines=[];

function openSOWUpload(){
  const area=document.getElementById("sowUploadArea");if(!area)return;
  if(area.innerHTML){area.innerHTML="";return;}
  const ala=document.getElementById("sowAddLineArea");if(ala)ala.innerHTML="";

  let h=`<div style="margin-top:12px;padding:16px;border-radius:12px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15)">`;
  if(renoSOW.length)h+=`<div style="padding:10px 12px;border-radius:10px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);font-size:11px;color:#eab308;margin-bottom:10px">⚠️ ${renoSOW.length} SOW lines already exist. Uploading will <strong>replace</strong> matching line numbers and add new ones.</div>`;
  h+=`<div style="font-size:11px;color:#94a3b8;margin-bottom:10px">Upload your lender's Scope of Work PDF. AI will parse line items automatically.</div>`;
  h+=`<input type="file" id="sowFileInput" accept=".pdf" style="display:none" onchange="handleSOWFile(this)"/>`;
  h+=`<div id="sowFileLabel" onclick="document.getElementById('sowFileInput').click()" style="padding:20px;border-radius:10px;border:2px dashed rgba(212,175,55,0.2);background:rgba(212,175,55,0.02);text-align:center;cursor:pointer;color:#94a3b8;font-size:13px;font-weight:600;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(212,175,55,0.5)'" onmouseout="this.style.borderColor='rgba(212,175,55,0.2)'">📄 Choose PDF file</div>`;
  h+=`<div id="sowParseArea"></div>`;
  h+=`</div>`;
  area.innerHTML=h;
}

function handleSOWFile(input){
  const file=input.files[0];if(!file)return;
  const label=document.getElementById("sowFileLabel");
  label.innerHTML=`📄 ${esc(file.name)} <span style="color:#64748b">(${(file.size/1024).toFixed(0)} KB)</span>`;
  label.style.borderColor="rgba(34,197,94,0.4)";label.style.color="#e2e8f0";
  const pa=document.getElementById("sowParseArea");
  pa.innerHTML=`<button onclick="parseSOWPDF()" class="btn" style="width:100%;margin-top:10px;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(212,175,55,0.08));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">🤖 Parse SOW with AI</button>`;
}

async function parseSOWPDF(){
  const file=document.getElementById("sowFileInput")?.files[0];if(!file)return;
  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key (stored locally only):");
    if(!apiKey)return;
    localStorage.setItem("sh_claude_key",apiKey);
  }
  const pa=document.getElementById("sowParseArea");
  pa.innerHTML=`<div style="text-align:center;padding:24px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#d4af37;font-weight:700">Parsing SOW with Claude...</div><div style="font-size:10px;color:#64748b;margin-top:4px">This may take 10-30 seconds</div></div>`;

  // Upload to storage
  const filePath=storagePath(renoDealId,"sow",file);
  await uploadToStorage(file,"sovereign-docs",filePath);

  try{
    const buf=await file.arrayBuffer();
    const bytes=new Uint8Array(buf);
    let binary="";const chunk=8192;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
    const b64=btoa(binary);

    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:4096,
        messages:[{role:"user",content:[
          {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
          {type:"text",text:"Parse this lender Scope of Work document. Extract each line item and return a JSON array. Each object must have: line_number (integer), category (one of: "+SOW_CATEGORIES.join(",")+"), description (string, the line item name/description), lender_approved (number, the dollar amount approved by the lender). Return ONLY the JSON array, no other text. Skip any total/summary rows. If a category doesn't match the list exactly, pick the closest match."}
        ]}]
      })
    });

    if(!res.ok){
      if(res.status===401){localStorage.removeItem("sh_claude_key");pa.innerHTML=`<div style="color:#ef4444;font-size:12px;padding:12px">❌ Invalid API key. Click Parse again to re-enter.</div>`;return;}
      const err=await res.text();pa.innerHTML=`<div style="color:#ef4444;font-size:12px;padding:12px">❌ API error ${res.status}: ${esc(err.substring(0,200))}</div>`;return;
    }

    const data=await res.json();
    sowParsedLines=await robustParseJSON(data,apiKey,true);
    if(!sowParsedLines.length){pa.innerHTML=`<div style="color:#ef4444;font-size:12px;padding:12px">❌ No line items found in document.</div>`;return;}
    renderSOWReview();
  }catch(e){
    console.error("SOW parse error:",e);
    pa.innerHTML=`<div style="color:#ef4444;font-size:12px;padding:12px">❌ Parse failed: ${esc(e.message)}</div>`;
  }
}

function renderSOWReview(){
  const pa=document.getElementById("sowParseArea");if(!pa)return;
  const total=sowParsedLines.reduce((s,l)=>s+(l.lender_approved||0),0);
  let h=`<div style="margin-top:12px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:10px;color:#22c55e;font-weight:700;letter-spacing:1.5px">✓ PARSED ${sowParsedLines.length} LINE ITEMS</div><div style="font-size:12px;color:#d4af37;font-weight:800">Total: ${$r(total)}</div></div>`;
  h+=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th style="width:30px"><input type="checkbox" id="sowChkAll" checked onchange="sowToggleAll(this.checked)" style="accent-color:#d4af37"/></th><th>#</th><th>Category</th><th>Description</th><th style="text-align:right">Approved</th></tr></thead><tbody>`;
  sowParsedLines.forEach((l,i)=>{
    const cc=RENO_CAT_COLORS[(l.category||"").toLowerCase()]||"#64748b";
    h+=`<tr>`;
    h+=`<td><input type="checkbox" class="sowChk" data-idx="${i}" checked style="accent-color:#d4af37"/></td>`;
    h+=`<td><input type="number" class="cinput sowLN" data-idx="${i}" value="${l.line_number||i+1}" style="width:45px;min-height:30px;font-size:11px;padding:4px 6px;text-align:center"/></td>`;
    h+=`<td><select class="cinput sowCat" data-idx="${i}" style="min-height:30px;font-size:11px;padding:4px 6px">`;
    SOW_CATEGORIES.forEach(c=>{h+=`<option value="${c}"${c===(l.category||"").toLowerCase()?" selected":""}>${c.replace(/_/g," ")}</option>`;});
    h+=`</select></td>`;
    h+=`<td><input type="text" class="cinput sowDesc" data-idx="${i}" value="${esc(l.description||"")}" style="min-height:30px;font-size:11px;padding:4px 6px;width:100%"/></td>`;
    h+=`<td style="text-align:right"><input type="number" class="cinput sowAmt" data-idx="${i}" value="${l.lender_approved||0}" style="width:90px;min-height:30px;font-size:11px;padding:4px 6px;text-align:right"/></td>`;
    h+=`</tr>`;
  });
  h+=`</tbody></table></div>`;
  h+=`<button onclick="confirmSOWSave()" class="btn" style="width:100%;margin-top:10px;padding:14px;font-size:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:800;border:none">✓ Confirm & Save ${sowParsedLines.length} Lines</button>`;
  h+=`</div>`;
  pa.innerHTML=h;
}

function sowToggleAll(checked){document.querySelectorAll(".sowChk").forEach(cb=>{cb.checked=checked;});}

async function confirmSOWSave(){
  const rows=[];
  document.querySelectorAll(".sowChk").forEach(cb=>{
    if(!cb.checked)return;
    const i=Number(cb.dataset.idx);
    const ln=Number(document.querySelector(`.sowLN[data-idx="${i}"]`)?.value)||i+1;
    const cat=document.querySelector(`.sowCat[data-idx="${i}"]`)?.value||"general";
    const desc=document.querySelector(`.sowDesc[data-idx="${i}"]`)?.value||"";
    const amt=Number(document.querySelector(`.sowAmt[data-idx="${i}"]`)?.value)||0;
    rows.push({deal_id:renoDealId,line_number:ln,category:cat,description:desc,lender_approved:amt,planned_budget:amt,status:"not_started"});
  });
  if(!rows.length){showRenoToast("No lines selected");return;}

  const pa=document.getElementById("sowParseArea");
  pa.innerHTML=`<div style="text-align:center;padding:16px"><div style="width:20px;height:20px;border:2px solid rgba(34,197,94,0.2);border-top-color:#22c55e;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#22c55e;font-weight:700">Saving ${rows.length} lines...</div></div>`;

  try{
    let saved=0,errors=0;
    for(const row of rows){
      const existing=renoSOW.find(s=>s.line_number===row.line_number);
      if(existing){
        const res=await fetch(SB+"/rest/v1/renovation_sow_lines?id=eq."+existing.id,{method:"PATCH",headers:RENO_WH,body:JSON.stringify({category:row.category,description:row.description,lender_approved:row.lender_approved,planned_budget:row.planned_budget})});
        if(res.ok)saved++;else errors++;
      }else{
        const res=await fetch(SB+"/rest/v1/renovation_sow_lines",{method:"POST",headers:RENO_WH,body:JSON.stringify(row)});
        if(res.ok)saved++;else errors++;
      }
    }
    sowParsedLines=[];
    const area=document.getElementById("sowUploadArea");if(area)area.innerHTML="";
    showRenoToast(saved+" SOW lines saved"+(errors?" ("+errors+" errors)":""));
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){
    console.error("SOW save error:",e);
    showRenoToast("Failed to save SOW lines");
  }
}

function openAddLineForm(){
  const area=document.getElementById("sowAddLineArea");if(!area)return;
  if(area.innerHTML){area.innerHTML="";return;}
  const ua=document.getElementById("sowUploadArea");if(ua)ua.innerHTML="";

  const nextNum=renoSOW.length?Math.max(...renoSOW.map(s=>s.line_number||0))+1:1;
  let h=`<div style="margin-top:12px;padding:16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:1.5px;margin-bottom:10px">ADD SOW LINE</div>`;
  h+=`<div class="reno-eg">`;
  h+=`<div class="fld"><label>LINE #</label><input id="alNum" type="number" class="cinput" value="${nextNum}" style="width:70px"/></div>`;
  h+=`<div class="fld"><label>CATEGORY</label><select id="alCat" class="cinput">`;
  SOW_CATEGORIES.forEach(c=>{h+=`<option value="${c}">${c.replace(/_/g," ")}</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld"><label>DESCRIPTION</label><input id="alDesc" type="text" class="cinput" placeholder="Line item description"/></div>`;
  h+=`<div class="fld"><label>LENDER APPROVED</label><input id="alAmt" type="number" class="cinput" placeholder="$0"/></div>`;
  h+=`</div>`;
  h+=`<button onclick="saveNewSOWLine()" class="btn" style="width:100%;padding:12px;font-size:13px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">Add Line</button>`;
  h+=`</div>`;
  area.innerHTML=h;
}

async function saveNewSOWLine(){
  const ln=Number(document.getElementById("alNum")?.value);
  const cat=document.getElementById("alCat")?.value;
  const desc=(document.getElementById("alDesc")?.value||"").trim();
  const amt=Number(document.getElementById("alAmt")?.value)||0;
  if(!ln||!desc){showRenoToast("Fill in line number and description");return;}

  try{
    const existing=await sb("renovation_sow_lines?deal_id=eq."+renoDealId+"&line_number=eq."+ln);
    if(Array.isArray(existing)&&existing.length){
      const ex=existing[0];
      if(!confirm("Line #"+ln+" already exists: "+(ex.description||ex.category||"")+". Update it with these new values?"))return;
      const res=await fetch(SB+"/rest/v1/renovation_sow_lines?id=eq."+ex.id,{method:"PATCH",headers:RENO_WH,body:JSON.stringify({category:cat,description:desc,lender_approved:amt,planned_budget:amt})});
      if(!res.ok){showRenoToast("Failed to update line");return;}
      const area=document.getElementById("sowAddLineArea");if(area)area.innerHTML="";
      showRenoToast("Line #"+ln+" updated");
    }else{
      const payload={deal_id:renoDealId,line_number:ln,category:cat,description:desc,lender_approved:amt,planned_budget:amt,status:"not_started"};
      const res=await fetch(SB+"/rest/v1/renovation_sow_lines",{method:"POST",headers:RENO_WH,body:JSON.stringify(payload)});
      if(!res.ok){showRenoToast("Failed to add line");return;}
      const area=document.getElementById("sowAddLineArea");if(area)area.innerHTML="";
      showRenoToast("Line #"+ln+" added");
    }
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Add SOW line failed:",e);showRenoToast("Failed to add line");}
}

async function deleteSOWLine(lid){
  const line = renoSOW.find(s=>s.id===lid);
  const lineNum = line ? '#'+line.line_number+' — '+(line.description||'') : 'this line';
  if(!confirm('Delete '+lineNum+'? This cannot be undone.'))return;
  try{
    const expCheck = await sb('renovation_expenses?sow_line_id=eq.'+lid+'&select=id&limit=1');
    if(Array.isArray(expCheck)&&expCheck.length){
      if(!confirm('This line has linked expenses. Deleting will unlink them. Continue?'))return;
    }
    await fetch(SB+'/rest/v1/renovation_sow_lines?id=eq.'+lid,{method:'DELETE',headers:RENO_WH});
    renoExpandedLine=null;
    showRenoToast('SOW line deleted');
    await loadRenoData(renoDealId);
    renderRenoSub();
  }catch(e){console.error('Delete SOW line failed:',e);showRenoToast('Failed to delete line');}
}

// ═══ TASKS VIEW ═══
function taskAssigneeName(email){return TASK_ASSIGNEES[email]||email||"Unassigned";}

function renderTasksV(el){
  const all=renoTasks;
  const todo=all.filter(t=>t.status==='todo').length;
  const inp=all.filter(t=>t.status==='in_progress').length;
  const blk=all.filter(t=>t.status==='waiting').length;
  const done=all.filter(t=>t.status==='done').length;

  let h='';

  // Summary cards
  h+=`<div class="reno-sgrid"><div class="reno-scard"><div class="reno-sl">TO DO</div><div class="reno-sv" style="color:#94a3b8">${todo}</div></div><div class="reno-scard"><div class="reno-sl">IN PROGRESS</div><div class="reno-sv" style="color:#3b82f6">${inp}</div></div><div class="reno-scard"><div class="reno-sl">WAITING ON</div><div class="reno-sv" style="color:#ef4444">${blk}</div></div><div class="reno-scard"><div class="reno-sl">DONE</div><div class="reno-sv" style="color:#22c55e">${done}</div></div></div>`;

  // Filter row — categories
  const cats=[{k:"all",l:"All"},{k:"financing",l:"Financing"},{k:"contractor",l:"Contractor"},{k:"materials",l:"Materials"},{k:"design",l:"Design"},{k:"permits",l:"Permits"},{k:"administrative",l:"Admin"},{k:"listing_prep",l:"Listing"}];
  h+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">`;
  cats.forEach(c=>{h+=`<button class="filt${renoTaskFilter.cat===c.k?' on':''}" onclick="renoTaskFilter.cat='${c.k}';renderRenoSub()">${c.l}</button>`;});
  h+=`</div>`;

  // Filter row — assignee
  h+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">`;
  h+=`<button class="filt${renoTaskFilter.assignee==='all'?' on':''}" onclick="renoTaskFilter.assignee='all';renderRenoSub()">All</button>`;
  h+=`<button class="filt${renoTaskFilter.assignee==='mine'?' on':''}" onclick="renoTaskFilter.assignee='mine';renderRenoSub()">My Tasks</button>`;
  h+=`<button class="filt${renoTaskFilter.assignee==='lisa'?' on':''}" onclick="renoTaskFilter.assignee='lisa';renderRenoSub()">Lisa's Tasks</button>`;
  h+=`</div>`;

  // Add task button + inline form
  h+=`<button onclick="renoEditingTask='new';renderRenoSub()" class="btn" style="width:100%;padding:10px;font-size:13px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800;margin-bottom:12px">+ Add Task</button>`;

  if(renoEditingTask==='new')h+=renderTaskForm(null);

  // Filter tasks
  let ft=all.filter(t=>t.status!=='done');
  if(renoTaskFilter.cat!=='all')ft=ft.filter(t=>t.category===renoTaskFilter.cat);
  if(renoTaskFilter.assignee==='mine')ft=ft.filter(t=>t.assigned_to_email===SH_USER?.email);
  else if(renoTaskFilter.assignee==='lisa')ft=ft.filter(t=>t.assigned_to_email==='lisa@lisaahunt.com');

  // Sort: urgent first, then by status order, then sort_order
  const statOrd={todo:1,in_progress:2,waiting:3};
  const priOrd={urgent:0,high:1,normal:2,low:3};
  ft.sort((a,b)=>(priOrd[a.priority]??2)-(priOrd[b.priority]??2)||(statOrd[a.status]??4)-(statOrd[b.status]??4)||(a.sort_order||0)-(b.sort_order||0));

  if(!ft.length&&!done)h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No tasks yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Add your first task to start tracking what needs to happen.</div></div>`;

  ft.forEach(t=>{h+=renderTaskCard(t);});

  // Done tasks (collapsed)
  let doneTasks=all.filter(t=>t.status==='done');
  if(renoTaskFilter.cat!=='all')doneTasks=doneTasks.filter(t=>t.category===renoTaskFilter.cat);
  if(renoTaskFilter.assignee==='mine')doneTasks=doneTasks.filter(t=>t.assigned_to_email===SH_USER?.email);
  else if(renoTaskFilter.assignee==='lisa')doneTasks=doneTasks.filter(t=>t.assigned_to_email==='lisa@lisaahunt.com');

  if(doneTasks.length){
    h+=`<button onclick="renoShowDone=!renoShowDone;renderRenoSub()" style="background:none;border:none;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;padding:8px 0;margin-top:8px">${renoShowDone?'▾':'▸'} Show completed (${doneTasks.length})</button>`;
    if(renoShowDone)doneTasks.forEach(t=>{h+=renderTaskCard(t);});
  }

  el.innerHTML=h;
}

function renderTaskCard(t){
  const isDone=t.status==='done';
  const isBlocked=t.status==='waiting';
  const isUrgent=t.priority==='urgent';
  const cc=TASK_CAT_COLORS[t.category]||"#64748b";
  const name=taskAssigneeName(t.assigned_to_email);
  const now=new Date();now.setHours(0,0,0,0);
  let dueTxt='',dueColor='#64748b';
  if(t.due_date){
    const dd=new Date(t.due_date+"T00:00:00");
    dueTxt="Due "+dd.toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"America/Los_Angeles"});
    if(!isDone){
      const diff=(dd-now)/(864e5);
      if(diff<0)dueColor="#ef4444";
      else if(diff<=3)dueColor="#f97316";
    }
  }

  let h=`<div class="task-card${isDone?' done':''}${isUrgent&&!isDone?' urgent':''}">`;

  // Checkbox
  h+=`<div class="task-check${isDone?' done':''}${isBlocked?' waiting':''}" onclick="event.stopPropagation();toggleTaskDone('${t.id}','${t.status}')">${isDone?'✓':isBlocked?'!':''}</div>`;

  // Content
  h+=`<div style="flex:1;min-width:0">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">`;
  h+=`<div onclick="event.stopPropagation();openTaskEdit('${t.id}')" style="font-size:13px;font-weight:700;color:${isDone?'#64748b':'#e2e8f0'};cursor:pointer;${isDone?'text-decoration:line-through;':''}">${esc(t.title||"")}</div>`;
  // Priority + status menu
  h+=`<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">`;
  if(t.priority==='urgent')h+=`<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#ef4444">URGENT</span>`;
  else if(t.priority==='high')h+=`<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.15);color:#f97316">HIGH</span>`;
  else if(t.priority==='low')h+=`<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(100,116,139,0.15);color:#64748b">LOW</span>`;
  // Status dropdown
  h+=`<select onchange="event.stopPropagation();changeTaskStatus('${t.id}',this.value)" style="font-size:9px;padding:2px 4px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:#131316;color:#94a3b8;cursor:pointer;min-height:0">`;
  ['todo','in_progress','waiting','done'].forEach(s=>{h+=`<option value="${s}"${t.status===s?' selected':''}>${s==='in_progress'?'In Progress':s==='waiting'?'Waiting On':s.charAt(0).toUpperCase()+s.slice(1)}</option>`;});
  h+=`</select>`;
  h+=`</div></div>`;

  // Meta line
  h+=`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:3px;font-size:11px">`;
  h+=`<span style="padding:1px 6px;border-radius:4px;background:${cc}15;color:${cc};font-size:9px;font-weight:700;border:1px solid ${cc}30">${(t.category||"").replace(/_/g," ")}</span>`;
  h+=`<span style="color:#64748b">${name}</span>`;
  if(dueTxt)h+=`<span style="color:${dueColor};font-weight:600">${dueTxt}</span>`;
  if(isDone&&t.completed_at)h+=`<span style="color:#22c55e;font-size:10px">Completed ${new Date(t.completed_at).toLocaleDateString("en-US",{month:"numeric",day:"numeric",timeZone:"America/Los_Angeles"})}</span>`;
  h+=`</div>`;

  if(t.notes)h+=`<div style="font-size:11px;color:#475569;margin-top:4px">${esc(t.notes)}</div>`;

  // Inline edit form
  if(renoEditingTask===t.id)h+=renderTaskForm(t);

  h+=`</div></div>`;
  return h;
}

function renderTaskForm(task){
  const isNew=!task;
  const t=task||{};
  let h=`<div class="task-form" style="margin-top:8px" onclick="event.stopPropagation()">`;
  h+=`<div class="fld"><label>TITLE</label><input id="tfTitle" type="text" class="cinput" style="min-height:36px;font-size:13px;padding:8px" value="${esc(t.title||'')}" placeholder="What needs to happen?"/></div>`;
  h+=`<div class="reno-eg">`;
  h+=`<div class="fld"><label>CATEGORY</label><select id="tfCat" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px">`;
  ['financing','contractor','materials','design','permits','administrative','listing_prep'].forEach(c=>{h+=`<option value="${c}"${(t.category||'financing')===c?' selected':''}>${c.replace(/_/g,' ')}</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld"><label>ASSIGNED TO</label><select id="tfAssign" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px"><option value="j@jmarshallhunt.com"${(t.assigned_to_email||'j@jmarshallhunt.com')==='j@jmarshallhunt.com'?' selected':''}>King J</option><option value="lisa@lisaahunt.com"${t.assigned_to_email==='lisa@lisaahunt.com'?' selected':''}>Lisa</option></select></div>`;
  h+=`<div class="fld"><label>PRIORITY</label><select id="tfPri" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px">`;
  ['urgent','high','normal','low'].forEach(p=>{h+=`<option value="${p}"${(t.priority||'normal')===p?' selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`;});
  h+=`</select></div>`;
  h+=`<div class="fld"><label>DUE DATE</label><input id="tfDue" type="date" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${t.due_date||''}"/></div>`;
  h+=`</div>`;
  h+=`<div class="fld"><label>NOTES</label><input id="tfNotes" type="text" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="${esc(t.notes||'')}" placeholder="Optional notes"/></div>`;

  h+=`<div style="display:flex;gap:8px;margin-top:6px">`;
  if(isNew){
    h+=`<button onclick="saveNewTask()" class="btn" style="flex:1;padding:10px;font-size:12px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Add Task</button>`;
  }else{
    h+=`<button onclick="saveEditTask('${t.id}')" class="btn" style="flex:1;padding:10px;font-size:12px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Save</button>`;
    h+=`<button onclick="deleteTask('${t.id}')" style="padding:10px 16px;font-size:12px;background:none;border:none;color:#ef4444;font-weight:700;cursor:pointer">Delete</button>`;
  }
  h+=`<button onclick="renoEditingTask=null;renderRenoSub()" style="padding:10px 16px;font-size:12px;background:none;border:none;color:#64748b;font-weight:700;cursor:pointer">Cancel</button>`;
  h+=`</div></div>`;
  return h;
}

function openTaskEdit(taskId){renoEditingTask=renoEditingTask===taskId?null:taskId;renderRenoSub();}

async function toggleTaskDone(taskId,curStatus){
  const isDone=curStatus==='done';
  const patch=isDone?{status:"todo",completed_at:null,completed_by:null}:{status:"done",completed_at:new Date().toISOString(),completed_by:SH_USER?.email||"unknown"};
  try{
    await fetch(SB+"/rest/v1/deal_tasks?id=eq."+taskId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    showRenoToast(isDone?"Task reopened":"Task completed ✓");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Toggle task failed:",e);showRenoToast("Failed to update task");}
}

async function changeTaskStatus(taskId,newStatus){
  const patch={status:newStatus};
  if(newStatus==='done'){patch.completed_at=new Date().toISOString();patch.completed_by=SH_USER?.email||"unknown";}
  else{patch.completed_at=null;patch.completed_by=null;}
  try{
    await fetch(SB+"/rest/v1/deal_tasks?id=eq."+taskId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    showRenoToast("Status → "+newStatus.replace(/_/g," "));
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Change task status failed:",e);showRenoToast("Failed to update task");}
}

async function saveNewTask(){
  const title=(document.getElementById("tfTitle")?.value||"").trim();
  if(!title){alert("Enter a task title.");return;}
  const payload={deal_id:renoDealId,title:title,category:document.getElementById("tfCat")?.value||"financing",assigned_to_email:document.getElementById("tfAssign")?.value||"j@jmarshallhunt.com",priority:document.getElementById("tfPri")?.value||"normal",due_date:document.getElementById("tfDue")?.value||null,notes:(document.getElementById("tfNotes")?.value||"").trim()||null,status:"todo",created_by_email:SH_USER?.email||"unknown",sort_order:renoTasks.length};
  try{
    const res=await fetch(SB+"/rest/v1/deal_tasks",{method:"POST",headers:RENO_WH,body:JSON.stringify(payload)});
    if(!res.ok){showRenoToast("Failed to add task");return;}
    renoEditingTask=null;
    showRenoToast("Task added");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Save task failed:",e);showRenoToast("Failed to add task");}
}

async function saveEditTask(taskId){
  const title=(document.getElementById("tfTitle")?.value||"").trim();
  if(!title){alert("Enter a task title.");return;}
  const patch={title:title,category:document.getElementById("tfCat")?.value||"financing",assigned_to_email:document.getElementById("tfAssign")?.value||"j@jmarshallhunt.com",priority:document.getElementById("tfPri")?.value||"normal",due_date:document.getElementById("tfDue")?.value||null,notes:(document.getElementById("tfNotes")?.value||"").trim()||null};
  try{
    await fetch(SB+"/rest/v1/deal_tasks?id=eq."+taskId,{method:"PATCH",headers:RENO_WH,body:JSON.stringify(patch)});
    renoEditingTask=null;
    showRenoToast("Task updated");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Edit task failed:",e);showRenoToast("Failed to update task");}
}

async function deleteTask(taskId){
  if(!confirm("Delete this task?"))return;
  try{
    await fetch(SB+"/rest/v1/deal_tasks?id=eq."+taskId,{method:"DELETE",headers:RENO_WH});
    renoEditingTask=null;
    showRenoToast("Task deleted");
    await loadRenoData(renoDealId);renderRenoSub();
  }catch(e){console.error("Delete task failed:",e);showRenoToast("Failed to delete task");}
}

// Restore search bar when leaving reno view
const _origRL=renderList;
renderList=function(){
  const sb2=document.getElementById("searchBox");
  if(sb2&&view!=="renovation")sb2.parentElement.parentElement.style.display="";
  _origRL();
};
