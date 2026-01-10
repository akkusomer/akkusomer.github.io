import {
  db,
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp
} from "./firebase.js";

const $ = (s) => document.querySelector(s);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");

const trLower = (s) => String(s ?? "").toLocaleLowerCase("tr-TR").trim();

function normalizeKey(s){
  return String(s||"")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s\-_]+/g,"");
}

/* Toast */
const toastEl = $("#toast");
const toast = (t) => {
  if (!toastEl) return;
  toastEl.textContent = t;
  toastEl.classList.add("show");
  clearTimeout(toast.__t);
  toast.__t = setTimeout(() => toastEl.classList.remove("show"), 1100);
};

/* Drawer */
const drawer = $("#drawer");
const overlay = $("#drawerOverlay");
const openBtn = $("#openListBtn");
const closeBtn = $("#closeListBtn");

function openDrawer(){
  drawer?.classList.add("open");
  overlay?.classList.add("open");
  drawer?.setAttribute("aria-hidden","false");
  overlay?.setAttribute("aria-hidden","false");
  setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 60);
}
function closeDrawer(){
  drawer?.classList.remove("open");
  overlay?.classList.remove("open");
  drawer?.setAttribute("aria-hidden","true");
  overlay?.setAttribute("aria-hidden","true");
  setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 60);
}

openBtn?.addEventListener("click", () => {
  if (drawer?.classList.contains("open")) closeDrawer();
  else openDrawer();
});
closeBtn?.addEventListener("click", closeDrawer);
overlay?.addEventListener("click", closeDrawer);

/* Search */
const qEl = $("#q");
const clearBtn = $("#clearBtn");
const closeSearchBtn = $("#closeSearchBtn");
const searchBox = $("#searchBox");
const searchToggleBtn = $("#searchToggleBtn");

function syncClearBtn(){
  if (!qEl || !clearBtn) return;
  clearBtn.style.display = qEl.value.trim().length ? "inline-flex" : "none";
}
function openSearch(){
  searchBox?.classList.remove("closed");
  searchBox?.setAttribute("aria-hidden","false");
  if (searchToggleBtn) searchToggleBtn.style.display = "none";
  setTimeout(()=> qEl?.focus(), 0);
}
function closeSearch(){
  if (qEl) qEl.value = "";
  syncClearBtn();
  filterAndRender();
  searchBox?.classList.add("closed");
  searchBox?.setAttribute("aria-hidden","true");
  if (searchToggleBtn) searchToggleBtn.style.display = "inline-flex";
}
searchToggleBtn?.addEventListener("click", () => {
  if (!searchBox) return;
  const closed = searchBox.classList.contains("closed");
  if (closed) openSearch();
  else closeSearch();
});
qEl?.addEventListener("input", () => { syncClearBtn(); filterAndRender(); });
clearBtn?.addEventListener("click", () => {
  if (!qEl) return;
  qEl.value = "";
  syncClearBtn();
  filterAndRender();
  qEl.focus();
});
closeSearchBtn?.addEventListener("click", closeSearch);
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && searchBox && !searchBox.classList.contains("closed")) closeSearch();
});

/* Program settings */
let programSettings = [];
const settingsRef = doc(db, "ayarlar", "programlar");

/* Filter state */
const filterRow = $("#filterRow");
const filterCount = $("#filterCount");
const listCount = $("#count");
let filterMode = "all"; // all | active | unused | unknown | prog:<key>

/* Hal sınırı */
const HAL_BOUNDARY = [
  [36.925717, 30.743771],
  [36.925020, 30.738135],
  [36.922557, 30.738725],
  [36.921024, 30.739153],
  [36.920119, 30.739401],
  [36.918652, 30.740409],
  [36.918163, 30.740827],
  [36.918060, 30.741257],
  [36.919150, 30.743628],
  [36.921672, 30.746337]
];

function boundsFrom(coords){
  const lats = coords.map(c=>c[0]);
  const lngs = coords.map(c=>c[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];
}
const [minB, maxB] = boundsFrom(HAL_BOUNDARY);
const center = [(minB[0]+maxB[0])/2, (minB[1]+maxB[1])/2];

/* Map init */
const map = L.map("map", {
  center,
  zoom: 16,
  minZoom: 15,
  maxZoom: 22,
  preferCanvas: true,
  renderer: L.canvas({ padding: 0.5 }),
  maxBounds: [minB, maxB],
  maxBoundsViscosity: 1.0
});

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom:22, maxNativeZoom:19, attribution:"&copy; Esri" }
).addTo(map);

const boundary = L.polygon(HAL_BOUNDARY, {
  color:"#ef4444",
  weight:4,
  fillOpacity:0,
  interactive:false,
  className:"boundary-polygon"
}).addTo(map);
boundary.bringToFront();

map.fitBounds(L.polygon(HAL_BOUNDARY).getBounds(), { padding:[20,20], maxZoom:17 });
setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 250);

/* Layers */
const layers = new Map(); // id -> { polygon?, marker?, label?, __visible }
let allShops = [];

/* label zoom kontrol */
const LABEL_MIN_ZOOM = 19;
function syncLabels(){
  const show = map.getZoom() >= LABEL_MIN_ZOOM;
  layers.forEach((l)=>{
    if (!l.label) return;
    if (!l.__visible) {
      if (map.hasLayer(l.label)) map.removeLayer(l.label);
      return;
    }
    if (show) {
      if (!map.hasLayer(l.label)) l.label.addTo(map);
    } else {
      if (map.hasLayer(l.label)) map.removeLayer(l.label);
    }
  });
}
map.on("zoomend", syncLabels);
map.on("moveend", syncLabels);

function getProgramColor(program){
  const p = String(program || "").trim();
  if (!p) return null;
  const key = normalizeKey(p);
  const found =
    programSettings.find(x => normalizeKey(x.value) === key) ||
    programSettings.find(x => normalizeKey(x.label) === key);
  return found?.color ? String(found.color).trim() : null;
}

function colorOf(s){
  const p = String(s.program || "").trim();
  if (s.kullanilmiyor || !p) return "#fbbf24";
  if (p.toLowerCase() === "atlas") return "#10b981";
  return getProgramColor(p) || "#ef4444";
}

function programLabel(s){
  const p = String(s.program || "").trim();
  if (!p) return "Bilinmiyor";
  const key = normalizeKey(p);
  const unknownKeys = new Set(["bilinmiyor","bilinmeyen","unknown","-","null","none"]);
  if (unknownKeys.has(key)) return "Bilinmiyor";
  const found =
    programSettings.find(x => normalizeKey(x.value) === key) ||
    programSettings.find(x => normalizeKey(x.label) === key);
  return found?.label || p;
}

function isActiveShop(s){ return !s.kullanilmiyor && !!String(s.program||"").trim(); }
function isUnusedShop(s){ return !!s.kullanilmiyor; }
function isUnknownShop(s){
  const prog = String(s.program || "").trim();
  const key = normalizeKey(prog);
  const unknownKeys = new Set(["bilinmiyor","bilinmeyen","unknown","-","null","none"]);
  return !s.kullanilmiyor && (!prog || unknownKeys.has(key));
}

function normalizePolygon(raw){
  if (!Array.isArray(raw)) return [];
  return raw
    .map(p=>{
      if (Array.isArray(p) && p.length===2) return [Number(p[0]), Number(p[1])];
      if (p && typeof p==="object" && typeof p.lat==="number" && typeof p.lng==="number") return [p.lat, p.lng];
      return null;
    })
    .filter(Boolean);
}

function labelIcon(no){
  const n = esc(no ?? "");
  return L.divIcon({
    className:"polyLabel",
    html:`<div class="polyLabelInner">${n}</div>`,
    iconSize:[0,0],
    iconAnchor:[0,0]
  });
}

function clearLayer(id){
  const l = layers.get(id);
  if (!l) return;
  try{ if (l.polygon) map.removeLayer(l.polygon); }catch(e){}
  try{ if (l.marker) map.removeLayer(l.marker); }catch(e){}
  try{ if (l.label) map.removeLayer(l.label); }catch(e){}
  layers.delete(id);
}

function upsertShop(s){
  clearLayer(s.id);

  const poly = normalizePolygon(s.polygonCoords);
  const color = colorOf(s);

  // Polygon varsa polygon + label
  if (poly.length >= 3){
    // center
    let center = Array.isArray(s.coords) && s.coords.length===2 ? s.coords : null;
    if (!center){
      const lats = poly.map(p=>p[0]);
      const lngs = poly.map(p=>p[1]);
      center = [(Math.min(...lats)+Math.max(...lats))/2, (Math.min(...lngs)+Math.max(...lngs))/2];
    }

    const polygon = L.polygon(poly, {
      color,
      fillColor:color,
      fillOpacity:0.35,
      weight:2,
      className:`shop-polygon ${s.kullanilmiyor ? "kullanilmiyor" : (String(s.program||"").trim().toLowerCase()==="atlas" ? "atlas" : "")}`
    }).addTo(map);

    const label = L.marker(center, { icon: labelIcon(s.no) });

    const lObj = { polygon, label, __visible:true };
    layers.set(s.id, lObj);

    polygon.on("click", ()=>{
      toast(`${s.name || "Dükkan"} • No: ${s.no || "-"} • ${programLabel(s)}`);
    });

    syncLabels();
    return;
  }

  // Marker (nokta)
  if (!Array.isArray(s.coords) || s.coords.length !== 2) return;

  const marker = L.circleMarker(s.coords, {
    radius:8,
    color:"#ffffff",
    weight:2,
    fillColor:color,
    fillOpacity:0.95
  }).addTo(map);

  marker.on("click", ()=>{
    toast(`${s.name || "Dükkan"} • No: ${s.no || "-"} • ${programLabel(s)}`);
  });

  layers.set(s.id, { marker, __visible:true });
}

/* ===== Filters UI ===== */
function buildChips(){
  if (!filterRow) return;
  filterRow.innerHTML = "";

  const chips = [];
  chips.push({ id:"all", label:"Tümü", dot:"#60a5fa" });
  chips.push({ id:"active", label:"Kullanılan", dot:"#10b981" });
  chips.push({ id:"unused", label:"Kullanılmayan", dot:"#fbbf24" });
  chips.push({ id:"unknown", label:"Bilinmiyor", dot:"#ef4444" });
  chips.push({ id:"prog:atlas", label:"Atlas", dot:"#10b981" });

  // programSettings’ten diğerleri
  (programSettings || []).forEach(p=>{
    const v = String(p?.value||"").trim();
    if (!v || v.toLowerCase()==="atlas" || v==="diger") return;
    chips.push({ id:`prog:${normalizeKey(v)}`, label:p.label || v, dot:(p.color||"#ef4444") });
  });

  chips.forEach(c=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip ${filterMode===c.id ? "active":""}`;
    btn.dataset.id = c.id;
    btn.innerHTML = `<span class="cdot" style="background:${c.dot}"></span>${esc(c.label)}`;
    btn.addEventListener("click", ()=>{
      filterMode = c.id;
      buildChips();
      filterAndRender();
    });
    filterRow.appendChild(btn);
  });
}

function matchesFilter(s){
  if (filterMode==="all") return true;
  if (filterMode==="active") return isActiveShop(s);
  if (filterMode==="unused") return isUnusedShop(s);
  if (filterMode==="unknown") return isUnknownShop(s);

  if (filterMode.startsWith("prog:")){
    const key = filterMode.slice(5);
    const prog = String(s.program||"").trim();
    if (!prog) return false;
    if (key==="atlas") return prog.toLowerCase()==="atlas";
    return normalizeKey(prog) === key || normalizeKey(programLabel(s)) === key;
  }
  return true;
}

function matchesQuery(s, q){
  if (!q) return true;
  const qq = trLower(q);
  const name = trLower(s.name);
  const no = trLower(s.no);
  const vergi = trLower(s.vergiNo);
  const tel = trLower(s.telefon);
  return name.includes(qq) || no.includes(qq) || vergi.includes(qq) || tel.includes(qq);
}

const listEl = $("#list");
function renderList(items){
  if (!listEl) return;
  listEl.innerHTML = "";
  items.forEach(s=>{
    const color = colorOf(s);
    const pLabel = programLabel(s);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="name">${esc(s.name || "Dükkan")}</div>
      <div class="sub">
        <span class="badge"><span class="dot" style="background:${color}"></span>${esc(pLabel)}</span>
        <span class="badge">No: ${esc(s.no || "-")}</span>
      </div>
    `;
    div.addEventListener("click", ()=>{
      closeDrawer();
      // zoom
      const poly = normalizePolygon(s.polygonCoords);
      if (poly.length>=3){
        const b = L.polygon(poly).getBounds();
        map.fitBounds(b, { padding:[30,30], maxZoom:20 });
      } else if (Array.isArray(s.coords) && s.coords.length===2){
        map.setView(s.coords, Math.max(map.getZoom(), 19), { animate:true });
      }
    });
    listEl.appendChild(div);
  });
}

function filterAndRender(){
  const queryTxt = qEl?.value?.trim() || "";
  const filtered = allShops.filter(s => matchesFilter(s) && matchesQuery(s, queryTxt));

  // layers visibility
  const visibleIds = new Set(filtered.map(x=>x.id));
  layers.forEach((l, id)=>{
    l.__visible = visibleIds.has(id);
    if (l.polygon) {
      if (l.__visible && !map.hasLayer(l.polygon)) l.polygon.addTo(map);
      if (!l.__visible && map.hasLayer(l.polygon)) map.removeLayer(l.polygon);
    }
    if (l.marker) {
      if (l.__visible && !map.hasLayer(l.marker)) l.marker.addTo(map);
      if (!l.__visible && map.hasLayer(l.marker)) map.removeLayer(l.marker);
    }
    if (l.label) {
      if (!l.__visible && map.hasLayer(l.label)) map.removeLayer(l.label);
    }
  });

  syncLabels();

  if (filterCount) filterCount.textContent = String(filtered.length);
  if (listCount) listCount.textContent = String(filtered.length);
  renderList(filtered);
}

/* ===== Firestore streams ===== */
onSnapshot(settingsRef, (snap)=>{
  const data = snap.exists() ? (snap.data()||{}) : {};
  programSettings = Array.isArray(data.programlar) ? data.programlar : [];
  buildChips();
  filterAndRender();
});

const shopsRef = collection(db, "dukkanlar");
const shopsQ = query(shopsRef, orderBy("no"));

onSnapshot(shopsQ, (snap)=>{
  const next = [];
  snap.forEach(d=>{
    const s = { id:d.id, ...(d.data()||{}) };
    // normalize basics
    s.name = String(s.name||"").trim();
    s.no = String(s.no??"").trim();
    s.program = String(s.program||"").trim();
    s.vergiNo = String(s.vergiNo||"").trim();
    s.telefon = String(s.telefon||"").trim();
    next.push(s);
  });

  // Upsert layers
  // önce kaldırılmışları temizle
  const nextIds = new Set(next.map(x=>x.id));
  Array.from(layers.keys()).forEach(id=>{
    if (!nextIds.has(id)) clearLayer(id);
  });
  next.forEach(upsertShop);

  allShops = next;
  buildChips();
  filterAndRender();
});

/* =========================================================
   BLOK OLUŞTURMA (sadece ?admin=1)
   ========================================================= */
   
ensureBlockUi();


function polygonCoordsToObjects(coords){
  if (!Array.isArray(coords)) return [];
  return coords
    .map(p => Array.isArray(p) && p.length===2 ? ({ lat:p[0], lng:p[1] }) : null)
    .filter(Boolean);
}

// 4 nokta -> shopCount -> dilimle
function dividePolygonIntoShops(polygonCoords, shopCount, direction){
  if (polygonCoords.length !== 4) return [];

  const lerpPoint = (pA, pB, t) => ([
    pA[0] + (pB[0] - pA[0]) * t,
    pA[1] + (pB[1] - pA[1]) * t
  ]);

  const avgPoint = (pts) => {
    const s = pts.reduce((acc,p)=>[acc[0]+p[0], acc[1]+p[1]],[0,0]);
    return [s[0]/pts.length, s[1]/pts.length];
  };

  // saat yönünde sırala
  const centroid = avgPoint(polygonCoords);
  const ordered = [...polygonCoords].sort((a,b)=>{
    const angA = Math.atan2(a[0]-centroid[0], a[1]-centroid[1]);
    const angB = Math.atan2(b[0]-centroid[0], b[1]-centroid[1]);
    return angA - angB;
  });

  // üst/alt
  const sortedByLat = [...ordered].sort((a,b)=>b[0]-a[0]);
  const top2 = sortedByLat.slice(0,2).sort((a,b)=>a[1]-b[1]);
  const bottom2 = sortedByLat.slice(2,4).sort((a,b)=>a[1]-b[1]);

  const P1 = top2[0];    // üst-sol
  const P2 = top2[1];    // üst-sağ
  const P4 = bottom2[0]; // alt-sol
  const P3 = bottom2[1]; // alt-sağ

  const shops = [];

  if (direction === "yatay"){
    for (let i=0;i<shopCount;i++){
      const t0 = i/shopCount;
      const t1 = (i+1)/shopCount;
      const A0 = lerpPoint(P1,P2,t0);
      const A1 = lerpPoint(P1,P2,t1);
      const B0 = lerpPoint(P4,P3,t0);
      const B1 = lerpPoint(P4,P3,t1);
      const coords = [A0,A1,B1,B0];
      shops.push({ coords, center: avgPoint(coords) });
    }
  } else {
    for (let i=0;i<shopCount;i++){
      const t0 = i/shopCount;
      const t1 = (i+1)/shopCount;
      const L0 = lerpPoint(P1,P4,t0);
      const L1 = lerpPoint(P1,P4,t1);
      const R0 = lerpPoint(P2,P3,t0);
      const R1 = lerpPoint(P2,P3,t1);
      const coords = [L0,R0,R1,L1];
      shops.push({ coords, center: avgPoint(coords) });
    }
  }

  return shops;
}

function ensureBlockUi(){
  // map.html dosyası değişmediyse UI yoktur: hata vermesin
  const fab = document.getElementById("blockFab");
  const panel = document.getElementById("blockPanel");
  const open = document.getElementById("blockOpenBtn");
  const close = document.getElementById("blockCloseBtn");
  const startBtn = document.getElementById("blockStartBtn");
  const clearBtn = document.getElementById("blockClearBtn");
  const createBtn = document.getElementById("blockCreateBtn");

  if (!fab || !panel || !open || !close || !startBtn || !clearBtn || !createBtn) return null;

  const startNoEl = document.getElementById("blockStartNo");
  const endNoEl = document.getElementById("blockEndNo");
  const ptsEl = document.getElementById("blockPts");
  const statusEl = document.getElementById("blockStatus");

  // show admin button
  fab.style.display = "block";

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t || ""; };

  // temp layers
  let blockMode = false;
  let pts = [];
  let ptMarkers = [];
  let selectionPoly = null;

  const resetSelection = ()=>{
    pts = [];
    ptMarkers.forEach(m=>{ try{ map.removeLayer(m); }catch(e){} });
    ptMarkers = [];
    if (selectionPoly){ try{ map.removeLayer(selectionPoly); }catch(e){} }
    selectionPoly = null;
    if (ptsEl) ptsEl.textContent = "0/4";
    createBtn.disabled = true;
    setStatus("");
  };

  const openPanel = ()=>{
    panel.style.display = "block";
    setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 60);
  };
  const closePanel = ()=>{
    panel.style.display = "none";
    blockMode = false;
    resetSelection();
  };

  open.addEventListener("click", ()=>{
    if (panel.style.display === "block") closePanel();
    else openPanel();
  });
  close.addEventListener("click", closePanel);

  startBtn.addEventListener("click", ()=>{
    blockMode = true;
    resetSelection();
    setStatus("Haritaya 4 nokta tıkla.");
    toast("Blok seçimi aktif");
  });

  clearBtn.addEventListener("click", ()=>{
    blockMode = false;
    resetSelection();
    toast("Temizlendi");
  });

  map.on("click", (e)=>{
    if (!blockMode) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    pts.push([lat,lng]);

    // marker
    const m = L.circleMarker([lat,lng], {
      radius:7,
      color:"#fff",
      weight:2,
      fillColor:"#3b82f6",
      fillOpacity:0.95
    }).addTo(map);
    ptMarkers.push(m);

    if (ptsEl) ptsEl.textContent = `${pts.length}/4`;

    if (pts.length === 4){
      if (selectionPoly){ try{ map.removeLayer(selectionPoly); }catch(e){} }
      selectionPoly = L.polygon(pts, {
        color:"#3b82f6",
        weight:2,
        fillColor:"#3b82f6",
        fillOpacity:0.18
      }).addTo(map);

      createBtn.disabled = false;
      setStatus("4 nokta tamam. No aralığını gir ve oluştur.");
      toast("4 nokta seçildi");
      blockMode = false;
    }
  });

  createBtn.addEventListener("click", async ()=>{
    const startNo = parseInt(String(startNoEl?.value || "").trim(), 10);
    const endNo = parseInt(String(endNoEl?.value || "").trim(), 10);

    if (!Number.isFinite(startNo) || !Number.isFinite(endNo) || endNo < startNo){
      toast("No aralığı hatalı");
      setStatus("No aralığını düzelt.");
      return;
    }
    if (pts.length !== 4){
      toast("4 nokta yok");
      setStatus("4 nokta seçmeden olmaz.");
      return;
    }

    const shopCount = endNo - startNo + 1;
    if (shopCount < 1 || shopCount > 250){
      toast("Dükkan sayısı 1-250");
      return;
    }

    const direction = document.querySelector('input[name="blockDir"]:checked')?.value || "yatay";
    const startCorner = document.querySelector('input[name="blockCorner"]:checked')?.value || "topRight";

    const raw = dividePolygonIntoShops(pts, shopCount, direction);
    if (!raw.length){
      toast("Bölme başarısız");
      return;
    }

    // numaralandırma: üstten alta, sonra köşeye göre sağ/sol
    const numbered = [...raw].sort((a,b)=>{
      const latA = a.center?.[0] ?? 0;
      const latB = b.center?.[0] ?? 0;
      if (latA !== latB) return latB - latA;

      const lngA = a.center?.[1] ?? 0;
      const lngB = b.center?.[1] ?? 0;
      return startCorner === "topLeft" ? (lngA - lngB) : (lngB - lngA);
    });

    const blockId = `block_${Date.now()}`;
    setStatus(`Kaydediliyor... (${shopCount})`);
    toast("Kaydediliyor");

    const batch = writeBatch(db);

    numbered.forEach((cell, i)=>{
      const shopNo = startNo + i;
      const docId = `${blockId}_${shopNo}`;
      const ref = doc(db, "dukkanlar", docId);

      const data = {
        name: `Dükkan ${shopNo}`,
        no: String(shopNo),
        program: "",
        kullanilmiyor: false,
        vergiNo: "",
        telefon: "",
        coords: cell.center,
        polygonCoords: polygonCoordsToObjects(cell.coords),
        blockId,
        createdAt: serverTimestamp()
      };

      batch.set(ref, data, { merge:false });
    });

    try{
      await batch.commit();
      toast("Blok kaydedildi");
      setStatus(`OK: ${blockId} (${shopCount} dükkan)`);
      resetSelection();
    }catch(e){
      console.error(e);
      toast("Kayıt hatası");
      setStatus("Firestore hata (console bak).");
    }
  });

  return true;
}

if (isAdmin){
  // UI yoksa map.html'e eklemen lazım (aşağıdaki map.html kısmı)
  ensureBlockUi();
}
