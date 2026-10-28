"use strict";
const byId = (id) => document.getElementById(id);
const els = Object.fromEntries(["search","specialty","year","kind","sort","favoritesOnly","updatesOnly","yearWrap","kindWrap","updatesWrap","results","empty","error","resultsTitle","resultsCount","guidelineTotal","societyTotal","curatedDate","auditStatus"].map((id) => [id,byId(id)]));
const state = { view:"guidelines", guidelines:[], societies:[], q:"", specialty:"", year:"", kind:"", sort:"newest", favoritesOnly:false, updatesOnly:false, favorites:new Set(), audits:null, lastCurated:"" };
const safeStore = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } },
  set(key,val) { try { localStorage.setItem(key,JSON.stringify(val)); } catch {} }
};
function loadSaved() {
  const v2=safeStore.get("clinical-atlas-favorites-v2");
  if(Array.isArray(v2)) return new Set(v2);
  const prior=safeStore.get("bleb-favorites");
  if(Array.isArray(prior)) return new Set(prior);
  return new Set();
}
state.favorites=loadSaved();
function dateLabel(iso) {
  if(!iso) return "Unspecified";
  const dt=new Date(iso+"T12:00:00Z");
  return Number.isNaN(dt.getTime())?iso:dt.toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"});
}
function updateUrl() {
  const url=new URL(location.href);
  for(const key of ["view","q","specialty","year","kind"]) url.searchParams.delete(key);
  if(state.view!=="guidelines") url.searchParams.set("view",state.view);
  if(state.q.trim()) url.searchParams.set("q",state.q.trim());
  if(state.specialty) url.searchParams.set("specialty",state.specialty);
  if(state.year) url.searchParams.set("year",state.year);
  if(state.kind) url.searchParams.set("kind",state.kind);
  history.replaceState(null,"",url.pathname+(url.search||"")+url.hash);
}
function restoreUrl() {
  const p=new URLSearchParams(location.search);
  state.view=p.get("view")==="societies"?"societies":"guidelines";
  state.q=p.get("q")||"";
  state.specialty=p.get("specialty")||"";
  state.year=p.get("year")||"";
  state.kind=p.get("kind")||"";
}
function make(tag,cls,content) {
  const node=document.createElement(tag);
  if(cls) node.className=cls;
  if(content!==undefined) node.textContent=String(content);
  return node;
}
function options(el,first,values) {
  const previous=el.value;
  el.replaceChildren(new Option(first,""));
  for(const value of values) el.add(new Option(String(value),String(value)));
  el.value=values.map(String).includes(String(previous))?previous:"";
}
function rebuildOptions() {
  const items=state.view==="guidelines"?state.guidelines:state.societies;
  const specialties=[...new Set(items.map(x=>x.specialty))].sort((a,b)=>a.localeCompare(b));
  options(els.specialty,"All specialties",specialties);
  if(state.specialty && specialties.includes(state.specialty)) els.specialty.value=state.specialty;
  else state.specialty=els.specialty.value;
  const years=[...new Set(state.guidelines.map(x=>x.year))].sort((a,b)=>b-a);
  options(els.year,"Any year",years);
  if(years.map(String).includes(state.year)) els.year.value=state.year;
  else state.year="";
  const kinds=[...new Set(state.guidelines.map(x=>x.kind))].sort((a,b)=>a.localeCompare(b));
  options(els.kind,"All types",kinds);
  if(kinds.includes(state.kind)) els.kind.value=state.kind;
  else state.kind="";
  els.yearWrap.hidden=state.view!=="guidelines";
  els.kindWrap.hidden=state.view!=="guidelines";
  els.updatesWrap.hidden=state.view!=="guidelines";
  els.resultsTitle.textContent=state.view==="guidelines"?"Individual guidelines":"Publisher libraries";
  for(const tab of document.querySelectorAll(".tab")) {
    const active=tab.dataset.view===state.view;
    tab.classList.toggle("active",active);
    tab.setAttribute("aria-selected",String(active));
  }
}
function matched(items) {
  const query=state.q.toLocaleLowerCase().trim();
  let rows=items.filter(x=>{
    if(state.specialty && x.specialty!==state.specialty) return false;
    if(state.view==="guidelines" && state.year && String(x.year)!==state.year) return false;
    if(state.view==="guidelines" && state.kind && x.kind!==state.kind) return false;
    if(state.view==="guidelines" && state.updatesOnly && !x.reviewFlag) return false;
    if(state.favoritesOnly && !state.favorites.has(x.id) && !state.favorites.has(x.url)) return false;
    if(query && ![x.title,x.name,x.topic,x.specialty,x.organization,x.kind,x.population,x.note,x.year].join(" ").toLocaleLowerCase().includes(query)) return false;
    return true;
  });
  rows.sort((a,b)=>{
    if(state.sort==="specialty") return a.specialty.localeCompare(b.specialty)||(a.title||a.name).localeCompare(b.title||b.name);
    if(state.sort==="title") return (a.title||a.name).localeCompare(b.title||b.name);
    return (Number(b.year)||0)-(Number(a.year)||0)||(a.title||a.name).localeCompare(b.title||b.name);
  });
  return rows;
}
function auditLabel(id) {
  const a=state.audits?.results?.[id];
  if(!a) return "";
  if(a.status==="reachable") return "Automated link check: reachable";
  if(a.status==="blocked") return "Automated check restricted by publisher";
  if(a.status==="possible-broken") return "Automated check: link needs review";
  return "Automated link check inconclusive";
}
function descriptionFor(item) {
  if(state.view==="societies") return "Official specialty society reference library. Browse published documents and updates at the source.";
  return item.note||"Official guideline resource.";
}
function announce(message) {
  const node=byId("announcement");
  node.textContent=message;
}
function copyCitation(item,button) {
  const citation=state.view==="societies"?(item.name+" — "+item.url):(item.organization+". "+item.title+" ("+item.year+"). "+item.url);
  const after=()=>{ announce("Reference copied"); button.textContent="✓"; setTimeout(()=>{button.textContent="⧉";},1600); };
  if(navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(citation).then(after).catch(()=>fallbackCopy(citation,after));
  } else fallbackCopy(citation,after);
}
function fallbackCopy(text,done) {
  const field=make("textarea");
  field.value=text;field.style.position="fixed";field.style.left="-9999px";
  document.body.append(field);field.select();
  try{if(document.execCommand("copy")) done();else announce("Copy unavailable in this browser");}
  catch{announce("Copy unavailable in this browser");}
  field.remove();
}
function cardFor(item) {
  const card=make("article","result-card");
  const top=make("div","card-top");
  top.append(make("span","specialty",item.specialty));
  if(state.view==="guidelines") top.append(make("span","year",item.year));
  card.append(top);
  const h=make("h3","",item.title||item.name);
  card.append(h);
  const publisher=state.view==="guidelines"?(item.organization+" · "+item.kind+" · "+item.population):item.kind;
  card.append(make("div","meta",publisher));
  card.append(make("p","description",descriptionFor(item)));
  if(item.reviewFlag) {
    const notes={
      "draft-update":"Publisher reports a replacement draft in development.",
      "focused-update-draft":"Publisher lists a focused update draft for review.",
      "focused-update":"Publisher lists a related focused update."
    };
    card.append(make("div","review-note",notes[item.reviewFlag]||"Check publisher updates."));
  }
  const aLabel=auditLabel(item.id);
  if(aLabel)card.append(make("div","meta",aLabel));
  const bottom=make("div","card-bottom");
  const link=make("a","primary-link","Open official source ↗");
  link.href=item.url;link.target="_blank";link.rel="noopener noreferrer";
  bottom.append(link);
  const tools=make("div","tools");
  const copy=make("button","icon-button copy","⧉");
  copy.type="button";copy.title="Copy citation and link";copy.setAttribute("aria-label","Copy citation and source link");
  copy.addEventListener("click",()=>copyCitation(item,copy));
  const star=make("button","icon-button","☆");
  star.type="button";star.title="Save or unsave this reference";
  const paint=()=>{
    const saved=state.favorites.has(item.id)||state.favorites.has(item.url);
    star.textContent=saved?"★":"☆";
    star.setAttribute("aria-pressed",String(saved));
    star.setAttribute("aria-label",saved?"Remove saved reference":"Save reference");
  };
  paint();
  star.addEventListener("click",()=>{
    if(state.favorites.has(item.id)||state.favorites.has(item.url)){
      state.favorites.delete(item.id);state.favorites.delete(item.url);
      announce("Reference removed from saved");
    }else{state.favorites.add(item.id);announce("Reference saved");}
    safeStore.set("clinical-atlas-favorites-v2",[...state.favorites]);
    render();
  });
  tools.append(copy,star);bottom.append(tools);card.append(bottom);
  return card;
}
function render() {
  const rows=matched(state.view==="guidelines"?state.guidelines:state.societies);
  const fragment=document.createDocumentFragment();
  rows.forEach(x=>fragment.append(cardFor(x)));
  els.results.replaceChildren(fragment);
  els.resultsCount.textContent=rows.length+" of "+(state.view==="guidelines"?state.guidelines.length:state.societies.length)+" references";
  els.empty.hidden=rows.length>0;
  updateUrl();
}
function setView(view) {
  if(view===state.view)return;
  state.view=view;state.specialty="";state.year="";state.kind="";state.updatesOnly=false;
  els.updatesOnly.checked=false;
  rebuildOptions();render();
}
function reset() {
  state.q="";state.specialty="";state.year="";state.kind="";state.favoritesOnly=false;state.updatesOnly=false;state.sort="newest";
  els.search.value="";els.favoritesOnly.checked=false;els.updatesOnly.checked=false;els.sort.value="newest";
  rebuildOptions();render();
}
function exportCsv() {
  const rows=matched(state.view==="guidelines"?state.guidelines:state.societies);
  const fields=state.view==="guidelines"?["title","year","organization","specialty","topic","kind","population","url","note","verifiedAt","reviewFlag"]:["name","specialty","url","kind"];
  const quote=(v)=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const csv=[fields.join(","),...rows.map(r=>fields.map(f=>quote(r[f])).join(","))].join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=make("a");link.href=url;link.download=state.view+"-clinical-guideline-atlas.csv";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);announce("CSV downloaded");
}
async function start() {
  const live=make("div");
  live.id="announcement";live.className="sr-only";live.setAttribute("aria-live","polite");document.body.append(live);
  restoreUrl();
  els.search.value=state.q;
  for(const btn of document.querySelectorAll(".tab"))btn.addEventListener("click",()=>setView(btn.dataset.view));
  byId("filterForm").addEventListener("submit",e=>e.preventDefault());
  els.search.addEventListener("input",e=>{state.q=e.target.value;render();});
  els.specialty.addEventListener("change",e=>{state.specialty=e.target.value;render();});
  els.year.addEventListener("change",e=>{state.year=e.target.value;render();});
  els.kind.addEventListener("change",e=>{state.kind=e.target.value;render();});
  els.sort.addEventListener("change",e=>{state.sort=e.target.value;render();});
  els.favoritesOnly.addEventListener("change",e=>{state.favoritesOnly=e.target.checked;render();});
  els.updatesOnly.addEventListener("change",e=>{state.updatesOnly=e.target.checked;render();});
  byId("clearBtn").addEventListener("click",reset);
  byId("emptyClear").addEventListener("click",reset);
  byId("exportBtn").addEventListener("click",exportCsv);
  try{
    const [g,s]=await Promise.all(["./data/guidelines.json","./data/societies.json"].map(async url=>{
      const resp=await fetch(url,{cache:"no-cache"});
      if(!resp.ok) throw new Error("Failed to load "+url);
      return resp.json();
    }));
    state.guidelines=g.items;state.societies=s.items;state.lastCurated=g.lastCurated;
    els.guidelineTotal.textContent=String(g.items.length);
    els.societyTotal.textContent=String(s.items.length);
    els.curatedDate.textContent=dateLabel(g.lastCurated);
    rebuildOptions();render();
    try{
      const a=await fetch("./data/link-status.json",{cache:"no-cache"});
      if(a.ok){
        state.audits=await a.json();
        const dt=state.audits.checkedAt?state.audits.checkedAt.slice(0,10):"";
        els.auditStatus.textContent="Automated link audit: "+dt;
        render();
      }
    }catch{}
  }catch(error){
    els.error.hidden=false;
    els.resultsCount.textContent="Unable to load reference data";
    els.results.replaceChildren();
    console.error("Clinical atlas catalog error",error);
  }
}
document.addEventListener("DOMContentLoaded",start);
