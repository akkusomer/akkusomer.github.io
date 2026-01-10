// assets/js/list.js
import { db, doc, getDoc, collection, onSnapshot } from "./firebase.js";

const $ = (s) => document.querySelector(s);

let data = [];
let queryText = "";
let activeFilter = "all"; // all | active | inactive | prog:<value>

let programs = [];          // [{label,value,color}]
let programMap = new Map(); // value -> {label,value,color}

// --------------------
// Scroll helpers
// --------------------
function saveListScroll() {
  sessionStorage.setItem("listScrollTop", String(window.scrollY));
  sessionStorage.setItem("listShouldRestoreScroll", "1");
}

function restoreListScrollAfterRender() {
  const should = sessionStorage.getItem("listShouldRestoreScroll") === "1";
  if (!should) return;

  sessionStorage.removeItem("listShouldRestoreScroll");
  const y = Number(sessionStorage.getItem("listScrollTop") || "0");
  if (y) setTimeout(() => window.scrollTo(0, y), 0);
}

// --------------------
// Utils
// --------------------
function normalize(v) {
  return (v ?? "").toString().toLowerCase().trim();
}

function badge(text, color) {
  return `<span class="badge" style="border-color:${color};background:${color}22">${text}</span>`;
}

function chip(text, filterKey, isActive = false, color = null) {
  const style = color ? `style="border-color:${color};background:${color}22"` : "";
  const cls = `chip${isActive ? " active" : ""}`;
  return `<button class="${cls}" type="button" data-filter="${filterKey}" ${style}>${text}</button>`;
}

// --------------------
// Programlar
// --------------------
async function loadPrograms() {
  const ref = doc(db, "ayarlar", "programlar");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    programs = [];
    programMap.clear();
    renderFilters();
    return;
  }

  const d = snap.data();
  programs = Array.isArray(d.programlar) ? d.programlar : [];

  programMap.clear();
  for (const p of programs) {
    if (!p || !p.value) continue;
    programMap.set(p.value, {
      label: p.label ?? p.value,
      value: p.value,
      color: p.color ?? "#64748b",
    });
  }

  renderFilters();
}

function renderFilters() {
  const el = $("#filters");
  if (!el) return;

  let html = "";
  html += chip("Tümü", "all", activeFilter === "all");
  html += chip("Kullanılan", "active", activeFilter === "active");
  html += chip("Kullanılmayan", "inactive", activeFilter === "inactive");

  for (const p of programs) {
    const key = `prog:${p.value}`;
    html += chip(p.label ?? p.value, key, activeFilter === key, p.color ?? null);
  }

  el.innerHTML = html;

  el.querySelectorAll(".chip[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      el.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
  });
}

// --------------------
// Filtre + Arama (CASE INSENSITIVE)
// --------------------
function applyFilters(rows) {
  const q = normalize(queryText);

  return rows.filter((d) => {
    const name = normalize(d.name);
    const noStr = normalize(d.no);
    const tel = normalize(d.telefon);
    const tax = normalize(d.vergiNo);

    const matchSearch =
      !q ||
      name.includes(q) ||
      noStr.includes(q) ||
      tel.includes(q) ||
      tax.includes(q);

    let matchChip = true;
    if (activeFilter === "active") matchChip = !d.kullanilmiyor;
    else if (activeFilter === "inactive") matchChip = !!d.kullanilmiyor;
    else if (activeFilter.startsWith("prog:")) {
      const want = activeFilter.slice("prog:".length);
      matchChip = (d.program || "") === want;
    }

    return matchSearch && matchChip;
  });
}

// --------------------
// Render
// --------------------
function render() {
  const list = $("#list");
  const items = applyFilters(data);

  $("#countText").textContent = `${items.length} kayıt`;

  if (!items.length) {
    list.innerHTML = `<div class="empty glass">Kayıt bulunamadı</div>`;
    restoreListScrollAfterRender();
    return;
  }

  list.innerHTML = items
    .map((item, idx) => {
      const shownNo = item.no !== "" && item.no != null ? item.no : idx + 1;

      const telHtml = item.telefon || `<span class="muted">Yok</span>`;
      const vergiHtml = item.vergiNo || `<span class="muted">Yok</span>`;

      const progObj = programMap.get(item.program);
      const progLabel = progObj ? progObj.label : item.program || "";
      const progColor = progObj ? progObj.color : "#64748b";

      const eksik = !item.telefon || !item.vergiNo || !item.program;

      return `
        <button class="card glass" type="button" data-id="${item.id}">
          <div class="card-top">
            <div class="card-title">${item.name || "—"}</div>
            <div class="card-no">No: <strong>${shownNo}</strong></div>
          </div>

          <div class="card-mid">
            <div class="card-line"><span class="muted">Program</span><span>${progLabel || "—"}</span></div>
            <div class="card-line"><span class="muted">Telefon</span><span>${telHtml}</span></div>
            <div class="card-line"><span class="muted">Vergi No</span><span>${vergiHtml}</span></div>
          </div>

          <div class="badges">
            ${item.kullanilmiyor ? badge("Kullanmıyor", "#f97316") : badge("Aktif", "#22c55e")}
            ${progLabel ? badge(progLabel, progColor) : badge("Program yok", "#ef4444")}
            ${eksik ? badge("Eksik Bilgi", "#ef4444") : ""}
          </div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".card[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveListScroll();
      const back = encodeURIComponent(location.href);
      window.location.href = `./listedit.html?id=${btn.dataset.id}&back=${back}`;
    });
  });

  restoreListScrollAfterRender();
}

// --------------------
// Firestore
// --------------------
function startDukkanlar() {
  const ref = collection(db, "dukkanlar");

  onSnapshot(ref, (snap) => {
    data = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name || "",
        no: x.no ?? "",
        telefon: x.telefon || "",
        vergiNo: x.vergiNo || "",
        program: x.program || "",
        kullanilmiyor: !!x.kullanilmiyor,
      };
    });

    data.sort((a, b) => {
      const an = parseInt(a.no, 10);
      const bn = parseInt(b.no, 10);
      if (!Number.isFinite(an)) return 1;
      if (!Number.isFinite(bn)) return -1;
      return an - bn;
    });

    render();
  });
}

// --------------------
// Boot
// --------------------
document.addEventListener("DOMContentLoaded", async () => {
  if (sessionStorage.getItem("listShouldRestoreScroll") !== "1") {
    sessionStorage.removeItem("listScrollTop");
    window.scrollTo(0, 0);
  }

  await loadPrograms();
  startDukkanlar();

  $("#q").addEventListener("input", (e) => {
    queryText = e.target.value;
    render();
  });

  $("#btnClear").addEventListener("click", () => {
    $("#q").value = "";
    queryText = "";
    render();
  });

  $("#btnBack").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./app.html";
  });

  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });
});
