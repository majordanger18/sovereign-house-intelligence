// Sovereign House Intelligence — Core & Utilities
const SB="https://jyzxbuzzxdlhnbumfthv.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5enhidXp6eGRsaG5idW1mdGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDc1NDEsImV4cCI6MjA4NTk4MzU0MX0.dzsPjQQEeeyDEYAkIzaWrH0B5vGjuGSkL4MoqPo5MHs";
const HD={apikey:KEY,Authorization:`Bearer ${KEY}`,"Content-Type":"application/json",Prefer:"return=representation"};
// ═══ N8N WEBHOOK — paste your production webhook URL here ═══
const N8N_WEBHOOK="https://majordanger.app.n8n.cloud/webhook/underwrite";
async function sb(ep,opts={}){const r=await fetch(`${SB}/rest/v1/${ep}`,{...opts,headers:{...HD,...opts.headers}});return r.json();}
const $=n=>n!=null?`$${Number(n).toLocaleString()}`:"—";
const $k=n=>n?(n>=1e6?`$${(n/1e6).toFixed(2)}M`:`$${(n/1e3).toFixed(0)}K`):"—";
const sc=s=>s>=60?"#22c55e":s>=40?"#eab308":s>=20?"#f97316":"#64748b";
const esc=s=>(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function truncSub(n){if(!n)return'';let s=n.trim();if(s.toLowerCase()==='none')return'';if(/^summerlin\s+(village|west|south|north|east)/i.test(s))return'';s=s.replace(/\s*-[A-Z]-/g,' ');s=s.replace(/\s+(cntry|country)\s+club.*$/i,'');s=s.replace(/\s+by\s+[\w\s]+$/i,'');s=s.replace(/\s+(at|in|of)\s+(peccole|summerlin|the\s+lakes).*$/i,'');s=s.replace(/\s+summerlin(\s+.*)?$/i,'');s=s.replace(/\s*[-–]?\s*phase\s+.*$/i,'');s=s.replace(/\s+village\s+.*$/i,'');s=s.replace(/\s+parcels?\s+.*$/i,'');s=s.replace(/\s+amd.*$/i,'');s=s.replace(/\s+amended.*$/i,'');s=s.replace(/\s+plat\s+.*$/i,'');s=s.replace(/\s+tract\s+.*$/i,'');s=s.replace(/\s+unit\s+.*$/i,'');s=s.replace(/\s+[A-Z]\s*$/,'');s=s.replace(/\s+(north|south|east|west)\s*$/i,'');s=s.replace(/\s*[-–]+\s*$/,'');s=s.trim();if(s.toLowerCase()==='summerlin'||s==='')return'';return s;}
const KNOWN_GUARD_GATED=["queensridge","corta bella","tournament hills","the ridges","bear's best","bears best","red rock country club","red rock cc","canyon gate","canyon gate country club","spanish trail","calico ridge","eagle hills","anthem country club","anthem cc","macdonald highlands","macdonald ranch","roma hills","lake las vegas","southern highlands golf club","seven hills"];
function checkGuardGated(p){if(p.is_guard_gated)return true;const rem=((p.description||"")+" "+(p.public_remarks||"")+" "+(p.listing_remarks||"")+" "+(p.remarks||"")).toLowerCase();if(rem.includes("guard-gated")||rem.includes("guard gated"))return true;const sub=(p.subdivision_name||"").toLowerCase();return KNOWN_GUARD_GATED.some(g=>sub.includes(g));}

let props=[],watchIds=new Set(),watchMap={},alerts=[],analysisMap={},deals=[],toastDismissed=localStorage.getItem("sh_toast_dismissed")===new Date().toDateString();
window.addEventListener("scroll",()=>{const h=document.getElementById("stickyHeader");if(h){h.classList.toggle("scrolled",window.scrollY>10);}},{passive:true});
const isPend=p=>p.status==="Pending"||p.status==="ActiveUnderContract"||p.listing_status==="Pending"||p.listing_status==="ActiveUnderContract";
let view="all",showPulse=false;

function ring(score,sz=44){
  const r=(sz-6)/2,c=2*Math.PI*r,p=Math.min((score||0)/100,1),col=sc(score);
  return`<div style="position:relative;width:${sz}px;height:${sz}px;flex-shrink:0"><svg width="${sz}" height="${sz}" style="transform:rotate(-90deg)"><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="3"/><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p)}" stroke-linecap="round"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${col}">${score||0}</div></div>`;
}
function tag(t,col="#64748b",ico=""){return`<span class="tag" style="color:${col};background:${col}12">${ico?`<span style="font-size:10px">${ico}</span>`:""}${t}</span>`;}

const GOLF_COMMUNITIES=["red rock country club","tpc summerlin","tournament hills","canyon gate","siena","bears best","bear's best","anthem country club","dragon ridge","southern highlands golf","rio secco","revere golf","chimera golf"];
function isGolf(p){
  const sub=(p.subdivision_name||"").toLowerCase(),desc=(p.description||"").toLowerCase();
  if(GOLF_COMMUNITIES.some(g=>sub.includes(g)||desc.includes(g)))return"community";
  if(desc.match(/golf\s*(course|lot|front|view|fairway)/i)||desc.match(/on\s*the\s*(course|fairway|green)/i)||desc.match(/backs?\s*to\s*(golf|the\s*(course|fairway))/i))return"frontage";
  if(desc.includes("golf"))return"community";
  return false;
}
