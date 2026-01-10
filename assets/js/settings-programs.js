import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const ref = doc(db, "ayarlar", "programlar");

let programs = [];

function setHint(t) {
  const el = $("#hint");
  if (el) el.textContent = t || "";
}

function norm(v) {
  return (v ?? "").toString().trim();
}

/* ===============================
   AUTOSAVE
   =============================== */
async function autosave() {
  try {
    await updateDoc(ref, { programlar: programs });
    setHint("Otomatik kaydedildi");
  } catch (err) {
    console.error(err);
    setHint("Kayıt hatası: " + err.message);
    alert("Firestore kayıt hatası: " + err.message);
  }
}

/* ===============================
   RENDER
   =============================== */
function render() {
  const list = $("#progList");

  if (!programs.length) {
    list.innerHTML = `<div class="panel glass">Hiç program yok.</div>`;
    return;
  }

  list.innerHTML = programs
    .map(
      (p, idx) => `
    <div class="item glass" data-idx="${idx}">
      <div class="swatch" style="background:${p.color || "#64748b"}"></div>

      <div class="meta">
        <div class="title">${p.label || p.value}</div>
        <div class="sub">value: <strong>${p.value}</strong></div>
      </div>

      <div class="item-actions">
        <button class="iconbtn" data-act="edit">✎</button>
        <button class="iconbtn danger" data-act="del">🗑</button>
      </div>
    </div>
  `
    )
    .join("");

  list.querySelectorAll(".item").forEach((el) => {
    const idx = Number(el.dataset.idx);
    const p = programs[idx];

    el.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;

        /* ---------- SİL ---------- */
        if (act === "del") {
          const q = query(collection(db, "dukkanlar"), where("program", "==", p.value), limit(1));
          const snap = await getDocs(q);

          if (!snap.empty) {
            alert(`"${p.label}" programı kullanılıyor.\nÖnce dükkanlardan kaldır.`);
            return;
          }

          if (!confirm(`${p.label} silinsin mi?`)) return;

          programs.splice(idx, 1);
          render();
          autosave();
          return;
        }

        /* ---------- EDIT ---------- */
        if (act === "edit") {
          const newLabel = prompt("Program adı", p.label);
          if (newLabel === null) return;

          const newColor = prompt("Renk (#rrggbb)", p.color || "#64748b");
          if (newColor === null) return;

          programs[idx] = {
            ...p,
            label: norm(newLabel) || p.value,
            color: norm(newColor) || "#64748b",
          };

          render();
          autosave();
        }
      });
    });
  });
}

/* ===============================
   LOAD
   =============================== */
async function load() {
  setHint("Yükleniyor...");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    programs = [];
    setHint("ayarlar/programlar yok");
    render();
    return;
  }

  const d = snap.data();
  programs = Array.isArray(d.programlar) ? d.programlar : [];
  setHint("");
  render();
}

/* ===============================
   ADD
   =============================== */
function addProgram() {
  const label = norm($("#inLabel").value);
  const value = norm($("#inValue").value);
  const color = norm($("#inColor").value) || "#64748b";

  if (!value) {
    setHint("Value boş olamaz");
    return;
  }

  if (programs.some((p) => p.value === value)) {
    setHint("Bu value zaten var");
    return;
  }

  programs.unshift({
    label: label || value,
    value,
    color,
  });

  $("#inLabel").value = "";
  $("#inValue").value = "";

  render();
  autosave();
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", async () => {
  $("#btnAdd").addEventListener("click", addProgram);
  $("#btnBack").addEventListener("click", () => {
    window.location.href = "settings.html";
  });

  await load();
});
