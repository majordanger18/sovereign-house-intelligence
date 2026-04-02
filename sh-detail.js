// Sovereign House Intelligence — Property Detail View
async function openDetail(id){
  window._savedScrollY=window.scrollY;
  const p=props.find(x=>x.id===id);if(!p)return;
  const[ph,compsRaw]=await Promise.all([
    sb(`price_changes?mls_number=eq.${p.mls_number}&order=detected_at.desc`),
    sb(`sold_comps?zip_code=eq.${p.zip_code}&order=sold_date.desc&limit=200`)
  ]);
  const priceHist=Array.isArray(ph)?ph:[];
  const allComps=Array.isArray(compsRaw)?compsRaw:[];
  
  // Filter comps by similarity — prioritize same subdivision and same street
  const pSubdiv=(p.subdivision_name||p.community||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const pStreet=(p.address||'').split(/\d+\s*/)[1]||'';
  const pStreetClean=pStreet.toLowerCase().replace(/\s*(st|street|ave|avenue|dr|drive|ct|court|ln|lane|blvd|way|cir|circle|pl|place)\s*$/i,'').trim();
  const scored=allComps.map(c=>{
    let score=0;
    // Tier 1: Same subdivision (highest priority)
    const cSubdiv=(c.subdivision_name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(pSubdiv&&cSubdiv&&(cSubdiv.includes(pSubdiv)||pSubdiv.includes(cSubdiv)||cSubdiv.replace(/phase\d+/,'')===pSubdiv.replace(/phase\d+/,'')))score+=10;
    // Tier 1: Same street
    const cStreet=(c.address||'').split(/\d+\s*/)[1]||'';
    const cStreetClean=cStreet.toLowerCase().replace(/\s*(st|street|ave|avenue|dr|drive|ct|court|ln|lane|blvd|way|cir|circle|pl|place)\s*$/i,'').trim();
    if(pStreetClean&&cStreetClean&&cStreetClean===pStreetClean)score+=8;
    // Tier 2: Physical similarity
    const sqftDiff=Math.abs((c.sqft||0)-(p.sqft||0));
    if(sqftDiff<=500)score+=3;else if(sqftDiff<=800)score+=2;else if(sqftDiff<=1000)score+=1;
    if(Math.abs((c.bedrooms||0)-(p.bedrooms||0))<=1)score+=2;
    if(c.pool===p.pool)score+=1;
    if(c.is_gated===p.is_gated)score+=2;
    // Proximity scoring (nearby sales regardless of subdivision name)
    if(p.latitude&&p.longitude&&c.latitude&&c.longitude){
      const dlat=p.latitude-c.latitude,dlng=p.longitude-c.longitude;
      const miles=Math.sqrt(dlat*dlat+dlng*dlng)*69;
      if(miles<=0.25)score+=8;
      else if(miles<=0.5)score+=5;
      else if(miles<=1)score+=3;
    }
    const adj=c.sold_price||(c.list_price||0);
    const adjPpsf=c.sqft?Math.round(adj/c.sqft):0;
    return{...c,comp_score:score,adj_ppsf:adjPpsf};
  });
  // Debug: log Silver Oaks scoring
  const silverOaks=scored.find(c=>(c.address||'').toLowerCase().includes('silver oaks'));
  if(silverOaks)console.log('Silver Oaks score:',silverOaks.comp_score,'lat:',silverOaks.latitude,'lng:',silverOaks.longitude,'pLat:',p.latitude,'pLng:',p.longitude);
  const filtered=scored.filter(c=>c.comp_score>=3).sort((a,b)=>b.comp_score-a.comp_score);
  console.log('Top 10 comp scores:',filtered.slice(0,10).map(c=>c.address+': '+c.comp_score));
  const scored2=filtered.slice(0,8);
  
  // Calculate avg PPSF from comps
  const compPpsfs=scored2.filter(c=>c.adj_ppsf>0).map(c=>c.adj_ppsf);
  const avgPpsf=compPpsfs.length?Math.round(compPpsfs.reduce((a,b)=>a+b,0)/compPpsfs.length):0;
  const suggestedArv=avgPpsf&&p.sqft?$(avgPpsf*p.sqft):"—";

  const isW=watchIds.has(p.id),red=p.original_list_price&&p.list_price<p.original_list_price;
  let dtags="";
  if(checkGuardGated(p))dtags+=tag("Guard-Gated","#d4af37","🛡");else if(p.is_gated)dtags+=tag("Gated","#22c55e","🏘");
  const golfD=isGolf(p);
  if(golfD==="frontage")dtags+=tag("On Course","#10b981","⛳");
  else if(golfD==="community")dtags+=tag("Golf Community","#10b981","⛳");
  const freshD=p.days_on_market!=null&&p.days_on_market<=7;
  if(freshD)dtags+=tag("NEW","#a855f7","🆕");
  dtags+=p.pool?tag("Pool","#3b82f6","🏊"):tag("No Pool","#ef4444","✕");
  if(red)dtags+=tag("Price Cut","#22c55e","↓");
  if(p.days_on_market>=30)dtags+=tag(`${p.days_on_market} DOM`,"#f59e0b","⏳");
  if(p.hoa_monthly)dtags+=tag(`HOA $${p.hoa_monthly}/mo`);

  let phH="";
  if(priceHist.length>0){phH=`<div style="margin-top:16px"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:6px">PRICE HISTORY</div>${priceHist.map(h=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">${new Date(h.detected_at).toLocaleDateString()}</span><span><span style="color:#64748b">${$(h.old_price)}</span> → <span style="color:${h.change_amount<0?"#22c55e":"#ef4444"};font-weight:600">${$(h.new_price)}</span></span></div>`).join("")}</div>`;}

  const m=document.getElementById("detailModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeDetail()">✕</button>
    <div style="display:flex;gap:14px;align-items:center;padding-right:40px">${ring(p.sovereign_score,56)}<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:800">${esc(p.address)}</div><div style="font-size:12px;color:#64748b">${(p.subdivision_name&&truncSub((window.communityNameMap&&window.communityNameMap[p.subdivision_name])||p.subdivision_name))?`<span style="color:#d4af37;font-weight:600">${esc(truncSub((window.communityNameMap&&window.communityNameMap[p.subdivision_name])||p.subdivision_name))}</span> · `:""}${p.city}, NV ${p.zip_code} · MLS# ${p.mls_number}</div></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">${(()=>{
      const ai=analysisMap[p.id];
      const hasVerdict=ai&&(ai.verdict==="GO"||ai.verdict==="CONDITIONAL_GO");
      const reasonMap={visited_passed:"Visited & Passed",price_too_high:"Price Too High",condition_worse:"Condition Worse",layout_doesnt_work:"Layout Issue",neighborhood_issue:"Neighborhood",already_sold:"Already Sold",other:"Other"};
      const price=`<div style="font-size:26px;font-weight:800">${$(p.list_price)}</div>`;
      if(p.disposition==="passed") return price+`<div style="display:flex;align-items:center;gap:8px"><span class="passed-badge">PASSED</span><button class="undo-pass" onclick="undoPass('${p.id}')">Undo</button></div>`;
      if(hasVerdict) return price+`<button class="pass-btn" onclick="event.stopPropagation();showPassModal('${p.id}')">✕ Pass</button>`;
      return price;
    })()}</div>
    ${red?`<div style="font-size:12px;color:#22c55e;font-weight:600;margin-top:2px">↓ From ${$(p.original_list_price)} (${Math.round(((p.original_list_price-p.list_price)/p.original_list_price)*100)}%)</div>`:""}
    <div class="dgrid" style="margin-top:16px">${[["Beds",p.bedrooms],["Baths",p.bathrooms],["Sqft",p.sqft?.toLocaleString()],["Lot",p.lot_sqft?.toLocaleString()],["Built",p.year_built],["Garage",p.garage_spaces?`${p.garage_spaces}-car`:"—"],["$/Sqft",p.price_per_sqft?`$${p.price_per_sqft}`:"—"],["DOM",p.days_on_market]].map(([l,v])=>`<div style="background:rgba(255,255,255,0.02);border-radius:10px;padding:10px;text-align:center"><div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">${l}</div><div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-top:2px">${v||"—"}</div></div>`).join("")}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:12px">${dtags}</div>
    ${(p.occupant_type||p.access_code)?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">${p.occupant_type?`<span style="font-size:11px;color:#94a3b8"><span style="color:#64748b">Occupant:</span> <span style="font-weight:600;color:#e2e8f0">${esc(p.occupant_type)}</span></span>`:""} ${p.access_code?`<span style="font-size:11px;color:#94a3b8"><span style="color:#64748b">Access:</span> <span style="font-weight:600;color:#e2e8f0">${esc(p.access_code)}</span></span>`:""}</div>`:""}
    ${p.description?`<div style="margin-top:14px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);font-size:12px;color:#94a3b8;line-height:1.6;max-height:100px;overflow-y:auto">${esc(p.description)}</div>`:""}

    <div style="margin-top:14px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">LISTING AGENT</div>
      <div style="font-size:16px;font-weight:700;color:#e2e8f0">${esc(p.listing_agent_name)||"Unknown Agent"}</div>
      ${p.listing_office?`<div style="font-size:12px;color:#94a3b8;margin-top:2px">${esc(p.listing_office)}</div>`:""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        ${p.listing_agent_phone?`<a href="tel:${p.listing_agent_phone}" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:#22c55e;font-size:13px;font-weight:700;text-decoration:none;min-height:44px">📞 ${p.listing_agent_phone}</a>`:""}
        ${p.listing_agent_email?`<a href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(p.listing_agent_email)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);color:#3b82f6;font-size:13px;font-weight:700;text-decoration:none;min-height:44px">✉️ Gmail</a><a href="https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(p.listing_agent_email)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);color:#818cf8;font-size:13px;font-weight:700;text-decoration:none;min-height:44px">📧 Outlook</a>`:""}
      </div>
    </div>

    ${p.showing_instructions?`<div style="margin-top:10px;padding:14px;border-radius:12px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15)"><div style="font-size:10px;color:#f59e0b;font-weight:700;letter-spacing:2px;margin-bottom:6px">🔑 SHOWING INSTRUCTIONS</div><div style="font-size:13px;color:#e2e8f0;line-height:1.6">${esc(p.showing_instructions)}</div></div>`:""}

    ${p.agent_remarks?`<div style="margin-top:10px;padding:14px;border-radius:12px;background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.15)"><div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:2px;margin-bottom:6px">📝 AGENT REMARKS</div><div style="font-size:13px;color:#e2e8f0;line-height:1.6">${esc(p.agent_remarks)}</div></div>`:""}

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <a href="https://www.zillow.com/homes/${encodeURIComponent(p.address+' '+p.city+' NV '+p.zip_code)}_rb/" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:rgba(0,106,255,0.08);border:1px solid rgba(0,106,255,0.2);color:#3b82f6;font-size:12px;font-weight:700;text-decoration:none">🏠 Zillow</a>
      <button onclick="navigator.clipboard.writeText('${p.mls_number}').then(()=>{const t=document.createElement('div');t.textContent='MLS# ${p.mls_number} copied — paste in MLS app';t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#f97316;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;z-index:99999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4)';document.body.appendChild(t);setTimeout(()=>t.remove(),2500)})" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:rgba(234,88,12,0.08);border:1px solid rgba(234,88,12,0.2);color:#f97316;font-size:12px;font-weight:700;cursor:pointer">🔍 Copy MLS# ${p.mls_number}</button>
    </div>
    ${phH}
    
    ${scored2.length>0?`<div style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:10px;color:#22c55e;font-weight:700;letter-spacing:2px">📊 SOLD COMPS (${scored2.length})</div>${avgPpsf?`<div style="font-size:11px;color:#94a3b8">Avg <span style="color:#22c55e;font-weight:700">$${avgPpsf}/sf</span>${p.sqft?` → Est. ARV <span style="color:#22c55e;font-weight:700">${suggestedArv}</span>`:""}</div>`:""}</div>${scored2.map(c=>`<div style="padding:10px;margin-bottom:6px;border-radius:10px;background:rgba(34,197,94,0.03);border:1px solid rgba(34,197,94,0.08)"><div style="display:flex;justify-content:space-between;align-items:start"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.address)}</div><div style="font-size:10px;color:#64748b;margin-top:2px">${c.bedrooms||"?"}bd/${c.bathrooms||"?"}ba · ${c.sqft?c.sqft.toLocaleString()+"sf":"?"} · ${c.pool?"Pool":"No Pool"}${c.is_gated?" · Gated":""}</div></div><div style="text-align:right;flex-shrink:0;margin-left:10px"><div style="font-size:14px;font-weight:800;color:#22c55e">${$(c.sold_price)}</div><div style="font-size:10px;color:#94a3b8;font-weight:600">$${c.adj_ppsf}/sf</div></div></div><div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:#475569">${c.sold_date?`<span>Sold ${new Date(c.sold_date).toLocaleDateString()}</span>`:""} ${c.days_on_market?`<span>${c.days_on_market} DOM</span>`:""} ${c.subdivision_name?`<span>${esc(truncSub((window.communityNameMap&&window.communityNameMap[c.subdivision_name])||c.subdivision_name))}</span>`:""}</div></div>`).join("")}</div>`:`<div style="margin-top:16px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:2px">📊 SOLD COMPS</div><div style="font-size:12px;color:#475569;margin-top:6px">No matching comps in ${p.zip_code}</div></div>`}

    <div style="margin-top:16px"><div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:1px;margin-bottom:6px">NOTES</div><div style="display:flex;gap:8px"><input id="noteInput" type="text" placeholder="Drive-by notes, ideas..." style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:16px;outline:none;min-height:44px"/><button onclick="saveNote('${p.id}')" class="btn" style="padding:0 16px;background:rgba(212,175,55,0.15);color:#d4af37;font-size:12px">Save</button></div><div id="notesContainer" style="margin-top:8px">${p.notes?renderNotes(p.id,p.notes):""}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:20px">
      <button id="watchBtn_${p.id}" onclick="${isW?`unwatchProp('${p.id}')`:`watchProp('${p.id}')`}" class="btn" style="width:100%;font-size:14px;padding:14px;background:${isW?"rgba(212,175,55,0.15)":"rgba(212,175,55,0.9)"};color:${isW?"#d4af37":"#0a0a0a"}">${isW?"★ Watching":"☆ Add to Watchlist"}</button>
      <div style="display:flex;gap:8px">
        <button onclick="openCalc('${p.id}')" class="btn" style="flex:1;font-size:13px;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#f1f5f9">🧮 Run Numbers</button>
        <button onclick="copyLisa('${p.id}')" class="btn" style="flex:1;font-size:13px;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#f1f5f9">📋 Text Lisa</button>
      </div>
      <button id="aiBtn_${p.id}" onclick="aiUnderwrite('${p.id}')" class="btn" style="width:100%;margin-top:8px;font-size:14px;padding:14px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(212,175,55,0.15));border:1px solid rgba(139,92,246,0.3);color:#c4b5fd">🤖 AI Underwrite — Claude Analysis</button>
      <button onclick="openOffer('${p.id}')" class="btn" style="width:100%;margin-top:8px;font-size:14px;padding:14px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(212,175,55,0.15));border:1px solid rgba(34,197,94,0.3);color:#4ade80">📝 Make Offer</button>
      <div id="aiResult_${p.id}"></div>
    </div>
  </div>`;
  m.style.display="block";document.body.style.overflow="hidden";
}

function closeDetail(){document.getElementById("detailModal").style.display="none";document.body.style.overflow="";if(typeof window._savedScrollY==="number"){window.scrollTo(0,window._savedScrollY);}}

async function watchProp(id){const p=props.find(x=>x.id===id);if(!p)return;const res=await sb("watchlist",{method:"POST",body:JSON.stringify({property_id:p.id,price_at_watch:p.list_price,current_price:p.list_price,watch_reason:"Dashboard",status:"Watching"})});if(Array.isArray(res)&&res[0])watchMap[id]=res[0].id;watchIds.add(id);const btn=document.getElementById("watchBtn_"+id);if(btn){btn.textContent="★ Watching";btn.style.background="rgba(212,175,55,0.15)";btn.style.color="#d4af37";btn.setAttribute("onclick","unwatchProp('"+id+"')");}const t=document.getElementById("alertToast");t.innerHTML=`<div style="margin:8px 20px;padding:10px 14px;border-radius:10px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);font-size:12px;color:#d4af37;font-weight:600;animation:fadeUp .3s ease">Added to watchlist</div>`;setTimeout(()=>{t.innerHTML="";},2000);}
async function unwatchProp(id){const w=watchMap[id];if(w){await fetch(`${SB}/rest/v1/watchlist?id=eq.${w}`,{method:"DELETE",headers:HD});watchIds.delete(id);delete watchMap[id];const btn=document.getElementById("watchBtn_"+id);if(btn){btn.textContent="☆ Add to Watchlist";btn.style.background="rgba(212,175,55,0.9)";btn.style.color="#0a0a0a";btn.setAttribute("onclick","watchProp('"+id+"')");}const t=document.getElementById("alertToast");t.innerHTML=`<div style="margin:8px 20px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:12px;color:#94a3b8;font-weight:600;animation:fadeUp .3s ease">Removed from watchlist</div>`;setTimeout(()=>{t.innerHTML="";},2000);}}
async function saveNote(id){const input=document.getElementById("noteInput");const n=input.value.trim();if(!n)return;const p=props.find(x=>x.id===id);if(!p)return;const btn=event.target;btn.textContent="Saving...";btn.disabled=true;const ts=new Date().toLocaleDateString();const entry=ts+": "+n;const ex=p.notes?p.notes+"\n"+entry:entry;await fetch(`${SB}/rest/v1/properties?id=eq.${id}`,{method:"PATCH",headers:HD,body:JSON.stringify({notes:ex})});p.notes=ex;input.value="";btn.textContent="✓ Saved";setTimeout(()=>{btn.textContent="Save";btn.disabled=false;},800);const nc=document.getElementById("notesContainer");if(nc)nc.innerHTML=renderNotes(id,ex);}
async function deleteNote(id,idx){const p=props.find(x=>x.id===id);if(!p||!p.notes)return;const lines=p.notes.split("\n").filter(l=>l.trim());lines.splice(idx,1);const updated=lines.join("\n")||null;await fetch(`${SB}/rest/v1/properties?id=eq.${id}`,{method:"PATCH",headers:HD,body:JSON.stringify({notes:updated})});p.notes=updated;const nc=document.getElementById("notesContainer");if(nc)nc.innerHTML=renderNotes(id,updated);}
function renderNotes(id,notes){if(!notes)return"";const lines=notes.split("\n").filter(l=>l.trim());return lines.map((l,i)=>`<div style="display:flex;align-items:start;gap:8px;padding:8px 10px;margin-bottom:4px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)"><div style="flex:1;font-size:12px;color:#94a3b8;line-height:1.5">${esc(l)}</div><button onclick="deleteNote('${id}',${i})" style="flex-shrink:0;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:6px;color:#ef4444;font-size:11px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button></div>`).join("");}
function copyLisa(id){const p=props.find(x=>x.id===id);if(!p)return;const zUrl=`https://www.zillow.com/homes/${encodeURIComponent(p.address+' '+p.city+' NV '+p.zip_code)}_rb/`;const t=`Check this out:\n${p.address}, ${p.city} NV ${p.zip_code}\n${$(p.list_price)} · ${p.bedrooms}bd/${p.bathrooms}ba · ${p.sqft?.toLocaleString()}sf\nBuilt ${p.year_built} · ${p.pool?"Pool":"No Pool"}\nMLS# ${p.mls_number} · Score: ${p.sovereign_score}\n\n${zUrl}`;const smsUrl=`sms:?&body=${encodeURIComponent(t)}`;if(/iPhone|iPad|Android/i.test(navigator.userAgent)){window.location.href=smsUrl;}else if(navigator.share){navigator.share({text:t}).catch(()=>{});}else{const ta=document.createElement("textarea");ta.value=t;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);alert("Copied!");}}

// ═══ PASS / DISPOSITION ═══
function showPassModal(propId){
  const d=document.createElement("div");d.className="pass-overlay";d.id="passOverlay";
  d.onclick=function(e){if(e.target===this)this.remove();};
  d.innerHTML=`<div class="pass-sheet">
    <div style="font-size:14px;font-weight:800;color:#e2e8f0;margin-bottom:12px">Pass on this property</div>
    <div class="fld"><label>REASON</label><select id="passReason" class="cinput" style="font-size:13px;min-height:36px">
      <option value="">Select reason...</option>
      <option value="visited_passed">Visited & Passed</option>
      <option value="price_too_high">Price Too High</option>
      <option value="condition_worse">Condition Worse Than Photos</option>
      <option value="layout_doesnt_work">Layout Doesn't Work</option>
      <option value="neighborhood_issue">Neighborhood Issue</option>
      <option value="already_sold">Already Sold / Under Contract</option>
      <option value="other">Other</option>
    </select></div>
    <div class="fld"><label>QUICK NOTE (optional)</label><input id="passNote" type="text" class="cinput" placeholder="e.g. Backyard too small" style="font-size:13px;min-height:36px"/></div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('passOverlay').remove()" class="btn" style="flex:1;padding:10px;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8">Cancel</button>
      <button onclick="confirmPass('${propId}')" class="btn" style="flex:1;padding:10px;font-size:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);color:#ef4444">Confirm Pass</button>
    </div>
  </div>`;
  document.body.appendChild(d);
}

async function confirmPass(propId){
  const reason=document.getElementById("passReason").value;
  if(!reason){document.getElementById("passReason").style.borderColor="#ef4444";return;}
  const note=document.getElementById("passNote")?.value?.trim()||"";
  const btn=event.target;btn.textContent="Saving...";btn.disabled=true;
  const body={disposition:"passed",disposition_reason:reason,disposition_date:new Date().toISOString().split("T")[0],disposition_by:SH_USER?.email||"unknown"};
  if(note){const p=props.find(x=>x.id===propId);const ts=new Date().toLocaleDateString();const entry=ts+": [PASSED] "+note;body.notes=p?.notes?p.notes+"\n"+entry:entry;}
  await fetch(`${SB}/rest/v1/properties?id=eq.${propId}`,{method:"PATCH",headers:HD,body:JSON.stringify(body)});
  const p=props.find(x=>x.id===propId);if(p){p.disposition="passed";p.disposition_reason=reason;if(body.notes)p.notes=body.notes;}
  document.getElementById("passOverlay")?.remove();
  closeDetail();
  const t=document.createElement("div");t.textContent="Property passed";t.style.cssText="position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#ef4444;color:#fff;padding:10px 20px;border-radius:10px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4)";document.body.appendChild(t);setTimeout(()=>t.remove(),2000);
  renderDashboard();
}

async function undoPass(propId){
  await fetch(`${SB}/rest/v1/properties?id=eq.${propId}`,{method:"PATCH",headers:HD,body:JSON.stringify({disposition:null,disposition_reason:null,disposition_date:null,disposition_by:null})});
  const p=props.find(x=>x.id===propId);if(p){p.disposition=null;p.disposition_reason=null;}
  closeDetail();
  const t=document.createElement("div");t.textContent="Pass removed";t.style.cssText="position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:10px 20px;border-radius:10px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4)";document.body.appendChild(t);setTimeout(()=>t.remove(),2000);
  renderDashboard();
}
