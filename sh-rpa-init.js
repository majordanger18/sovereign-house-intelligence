// Sovereign House Intelligence — RPA Builder & Init
// ═══ RPA BUILDER BRIDGE ═══
function openRPABuilder(id){
  const p=props.find(x=>x.id===id);if(!p)return;
  const oPrice=Number(document.getElementById("o_price")?.value)||0;
  const emd=Number(document.getElementById("o_emd")?.value)||10000;
  const coeDays=Number(document.getElementById("o_coe")?.value)||30;
  const inspDays=Number(document.getElementById("o_inspect")?.value)||10;
  const financeDays=Number(document.getElementById("o_finance")?.value)||21;
  const possession=document.getElementById("o_possession")?.value||"close_of_escrow";
  const terms=document.getElementById("o_terms")?.value||"";
  const agentName=document.getElementById("o_agentname")?.value||"";
  const agentEmail=document.getElementById("o_agentemail")?.value||"";
  const agentPhone=document.getElementById("o_agentphone")?.value||"";
  const agentBrokerage=document.getElementById("o_agentbrokerage")?.value||"";

  // Convert COE days to actual date
  const coeDate=new Date();coeDate.setDate(coeDate.getDate()+coeDays);
  const coeDateStr=(coeDate.getMonth()+1)+"/"+coeDate.getDate()+"/"+coeDate.getFullYear();

  // Response deadline = 3 business days from now
  const respDate=new Date();respDate.setDate(respDate.getDate()+3);
  const respStr=(respDate.getMonth()+1)+"/"+respDate.getDate()+"/"+respDate.getFullYear();

  const rpaData={
    property_address:p.address+", "+p.city+", NV "+p.zip_code,
    city:p.city||"Las Vegas",
    county:"CLARK",
    zip_code:p.zip_code||"",
    apn:p.parcel_number||p.apn||"",
    mls_number:p.mls_number||"",
    list_office_name:p.listing_office||p.list_office_name||"",
    purchase_price:String(oPrice),
    offer_date:new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}),
    buyer_name:"Sovereign House LLC",
    occupy:false,
    emd_amount:String(emd),
    emd_type:"wire",
    emd_deposit_days:"1",
    emd_account:"escrow",
    loan_type:"other",
    loan_other_specify:"HARD MONEY LOAN",
    loan_amount:String(oPrice),
    balance_down_payment:String(Math.round(oPrice*0.10)),
    buyer_broker_pct:"0",
    loan_app_days:"5",
    appraisal_days:"21",
    loan_contingency_days:String(financeDays),
    escrow_company:"Nevada Title Company",
    coe_date:coeDateStr,
    due_diligence:true,
    due_diligence_days:String(inspDays),
    walkthrough_days:"5",
    hpp:"waive",
    possession:possession==="close_of_escrow"?"coe":"other",
    buyer_initials:"",
    additional_terms:terms||"Property to be sold in AS-IS condition. Buyer to conduct informational inspections only.\nNo repair requests will be made by Buyer.\nBuyer is a licensed Nevada real estate entity. Lisa A. Hunt, Managing Partner, is the Buyer's authorized representative and licensed Nevada Realtor (Simply Vegas).\nBuyer intends to renovate and resell the property (investment purchase).",
    addenda_line1:"",
    respond_by_date:respStr,
    respond_by_time:"6:00 PM",
    listing_agent_name:agentName,
    listing_company:agentBrokerage,
    listing_broker_name:agentBrokerage,
    listing_agent_phone:agentPhone,
    listing_agent_email:agentEmail,
    list_agent_license:p.list_agent_license||"",
    list_broker_license:p.list_broker_license||"",
    list_office_address:p.list_office_address||"",
    list_office_city_state_zip:p.list_office_city_state_zip||"",
    list_office_phone:p.list_office_phone||"",
    list_office_fax:p.list_office_fax||"",
    licensee_interest:true,
    licensee_relationship:"LISA HUNT IS A MEMBER OF SOVEREIGN HOUSE LLC",
  };
  const encoded=encodeURIComponent(JSON.stringify(rpaData));
  window.open("offer-builder.html?prefill="+encoded,"_blank");
}

function openRPAFromDeal(dealId){
  const d=deals.find(x=>x.id===dealId);if(!d)return;
  // Look up the original property to get parcel_number (deals don't store it)
  const prop=props.find(x=>x.id===d.property_id);
  const oPrice=d.accepted_price||d.offer_price||0;
  const emd=d.emd_amount||Math.round(oPrice*0.01);
  const coeDays=d.close_of_escrow_days||30;
  const inspDays=d.inspection_days||10;
  const financeDays=d.financing_contingency_days||21;
  const coeDate=new Date();coeDate.setDate(coeDate.getDate()+coeDays);
  const coeDateStr=(coeDate.getMonth()+1)+"/"+coeDate.getDate()+"/"+coeDate.getFullYear();
  const respDate=new Date();respDate.setDate(respDate.getDate()+3);
  const respStr=(respDate.getMonth()+1)+"/"+respDate.getDate()+"/"+respDate.getFullYear();

  const rpaData={
    property_address:(d.address||"")+", "+(d.city||"Las Vegas")+", NV "+(d.zip_code||""),
    city:d.city||"Las Vegas", county:"CLARK", zip_code:d.zip_code||"", apn:prop?.parcel_number||d.parcel_number||d.apn||"",
    mls_number:d.mls_number||prop?.mls_number||"",
    list_office_name:d.listing_agent_brokerage||prop?.listing_office||"",
    purchase_price:String(oPrice),
    offer_date:new Date().toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}),
    buyer_name:"Sovereign House LLC", occupy:false,
    emd_amount:String(emd), emd_type:"wire", emd_deposit_days:"1", emd_account:"escrow",
    loan_type:"other", loan_other_specify:"HARD MONEY LOAN",
    loan_amount:String(oPrice), balance_down_payment:String(Math.round(oPrice*0.10)),
    buyer_broker_pct:"0", loan_app_days:"5", appraisal_days:"21",
    loan_contingency_days:String(financeDays),
    escrow_company:"Nevada Title Company", coe_date:coeDateStr,
    due_diligence:true, due_diligence_days:String(inspDays),
    walkthrough_days:"5", hpp:"waive",
    possession:d.possession==="seller_rentback"?"other":"coe",
    buyer_initials:"",
    additional_terms:d.special_terms||"Property to be sold in AS-IS condition. Buyer to conduct informational inspections only.\nNo repair requests will be made by Buyer.\nBuyer is a licensed Nevada real estate entity. Lisa A. Hunt, Managing Partner, is the Buyer's authorized representative and licensed Nevada Realtor (Simply Vegas).\nBuyer intends to renovate and resell the property (investment purchase).",
    addenda_line1:"",
    respond_by_date:respStr, respond_by_time:"6:00 PM",
    listing_agent_name:d.listing_agent_name||prop?.list_agent_name||"",
    listing_company:d.listing_agent_brokerage||"",
    listing_broker_name:d.listing_agent_brokerage||"",
    listing_agent_phone:d.listing_agent_phone||prop?.list_agent_phone||"",
    listing_agent_email:d.listing_agent_email||prop?.list_agent_email||"",
    list_agent_license:d.list_agent_license||prop?.list_agent_license||"",
    list_broker_license:d.list_broker_license||prop?.list_broker_license||"",
    list_office_address:d.list_office_address||prop?.list_office_address||"",
    list_office_city_state_zip:d.list_office_city_state_zip||prop?.list_office_city_state_zip||"",
    list_office_phone:d.list_office_phone||prop?.list_office_phone||"",
    list_office_fax:d.list_office_fax||prop?.list_office_fax||"",
    licensee_interest:true, licensee_relationship:"LISA HUNT IS A MEMBER OF SOVEREIGN HOUSE LLC",
  };
  const encoded=encodeURIComponent(JSON.stringify(rpaData));
  window.open("offer-builder.html?prefill="+encoded,"_blank");
}

// ═══ MAGIC LINK SUPPORT ═══
function checkMagicLink(){
  const params=new URLSearchParams(window.location.search);
  if(!params.has("addr"))return;
  const ml={
    address:params.get("addr")||"",
    arv:Number(params.get("arv"))||0,
    purchase_price:Number(params.get("pur"))||0,
    rehab_budget:Number(params.get("rehab"))||0,
    additional_costs:Number(params.get("addl"))||0,
    ltv:Number(params.get("ltv"))||90,
    interest_rate:Number(params.get("rate"))||11.49,
    points:Number(params.get("pts"))||0,
    origination:Number(params.get("orig"))||1.5,
    closing_buy_flat:Number(params.get("closebuy"))||5000,
    reno_draw_pct:Number(params.get("drawpct"))||100,
    hold_months:Number(params.get("hold"))||8,
    tax_annual:Number(params.get("tax"))||0,
    insurance_monthly:Number(params.get("ins"))||250,
    hoa_monthly:Number(params.get("hoa"))||450,
    utilities_monthly:Number(params.get("util"))||650,
    buyer_agent_pct:Number(params.get("bagent"))||2.5,
    closing_sell_flat:Number(params.get("closesell"))||3500,
    staging:Number(params.get("staging"))||5000,
    title_insurance:Number(params.get("title"))||2000,
    hoa_transfer:Number(params.get("hoaxfer"))||500,
    misc_buffer:Number(params.get("misc"))||1500
  };
  const addr=ml.address.toLowerCase().split(",")[0].trim();
  const match=props.find(p=>(p.address||"").toLowerCase().includes(addr));
  if(match){
    calcProp=match;calcHistory=[];
    renderCalc(ml);
    document.getElementById("calcModal").style.display="block";
    document.body.style.overflow="hidden";
  } else {
    alert("Property not found in dashboard: "+ml.address+"\nMake sure it exists in your MLS feed.");
  }
  window.history.replaceState({},"",window.location.pathname);
}

loadData().then(()=>{setTimeout(checkMagicLink,800);});
