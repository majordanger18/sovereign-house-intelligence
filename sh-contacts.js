// Sovereign House Intelligence — Contacts Module
// ═══════════════════════════════════════════
// ═══ CONTACTS / CONTRACTORS / BIDS ═══
// ═══════════════════════════════════════════

const CT_COLORS={contractor:"#f97316",subcontractor:"#d97706",supplier:"#3b82f6",lender:"#22c55e",agent:"#a855f7",inspector:"#14b8a6",insurance:"#06b6d4",title_escrow:"#6366f1",designer:"#ec4899",other:"#64748b"};
const CT_TYPES=["contractor","subcontractor","supplier","lender","agent","inspector","insurance","title_escrow","designer","other"];
const CT_LABELS={contractor:"Contractor",subcontractor:"Subcontractor",supplier:"Supplier",lender:"Lender",agent:"Agent",inspector:"Inspector",insurance:"Insurance",title_escrow:"Title/Escrow",designer:"Designer",other:"Other"};
const BID_STAT_COLORS={received:"#64748b",evaluating:"#3b82f6",negotiating:"#eab308",accepted:"#22c55e",rejected:"#ef4444"};
const MAT_LABELS={contractor:"GC Buys",owner:"Owner Buys",split:"Split"};
const MAT_COLORS={contractor:"#f97316",owner:"#22c55e",split:"#eab308"};
const SPEC_SUGGESTIONS=["general_contractor","kitchen","tile","electrical","plumbing","paint","flooring","cabinets","countertops","appliances","pool","landscape","hvac","drywall","framing","doors","windows","roofing","concrete","demolition","siding","gutters","fence","cleaning"];

let ctList=[],ctPerf=[],ctBids=[],ctSub="directory",ctSearch="",ctTypeF="all",ctStatusF="active",ctDetailId=null;
let _pendingBidUrl=null,_pendingBidName=null;
let ctRatingOpen=null;
let ctQuotes=[],_sqrItems=[],_sqrMeta={},_sqrFile=null,_sqrContactId=null;
const SQ_CATS={flooring:"#f97316",tile:"#d97706",countertops:"#6366f1",cabinets:"#a855f7",appliances:"#3b82f6",plumbing_fixtures:"#14b8a6",lighting:"#eab308",hardware:"#64748b",paint:"#ec4899",doors_windows:"#22c55e",iron_work:"#ef4444",landscaping:"#4ade80",pool:"#06b6d4",other:"#94a3b8"};
const SQ_UNITS=["each","per_sf","per_lf","per_slab","per_unit","lot","per_box"];
const SQ_CAT_LABELS={flooring:"Flooring",tile:"Tile",countertops:"Countertops",cabinets:"Cabinets",appliances:"Appliances",plumbing_fixtures:"Plumbing",lighting:"Lighting",hardware:"Hardware",paint:"Paint",doors_windows:"Doors/Win",iron_work:"Iron Work",landscaping:"Landscape",pool:"Pool",other:"Other"};

function formatPhone(input){
  let val=input.value.replace(/\D/g,'');
  if(val.length>10)val=val.substring(0,10);
  if(val.length>=7)input.value='('+val.substring(0,3)+') '+val.substring(3,6)+'-'+val.substring(6);
  else if(val.length>=4)input.value='('+val.substring(0,3)+') '+val.substring(3);
  else if(val.length>0)input.value='('+val;
}

// ═══ TAB INJECTION ═══
// Wrap the already-wrapped renderDashboard from sh-renovation.js
const _ctOrigRD=renderDashboard;
renderDashboard=function(){_ctOrigRD();injectCtTab();if(view==="contacts")renderCtView();};
const _ctOrigSV=setView;
setView=function(v){if(v==="contacts"){view="contacts";renderDashboard();return;}_ctOrigSV(v);};

// Also wrap renderList to restore search bar
const _ctOrigRL=renderList;
renderList=function(){
  const sb2=document.getElementById("searchBox");
  if(sb2&&view!=="renovation"&&view!=="contacts")sb2.parentElement.parentElement.style.display="";
  _ctOrigRL();
};

function injectCtTab(){
  // Bottom nav handles contacts tab — nothing to inject
}

// ═══ MAIN RENDER ═══
async function renderCtView(){
  document.getElementById("countLabel").textContent="Contacts";
  const searchBox=document.getElementById("searchBox");if(searchBox)searchBox.parentElement.parentElement.style.display="none";

  let h='<div style="grid-column:1/-1" class="ct-wrap">';
  // Sub-view pills
  h+=`<div class="reno-pills"><button class="reno-pill${ctSub==="directory"?" active":""}" onclick="switchCtSub('directory')">Directory</button><button class="reno-pill${ctSub==="contractors"?" active":""}" onclick="switchCtSub('contractors')">Contractors</button><button class="reno-pill${ctSub==="bids"?" active":""}" onclick="switchCtSub('bids')">Bids</button></div>`;
  h+=`<div id="ctContent"><div style="text-align:center;padding:40px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div></div></div>`;
  h+='</div>';
  document.getElementById("listArea").innerHTML=h;
  await loadCtData();
  renderCtSub();
}

async function loadCtData(){
  try{
    const[c,p,b]=await Promise.all([
      sb("contacts?order=display_name"),
      sb("contractor_performance?order=avg_rating.desc.nullslast,total_spent_with.desc.nullslast"),
      sb("contractor_bids?select=*,contacts(display_name,company),deals(address,status)&order=deal_id,created_at")
    ]);
    ctList=Array.isArray(c)?c:[];
    ctPerf=Array.isArray(p)?p:[];
    ctBids=Array.isArray(b)?b:[];
  }catch(e){console.error("[SH] Contacts load error:",e);}
}

function switchCtSub(s){ctSub=s;ctDetailId=null;renderCtSub();}

function renderCtSub(){
  const el=document.getElementById("ctContent");if(!el)return;
  document.querySelectorAll(".reno-pill").forEach(p=>{p.classList.toggle("active",p.textContent.toLowerCase()===ctSub);});
  if(ctSub==="directory")renderDirectory(el);
  else if(ctSub==="contractors")renderContractors(el);
  else if(ctSub==="bids")renderBidsV(el);
}

// ═══ DIRECTORY VIEW ═══
function renderDirectory(el){
  // Only build the static shell (search, filters, buttons) if it doesn't exist yet
  if(!document.getElementById("ctListArea")){
    let h='';
    h+=`<div class="ct-filters"><div style="flex:1;min-width:200px"><input id="ctSrch" type="text" placeholder="Search name, company, phone, email..." value="${esc(ctSearch)}" oninput="ctSearch=this.value;renderCtList()" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:14px;outline:none"/></div>`;
    h+=`<select id="ctTF" class="cinput ct-fsel" onchange="ctTypeF=this.value;renderCtList()"><option value="all">All Types</option>`;
    CT_TYPES.forEach(t=>{h+=`<option value="${t}"${ctTypeF===t?" selected":""}>${CT_LABELS[t]}</option>`;});
    h+=`</select>`;
    h+=`<select id="ctSF" class="cinput ct-fsel" onchange="ctStatusF=this.value;renderCtList()"><option value="active"${ctStatusF==="active"?" selected":""}>Active</option><option value="inactive"${ctStatusF==="inactive"?" selected":""}>Inactive</option><option value="do_not_use"${ctStatusF==="do_not_use"?" selected":""}>Do Not Use</option><option value="all"${ctStatusF==="all"?" selected":""}>All</option></select></div>`;
    h+=`<div style="margin:12px 0;display:flex;gap:8px"><button onclick="openCtForm()" class="btn" style="flex:1;padding:8px 16px;font-size:12px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800;border-radius:10px;min-height:auto">+ Add Contact</button><button id="ctScanBtn" onclick="openContactUpload()" class="btn" style="padding:8px 16px;font-size:12px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800;border-radius:10px;min-height:auto">📷 Scan Contact</button></div>`;
    h+=`<div id="ctListArea"></div>`;
    el.innerHTML=h;
  }
  renderCtList();
}

function renderCtList(){
  const el=document.getElementById("ctListArea");if(!el)return;
  let list=[...ctList];
  if(ctStatusF!=="all")list=list.filter(c=>c.status===ctStatusF);
  if(ctTypeF!=="all")list=list.filter(c=>c.contact_type===ctTypeF);
  if(ctSearch){
    const q=ctSearch.toLowerCase();
    list=list.filter(c=>(c.display_name||"").toLowerCase().includes(q)||(c.company||"").toLowerCase().includes(q)||(c.phone||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q));
  }

  let h='';
  if(!list.length){
    h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">👤</div><div style="font-size:14px;font-weight:600;color:#94a3b8">${ctList.length?"No contacts match your filters.":"No contacts yet."}</div><div style="font-size:12px;color:#64748b;margin-top:6px">Add your first contractor, supplier, or vendor.</div></div>`;
    el.innerHTML=h;return;
  }

  h+=`<div style="font-size:11px;color:#475569;font-weight:600;margin-bottom:8px">${list.length} contact${list.length!==1?"s":""}</div>`;
  h+=`<div class="ct-list">`;
  list.forEach((c,i)=>{
    const tc=CT_COLORS[c.contact_type]||"#64748b";
    const sc2=c.status==="active"?"#22c55e":c.status==="do_not_use"?"#ef4444":"#64748b";
    const tags=Array.isArray(c.specialty_tags)?c.specialty_tags:[];
    h+=`<div class="ct-card" onclick="openCtDetail('${c.id}')" style="animation:fadeUp .3s ease ${i*20}ms both">`;
    h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px">`;
    h+=`<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><span class="ct-status-dot" style="background:${sc2}"></span><div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.display_name||"")}</div></div>`;
    if(c.company)h+=`<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(c.company)}</div>`;
    h+=`</div>`;
    h+=`<span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30;flex-shrink:0">${CT_LABELS[c.contact_type]||c.contact_type||"Other"}</span>`;
    h+=`</div>`;
    h+=`<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">`;
    if(c.phone)h+=`<a href="tel:${esc(c.phone)}" onclick="event.stopPropagation()" style="font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.phone)}</a>`;
    if(c.email)h+=`<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()" style="font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.email)}</a>`;
    h+=`</div>`;
    if(tags.length){
      h+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">`;
      tags.forEach(t=>{h+=`<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8">${esc(t.replace(/_/g," "))}</span>`;});
      h+=`</div>`;
    }
    if(c.status==="do_not_use")h+=`<div style="font-size:9px;color:#ef4444;margin-top:4px;font-weight:700">⚠ DO NOT USE${c.do_not_use_reason?" — "+esc(c.do_not_use_reason):""}</div>`;
    if(c.contact_scan_url)h+=`<div style="margin-top:6px"><a href="${esc(c.contact_scan_url)}" target="_blank" onclick="event.stopPropagation()" style="color:#d4af37;font-size:10px;font-weight:700;text-decoration:none">📄 Card</a></div>`;
    h+=`</div>`;
  });
  h+=`</div>`;
  el.innerHTML=h;
}

// ═══ CONTACT DETAIL ═══
async function openCtDetail(cid){
  const c=ctList.find(x=>x.id===cid);if(!c)return;
  const m=document.getElementById("contactsModal");
  const tc=CT_COLORS[c.contact_type]||"#64748b";
  const sc2=c.status==="active"?"#22c55e":c.status==="do_not_use"?"#ef4444":"#64748b";
  const tags=Array.isArray(c.specialty_tags)?c.specialty_tags:[];
  const isCtr=c.contact_type==="contractor"||c.contact_type==="subcontractor";

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  // Header
  h+=`<div style="margin-bottom:16px;padding-right:40px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px">CONTACT</div><span class="ct-status-dot" style="background:${sc2}"></span><span style="font-size:9px;color:${sc2};font-weight:700">${(c.status||"active").replace(/_/g," ").toUpperCase()}</span></div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-top:2px">${esc(c.display_name||"")}</div>`;
  if(c.company)h+=`<div style="font-size:12px;color:#64748b;margin-top:2px">${esc(c.company)}</div>`;
  h+=`<div style="margin-top:6px"><span class="reno-chip" style="color:${tc};background:${tc}15;border:1px solid ${tc}30">${CT_LABELS[c.contact_type]||c.contact_type||"Other"}</span></div></div>`;

  // Contact info
  h+=`<div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:16px">`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">CONTACT INFO</div>`;
  if(c.phone)h+=`<div class="ct-info-row"><span class="ct-info-l">Phone</span><a href="tel:${esc(c.phone)}" style="color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.phone)}</a></div>`;
  if(c.email)h+=`<div class="ct-info-row"><span class="ct-info-l">Email</span><a href="mailto:${esc(c.email)}" style="color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.email)}</a></div>`;
  if(c.address||c.city)h+=`<div class="ct-info-row"><span class="ct-info-l">Address</span><span style="color:#e2e8f0">${esc([c.address,c.city,c.state,c.zip].filter(Boolean).join(", "))}</span></div>`;
  if(c.website)h+=`<div class="ct-info-row"><span class="ct-info-l">Website</span><a href="${esc(c.website)}" target="_blank" style="color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.website)}</a></div>`;
  if(c.license_number)h+=`<div class="ct-info-row"><span class="ct-info-l">License #</span><span style="color:#e2e8f0">${esc(c.license_number)}</span></div>`;
  if(c.referred_by)h+=`<div class="ct-info-row"><span class="ct-info-l">Referred By</span><span style="color:#e2e8f0">${esc(c.referred_by)}</span></div>`;
  h+=`</div>`;

  // Relationship notes
  if(c.relationship_notes){
    h+=`<div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:16px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:6px">NOTES</div><div style="font-size:12px;color:#94a3b8;line-height:1.5">${esc(c.relationship_notes)}</div></div>`;
  }

  // Tags
  if(tags.length){
    h+=`<div style="margin-bottom:16px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">SPECIALTIES</div><div style="display:flex;gap:4px;flex-wrap:wrap">`;
    tags.forEach(t=>{h+=`<span style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8">${esc(t.replace(/_/g," "))}</span>`;});
    h+=`</div></div>`;
  }

  // Deal history (expenses)
  h+=`<div id="ctDetailDeals"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">DEAL HISTORY</div><div style="padding:8px;color:#64748b;font-size:11px">Loading...</div></div>`;

  // Bid history (if contractor type)
  if(isCtr)h+=`<div id="ctDetailBids"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px;margin-top:16px">BID HISTORY</div><div style="padding:8px;color:#64748b;font-size:11px">Loading...</div></div>`;

  // Supplier quotes
  const isSupplier=c.contact_type==="supplier";
  if(isSupplier)h+=`<div id="ctDetailQuotes" style="margin-top:16px"><div style="padding:8px;color:#64748b;font-size:11px">Loading quotes...</div></div>`;

  // Action buttons
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">`;
  h+=`<button onclick="openCtForm('${c.id}')" class="btn" style="padding:12px;font-size:13px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-weight:700">Edit Contact</button>`;
  if(c.status!=="inactive")h+=`<button onclick="archiveContact('${c.id}')" class="btn" style="padding:12px;font-size:13px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);color:#ef4444;font-weight:700">Archive</button>`;
  else h+=`<button onclick="reactivateContact('${c.id}')" class="btn" style="padding:12px;font-size:13px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);color:#22c55e;font-weight:700">Reactivate</button>`;
  h+=`</div>`;
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";

  // Load deal history async
  loadCtDealHistory(cid,isCtr);
  if(isSupplier)loadCtQuotes(cid);
}

async function loadCtDealHistory(cid,isCtr){
  try{
    const ex=await sb("renovation_expenses?contact_id=eq."+cid+"&select=deal_id,amount,expense_date,description,deals(address)&order=expense_date.desc");
    const el=document.getElementById("ctDetailDeals");if(!el)return;
    if(!Array.isArray(ex)||!ex.length){el.innerHTML=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">DEAL HISTORY</div><div style="padding:8px;color:#475569;font-size:11px">No deal history yet.</div>`;
    }else{
      // Group by deal
      const byDeal={};
      ex.forEach(e=>{const did=e.deal_id;if(!byDeal[did])byDeal[did]={address:e.deals?.address||"Unknown",total:0,items:[]};byDeal[did].total+=e.amount||0;byDeal[did].items.push(e);});
      let dh=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">DEAL HISTORY</div>`;
      Object.entries(byDeal).forEach(([did,d])=>{
        dh+=`<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:12px;font-weight:700;color:#e2e8f0">${esc(d.address)}</div><div style="font-size:12px;font-weight:800;color:#d4af37">${$r(d.total)}</div></div><div style="font-size:10px;color:#64748b;margin-top:2px">${d.items.length} expense${d.items.length!==1?"s":""}</div></div>`;
      });
      el.innerHTML=dh;
    }

    // Bid history
    if(isCtr){
      const bids=await sb("contractor_bids?contact_id=eq."+cid+"&select=*,deals(address)&order=bid_date.desc");
      const bel=document.getElementById("ctDetailBids");if(!bel)return;
      if(!Array.isArray(bids)||!bids.length){bel.innerHTML=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px;margin-top:16px">BID HISTORY</div><div style="padding:8px;color:#475569;font-size:11px">No bids recorded.</div>`;
      }else{
        let bh=`<div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px;margin-top:16px">BID HISTORY</div>`;
        bids.forEach(b=>{
          const bsc=BID_STAT_COLORS[b.status]||"#64748b";
          bh+=`<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:6px${b.status==="accepted"?";border-left:3px solid #22c55e":""}">`;
          bh+=`<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:12px;font-weight:700;color:#e2e8f0">${esc(b.deals?.address||"—")}</div><span class="reno-chip" style="color:${bsc};background:${bsc}15;border:1px solid ${bsc}30">${(b.status||"received").replace(/_/g," ")}</span></div>`;
          bh+=`<div style="display:flex;gap:12px;margin-top:6px;font-size:11px;color:#94a3b8">`;
          bh+=`<span>Initial: <span style="font-weight:700;color:#e2e8f0">${$r(b.initial_bid)}</span></span>`;
          if(b.negotiated_bid)bh+=`<span>Negotiated: <span style="font-weight:700;color:#eab308">${$r(b.negotiated_bid)}</span></span>`;
          if(b.final_contracted)bh+=`<span>Final: <span style="font-weight:700;color:#22c55e">${$r(b.final_contracted)}</span></span>`;
          bh+=`</div>`;
          if(b.overall_rating)bh+=`<div style="margin-top:4px">${renderStars(b.overall_rating)}</div>`;
          bh+=`</div>`;
        });
        bel.innerHTML=bh;
      }
    }
  }catch(e){console.error("Load ct detail error:",e);}
}

function renderStars(n){
  let h='';const full=Math.floor(n||0),half=(n||0)%1>=0.5;
  for(let i=0;i<5;i++){
    if(i<full)h+=`<span style="color:#d4af37;font-size:12px">★</span>`;
    else if(i===full&&half)h+=`<span style="color:#d4af37;font-size:12px">★</span>`;
    else h+=`<span style="color:#27272a;font-size:12px">★</span>`;
  }
  if(n)h+=`<span style="font-size:10px;color:#64748b;margin-left:4px">${Number(n).toFixed(1)}</span>`;
  return h;
}

// ═══ ADD / EDIT CONTACT FORM ═══
function openCtForm(editId,prefill){
  const c=editId?ctList.find(x=>x.id===editId):null;
  const isEdit=!!c;
  const pf=prefill||{};
  const m=document.getElementById("contactsModal");

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">${isEdit?"EDIT":"NEW"} CONTACT</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">${isEdit?esc(c.display_name):"Add Contact"}</div>`;

  // Required fields
  h+=`<div class="row2"><div class="fld"><label>FIRST NAME</label><input id="cfFirst" type="text" class="cinput" value="${isEdit?esc(c.first_name||""):esc(pf.first_name||"")}"/></div>`;
  h+=`<div class="fld"><label>LAST NAME</label><input id="cfLast" type="text" class="cinput" value="${isEdit?esc(c.last_name||""):esc(pf.last_name||"")}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>COMPANY</label><input id="cfCo" type="text" class="cinput" value="${isEdit?esc(c.company||""):esc(pf.company||"")}"/></div>`;
  h+=`<div class="fld"><label>TYPE</label><select id="cfType" class="cinput">`;
  CT_TYPES.forEach(t=>{h+=`<option value="${t}"${((isEdit?c.contact_type:pf.contact_type)||"")=== t?" selected":""}>${CT_LABELS[t]}</option>`;});
  h+=`</select></div></div>`;

  // Contact fields
  h+=`<div class="row2"><div class="fld"><label>PHONE</label><input id="cfPhone" type="tel" class="cinput" value="${isEdit?esc(c.phone||""):esc(pf.phone||"")}" oninput="formatPhone(this)"/></div>`;
  h+=`<div class="fld"><label>EMAIL</label><input id="cfEmail" type="email" class="cinput" value="${isEdit?esc(c.email||""):esc(pf.email||"")}"/></div></div>`;
  h+=`<div class="fld"><label>ADDRESS</label><input id="cfAddr" type="text" class="cinput" value="${isEdit?esc(c.address||""):esc(pf.address||"")}"/></div>`;
  h+=`<div class="row3"><div class="fld"><label>CITY</label><input id="cfCity" type="text" class="cinput" value="${isEdit?esc(c.city||""):esc(pf.city||"Las Vegas")}"/></div>`;
  h+=`<div class="fld"><label>STATE</label><input id="cfState" type="text" class="cinput" value="${isEdit?esc(c.state||""):esc(pf.state||"NV")}"/></div>`;
  h+=`<div class="fld"><label>ZIP</label><input id="cfZip" type="text" class="cinput" value="${isEdit?esc(c.zip||""):esc(pf.zip||"")}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>WEBSITE</label><input id="cfWeb" type="url" class="cinput" value="${isEdit?esc(c.website||""):esc(pf.website||"")}"/></div>`;
  h+=`<div class="fld"><label>LICENSE #</label><input id="cfLic" type="text" class="cinput" value="${isEdit?esc(c.license_number||""):esc(pf.license_number||"")}"/></div></div>`;
  h+=`<div class="fld"><label>REFERRED BY</label><input id="cfRef" type="text" class="cinput" value="${isEdit?esc(c.referred_by||""):""}"/></div>`;

  // Tags
  const existingTags=isEdit&&Array.isArray(c.specialty_tags)?c.specialty_tags.join(", "):pf.specialty_tags&&pf.specialty_tags.length?pf.specialty_tags.join(", "):"";
  h+=`<div class="fld"><label>SPECIALTY TAGS <span style="font-weight:400;color:#475569">(comma-separated)</span></label><input id="cfTags" type="text" class="cinput" placeholder="electrical, plumbing, hvac..." value="${esc(existingTags)}"/></div>`;

  h+=`<div class="fld"><label>NOTES</label><textarea id="cfNotes" rows="3" class="cinput" style="min-height:60px;font-size:13px">${isEdit?esc(c.relationship_notes||""):esc(pf.notes||"")}</textarea></div>`;

  // Status
  h+=`<div class="row2"><div class="fld"><label>STATUS</label><select id="cfStatus" class="cinput"><option value="active"${(!isEdit||c.status==="active")?" selected":""}>Active</option><option value="inactive"${isEdit&&c.status==="inactive"?" selected":""}>Inactive</option><option value="do_not_use"${isEdit&&c.status==="do_not_use"?" selected":""}>Do Not Use</option></select></div>`;
  h+=`<div class="fld" id="cfDnuWrap" style="display:${isEdit&&c.status==="do_not_use"?"block":"none"}"><label>REASON</label><input id="cfDnu" type="text" class="cinput" value="${isEdit?esc(c.do_not_use_reason||""):""}"/></div></div>`;

  h+=`<button onclick="saveContact(${isEdit?"'"+c.id+"'":"null"})" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">${isEdit?"Save Changes":"Add Contact"}</button>`;
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";

  // Show/hide DNU reason
  setTimeout(()=>{
    const sel=document.getElementById("cfStatus");
    if(sel)sel.addEventListener("change",()=>{const w=document.getElementById("cfDnuWrap");if(w)w.style.display=sel.value==="do_not_use"?"block":"none";});
  },50);
}

async function saveContact(editId){
  const gv=id=>(document.getElementById(id)?.value||"").trim();
  const first=gv("cfFirst"),last=gv("cfLast"),company=gv("cfCo");
  if(!first&&!last&&!company){alert("Enter a name or company.");return;}

  const tagsRaw=gv("cfTags");
  const tags=tagsRaw?tagsRaw.split(",").map(s=>s.trim().toLowerCase().replace(/\s+/g,"_")).filter(Boolean):[];

  const payload={
    first_name:first||null,last_name:last||null,company:gv("cfCo")||null,
    contact_type:gv("cfType")||"other",phone:gv("cfPhone")||null,email:gv("cfEmail")||null,
    address:gv("cfAddr")||null,city:gv("cfCity")||null,state:gv("cfState")||null,zip:gv("cfZip")||null,
    website:gv("cfWeb")||null,license_number:gv("cfLic")||null,referred_by:gv("cfRef")||null,
    specialty_tags:tags.length?tags:null,relationship_notes:gv("cfNotes")||null,
    status:gv("cfStatus")||"active",do_not_use_reason:gv("cfStatus")==="do_not_use"?gv("cfDnu")||null:null
  };

  try{
    if(editId){
      await fetch(SB+"/rest/v1/contacts?id=eq."+editId,{method:"PATCH",headers:HD,body:JSON.stringify(payload)});
    }else{
      await fetch(SB+"/rest/v1/contacts",{method:"POST",headers:HD,body:JSON.stringify(payload)});
    }
    closeCtModal();showCtToast(editId?"Contact updated":"Contact added");
    await loadCtData();renderCtSub();
    // Contact Picker "Add New" callback
    if(typeof window._cpPostSaveCallback==='function'&&!editId){
      const newest=ctList.reduce((a,b)=>(a.created_at||'')>(b.created_at||'')?a:b,ctList[0]);
      if(newest)window._cpPostSaveCallback(newest);
      window._cpPostSaveCallback=null;
    }
  }catch(e){console.error("Save contact failed:",e);alert("Failed to save contact.");}
}

async function archiveContact(cid){
  if(!confirm("Archive this contact? They will be marked as inactive."))return;
  try{
    await fetch(SB+"/rest/v1/contacts?id=eq."+cid,{method:"PATCH",headers:HD,body:JSON.stringify({status:"inactive"})});
    closeCtModal();showCtToast("Contact archived");
    await loadCtData();renderCtSub();
  }catch(e){console.error("Archive contact failed:",e);}
}

async function reactivateContact(cid){
  try{
    await fetch(SB+"/rest/v1/contacts?id=eq."+cid,{method:"PATCH",headers:HD,body:JSON.stringify({status:"active",do_not_use_reason:null})});
    closeCtModal();showCtToast("Contact reactivated");
    await loadCtData();renderCtSub();
  }catch(e){console.error("Reactivate contact failed:",e);}
}

// ═══ CONTRACTORS VIEW ═══
function renderContractors(el){
  if(!ctPerf.length){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">🔧</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No contractor performance data yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Ratings and accuracy scores populate after your first completed deal.</div></div>`;
    return;
  }

  const ctIds=new Set(ctList.filter(c=>(c.contact_type==="contractor"||c.contact_type==="subcontractor")&&c.status!=="inactive"&&c.status!=="do_not_use").map(c=>c.id));
  const filtPerf=ctPerf.filter(p=>ctIds.has(p.contact_id));
  if(!filtPerf.length){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">🔧</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No contractor performance data yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Ratings and accuracy scores populate after your first completed deal.</div></div>`;
    return;
  }
  let h=`<div style="font-size:11px;color:#475569;font-weight:600;margin-bottom:8px">${filtPerf.length} contractor${filtPerf.length!==1?"s":""}</div>`;
  // Pre-compute dimension averages per contractor from ctBids
  const ctDimAvgs={};
  ctBids.forEach(b=>{
    const cid=b.contact_id;if(!cid)return;
    if(!ctDimAvgs[cid])ctDimAvgs[cid]={ba:[],tl:[],ql:[],cm:[]};
    if(b.rating_bid_accuracy!=null)ctDimAvgs[cid].ba.push(b.rating_bid_accuracy);
    if(b.rating_timeline!=null)ctDimAvgs[cid].tl.push(b.rating_timeline);
    if(b.rating_quality!=null)ctDimAvgs[cid].ql.push(b.rating_quality);
    if(b.rating_communication!=null)ctDimAvgs[cid].cm.push(b.rating_communication);
  });
  const dimAvg=arr=>arr.length?(arr.reduce((a,v)=>a+v,0)/arr.length).toFixed(1):null;

  filtPerf.forEach((p,i)=>{
    const tc=CT_COLORS[p.contact_type]||"#f97316";
    const tags=Array.isArray(p.specialty_tags)?p.specialty_tags:[];
    const baColor=bidAccColor(p.avg_bid_accuracy);
    const taColor=bidAccColor(p.avg_timeline_accuracy);
    const coColor=(p.total_change_orders||0)>3?"#ef4444":(p.total_change_orders||0)>=1?"#eab308":"#22c55e";
    const da=ctDimAvgs[p.contact_id]||{ba:[],tl:[],ql:[],cm:[]};
    const hasDimRatings=da.ba.length||da.tl.length||da.ql.length||da.cm.length;
    const allDims=[...da.ba,...da.tl,...da.ql,...da.cm];
    const overallDimAvg=allDims.length?(allDims.reduce((a,v)=>a+v,0)/allDims.length).toFixed(1):null;

    h+=`<div class="ct-card ct-perf-card" onclick="openCtDetail('${p.contact_id}')" style="animation:fadeUp .3s ease ${i*20}ms both">`;
    h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:10px">`;
    h+=`<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.display_name||"")}`;
    if(overallDimAvg)h+=` <span style="font-size:11px;color:#d4af37;font-weight:700">★ ${overallDimAvg}</span>`;
    else h+=` <span style="font-size:10px;color:#475569;font-weight:600">No ratings yet</span>`;
    h+=`</div>`;
    if(p.company)h+=`<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(p.company)}</div>`;
    h+=`</div>`;
    h+=`<div style="text-align:right">${renderStars(p.avg_rating)}</div>`;
    h+=`</div>`;

    // Dimension ratings 2x2 grid
    if(hasDimRatings){
      h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-bottom:8px;padding:8px 10px;background:rgba(212,175,55,0.03);border:1px solid rgba(212,175,55,0.08);border-radius:8px">`;
      const dimData=[{label:"Bid Accuracy",val:dimAvg(da.ba)},{label:"Timeline",val:dimAvg(da.tl)},{label:"Quality",val:dimAvg(da.ql)},{label:"Communication",val:dimAvg(da.cm)}];
      dimData.forEach(d=>{
        h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0"><span style="font-size:9px;color:#64748b;font-weight:600">${d.label}</span>`;
        if(d.val)h+=`<span style="font-size:10px;color:#d4af37;font-weight:700">★ ${d.val}</span>`;
        else h+=`<span style="font-size:9px;color:#3f3f46">—</span>`;
        h+=`</div>`;
      });
      h+=`</div>`;
    }

    // Metrics grid
    h+=`<div class="ct-metrics-grid">`;
    h+=`<div class="ct-metric"><div class="ct-ml">BIDS</div><div class="ct-mv">${p.bids_accepted||0} / ${p.total_bids||0}</div></div>`;
    h+=`<div class="ct-metric"><div class="ct-ml">BID ACCURACY</div><div class="ct-mv" style="color:${baColor}">${p.avg_bid_accuracy!=null?Math.round(p.avg_bid_accuracy)+"%":"—"}</div></div>`;
    h+=`<div class="ct-metric"><div class="ct-ml">TIMELINE</div><div class="ct-mv" style="color:${taColor}">${p.avg_timeline_accuracy!=null?Math.round(p.avg_timeline_accuracy)+"%":"—"}</div></div>`;
    h+=`<div class="ct-metric"><div class="ct-ml">TOTAL SPENT</div><div class="ct-mv">${$r(p.total_spent_with)}</div></div>`;
    h+=`<div class="ct-metric"><div class="ct-ml">DEALS</div><div class="ct-mv">${p.deals_worked||0}</div></div>`;
    h+=`<div class="ct-metric"><div class="ct-ml">CHANGE ORDERS</div><div class="ct-mv" style="color:${coColor}">${p.total_change_orders||0}</div></div>`;
    h+=`</div>`;

    if(tags.length){
      h+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">`;
      tags.slice(0,5).forEach(t=>{h+=`<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8">${esc(t.replace(/_/g," "))}</span>`;});
      h+=`</div>`;
    }
    h+=`</div>`;
  });
  el.innerHTML=h;
}

function bidAccColor(v){if(v==null)return"#64748b";if(v>=95&&v<=105)return"#22c55e";if((v>=85&&v<95)||(v>105&&v<=115))return"#eab308";return"#ef4444";}

// ═══ BIDS VIEW ═══
function renderBidsV(el){
  let h='';
  h+=`<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="openBidUpload()" class="btn" style="flex:1;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">📄 Upload Bid</button><button onclick="openBidForm()" class="btn" style="flex:1;padding:12px;font-size:13px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-weight:700">+ Log Manually</button></div>`;

  if(!ctBids.length){
    h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No bids logged yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Upload or log your first contractor bid.</div></div>`;
    el.innerHTML=h;return;
  }

  // Group by deal
  const byDeal={};
  ctBids.forEach(b=>{const did=b.deal_id||"none";if(!byDeal[did])byDeal[did]={address:b.deals?.address||"Unknown Deal",bids:[]};byDeal[did].bids.push(b);});

  Object.entries(byDeal).forEach(([did,group])=>{
    h+=`<div style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(212,175,55,0.15);margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:#f1f5f9">${esc(group.address)}</div>`;
    const compBids=group.bids.filter(b=>b.sow_comparison&&(Array.isArray(b.sow_comparison)?b.sow_comparison.length:true));
    h+=`</div>`;
    h+=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>Contractor</th><th style="text-align:right">Initial</th><th style="text-align:right">Negotiated</th><th style="text-align:right">Final</th><th>Materials</th><th class="reno-hm">Timeline</th><th>Status</th>`;
    const hasActual=group.bids.some(b=>b.actual_total_cost);
    if(hasActual)h+=`<th style="text-align:right" class="reno-hm">Actual</th><th class="reno-hm">Accuracy</th><th class="reno-hm">Rating</th>`;
    h+=`<th></th></tr></thead><tbody>`;

    group.bids.forEach(b=>{
      const bsc=BID_STAT_COLORS[b.status]||"#64748b";
      const mc=MAT_COLORS[b.material_handling]||"#64748b";
      const ml=MAT_LABELS[b.material_handling]||b.material_handling||"—";
      const accepted=b.status==="accepted";
      const hasCmp=b.sow_comparison&&(Array.isArray(b.sow_comparison)?b.sow_comparison.length:true);
      h+=`<tr class="reno-r" onclick="openBidForm('${b.id}')" style="${accepted?"border-left:3px solid #22c55e":""}">`;
      h+=`<td style="font-weight:600;color:#e2e8f0">${esc(b.contacts?.display_name||"—")}${b.contacts?.company?`<div style="font-size:9px;color:#64748b">${esc(b.contacts.company)}</div>`:""}</td>`;
      h+=`<td style="text-align:right;font-weight:700">${$r(b.initial_bid)}${(b.current_revision||1)>1?` <span style="font-size:8px;color:#a855f7;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:4px;padding:1px 4px;font-weight:800">Rev ${b.current_revision}</span>`:""}</td>`;
      h+=`<td style="text-align:right">${b.negotiated_bid?$r(b.negotiated_bid):"—"}</td>`;
      h+=`<td style="text-align:right;font-weight:700;color:#22c55e">${b.final_contracted?$r(b.final_contracted):"—"}</td>`;
      h+=`<td><span class="reno-chip" style="color:${mc};background:${mc}15;border:1px solid ${mc}30">${ml}</span></td>`;
      h+=`<td class="reno-hm">${b.estimated_timeline_weeks?b.estimated_timeline_weeks+" wks":"—"}</td>`;
      h+=`<td><span class="reno-chip" style="color:${bsc};background:${bsc}15;border:1px solid ${bsc}30">${(b.status||"received").replace(/_/g," ")}</span></td>`;
      if(hasActual){
        h+=`<td style="text-align:right" class="reno-hm">${b.actual_total_cost?$r(b.actual_total_cost):"—"}</td>`;
        const baC=bidAccColor(b.bid_accuracy_pct);
        h+=`<td class="reno-hm">${b.bid_accuracy_pct!=null?`<span style="color:${baC};font-weight:700">${Math.round(b.bid_accuracy_pct)}%</span>`:"—"}</td>`;
        h+=`<td class="reno-hm">${b.overall_rating?renderStars(b.overall_rating):"—"}</td>`;
      }
      const rejected=b.status==="rejected";
      let awardHtml="";
      if(accepted)awardHtml=`<span style="color:#22c55e;font-size:10px;font-weight:800;padding:2px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:6px">✓ Awarded</span><button onclick="event.stopPropagation();undoAward('${b.id}')" style="background:none;border:none;color:#64748b;font-size:9px;font-weight:600;cursor:pointer;opacity:0.6;padding:2px 4px">Undo</button>`;
      else if(rejected)awardHtml=`<span style="color:#64748b;font-size:10px;font-weight:600;opacity:0.6">Rejected</span>`;
      else awardHtml=`<button onclick="event.stopPropagation();awardBid('${b.id}')" style="background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-size:10px;font-weight:800;cursor:pointer;padding:4px 10px;border-radius:6px">Award Bid</button>`;
      const hasLineItems=b.parsed_line_items&&b.parsed_line_items.sections;
      const revisionHtml=hasLineItems&&!accepted&&!rejected?`<button onclick="event.stopPropagation();uploadBidRevision('${b.id}')" style="background:none;border:none;color:#a855f7;font-size:10px;font-weight:700;cursor:pointer">Upload Revision</button>`:"";
      const hasHistory=Array.isArray(b.revision_history)&&b.revision_history.length>0;
      const historyHtml=hasHistory?`<button onclick="event.stopPropagation();viewRevisionHistory('${b.id}')" style="background:none;border:none;color:#a855f7;font-size:10px;font-weight:700;cursor:pointer;opacity:0.8">History (${b.revision_history.length})</button>`:"";
      const rateableStatuses=["renovation_complete","listing_prep","listed","sold","closing"];
      const dealStatus=b.deals?.status||"";
      const canRate=rateableStatuses.includes(dealStatus);
      const hasRatings=b.rating_bid_accuracy||b.rating_timeline||b.rating_quality||b.rating_communication;
      const avgR=hasRatings?[b.rating_bid_accuracy,b.rating_timeline,b.rating_quality,b.rating_communication].filter(v=>v!=null):[];
      const avgRating=avgR.length?(avgR.reduce((a,v)=>a+v,0)/avgR.length).toFixed(1):null;
      let rateHtml="";
      if(canRate){
        if(hasRatings)rateHtml=`<button onclick="event.stopPropagation();toggleRatingPanel('${b.id}')" style="background:none;border:none;color:#d4af37;font-size:10px;font-weight:700;cursor:pointer">★ ${avgRating} — Edit</button>`;
        else rateHtml=`<button onclick="event.stopPropagation();toggleRatingPanel('${b.id}')" style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);color:#d4af37;font-size:10px;font-weight:700;cursor:pointer;padding:3px 8px;border-radius:5px">Rate</button>`;
      }
      h+=`<td><div style="display:flex;align-items:center;gap:12px;white-space:nowrap">${b.bid_document_url?`<a href="${esc(b.bid_document_url)}" target="_blank" onclick="event.stopPropagation()" style="color:#d4af37;font-size:10px;font-weight:700;text-decoration:none">📄 Bid</a>`:""}${hasCmp?`<button onclick="event.stopPropagation();viewBidComparison('${b.id}')" style="background:none;border:none;color:#60a5fa;font-size:10px;font-weight:700;cursor:pointer">View SOW</button>`:""}${awardHtml}${revisionHtml}${historyHtml}${rateHtml}<button onclick="event.stopPropagation();deleteBid('${b.id}')" style="background:none;border:none;color:#ef4444;font-size:10px;font-weight:700;cursor:pointer;opacity:0.7;padding:4px 8px">Delete</button></div></td>`;
      h+=`</tr>`;
      if(ctRatingOpen===b.id){
        const colSpan=hasActual?11:8;
        h+=`<tr><td colspan="${colSpan}" style="padding:0;border-top:none">${buildRatingPanel(b)}</td></tr>`;
      }
    });
    h+=`</tbody></table></div>`;
    if(compBids.length>1){
      h+=`<div style="text-align:center;margin-top:10px"><span style="display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);color:#d4af37;font-size:10px;font-weight:800;letter-spacing:1px">${compBids.length} BIDS ON THIS DEAL</span></div>`;
      h+=`<button onclick="compareDealBids('${did}')" class="btn" style="width:100%;padding:12px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;border-radius:10px;margin-top:6px;cursor:pointer">Compare Bids</button>`;
    }
    h+=`</div>`;
  });
  el.innerHTML=h;
}

// ═══ BID FORM ═══
function openBidForm(editId){
  const b=editId?ctBids.find(x=>x.id===editId):null;
  const isEdit=!!b;
  const m=document.getElementById("contactsModal");
  const contractors=ctList.filter(c=>c.contact_type==="contractor"||c.contact_type==="subcontractor");

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">${isEdit?"EDIT":"LOG"} BID</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">${isEdit?"Update Bid":"New Contractor Bid"}</div>`;

  // Deal select
  h+=`<div class="fld"><label>DEAL</label><select id="bfDeal" class="cinput">`;
  deals.forEach(d=>{h+=`<option value="${d.id}"${isEdit&&b.deal_id===d.id?" selected":""}>${esc(d.address||"—")}</option>`;});
  h+=`</select></div>`;

  // Contractor select
  h+=`<div class="fld"><label>CONTRACTOR</label><select id="bfCont" class="cinput"><option value="">Select contractor...</option>`;
  contractors.forEach(c=>{h+=`<option value="${c.id}"${isEdit&&b.contact_id===c.id?" selected":""}>${esc(c.display_name)}${c.company?" — "+esc(c.company):""}</option>`;});
  h+=`<option value="__new__">+ Add New Contractor</option></select></div>`;

  // Bid amounts
  h+=`<div class="row2"><div class="fld"><label>INITIAL BID</label><input id="bfInit" type="number" class="cinput" value="${isEdit&&b.initial_bid?b.initial_bid:""}"/></div>`;
  h+=`<div class="fld"><label>BID DATE</label><input id="bfDate" type="date" class="cinput" value="${isEdit&&b.bid_date?b.bid_date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>NEGOTIATED BID</label><input id="bfNeg" type="number" class="cinput" value="${isEdit&&b.negotiated_bid?b.negotiated_bid:""}"/></div>`;
  h+=`<div class="fld"><label>FINAL CONTRACTED</label><input id="bfFinal" type="number" class="cinput" value="${isEdit&&b.final_contracted?b.final_contracted:""}"/></div></div>`;

  // Scope
  h+=`<div class="fld"><label>SCOPE DESCRIPTION</label><textarea id="bfScope" rows="3" class="cinput" style="min-height:60px;font-size:13px">${isEdit?esc(b.scope_description||""):""}</textarea></div>`;

  // Material handling
  h+=`<div class="row2"><div class="fld"><label>MATERIAL HANDLING</label><select id="bfMat" class="cinput"><option value="contractor"${isEdit&&b.material_handling==="contractor"?" selected":""}>GC Buys</option><option value="owner"${isEdit&&b.material_handling==="owner"?" selected":""}>Owner Buys</option><option value="split"${isEdit&&b.material_handling==="split"?" selected":""}>Split</option></select></div>`;
  h+=`<div class="fld"><label>MATERIAL NOTES</label><input id="bfMatN" type="text" class="cinput" placeholder="e.g. We buy cabinets, tile" value="${isEdit?esc(b.material_handling_notes||""):""}"/></div></div>`;

  // Toggles
  h+=`<div style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 12px">`;
  h+=`<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="bfPerm" style="accent-color:#d4af37"${isEdit&&b.includes_permits?" checked":""}/> Includes Permits</label>`;
  h+=`<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="bfDump" style="accent-color:#d4af37"${isEdit&&b.includes_dumpsters?" checked":""}/> Includes Dumpsters</label>`;
  h+=`<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;cursor:pointer"><input type="checkbox" id="bfClean" style="accent-color:#d4af37"${isEdit&&b.includes_final_clean?" checked":""}/> Includes Final Clean</label>`;
  h+=`</div>`;

  h+=`<div class="row2"><div class="fld"><label>PAYMENT TERMS</label><input id="bfPay" type="text" class="cinput" placeholder="50% upfront, 25% rough, 25% final" value="${isEdit?esc(b.payment_terms||""):""}"/></div>`;
  h+=`<div class="fld"><label>ESTIMATED TIMELINE (WEEKS)</label><input id="bfWeeks" type="number" class="cinput" value="${isEdit&&b.estimated_timeline_weeks?b.estimated_timeline_weeks:""}"/></div></div>`;

  // Status
  h+=`<div class="fld"><label>STATUS</label><select id="bfStat" class="cinput"><option value="received"${(!isEdit||b.status==="received")?" selected":""}>Received</option><option value="evaluating"${isEdit&&b.status==="evaluating"?" selected":""}>Evaluating</option><option value="negotiating"${isEdit&&b.status==="negotiating"?" selected":""}>Negotiating</option><option value="accepted"${isEdit&&b.status==="accepted"?" selected":""}>Accepted</option><option value="rejected"${isEdit&&b.status==="rejected"?" selected":""}>Rejected</option></select></div>`;

  h+=`<button onclick="saveBid(${isEdit?"'"+b.id+"'":"null"})" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">${isEdit?"Save Changes":"Log Bid"}</button>`;
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";

  // Handle "+ Add New Contractor" option
  setTimeout(()=>{
    const sel=document.getElementById("bfCont");
    if(sel)sel.addEventListener("change",()=>{if(sel.value==="__new__"){closeCtModal();openCtForm();}});
  },50);
}

async function saveBid(editId){
  const gv=id=>(document.getElementById(id)?.value||"").trim();
  const gn=id=>Number(document.getElementById(id)?.value)||0;
  const dealId=gv("bfDeal");
  const contactId=gv("bfCont");
  const initBid=gn("bfInit");
  if(!dealId||!contactId||!initBid){alert("Select a deal, contractor, and enter an initial bid.");return;}

  const payload={
    deal_id:dealId,contact_id:contactId,initial_bid:initBid,
    bid_date:gv("bfDate")||null,
    negotiated_bid:gn("bfNeg")||null,
    final_contracted:gn("bfFinal")||null,
    scope_description:gv("bfScope")||null,
    material_handling:gv("bfMat")||"contractor",
    material_handling_notes:gv("bfMatN")||null,
    includes_permits:!!document.getElementById("bfPerm")?.checked,
    includes_dumpsters:!!document.getElementById("bfDump")?.checked,
    includes_final_clean:!!document.getElementById("bfClean")?.checked,
    payment_terms:gv("bfPay")||null,
    estimated_timeline_weeks:gn("bfWeeks")||null,
    status:gv("bfStat")||"received"
  };

  try{
    if(editId){
      await fetch(SB+"/rest/v1/contractor_bids?id=eq."+editId,{method:"PATCH",headers:HD,body:JSON.stringify(payload)});
    }else{
      await fetch(SB+"/rest/v1/contractor_bids",{method:"POST",headers:HD,body:JSON.stringify(payload)});
    }
    closeCtModal();showCtToast(editId?"Bid updated":"Bid logged");
    await loadCtData();renderCtSub();
  }catch(e){console.error("Save bid failed:",e);alert("Failed to save bid.");}
}

// ═══ CONTACT SCANNER ═══
function openContactUpload(){
  // Use a persistent input element — iOS Safari drops file refs on dynamic inputs
  let input=document.getElementById('_contactFileInput');
  if(!input){
    input=document.createElement('input');
    input.id='_contactFileInput';
    input.type='file';
    input.accept='image/*,.pdf';
    input.style.display='none';
    document.body.appendChild(input);
  }
  input.value='';
  input.onchange=function(){
    const file=input.files[0];
    if(!file)return;
    window._pendingContactFile=file;
    setTimeout(()=>{parseContact(window._pendingContactFile);},100);
  };
  input.click();
}

async function parseContact(file){
  const scanBtn=document.getElementById('ctScanBtn');
  if(scanBtn){scanBtn.textContent='Scanning...';scanBtn.disabled=true;scanBtn.style.opacity='0.6';}
  showCtToast("Scanning contact...");

  // 1. Get API key first — fail fast if missing
  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey){if(scanBtn){scanBtn.textContent='📷 Scan Contact';scanBtn.disabled=false;scanBtn.style.opacity='1';}return;}
    localStorage.setItem("sh_claude_key",apiKey);
  }

  // 2. Convert file to base64 — resize large images to avoid API 400 errors
  let b64;
  let mediaType='image/jpeg';
  let docType='image';
  try{
    if(file.type==='application/pdf'){
      // PDF: read directly, no resize
      const dataUrl=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
      });
      b64=dataUrl.split(',')[1];
      mediaType='application/pdf';
      docType='document';
    }else{
      // Image: load into canvas, resize if needed, export as JPEG
      const imgDataUrl=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
      });
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(new Error('Image load failed'));
        img.src=imgDataUrl;
      });
      // Resize to max 1500px on longest side (keeps detail, reduces size dramatically)
      const maxDim=1500;
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>h){h=Math.round(h*(maxDim/w));w=maxDim;}
        else{w=Math.round(w*(maxDim/h));h=maxDim;}
      }
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const jpegDataUrl=canvas.toDataURL('image/jpeg',0.85);
      b64=jpegDataUrl.split(',')[1];
      mediaType='image/jpeg';
      docType='image';
      console.log("[Contact Scanner] Resized:",img.width+"x"+img.height,"→",w+"x"+h,"b64 len:",b64.length);
    }
  }catch(e){
    console.error("[Contact Scanner] File processing failed:",e);
    showCtToast("Failed to read file: "+e.message);
    openCtForm();
    if(scanBtn){scanBtn.textContent='📷 Scan Contact';scanBtn.disabled=false;scanBtn.style.opacity='1';}
    return;
  }

  // 4. Build Claude API request
  const content=[
    {type:docType,source:{type:"base64",media_type:mediaType,data:b64}},
    {type:"text",text:"Extract contact information from this image. This could be a business card, a phone screenshot, a contact detail screen, a text message, an email signature, a website, a social media profile, a Google search result, or any other source that contains a person's or company's contact details.\n\nIMPORTANT: On phone contact screens, the large text below the contact photo circle is the person's NAME, not a city or location. The smaller text above the name is usually the company. For example if you see 'ARTISTIC IRON WORKS' in small caps above 'Dallas' in large text, then first_name is 'Dallas' and company is 'Artistic Iron Works'. Do not put the person's name in the city field.\n\nLook for ANY of these details anywhere in the image: person's name (first and last), company or business name, phone number(s), email address(es), physical address, website or social media URLs, job title or role, license numbers, any contextual clues about what type of contact this is.\n\nReturn ONLY a JSON object with no markdown, no explanation, no backticks:\n\n{\"first_name\":\"First name or null\",\"last_name\":\"Last name or null\",\"company\":\"Company name or null\",\"contact_type\":\"best guess from: contractor, subcontractor, supplier, lender, agent, inspector, insurance, title_escrow, designer, attorney, other\",\"phone\":\"Primary phone formatted as (XXX) XXX-XXXX or null\",\"phone2\":\"Secondary phone or null\",\"email\":\"Email address or null\",\"address\":\"Street address or null\",\"city\":\"City or null\",\"state\":\"State abbreviation or null\",\"zip\":\"ZIP code or null\",\"website\":\"Website or null\",\"license_number\":\"License number or null\",\"specialty_tags\":[\"best guess tags\"],\"notes\":\"Job title, hours, or any other useful info found\"}\n\nExtract everything visible. Use null for fields not found. Make your best guess on contact_type from context."}
  ];

  // 5. Call Claude API — this is the critical parse step
  try{
    showCtToast("Analyzing with AI...");
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:content}]})
    });

    if(!res.ok){
      if(res.status===401)localStorage.removeItem("sh_claude_key");
      const errText=await res.text().catch(()=>"");
      console.error("[Contact Scanner] API error:",res.status,errText);
      throw new Error("API error "+res.status);
    }

    const data=await res.json();
    console.log("[Contact Scanner] Raw response:",JSON.stringify(data).substring(0,500));

    // Extract JSON directly from Claude response — don't rely on robustParseJSON
    let parsed=null;
    try{
      const rawText=data?.content?.[0]?.text||"";
      const cleaned=rawText.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      parsed=JSON.parse(cleaned);
    }catch(parseErr){
      console.error("[Contact Scanner] Direct JSON parse failed:",parseErr,"Raw:",data?.content?.[0]?.text);
      if(typeof robustParseJSON==='function'){
        try{parsed=await robustParseJSON(data,apiKey);}catch(e2){console.error("[Contact Scanner] robustParseJSON also failed:",e2);}
      }
    }
    console.log("[Contact Scanner] Parsed:",JSON.stringify(parsed));

    if(!parsed||(parsed.first_name===null&&parsed.last_name===null&&parsed.company===null&&parsed.phone===null)){
      showCtToast("Couldn't read contact info — try a clearer image");
      openCtForm();
      return;
    }

    prefillContactForm(parsed);
    showCtToast("Contact parsed — review and save");

  }catch(e){
    console.error("[Contact Scanner] Parse failed:",e);
    showCtToast("Scan failed: "+(e.message||"Unknown error"));
    openCtForm();
    return;
  }finally{
    if(scanBtn){scanBtn.textContent='📷 Scan Contact';scanBtn.disabled=false;scanBtn.style.opacity='1';}
  }

  // 6. Upload to storage in background AFTER parse succeeds — non-blocking
  try{
    const contactPath=storagePath(null,"contacts",file);
    uploadToStorage(file,"sovereign-docs",contactPath).catch(e=>console.warn("[Contact Scanner] Background storage upload failed:",e));
  }catch(e){
    console.warn("[Contact Scanner] Storage path error:",e);
  }
}

function prefillContactForm(parsed){
  openCtForm(null,parsed);
  showCtToast("Contact parsed — review and save");
}

// ═══ BID UPLOAD + AI PARSER ═══
async function openBidUpload(){
  const m=document.getElementById("contactsModal");
  const contractors=ctList.filter(c=>c.contact_type==="contractor"||c.contact_type==="subcontractor");

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">UPLOAD BID</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">Parse Contractor Bid</div>`;

  h+=`<div class="fld"><label>DEAL</label><select id="buDeal" class="cinput">`;
  deals.forEach(d=>{h+=`<option value="${d.id}">${esc(d.address||"—")}</option>`;});
  h+=`</select></div>`;

  h+=`<div class="fld"><label>CONTRACTOR</label><select id="buCont" class="cinput" onchange="if(this.value==='__new__')document.getElementById('buNewCtr').style.display='block'"><option value="">Select contractor...</option>`;
  contractors.forEach(c=>{h+=`<option value="${c.id}">${esc(c.display_name)}${c.company?" — "+esc(c.company):""}</option>`;});
  h+=`<option value="__new__">+ New Contractor</option></select></div>`;

  h+=`<div id="buNewCtr" style="display:none;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:10px">`;
  h+=`<div class="row2"><div class="fld"><label>NAME</label><input id="buNewName" type="text" class="cinput" placeholder="First Last"/></div>`;
  h+=`<div class="fld"><label>COMPANY</label><input id="buNewCo" type="text" class="cinput"/></div></div>`;
  h+=`<div class="fld"><label>PHONE</label><input id="buNewPh" type="tel" class="cinput"/></div></div>`;

  h+=`<div class="fld"><label>BID DOCUMENT</label><div id="buFileLabel" onclick="document.getElementById('buFileInput').click()" style="padding:20px;border-radius:10px;border:2px dashed rgba(212,175,55,0.2);background:rgba(212,175,55,0.02);text-align:center;cursor:pointer;color:#94a3b8;font-size:13px;font-weight:600;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(212,175,55,0.5)'" onmouseout="this.style.borderColor='rgba(212,175,55,0.2)'">📄 Choose PDF, JPG, or PNG</div><input type="file" id="buFileInput" accept=".pdf,image/*" style="display:none" onchange="if(this.files[0]){const l=document.getElementById('buFileLabel');l.innerHTML='📄 '+this.files[0].name;l.style.borderColor='rgba(34,197,94,0.4)';l.style.color='#e2e8f0'}"/></div>`;

  h+=`<button onclick="parseBid()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:8px">🤖 Parse Bid</button>`;
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function parseBid(){
  const file=document.getElementById("buFileInput")?.files[0];
  if(!file){alert("Select a bid document.");return;}
  const dealId=document.getElementById("buDeal")?.value;
  let contactId=document.getElementById("buCont")?.value;

  // Create new contractor if needed
  if(contactId==="__new__"){
    const name=(document.getElementById("buNewName")?.value||"").trim();
    if(!name){alert("Enter contractor name.");return;}
    const parts=name.split(" ");
    const payload={first_name:parts[0]||null,last_name:parts.slice(1).join(" ")||null,company:(document.getElementById("buNewCo")?.value||"").trim()||null,phone:(document.getElementById("buNewPh")?.value||"").trim()||null,contact_type:"contractor",status:"active"};
    try{
      const res=await fetch(SB+"/rest/v1/contacts",{method:"POST",headers:HD,body:JSON.stringify(payload)});
      if(!res.ok)throw new Error("Failed to create contact");
      const result=await res.json();
      contactId=Array.isArray(result)?result[0]?.id:result?.id;
      await loadCtData();
    }catch(e){console.error("Create contractor failed:",e);alert("Failed to create contractor.");return;}
  }

  if(!contactId||contactId==="__new__"){alert("Select a contractor.");return;}

  // Show loading
  const m=document.getElementById("contactsModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button><div style="text-align:center;padding:40px"><div style="width:24px;height:24px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#d4af37;font-weight:700">Parsing bid with AI...</div><div style="font-size:10px;color:#64748b;margin-top:4px">This may take 30-60 seconds for large documents</div><div style="font-size:10px;color:#475569;margin-top:8px">Do not close this window</div></div></div>`;

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey){closeCtModal();return;}
    localStorage.setItem("sh_claude_key",apiKey);
  }

  // Upload to storage
  const bidPath=storagePath(dealId,"bids",file);
  _pendingBidUrl=await uploadToStorage(file,"sovereign-docs",bidPath);
  _pendingBidName=file.name;

  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);
  let binary="";const chunk=8192;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  const b64=btoa(binary);

  const mediaType=file.type.startsWith('image/')?file.type:'application/pdf';
  const docType=file.type.startsWith('image/')?'image':'document';

  // Fetch SOW lines BEFORE Claude call so we can include them in the prompt
  let sowLines=[];
  try{const sw=await sb("renovation_sow_lines?deal_id=eq."+dealId+"&order=line_number&lender_approved=gt.0");sowLines=Array.isArray(sw)?sw:[];}catch(e){}

  const sowContext=sowLines.length?"\n\nALSO: Here are the lender-approved SOW budget lines for this project. For each section in the bid, tell me which SOW line(s) it maps to. A section can map to one or more SOW lines. Multiple bid sections CAN map to the same SOW line (e.g. Primary Bathroom and Secondary Bathrooms both map to the Bathrooms SOW line). Include the mapping in each section object.\n\nSOW LINES:\n"+sowLines.map(l=>"#"+l.line_number+" "+l.category+" — "+l.description+" ($"+l.lender_approved+")").join("\n")+"\n\nAdd to each section object in your response:\n  \"sow_line_matches\": [{\"line_number\": 14, \"description\": \"Bathrooms\", \"budget\": 34000}]\n\nIf a section has NO matching SOW line, set sow_line_matches to an empty array [].\nIf a section spans multiple SOW lines (like Kitchen + Appliances), include all matches.":"";

  const content=[
    {type:docType,source:{type:"base64",media_type:mediaType,data:b64}},
    {type:"text",text:"Parse this contractor bid document. The bid is organized into SECTIONS (bold headers like DEMOLITION, KITCHEN RENOVATION, etc.) with individual line items under each section.\n\nReturn ONLY a JSON object — no markdown, no backticks, no explanation:\n\n{\"contractor_name\":\"Company name\",\"contractor_address\":\"Address if visible\",\"contractor_phone\":\"Phone if visible\",\"bid_date\":\"YYYY-MM-DD or null\",\"project_address\":\"Project address if visible\",\"sections\":[{\"section_name\":\"DEMOLITION\",\"items\":[{\"item_number\":1,\"description\":\"Dumpster Rental and Debris Removal\",\"amount\":1800},{\"item_number\":2,\"description\":\"Remove all Existing Flooring\",\"amount\":3200}],\"section_total\":12100,\"sow_line_matches\":[{\"line_number\":2,\"description\":\"Demolition\",\"budget\":12000}]}],\"subtotal\":350800,\"overhead_pct\":15,\"overhead_amount\":52620,\"total_bid\":403420,\"tbd_items\":[\"description of any TBD items\"],\"notes\":\"Any payment terms or conditions\"}\n\nRULES:\n- Preserve EXACT section groupings from the document bold headers\n- section_total = sum of all item amounts in that section\n- Items marked TBD get amount: 0 and go in tbd_items array\n- Overhead/profit is separate, NOT inside any section\n- subtotal = sum of all section_totals before overhead\n- total_bid = subtotal + overhead_amount\n- Return ONLY valid JSON"+sowContext}
  ];

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8192,messages:[{role:"user",content:content}]})
    });
    if(!res.ok){if(res.status===401)localStorage.removeItem("sh_claude_key");throw new Error("API error "+res.status);}
    const data=await res.json();
    if(data.stop_reason==="max_tokens"){console.warn("Bid response truncated at max_tokens — sections may be missing");showCtToast("Warning: bid response was truncated, some sections may be missing");}
    const parsed=await robustParseJSON(data,apiKey);
    console.log("Parsed bid data:", parsed);

    // Build comparison from hardcoded BID_SOW_MAP
    const comparison=buildSectionComparison(parsed,sowLines);
    const unmatchedSOW=sowLines.filter(s=>!_bidUsedSOW.has(s.line_number)&&(s.lender_approved||0)>0);

    renderBidReview(parsed,comparison,unmatchedSOW,dealId,contactId);
  }catch(e){
    console.error("Bid parse error:",e);
    const errMsg=e.message||"Unknown error";
    m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button><div style="text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px">⚠️</div><div style="font-size:14px;font-weight:700;color:#ef4444;margin-bottom:4px">Failed to parse bid</div><div style="font-size:12px;color:#94a3b8;margin-bottom:16px">${esc(errMsg)}</div><button onclick="openBidUpload()" class="btn" style="padding:12px 24px;font-size:13px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:700">Try Again</button><button onclick="closeCtModal()" class="btn" style="padding:12px 24px;font-size:13px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-weight:700;margin-left:8px">Cancel</button></div></div>`;
  }
}

// ═══ SECTION-TO-SOW COMPARISON (hardcoded map) ═══
const BID_SOW_MAP={
  'DEMOLITION':['Demo'],
  'FOYER / ENTRY':[8,9,22],
  'BAR FEATURE WALL':['Other'],
  'CONVERT DINING ROOM NICHE INTO BAR FEATURE WALL':[21],
  'KITCHEN RENOVATION':['Kitchen','Plumbing','Appliances'],
  'KITCHEN RENOVATION / CABINETRY & APPLIANCES':[13,15,18],
  'FAMILY ROOM':['Electrical'],
  'PRIMARY BEDROOM':[8,21],
  'PRIMARY BATHROOM':['Bathrooms','Windows'],
  'LAUNDRY ROOM':[14],
  'SECONDARY BATHROOMS':[14],
  'FLOORING':['Flooring'],
  'WHOLE HOUSE IMPROVEMENTS':['Carpentry','Paint','Drywall'],
  'ELECTRICAL':[16],
  'EXTERIOR IMPROVEMENTS':['Exterior'],
  'LANDSCAPING':['Landscape'],
  'POOL AREA':[21],
  'MECHANICAL':['HVAC'],
  'GENERAL':[2,8,9,10,11],
  'KITCHEN':[13,15,18],
  'BATHROOM':[14],
  'PRIMARY BATH':[14,6],
  'SECONDARY BATH':[14],
  'WALK IN':[14],
  'LAUNDRY':[14],
  'FLOORING':[12],
  'ELECTRICAL':[16],
  'PLUMBING':[15],
  'HVAC':[17],
  'EXTERIOR':[5],
  'LANDSCAPE':[19],
  'POOL':[21],
  'FIREPLACE':[21],
  'DOORS':[9,22],
  'WINDOWS':[6],
  'FRAMING':[8],
  'PAINT':[11],
  'DRYWALL':[10],
  'DEMO':[2],
  'FOYER':[8,9,21,22],
  'BAR':[21],
  'COFFEE':[21]
};
let _bidUsedSOW=new Set();

function buildSectionComparison(parsed,sowLines){
  _bidUsedSOW=new Set();
  const _firstOwner={};
  return(parsed.sections||[]).map(section=>{
    const secName=(section.section_name||'').toUpperCase().trim();
    let mapCats=BID_SOW_MAP[secName];
    if(!mapCats){const keys=Object.keys(BID_SOW_MAP).sort((a,b)=>b.length-a.length);for(const key of keys){if(secName.includes(key)){mapCats=BID_SOW_MAP[key];break;}}}
    mapCats=mapCats||[];
    // Find matching SOW lines by category from hardcoded map
    const allMatches=[];
    mapCats.forEach(cat=>{
      if(typeof cat==='number'){
        const match=(sowLines||[]).find(s=>s.line_number===cat);
        if(match&&!allMatches.some(m=>m.line_number===match.line_number)){
          allMatches.push({line_number:match.line_number,description:match.description||match.category,budget:match.lender_approved||0});
        }
      }else{
        const catLower=cat.toLowerCase();
        let matches=(sowLines||[]).filter(s=>(s.category||'').toLowerCase()===catLower||(s.description||'').toLowerCase()===catLower);
        if(!matches.length)matches=(sowLines||[]).filter(s=>(s.category||'').toLowerCase().includes(catLower)||(s.description||'').toLowerCase().includes(catLower));
        matches.forEach(match=>{
          if(!allMatches.some(m=>m.line_number===match.line_number)){
            allMatches.push({line_number:match.line_number,description:match.description||match.category,budget:match.lender_approved||0});
          }
        });
      }
    });
    // De-duplicate: only count SOW budget on the FIRST section that maps to it
    const newMatches=[];const dupeMatches=[];
    allMatches.forEach(m=>{
      if(!_bidUsedSOW.has(m.line_number)){
        _bidUsedSOW.add(m.line_number);
        _firstOwner[m.line_number]=section.section_name;
        newMatches.push(m);
      }else{
        dupeMatches.push({...m,counted_in:_firstOwner[m.line_number]});
      }
    });
    const sowTotal=newMatches.reduce((sum,m)=>sum+(m.budget||0),0);
    const delta=(section.section_total||0)-sowTotal;
    const deltaPct=sowTotal>0?Math.round((delta/sowTotal)*100):null;
    return{
      section_name:section.section_name,
      bid_total:section.section_total||0,
      item_count:(section.items||[]).length,
      items:section.items||[],
      sow_matches:newMatches,
      sow_dupes:dupeMatches,
      sow_total:sowTotal,
      delta:delta,
      delta_pct:deltaPct,
      has_sow_match:mapCats.length>0
    };
  });
}

function bidDeltaDisplay(c){
  if(!c.has_sow_match)return{color:'#f59e0b',text:'NOT IN SOW'};
  const absPct=Math.abs(c.delta_pct||0);
  if(c.delta>0&&absPct>10)return{color:'#ef4444',text:'+'+$r(c.delta)+' (+'+c.delta_pct+'%)'};
  if(c.delta<0&&absPct>10)return{color:'#22c55e',text:$r(c.delta)+' ('+c.delta_pct+'%)'};
  return{color:'#64748b',text:'≈ '+$r(c.delta)};
}

// ═══ SHARED BID COMPARISON RENDERER ═══
function renderBidComparisonBody(parsed,comparison,unmatchedSOW){
  const subtotal=parsed.subtotal||(parsed.sections||[]).reduce((s,sec)=>s+(sec.section_total||0),0);
  const overhead=parsed.overhead_amount||parsed.overhead||0;
  const overheadPct=parsed.overhead_pct||parsed.overhead_percent||0;
  const totalBid=parsed.total_bid||parsed.total||subtotal+overhead;
  const matchedSOW=comparison.reduce((s,c)=>s+c.sow_total,0);
  const unmatchedSOWTotal=(unmatchedSOW||[]).reduce((s,u)=>s+(u.lender_approved||u.budget||0),0);
  const totalSOW=matchedSOW+unmatchedSOWTotal;
  const totalDelta=totalBid-totalSOW;
  const unmatchedBidTotal=comparison.filter(c=>!c.has_sow_match).reduce((s,c)=>s+c.bid_total,0);
  const tbd=parsed.tbd_items||[];
  let h='';

  // Section rows
  comparison.forEach(c=>{
    const dd=bidDeltaDisplay(c);
    const noMatch=!c.has_sow_match;
    const allSOWRefs=[...(c.sow_matches||[]),...(c.sow_dupes||[])];
    const sowNums=allSOWRefs.map(s=>'#'+s.line_number).join(', ')||'—';
    h+=`<div style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:6px;overflow:hidden${noMatch?';border-left:3px solid #f59e0b':''}">`;
    h+=`<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;cursor:pointer;background:rgba(255,255,255,0.02)">`;
    h+=`<div style="flex:1"><div style="font-size:12px;font-weight:700;color:#e2e8f0">${esc(c.section_name)}</div>`;
    h+=`<div style="font-size:10px;color:#64748b;margin-top:2px">${c.item_count} items → SOW ${noMatch?'<span style="color:#f59e0b">NOT IN SOW</span>':esc(sowNums)}</div></div>`;
    h+=`<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:#f1f5f9">${$r(c.bid_total)}</div>`;
    h+=`<div style="font-size:10px;color:${dd.color};font-weight:700">${dd.text}</div></div>`;
    if(c.sow_matches&&c.sow_matches.length)h+=`<div style="text-align:right;min-width:60px;margin-left:8px"><div style="font-size:10px;color:#64748b">SOW</div><div style="font-size:12px;color:#94a3b8">${$r(c.sow_total)}</div></div>`;
    h+=`</div>`;
    // Expandable items
    h+=`<div style="display:none;padding:8px 12px;border-top:1px solid rgba(255,255,255,0.04)">`;
    (c.items||[]).forEach(item=>{
      h+=`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#94a3b8"><span>${esc(item.description||'')}</span><span>${item.amount?$r(item.amount):'TBD'}</span></div>`;
    });
    if(c.sow_matches&&c.sow_matches.length){
      h+=`<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);font-size:10px;color:#64748b">SOW matches: ${c.sow_matches.map(s=>'#'+s.line_number+' '+esc(s.description||'')+' ('+$r(s.budget||s.lender_approved)+')').join(' · ')}</div>`;
    }
    if(c.sow_dupes&&c.sow_dupes.length){
      c.sow_dupes.forEach(d=>{
        h+=`<div style="font-size:10px;color:#475569;margin-top:2px">SOW #${d.line_number} (${$r(d.budget||0)} — counted in ${esc(d.counted_in||'earlier section')})</div>`;
      });
    }
    h+=`</div></div>`;
  });

  // Overhead row
  if(overhead>0){
    h+=`<div style="padding:10px 12px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:10px;margin-bottom:6px">`;
    h+=`<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:#f59e0b">Overhead & Profit (${overheadPct}%)</span><span style="font-size:13px;font-weight:700;color:#f59e0b">${$r(overhead)}</span></div></div>`;
  }

  // TBD warning
  if(tbd.length){
    h+=`<div style="padding:10px 12px;background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.15);border-radius:10px;margin:8px 0">`;
    h+=`<div style="font-size:10px;color:#eab308;font-weight:700">⚠️ TBD ITEMS (not priced)</div>`;
    h+=`<div style="font-size:11px;color:#94a3b8;margin-top:4px">${tbd.map(t=>esc(t)).join('<br>')}</div></div>`;
  }

  // Unmatched SOW lines
  if(unmatchedSOW&&unmatchedSOW.length){
    h+=`<div style="margin-top:8px"><div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:1px;margin-bottom:4px">SOW LINES NOT IN THIS BID</div>`;
    unmatchedSOW.forEach(s=>{
      h+=`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span style="color:#64748b">#${s.line_number} ${esc(s.description||'')}</span><span style="color:#64748b">${$r(s.lender_approved||s.budget)}</span></div>`;
    });
    h+=`</div>`;
  }

  // Summary box
  h+=`<div style="margin-top:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08)">`;
  h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#64748b">Contractor Subtotal</span><span style="color:#f1f5f9;font-weight:700">${$r(subtotal)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#64748b">Overhead (${overheadPct}%)</span><span style="color:#f59e0b;font-weight:700">${$r(overhead)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:8px"><span style="color:#f1f5f9;font-weight:800">CONTRACTOR TOTAL</span><span style="color:#f1f5f9;font-weight:800">${$r(totalBid)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;margin-top:8px"><span style="color:#64748b">Lender SOW Approved</span><span style="color:#94a3b8">${$r(totalSOW)}</span></div>`;
  const deltaColor=totalDelta>0?'#ef4444':totalDelta<0?'#22c55e':'#64748b';
  const deltaSign=totalDelta>0?'+':'';
  h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#64748b">Delta (vs SOW)</span><span style="color:${deltaColor};font-weight:700">${deltaSign}${$r(totalDelta)}</span></div>`;
  if(unmatchedBidTotal>0)h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#64748b">Items NOT in SOW</span><span style="color:#f59e0b">${$r(unmatchedBidTotal)}</span></div>`;
  if(tbd.length)h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:#64748b">TBD (unpriced)</span><span style="color:#eab308">${tbd.length} item${tbd.length>1?'s':''}</span></div>`;
  h+=`</div>`;
  return h;
}

// ═══ BID REVIEW DISPLAY (after fresh parse) ═══
function renderBidReview(parsed,comparison,unmatchedSOW,dealId,contactId){
  const m=document.getElementById("contactsModal");
  const ctrName=parsed.contractor_name||ctList.find(c=>c.id===contactId)?.display_name||"Contractor";
  const subtotal=parsed.subtotal||(parsed.sections||[]).reduce((s,sec)=>s+(sec.section_total||0),0);
  const overhead=parsed.overhead_amount||parsed.overhead||0;
  const overheadPct=parsed.overhead_pct||parsed.overhead_percent||0;
  const totalBid=parsed.total_bid||parsed.total||subtotal+overhead;

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">BID COMPARISON</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(ctrName)}</div>`;
  h+=`<div style="font-size:13px;color:#94a3b8;margin-bottom:16px">Subtotal: ${$r(subtotal)} + ${overheadPct}% Overhead: ${$r(overhead)} = <strong style="color:#f1f5f9">${$r(totalBid)}</strong></div>`;
  h+=renderBidComparisonBody(parsed,comparison,unmatchedSOW);
  h+=`<button onclick="saveParsedBid()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none;margin-top:12px">Save Bid</button>`;
  h+=`</div>`;

  m.innerHTML=h;
  m._parsedBid={parsed,comparison,unmatchedSOW,dealId,contactId};
}

async function saveParsedBid(){
  const m=document.getElementById("contactsModal");
  const d=m._parsedBid;if(!d)return;
  const{parsed,comparison,unmatchedSOW,dealId,contactId}=d;

  const payload={
    deal_id:dealId,contact_id:contactId,
    initial_bid:parsed.total_bid||parsed.total||(parsed.subtotal||0)+(parsed.overhead_amount||parsed.overhead||0),
    overhead_pct:parsed.overhead_pct||0,
    overhead_amount:parsed.overhead_amount||0,
    scope_description:(parsed.sections||[]).map(s=>s.section_name+': $'+s.section_total.toLocaleString()).join(' | '),
    bid_date:parsed.bid_date||new Date().toISOString().split("T")[0],
    status:"received",
    parsed_line_items:{...parsed,_unmatchedSOW:unmatchedSOW||[]},
    sow_comparison:comparison
  };
  if(_pendingBidUrl){payload.bid_document_url=_pendingBidUrl;payload.bid_document_name=_pendingBidName;}

  // Update contractor with any new info from the bid
  if(parsed.contractor_phone){
    try{await fetch(SB+"/rest/v1/contacts?id=eq."+contactId,{method:"PATCH",headers:HD,body:JSON.stringify({phone:parsed.contractor_phone})});}catch(e){}
  }

  try{
    const bidRes=await fetch(SB+"/rest/v1/contractor_bids",{method:"POST",headers:HD,body:JSON.stringify(payload)});
    if(_pendingBidUrl){try{const bidSaved=await bidRes.json();const newBidId=Array.isArray(bidSaved)?bidSaved[0]?.id:bidSaved?.id;fetch(SB+"/rest/v1/deal_documents",{method:"POST",headers:HD,body:JSON.stringify({deal_id:dealId,file_url:_pendingBidUrl,file_name:_pendingBidName||"Contractor Bid",file_type:"pdf",doc_category:"bid",doc_subcategory:"contractor_bid",caption:"Bid from "+(parsed.contractor_name||"contractor"),uploaded_by:window.SH_USER?.email||"system"})}).catch(e=>console.error("Doc bridge:",e));}catch(e){}}
    _pendingBidUrl=null;_pendingBidName=null;
    const ctr=ctList.find(c=>c.id===contactId);
    closeCtModal();showCtToast("Bid saved — "+(ctr?.display_name||"contractor")+" at "+$r(payload.initial_bid));
    await loadCtData();renderCtSub();
  }catch(e){console.error("Save parsed bid failed:",e);alert("Failed to save bid.");}
}

// ═══ VIEW SAVED BID COMPARISON ═══
function viewBidComparison(bidId){
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  const parsed=b.parsed_line_items||{};
  const comparison=Array.isArray(b.sow_comparison)?b.sow_comparison:[];
  if(!comparison.length&&!parsed.sections)return;
  const unmatchedSOW=parsed._unmatchedSOW||null;
  const ctrName=b.contacts?.display_name||"Contractor";
  const subtotal=parsed.subtotal||(parsed.sections||[]).reduce((s,sec)=>s+(sec.section_total||0),0)||comparison.reduce((s,c)=>s+(c.bid_total||0),0);
  const overhead=parsed.overhead_amount||parsed.overhead||0;
  const overheadPct=parsed.overhead_pct||parsed.overhead_percent||0;
  const totalBid=b.initial_bid||parsed.total_bid||parsed.total||subtotal+overhead;

  const m=document.getElementById("contactsModal");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">BID COMPARISON</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(ctrName)}</div>`;
  h+=`<div style="font-size:13px;color:#94a3b8;margin-bottom:16px">Subtotal: ${$r(subtotal)} + ${overheadPct}% Overhead: ${$r(overhead)} = <strong style="color:#f1f5f9">${$r(totalBid)}</strong></div>`;
  h+=renderBidComparisonBody(parsed,comparison,unmatchedSOW);
  h+=`</div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function compareDealBids(dealId){
  const dealBids=ctBids.filter(b=>b.deal_id===dealId&&b.sow_comparison&&Array.isArray(b.sow_comparison)&&b.sow_comparison.length);
  if(dealBids.length<2)return;

  const m=document.getElementById("contactsModal");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">COMPARE BIDS</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">${esc(dealBids[0].deals?.address||"")}</div>`;

  // Pure keyword matching — no SOW lines — no double counting
  const COMPARE_CATEGORIES=[
    {label:'Demo & General',         keywords:['demo','general','whole house','drywall','sheetrock','paint','insulation']},
    {label:'Foyer & Entry',          keywords:['foyer','entry']},
    {label:'Kitchen',                keywords:['kitchen','pantry','cabinetry & appliance']},
    {label:'Primary Bathroom',       keywords:['primary bath','primary bathroom']},
    {label:'Secondary Bathrooms',    keywords:['secondary bath','secondary bathroom','walk in bath']},
    {label:'Laundry',                keywords:['laundry']},
    {label:'Flooring',               keywords:['flooring','floor']},
    {label:'Electrical',             keywords:['electrical','electric']},
    {label:'Doors & Windows',        keywords:['door','window']},
    {label:'Fireplace',              keywords:['fireplace']},
    {label:'Bar & Special Features', keywords:['bar feature','coffee bar','foyer bar','convert dining']},
    {label:'Primary Bedroom',        keywords:['primary bedroom','primary bed']},
    {label:'Family Room',            keywords:['family room']},
    {label:'Exterior',               keywords:['exterior']},
    {label:'Landscaping & Pool',     keywords:['landscape','landscaping','pool']},
    {label:'HVAC / Mechanical',      keywords:['hvac','mechanical']},
    {label:'Overhead & Profit',      keywords:['__overhead__']},
  ];

  h+=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>Category</th>`;
  dealBids.forEach(b=>{
    const name=b.contacts?.display_name||"?";
    h+=`<th style="text-align:right">${esc(name)}<div style="font-size:9px;color:#64748b">${$r(b.initial_bid)}</div></th>`;
  });
  h+=`</tr></thead><tbody>`;

  const used=dealBids.map(()=>new Set());

  COMPARE_CATEGORIES.forEach(cat=>{
    const amounts=dealBids.map((b,bi)=>{
      if(cat.keywords[0]==='__overhead__'){
        const full=ctBids.find(x=>x.id===b.id);
        return Number(full?.parsed_line_items?.overhead_amount)||0;
      }
      let sum=0;
      (b.sow_comparison||[]).forEach((c,ci)=>{
        if(used[bi].has(ci))return; // already counted in a previous category
        const secLower=(c.section_name||'').toLowerCase();
        if(cat.keywords.some(k=>secLower.includes(k))){
          sum+=c.bid_total||0;
          used[bi].add(ci);
        }
      });
      return sum;
    });
    if(amounts.every(a=>!a))return;
    const nonZero=amounts.filter(a=>a>0);
    const minAmt=nonZero.length?Math.min(...nonZero):0;
    const maxAmt=nonZero.length?Math.max(...nonZero):0;
    h+=`<tr><td style="color:#e2e8f0;font-weight:600">${esc(cat.label)}</td>`;
    dealBids.forEach((b,i)=>{
      const amt=amounts[i];
      let color="#e2e8f0";
      if(nonZero.length>1&&amt===minAmt&&amt>0)color="#22c55e";
      else if(nonZero.length>1&&amt===maxAmt&&amt>0)color="#ef4444";
      h+=`<td style="text-align:right;font-weight:700;color:${color}">${amt?$r(amt):"—"}</td>`;
    });
    h+=`</tr>`;
  });

  // Totals row
  h+=`<tr style="border-top:2px solid rgba(212,175,55,0.2)"><td style="font-weight:800;color:#d4af37">TOTAL</td>`;
  const totals=dealBids.map(b=>b.initial_bid||0);
  const minT=Math.min(...totals);
  const maxT=Math.max(...totals);
  totals.forEach(t=>{
    let color="#f1f5f9";
    if(totals.length>1&&t===minT)color="#22c55e";
    else if(totals.length>1&&t===maxT)color="#ef4444";
    h+=`<td style="text-align:right;font-weight:800;color:${color}">${$r(t)}</td>`;
  });
  h+=`</tr></tbody></table></div>`;

  // Generate Analysis button — check for cached analysis
  const bidIds=dealBids.map(b=>b.id);
  const addr=esc(dealBids[0].deals?.address||"");
  const hasCached=dealBids.some(b=>b.bid_analysis);
  if(hasCached){
    h+=`<div style="margin-top:16px"><button id="genAnalysisBtn" onclick="generateBidAnalysis('${dealId}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800;border-radius:10px;cursor:pointer">📊 View Analysis</button><div style="text-align:center;margin-top:6px"><a onclick="generateBidAnalysis('${dealId}',true)" style="font-size:11px;color:rgba(255,255,255,0.3);cursor:pointer;text-decoration:none">Regenerate</a></div></div>`;
  }else{
    h+=`<div style="margin-top:16px"><button id="genAnalysisBtn" onclick="generateBidAnalysis('${dealId}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800;border-radius:10px;cursor:pointer">🤖 Generate Analysis</button></div>`;
  }
  h+=`</div>`;

  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function generateBidAnalysis(dealId,forceRegen){
  const btn=document.getElementById("genAnalysisBtn");
  if(btn){btn.disabled=true;btn.textContent="Analyzing…";btn.style.opacity="0.5";}

  // Check for cached analysis first
  if(!forceRegen){
    try {
      const cached = await sb("contractor_bids?deal_id=eq." + dealId + "&select=id,bid_analysis,bid_analysis_date&bid_analysis=not.is.null&limit=1");
      if (Array.isArray(cached) && cached.length && cached[0].bid_analysis) {
        renderBidAnalysis(dealId, cached[0].bid_analysis);
        if(btn){btn.disabled=false;btn.textContent="📊 View Analysis";btn.style.opacity="1";}
        return;
      }
    } catch(e) { console.log('No cached analysis'); }
  }

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey){if(btn){btn.disabled=false;btn.textContent="🤖 Generate Analysis";btn.style.opacity="1";}return;}
    localStorage.setItem("sh_claude_key",apiKey);
  }

  // Fetch full parsed_line_items for all bids on this deal
  let bids=[];
  try{bids=await sb("contractor_bids?deal_id=eq."+dealId+"&select=id,initial_bid,parsed_line_items,contacts(display_name),deals(address)");}catch(e){console.error("Bid fetch:",e);}
  if(!Array.isArray(bids))bids=[];
  bids=bids.filter(b=>b.parsed_line_items&&b.parsed_line_items.sections);
  if(bids.length<2){showCtToast("Need at least 2 parsed bids");if(btn){btn.disabled=false;btn.textContent="🤖 Generate Analysis";btn.style.opacity="1";}return;}

  const address=bids[0].deals?.address||"Property";
  const bidContext=bids.map(b=>{
    const name=b.contacts?.display_name||"Unknown";
    const pl=b.parsed_line_items||{};
    const sections=(pl.sections||[]).map(s=>{
      const items=(s.items||[]).map(i=>`    - ${i.description}: ${(i.amount||0).toLocaleString()}`).join("\n");
      return`  SECTION: ${s.section_name} — TOTAL: ${(s.section_total||0).toLocaleString()}\n${items}`;
    }).join("\n");
    const tbd=(pl.tbd_items||[]).length?`\n  TBD ITEMS (unpriced): ${(pl.tbd_items||[]).join(", ")}`:"";
    return`=== ${name} — Total: ${(b.initial_bid||0).toLocaleString()} ===\nOverhead: ${pl.overhead_pct||0}% (${(pl.overhead_amount||0).toLocaleString()})\n${sections}${tbd}`;
  }).join("\n\n");

  const prompt=`You are a construction cost analyst reviewing contractor bids for a luxury residential flip at ${address} in Las Vegas. The owner-operator buys their own materials — so labor and contractor-supplied materials both matter.

Here are the complete line-item bids:

${bidContext}

Provide a detailed analysis with these sections:

## EXECUTIVE SUMMARY
Who wins overall and why. Adjusted totals if scope gaps exist. One clear recommendation.

## SECTION BY SECTION BREAKDOWN
For each major area (kitchen, bathrooms, flooring, electrical, etc.) — who is cheaper, by how much, and any quality/scope concerns based on the line items. Call out vague line items with no spec.

## SCOPE GAPS (Critical)
Items one contractor priced that the other didn't. Adjust each total to account for missing scope and show the apples-to-apples comparison.

## RED FLAGS
Specific line items that are unusually high, unusually low, or vaguely described. Include the dollar amount and why it's a flag.

## NEGOTIATION PLAYBOOK
For the recommended contractor: list the top 5 specific line items to push back on, what to say, and what a fair price looks like based on the comparison data.

## BOTTOM LINE
One paragraph. What to do, who to hire, what to negotiate first.

Be specific. Use actual dollar amounts from the bids. This will be printed and used in a contractor meeting.`;

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8192,messages:[{role:"user",content:prompt}]})
    });
    if(!res.ok){if(res.status===401)localStorage.removeItem("sh_claude_key");throw new Error("API error "+res.status);}
    const data=await res.json();
    const text=(data.content||[]).map(c=>c.text||"").join("");

    // Save analysis to database
    try {
      const firstBid = bids[0];
      await fetch(SB + '/rest/v1/contractor_bids?id=eq.' + firstBid.id, {
        method: 'PATCH',
        headers: HD,
        body: JSON.stringify({
          bid_analysis: text,
          bid_analysis_date: new Date().toISOString()
        })
      });
    } catch(e) { console.error('Failed to save analysis:', e); }

    renderBidAnalysis(dealId, text);
  }catch(e){
    console.error("Bid analysis error:",e);
    showCtToast("Analysis failed: "+e.message);
    if(btn){btn.disabled=false;btn.textContent="🤖 Generate Analysis";btn.style.opacity="1";}
  }
}

async function renderBidAnalysis(dealId, text){
  // Fetch bids for header info
  let bids=[];
  try{bids=await sb("contractor_bids?deal_id=eq."+dealId+"&select=id,initial_bid,contacts(display_name),deals(address)");}catch(e){}
  if(!Array.isArray(bids))bids=[];
  const address=bids[0]?.deals?.address||"Property";
  function mdToHtml(md){
    return md
      .replace(/^## (.+)$/gm,'<h2 style="font-size:15px;font-weight:800;color:#111;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px">$1</h2>')
      .replace(/^### (.+)$/gm,'<h3 style="font-size:13px;font-weight:800;color:#333;margin:14px 0 4px">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>')
      .replace(/^- (.+)$/gm,'<div style="padding:2px 0 2px 16px;font-size:13px;color:#333;line-height:1.6">• $1</div>')
      .replace(/^\d+\. (.+)$/gm,'<div style="padding:2px 0 2px 16px;font-size:13px;color:#333;line-height:1.6">$1</div>')
      .replace(/\n\n/g,'<div style="height:6px"></div>')
      .replace(/\n/g,'<br>');
  }
  const formatted=mdToHtml(text);
  const bidHeaders=bids.filter(b=>b.initial_bid).map(b=>`<div style="flex:1;text-align:center;padding:8px;border:1px solid #ddd;border-radius:8px"><div style="font-weight:700">${esc(b.contacts?.display_name||"?")}</div><div style="font-size:14px;color:#666">$${(b.initial_bid||0).toLocaleString()}</div></div>`).join("");
  const pm=document.getElementById("contactsModal");
  pm.innerHTML=`<div class="sheet" style="position:relative;max-height:95vh;overflow-y:auto;background:#fff;color:#111;border-radius:16px">
    <div class="handle" style="background:#ccc"></div>
    <button class="close-x" onclick="closeCtModal()" style="color:#666">✕</button>
    <div id="bidAnalysisPrint">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:10px;color:#999;font-weight:700;letter-spacing:3px">BID ANALYSIS</div>
        <div style="font-size:20px;font-weight:800;margin-top:4px">${esc(address)}</div>
        <div style="font-size:11px;color:#999;margin-top:2px">${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"America/Los_Angeles"})}</div>
      </div>
      ${bidHeaders?`<div style="display:flex;gap:12px;margin-bottom:20px">${bidHeaders}</div>`:''}
      <div style="font-size:13px;line-height:1.7;color:#222">${formatted}</div>
      <div style="margin-top:20px;text-align:center"><button onclick="(function(){var el=document.getElementById('bidAnalysisPrint');var w=window.open('','_blank');w.document.write('<html><head><title>Bid Analysis</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111;font-size:13px;line-height:1.7}</style></head><body>'+el.innerHTML+'</body></html>');w.document.close();w.print();})()" style="padding:12px 32px;font-size:14px;font-weight:700;background:#111;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨 Print Report</button></div>
    </div>
  </div>`;
}

// ═══ DELETE BID ═══
async function deleteBid(bidId){
  if(!confirm("Delete this bid?"))return;
  try{
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"DELETE",headers:HD});
    showCtToast("Bid deleted");
    await loadCtData();renderCtSub();
  }catch(e){console.error("Delete bid failed:",e);}
}

// ═══ AWARD BID ═══
async function awardBid(bidId){
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  const prefill=b.negotiated_bid||b.initial_bid||0;
  const input=prompt("Final contracted amount?",prefill);
  if(input===null)return;
  const amount=parseFloat(input);
  if(isNaN(amount)||amount<=0){alert("Enter a valid dollar amount.");return;}
  const ctrName=b.contacts?.display_name||"this contractor";
  const otherCount=ctBids.filter(x=>x.deal_id===b.deal_id&&x.id!==bidId).length;
  if(!confirm(`Award bid to ${ctrName} at ${$r(amount)}?\n\nThis will mark ${otherCount} other bid${otherCount!==1?"s":""} for this deal as rejected.`))return;
  try{
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify({status:"accepted",final_contracted:amount})});
    await fetch(SB+"/rest/v1/contractor_bids?deal_id=eq."+b.deal_id+"&id=neq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify({status:"rejected"})});
    await fetch(SB+"/rest/v1/deals?id=eq."+b.deal_id,{method:"PATCH",headers:HD,body:JSON.stringify({contracted_reno_amount:amount,contracted_reno_contractor:ctrName,contracted_reno_date:new Date().toISOString().split("T")[0]})});
    // Update SOW planned_budget from awarded bid's parsed sections
    if(b.parsed_line_items&&b.parsed_line_items.sections){
      try{
        const sowRes=await fetch(SB+'/rest/v1/renovation_sow_lines?deal_id=eq.'+b.deal_id+'&order=line_number',{headers:HD});
        const sowLines=await sowRes.json();
        if(Array.isArray(sowLines)&&sowLines.length){
          const sowAmounts={};
          sowLines.forEach(l=>{sowAmounts[l.line_number]=0;});
          (b.parsed_line_items.sections||[]).forEach(section=>{
            const secName=(section.section_name||'').toUpperCase().trim();
            let mapCats=BID_SOW_MAP[secName];
            if(!mapCats){
              const keys=Object.keys(BID_SOW_MAP).sort((a,b)=>b.length-a.length);
              for(const key of keys){if(secName.includes(key)){mapCats=BID_SOW_MAP[key];break;}}
            }
            if(!mapCats||!mapCats.length)return;
            const lineNums=mapCats.filter(c=>typeof c==='number');
            const catNames=mapCats.filter(c=>typeof c==='string');
            catNames.forEach(cat=>{
              const catLower=cat.toLowerCase();
              sowLines.forEach(l=>{
                if((l.category||'').toLowerCase().includes(catLower)){
                  if(!lineNums.includes(l.line_number))lineNums.push(l.line_number);
                }
              });
            });
            if(!lineNums.length)return;
            const perLine=(section.section_total||0)/lineNums.length;
            lineNums.forEach(ln=>{
              if(sowAmounts[ln]!==undefined)sowAmounts[ln]+=perLine;
            });
          });
          const overheadPct=(b.parsed_line_items.overhead_pct||0)/100;
          if(overheadPct>0){
            Object.keys(sowAmounts).forEach(ln=>{sowAmounts[ln]=Math.round(sowAmounts[ln]*(1+overheadPct));});
          }else{
            Object.keys(sowAmounts).forEach(ln=>{sowAmounts[ln]=Math.round(sowAmounts[ln]);});
          }
          for(const[ln,amt]of Object.entries(sowAmounts)){
            if(amt>0){
              const sowLine=sowLines.find(l=>l.line_number===Number(ln));
              if(sowLine){
                await fetch(SB+'/rest/v1/renovation_sow_lines?id=eq.'+sowLine.id,{method:'PATCH',headers:HD,body:JSON.stringify({planned_budget:amt})});
              }
            }
          }
          console.log('[SH] SOW planned_budget updated from awarded bid:',sowAmounts);
        }
      }catch(e){console.error('SOW budget update from bid failed:',e);}
    }
    const d=deals.find(x=>x.id===b.deal_id);
    if(d){
      const tl=Array.isArray(d.timeline)?[...d.timeline]:[];
      tl.push({date:new Date().toISOString(),type:"contractor_awarded",from:"user",summary:`Bid awarded to ${ctrName} at ${$r(amount)}. ${otherCount} competing bid${otherCount!==1?"s":""} rejected.`});
      await fetch(SB+"/rest/v1/deals?id=eq."+b.deal_id,{method:"PATCH",headers:HD,body:JSON.stringify({timeline:tl,updated_by:window.SH_USER?.id||null,updated_by_email:window.SH_USER?.email||null})});
      d.timeline=tl;
    }
    showCtToast(`Bid awarded to ${ctrName} — ${$r(amount)}`);
    await loadCtData();renderCtSub();
  }catch(e){console.error("Award bid failed:",e);alert("Failed to award bid.");}
}

async function undoAward(bidId){
  if(!confirm("Undo this award? The bid will return to received status."))return;
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  try{
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify({status:"received",final_contracted:null})});
    await fetch(SB+"/rest/v1/contractor_bids?deal_id=eq."+b.deal_id+"&status=eq.rejected",{method:"PATCH",headers:HD,body:JSON.stringify({status:"received"})});
    await fetch(SB+"/rest/v1/deals?id=eq."+b.deal_id,{method:"PATCH",headers:HD,body:JSON.stringify({contracted_reno_amount:null,contracted_reno_contractor:null,contracted_reno_date:null})});
    // Reset SOW planned_budget to lender_approved
    try{
      const sowRes=await fetch(SB+'/rest/v1/renovation_sow_lines?deal_id=eq.'+b.deal_id,{headers:HD});
      const sowLines=await sowRes.json();
      if(Array.isArray(sowLines)){
        for(const l of sowLines){
          await fetch(SB+'/rest/v1/renovation_sow_lines?id=eq.'+l.id,{method:'PATCH',headers:HD,body:JSON.stringify({planned_budget:l.lender_approved||0})});
        }
      }
    }catch(e){console.error('SOW budget reset failed:',e);}
    const dlResp=await fetch(SB+"/rest/v1/deals?id=eq."+b.deal_id+"&select=timeline",{headers:HD});
    const dlData=await dlResp.json();
    const curTl=Array.isArray(dlData[0]?.timeline)?dlData[0].timeline:[];
    const cleanTl=curTl.filter(e=>e.type!=="contractor_awarded");
    await fetch(SB+"/rest/v1/deals?id=eq."+b.deal_id,{method:"PATCH",headers:HD,body:JSON.stringify({timeline:cleanTl})});
    showCtToast("Award reversed");
    await loadCtData();renderCtSub();
  }catch(e){console.error("Undo award failed:",e);alert("Failed to undo award.");}
}

// ═══ BID REVISION SYSTEM ═══
function uploadBidRevision(bidId){
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  const ctrName=b.contacts?.display_name||"Contractor";
  const revNum=(b.current_revision||1)+1;
  const m=document.getElementById("contactsModal");
  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#a855f7;font-weight:800;letter-spacing:3px;margin-bottom:4px">BID REVISION ${revNum}</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(ctrName)}</div>`;
  h+=`<div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Current bid: ${$r(b.initial_bid)} (Rev ${b.current_revision||1})</div>`;
  h+=`<div class="fld"><label>REVISED BID DOCUMENT</label><div id="revFileLabel" onclick="document.getElementById('revFileInput').click()" style="padding:20px;border-radius:10px;border:2px dashed rgba(168,85,247,0.2);background:rgba(168,85,247,0.02);text-align:center;cursor:pointer;color:#94a3b8;font-size:13px;font-weight:600;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(168,85,247,0.5)'" onmouseout="this.style.borderColor='rgba(168,85,247,0.2)'">📄 Choose PDF, JPG, or PNG</div><input type="file" id="revFileInput" accept=".pdf,image/*" style="display:none" onchange="if(this.files[0]){const l=document.getElementById('revFileLabel');l.innerHTML='📄 '+this.files[0].name;l.style.borderColor='rgba(34,197,94,0.4)';l.style.color='#e2e8f0'}"/></div>`;
  h+=`<button onclick="parseRevision('${b.id}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:800;border:none;margin-top:8px">🤖 Parse Revision</button>`;
  h+=`</div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

async function parseRevision(bidId){
  const file=document.getElementById("revFileInput")?.files[0];
  if(!file){alert("Select a revised bid document.");return;}
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  const dealId=b.deal_id;

  const m=document.getElementById("contactsModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button><div style="text-align:center;padding:40px"><div style="width:24px;height:24px;border:2px solid rgba(168,85,247,0.2);border-top-color:#a855f7;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div><div style="font-size:12px;color:#a855f7;font-weight:700">Parsing revised bid with AI...</div><div style="font-size:10px;color:#64748b;margin-top:4px">This may take 30-60 seconds</div></div></div>`;

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){apiKey=prompt("Enter your Claude API key:");if(!apiKey){closeCtModal();return;}localStorage.setItem("sh_claude_key",apiKey);}

  const bidPath=storagePath(dealId,"bids",file);
  const revUrl=await uploadToStorage(file,"sovereign-docs",bidPath);
  const revFileName=file.name;

  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);
  let binary="";const chunk=8192;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  const b64=btoa(binary);
  const mediaType=file.type.startsWith('image/')?file.type:'application/pdf';
  const docType=file.type.startsWith('image/')?'image':'document';

  let sowLines=[];
  try{const sw=await sb("renovation_sow_lines?deal_id=eq."+dealId+"&order=line_number&lender_approved=gt.0");sowLines=Array.isArray(sw)?sw:[];}catch(e){}

  const sowContext=sowLines.length?"\n\nALSO: Here are the lender-approved SOW budget lines for this project. For each section in the bid, tell me which SOW line(s) it maps to. A section can map to one or more SOW lines. Multiple bid sections CAN map to the same SOW line (e.g. Primary Bathroom and Secondary Bathrooms both map to the Bathrooms SOW line). Include the mapping in each section object.\n\nSOW LINES:\n"+sowLines.map(l=>"#"+l.line_number+" "+l.category+" — "+l.description+" ($"+l.lender_approved+")").join("\n")+"\n\nAdd to each section object in your response:\n  \"sow_line_matches\": [{\"line_number\": 14, \"description\": \"Bathrooms\", \"budget\": 34000}]\n\nIf a section has NO matching SOW line, set sow_line_matches to an empty array [].\nIf a section spans multiple SOW lines (like Kitchen + Appliances), include all matches.":"";

  const content=[
    {type:docType,source:{type:"base64",media_type:mediaType,data:b64}},
    {type:"text",text:"Parse this contractor bid document. The bid is organized into SECTIONS (bold headers like DEMOLITION, KITCHEN RENOVATION, etc.) with individual line items under each section.\n\nReturn ONLY a JSON object — no markdown, no backticks, no explanation:\n\n{\"contractor_name\":\"Company name\",\"contractor_address\":\"Address if visible\",\"contractor_phone\":\"Phone if visible\",\"bid_date\":\"YYYY-MM-DD or null\",\"project_address\":\"Project address if visible\",\"sections\":[{\"section_name\":\"DEMOLITION\",\"items\":[{\"item_number\":1,\"description\":\"Dumpster Rental and Debris Removal\",\"amount\":1800},{\"item_number\":2,\"description\":\"Remove all Existing Flooring\",\"amount\":3200}],\"section_total\":12100,\"sow_line_matches\":[{\"line_number\":2,\"description\":\"Demolition\",\"budget\":12000}]}],\"subtotal\":350800,\"overhead_pct\":15,\"overhead_amount\":52620,\"total_bid\":403420,\"tbd_items\":[\"description of any TBD items\"],\"notes\":\"Any payment terms or conditions\"}\n\nRULES:\n- Preserve EXACT section groupings from the document bold headers\n- section_total = sum of all item amounts in that section\n- Items marked TBD get amount: 0 and go in tbd_items array\n- Overhead/profit is separate, NOT inside any section\n- subtotal = sum of all section_totals before overhead\n- total_bid = subtotal + overhead_amount\n- Return ONLY valid JSON"+sowContext}
  ];

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8192,messages:[{role:"user",content:content}]})});
    if(!res.ok){if(res.status===401)localStorage.removeItem("sh_claude_key");throw new Error("API error "+res.status);}
    const data=await res.json();
    if(data.stop_reason==="max_tokens"){showCtToast("Warning: response truncated, sections may be missing");}
    const parsed=await robustParseJSON(data,apiKey);
    const comparison=buildSectionComparison(parsed,sowLines);
    const unmatchedSOW=sowLines.filter(s=>!_bidUsedSOW.has(s.line_number)&&(s.lender_approved||0)>0);
    renderRevisionReview(parsed,comparison,unmatchedSOW,bidId,revUrl,revFileName);
  }catch(e){
    console.error("Revision parse error:",e);
    m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button><div style="text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px">⚠️</div><div style="font-size:14px;font-weight:700;color:#ef4444;margin-bottom:4px">Failed to parse revision</div><div style="font-size:12px;color:#94a3b8;margin-bottom:16px">${esc(e.message||"Unknown error")}</div><button onclick="uploadBidRevision('${bidId}')" class="btn" style="padding:12px 24px;font-size:13px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);color:#a855f7;font-weight:700">Try Again</button></div></div>`;
  }
}

function renderRevisionReview(parsed,comparison,unmatchedSOW,bidId,revUrl,revFileName){
  const m=document.getElementById("contactsModal");
  const b=ctBids.find(x=>x.id===bidId);
  const ctrName=parsed.contractor_name||b?.contacts?.display_name||"Contractor";
  const revNum=(b?.current_revision||1)+1;
  const subtotal=parsed.subtotal||(parsed.sections||[]).reduce((s,sec)=>s+(sec.section_total||0),0);
  const overhead=parsed.overhead_amount||parsed.overhead||0;
  const totalBid=parsed.total_bid||parsed.total||subtotal+overhead;
  const prevTotal=b?.initial_bid||0;
  const delta=totalBid-prevTotal;
  const deltaSign=delta>=0?"+":"";
  const deltaColor=delta<0?"#22c55e":delta>0?"#ef4444":"#64748b";
  const overheadPct=parsed.overhead_pct||parsed.overhead_percent||0;

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#a855f7;font-weight:800;letter-spacing:3px;margin-bottom:4px">REVISION ${revNum} REVIEW</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(ctrName)}</div>`;
  h+=`<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">New Total: <strong style="color:#f1f5f9">${$r(totalBid)}</strong> <span style="color:${deltaColor};font-weight:700">(${deltaSign}${$r(delta)})</span></div>`;
  h+=`<div style="font-size:11px;color:#64748b;margin-bottom:4px">Previous: ${$r(prevTotal)} (Rev ${b?.current_revision||1})</div>`;
  h+=`<div style="font-size:11px;color:#94a3b8;margin-bottom:16px">Subtotal: ${$r(subtotal)} + ${overheadPct}% Overhead: ${$r(overhead)}</div>`;
  h+=renderBidComparisonBody(parsed,comparison,unmatchedSOW);
  h+=`<button onclick="saveRevision('${bidId}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:800;border:none;margin-top:12px">Save as Revision ${revNum}</button>`;
  h+=`</div>`;
  m.innerHTML=h;
  m._pendingRevision={parsed,comparison,unmatchedSOW,bidId,revUrl,revFileName};
}

async function saveRevision(bidId){
  const m=document.getElementById("contactsModal");
  const rev=m._pendingRevision;if(!rev)return;
  const{parsed,comparison,unmatchedSOW,revUrl,revFileName}=rev;
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;

  const historyEntry={revision:b.current_revision||1,date:new Date().toISOString(),initial_bid:b.initial_bid,overhead_pct:b.overhead_pct,overhead_amount:b.overhead_amount,scope_description:b.scope_description,parsed_line_items:b.parsed_line_items,sow_comparison:b.sow_comparison,bid_document_url:b.bid_document_url,bid_document_name:b.bid_document_name};
  const history=Array.isArray(b.revision_history)?[...b.revision_history]:[];
  history.push(historyEntry);

  const newTotal=parsed.total_bid||parsed.total||(parsed.subtotal||0)+(parsed.overhead_amount||parsed.overhead||0);
  const newRevNum=(b.current_revision||1)+1;
  const ctrName=b.contacts?.display_name||"Contractor";

  const patch={initial_bid:newTotal,overhead_pct:parsed.overhead_pct||0,overhead_amount:parsed.overhead_amount||0,scope_description:(parsed.sections||[]).map(s=>s.section_name+': $'+s.section_total.toLocaleString()).join(' | '),parsed_line_items:{...parsed,_unmatchedSOW:unmatchedSOW||[]},sow_comparison:comparison,current_revision:newRevNum,revision_history:history};
  if(revUrl){patch.bid_document_url=revUrl;patch.bid_document_name=revFileName;}

  try{
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify(patch)});
    if(revUrl){fetch(SB+"/rest/v1/deal_documents",{method:"POST",headers:HD,body:JSON.stringify({deal_id:b.deal_id,file_url:revUrl,file_name:revFileName||"Bid Revision "+newRevNum,file_type:"pdf",doc_category:"bid",doc_subcategory:"bid_revision",caption:"Revision "+newRevNum+" from "+ctrName,uploaded_by:window.SH_USER?.email||"system"})}).catch(e=>console.error("Doc bridge:",e));}
    closeCtModal();showCtToast(`Revision ${newRevNum} saved — ${esc(ctrName)} at ${$r(newTotal)}`);
    await loadCtData();renderCtSub();
  }catch(e){console.error("Save revision failed:",e);alert("Failed to save revision.");}
}

function viewRevisionHistory(bidId){
  const b=ctBids.find(x=>x.id===bidId);
  if(!b||!Array.isArray(b.revision_history)||!b.revision_history.length)return;
  const m=document.getElementById("contactsModal");
  const ctrName=b.contacts?.display_name||"Contractor";

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#a855f7;font-weight:800;letter-spacing:3px;margin-bottom:4px">REVISION HISTORY</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:4px">${esc(ctrName)}</div>`;
  h+=`<div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Current: Rev ${b.current_revision||1} — ${$r(b.initial_bid)}</div>`;

  h+=`<div style="padding:12px;border-radius:10px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);margin-bottom:8px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<div><span style="font-size:11px;font-weight:800;color:#a855f7">Rev ${b.current_revision||1}</span><span style="font-size:10px;color:#64748b;margin-left:8px">(current)</span></div>`;
  h+=`<div style="font-size:14px;font-weight:800;color:#f1f5f9">${$r(b.initial_bid)}</div>`;
  h+=`</div>`;
  if(b.scope_description)h+=`<div style="font-size:10px;color:#94a3b8;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.scope_description)}</div>`;
  h+=`</div>`;

  [...b.revision_history].reverse().forEach(rev=>{
    const revDate=rev.date?new Date(rev.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"}):"";
    h+=`<div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px">`;
    h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
    h+=`<div><span style="font-size:11px;font-weight:700;color:#94a3b8">Rev ${rev.revision}</span><span style="font-size:10px;color:#475569;margin-left:8px">${revDate}</span></div>`;
    h+=`<div style="font-size:13px;font-weight:700;color:#94a3b8">${$r(rev.initial_bid)}</div>`;
    h+=`</div>`;
    if(rev.scope_description)h+=`<div style="font-size:10px;color:#64748b;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(rev.scope_description)}</div>`;
    if(rev.bid_document_url)h+=`<a href="${esc(rev.bid_document_url)}" target="_blank" style="font-size:10px;color:#d4af37;text-decoration:none;font-weight:700;margin-top:4px;display:inline-block">📄 View Document</a>`;
    h+=`</div>`;
  });

  h+=`</div>`;
  m.innerHTML=h;m.style.display="block";document.body.style.overflow="hidden";
}

// ═══ CONTRACTOR RATING SYSTEM ═══
function toggleRatingPanel(bidId){
  ctRatingOpen=ctRatingOpen===bidId?null:bidId;
  renderCtSub();
}

function buildRatingPanel(b){
  const dims=[
    {key:"rating_bid_accuracy",label:"Bid Accuracy",hint:"How close was the bid to actual cost?"},
    {key:"rating_timeline",label:"Timeline",hint:"Did they finish on time?"},
    {key:"rating_quality",label:"Quality",hint:"Workmanship and attention to detail"},
    {key:"rating_communication",label:"Communication",hint:"Responsiveness and updates"}
  ];
  const rated=dims.filter(d=>b[d.key]!=null);
  const avg=rated.length?(rated.reduce((s,d)=>s+b[d.key],0)/rated.length).toFixed(1):null;

  let h=`<div style="padding:12px 16px;background:rgba(212,175,55,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:10px;margin:4px 0 8px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:10px;font-weight:800;color:#d4af37;letter-spacing:2px">RATE CONTRACTOR</div>`;
  if(avg)h+=`<div style="font-size:11px;color:#94a3b8">Overall: <span style="color:#d4af37;font-weight:800">★ ${avg}</span></div>`;
  h+=`</div>`;

  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
  dims.forEach(d=>{
    const val=b[d.key]||0;
    h+=`<div style="padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">`;
    h+=`<div style="font-size:10px;font-weight:700;color:#e2e8f0;margin-bottom:2px">${d.label}</div>`;
    h+=`<div style="font-size:9px;color:#475569;margin-bottom:6px">${d.hint}</div>`;
    h+=`<div style="display:flex;align-items:center;gap:2px">`;
    for(let i=1;i<=5;i++){
      const filled=i<=val;
      h+=`<span onclick="event.stopPropagation();setDimRating('${b.id}','${d.key}',${i})" onmouseover="previewStars(this.parentElement,${i})" onmouseout="restoreStars(this.parentElement,${val})" style="cursor:pointer;font-size:16px;color:${filled?"#d4af37":"rgba(255,255,255,0.15)"};transition:color .15s;user-select:none" data-idx="${i}">★</span>`;
    }
    if(val)h+=`<span style="font-size:10px;color:#94a3b8;margin-left:6px;font-weight:700">${val}.0</span>`;
    h+=`</div></div>`;
  });
  h+=`</div></div>`;
  return h;
}

function previewStars(container,n){
  container.querySelectorAll("span[data-idx]").forEach(s=>{
    const idx=parseInt(s.dataset.idx);
    s.style.color=idx<=n?"#d4af37":"rgba(255,255,255,0.15)";
  });
}
function restoreStars(container,val){
  container.querySelectorAll("span[data-idx]").forEach(s=>{
    const idx=parseInt(s.dataset.idx);
    s.style.color=idx<=val?"#d4af37":"rgba(255,255,255,0.15)";
  });
}

async function setDimRating(bidId,dimKey,value){
  const b=ctBids.find(x=>x.id===bidId);if(!b)return;
  const newVal=b[dimKey]===value?null:value;
  try{
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify({[dimKey]:newVal})});
    b[dimKey]=newVal;
    const dims=["rating_bid_accuracy","rating_timeline","rating_quality","rating_communication"];
    const rated=dims.filter(d=>b[d]!=null);
    const avg=rated.length?(rated.reduce((s,d)=>s+b[d],0)/rated.length):null;
    b.overall_rating=avg?parseFloat(avg.toFixed(1)):null;
    await fetch(SB+"/rest/v1/contractor_bids?id=eq."+bidId,{method:"PATCH",headers:HD,body:JSON.stringify({overall_rating:b.overall_rating})});
    renderCtSub();
  }catch(e){console.error("Set rating failed:",e);showCtToast("Failed to save rating");}
}

// ═══ HELPERS ═══
function showCtToast(msg){
  const t=document.getElementById("alertToast");
  t.innerHTML=`<div style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:#22c55e">✓ ${esc(msg)}</div></div>`;
  setTimeout(()=>{t.innerHTML="";},3000);
}

function closeCtModal(){document.getElementById("contactsModal").style.display="none";document.body.style.overflow="";}

// Disable backdrop click on contactsModal — strip the listener added by index.html
(function(){
  const cm=document.getElementById("contactsModal");
  if(cm){const cl=cm.cloneNode(true);cm.parentNode.replaceChild(cl,cm);}
})();

// ═══ CONTACT PICKER ═══
let _cpOnSelect=null,_cpFilterType=null,_cpHighlight=-1;

window.openContactPicker=async function(opts){
  opts=opts||{};
  const title=opts.title||"Select Contact";
  const filterType=opts.filterType||null;
  const onSelect=opts.onSelect||null;
  const anchor=opts.anchor||null;

  if(!ctList.length)await loadCtData();
  _cpOnSelect=onSelect;
  _cpFilterType=filterType;
  _cpHighlight=-1;
  closeContactPicker();

  const overlay=document.createElement("div");
  overlay.id="cpOverlay";
  overlay.className="cp-overlay";
  overlay.addEventListener("click",function(e){if(e.target===overlay)closeContactPicker();});

  const panel=document.createElement("div");
  panel.className="cp-panel";

  if(anchor&&window.innerWidth>=768){
    const rect=anchor.getBoundingClientRect();
    panel.style.position="fixed";
    panel.style.top=Math.min(rect.bottom+4,window.innerHeight-420)+"px";
    panel.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-360))+"px";
  }

  let h='<div class="cp-hdr"><div class="cp-title">'+esc(title)+'</div><button class="cp-close" onclick="closeContactPicker()">✕</button></div>';
  h+='<input id="cpSearch" class="cp-search" type="text" placeholder="Search name, company, phone..." autocomplete="off"/>';

  if(!filterType){
    h+='<div class="cp-types" id="cpTypes"><button class="cp-type-pill active" data-cptype="all" onclick="cpSetType(\'all\')">All</button>';
    CT_TYPES.forEach(function(t){h+='<button class="cp-type-pill" data-cptype="'+t+'" onclick="cpSetType(\''+t+'\')">'+CT_LABELS[t]+'</button>';});
    h+='</div>';
  }

  h+='<div id="cpResults" class="cp-results"></div>';
  h+='<button class="cp-add-btn" onclick="cpAddNew()">+ Add New Contact</button>';

  panel.innerHTML=h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  cpRenderResults(filterType||"all","");

  const searchEl=document.getElementById("cpSearch");
  if(searchEl){
    searchEl.focus();
    searchEl.addEventListener("input",function(){
      _cpHighlight=-1;
      const typeEl=document.querySelector(".cp-type-pill.active");
      const type=typeEl?typeEl.dataset.cptype:(filterType||"all");
      cpRenderResults(type,this.value);
    });
    searchEl.addEventListener("keydown",cpKeyHandler);
  }
};

function cpRenderResults(type,query){
  const el=document.getElementById("cpResults");
  if(!el)return;
  let list=ctList.filter(function(c){return c.status==="active";});
  if(type&&type!=="all")list=list.filter(function(c){return c.contact_type===type;});
  if(query){
    const q=query.toLowerCase();
    list=list.filter(function(c){
      return(c.display_name||"").toLowerCase().includes(q)||(c.company||"").toLowerCase().includes(q)||(c.phone||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q);
    });
  }
  if(!list.length){el.innerHTML='<div class="cp-empty">No contacts found</div>';el._cpList=[];return;}
  let h='';
  list.forEach(function(c,i){
    const tc=CT_COLORS[c.contact_type]||"#64748b";
    h+='<div class="cp-row'+(_cpHighlight===i?' cp-hl':'')+'" data-cpidx="'+i+'" onclick="cpSelect(\''+c.id+'\')" onmouseenter="_cpHighlight='+i+';cpHighlightRow()">';
    h+='<div class="cp-row-main"><div class="cp-row-name">'+esc(c.display_name||"")+'</div>';
    if(c.company)h+='<div class="cp-row-co">'+esc(c.company)+'</div>';
    h+='</div><div class="cp-row-right">';
    h+='<span class="cp-type-badge" style="color:'+tc+';background:'+tc+'15;border:1px solid '+tc+'30">'+(CT_LABELS[c.contact_type]||"Other")+'</span>';
    if(c.phone)h+='<div class="cp-row-phone">'+esc(c.phone)+'</div>';
    h+='</div></div>';
  });
  el.innerHTML=h;
  el._cpList=list;
}

function cpSelect(contactId){
  const c=ctList.find(function(x){return x.id===contactId;});
  if(c&&_cpOnSelect)_cpOnSelect(c);
  closeContactPicker();
}

function cpSetType(type){
  document.querySelectorAll(".cp-type-pill").forEach(function(p){p.classList.toggle("active",p.dataset.cptype===type);});
  _cpHighlight=-1;
  cpRenderResults(type,(document.getElementById("cpSearch")?.value||""));
}

function cpKeyHandler(e){
  const el=document.getElementById("cpResults");
  if(!el||!el._cpList)return;
  const len=el._cpList.length;
  if(e.key==="ArrowDown"){e.preventDefault();_cpHighlight=Math.min(_cpHighlight+1,len-1);cpHighlightRow();}
  else if(e.key==="ArrowUp"){e.preventDefault();_cpHighlight=Math.max(_cpHighlight-1,0);cpHighlightRow();}
  else if(e.key==="Enter"){e.preventDefault();if(_cpHighlight>=0&&_cpHighlight<len)cpSelect(el._cpList[_cpHighlight].id);}
  else if(e.key==="Escape"){e.preventDefault();closeContactPicker();}
}

function cpHighlightRow(){
  document.querySelectorAll(".cp-row").forEach(function(r,i){r.classList.toggle("cp-hl",i===_cpHighlight);});
  const hl=document.querySelector(".cp-row.cp-hl");
  if(hl)hl.scrollIntoView({block:"nearest"});
}

function cpAddNew(){
  const prevOnSelect=_cpOnSelect;
  const prevFilterType=_cpFilterType;
  closeContactPicker();
  window._cpPostSaveCallback=prevOnSelect;
  const prefill={};
  if(prevFilterType)prefill.contact_type=prevFilterType;
  openCtForm(null,prefill);
}

function closeContactPicker(){
  const el=document.getElementById("cpOverlay");
  if(el)el.remove();
  _cpHighlight=-1;
}

// ═══ SUPPLIER QUOTES ═══

async function loadCtQuotes(cid){
  const el=document.getElementById("ctDetailQuotes");if(!el)return;
  try{
    const q=await sb("supplier_quotes?contact_id=eq."+cid+"&order=quote_date.desc.nullslast,created_at.desc");
    ctQuotes=Array.isArray(q)?q:[];
  }catch(e){console.error("Load quotes failed:",e);ctQuotes=[];}

  let h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">QUOTES ('+ctQuotes.length+')</div><button onclick="openQuoteUpload(\''+cid+'\')" class="btn" style="padding:6px 12px;font-size:11px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);color:#d4af37;font-weight:700;min-height:auto;border-radius:8px">📷 Upload Quote</button></div>';

  if(!ctQuotes.length){
    h+='<div style="padding:16px;text-align:center;color:#475569;font-size:11px">No quotes yet. Upload a quote to start tracking pricing.</div>';
    el.innerHTML=h;return;
  }

  // Group by quote_date
  const groups={};
  ctQuotes.forEach(function(q){
    const key=q.quote_date||"undated";
    if(!groups[key])groups[key]=[];
    groups[key].push(q);
  });

  Object.keys(groups).forEach(function(date){
    const items=groups[date];
    const total=items.reduce(function(s,i){return s+(i.total_price||0);},0);
    const docUrl=items[0].quote_document_url;
    h+='<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:12px;font-weight:700;color:#e2e8f0">'+(date==="undated"?"No date":new Date(date+"T00:00:00").toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"}))+'</div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;font-weight:800;color:#f1f5f9">'+$r(total)+'</span>'+(docUrl?'<a href="'+esc(docUrl)+'" target="_blank" onclick="event.stopPropagation()" style="font-size:9px;color:#60a5fa;text-decoration:none;font-weight:700">View Doc</a>':'')+'</div></div>';
    items.forEach(function(q){
      const cc=SQ_CATS[q.category]||"#64748b";
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid rgba(255,255,255,0.04)">';
      h+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(q.item_description||"")+'</div>';
      if(q.actual_price_paid!=null){
        const delta=q.total_price-q.actual_price_paid;
        const dc=delta>=0?"#22c55e":"#ef4444";
        h+='<div style="font-size:10px;color:#64748b;margin-top:2px">Quoted: '+$r(q.total_price)+' → Paid: <span style="color:'+dc+';font-weight:700">'+$r(q.actual_price_paid)+'</span>'+(delta!==0?' <span style="color:'+dc+'">('+( delta>0?'saved ':'over ')+$r(Math.abs(delta))+')</span>':'')+'</div>';
      }else{
        h+='<div style="font-size:10px;color:#64748b;margin-top:2px">'+$r(q.unit_price||0)+' × '+(q.quantity||1)+' '+(q.unit||"each").replace(/_/g," ")+'</div>';
      }
      h+='</div>';
      h+='<div style="display:flex;align-items:center;gap:6px"><span class="reno-chip" style="color:'+cc+';background:'+cc+'15;border:1px solid '+cc+'30;font-size:8px">'+(SQ_CAT_LABELS[q.category]||"Other")+'</span><span style="font-size:12px;font-weight:700;color:#f1f5f9;white-space:nowrap">'+$r(q.total_price||0)+'</span></div>';
      h+='</div>';
    });
    h+='</div>';
  });

  // Scorecard — only if 3+ items have actual_price_paid
  const linked=ctQuotes.filter(function(q){return q.actual_price_paid!=null;});
  if(linked.length>=3){
    const totalSpend=linked.reduce(function(s,q){return s+(q.actual_price_paid||0);},0);
    const totalQuoted=linked.reduce(function(s,q){return s+(q.total_price||0);},0);
    const accuracy=totalQuoted?Math.round((totalSpend/totalQuoted)*100):0;
    const label=accuracy>=95&&accuracy<=105?"Reliable pricing":accuracy<95?"Quotes high":"Quotes low";
    const lc=accuracy>=95&&accuracy<=105?"#22c55e":accuracy<95?"#eab308":"#ef4444";
    h+='<div style="padding:12px;border-radius:12px;background:rgba(212,175,55,0.02);border:1px solid rgba(212,175,55,0.1);margin-top:8px">';
    h+='<div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:8px">SUPPLIER SCORECARD</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">';
    h+='<div><div style="font-size:8px;color:#64748b;font-weight:700">ITEMS QUOTED</div><div style="font-size:14px;font-weight:800;color:#f1f5f9">'+ctQuotes.length+'</div></div>';
    h+='<div><div style="font-size:8px;color:#64748b;font-weight:700">ACCURACY</div><div style="font-size:14px;font-weight:800;color:'+lc+'">'+accuracy+'%</div></div>';
    h+='<div><div style="font-size:8px;color:#64748b;font-weight:700">TOTAL SPEND</div><div style="font-size:14px;font-weight:800;color:#f1f5f9">'+$k(totalSpend)+'</div></div>';
    h+='</div>';
    h+='<div style="text-align:center;margin-top:6px;font-size:10px;font-weight:700;color:'+lc+'">'+label+'</div>';
    h+='</div>';
  }

  el.innerHTML=h;
}

function openQuoteUpload(contactId){
  _sqrContactId=contactId;
  let input=document.getElementById('_quoteFileInput');
  if(!input){
    input=document.createElement('input');
    input.id='_quoteFileInput';
    input.type='file';
    input.accept='image/*,.pdf';
    input.style.display='none';
    document.body.appendChild(input);
  }
  input.value='';
  input.onchange=function(){
    const file=input.files[0];
    if(!file)return;
    window._pendingQuoteFile=file;
    setTimeout(function(){parseQuote(window._pendingQuoteFile);},100);
  };
  input.click();
}

async function parseQuote(file){
  showCtToast("Reading quote...");
  _sqrFile=file;

  let apiKey=localStorage.getItem("sh_claude_key");
  if(!apiKey){
    apiKey=prompt("Enter your Claude API key:");
    if(!apiKey)return;
    localStorage.setItem("sh_claude_key",apiKey);
  }

  let b64,mediaType='image/jpeg',docType='image';
  try{
    if(file.type==='application/pdf'){
      const dataUrl=await new Promise(function(resolve,reject){
        const reader=new FileReader();
        reader.onload=function(){resolve(reader.result);};
        reader.onerror=function(){reject(new Error('FileReader failed'));};
        reader.readAsDataURL(file);
      });
      b64=dataUrl.split(',')[1];
      mediaType='application/pdf';
      docType='document';
    }else{
      const imgDataUrl=await new Promise(function(resolve,reject){
        const reader=new FileReader();
        reader.onload=function(){resolve(reader.result);};
        reader.onerror=function(){reject(new Error('FileReader failed'));};
        reader.readAsDataURL(file);
      });
      const img=new Image();
      await new Promise(function(resolve,reject){
        img.onload=resolve;
        img.onerror=function(){reject(new Error('Image load failed'));};
        img.src=imgDataUrl;
      });
      const maxDim=1500;
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>h){h=Math.round(h*(maxDim/w));w=maxDim;}
        else{w=Math.round(w*(maxDim/h));h=maxDim;}
      }
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const jpegDataUrl=canvas.toDataURL('image/jpeg',0.85);
      b64=jpegDataUrl.split(',')[1];
    }
  }catch(e){
    console.error("[Quote Parser] File processing failed:",e);
    showCtToast("Failed to read file");
    return;
  }

  const content=[
    {type:docType,source:{type:"base64",media_type:mediaType,data:b64}},
    {type:"text",text:"Read this supplier quote, price list, estimate, or invoice. Extract every line item with pricing.\n\nFor each item found, return:\n- item_description: What the product/material is (be specific — include brand, model, finish, size if visible)\n- category: Best guess from: flooring, tile, countertops, cabinets, appliances, plumbing_fixtures, lighting, hardware, paint, doors_windows, iron_work, landscaping, pool, other\n- unit_price: Price per unit (number only, no $)\n- unit: One of: each, per_sf, per_lf, per_slab, per_unit, lot, per_box\n- quantity: Quantity quoted (number, or 1 if not specified)\n- total_price: Total for this line (unit_price × quantity, or the total shown)\n- notes: Any additional details (lead time, minimum order, finish options, etc.)\n\nAlso extract:\n- supplier_name: The company name on the quote\n- quote_date: Date on the document if visible (YYYY-MM-DD format)\n\nReturn ONLY a JSON object with no markdown, no backticks:\n{\"supplier_name\":\"...\",\"quote_date\":\"...\",\"items\":[{\"item_description\":\"...\",\"category\":\"...\",\"unit_price\":0,\"unit\":\"each\",\"quantity\":1,\"total_price\":0,\"notes\":\"...\"}]}"}
  ];

  try{
    showCtToast("Analyzing with AI...");
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:content}]})
    });

    if(!res.ok){
      if(res.status===401)localStorage.removeItem("sh_claude_key");
      if(res.status===400)showCtToast("Image too large — try a smaller photo");
      else showCtToast("AI request failed ("+res.status+")");
      return;
    }

    const data=await res.json();
    let parsed=null;
    try{
      const rawText=data?.content?.[0]?.text||"";
      const cleaned=rawText.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      parsed=JSON.parse(cleaned);
    }catch(parseErr){
      console.error("[Quote Parser] JSON parse failed:",parseErr);
      showCtToast("Couldn't read the quote — try a clearer photo");
      return;
    }

    if(!parsed||!Array.isArray(parsed.items)||!parsed.items.length){
      showCtToast("No line items found in this quote");
      return;
    }

    _sqrMeta={supplier_name:parsed.supplier_name||"",quote_date:parsed.quote_date||""};
    _sqrItems=parsed.items.map(function(it){return{item_description:it.item_description||"",category:it.category||"other",unit_price:it.unit_price||0,unit:it.unit||"each",quantity:it.quantity||1,total_price:it.total_price||0,notes:it.notes||""};});
    showQuoteReview();

  }catch(e){
    console.error("[Quote Parser] Failed:",e);
    showCtToast("Scan failed: "+(e.message||"Unknown error"));
  }
}

function showQuoteReview(){
  const m=document.getElementById("contactsModal");if(!m)return;
  const cats=Object.keys(SQ_CATS);
  let h='<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="openCtDetail(\''+_sqrContactId+'\')">✕</button>';
  h+='<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">QUOTE FROM '+esc(_sqrMeta.supplier_name||"SUPPLIER").toUpperCase()+'</div>';
  h+='<div style="font-size:14px;font-weight:800;margin-bottom:12px">'+_sqrItems.length+' item'+(_sqrItems.length!==1?'s':'')+' found</div>';

  h+='<div class="fld"><label>QUOTE DATE</label><input id="sqr_date" type="date" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="'+esc(_sqrMeta.quote_date||'')+'"/></div>';

  _sqrItems.forEach(function(it,i){
    h+='<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;position:relative">';
    h+='<button onclick="_sqrItems.splice('+i+',1);showQuoteReview()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#ef4444;font-size:14px;cursor:pointer;padding:4px" title="Remove">✕</button>';
    h+='<div class="fld"><label>ITEM</label><input id="sqr_desc_'+i+'" type="text" class="cinput" style="min-height:36px;font-size:13px;padding:8px" value="'+esc(it.item_description)+'" onchange="_sqrItems['+i+'].item_description=this.value"/></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    h+='<div class="fld"><label>CATEGORY</label><select id="sqr_cat_'+i+'" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" onchange="_sqrItems['+i+'].category=this.value">';
    cats.forEach(function(c){h+='<option value="'+c+'"'+(it.category===c?' selected':'')+'>'+(SQ_CAT_LABELS[c]||c)+'</option>';});
    h+='</select></div>';
    h+='<div class="fld"><label>UNIT</label><select id="sqr_unit_'+i+'" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" onchange="_sqrItems['+i+'].unit=this.value">';
    SQ_UNITS.forEach(function(u){h+='<option value="'+u+'"'+(it.unit===u?' selected':'')+'>'+u.replace(/_/g,' ')+'</option>';});
    h+='</select></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
    h+='<div class="fld"><label>UNIT PRICE</label><input id="sqr_price_'+i+'" type="number" step="0.01" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="'+(it.unit_price||'')+'" onchange="_sqrItems['+i+'].unit_price=Number(this.value);var t=document.getElementById(\'sqr_total_'+i+'\');if(t)t.value=(Number(this.value)*(_sqrItems['+i+'].quantity||1)).toFixed(2);_sqrItems['+i+'].total_price=Number(t?.value||0)"/></div>';
    h+='<div class="fld"><label>QTY</label><input id="sqr_qty_'+i+'" type="number" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="'+(it.quantity||1)+'" onchange="_sqrItems['+i+'].quantity=Number(this.value);var t=document.getElementById(\'sqr_total_'+i+'\');if(t)t.value=(_sqrItems['+i+'].unit_price*Number(this.value)).toFixed(2);_sqrItems['+i+'].total_price=Number(t?.value||0)"/></div>';
    h+='<div class="fld"><label>TOTAL</label><input id="sqr_total_'+i+'" type="number" step="0.01" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px;font-weight:800" value="'+(it.total_price||'')+'" onchange="_sqrItems['+i+'].total_price=Number(this.value)"/></div>';
    h+='</div>';
    h+='<div class="fld"><label>NOTES</label><input id="sqr_notes_'+i+'" type="text" class="cinput" style="min-height:36px;font-size:12px;padding:6px 8px" value="'+esc(it.notes)+'" placeholder="Optional" onchange="_sqrItems['+i+'].notes=this.value"/></div>';
    h+='</div>';
  });

  h+='<button onclick="_sqrItems.push({item_description:\'\',category:\'other\',unit_price:0,unit:\'each\',quantity:1,total_price:0,notes:\'\'});showQuoteReview()" style="width:100%;padding:10px;border-radius:10px;border:1px dashed rgba(255,255,255,0.15);background:transparent;color:#94a3b8;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:12px">+ Add Item</button>';
  h+='<div style="display:flex;gap:8px">';
  h+='<button onclick="saveQuoteItems()" class="btn" style="flex:1;padding:12px;font-size:14px;background:linear-gradient(135deg,#d4af37,#b8962e);color:#0a0a0a;font-weight:800;border:none">Save Quote</button>';
  h+='<button onclick="openCtDetail(\''+_sqrContactId+'\')" style="padding:12px 20px;font-size:13px;background:none;border:none;color:#64748b;font-weight:700;cursor:pointer">Cancel</button>';
  h+='</div></div>';

  m.innerHTML=h;
}

async function saveQuoteItems(){
  const items=_sqrItems.filter(function(it){return it.item_description.trim();});
  if(!items.length){showCtToast("No items to save");return;}

  const quoteDate=(document.getElementById("sqr_date")?.value)||null;

  // Upload document to storage in background
  let docUrl=null;
  if(_sqrFile){
    try{
      const path=storagePath(_sqrContactId,"quotes",_sqrFile);
      docUrl=await uploadToStorage(_sqrFile,"sovereign-docs",path);
    }catch(e){console.warn("[Quote] Storage upload failed:",e);}
  }

  let saved=0;
  try{
    for(let i=0;i<items.length;i++){
      const it=items[i];
      const payload={contact_id:_sqrContactId,item_description:it.item_description.trim(),category:it.category||"other",unit_price:it.unit_price||0,unit:it.unit||"each",quantity:it.quantity||1,total_price:it.total_price||0,quote_date:quoteDate,quote_document_url:docUrl,notes:it.notes||null,status:"quoted",created_by:SH_USER?.email||"unknown"};
      const res=await fetch(SB+"/rest/v1/supplier_quotes",{method:"POST",headers:HD,body:JSON.stringify(payload)});
      if(res.ok)saved++;
    }
    showCtToast(saved+" item"+(saved!==1?"s":"")+" saved");
    _sqrItems=[];_sqrMeta={};_sqrFile=null;
    openCtDetail(_sqrContactId);
  }catch(e){
    console.error("[Quote] Save failed:",e);
    showCtToast("Failed to save quote");
  }
}
