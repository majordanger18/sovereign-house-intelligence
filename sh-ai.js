// Sovereign House Intelligence — AI Underwrite (Claude)
// ═══════════════════════════════════════════
// ═══ AI UNDERWRITE (Claude via n8n) ═══
// ═══════════════════════════════════════════
async function aiUnderwrite(id){
  const btn=document.getElementById("aiBtn_"+id);
  const resultArea=document.getElementById("aiResult_"+id);
  if(!btn||!resultArea)return;
  resultArea.style.display="";  // Restore visibility (may have been hidden by openCalcFromAi)

  // Check for existing analysis first — render immediately if found
  try{
    const existing=await sb(`underwriting_analyses?property_id=eq.${id}&status=eq.complete&order=created_at.desc&limit=1`);
    const found=Array.isArray(existing)&&existing.length>0;
    const hasProfit=found&&existing[0].profit_target!==null;
    console.log('[SH DEBUG] aiUnderwrite check:',{id,found,hasProfit,rows:existing?.length,profit:found?existing[0].profit_target:'N/A',verdict:found?existing[0].verdict:'N/A'});
    if(found&&hasProfit){
      renderAiResult(resultArea,existing[0],id);
      analysisMap[id]=existing[0];
      btn.textContent="🤖 Re-Analyze with Claude";btn.style.background="rgba(34,197,94,0.1)";btn.style.borderColor="rgba(34,197,94,0.3)";btn.style.color="#22c55e";
      return;
    }
  }catch(e){console.error("Check existing:",e);}

  // No existing — fire webhook
  if(N8N_WEBHOOK==="YOUR_WEBHOOK_URL_HERE"){
    resultArea.innerHTML=`<div style="margin-top:8px;padding:14px;border-radius:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);text-align:center"><div style="color:#ef4444;font-size:13px;font-weight:700">⚠️ Webhook URL not configured</div><div style="color:#94a3b8;font-size:11px;margin-top:4px">Set N8N_WEBHOOK in index.html</div></div>`;
    return;
  }

  btn.textContent="🤖 Claude is analyzing...";
  btn.style.opacity="0.6";btn.style.pointerEvents="none";
  resultArea.innerHTML=`<div style="margin-top:8px;padding:20px;border-radius:12px;background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.15);text-align:center"><div style="width:28px;height:28px;border:3px solid rgba(139,92,246,0.2);border-top-color:#a78bfa;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div><div style="color:#a78bfa;font-size:12px;font-weight:700;margin-top:10px">Claude is running the 8-Step Protocol...</div><div style="color:#64748b;font-size:11px;margin-top:4px">This takes 60-120 seconds</div></div>`;

  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      await fetch(N8N_WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({property_id:id}),signal:controller.signal});
    }catch(fetchErr){
      console.log("Webhook sent:",fetchErr.message);
    }finally{clearTimeout(timeout);}

    // Wait 90s then poll every 10s
    await new Promise(r=>setTimeout(r,90000));
    let analysis=null;
    for(let i=0;i<12;i++){
      const check=await sb(`underwriting_analyses?property_id=eq.${id}&status=eq.complete&order=created_at.desc&limit=1`);
      if(Array.isArray(check)&&check.length>0&&check[0].profit_target!==null){
        analysis=check[0];break;
      }
      await new Promise(r=>setTimeout(r,10000));
    }
    if(analysis){
      renderAiResult(resultArea,analysis,id);
      analysisMap[id]=analysis;
      btn.textContent="🤖 Re-Analyze with Claude";btn.style.opacity="1";btn.style.background="rgba(34,197,94,0.1)";btn.style.borderColor="rgba(34,197,94,0.3)";btn.style.color="#22c55e";btn.style.pointerEvents="auto";
    }else{
      resultArea.innerHTML=`<div style="margin-top:8px;padding:14px;border-radius:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);text-align:center"><div style="color:#f59e0b;font-size:13px;font-weight:700">⏳ Analysis may still be processing</div><div style="color:#94a3b8;font-size:11px;margin-top:4px">Close and reopen, then click the button again</div></div>`;
      btn.textContent="🤖 AI Underwrite — Claude Analysis";btn.style.opacity="1";btn.style.pointerEvents="auto";
    }
  }catch(e){
    console.error("AI Underwrite error:",e);
    resultArea.innerHTML=`<div style="margin-top:8px;padding:14px;border-radius:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);text-align:center"><div style="color:#ef4444;font-size:13px;font-weight:700">❌ Analysis failed</div><div style="color:#94a3b8;font-size:11px;margin-top:4px">${esc(e.message)}</div></div>`;
    btn.textContent="🤖 AI Underwrite — Retry";btn.style.opacity="1";btn.style.pointerEvents="auto";
  }
}

function renderAiResult(area,a,id){
  const p=props.find(x=>x.id===id)||{};
  const vc=a.verdict==="GO"?"#22c55e":a.verdict==="CONDITIONAL_GO"?"#f59e0b":"#ef4444";
  const vi=a.verdict==="GO"?"✅":a.verdict==="CONDITIONAL_GO"?"⚠️":"🚫";
  const flags=typeof a.deal_flags==="string"?JSON.parse(a.deal_flags||"[]"):a.deal_flags||[];
  const lisa=typeof a.lisa_logic==="string"?JSON.parse(a.lisa_logic||"{}"):a.lisa_logic||{};
  const ci=typeof a.community_intel==="string"?JSON.parse(a.community_intel||"{}"):a.community_intel||{};

  const lisaChecks=Object.entries(lisa).map(([k,v])=>{
    const label=k.replace(/_/g," ").replace(/pass$/,"").toUpperCase().trim();
    return`<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${v?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)"};color:${v?"#22c55e":"#ef4444"};border:1px solid ${v?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}">${v?"✓":"✗"} ${label}</span>`;
  }).join("");

  const flagsHtml=flags.map(f=>`<div style="display:flex;align-items:start;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)"><span style="font-size:12px;flex-shrink:0">${f.type==="red"?"🔴":"🟡"}</span><span style="font-size:11px;color:#e2e8f0">${esc(f.message)}</span></div>`).join("");

  const offerAmt=a.max_offer_price||a.max_offer_raw;
  const tierColor=a.max_offer_tier==="realistic"?"#22c55e":a.max_offer_tier==="aggressive"?"#f59e0b":"#ef4444";
  const tierLabel=a.max_offer_tier==="realistic"?"Realistic":a.max_offer_tier==="aggressive"?"Aggressive — needs motivated seller":a.max_offer_tier==="long_shot"?"Long shot — major price reduction":"";
  const analyzedAt=a.list_price||a.purchase_price||p.list_price||0;

  area.innerHTML=`<div style="margin-top:10px;border-radius:16px;overflow:hidden;border:1px solid ${vc}33;animation:fadeUp .3s ease">
    <div style="padding:16px;background:${vc}08">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div style="font-size:9px;color:${vc};font-weight:800;letter-spacing:3px">CLAUDE AI VERDICT</div>
          <div style="font-size:24px;font-weight:900;color:${vc};margin-top:2px">${vi} ${a.verdict?.replace(/_/g," ")}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#64748b;font-weight:700">RECOMMENDED OFFER</div>
          <div style="font-size:18px;font-weight:800;color:${tierColor}">${$(offerAmt)}</div>
          ${tierLabel?`<div style="font-size:9px;color:${tierColor};font-weight:600;margin-top:1px">${esc(a.max_offer_flag||"")}${tierLabel?" · "+tierLabel:""}</div>`:""}
        </div>
      </div>
      ${analyzedAt?`<div style="margin-top:8px;font-size:10px;color:#64748b">Analyzed at <span style="color:#94a3b8;font-weight:700">${$(analyzedAt)}</span> list price</div>`:""}
      ${a.ai_narrative?`<div style="margin-top:8px;font-size:12px;color:#cbd5e1;line-height:1.6">${esc(a.ai_narrative)}</div>`:""}
      ${a.verdict_reason?`<div style="margin-top:6px;font-size:11px;color:#94a3b8;font-style:italic">${esc(a.verdict_reason)}</div>`:""}
    </div>

    <div style="padding:16px;background:rgba(255,255,255,0.015)">
      <div style="font-size:9px;color:#d4af37;font-weight:700;letter-spacing:2px;margin-bottom:8px">PROFIT PROJECTIONS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="text-align:center;padding:12px 8px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">CONSERVATIVE</div>
          <div style="font-size:8px;color:#64748b">10 months</div>
          <div style="font-size:18px;font-weight:800;color:${a.profit_conservative>=100000?"#22c55e":"#ef4444"};margin-top:4px">${$k(a.profit_conservative)}</div>
          <div style="font-size:10px;color:#94a3b8">${a.roi_conservative?a.roi_conservative.toFixed(1):"?"}% ROI</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px">sell @ ${$k(a.arv_conservative)}</div>
          <div style="font-size:11px;color:#64748b">$${a.arv_ppsf_conservative||Math.round((a.arv_conservative||0)/(p.sqft||1))||"?"}/sf</div>
        </div>
        <div style="text-align:center;padding:12px 8px;border-radius:10px;background:rgba(212,175,55,0.04);border:1px solid rgba(212,175,55,0.15)">
          <div style="font-size:8px;color:#d4af37;font-weight:700;letter-spacing:1px">TARGET</div>
          <div style="font-size:8px;color:#64748b">8 months</div>
          <div style="font-size:18px;font-weight:800;color:${a.profit_target>=150000?"#22c55e":a.profit_target>=100000?"#f59e0b":"#ef4444"};margin-top:4px">${$k(a.profit_target)}</div>
          <div style="font-size:10px;color:#94a3b8">${a.roi_target?a.roi_target.toFixed(1):"?"}% ROI</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px">sell @ ${$k(a.arv_target||a.arv)}</div>
          <div style="font-size:11px;color:#64748b">$${a.arv_ppsf||Math.round((a.arv_target||a.arv||0)/(p.sqft||1))||"?"}/sf</div>
        </div>
        <div style="text-align:center;padding:12px 8px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">STRETCH</div>
          <div style="font-size:8px;color:#64748b">6 months</div>
          <div style="font-size:18px;font-weight:800;color:${a.profit_stretch>=150000?"#22c55e":"#f59e0b"};margin-top:4px">${$k(a.profit_stretch)}</div>
          <div style="font-size:10px;color:#94a3b8">${a.roi_stretch?a.roi_stretch.toFixed(1):"?"}% ROI</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px">sell @ ${$k(a.arv_stretch)}</div>
          <div style="font-size:11px;color:#64748b">$${a.arv_ppsf_stretch||Math.round((a.arv_stretch||0)/(p.sqft||1))||"?"}/sf</div>
        </div>
      </div>
    </div>

    <div style="padding:0 16px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        <div style="text-align:center;padding:10px 8px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">ARV</div>
          <div style="font-size:16px;font-weight:800;color:#22c55e;margin-top:4px">${$k(a.arv)}</div>
          <div style="font-size:11px;color:#94a3b8">$${a.arv_ppsf||"?"}/sf</div>
        </div>
        <div style="text-align:center;padding:10px 8px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">RENO</div>
          <div style="font-size:16px;font-weight:800;color:#f59e0b;margin-top:4px">${$k(a.reno_total)}</div>
          <div style="font-size:9px;color:#94a3b8">${a.reno_tier?.replace(/_/g," ")||"?"}</div>
        </div>
        <div style="text-align:center;padding:10px 8px;border-radius:10px;background:rgba(0,0,0,0.2)">
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px">ALL-IN TO ARV</div>
          <div style="font-size:16px;font-weight:800;color:${a.all_in_pct_of_arv_8mo<=75?"#22c55e":a.all_in_pct_of_arv_8mo<=85?"#f59e0b":"#ef4444"};margin-top:4px">${a.all_in_pct_of_arv_8mo?a.all_in_pct_of_arv_8mo.toFixed(1):"?"}%</div>
          <div style="font-size:9px;color:#94a3b8">8mo target</div>
        </div>
      </div>
    </div>

    <div style="padding:0 16px 16px">
      <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:2px;margin-bottom:6px">LISA LOGIC</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${lisaChecks}</div>
    </div>

    ${ci.matched?`<div style="padding:0 16px 16px"><div style="padding:16px;border-radius:14px;background:rgba(212,175,55,0.03);border:1px solid rgba(212,175,55,0.12)"><div style="font-size:9px;color:#d4af37;font-weight:800;letter-spacing:3px;margin-bottom:10px">COMMUNITY INTEL</div><div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:4px">${esc(ci.community_name||"Unknown")}${(()=>{const tags=[];if(ci.gate_type==="guard_gated")tags.push("Guard-Gated");else if(ci.gate_type==="standard_gated")tags.push("Gated");if(ci.age_restricted)tags.push("55+");if(ci.golf_course)tags.push("Golf");if(ci.community_type==="country_club")tags.push("Country Club");return tags.length?' <span style="font-size:11px;color:#d4af37;font-weight:600">'+tags.join(" · ")+"</span>":"";})()}</div>${ci.village||ci.zip_code?`<div style="font-size:11px;color:#64748b;margin-bottom:12px">${ci.village?"Village: "+esc(ci.village):""}${ci.village&&ci.zip_code?" | ":""}${ci.zip_code?"ZIP: "+ci.zip_code:""}</div>`:""}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px"><div style="text-align:center;padding:10px 4px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><div style="font-size:16px;font-weight:800;color:#e2e8f0">$${ci.avg_ppsf||0}</div><div style="font-size:9px;color:#64748b;font-weight:600;margin-top:2px">avg PPSF</div></div><div style="text-align:center;padding:10px 4px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><div style="font-size:16px;font-weight:800;color:${(ci.avg_dom||0)<=40?"#22c55e":(ci.avg_dom||0)<=60?"#d4af37":"#ef4444"}">${ci.avg_dom||0}</div><div style="font-size:9px;color:#64748b;font-weight:600;margin-top:2px">avg DOM</div></div><div style="text-align:center;padding:10px 4px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><div style="font-size:16px;font-weight:800;color:${(ci.avg_sale_to_list||0)>=97?"#22c55e":(ci.avg_sale_to_list||0)>=95?"#d4af37":"#ef4444"}">${ci.avg_sale_to_list||0}%</div><div style="font-size:9px;color:#64748b;font-weight:600;margin-top:2px">ask rate</div></div><div style="text-align:center;padding:10px 4px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"><div style="font-size:16px;font-weight:800;color:#e2e8f0">${ci.total_sales||0}</div><div style="font-size:9px;color:#64748b;font-weight:600;margin-top:2px">12-mo sales</div></div></div><div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8"><span>PPSF Range: $${ci.floor_ppsf||0} – $${ci.ceiling_ppsf||0}/SF</span><span>90-day: ${ci.recent_90d_sales||0} sales</span></div></div></div>`:""}

    ${flags.length>0?`<div style="padding:0 16px 16px"><div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:2px;margin-bottom:6px">DEAL FLAGS</div><div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.02)">${flagsHtml}</div></div>`:""}

    <div style="padding:0 16px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:11px"><span style="color:#64748b">Monthly Hold:</span> <span style="color:#e2e8f0;font-weight:700">${$(a.hold_cost_monthly)}</span></div>
        <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:11px"><span style="color:#64748b">Cash at Close:</span> <span style="color:#e2e8f0;font-weight:700">${$(a.cash_at_close)}</span></div>
        <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:11px"><span style="color:#64748b">Loan Amount:</span> <span style="color:#e2e8f0;font-weight:700">${$(a.loan_amount)}</span></div>
        <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);font-size:11px"><span style="color:#64748b">Disposition:</span> <span style="color:#e2e8f0;font-weight:700">${$(a.total_disposition_cost)}</span></div>
      </div>
    </div>

    <div style="padding:0 16px 16px;display:flex;gap:8px">
      <button onclick="openCalcFromAi('${id}')" class="btn" style="flex:1;font-size:12px;padding:10px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8">🧮 Tweak in Calculator</button>
      <button onclick="shareAiAnalysis('${id}')" class="btn" style="flex:1;font-size:12px;padding:10px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8">📤 Share Analysis</button>
    </div>

    <div style="padding:0 16px 12px;text-align:center"><span style="font-size:9px;color:#475569">Analyzed by Claude · ${a.created_at?new Date(a.created_at).toLocaleDateString():""}</span></div>
  </div>`;
}

async function openCalcFromAi(id){
  const resultArea=document.getElementById("aiResult_"+id);
  if(resultArea)resultArea.style.display="none";
  // Fetch AI analysis and pre-fill calculator with its values
  try{
    const res=await sb(`underwriting_analyses?property_id=eq.${id}&status=eq.complete&order=created_at.desc&limit=1`);
    if(Array.isArray(res)&&res.length>0){
      const a=res[0];
      calcProp=props.find(x=>x.id===id);if(!calcProp)return;
      const ch=await sb(`calc_history?mls_number=eq.${calcProp.mls_number}&order=created_at.desc`);
      calcHistory=Array.isArray(ch)?ch:[];
      // Map underwriting_analyses fields to calc format
      const aiSaved={
        purchase_price:a.max_offer_price||a.max_offer_raw||a.purchase_price||a.list_price||calcProp.list_price,
        arv:a.arv_target||a.arv||0,
        rehab_budget:a.reno_total||0,
        additional_costs:0,
        ltv:a.ltv_pct||90,
        interest_rate:a.interest_rate||11.49,
        points:0,
        origination:a.origination_pct||1.5,
        closing_buy_flat:5000,
        reno_draw_pct:100,
        hold_months:8,
        tax_annual:a.tax_annual||Math.round((a.purchase_price||calcProp.list_price||900000)*0.007),
        insurance_monthly:Math.round(((a.purchase_price||0)+(a.reno_total||0))*0.0035/12),
        hoa_monthly:a.hoa_monthly||calcProp.hoa_monthly||450,
        utilities_monthly:650,
        buyer_agent_pct:2.5,
        closing_sell_flat:3500,
        staging:5000,
        title_insurance:3000,
        hoa_transfer:500,
        misc_buffer:1500,
        service_fee:1499,
        lisa_commission_pct:2.5,
        created_at:a.created_at
      };
      renderCalc(aiSaved);
      document.getElementById("calcModal").style.display="block";
      document.body.style.overflow="hidden";
      return;
    }
  }catch(e){console.error("AI pre-fill error:",e);}
  // Fallback to normal calc open
  openCalc(id);
}

async function shareAiAnalysis(id){
  const p=props.find(x=>x.id===id);if(!p)return;
  try{
    const res=await sb(`underwriting_analyses?property_id=eq.${id}&order=created_at.desc&limit=1`);
    if(!Array.isArray(res)||!res.length)return;
    const a=res[0];
    const tierTxt=a.max_offer_tier==="realistic"?"Realistic":a.max_offer_tier==="aggressive"?"Aggressive":a.max_offer_tier==="long_shot"?"Long shot":"";
    const txt=`🤖 SOVEREIGN HOUSE AI ANALYSIS\n\n${p.address}, ${p.city} NV ${p.zip_code}\n${$(p.list_price)} · ${p.bedrooms}bd/${p.bathrooms}ba · ${p.sqft?.toLocaleString()}sf\n\nVERDICT: ${a.verdict?.replace(/_/g," ")}\n${a.ai_narrative||""}\n\nARV: ${$(a.arv)} ($${a.arv_ppsf}/sf)\nReno: ${$(a.reno_total)} (${a.reno_tier?.replace(/_/g," ")})\nMax Offer: ${$(a.max_offer_price||a.max_offer_raw)}${a.max_offer_flag?" ("+a.max_offer_flag+")":""}${tierTxt?" — "+tierTxt:""}\n\nProfit (Target/8mo): ${$(a.profit_target)} · ${a.roi_target?.toFixed(1)}% ROI\nProfit (Conservative/10mo): ${$(a.profit_conservative)} · ${a.roi_conservative?.toFixed(1)}% ROI`;
    if(navigator.share){await navigator.share({text:txt}).catch(()=>{});}
    else{await navigator.clipboard.writeText(txt);alert("Analysis copied!");}
  }catch(e){console.error(e);}
}
