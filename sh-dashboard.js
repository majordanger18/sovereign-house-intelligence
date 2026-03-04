// Sovereign House Intelligence — Dashboard & Data
// ═══ DATA ═══
async function loadData(){
  try{
    const[p,w,a,ua,d]=await Promise.all([sb("properties?status=neq.Closed&listing_status=neq.Gone&order=sovereign_score.desc"),sb("watchlist?status=eq.Watching"),sb("alerts?is_read=eq.false&order=created_at.desc&limit=50"),sb("underwriting_analyses?select=property_id,verdict,profit_target,roi_target,max_offer_price,max_offer_raw,max_offer_tier,max_offer_flag,max_offer_discount_pct,list_price,created_at&order=created_at.desc"),sb("deals?order=updated_at.desc")]);
    props=Array.isArray(p)?p:[];
    deals=Array.isArray(d)?d:[];
    const wm={},ws=new Set();
    (Array.isArray(w)?w:[]).forEach(x=>{if(x.property_id){ws.add(x.property_id);wm[x.property_id]=x.id;}});
    watchIds=ws;watchMap=wm;alerts=Array.isArray(a)?a:[];
    analysisMap={};
    (Array.isArray(ua)?ua:[]).forEach(x=>{if(x.property_id&&!analysisMap[x.property_id])analysisMap[x.property_id]=x;});
    console.log("[SH] Loaded:",props.length,"properties,",Object.keys(analysisMap).length,"analyses,",alerts.length,"alerts,",watchIds.size,"watched,",deals.length,"deals");
    if(props.length>0){console.log("[SH] FIELD DUMP — first property keys:",Object.keys(props[0]).sort().join(", "));const p0=props[0];console.log("[SH] GUARD/GATED fields:",{is_gated:p0.is_gated,is_guard_gated:p0.is_guard_gated,guard_gated:p0.guard_gated,gated:p0.gated});console.log("[SH] REMARKS fields:",{showing_instructions:p0.showing_instructions?.substring(0,80),agent_remarks:p0.agent_remarks?.substring(0,80),private_remarks:p0.private_remarks?.substring(0,80),remarks:p0.remarks?.substring(0,80)});}
  }catch(e){console.error("[SH] Load error:",e);}
  document.getElementById("loading").style.display="none";
  document.getElementById("main").style.display="block";
  renderDashboard();
}

async function checkHealth(){
  const checks=[];
  checks.push({name:"Properties",ok:props.length>0,detail:`${props.length} loaded`});
  checks.push({name:"Analyses",ok:Object.keys(analysisMap).length>0,detail:`${Object.keys(analysisMap).length} found`});
  checks.push({name:"Alerts",ok:true,detail:`${alerts.length} unread`});
  checks.push({name:"Watchlist",ok:true,detail:`${watchIds.size} watching`});
  // Check if analyses table is accessible
  try{const t=await sb("underwriting_analyses?select=id&limit=1");checks.push({name:"Analysis Table",ok:Array.isArray(t),detail:Array.isArray(t)?`accessible`:"error"});}catch(e){checks.push({name:"Analysis Table",ok:false,detail:e.message});}
  // Check alerts table
  try{const t=await sb("alerts?select=id&limit=1");checks.push({name:"Alerts Table",ok:Array.isArray(t),detail:Array.isArray(t)?`accessible`:"error"});}catch(e){checks.push({name:"Alerts Table",ok:false,detail:e.message});}
  const allOk=checks.every(c=>c.ok);
  const toast=document.getElementById("alertToast");
  toast.innerHTML=`<div style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:${allOk?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)"};border:1px solid ${allOk?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"};animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:#e2e8f0">${allOk?"✅ System Healthy":"⚠️ System Check"}</div>${checks.map(c=>`<div style="font-size:11px;margin-top:4px;color:${c.ok?"#94a3b8":"#ef4444"}">${c.ok?"✓":"✗"} ${c.name}: ${c.detail}</div>`).join("")}</div>`;
  setTimeout(()=>{toast.innerHTML="";},5000);
  console.log("[SH] Health:",checks);
}

function renderDashboard(){
  const activeProps=props.filter(p=>!isPend(p)&&p.listing_status!=='Gone');
  const st={total:activeProps.length,hot:activeProps.filter(p=>(p.sovereign_score||0)>=60).length,watched:watchIds.size,
    reduced:activeProps.filter(p=>p.original_list_price&&p.list_price<p.original_list_price).length,
    pool:activeProps.filter(p=>p.pool).length,
    golf:activeProps.filter(p=>isGolf(p)).length,
    fresh:activeProps.filter(p=>p.days_on_market!=null&&p.days_on_market<=7).length,
    aiGo:props.filter(p=>analysisMap[p.id]&&analysisMap[p.id].verdict==="GO").length,
    aiMaybe:props.filter(p=>analysisMap[p.id]&&analysisMap[p.id].verdict==="CONDITIONAL_GO").length,
    aiNo:activeProps.filter(p=>analysisMap[p.id]&&analysisMap[p.id].verdict==="NO_GO").length,
    aiScreened:activeProps.filter(p=>!!analysisMap[p.id]).length,
    avgScore:props.length?Math.round(props.reduce((a,p)=>a+(p.sovereign_score||0),0)/props.length):0,
    avgPrice:props.length?Math.round(props.reduce((a,p)=>a+(p.list_price||0),0)/props.length):0,
    avgDom:props.length?Math.round(props.reduce((a,p)=>a+(p.days_on_market||0),0)/props.length):0};

  function sB(l,v,col,sub="",onclick="",extra=""){return`<div ${onclick?`onclick="${onclick}" style="cursor:pointer;${extra}`:`style="${extra}`}background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:8px 6px;text-align:center;transition:transform .1s" ${onclick?'onmousedown="this.style.transform=\'scale(0.97)\'" onmouseup="this.style.transform=\'scale(1)\'" ontouchstart="this.style.transform=\'scale(0.97)\'" ontouchend="this.style.transform=\'scale(1)\'"':""}><div style="font-size:8px;color:#475569;font-weight:700;letter-spacing:1px">${l}</div><div style="font-size:17px;font-weight:800;color:${col};margin-top:1px">${v}</div>${sub?`<div style="font-size:8px;color:#475569">${sub}</div>`:""}</div>`;}

  const screened=Object.keys(analysisMap).length;
  const screenedSub=`<span style="color:#22c55e;font-weight:700">${screened}</span> screened`;
  document.getElementById("statsArea").innerHTML=[sB("LISTINGS",st.total,"#e2e8f0",screenedSub),sB("AVG SCORE",st.avgScore,sc(st.avgScore)),sB("AVG PRICE",$k(st.avgPrice),"#e2e8f0"),sB("AVG DOM",st.avgDom,"#f59e0b","days")].join("");

  // Update alert badge
  const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
  const alertCount=alerts.filter(a=>!dismissed.includes(String(a.id))).length;
  const badge=document.getElementById("alertBadge");
  if(alertCount>0){badge.style.display="flex";document.getElementById("alertCount").textContent=alertCount;}
  else{badge.style.display="none";}

  // Alert toast
  const toastArea=document.getElementById("alertToast");
  if(alertCount>0&&!toastDismissed){
    const priceAlerts=alerts.filter(a=>!dismissed.includes(String(a.id))&&a.alert_type==="PRICE_CHANGE").length;
    const statusAlerts=alerts.filter(a=>!dismissed.includes(String(a.id))&&a.alert_type==="STATUS_CHANGE").length;
    const newAlerts=alerts.filter(a=>!dismissed.includes(String(a.id))&&a.alert_type==="NEW_LISTING").length;
    let summary=[];
    if(newAlerts)summary.push(`${newAlerts} new listing${newAlerts>1?"s":""}`);
    if(priceAlerts)summary.push(`${priceAlerts} price drop${priceAlerts>1?"s":""}`);
    if(statusAlerts)summary.push(`${statusAlerts} status change${statusAlerts>1?"s":""}`);
    toastArea.innerHTML=`<div id="toastCard" style="margin:8px 20px;padding:14px 16px;border-radius:14px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);cursor:pointer;animation:fadeUp .3s ease"><div style="font-size:13px;font-weight:700;color:#e2e8f0">Hey J & Lisa 👋</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">You have <span style="color:#d4af37;font-weight:700">${alertCount} alert${alertCount>1?"s":""}</span>${summary.length?" — "+summary.join(", "):""}</div><div style="font-size:11px;color:#d4af37;font-weight:700;margin-top:6px">Tap to review →</div></div>`;
    document.getElementById("toastCard").addEventListener("touchend",function(e){e.preventDefault();toastDismissed=true;localStorage.setItem("sh_toast_dismissed",new Date().toDateString());toastArea.innerHTML="";openAlerts();});
    document.getElementById("toastCard").addEventListener("click",function(){toastDismissed=true;localStorage.setItem("sh_toast_dismissed",new Date().toDateString());toastArea.innerHTML="";openAlerts();});
  } else {
    toastArea.innerHTML="";
  }

  const activeDeals=deals.filter(d=>!["closed","rejected","withdrawn","expired"].includes(d.status));
  const deadDeals=deals.filter(d=>["closed","rejected","withdrawn","expired"].includes(d.status));
  const queuedCount=activeProps.filter(p=>!analysisMap[p.id]).length;
  const fD=[["deals",`🤝 Deals (${activeDeals.length})`],["all",`All (${st.total})`],["fresh",`New (${st.fresh})`],["go",`GO (${st.aiGo})`],["maybe",`Maybe (${st.aiMaybe})`],["watched",`★ Watch (${st.watched})`],["queued",`Queued (${queuedCount})`],["reduced",`Reduced (${st.reduced})`],["golf",`Golf (${st.golf})`],["pending",`Pending (${props.filter(p=>isPend(p)).length})`]];
  document.getElementById("filtersArea").innerHTML=fD.map(([v,l])=>{
    const isDeals=v==="deals";
    const hasActive=isDeals&&activeDeals.length>0;
    const isOn=view===v;
    if(isDeals&&hasActive&&!isOn) return`<button class="filt" onclick="setView('${v}')" style="border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.06);color:#22c55e">${l}</button>`;
    if(isDeals&&isOn) return`<button class="filt on" onclick="setView('${v}')" style="border-color:rgba(34,197,94,0.5);background:rgba(34,197,94,0.12);color:#22c55e">${l}</button>`;
    return`<button class="filt${isOn?" on":""}" onclick="setView('${v}')">${l}</button>`;
  }).join("");
  renderList();
}

function setView(v){view=v;renderDashboard();}

function togglePulse(){
  showPulse=!showPulse;
  if(!showPulse){document.getElementById("pulseArea").innerHTML="";return;}
  const zips={};
  props.forEach(p=>{const z=p.zip_code||"?";if(!zips[z])zips[z]={c:0,tp:0,tps:0,td:0,po:0,g:0,r:0};zips[z].c++;zips[z].tp+=p.list_price||0;zips[z].tps+=p.price_per_sqft||0;zips[z].td+=p.days_on_market||0;if(p.pool)zips[z].po++;if(p.is_gated)zips[z].g++;if(p.original_list_price&&p.list_price<p.original_list_price)zips[z].r++;});
  document.getElementById("pulseArea").innerHTML=`<div style="padding:16px 20px 0"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">MARKET PULSE</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${Object.entries(zips).sort((a,b)=>b[1].c-a[1].c).map(([z,d])=>`<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px"><div style="font-size:16px;font-weight:800">${z}</div><div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.7"><span style="color:#94a3b8;font-weight:600">${d.c}</span> listings · ${$k(Math.round(d.tp/d.c))} avg<br>$${Math.round(d.tps/d.c)}/sf · ${Math.round(d.td/d.c)} DOM<br><span style="color:#3b82f6">${d.po}🏊</span> <span style="color:#22c55e">${d.g}🏘</span> <span style="color:#f59e0b">${d.r}↓</span></div></div>`).join("")}</div></div>`;
}

function renderList(){
  if(view==="deals"){renderDeals();return;}
  const q=document.getElementById("searchBox").value.toLowerCase();
  const sortBy=document.getElementById("sortBox").value;
  let list=[...props];
  list=list.filter(p=>{
    if(p.listing_status==='Gone')return false;
    if(view==="pending"){if(!isPend(p))return false;if(q)return(p.address||"").toLowerCase().includes(q)||(p.mls_number||"").toLowerCase().includes(q)||(p.zip_code||"").includes(q);return true;}
    if(view!=="pending"&&view!=="go"&&view!=="maybe"&&isPend(p))return false;
    if(view==="watched"&&!watchIds.has(p.id))return false;
    if(view==="reduced"&&!(p.original_list_price&&p.list_price<p.original_list_price))return false;
    if(view==="golf"&&!isGolf(p))return false;
    if(view==="go"&&(!analysisMap[p.id]||analysisMap[p.id].verdict!=="GO"))return false;
    if(view==="maybe"&&(!analysisMap[p.id]||analysisMap[p.id].verdict!=="CONDITIONAL_GO"))return false;
    if(view==="queued"&&!!analysisMap[p.id])return false;
    if(view==="fresh"&&!(p.days_on_market!=null&&p.days_on_market<=7))return false;
    if(q)return(p.address||"").toLowerCase().includes(q)||(p.mls_number||"").toLowerCase().includes(q)||(p.zip_code||"").includes(q);
    return true;
  });
  list.sort((a,b)=>{
    if(sortBy==="sovereign_score")return(b.sovereign_score||0)-(a.sovereign_score||0);
    if(sortBy==="price_asc")return(a.list_price||0)-(b.list_price||0);
    if(sortBy==="price_desc")return(b.list_price||0)-(a.list_price||0);
    if(sortBy==="dom")return(b.days_on_market||0)-(a.days_on_market||0);
    if(sortBy==="ppsf")return(a.price_per_sqft||999)-(b.price_per_sqft||999);
    if(sortBy==="oldest")return(a.year_built||0)-(b.year_built||0);
    if(sortBy==="newest")return(b.year_built||0)-(a.year_built||0);
    return 0;
  });
  document.getElementById("countLabel").textContent=`${list.length} properties`;
  if(!list.length){document.getElementById("listArea").innerHTML=`<div style="text-align:center;padding:40px;color:#475569;grid-column:1/-1"><div style="font-size:32px;margin-bottom:8px">🏠</div><div style="font-size:14px;font-weight:600">No properties match</div></div>`;return;}

  document.getElementById("listArea").innerHTML=list.map((p,i)=>{
    const isW=watchIds.has(p.id),red=p.original_list_price&&p.list_price<p.original_list_price;
    const redP=red?Math.round(((p.original_list_price-p.list_price)/p.original_list_price)*100):0;
    const ai=analysisMap[p.id];
    const aiBadge=ai?(ai.verdict==="GO"?tag("✅ GO","#22c55e"):ai.verdict==="CONDITIONAL_GO"?tag("⚠️ MAYBE","#f59e0b"):tag("🚫 NO","#ef4444")):"";
    const stats=`${p.bedrooms||"?"}/${p.bathrooms||"?"} · ${p.sqft?p.sqft.toLocaleString()+"sf":"?"} · ${p.year_built||"?"} · ${p.garage_spaces||"?"}G`;
    let flags=[];
    if(checkGuardGated(p))flags.push(tag("Guard-Gated","#d4af37","🛡"));else if(p.is_gated)flags.push(tag("Gated","#22c55e","🏘"));
    const golfStatus=isGolf(p);
    if(golfStatus==="frontage")flags.push(tag("On Course","#10b981","⛳"));else if(golfStatus==="community")flags.push(tag("Golf","#10b981","⛳"));
    if(p.days_on_market!=null&&p.days_on_market<=7)flags.push(tag("NEW","#a855f7","🆕"));
    flags.push(p.pool?tag("Pool","#3b82f6","🏊"):tag("No Pool","#ef4444"));
    if(p.days_on_market>=30)flags.push(tag(`${p.days_on_market}d`,"#f59e0b"));
    if(red)flags.push(tag(`↓${redP}%`,"#22c55e"));
    const offerColor=ai?.max_offer_tier==="realistic"?"#22c55e":ai?.max_offer_tier==="aggressive"?"#f59e0b":"#ef4444";
    const aiRow=ai?`<div style="display:flex;align-items:center;gap:6px;margin-top:5px">${aiBadge}${ai.verdict!=="NO_GO"&&ai.profit_target?`<span style="font-size:10px;color:#94a3b8">Target: <span style="color:${ai.profit_target>=100000?"#22c55e":"#f59e0b"};font-weight:700">${$k(ai.profit_target)}</span></span>`:""} ${(ai.max_offer_price||ai.max_offer_raw)?`<span style="font-size:10px;color:#94a3b8">Offer: <span style="color:${offerColor};font-weight:700">${$k(ai.max_offer_price||ai.max_offer_raw)}</span></span>`:""}</div>`:"";
    const pendingBadge=isPend(p)?`<div style="margin-top:5px"><span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#a855f7;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);padding:3px 8px;border-radius:6px">${p.status==="ActiveUnderContract"?"📋 UNDER CONTRACT":"⏳ PENDING"}</span></div>`:"";
    const isPending=isPend(p);
    return`<div class="card${isW?" watched":""}" onclick="openDetail('${p.id}')" style="animation:fadeUp .3s ease ${i*30}ms both;${isPending?"opacity:0.6":""}"><div style="display:flex;gap:12px;align-items:center">${ring(p.sovereign_score)}<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><div style="min-width:0;flex:1"><div style="font-size:14px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${isW?'<span style="color:#d4af37">★ </span>':""}${esc(p.address)}</div><div style="font-size:10px;color:#64748b;margin-top:1px">${(p.subdivision_name&&truncSub(p.subdivision_name))?`<span style="color:#94a3b8">${esc(truncSub(p.subdivision_name))}</span> · `:""}${p.zip_code}</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:17px;font-weight:800">${$(p.list_price)}</div>${p.price_per_sqft?`<div style="font-size:10px;color:#64748b">$${p.price_per_sqft}/sf</div>`:""}</div></div><div style="font-size:10px;color:#64748b;margin-top:4px">${stats}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${flags.join("")}</div>${aiRow}${pendingBadge}</div></div></div>`;
  }).join("");
}

document.getElementById("searchBox").addEventListener("input",()=>{const v=document.getElementById("searchBox").value;const c=document.getElementById("searchClear");if(c)c.style.display=v?"flex":"none";renderList();});
document.getElementById("sortBox").addEventListener("change",renderList);
