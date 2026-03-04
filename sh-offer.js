// Sovereign House Intelligence — Offer Builder (from Detail)
let offerParams=null;

function closeOffer(){document.getElementById("offerModal").style.display="none";offerParams=null;if(document.getElementById("detailModal").style.display==="block"){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}}

async function openOffer(id){
  const p=props.find(x=>x.id===id);if(!p)return;
  const ai=analysisMap[id]||{};

  // ── FETCH LAST SAVED CALC RUN (source of truth) ──
  let calcRun=null;
  try{
    const ch=await sb(`calc_history?property_id=eq.${id}&order=created_at.desc&limit=1`);
    if(Array.isArray(ch)&&ch.length>0) calcRun=ch[0];
  }catch(e){console.warn("No calc history:",e);}
  // Also try by MLS number if property_id didn't match
  if(!calcRun&&p.mls_number){
    try{
      const ch2=await sb(`calc_history?mls_number=eq.${p.mls_number}&order=created_at.desc&limit=1`);
      if(Array.isArray(ch2)&&ch2.length>0) calcRun=ch2[0];
    }catch(e){}
  }

  const hasCalc=!!calcRun;
  const src=hasCalc?'calc':'ai';

  // ── BUILD OFFER PARAMS (same fields as calculator) ──
  // If calc was saved, use those exact values. Otherwise fall back to AI analysis.
  offerParams={
    arv:         hasCalc? calcRun.arv          : (ai.arv_target||ai.arv||0),
    reno:        hasCalc? (calcRun.rehab_budget||0)+(calcRun.additional_costs||0) : (ai.reno_total||0),
    rehab:       hasCalc? (calcRun.rehab_budget||0) : (ai.reno_total||0),
    addl:        hasCalc? (calcRun.additional_costs||0) : 0,
    ltv:         hasCalc? (calcRun.ltv||90)     : 90,
    rate:        hasCalc? (calcRun.interest_rate||11.49) : 11.49,
    pts:         hasCalc? (calcRun.points||0)   : 0,
    orig:        hasCalc? (calcRun.origination||1.5) : 1.5,
    closeBuy:    hasCalc? (calcRun.closing_buy_flat||5000) : 5000,
    drawPct:     hasCalc? (calcRun.reno_draw_pct||100) : 100,
    svcfee:      hasCalc? (calcRun.service_fee||1499) : 1499,
    holdMo:      hasCalc? (calcRun.hold_months||8) : 8,
    taxAnn:      hasCalc? (calcRun.tax_annual||Math.round(p.list_price*0.007)) : (ai.tax_annual||Math.round(p.list_price*0.007)),
    ins:         hasCalc? (calcRun.insurance_monthly||250) : Math.round(((p.list_price||0)+(ai.reno_total||0))*0.0035/12),
    hoa:         hasCalc? (calcRun.hoa_monthly||450) : (ai.hoa_monthly||p.hoa_monthly||450),
    util:        hasCalc? (calcRun.utilities_monthly||650) : 650,
    bagent:      hasCalc? (calcRun.buyer_agent_pct||2.5) : 2.5,
    closeSell:   hasCalc? (calcRun.closing_sell_flat||3500) : 3500,
    staging:     hasCalc? (calcRun.staging||5000) : 5000,
    title:       hasCalc? (calcRun.title_insurance||3000) : 3000,
    hoaxfer:     hasCalc? (calcRun.hoa_transfer||500) : 500,
    misc:        hasCalc? (calcRun.misc_buffer||1500) : 1500,
    lisaPct:     hasCalc? (calcRun.lisa_commission_pct??2.5) : 2.5,
    consArv:     ai.arv_conservative||Math.round((hasCalc?calcRun.arv:(ai.arv_target||0))*0.95),
    strArv:      ai.arv_stretch||Math.round((hasCalc?calcRun.arv:(ai.arv_target||0))*1.05),
    src: src
  };

  const offerPrice=ai.max_offer_price||ai.max_offer_raw||p.list_price||0;
  const emd=Math.round(offerPrice*0.01);
  const lisaPct=offerParams.lisaPct;

  const m=document.getElementById("offerModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeOffer()">✕</button>
    <div style="margin-bottom:16px;padding-right:40px">
      <div style="font-size:10px;color:#22c55e;font-weight:800;letter-spacing:3px">MAKE OFFER</div>
      <div style="font-size:17px;font-weight:800;margin-top:2px">${esc(p.address)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:1px">${(p.subdivision_name&&truncSub(p.subdivision_name))?esc(truncSub(p.subdivision_name))+' · ':''}${p.city}, NV ${p.zip_code} · MLS# ${p.mls_number}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">List: <span style="color:#e2e8f0;font-weight:700">${$(p.list_price)}</span> · ${p.bedrooms}/${p.bathrooms} · ${p.sqft?.toLocaleString()}sf</div>
      <div style="font-size:9px;margin-top:4px;padding:3px 8px;border-radius:6px;display:inline-block;${hasCalc?'background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.15)':'background:rgba(249,115,22,0.08);color:#f97316;border:1px solid rgba(249,115,22,0.15)'};font-weight:700">${hasCalc?'✓ Using saved calculator data':'⚠ Using AI defaults — save a calculator run for exact numbers'}</div>
      ${(()=>{const ed=deals.find(x=>x.property_id===id&&!DEAD_STATUSES.includes(x.status));return ed?`<div style="margin-top:8px;padding:10px 14px;border-radius:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:#22c55e;font-weight:700">Active deal exists (${(DEAL_STAGES[ed.status]||{}).label||ed.status})</span><button onclick="closeOffer();document.getElementById('detailModal').style.display='none';openDeal('${ed.id}')" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.12);color:#22c55e;font-size:11px;font-weight:700;cursor:pointer">Open Deal →</button></div>`:''})()}
    </div>

    <!-- LIVE PROFIT DISPLAY -->
    <div id="offerProfitBar" style="padding:14px;border-radius:14px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">OFFER</div><div id="ofr_price" style="font-size:18px;font-weight:800;color:#e2e8f0;margin-top:2px">${$(offerPrice)}</div><div id="ofr_disc" style="font-size:10px;color:#22c55e;font-weight:600"></div></div>
        <div><div style="font-size:8px;color:#d4af37;font-weight:700;letter-spacing:1px">EST. PROFIT</div><div id="ofr_profit" style="font-size:18px;font-weight:800;color:#22c55e;margin-top:2px">—</div><div id="ofr_roi" style="font-size:10px;color:#94a3b8;font-weight:600"></div></div>
        <div><div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">TARGET ARV</div><div style="font-size:18px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(offerParams.arv)}</div><div style="font-size:10px;color:#64748b;font-weight:600">${p.sqft?'$'+Math.round(offerParams.arv/p.sqft)+'/sf':''}</div></div>
      </div>
    </div>

    <!-- OFFER TERMS -->
    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">OFFER TERMS</div>
    <div class="row2">
      <div class="fld"><label>OFFER PRICE</label><input id="o_price" type="number" class="cinput" value="${offerPrice}" oninput="updateOfferCalc('${id}')"/></div>
      <div class="fld"><label>EARNEST MONEY (EMD)</label><input id="o_emd" type="number" class="cinput" value="${emd}"/><div class="sub">~1% of offer price</div></div>
    </div>
    <div class="row2">
      <div class="fld"><label>CLOSE OF ESCROW (days)</label><input id="o_coe" type="number" class="cinput" value="30"/></div>
      <div class="fld"><label>INSPECTION PERIOD (days)</label><input id="o_inspect" type="number" class="cinput" value="10"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>FINANCING CONTINGENCY (days)</label><input id="o_finance" type="number" class="cinput" value="21"/></div>
      <div class="fld"><label>POSSESSION</label>
        <select id="o_possession" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:16px;font-weight:700;min-height:44px">
          <option value="close_of_escrow">Close of Escrow</option>
          <option value="seller_rentback">Seller Rent-Back (flexible)</option>
        </select>
      </div>
    </div>

    <!-- LISA COMMISSION ON THIS DEAL -->
    <div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <label style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:1px">LISA BUY-SIDE COMMISSION</label>
        <span id="ofrLisaLabel" style="font-size:14px;font-weight:800;color:#d4af37">${lisaPct}%</span>
      </div>
      <input id="o_lisacomm" type="range" min="0" max="3" step="0.5" value="${lisaPct}" oninput="document.getElementById('ofrLisaLabel').textContent=this.value+'%';updateOfferCalc('${id}')" style="width:100%;accent-color:#d4af37"/>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#475569;margin-top:4px"><span>0% (negotiated out)</span><span>2.5% default</span><span>3%</span></div>
      <div id="ofrLisaAmt" style="text-align:center;font-size:12px;color:#22c55e;font-weight:700;margin-top:4px"></div>
    </div>

    <!-- SPECIAL TERMS -->
    <div class="fld"><label>SPECIAL TERMS / NOTES</label>
      <textarea id="o_terms" rows="3" class="cinput" style="font-size:14px;font-weight:500;min-height:80px" placeholder="As-is with right to inspect, flexible possession, strong EMD...">${ai.verdict==="GO"?"As-is with right to inspect. Clean financing. Flexible on possession/rent-back if needed.":""}</textarea>
    </div>

    <!-- LISTING AGENT -->
    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:16px 0 10px">LISTING AGENT</div>
    <div class="row2">
      <div class="fld"><label>AGENT NAME</label><input id="o_agentname" type="text" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_name||'')}"/></div>
      <div class="fld"><label>EMAIL</label><input id="o_agentemail" type="email" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_email||'')}"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>PHONE</label><input id="o_agentphone" type="tel" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_phone||'')}"/></div>
      <div class="fld"><label>BROKERAGE</label><input id="o_agentbrokerage" type="text" class="cinput" style="font-weight:500" value="${esc(p.listing_office||'')}"/></div>
    </div>

    <!-- UNDERWRITING SNAPSHOT -->
    <div style="margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:2px;margin-bottom:8px">UNDERWRITING SNAPSHOT</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div><div style="font-size:8px;color:#64748b;font-weight:700">RENO BUDGET</div><div style="font-size:15px;font-weight:800;color:#f59e0b;margin-top:2px">${$k(offerParams.reno)}</div></div>
        <div><div style="font-size:8px;color:#64748b;font-weight:700">CONSERVATIVE</div><div style="font-size:15px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(offerParams.consArv)}</div></div>
        <div><div style="font-size:8px;color:#64748b;font-weight:700">STRETCH</div><div style="font-size:15px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(offerParams.strArv)}</div></div>
      </div>
    </div>

    <!-- ACTION BUTTONS -->
    <button onclick="generateOfferPackage('${p.id}')" class="btn" style="width:100%;margin-top:16px;padding:14px;font-size:14px;background:rgba(34,197,94,0.9);color:#0a0a0a">📝 Generate Offer Package</button>
    <div id="offerOutput_${p.id}" style="margin-top:12px"></div>
  </div>`;

  m.style.display="block";document.body.style.overflow="hidden";
  updateOfferCalc(id);
}

function updateOfferCalc(id){
  // ── IDENTICAL MATH TO CALCULATOR (updateCalc) ──
  const p=props.find(x=>x.id===id);if(!p||!offerParams)return;
  const oPrice=Number(document.getElementById("o_price")?.value)||0;
  const lisaPct=parseFloat(document.getElementById("o_lisacomm")?.value||offerParams.lisaPct);
  const lisaAmt=Math.round(oPrice*(lisaPct/100));
  const q=offerParams;

  // These mirror the calculator exactly:
  const totalReno=q.reno;
  const loanAmt=Math.round(oPrice*(q.ltv/100));
  const renoFinanced=Math.round(totalReno*(q.drawPct/100));
  const totalLoan=loanAmt+renoFinanced;
  const loanPts=Math.round(totalLoan*(q.pts/100));
  const loanOrig=Math.round(totalLoan*(q.orig/100));
  const totalLoanFees=loanPts+loanOrig+q.closeBuy+q.svcfee;

  const monthlyInterest=Math.round(totalLoan*(q.rate/100)/12);
  const monthlyTax=Math.round(q.taxAnn/12);
  const monthlyTotal=monthlyInterest+monthlyTax+q.ins+q.hoa+q.util;
  const totalHold=monthlyTotal*q.holdMo;

  const arv=q.arv;
  const buyerComm=Math.round(arv*(q.bagent/100));
  const rptt=arv>0?Math.ceil(arv/500)*2.55:0;
  const totalSell=buyerComm+q.closeSell+q.staging+q.title+q.hoaxfer+q.misc+rptt;

  const totalCost=oPrice+totalReno+totalLoanFees+totalHold+totalSell-lisaAmt;
  const profit=arv-totalCost;
  const roi=totalCost>0?(profit/totalCost*100):0;
  const disc=p.list_price>0?((p.list_price-oPrice)/p.list_price*100).toFixed(1):0;

  // Store computed values for generateOfferPackage
  offerParams._lastProfit=profit;
  offerParams._lastRoi=roi;
  offerParams._lastTotalCost=totalCost;

  const el=x=>document.getElementById(x);
  const pp=el("ofr_price");if(pp)pp.textContent=$(oPrice);
  const pd=el("ofr_disc");if(pd){pd.textContent=oPrice<p.list_price?disc+'% below ask':(oPrice>p.list_price?Math.abs(disc)+'% above':'At list');pd.style.color=oPrice<=p.list_price?"#22c55e":"#ef4444";}
  const pr=el("ofr_profit");if(pr){pr.textContent=$k(profit);pr.style.color=profit>=150000?"#22c55e":profit>=75000?"#f59e0b":"#ef4444";}
  const ro=el("ofr_roi");if(ro)ro.textContent=roi.toFixed(1)+'% ROI';
  const la=el("ofrLisaAmt");if(la)la.textContent=lisaPct>0?$(lisaAmt)+' income credit':'No commission this deal';
}

async function generateOfferPackage(id){
  const p=props.find(x=>x.id===id);if(!p)return;
  const ai=analysisMap[id]||{};
  const oPrice=Number(document.getElementById("o_price")?.value)||0;
  const emd=Number(document.getElementById("o_emd")?.value)||0;
  const coe=Number(document.getElementById("o_coe")?.value)||30;
  const inspect=Number(document.getElementById("o_inspect")?.value)||10;
  const finance=Number(document.getElementById("o_finance")?.value)||21;
  const possession=document.getElementById("o_possession")?.value||"close_of_escrow";
  const lisaPct=parseFloat(document.getElementById("o_lisacomm")?.value||2.5);
  const terms=document.getElementById("o_terms")?.value||"";
  const agentName=document.getElementById("o_agentname")?.value||"";
  const agentEmail=document.getElementById("o_agentemail")?.value||"";
  const agentPhone=document.getElementById("o_agentphone")?.value||"";
  const agentBrokerage=document.getElementById("o_agentbrokerage")?.value||"";

  const disc=p.list_price>0?((p.list_price-oPrice)/p.list_price*100).toFixed(1):0;
  // Use offerParams (synced with calculator), not raw AI values
  const tgtArv=offerParams?offerParams.arv:(ai.arv_target||ai.arv||0);
  const reno=offerParams?offerParams.reno:(ai.reno_total||0);
  const projProfit=offerParams?Math.round(offerParams._lastProfit||0):(ai.profit_target||0);
  const projRoi=offerParams?(offerParams._lastRoi||0).toFixed(1):(ai.roi_target?ai.roi_target.toFixed(1):'0');

  // Save deal to Supabase
  const dealPayload={
    property_id:p.id,
    mls_number:p.mls_number,
    address:p.address,
    community:truncSub(p.subdivision_name)||null,
    zip_code:p.zip_code,
    sqft:p.sqft,
    beds:p.bedrooms,
    baths:p.bathrooms,
    list_price:p.list_price,
    status:'offer_drafted',
    offer_price:oPrice,
    emd_amount:emd,
    emd_percent:p.list_price>0?parseFloat((emd/oPrice*100).toFixed(2)):1,
    close_of_escrow_days:coe,
    inspection_days:inspect,
    financing_contingency_days:finance,
    possession:possession,
    special_terms:terms||null,
    lisa_buy_commission_pct:lisaPct,
    lisa_buy_commission_amt:Math.round(oPrice*(lisaPct/100)),
    buyer_agent_commission_pct:offerParams?offerParams.bagent:2.5,
    reno_budget:reno,
    target_arv:tgtArv,
    conservative_arv:offerParams?offerParams.consArv:(ai.arv_conservative||Math.round(tgtArv*0.95)),
    stretch_arv:offerParams?offerParams.strArv:(ai.arv_stretch||Math.round(tgtArv*1.05)),
    projected_profit_target:projProfit,
    projected_profit_conservative:ai.profit_conservative||0,
    projected_profit_stretch:ai.profit_stretch||0,
    projected_roi_target:parseFloat(projRoi)||0,
    listing_agent_name:agentName||null,
    listing_agent_email:agentEmail||null,
    listing_agent_phone:agentPhone||null,
    listing_agent_brokerage:agentBrokerage||null,
    analysis_id:ai.id||null,
    original_offer_price:oPrice,
    counter_count:0,
    concessions:[],
    timeline:[{date:new Date().toISOString(),type:'offer_submitted',from:'buyer',summary:`Offer drafted: ${$(oPrice)} · Lisa ${lisaPct}% · EMD ${$(emd)}`,price:oPrice,commission_pct:lisaPct}]
  };

  // Duplicate prevention: check for existing active deal on this property
  const existingDeal=deals.find(x=>x.property_id===p.id&&!DEAD_STATUSES.includes(x.status));
  if(existingDeal){
    if(!confirm(`An active deal already exists for this property (${(DEAL_STAGES[existingDeal.status]||{}).label||existingDeal.status}).\n\nOK = Open existing deal\nCancel = Create new offer anyway`)){
      // User wants new offer, continue
    } else {
      // User wants existing deal — navigate to it
      closeOffer();document.getElementById('detailModal').style.display='none';openDeal(existingDeal.id);
      return;
    }
  }

  const output=document.getElementById("offerOutput_"+id);
  output.innerHTML=`<div style="text-align:center;padding:16px"><div style="width:28px;height:28px;border:3px solid rgba(34,197,94,0.2);border-top-color:#22c55e;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div><div style="color:#22c55e;font-size:12px;font-weight:700;margin-top:8px">Saving deal...</div></div>`;

  let dealId=null;
  try{
    const resp=await fetch(`${SB}/rest/v1/deals`,{method:"POST",headers:{...HD,Prefer:"return=representation"},body:JSON.stringify(dealPayload)});
    if(resp.ok){const data=await resp.json();dealId=data[0]?.id||null;
      // Reload deals for pipeline tab
      try{const dd=await sb("deals?order=updated_at.desc");deals=Array.isArray(dd)?dd:[];renderDashboard();}catch(e){}
    }
    else{const err=await resp.text();console.error("Deal save failed:",err);}
  }catch(e){console.error("Deal save error:",e);}

  // Generate offer summary + email
  const possText=possession==="seller_rentback"?"Seller rent-back (flexible terms)":"Close of escrow";
  const summary=`SOVEREIGN HOUSE — OFFER SUMMARY

PROPERTY: ${p.address}, ${p.city} NV ${p.zip_code}
MLS#: ${p.mls_number}
LIST PRICE: ${$(p.list_price)}

OFFER TERMS:
  Offer Price: ${$(oPrice)} (${disc}% below ask)
  Earnest Money: ${$(emd)}
  Close of Escrow: ${coe} days
  Inspection Period: ${inspect} days
  Financing Contingency: ${finance} days
  Possession: ${possText}
  Lisa Buy Commission: ${lisaPct}% (${$(Math.round(oPrice*(lisaPct/100)))})
${terms?`  Special Terms: ${terms}`:''}

LISTING AGENT: ${agentName}${agentBrokerage?' / '+agentBrokerage:''}
${agentPhone?'Phone: '+agentPhone:''}
${agentEmail?'Email: '+agentEmail:''}

UNDERWRITING:
  Target ARV: ${$(tgtArv)}
  Reno Budget: ${$(reno)}
  Projected Profit (${offerParams?offerParams.holdMo:8}mo): ${$(projProfit)}
  Projected ROI: ${projRoi}%`;

  const emailSubject=`Purchase Offer — ${p.address}, Las Vegas NV ${p.zip_code}`;
  const emailBody=`Hi ${agentName||'there'},

I hope this message finds you well. My client is interested in submitting an offer on ${p.address}, MLS# ${p.mls_number}.

Offer Price: ${$(oPrice)}
Earnest Money Deposit: ${$(emd)}
Close of Escrow: ${coe} days from acceptance
Inspection Period: ${inspect} days
Financing: Kiavi bridge loan — pre-qualified, ${finance}-day contingency
Possession: ${possText}
${terms?'Additional Terms: '+terms:''}

My client is a serious buyer with financing in place and can close quickly. We are happy to accommodate any reasonable seller requests on timeline or possession.

Please let me know if you have any questions or if the seller would like to counter.

Best regards,
Lisa
Sovereign House
Licensed Nevada Realtor`;

  const gmailUrl=agentEmail?`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(agentEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`:'';
  const outlookUrl=agentEmail?`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(agentEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`:'';

  output.innerHTML=`
    <div style="padding:16px;border-radius:14px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);animation:fadeUp .3s ease">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:10px;color:#22c55e;font-weight:800;letter-spacing:3px">✅ OFFER PACKAGE READY</div>
        ${dealId?`<span style="font-size:9px;color:#64748b">Deal saved</span>`:`<span style="font-size:9px;color:#f59e0b">⚠️ Deal save pending</span>`}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${dealId?`<button onclick="closeOffer();document.getElementById('detailModal').style.display='none';openDeal('${dealId}')" class="btn" style="width:100%;padding:14px;font-size:14px;background:rgba(34,197,94,0.9);color:#0a0a0a;font-weight:800">🤝 View Deal →</button>`:''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="navigator.clipboard.writeText(\`${summary.replace(/`/g,"'").replace(/\\/g,"\\\\")}\`).then(()=>{this.textContent='✓ Copied!';this.style.color='#22c55e';setTimeout(()=>{this.textContent='📋 Copy Summary';this.style.color='#f1f5f9'},2000)})" class="btn" style="padding:12px;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#f1f5f9">📋 Copy Summary</button>
          ${agentEmail?`<a href="${gmailUrl}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#60a5fa;font-size:12px;font-weight:700;text-decoration:none">✉️ Email Agent</a>`:`<button disabled class="btn" style="padding:12px;font-size:12px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:#475569">✉️ No Email</button>`}
        </div>

        <button onclick="openRPABuilder('${p.id}')" class="btn" style="width:100%;padding:12px;font-size:13px;background:linear-gradient(135deg,rgba(224,201,127,0.12),rgba(212,175,55,0.06));border:1px solid rgba(224,201,127,0.25);color:#e0c97f;font-weight:800">📄 Generate GLVAR RPA</button>
      </div>

      <div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(0,0,0,0.2);font-size:10px;color:#64748b;line-height:1.7">
        Next: Generate RPA → Lisa signs → Send to listing agent
      </div>
    </div>`;
}
