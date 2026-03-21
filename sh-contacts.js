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
      sb("contractor_bids?select=*,contacts(display_name,company),deals(address)&order=deal_id,created_at")
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
  let h='';
  // Search + filters
  h+=`<div class="ct-filters"><div style="flex:1;min-width:200px"><input id="ctSrch" type="text" class="cinput" placeholder="Search name, company, phone, email..." value="${esc(ctSearch)}" oninput="ctSearch=this.value;renderCtSub()"/></div>`;
  h+=`<select id="ctTF" class="cinput ct-fsel" onchange="ctTypeF=this.value;renderCtSub()"><option value="all">All Types</option>`;
  CT_TYPES.forEach(t=>{h+=`<option value="${t}"${ctTypeF===t?" selected":""}>${CT_LABELS[t]}</option>`;});
  h+=`</select>`;
  h+=`<select id="ctSF" class="cinput ct-fsel" onchange="ctStatusF=this.value;renderCtSub()"><option value="active"${ctStatusF==="active"?" selected":""}>Active</option><option value="inactive"${ctStatusF==="inactive"?" selected":""}>Inactive</option><option value="do_not_use"${ctStatusF==="do_not_use"?" selected":""}>Do Not Use</option><option value="all"${ctStatusF==="all"?" selected":""}>All</option></select></div>`;

  // + Add Contact button
  h+=`<div style="margin:12px 0"><button onclick="openCtForm()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">+ Add Contact</button></div>`;

  // Filter contacts
  let list=[...ctList];
  if(ctStatusF!=="all")list=list.filter(c=>c.status===ctStatusF);
  if(ctTypeF!=="all")list=list.filter(c=>c.contact_type===ctTypeF);
  if(ctSearch){
    const q=ctSearch.toLowerCase();
    list=list.filter(c=>(c.display_name||"").toLowerCase().includes(q)||(c.company||"").toLowerCase().includes(q)||(c.phone||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q));
  }

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
    // Contact info row
    h+=`<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">`;
    if(c.phone)h+=`<a href="tel:${esc(c.phone)}" onclick="event.stopPropagation()" style="font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.phone)}</a>`;
    if(c.email)h+=`<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()" style="font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600">${esc(c.email)}</a>`;
    h+=`</div>`;
    // Tags
    if(tags.length){
      h+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">`;
      tags.forEach(t=>{h+=`<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8">${esc(t.replace(/_/g," "))}</span>`;});
      h+=`</div>`;
    }
    if(c.status==="do_not_use")h+=`<div style="font-size:9px;color:#ef4444;margin-top:4px;font-weight:700">⚠ DO NOT USE${c.do_not_use_reason?" — "+esc(c.do_not_use_reason):""}</div>`;
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
function openCtForm(editId){
  const c=editId?ctList.find(x=>x.id===editId):null;
  const isEdit=!!c;
  const m=document.getElementById("contactsModal");

  let h=`<div class="sheet" style="position:relative;max-height:90vh;overflow-y:auto"><div class="handle"></div><button class="close-x" onclick="closeCtModal()">✕</button>`;
  h+=`<div style="font-size:10px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:4px">${isEdit?"EDIT":"NEW"} CONTACT</div>`;
  h+=`<div style="font-size:18px;font-weight:800;margin-bottom:16px">${isEdit?esc(c.display_name):"Add Contact"}</div>`;

  // Required fields
  h+=`<div class="row2"><div class="fld"><label>FIRST NAME</label><input id="cfFirst" type="text" class="cinput" value="${isEdit?esc(c.first_name||""):""}"/></div>`;
  h+=`<div class="fld"><label>LAST NAME</label><input id="cfLast" type="text" class="cinput" value="${isEdit?esc(c.last_name||""):""}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>COMPANY</label><input id="cfCo" type="text" class="cinput" value="${isEdit?esc(c.company||""):""}"/></div>`;
  h+=`<div class="fld"><label>TYPE</label><select id="cfType" class="cinput">`;
  CT_TYPES.forEach(t=>{h+=`<option value="${t}"${(isEdit?c.contact_type:"")=== t?" selected":""}>${CT_LABELS[t]}</option>`;});
  h+=`</select></div></div>`;

  // Contact fields
  h+=`<div class="row2"><div class="fld"><label>PHONE</label><input id="cfPhone" type="tel" class="cinput" value="${isEdit?esc(c.phone||""):""}"/></div>`;
  h+=`<div class="fld"><label>EMAIL</label><input id="cfEmail" type="email" class="cinput" value="${isEdit?esc(c.email||""):""}"/></div></div>`;
  h+=`<div class="fld"><label>ADDRESS</label><input id="cfAddr" type="text" class="cinput" value="${isEdit?esc(c.address||""):""}"/></div>`;
  h+=`<div class="row3"><div class="fld"><label>CITY</label><input id="cfCity" type="text" class="cinput" value="${isEdit?esc(c.city||""):"Las Vegas"}"/></div>`;
  h+=`<div class="fld"><label>STATE</label><input id="cfState" type="text" class="cinput" value="${isEdit?esc(c.state||""):"NV"}"/></div>`;
  h+=`<div class="fld"><label>ZIP</label><input id="cfZip" type="text" class="cinput" value="${isEdit?esc(c.zip||""):""}"/></div></div>`;
  h+=`<div class="row2"><div class="fld"><label>WEBSITE</label><input id="cfWeb" type="url" class="cinput" value="${isEdit?esc(c.website||""):""}"/></div>`;
  h+=`<div class="fld"><label>LICENSE #</label><input id="cfLic" type="text" class="cinput" value="${isEdit?esc(c.license_number||""):""}"/></div></div>`;
  h+=`<div class="fld"><label>REFERRED BY</label><input id="cfRef" type="text" class="cinput" value="${isEdit?esc(c.referred_by||""):""}"/></div>`;

  // Tags
  const existingTags=isEdit&&Array.isArray(c.specialty_tags)?c.specialty_tags.join(", "):"";
  h+=`<div class="fld"><label>SPECIALTY TAGS <span style="font-weight:400;color:#475569">(comma-separated)</span></label><input id="cfTags" type="text" class="cinput" placeholder="electrical, plumbing, hvac..." value="${esc(existingTags)}" list="tagSugs"/><datalist id="tagSugs">${SPEC_SUGGESTIONS.map(s=>`<option value="${s}">`).join("")}</datalist></div>`;

  h+=`<div class="fld"><label>NOTES</label><textarea id="cfNotes" rows="3" class="cinput" style="min-height:60px;font-size:13px">${isEdit?esc(c.relationship_notes||""):""}</textarea></div>`;

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
  const first=gv("cfFirst"),last=gv("cfLast");
  if(!first&&!last){alert("Enter a first or last name.");return;}

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

  let h=`<div style="font-size:11px;color:#475569;font-weight:600;margin-bottom:8px">${ctPerf.length} contractor${ctPerf.length!==1?"s":""}</div>`;
  ctPerf.forEach((p,i)=>{
    const tc=CT_COLORS[p.contact_type]||"#f97316";
    const tags=Array.isArray(p.specialty_tags)?p.specialty_tags:[];
    const baColor=bidAccColor(p.avg_bid_accuracy);
    const taColor=bidAccColor(p.avg_timeline_accuracy);
    const coColor=(p.total_change_orders||0)>3?"#ef4444":(p.total_change_orders||0)>=1?"#eab308":"#22c55e";

    h+=`<div class="ct-card ct-perf-card" onclick="openCtDetail('${p.contact_id}')" style="animation:fadeUp .3s ease ${i*20}ms both">`;
    h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:10px">`;
    h+=`<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.display_name||"")}</div>`;
    if(p.company)h+=`<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(p.company)}</div>`;
    h+=`</div>`;
    h+=`<div style="text-align:right">${renderStars(p.avg_rating)}</div>`;
    h+=`</div>`;

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
  h+=`<div style="margin-bottom:12px"><button onclick="openBidForm()" class="btn" style="width:100%;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.06));border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-weight:800">+ Log Bid</button></div>`;

  if(!ctBids.length){
    h+=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:600;color:#94a3b8">No bids logged yet.</div><div style="font-size:12px;color:#64748b;margin-top:6px">Upload or log your first contractor bid.</div></div>`;
    el.innerHTML=h;return;
  }

  // Group by deal
  const byDeal={};
  ctBids.forEach(b=>{const did=b.deal_id||"none";if(!byDeal[did])byDeal[did]={address:b.deals?.address||"Unknown Deal",bids:[]};byDeal[did].bids.push(b);});

  Object.entries(byDeal).forEach(([did,group])=>{
    h+=`<div style="margin-top:16px"><div style="font-size:12px;font-weight:800;color:#f1f5f9;padding:8px 0;border-bottom:1px solid rgba(212,175,55,0.15);margin-bottom:8px">${esc(group.address)}</div>`;
    h+=`<div class="reno-tw"><table class="reno-tbl"><thead><tr><th>Contractor</th><th style="text-align:right">Initial</th><th style="text-align:right">Negotiated</th><th style="text-align:right">Final</th><th>Materials</th><th class="reno-hm">Timeline</th><th>Status</th>`;
    // Post-completion columns if any have actual cost
    const hasActual=group.bids.some(b=>b.actual_total_cost);
    if(hasActual)h+=`<th style="text-align:right" class="reno-hm">Actual</th><th class="reno-hm">Accuracy</th><th class="reno-hm">Rating</th>`;
    h+=`</tr></thead><tbody>`;

    group.bids.forEach(b=>{
      const bsc=BID_STAT_COLORS[b.status]||"#64748b";
      const mc=MAT_COLORS[b.material_handling]||"#64748b";
      const ml=MAT_LABELS[b.material_handling]||b.material_handling||"—";
      const accepted=b.status==="accepted";
      h+=`<tr class="reno-r" onclick="openBidForm('${b.id}')" style="${accepted?"border-left:3px solid #22c55e":""}">`;
      h+=`<td style="font-weight:600;color:#e2e8f0">${esc(b.contacts?.display_name||"—")}${b.contacts?.company?`<div style="font-size:9px;color:#64748b">${esc(b.contacts.company)}</div>`:""}</td>`;
      h+=`<td style="text-align:right;font-weight:700">${$r(b.initial_bid)}</td>`;
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
      h+=`</tr>`;
    });
    h+=`</tbody></table></div></div>`;
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
  h+=`<div class="fld"><label>BID DATE</label><input id="bfDate" type="date" class="cinput" value="${isEdit&&b.bid_date?b.bid_date:new Date().toISOString().split("T")[0]}"/></div></div>`;
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

// ═══ HELPERS ═══
function showCtToast(msg){
  const t=document.getElementById("alertToast");
  t.innerHTML=`<div style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:#22c55e">✓ ${esc(msg)}</div></div>`;
  setTimeout(()=>{t.innerHTML="";},3000);
}

function closeCtModal(){document.getElementById("contactsModal").style.display="none";document.body.style.overflow="";}
