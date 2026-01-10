// assets/js/home.js
import { db, collection, onSnapshot } from "./firebase.js";

const $ = (sel, root = document) => root.querySelector(sel);

function setStatus(text) {
  const el = $("#statusText");
  if (el) el.textContent = text;
}

const norm = (v) => (v == null ? "" : String(v).trim());
const isEmpty = (v) => norm(v) === "";

function renderStats(s) {
  $("#stTotal").textContent = s.total;
  $("#stAtlas").textContent = s.atlas;
  $("#stInactive").textContent = s.inactive;
  $("#stRate").textContent = `%${s.rate}`;
  $("#stMissing").textContent = s.missing;
  $("#stNoPhone").textContent = s.noPhone;
  $("#stNoTax").textContent = s.noTax;
}

function computeStats(list) {
  const total = list.length;
  const atlas = list.filter((x) => x.program === "AtlasPro").length;
  const inactive = list.filter((x) => x.kullanilmiyor === true).length;
  const noPhone = list.filter((x) => isEmpty(x.telefon)).length;
  const noTax = list.filter((x) => isEmpty(x.vergiNo)).length;
  const missing = list.filter((x) => isEmpty(x.telefon) || isEmpty(x.vergiNo)).length;
  const rate = total ? Math.round((atlas / total) * 100) : 0;

  return { total, atlas, inactive, rate, missing, noPhone, noTax };
}

let unsub = null;

function startLiveStats() {
  setStatus("Canlı veri bağlandı");

  unsub = onSnapshot(
    collection(db, "dukkanlar"),
    (snap) => {
      const list = snap.docs.map((d) => d.data());
      renderStats(computeStats(list));
    },
    (err) => {
      console.error(err);
      setStatus("Veri alınamadı (kural/bağlantı).");
    }
  );
}

function logout() {
  localStorage.clear();
  window.location.href = "./login.html";
}

// BUTON ROUTE HARİTASI
const ROUTES = {
  map: "./map.html",
  list: "./list.html",
  outside: "./outside.html",
  "outside-add": "./outside-add.html",
  reports: "./reports.html",
  settings: "./settings.html",
};

function go(routeKey) {
  const url = ROUTES[routeKey];
  if (!url) {
    console.warn("Bilinmeyen route:", routeKey);
    setStatus("Bu menü henüz bağlanmadı.");
    return;
  }
  window.location.href = url;
}

function fixOverlays() {
  const bg = $(".bg");
  if (bg) bg.style.pointerEvents = "none"; // bg tıkları yemesin
}

// Event Delegation: tüm data-route butonları tek yerden çalışır
function bindRoutes() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-route]");
    if (!btn) return;
    e.preventDefault();
    go(btn.dataset.route);
  });
}

function bindSearch() {
  const q = $("#q");
  const btn = $("#btnSearch");
  if (!q || !btn) return;

  const run = () => {
    const query = norm(q.value);
    if (!query) return;

    // list ekranına arama paramı ile geç (list.js bunu okuyabilir)
    window.location.href = `./list.html?q=${encodeURIComponent(query)}`;
  };

  btn.addEventListener("click", run);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fixOverlays();

  startLiveStats();
  bindRoutes();
  bindSearch();

  const logoutBtn = $("#btnLogout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  console.log("home.js hazır ✅");
});
