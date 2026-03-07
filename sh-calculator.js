// Sovereign House Intelligence — 8-Step Protocol Calculator
// ═══════════════════════════════════════════
// ═══ FULL 8-STEP PROTOCOL CALCULATOR ═══
// ═══════════════════════════════════════════
let calcProp=null,calcHistory=[];
let calcSections={financing:true,holding:true,selling:true};

async function openCalc(id){
  calcProp=props.find(x=>x.id===id);if(!calcProp)return;
  const ch=await sb(`calc_history?mls_number=eq.${calcProp.mls_number}&order=created_at.desc`);
  calcHistory=Array.isArray(ch)?ch:[];

  // If we have a saved analysis, pre-fill from it
  const hasSaved = calcHistory.length > 0;
  const last = hasSaved ? calcHistory[0] : null;

  renderCalc(last);
  document.getElementById("calcModal").style.display="block";
  document.body.style.overflow="hidden";
}
function closeCalc(){document.getElementById("calcModal").style.display="none";if(document.getElementById("detailModal").style.display==="block"){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}}

function gv(id){const el=document.getElementById(id);return el?Number(el.value)||0:0;}

function renderCalc(saved){
  const p=calcProp;if(!p)return;
  const sqft=p.sqft||2500,age=p.year_built?2026-p.year_built:15;
  const defRehab=age>25?Math.round(sqft*65):age>15?Math.round(sqft*50):Math.round(sqft*35);
  const defHOA=p.hoa_monthly||450;
  const defTaxAnnual=Math.round((p.list_price||900000)*0.007);

  // Use saved values or defaults
  const v = {
    pur: saved?.purchase_price || p.list_price || 0,
    arv: saved?.arv || Math.round((p.list_price||0)*1.35),
    rehab: saved?.rehab_budget || defRehab,
    addl: saved?.additional_costs || 0,
    ltv: saved?.ltv || 90,
    rate: saved?.interest_rate || 11.49,
    pts: saved?.points || 0,
    orig: saved?.origination || 1.5,
    closebuy: saved?.closing_buy_flat || 5000,
    drawpct: saved?.reno_draw_pct || 100,
    hold: saved?.hold_months || 8,
    tax: saved?.tax_annual || defTaxAnnual,
    ins: saved?.insurance_monthly || 250,
    hoa: saved?.hoa_monthly || defHOA,
    util: saved?.utilities_monthly || 650,
    bagent: saved?.buyer_agent_pct || 2.5,
    closesell: saved?.closing_sell_flat || 3500,
    staging: saved?.staging || 5000,
    title: saved?.title_insurance || 3000,
    hoaxfer: saved?.hoa_transfer || 500,
    misc: saved?.misc_buffer || 1500,
    svcfee: saved?.service_fee || 1499,
    lisacomm: saved?.lisa_commission_pct ?? 2.5
  };

  const m=document.getElementById("calcModal");
  m.innerHTML=`<div class="sheet" style="position:relative"><div class="handle"></div><button class="close-x" onclick="closeCalc()">✕</button>
    <div style="margin-bottom:16px;padding-right:40px">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">8-STEP PROTOCOL</div>
      <div style="font-size:17px;font-weight:800;margin-top:2px">${esc(p.address)}</div>
      <div style="font-size:10px;color:#64748b;margin-top:1px">MLS# ${p.mls_number} · ${sqft.toLocaleString()}sf · Built ${p.year_built} · ${p.pool?"Pool":"No Pool"}</div>
      ${calcHistory.length>0?`<button onclick="toggleCalcHist()" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#64748b;font-size:10px;font-weight:700;cursor:pointer">📂 ${calcHistory.length} Past Run${calcHistory.length>1?"s":""}</button>`:""}
      ${saved?`<div style="margin-top:6px;padding:4px 10px;border-radius:6px;background:rgba(34,197,94,0.08);display:inline-block;font-size:10px;color:#22c55e;font-weight:600">✓ Loaded from ${new Date(saved.updated_at||saved.created_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"})}</div>`:""}
    </div>
    <div id="calcHistArea"></div>

    <!-- PURCHASE & ARV -->
    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">PURCHASE & ARV</div>
    <div class="row2">
      <div class="fld"><label>LIST PRICE</label><div style="font-size:18px;font-weight:800;color:#94a3b8">${$(p.list_price)}</div><div class="sub">${p.price_per_sqft?`$${p.price_per_sqft}/sf`:""}</div></div>
      <div class="fld"><label>PURCHASE PRICE (your offer)</label><input id="c_pur" type="number" class="cinput" value="${v.pur}" oninput="updateCalc()"/><div class="sub">Discount from list: <span id="discountLabel"></span></div></div>
    </div>
    <div class="row2">
      <div class="fld"><label>ARV (After Repair Value)</label><input id="c_arv" type="number" class="cinput" value="${v.arv}" oninput="updateCalc()"/><div class="sub">Target sale price post-renovation</div></div>
      <div class="fld"><label>ARV $/SF</label><div id="arvPPSF" style="font-size:16px;font-weight:700;color:#94a3b8;padding-top:10px"></div></div>
    </div>

    <!-- RENOVATION -->
    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin:16px 0 10px">RENOVATION</div>
    <div class="row3">
      <div class="fld"><label>SCOPE</label>
        <select id="c_tier" onchange="applyTier()" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:#f1f5f9;font-size:16px;font-weight:700;min-height:44px">
          <option value="custom">Custom</option>
          <option value="lite">Lite Cosmetic ($25/sf)</option>
          <option value="standard" selected>Sovereign Standard ($50/sf)</option>
          <option value="full">Full Renovation ($75/sf)</option>
          <option value="structural">Structural ($100/sf)</option>
          <option value="gut">Gut Rehab ($130/sf)</option>
        </select>
      </div>
      <div class="fld"><label>REHAB BUDGET</label><input id="c_rehab" type="number" class="cinput" value="${v.rehab}" oninput="updateCalc()"/><div class="sub" id="rehabPPSF"></div></div>
      <div class="fld"><label>ADDITIONAL COSTS</label><input id="c_addl" type="number" class="cinput" value="${v.addl}" oninput="updateCalc()"/><div class="sub">Pool, landscaping, etc</div></div>
    </div>

    <!-- FINANCING -->
    <div class="sec-toggle" onclick="toggleSec('financing')">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">FINANCING</div>
      <span style="color:#64748b;font-size:14px" id="fin_arrow">${calcSections.financing?"▼":"▶"}</span>
    </div>
    <div id="sec_financing" style="display:${calcSections.financing?"block":"none"}">
      <div class="row3" style="margin-top:10px">
        <div class="fld"><label>LTV %</label><input id="c_ltv" type="number" class="cinput" value="${v.ltv}" oninput="updateCalc()"/></div>
        <div class="fld"><label>INTEREST RATE %</label><input id="c_rate" type="number" class="cinput" value="${v.rate}" oninput="updateCalc()"/></div>
        <div class="fld"><label>POINTS %</label><input id="c_pts" type="number" class="cinput" value="${v.pts}" oninput="updateCalc()"/></div>
      </div>
      <div class="row3">
        <div class="fld"><label>ORIGINATION %</label><input id="c_orig" type="number" class="cinput" value="${v.orig}" oninput="updateCalc()"/></div>
        <div class="fld"><label>CLOSING (BUY) $</label><input id="c_closebuy" type="number" class="cinput" value="${v.closebuy}" oninput="updateCalc()"/></div>
        <div class="fld"><label>RENO DRAW %</label><input id="c_drawpct" type="number" class="cinput" value="${v.drawpct}" oninput="updateCalc()"/><div class="sub">Lender covers 100% reno</div></div>
      </div>
      <div class="row3">
        <div class="fld"><label>SERVICE FEE $</label><input id="c_svcfee" type="number" class="cinput" value="${v.svcfee}" oninput="updateCalc()"/><div class="sub">Lender flat fee</div></div>
      </div>
      <div id="finSummary" class="row3" style="margin-bottom:10px"></div>
    </div>

    <!-- HOLDING COSTS -->
    <div class="sec-toggle" onclick="toggleSec('holding')">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">MONTHLY HOLDING COSTS</div>
      <span style="color:#64748b;font-size:14px" id="hold_arrow">${calcSections.holding?"▼":"▶"}</span>
    </div>
    <div id="sec_holding" style="display:${calcSections.holding?"block":"none"}">
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0">
        <span style="font-size:11px;color:#64748b;font-weight:700;white-space:nowrap">HOLD PERIOD</span>
        <input id="c_hold" type="range" min="3" max="18" value="${v.hold}" oninput="updateCalc();document.getElementById('holdLabel').textContent=this.value+' months'" style="flex:1;accent-color:#d4af37"/>
        <span id="holdLabel" style="font-size:14px;font-weight:800;color:#d4af37;min-width:70px;text-align:right">${v.hold} months</span>
      </div>
      <div class="row2" style="margin-top:6px">
        <div class="fld"><label>PROPERTY TAX (annual)</label><input id="c_tax" type="number" class="cinput" value="${v.tax}" oninput="updateCalc()"/><div class="sub">~0.7% of value</div></div>
        <div class="fld"><label>INSURANCE $/mo</label><input id="c_ins" type="number" class="cinput" value="${v.ins}" oninput="updateCalc()"/><div class="sub">(Purchase+Reno)×0.35%/12</div></div>
      </div>
      <div class="row2">
        <div class="fld"><label>HOA $/mo</label><input id="c_hoa" type="number" class="cinput" value="${v.hoa}" oninput="updateCalc()"/></div>
        <div class="fld"><label>UTILITIES/POOL/LANDSCAPE $/mo</label><input id="c_util" type="number" class="cinput" value="${v.util}" oninput="updateCalc()"/></div>
      </div>
      <div id="holdSummary" style="margin-bottom:10px"></div>
    </div>

    <!-- SELLING COSTS -->
    <div class="sec-toggle" onclick="toggleSec('selling')">
      <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px">SELLING COSTS</div>
      <span style="color:#64748b;font-size:14px" id="sell_arrow">${calcSections.selling?"▼":"▶"}</span>
    </div>
    <div id="sec_selling" style="display:${calcSections.selling?"block":"none"}">
      <div style="padding:8px 12px;border-radius:8px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.12);font-size:11px;color:#22c55e;margin:10px 0">Lisa lists every deal — $0 listing commission</div>
      <div style="margin-bottom:12px;padding:12px;border-radius:10px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <label style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:1px">LISA BUY-SIDE COMMISSION</label>
          <span id="lisaCommLabel" style="font-size:14px;font-weight:800;color:#d4af37">${v.lisacomm}%</span>
        </div>
        <input id="c_lisacomm" type="range" min="0" max="3" step="0.5" value="${v.lisacomm}" oninput="document.getElementById('lisaCommLabel').textContent=this.value+'%';updateCalc()" style="width:100%;accent-color:#d4af37"/>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#475569;margin-top:4px"><span>0%</span><span>1%</span><span>2%</span><span>2.5%</span><span>3%</span></div>
        <div id="lisaCommAmt" style="text-align:center;font-size:12px;color:#22c55e;font-weight:700;margin-top:6px"></div>
        <div style="font-size:9px;color:#64748b;text-align:center;margin-top:2px">Income credit — reduces total project cost</div>
      </div>
      <div class="row3">
        <div class="fld"><label>BUYER AGENT %</label><input id="c_bagent" type="number" class="cinput" value="${v.bagent}" oninput="updateCalc()"/></div>
        <div class="fld"><label>CLOSING (SELL) $</label><input id="c_closesell" type="number" class="cinput" value="${v.closesell}" oninput="updateCalc()"/></div>
        <div class="fld"><label>STAGING $</label><input id="c_staging" type="number" class="cinput" value="${v.staging}" oninput="updateCalc()"/></div>
      </div>
      <div class="row3">
        <div class="fld"><label>TITLE INSURANCE $</label><input id="c_title" type="number" class="cinput" value="${v.title}" oninput="updateCalc()"/></div>
        <div class="fld"><label>HOA TRANSFER $</label><input id="c_hoaxfer" type="number" class="cinput" value="${v.hoaxfer}" oninput="updateCalc()"/></div>
        <div class="fld"><label>MISC BUFFER $</label><input id="c_misc" type="number" class="cinput" value="${v.misc}" oninput="updateCalc()"/></div>
      </div>
      <div id="sellSummary" style="margin-bottom:10px"></div>
    </div>

    <!-- RESULTS -->
    <div id="calcResults" style="margin-top:16px"></div>

    <button id="calcSaveBtn" onclick="doSaveCalc()" class="btn" style="width:100%;margin-top:12px;padding:14px;font-size:14px;background:rgba(212,175,55,0.9);color:#0a0a0a">💾 Save Analysis</button>
    <button onclick="saveAndOffer()" class="btn" style="width:100%;margin-top:8px;padding:14px;font-size:14px;background:linear-gradient(135deg,rgba(34,197,94,0.9),rgba(34,197,94,0.7));color:#0a0a0a;font-weight:800">📝 Save & Make Offer →</button>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button onclick="exportPDF()" class="btn" style="flex:1;padding:12px;font-size:13px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#f1f5f9">📄 Export PDF</button>
      <button onclick="shareAnalysis()" class="btn" style="flex:1;padding:12px;font-size:13px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#f1f5f9">📤 Share</button>
    </div>
  </div>`;
  updateCalc();
}

function toggleSec(name){
  calcSections[name]=!calcSections[name];
  const el=document.getElementById("sec_"+name);
  el.style.display=calcSections[name]?"block":"none";
  const arrows={financing:"fin_arrow",holding:"hold_arrow",selling:"sell_arrow"};
  document.getElementById(arrows[name]).textContent=calcSections[name]?"▼":"▶";
}

function applyTier(){
  const tier=document.getElementById("c_tier").value;
  const sqft=calcProp?.sqft||2500;
  const rates={lite:25,standard:50,full:75,structural:100,gut:130};
  if(rates[tier]){document.getElementById("c_rehab").value=Math.round(sqft*rates[tier]);updateCalc();}
}

function updateCalc(){
  if(!calcProp)return;
  const p=calcProp,sqft=p.sqft||2500;
  const arv=gv("c_arv"),pur=gv("c_pur"),rehab=gv("c_rehab"),addl=gv("c_addl");
  const ltv=gv("c_ltv"),rate=gv("c_rate"),pts=gv("c_pts"),orig=gv("c_orig"),closeBuy=gv("c_closebuy"),drawPct=gv("c_drawpct"),svcfee=gv("c_svcfee");
  const holdMo=gv("c_hold"),taxAnn=gv("c_tax"),ins=gv("c_ins"),hoa=gv("c_hoa"),util=gv("c_util");
  const bagent=gv("c_bagent"),closeSell=gv("c_closesell"),staging=gv("c_staging"),title=gv("c_title"),hoaxfer=gv("c_hoaxfer"),misc=gv("c_misc");
  const lisaCommPct=parseFloat(document.getElementById("c_lisacomm")?.value||2.5);
  const lisaCommAmt=Math.round(pur*(lisaCommPct/100));
  const el_lca=document.getElementById("lisaCommAmt");if(el_lca)el_lca.textContent=lisaCommPct>0?'-'+$(lisaCommAmt)+' credit':'No commission';
  const totalReno=rehab+addl;

  // Discount from list
  const discount=p.list_price>0?((p.list_price-pur)/p.list_price*100).toFixed(1):0;
  document.getElementById("discountLabel").textContent=pur<p.list_price?`${discount}% below ask`:(pur>p.list_price?`${Math.abs(discount)}% above ask`:"At list");
  document.getElementById("discountLabel").style.color=pur<=p.list_price?"#22c55e":"#ef4444";

  // ARV PPSF
  document.getElementById("arvPPSF").textContent=sqft>0?`$${Math.round(arv/sqft)}/sf`:"—";
  document.getElementById("rehabPPSF").textContent=sqft>0?`$${Math.round(totalReno/sqft)}/sf`:"";

  // FINANCING
  const loanAmt=Math.round(pur*(ltv/100));
  const renoFinanced=Math.round(totalReno*(drawPct/100));
  const totalLoan=loanAmt+renoFinanced;
  const loanPts=Math.round(totalLoan*(pts/100));
  const loanOrig=Math.round(totalLoan*(orig/100));
  const buyClosing=closeBuy;
  // Pro-rated interest at closing: only purchase loan is disbursed, no rehab draws yet
  // Assume 21 days remaining in month (conservative default — could be made dynamic with a date picker)
  const proRateDays=21;
  const proRateInterest=Math.round(loanAmt*(rate/100)/12*(proRateDays/30));
  const totalLoanFees=loanPts+loanOrig+buyClosing+svcfee+proRateInterest;
  const downPayment=pur-loanAmt;

  document.getElementById("finSummary").innerHTML=`
    <div class="wb"><div class="wl">LOAN AMOUNT</div><div class="wv" style="color:#e2e8f0">${$(totalLoan)}</div></div>
    <div class="wb"><div class="wl">DOWN PAYMENT</div><div class="wv" style="color:#f59e0b">${$(downPayment)}</div></div>
    <div class="wb"><div class="wl">TOTAL LOAN FEES</div><div class="wv" style="color:#f59e0b">${$(totalLoanFees)}</div><div class="sub" style="font-size:9px;color:#475569;margin-top:2px">${$(loanPts)} pts + ${$(loanOrig)} orig + ${$(buyClosing)} close + ${$(svcfee)} svc + ${$(proRateInterest)} pro-rate int</div></div>`;

  // HOLDING — interest accrues on 90% purchase + midpoint rehab draw (50% of reno)
  const intPrincipal=Math.round(pur*0.90 + 0.50*totalReno);
  const monthlyInterest=Math.round(intPrincipal*(rate/100)/12);
  const monthlyTax=Math.round(taxAnn/12);
  const monthlyTotal=monthlyInterest+monthlyTax+ins+hoa+util;
  const totalHold=monthlyTotal*holdMo;

  document.getElementById("holdSummary").innerHTML=`
    <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);margin-top:8px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Interest (${rate}% on ${$(intPrincipal)})</span><span style="font-weight:700">${$(monthlyInterest)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Property Tax</span><span style="font-weight:700">${$(monthlyTax)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Insurance</span><span style="font-weight:700">${$(ins)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">HOA</span><span style="font-weight:700">${$(hoa)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Utilities/Pool/Landscape</span><span style="font-weight:700">${$(util)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:13px"><span style="color:#d4af37;font-weight:800">MONTHLY TOTAL</span><span style="font-weight:800;color:#d4af37">${$(monthlyTotal)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0 0;font-size:13px"><span style="color:#f59e0b;font-weight:700">× ${holdMo} MONTHS</span><span style="font-weight:800;color:#f59e0b">${$(totalHold)}</span></div>
    </div>`;

  // SELLING
  const buyerComm=Math.round(arv*(bagent/100));
  const sellClosing=closeSell;
  const rptt=arv>0?Math.ceil(arv/500)*2.55:0;
  const totalSell=buyerComm+sellClosing+staging+title+hoaxfer+misc+rptt;

  document.getElementById("sellSummary").innerHTML=`
    <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);margin-top:8px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Buyer Agent (${bagent}%)</span><span style="font-weight:700">${$(buyerComm)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Closing (Sell)</span><span style="font-weight:700">${$(sellClosing)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Staging</span><span style="font-weight:700">${$(staging)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Title Insurance</span><span style="font-weight:700">${$(title)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">HOA Transfer</span><span style="font-weight:700">${$(hoaxfer)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Misc Buffer</span><span style="font-weight:700">${$(misc)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px"><span style="color:#94a3b8">Transfer Tax (RPTT)</span><span style="font-weight:700">${$(Math.round(rptt))}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:13px"><span style="color:#d4af37;font-weight:800">TOTAL SELL COSTS</span><span style="font-weight:800;color:#d4af37">${$(totalSell)}</span></div>
    </div>`;

  // PROFIT WATERFALL
  const totalCost=pur+totalReno+totalLoanFees+totalHold+totalSell-lisaCommAmt;
  const profit=arv-totalCost;
  const roi=totalCost>0?((profit/totalCost)*100).toFixed(1):"0";
  const cashIn=downPayment+totalReno*(1-drawPct/100)+totalLoanFees;
  const cashROI=cashIn>0?((profit/cashIn)*100).toFixed(1):"0";
  const pc=profit>0?"#22c55e":"#ef4444";

  document.getElementById("calcResults").innerHTML=`
    <div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:10px">PROFIT WATERFALL</div>
    <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#22c55e;font-weight:600">ARV (Sale Price)</span><span style="font-weight:800;color:#22c55e">${$(arv)}${sqft>0?` <span style="font-size:10px;font-weight:600;color:#94a3b8">$${Math.round(arv/sqft)}/sf</span>`:""}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">− Purchase Price</span><span style="color:#f1f5f9;font-weight:600">${$(pur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">− Renovation (${$(rehab)} + ${$(addl)})</span><span style="color:#f1f5f9;font-weight:600">${$(totalReno)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">− Loan Fees (${$(loanPts)} pts + ${$(loanOrig)} orig + ${$(buyClosing)} close + ${$(svcfee)} svc + ${$(proRateInterest)} prorated)</span><span style="color:#f1f5f9;font-weight:600">${$(totalLoanFees)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">− Holding (${holdMo} months)</span><span style="color:#f1f5f9;font-weight:600">${$(totalHold)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="color:#94a3b8">− Selling Costs</span><span style="color:#f1f5f9;font-weight:600">${$(totalSell)}</span></div>
      ${lisaCommAmt>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="color:#22c55e;font-weight:600">+ Lisa Buy Commission (${lisaCommPct}%)</span><span style="font-weight:700;color:#22c55e">−${$(lisaCommAmt)}</span></div>`:""}
      <div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:15px"><span style="font-weight:800;color:${pc}">NET PROFIT</span><span style="font-weight:800;color:${pc};font-size:22px">${$(profit)}</span></div>
      <div style="display:flex;gap:12px;margin-top:4px">
        <span style="font-size:11px;color:${pc};font-weight:700">${roi}% Total ROI</span>
        <span style="font-size:11px;color:#d4af37;font-weight:700">${cashROI}% Cash-on-Cash</span>
      </div>
    </div>

    <div style="margin-top:12px;padding:14px;border-radius:14px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2)">
      <div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:2px">DEAL SCREENING</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
        <div style="text-align:center;padding:10px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">PROFIT MARGIN</div>
          <div style="font-size:20px;font-weight:800;color:${arv>0?(profit/arv*100>=12?'#22c55e':profit/arv*100>=8?'#f59e0b':'#ef4444'):'#64748b'};margin-top:2px">${arv>0?(profit/arv*100).toFixed(1):'0'}%</div>
          <div style="font-size:9px;color:#475569;margin-top:2px">of ARV</div>
        </div>
        <div style="text-align:center;padding:10px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">ALL-IN / ARV</div>
          <div style="font-size:20px;font-weight:800;color:${arv>0?(totalCost/arv*100<=85?'#22c55e':totalCost/arv*100<=90?'#f59e0b':'#ef4444'):'#64748b'};margin-top:2px">${arv>0?(totalCost/arv*100).toFixed(1):'0'}%</div>
          <div style="font-size:9px;color:#475569;margin-top:2px">sweet spot ≤88%</div>
        </div>
        <div style="text-align:center;padding:10px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">CASH-ON-CASH</div>
          <div style="font-size:20px;font-weight:800;color:${cashIn>0?(profit/cashIn*100>=50?'#22c55e':profit/cashIn*100>=25?'#f59e0b':'#ef4444'):'#64748b'};margin-top:2px">${cashROI}%</div>
          <div style="font-size:9px;color:#475569;margin-top:2px">ROI on your cash</div>
        </div>
      </div>
      <div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(0,0,0,0.2);font-size:11px;text-align:center;font-weight:700;color:${arv>0?(profit/arv*100>=12?'#22c55e':profit/arv*100>=8?'#f59e0b':'#ef4444'):'#64748b'}">${arv>0?(profit/arv*100>=12?'✅ DEAL SCREENS — 12%+ margin on ARV':profit/arv*100>=8?'⚠️ MARGINAL — 8-12% margin, negotiate harder':'🚫 DOES NOT SCREEN — under 8% margin'):'Enter ARV to screen'}</div>
    </div>

    <div style="margin-top:12px;padding:16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)">
      <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:2px;margin-bottom:10px">PROJECT SUMMARY</div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">Purchase</span><span style="color:#e2e8f0;font-weight:600">${$(pur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">Renovation</span><span style="color:#e2e8f0;font-weight:600">${$(totalReno)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">Loan Fees (${$(loanPts)} pts + ${$(loanOrig)} orig + ${$(buyClosing)} close + ${$(svcfee)} svc + ${$(proRateInterest)} prorated)</span><span style="color:#e2e8f0;font-weight:600">${$(totalLoanFees)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)"><span style="color:#94a3b8">Holding (${holdMo}mo)</span><span style="color:#e2e8f0;font-weight:600">${$(totalHold)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="color:#94a3b8">Selling</span><span style="color:#e2e8f0;font-weight:600">${$(totalSell)}</span></div>
      ${lisaCommAmt>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="color:#22c55e">Lisa Buy Commission (${lisaCommPct}%)</span><span style="color:#22c55e;font-weight:600">−${$(lisaCommAmt)}</span></div>`:""}
      <div style="display:flex;justify-content:space-between;padding:8px 0 2px;font-size:15px"><span style="font-weight:800;color:#f1f5f9">TOTAL PROJECT COST</span><span style="font-weight:800;color:#f1f5f9;font-size:20px">${$(totalCost)}</span></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <div class="wb"><div class="wl">YOUR CASH IN</div><div class="wv" style="color:#f59e0b">${$(cashIn)}</div><div style="font-size:9px;color:#475569;margin-top:2px">10% down + fees</div></div>
      <div class="wb"><div class="wl">LOAN FUNDS</div><div class="wv" style="color:#3b82f6">${$(totalCost-cashIn)}</div><div style="font-size:9px;color:#475569;margin-top:2px">90% purchase + 100% reno</div></div>
    </div>`;
}

function toggleCalcHist(){
  const a=document.getElementById("calcHistArea");
  if(a.innerHTML){a.innerHTML="";return;}
  a.innerHTML=`<div style="margin-bottom:16px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)"><div style="font-size:10px;color:#d4af37;font-weight:700;letter-spacing:1px;margin-bottom:8px">PAST RUNS</div>${calcHistory.map((h,i)=>`<div onclick="loadCalcHist(${i})" style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);min-height:44px"><div><div style="font-size:11px;color:#e2e8f0;font-weight:600">ARV ${$(h.arv)} · Purchase ${$(h.purchase_price)} · Rehab ${$(h.rehab_budget)}</div><div style="font-size:10px;color:#64748b">${new Date(h.updated_at||h.created_at).toLocaleDateString("en-US",{timeZone:"America/Los_Angeles"})}</div></div><div style="text-align:right"><div style="font-size:14px;font-weight:800;color:${h.net_profit>0?"#22c55e":"#ef4444"}">${$(h.net_profit)}</div><div style="font-size:10px;color:#64748b">${h.roi}%</div></div></div>`).join("")}</div>`;
}

function loadCalcHist(i){
  const h=calcHistory[i];if(!h)return;
  document.getElementById("c_arv").value=h.arv||0;
  document.getElementById("c_pur").value=h.purchase_price||0;
  document.getElementById("c_rehab").value=h.rehab_budget||0;
  document.getElementById("c_addl").value=h.additional_costs||0;
  document.getElementById("c_ltv").value=h.ltv||70;
  document.getElementById("c_rate").value=h.interest_rate||12;
  document.getElementById("c_pts").value=h.points||0;
  document.getElementById("c_orig").value=h.origination||1;
  document.getElementById("c_closebuy").value=h.closing_buy_flat||5000;
  document.getElementById("c_drawpct").value=h.reno_draw_pct||100;
  document.getElementById("c_hold").value=h.hold_months||8;
  document.getElementById("holdLabel").textContent=(h.hold_months||8)+" months";
  document.getElementById("c_tax").value=h.tax_annual||0;
  document.getElementById("c_ins").value=h.insurance_monthly||250;
  document.getElementById("c_hoa").value=h.hoa_monthly||450;
  document.getElementById("c_util").value=h.utilities_monthly||650;
  document.getElementById("c_bagent").value=h.buyer_agent_pct||2.5;
  document.getElementById("c_closesell").value=h.closing_sell_flat||3500;
  document.getElementById("c_staging").value=h.staging||5000;
  document.getElementById("c_title").value=h.title_insurance||2000;
  document.getElementById("c_hoaxfer").value=h.hoa_transfer||500;
  document.getElementById("c_misc").value=h.misc_buffer||1500;
  document.getElementById("c_svcfee").value=h.service_fee||1499;
  const lcEl=document.getElementById("c_lisacomm");if(lcEl){lcEl.value=h.lisa_commission_pct??2.5;document.getElementById("lisaCommLabel").textContent=(h.lisa_commission_pct??2.5)+"%";}
  document.getElementById("calcHistArea").innerHTML="";
  updateCalc();
}

async function doSaveCalc(){
  if(!calcProp)return;
  const btn=document.getElementById("calcSaveBtn");
  btn.textContent="Saving...";btn.style.opacity="0.6";

  const arv=gv("c_arv"),pur=gv("c_pur"),rehab=gv("c_rehab"),addl=gv("c_addl");
  const ltv=gv("c_ltv"),rate=gv("c_rate"),pts=gv("c_pts"),orig=gv("c_orig"),closeBuyFlat=gv("c_closebuy"),drawPct=gv("c_drawpct");
  const holdMo=gv("c_hold"),taxAnn=gv("c_tax"),ins=gv("c_ins"),hoa=gv("c_hoa"),util=gv("c_util");
  const bagent=gv("c_bagent"),closeSellFlat=gv("c_closesell"),staging=gv("c_staging"),title=gv("c_title"),hoaxfer=gv("c_hoaxfer"),misc=gv("c_misc");
  const lisaCommPct2=parseFloat(document.getElementById("c_lisacomm")?.value||2.5);
  const lisaCommAmt2=Math.round(pur*(lisaCommPct2/100));

  const totalReno=rehab+addl;
  const svcfee=gv("c_svcfee");
  const loanAmt=Math.round(pur*(ltv/100)),renoFin=Math.round(totalReno*(drawPct/100)),totalLoan=loanAmt+renoFin;
  const proRateInt=Math.round(loanAmt*(rate/100)/12*(21/30));
  const loanFees=Math.round(totalLoan*(pts/100))+Math.round(totalLoan*(orig/100))+closeBuyFlat+svcfee+proRateInt;
  const intPrincipal2=Math.round(pur*0.90 + 0.50*totalReno);
  const monthlyH=Math.round(intPrincipal2*(rate/100)/12)+Math.round(taxAnn/12)+ins+hoa+util;
  const totalHold=monthlyH*holdMo;
  const totalSell=Math.round(arv*(bagent/100))+closeSellFlat+staging+title+hoaxfer+misc+(arv>0?Math.ceil(arv/500)*2.55:0);
  const totalCost=pur+totalReno+loanFees+totalHold+totalSell-lisaCommAmt2;
  const profit=arv-totalCost;
  const roi=totalCost>0?parseFloat(((profit/totalCost)*100).toFixed(1)):0;
  const profitMargin=arv>0?parseFloat(((profit/arv)*100).toFixed(1)):0;

  const downPay=pur-Math.round(pur*(ltv/100));
  const cashIn=downPay+totalReno*(1-drawPct/100)+loanFees;
  const cashROI2=cashIn>0?parseFloat(((profit/cashIn)*100).toFixed(1)):0;

  const payload={
    property_id:calcProp.id,mls_number:calcProp.mls_number,address:calcProp.address,
    arv,purchase_price:pur,rehab_budget:rehab,additional_costs:addl,
    ltv,interest_rate:rate,points:pts,origination:orig,closing_buy_flat:closeBuyFlat,reno_draw_pct:drawPct,
    loan_amount:totalLoan,down_payment:downPay,loan_fees:loanFees,
    hold_months:holdMo,tax_annual:taxAnn,insurance_monthly:ins,hoa_monthly:hoa,utilities_monthly:util,
    monthly_hold:monthlyH,hold_cost:totalHold,
    buyer_agent_pct:bagent,closing_sell_flat:closeSellFlat,staging,title_insurance:title,hoa_transfer:hoaxfer,misc_buffer:misc,
    total_sell_costs:totalSell,
    lisa_commission_pct:lisaCommPct2,lisa_commission_amt:lisaCommAmt2,
    total_cost:totalCost,net_profit:profit,roi,
    cash_required:cashIn,cash_roi:cashROI2,service_fee:svcfee
  };

  try{
    // Check for existing calc_history for this property — update instead of creating duplicates
    const existing=calcHistory.find(h=>h.property_id===calcProp.id)||null;
    let resp;
    if(existing){
      resp=await fetch(`${SB}/rest/v1/calc_history?id=eq.${existing.id}`,{method:"PATCH",headers:{...HD,Prefer:"return=representation"},body:JSON.stringify(payload)});
    } else {
      resp=await fetch(`${SB}/rest/v1/calc_history`,{method:"POST",headers:{...HD,Prefer:"return=representation"},body:JSON.stringify(payload)});
    }
    if(!resp.ok){
      const errText=await resp.text();
      console.error("Save failed:",resp.status,errText);
      btn.textContent="❌ Save Failed";btn.style.background="rgba(239,68,68,0.15)";btn.style.color="#ef4444";btn.style.opacity="1";
      const errDiv=document.createElement("div");
      errDiv.style.cssText="margin-top:8px;padding:10px;border-radius:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);font-size:11px;color:#ef4444;word-break:break-all";
      errDiv.textContent=`Error ${resp.status}: ${errText.substring(0,200)}`;
      btn.parentNode.insertBefore(errDiv,btn.nextSibling);
      setTimeout(()=>{btn.textContent="💾 Save Analysis";btn.style.background="rgba(212,175,55,0.9)";btn.style.color="#0a0a0a";errDiv.remove();},6000);
      return;
    }
    const updated=await sb(`calc_history?mls_number=eq.${calcProp.mls_number}&order=created_at.desc`);
    calcHistory=Array.isArray(updated)?updated:[];
    btn.textContent="✓ Saved!";btn.style.background="rgba(34,197,94,0.15)";btn.style.color="#22c55e";btn.style.opacity="1";
    setTimeout(()=>{btn.textContent="💾 Save Analysis";btn.style.background="rgba(212,175,55,0.9)";btn.style.color="#0a0a0a";},2500);
  }catch(e){
    console.error("Save error:",e);
    btn.textContent="❌ Network Error";btn.style.background="rgba(239,68,68,0.15)";btn.style.color="#ef4444";btn.style.opacity="1";
    setTimeout(()=>{btn.textContent="💾 Save Analysis";btn.style.background="rgba(212,175,55,0.9)";btn.style.color="#0a0a0a";},4000);
  }
}
