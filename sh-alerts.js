// Sovereign House Intelligence — Alerts System
// ═══ DEDUPLICATE ALERTS ═══
// Collapse duplicate alerts (same property + type within 24h) — keep most recent
function dedupeAlerts(list){
  const seen=new Map();
  const sorted=[...list].sort((a,b)=>{
    // RESURRECTION alerts always sort first
    const aPri=a.alert_type==='RESURRECTION'?2:a.alert_type==='INTELLIGENCE'?1:0;
    const bPri=b.alert_type==='RESURRECTION'?2:b.alert_type==='INTELLIGENCE'?1:0;
    if(aPri!==bPri)return bPri-aPri;
    return new Date(b.created_at)-new Date(a.created_at);
  });
  return sorted.filter(a=>{
    const key=(a.property_id||a.mls_number||"")+"__"+(a.alert_type||"");
    if(seen.has(key))return false;
    seen.set(key,true);
    return true;
  });
}
// ═══ ALERT DISMISS ═══
function markRead(aid){
  aid=String(aid);
  const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
  if(!dismissed.includes(aid))dismissed.push(aid);
  localStorage.setItem("sh_dismissed_alerts",JSON.stringify(dismissed));
  fetch(SB+"/rest/v1/alerts?id=eq."+aid,{method:"PATCH",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({is_read:true})}).catch(()=>{});
}
function removeAlertRow(aid,cb){
  const wrap=document.querySelector(`.swipe-wrap[data-aid="${aid}"]`);
  if(wrap){wrap.style.transition="all 0.3s ease";wrap.style.maxHeight="0px";wrap.style.opacity="0";wrap.style.margin="0";wrap.style.padding="0";wrap.style.overflow="hidden";setTimeout(()=>{markRead(aid);updateAlertBadge();updateAlertPageCount();if(cb)cb();},320);}
  else{markRead(aid);updateAlertBadge();updateAlertPageCount();if(cb)cb();}
}
function updateAlertBadge(){
  const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
  const visible=dedupeAlerts(alerts.filter(a=>!dismissed.includes(String(a.id))));
  const badge=document.getElementById("alertBadge");
  if(visible.length>0){badge.style.display="flex";document.getElementById("alertCount").textContent=visible.length;}
  else{badge.style.display="none";document.getElementById("alertToast").innerHTML="";}
}
function updateAlertPageCount(){
  const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
  const visible=dedupeAlerts(alerts.filter(a=>!dismissed.includes(String(a.id))));
  const ct=document.getElementById("alertPageCount");
  if(ct)ct.textContent=`${visible.length} alert${visible.length!==1?"s":""}`;
  if(visible.length===0){
    const list=document.getElementById("alertListArea");
    if(list)list.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="font-size:14px;font-weight:600">All clear</div></div>`;
  }
}
function dismissOne(aid){removeAlertRow(aid);}
function dismissAndOpen(aid,pid){removeAlertRow(aid,()=>{openDetail(pid);});}
function stillPass(aid,pid){
  fetch(SB+'/rest/v1/properties?id=eq.'+pid,{method:'PATCH',headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({disposition_date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})})}).catch(e=>console.error('Still pass update failed:',e));
  removeAlertRow(aid);
}
function dismissAllAlerts(){
  try{
    const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
    alerts.forEach(a=>{const aid=String(a.id);if(!dismissed.includes(aid)){dismissed.push(aid);fetch(SB+"/rest/v1/alerts?id=eq."+aid,{method:"PATCH",headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({is_read:true})}).catch(()=>{});}});
    localStorage.setItem("sh_dismissed_alerts",JSON.stringify(dismissed));
  }catch(e){console.error(e);}
  document.getElementById("alertBadge").style.display="none";
  document.getElementById("alertToast").innerHTML="";
  closeAlerts();
}

function openAlerts(){
  const dismissed=JSON.parse(localStorage.getItem("sh_dismissed_alerts")||"[]");
  const visible=dedupeAlerts(alerts.filter(a=>!dismissed.includes(String(a.id))));
  const renderAlert=a=>{
    const matchProp=props.find(p=>p.mls_number&&a.mls_number&&p.mls_number===a.mls_number);
    const propId=matchProp?matchProp.id:null;
    const addr=matchProp?matchProp.address:(a.message||'').replace(/\s*(went|price|dropped|from|–).*/i,'').replace(/\s*\$[\d,.]+.*/,'').trim()||'Unknown';
    const ico=a.alert_type==="INTELLIGENCE"?"🧠":a.alert_type==="RESURRECTION"?"🔄":a.alert_type==="NEW_LISTING"?"🆕":a.alert_type==="PRICE_CHANGE"?"💰":a.alert_type==="STATUS_CHANGE"?"🏠":a.alert_type?.includes("WATCHLIST")?"⭐":"📋";
    const col=a.alert_type==="INTELLIGENCE"?"#d4af37":a.alert_type==="RESURRECTION"?"#d4af37":a.alert_type==="NEW_LISTING"?"#22c55e":a.alert_type==="PRICE_CHANGE"?"#f59e0b":a.alert_type==="STATUS_CHANGE"?"#a855f7":a.alert_type?.includes("WATCHLIST")?"#d4af37":"#94a3b8";
    let label='',line1='',line2='',extraHtml='';
    if(a.alert_type==="RESURRECTION"){
      label="🔄 RESURRECTION";
      line1=addr;
      const oldP=a.old_value?Number(a.old_value):null,newP=a.new_value?Number(a.new_value):null;
      if(oldP&&newP){const pct=Math.round(((oldP-newP)/oldP)*100);line2='$'+oldP.toLocaleString()+' → $'+newP.toLocaleString()+(pct>0?' (↓'+pct+'%)':'');}
      else{line2=a.details||a.message||'';}
      const reason=matchProp?.disposition_reason||a.metadata?.disposition_reason||'';
      if(reason)extraHtml+=`<div style="font-size:10px;color:#94a3b8;margin-top:3px;font-style:italic">Passed: ${esc(reason)}</div>`;
      extraHtml+=`<div style="display:flex;gap:6px;margin-top:6px"><button onclick="event.stopPropagation();closeAlerts();openDetail('${propId||a.property_id}')" style="flex:1;padding:6px 10px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.08);color:#d4af37;cursor:pointer">Re-analyze</button><button onclick="event.stopPropagation();stillPass('${a.id}','${propId||a.property_id}')" style="flex:1;padding:6px 10px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#94a3b8;cursor:pointer">Still Pass</button></div>`;
    }else if(a.alert_type==="PRICE_CHANGE"){
      label="PRICE DROP";
      line1=addr;
      const oldP=a.old_value?Number(a.old_value):null,newP=a.new_value?Number(a.new_value):null;
      if(oldP&&newP){const pct=Math.round(((oldP-newP)/oldP)*100);line2='$'+oldP.toLocaleString()+' → $'+newP.toLocaleString()+(pct>0?' (↓'+pct+'%)':'');}
      else{line2=a.details||a.message||'';}
    }else if(a.alert_type==="STATUS_CHANGE"){
      label="WENT PENDING";
      const nv=(a.new_value||'').toLowerCase();
      if(nv.includes('active')&&!nv.includes('pending')&&!nv.includes('contract')){label="BACK ON MARKET";}
      else if(nv.includes('closed')||nv.includes('sold')){label="SOLD";}
      else if(nv.includes('cancel')||nv.includes('withdraw')){label="CANCELLED";}
      line1=addr;
      line2='';
    }else if(a.alert_type==="NEW_LISTING"){
      label="NEW LISTING";
      if(matchProp){line1=addr+' — $'+Number(matchProp.list_price).toLocaleString();line2=(matchProp.bedrooms||'?')+'bd/'+(matchProp.bathrooms||'?')+'ba · '+(matchProp.sqft?matchProp.sqft.toLocaleString()+'sf':'?');}
      else{const rawMsg=a.message||'';const priceMatch=rawMsg.match(/\$?([\d,]+(?:\.\d+)?)/);const price=priceMatch?'$'+Number(priceMatch[1].replace(/,/g,'')).toLocaleString():'';line1=addr+(price?' — '+price:'');line2=a.details||'';}
    }else if(a.alert_type==="INTELLIGENCE"){
      label="INTELLIGENCE";
      const rawMsg=a.message||'';const cleanMsg=rawMsg.replace(/^\ud83e\udde0\s*/,'');
      line1=a.address||addr;line2=cleanMsg;
      if(a.property_id||propId){
        extraHtml+='<div style="display:flex;gap:6px;margin-top:6px"><button onclick="event.stopPropagation();closeAlerts();openDetail(\''+(propId||a.property_id)+'\')" style="flex:1;padding:6px 10px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.08);color:#d4af37;cursor:pointer">View Property</button></div>';
      }
    }else{
      label=a.alert_type||"ALERT";line1=a.message||'';line2=a.details||'';
    }
    const resBorder=(a.alert_type==='RESURRECTION'||a.alert_type==='INTELLIGENCE')?'border:1px solid rgba(212,175,55,0.3);background:#1a1710;':'';
    const swipeBg=(a.alert_type==='INTELLIGENCE'||a.alert_type==='RESURRECTION')?'background:rgba(212,175,55,0.3)':'';
    return`<div class="swipe-wrap" data-aid="${a.id}"><div class="swipe-bg" style="${swipeBg}"><span>Delete</span></div><div class="swipe-card" onclick="${propId?`closeAlerts();openDetail('${propId}')`:''}" style="${resBorder}${propId?'cursor:pointer':''}"><span style="color:${col};flex-shrink:0;font-size:20px">${ico}</span><div style="flex:1;min-width:0"><span style="font-size:9px;font-weight:800;letter-spacing:1px;color:${col};text-transform:uppercase">${label}</span><div style="color:#e2e8f0;font-weight:600;font-size:13px;margin-top:2px">${esc(line1)}</div>${line2?`<div style="font-size:11px;color:#94a3b8;margin-top:2px">${esc(line2)}</div>`:''}${extraHtml}<div style="font-size:9px;color:#475569;margin-top:3px">${a.created_at?new Date(a.created_at).toLocaleString():""}</div></div><button onclick="event.stopPropagation();dismissOne('${a.id}')" class="alert-x">✕</button></div></div>`;
  };
  const m=document.getElementById("alertModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeAlerts()">✕</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-right:40px">
      <div>
        <div style="font-size:9px;color:#d4af37;font-weight:800;letter-spacing:3px">ALERTS</div>
        <div id="alertPageCount" style="font-size:14px;font-weight:700;color:#94a3b8;margin-top:2px">${visible.length} alert${visible.length!==1?"s":""}</div>
      </div>
      ${visible.length>0?`<button onclick="dismissAllAlerts()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:10px;color:#ef4444;font-size:12px;font-weight:700;padding:8px 16px;cursor:pointer;min-height:40px">Clear All</button>`:""}
    </div>
    <div id="alertListArea" style="overflow-y:auto;max-height:calc(100dvh - 200px);-webkit-overflow-scrolling:touch">
      ${visible.length>0?visible.map(renderAlert).join(""):`<div style="text-align:center;padding:40px 20px;color:#475569"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="font-size:14px;font-weight:600">All clear — no alerts</div></div>`}
    </div>
  </div>`;
  m.style.display="block";
  document.body.style.overflow="hidden";
  requestAnimationFrame(initSwipe);
}
function closeAlerts(){document.getElementById("alertModal").style.display="none";if(document.getElementById("detailModal").style.display==="block"){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}}

function initSwipe(){
  document.querySelectorAll(".swipe-card").forEach(card=>{
    let sx=0,cx=0,sw=false;const wrap=card.closest(".swipe-wrap");
    card.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;cx=sx;sw=true;card.style.transition="none";},{passive:true});
    card.addEventListener("touchmove",e=>{if(!sw)return;cx=e.touches[0].clientX;const dx=cx-sx;if(dx<0){card.style.transform=`translateX(${dx}px)`;}},{passive:true});
    card.addEventListener("touchend",()=>{if(!sw)return;sw=false;const dx=cx-sx;const aid=wrap.dataset.aid;
      if(dx<-60){card.style.transition="transform 0.2s ease";card.style.transform="translateX(-110%)";setTimeout(()=>{removeAlertRow(aid);},200);}
      else{card.style.transition="transform 0.15s ease";card.style.transform="translateX(0)";}
    });
  });
}

// ═══ BADGE TAP ═══
document.getElementById("alertBadge").addEventListener("click",function(){openAlerts();});
document.getElementById("alertBadge").addEventListener("touchend",function(e){e.preventDefault();openAlerts();});

// ═══════════════════════════════════════════
// ═══ OFFER PIPELINE ═══
// ═══════════════════════════════════════════
// offerParams stores the calc parameters so updateOfferCalc uses identical math
