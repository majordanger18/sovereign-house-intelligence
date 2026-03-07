// Sovereign House Intelligence — Offer Builder (from Calculator)
async function saveAndOffer(){
  if(!calcProp)return;
  // 1) Save the calc first
  await doSaveCalc();
  // 2) Build offerParams directly from current calc inputs (no DB round-trip)
  const p=calcProp;
  const arv=gv("c_arv"),pur=gv("c_pur"),rehab=gv("c_rehab"),addl=gv("c_addl");
  const ltv=gv("c_ltv"),rate=gv("c_rate"),pts=gv("c_pts"),orig=gv("c_orig"),closeBuy=gv("c_closebuy"),drawPct=gv("c_drawpct"),svcfee=gv("c_svcfee");
  const holdMo=gv("c_hold"),taxAnn=gv("c_tax"),ins=gv("c_ins"),hoa=gv("c_hoa"),util=gv("c_util");
  const bagent=gv("c_bagent"),closeSell=gv("c_closesell"),staging=gv("c_staging"),title=gv("c_title"),hoaxfer=gv("c_hoaxfer"),misc=gv("c_misc");
  const lisaPct=parseFloat(document.getElementById("c_lisacomm")?.value||2.5);

  offerParams={
    arv: arv,
    reno: rehab+addl,
    rehab: rehab,
    addl: addl,
    ltv: ltv,
    rate: rate,
    pts: pts,
    orig: orig,
    closeBuy: closeBuy,
    drawPct: drawPct,
    svcfee: svcfee,
    holdMo: holdMo,
    taxAnn: taxAnn,
    ins: ins,
    hoa: hoa,
    util: util,
    bagent: bagent,
    closeSell: closeSell,
    staging: staging,
    title: title,
    hoaxfer: hoaxfer,
    misc: misc,
    lisaPct: lisaPct,
    consArv: Math.round(arv*0.95),
    strArv: Math.round(arv*1.05),
    src: 'calc'
  };

  // 3) Close calc, open offer with params already loaded
  document.getElementById("calcModal").style.display="none";
  const ai=analysisMap[p.id]||{};
  const offerPrice=pur; // Use the purchase price from calculator as the offer price
  const emd=Math.round(offerPrice*0.01);

  const m=document.getElementById("offerModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeOffer()">✕</button>
    <div style="margin-bottom:16px;padding-right:40px">
      <div style="font-size:10px;color:#22c55e;font-weight:800;letter-spacing:3px">MAKE OFFER</div>
      <div style="font-size:17px;font-weight:800;margin-top:2px">${esc(p.address)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:1px">${(p.subdivision_name&&truncSub(p.subdivision_name))?esc(truncSub(p.subdivision_name))+' · ':''}${p.city}, NV ${p.zip_code} · MLS# ${p.mls_number}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">List: <span style="color:#e2e8f0;font-weight:700">${$(p.list_price)}</span> · ${p.bedrooms}/${p.bathrooms} · ${p.sqft?.toLocaleString()}sf</div>
      <div style="font-size:9px;margin-top:4px;padding:3px 8px;border-radius:6px;display:inline-block;background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.15);font-weight:700">✓ Using saved calculator data</div>
    </div>

    <div id="offerProfitBar" style="padding:14px;border-radius:14px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">OFFER</div><div id="ofr_price" style="font-size:18px;font-weight:800;color:#e2e8f0;margin-top:2px">${$(offerPrice)}</div><div id="ofr_disc" style="font-size:10px;color:#22c55e;font-weight:600"></div></div>
        <div><div style="font-size:8px;color:#d4af37;font-weight:700;letter-spacing:1px">EST. PROFIT</div><div id="ofr_profit" style="font-size:18px;font-weight:800;color:#22c55e;margin-top:2px">—</div><div id="ofr_roi" style="font-size:10px;color:#94a3b8;font-weight:600"></div></div>
        <div><div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">TARGET ARV</div><div style="font-size:18px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(arv)}</div><div style="font-size:10px;color:#64748b;font-weight:600">${p.sqft?'$'+Math.round(arv/p.sqft)+'/sf':''}</div></div>
      </div>
    </div>

    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">OFFER TERMS</div>
    <div class="row2">
      <div class="fld"><label>OFFER PRICE</label><input id="o_price" type="number" class="cinput" value="${offerPrice}" oninput="updateOfferCalc('${p.id}')"/></div>
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

    <div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <label style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:1px">LISA BUY-SIDE COMMISSION</label>
        <span id="ofrLisaLabel" style="font-size:14px;font-weight:800;color:#d4af37">${lisaPct}%</span>
      </div>
      <input id="o_lisacomm" type="range" min="0" max="3" step="0.5" value="${lisaPct}" oninput="document.getElementById('ofrLisaLabel').textContent=this.value+'%';updateOfferCalc('${p.id}')" style="width:100%;accent-color:#d4af37"/>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#475569;margin-top:4px"><span>0% (negotiated out)</span><span>2.5% default</span><span>3%</span></div>
      <div id="ofrLisaAmt" style="text-align:center;font-size:12px;color:#22c55e;font-weight:700;margin-top:4px"></div>
    </div>

    <div class="fld"><label>SPECIAL TERMS / NOTES</label>
      <textarea id="o_terms" rows="3" class="cinput" style="font-size:14px;font-weight:500;min-height:80px" placeholder="As-is with right to inspect, flexible possession, strong EMD...">As-is with right to inspect. Clean financing. Flexible on possession/rent-back if needed.</textarea>
    </div>

    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:16px 0 10px">LISTING AGENT</div>
    <div class="row2">
      <div class="fld"><label>AGENT NAME</label><input id="o_agentname" type="text" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_name||'')}"/></div>
      <div class="fld"><label>EMAIL</label><input id="o_agentemail" type="email" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_email||'')}"/></div>
    </div>
    <div class="row2">
      <div class="fld"><label>PHONE</label><input id="o_agentphone" type="tel" class="cinput" style="font-weight:500" value="${esc(p.listing_agent_phone||'')}"/></div>
      <div class="fld"><label>BROKERAGE</label><input id="o_agentbrokerage" type="text" class="cinput" style="font-weight:500" value="${esc(p.listing_office||'')}"/></div>
    </div>

    <div style="margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:2px;margin-bottom:8px">UNDERWRITING SNAPSHOT</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div><div style="font-size:8px;color:#64748b;font-weight:700">RENO BUDGET</div><div style="font-size:15px;font-weight:800;color:#f59e0b;margin-top:2px">${$k(rehab+addl)}</div></div>
        <div><div style="font-size:8px;color:#64748b;font-weight:700">CONSERVATIVE</div><div style="font-size:15px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(Math.round(arv*0.95))}</div></div>
        <div><div style="font-size:8px;color:#64748b;font-weight:700">STRETCH</div><div style="font-size:15px;font-weight:800;color:#94a3b8;margin-top:2px">${$k(Math.round(arv*1.05))}</div></div>
      </div>
    </div>

    <button onclick="generateOfferPackage('${p.id}')" class="btn" style="width:100%;margin-top:16px;padding:14px;font-size:14px;background:rgba(34,197,94,0.9);color:#0a0a0a">📝 Generate Offer Package</button>
    <div id="offerOutput_${p.id}" style="margin-top:12px"></div>
  </div>`;

  m.style.display="block";document.body.style.overflow="hidden";
  updateOfferCalc(p.id);
}

function exportPDF(){
  if(!calcProp)return;
  const p=calcProp;
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"pt",format:"letter"});
  const W=612,M=40;
  let y=40;
  const fmt=n=>n!=null?'$'+Number(n).toLocaleString():'—';

  const arv=gv("c_arv"),pur=gv("c_pur"),rehab=gv("c_rehab"),addl=gv("c_addl");
  const ltv=gv("c_ltv"),rate=gv("c_rate"),pts=gv("c_pts"),orig=gv("c_orig"),closeBuyFlat=gv("c_closebuy"),drawPct=gv("c_drawpct");
  const holdMo=gv("c_hold"),taxAnn=gv("c_tax"),ins=gv("c_ins"),hoa=gv("c_hoa"),util=gv("c_util");
  const bagent=gv("c_bagent"),closeSellFlat=gv("c_closesell"),stg=gv("c_staging"),ttl=gv("c_title"),hxf=gv("c_hoaxfer"),msc=gv("c_misc"),svcfeePdf=gv("c_svcfee");
  const totalReno=rehab+addl;
  const loanAmt=Math.round(pur*(ltv/100)),renoFin=Math.round(totalReno*(drawPct/100)),totalLoan=loanAmt+renoFin;
  const loanPts=Math.round(totalLoan*(pts/100)),loanOrig=Math.round(totalLoan*(orig/100)),buyClose=closeBuyFlat;
  const totalLoanFees=loanPts+loanOrig+buyClose+svcfeePdf;
  const monthlyInt=Math.round(totalLoan*(rate/100)/12),monthlyTax=Math.round(taxAnn/12);
  const monthlyTotal=monthlyInt+monthlyTax+ins+hoa+util;
  const totalHold=monthlyTotal*holdMo;
  const buyerComm=Math.round(arv*(bagent/100)),sellClose=closeSellFlat;
  const rpttPdf=arv>0?Math.ceil(arv/500)*2.55:0;
  const totalSell=buyerComm+sellClose+stg+ttl+hxf+msc+rpttPdf;
  const totalCost=pur+totalReno+totalLoanFees+totalHold+totalSell;
  const profit=arv-totalCost;
  const roi=totalCost>0?((profit/totalCost)*100).toFixed(1):"0";
  const downPay=pur-loanAmt;
  const cashIn=downPay+totalReno*(1-drawPct/100)+totalLoanFees;
  const cashROI=cashIn>0?((profit/cashIn)*100).toFixed(1):"0";
  const profitMargin=arv>0?((profit/arv)*100).toFixed(1):"0";

  // Header
  doc.setFillColor(9,9,11);doc.rect(0,0,W,95,"F");
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("S O V E R E I G N   H O U S E",M,28);
  doc.setFontSize(20);doc.setTextColor(241,245,249);doc.text("Deal Analysis — 8-Step Protocol",M,50);
  doc.setFontSize(9);doc.setTextColor(148,163,184);
  doc.text(new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),M,68);
  y=115;

  // Property
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("PROPERTY",M,y);y+=14;
  doc.setFontSize(15);doc.setTextColor(30,30,30);doc.text(p.address||"",M,y);y+=15;
  doc.setFontSize(10);doc.setTextColor(100,116,139);
  doc.text(`${p.city||""}, NV ${p.zip_code||""} · MLS# ${p.mls_number||""}`,M,y);y+=13;
  doc.text(`${p.bedrooms||"?"}bd/${p.bathrooms||"?"}ba · ${p.sqft?.toLocaleString()||"?"}sf · Built ${p.year_built||"?"} · ${p.pool?"Pool":"No Pool"} · ${p.garage_spaces||"?"}G · Score: ${p.sovereign_score||"?"}`,M,y);y+=13;
  doc.text(`List: ${fmt(p.list_price)} · $${p.price_per_sqft||"?"}/sf · ${p.days_on_market||"?"} DOM`,M,y);y+=18;
  doc.setDrawColor(220,220,220);doc.line(M,y,W-M,y);y+=14;

  // Purchase & ARV
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("PURCHASE & ARV",M,y);y+=14;
  doc.setFontSize(10);doc.setTextColor(60,60,60);
  const disc=p.list_price>0?((p.list_price-pur)/p.list_price*100).toFixed(1):0;
  doc.text(`Purchase: ${fmt(pur)} (${disc}% below list)`,M,y);doc.setTextColor(34,197,94);doc.text(`ARV: ${fmt(arv)} ($${p.sqft?Math.round(arv/p.sqft):"?"}/sf)`,320,y);y+=18;

  // Renovation
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("RENOVATION",M,y);y+=14;
  doc.setFontSize(10);doc.setTextColor(60,60,60);
  doc.text(`Rehab: ${fmt(rehab)} ($${p.sqft?Math.round(rehab/p.sqft):"?"}/sf)`,M,y);
  if(addl>0)doc.text(`+ Additional: ${fmt(addl)}`,250,y);
  doc.text(`Total: ${fmt(totalReno)}`,420,y);y+=18;

  // Financing
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("FINANCING",M,y);y+=14;
  doc.setFontSize(10);doc.setTextColor(60,60,60);
  doc.text(`${ltv}% LTV · ${rate}% Rate · ${pts}% Points · ${orig}% Orig · ${fmt(closeBuyFlat)} Close`,M,y);y+=13;
  doc.text(`Loan: ${fmt(totalLoan)}`,M,y);doc.text(`Down: ${fmt(downPay)}`,200,y);doc.text(`Fees: ${fmt(totalLoanFees)}`,360,y);y+=18;

  // Holding
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text(`HOLDING COSTS (${holdMo} MONTHS)`,M,y);y+=14;
  doc.setFontSize(10);doc.setTextColor(60,60,60);
  const hLines=[["Interest",fmt(monthlyInt)],["Tax",fmt(monthlyTax)],["Insurance",fmt(ins)],["HOA",fmt(hoa)],["Utils/Pool",fmt(util)]];
  let hx=M;
  hLines.forEach(([l,v])=>{doc.text(`${l}: ${v}`,hx,y);hx+=105;});y+=13;
  doc.setTextColor(212,175,55);doc.text(`Monthly: ${fmt(monthlyTotal)}`,M,y);
  doc.setTextColor(245,158,11);doc.text(`× ${holdMo} months = ${fmt(totalHold)}`,250,y);y+=18;

  // Selling
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("SELLING COSTS",M,y);y+=14;
  doc.setFontSize(10);doc.setTextColor(60,60,60);
  doc.text(`Lisa: $0 listing · Buyer Agent: ${fmt(buyerComm)} · Close: ${fmt(sellClose)}`,M,y);y+=13;
  doc.text(`Staging: ${fmt(stg)} · Title: ${fmt(ttl)} · HOA Xfer: ${fmt(hxf)} · Misc: ${fmt(msc)}`,M,y);y+=13;
  doc.text(`RPTT (Transfer Tax): ${fmt(Math.round(rpttPdf))}`,M,y);y+=13;
  doc.setTextColor(212,175,55);doc.text(`Total Selling: ${fmt(totalSell)}`,M,y);y+=22;

  // Profit Waterfall
  doc.setDrawColor(200,200,200);doc.line(M,y,W-M,y);y+=14;
  doc.setFontSize(8);doc.setTextColor(212,175,55);doc.text("PROFIT WATERFALL",M,y);y+=16;
  doc.setFontSize(11);doc.setTextColor(34,197,94);doc.text("ARV",M,y);doc.text(fmt(arv),250,y);y+=14;
  doc.setTextColor(60,60,60);
  [["− Purchase",fmt(pur)],["− Renovation",fmt(totalReno)],["− Loan Fees",fmt(totalLoanFees)],["− Holding ("+holdMo+"mo)",fmt(totalHold)],["− Selling",fmt(totalSell)]].forEach(([l,v])=>{doc.text(l,M,y);doc.text(v,250,y);y+=14;});
  doc.setDrawColor(180,180,180);doc.line(M,y-4,330,y-4);y+=8;
  const pc=profit>0?[34,197,94]:[239,68,68];
  doc.setFontSize(18);doc.setTextColor(...pc);doc.text("NET PROFIT",M,y);doc.text(fmt(profit),250,y);y+=18;
  doc.setFontSize(11);doc.setTextColor(...pc);doc.text(`${roi}% Total ROI`,M,y);
  doc.setTextColor(212,175,55);doc.text(`${cashROI}% Cash-on-Cash`,200,y);y+=22;

  // Deal Screening box
  const screenColor=parseFloat(profitMargin)>=12?[34,197,94]:parseFloat(profitMargin)>=8?[245,158,11]:[239,68,68];
  doc.setFillColor(240,253,244);doc.roundedRect(M,y,W-M*2,45,6,6,"F");
  doc.setFontSize(8);doc.setTextColor(...screenColor);doc.text("DEAL SCREENING",M+12,y+15);
  doc.setFontSize(16);doc.setTextColor(...screenColor);doc.text(`${profitMargin}% Profit Margin`,M+12,y+35);
  doc.setFontSize(9);doc.setTextColor(100,116,139);
  doc.text(`All-In: ${(totalCost/arv*100).toFixed(1)}% of ARV · Cash-on-Cash: ${cashROI}%`,220,y+35);y+=55;

  doc.setFontSize(10);doc.setTextColor(60,60,60);
  doc.text(`Total All-In: ${fmt(totalCost)}`,M,y);doc.text(`Your Cash In: ${fmt(cashIn)}`,300,y);y+=20;
  doc.setFontSize(7);doc.setTextColor(148,163,184);doc.text("Sovereign House Intelligence · "+new Date().toLocaleString(),M,y);

  doc.save(`SH-${(p.address||"deal").replace(/[^a-zA-Z0-9]/g,"-")}.pdf`);
}

function shareAnalysis(){
  if(!calcProp)return;
  const p=calcProp;
  const arv=gv("c_arv"),pur=gv("c_pur"),rehab=gv("c_rehab"),addl=gv("c_addl");
  const holdMo=gv("c_hold"),ltv=gv("c_ltv"),rate=gv("c_rate"),drawPct=gv("c_drawpct");
  const totalReno=rehab+addl;
  const loanAmt=Math.round(pur*(ltv/100)),renoFin=Math.round(totalReno*(drawPct/100)),totalLoan=loanAmt+renoFin;
  const totalLoanFees=Math.round(totalLoan*(gv("c_pts")/100))+Math.round(totalLoan*(gv("c_orig")/100))+gv("c_closebuy")+gv("c_svcfee");
  const monthlyInt=Math.round(totalLoan*(rate/100)/12),monthlyTax=Math.round(gv("c_tax")/12);
  const monthlyTotal=monthlyInt+monthlyTax+gv("c_ins")+gv("c_hoa")+gv("c_util");
  const totalHold=monthlyTotal*holdMo;
  const totalSell=Math.round(arv*(gv("c_bagent")/100))+gv("c_closesell")+gv("c_staging")+gv("c_title")+gv("c_hoaxfer")+gv("c_misc")+(arv>0?Math.ceil(arv/500)*2.55:0);
  const totalCost=pur+totalReno+totalLoanFees+totalHold+totalSell;
  const profit=arv-totalCost;
  const roi=totalCost>0?((profit/totalCost)*100).toFixed(1):"0";

  const text=`SOVEREIGN HOUSE — Deal Analysis
━━━━━━━━━━━━━━━━
${p.address}, ${p.city} NV ${p.zip_code}
MLS# ${p.mls_number} · ${p.bedrooms}bd/${p.bathrooms}ba · ${p.sqft?.toLocaleString()}sf
Built ${p.year_built} · ${p.pool?"Pool":"No Pool"} · Score: ${p.sovereign_score}

Purchase: ${$(pur)} (List: ${$(p.list_price)})
ARV: ${$(arv)}
Rehab: ${$(totalReno)}
Holding (${holdMo}mo): ${$(totalHold)}
Selling: ${$(totalSell)}
All-In: ${$(totalCost)}

PROFIT: ${$(profit)} (${roi}% ROI)
Margin: ${arv>0?(profit/arv*100).toFixed(1):'0'}% of ARV
━━━━━━━━━━━━━━━━
${new Date().toLocaleDateString()}`;

  if(navigator.share){navigator.share({title:`SH: ${p.address}`,text}).catch(()=>{});}
  else{const ta=document.createElement("textarea");ta.value=text;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);alert("Copied!");}
}
