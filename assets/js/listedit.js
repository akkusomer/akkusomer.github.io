// assets/js/listedit.js
import { db, doc, getDoc, updateDoc, serverTimestamp } from "./firebase.js";

const $ = (s) => document.querySelector(s);

const params = new URLSearchParams(location.search);
const id = params.get("id");

// list’ten geldiğimiz link (filtre/arama dahil)
const back = params.get("back");
const backUrl = back ? decodeURIComponent(back) : "list.html";

function setHint(t) {
  $("#hint").textContent = t || "";
}

if (!id) {
  alert("ID yok!");
  location.href = backUrl;
}

const shopRef = doc(db, "dukkanlar", id);
const programsRef = doc(db, "ayarlar", "programlar");

async function loadPrograms() {
  const sel = $("#program");
  sel.innerHTML = `<option value="">Seç</option>`;

  const snap = await getDoc(programsRef);
  if (!snap.exists()) return;

  const d = snap.data();
  const arr = Array.isArray(d.programlar) ? d.programlar : [];

  for (const p of arr) {
    if (!p || !p.value) continue;
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label ?? p.value;
    sel.appendChild(opt);
  }
}

async function loadShop() {
  setHint("Yükleniyor...");

  const snap = await getDoc(shopRef);
  if (!snap.exists()) {
    alert("Kayıt bulunamadı");
    location.href = backUrl;
    return;
  }

  const d = snap.data();
  $("#name").value = d.name || "";
  $("#no").value = d.no || "";
  $("#telefon").value = d.telefon || "";
  $("#vergiNo").value = d.vergiNo || "";
  $("#kullanilmiyor").checked = !!d.kullanilmiyor;
  $("#program").value = d.program || "";

  setHint("");
}

$("#btnCancel").addEventListener("click", () => {
  location.href = backUrl;
});

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: $("#name").value.trim(),
    no: $("#no").value.trim(),
    telefon: $("#telefon").value.trim(),
    vergiNo: $("#vergiNo").value.trim(),
    program: $("#program").value,
    kullanilmiyor: $("#kullanilmiyor").checked,
    updatedAt: serverTimestamp()
  };

  if (!payload.name) {
    setHint("İsim boş olamaz");
    return;
  }

  try {
    setHint("Kaydediliyor...");
    await updateDoc(shopRef, payload);
    setHint("Kaydedildi ✅");
    setTimeout(() => (location.href = backUrl), 250);
  } catch (err) {
    console.error(err);
    setHint("Hata: " + err.message);
    alert("Kaydetme hatası: " + err.message);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadPrograms();
  await loadShop();
});
