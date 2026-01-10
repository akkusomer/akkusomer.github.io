import {
  db,
  collection,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  doc,
  deleteDoc
} from "./firebase.js";

const $ = (s) => document.querySelector(s);

const blockListEl = $("#blockList");
const emptyEl = $("#emptyState");
const countHint = $("#countHint");
const sourceHint = $("#sourceHint");

function parseShopNo(no) {
  const n = parseInt(String(no ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function buildBlocksFromDukkanlar(docs) {
  const blocks = new Map();

  docs.forEach((d) => {
    const s = d.data() || {};
    const blockId = String(s.blockId || "").trim();
    if (!blockId) return;

    if (!blocks.has(blockId)) {
      const ms = parseInt(blockId.split("_")[1] || "0", 10);
      blocks.set(blockId, {
        blockId,
        createdAtMs: Number.isFinite(ms) ? ms : 0,
        startNo: null,
        endNo: null,
        count: 0
      });
    }

    const b = blocks.get(blockId);
    b.count++;

    const no = parseShopNo(s.no);
    if (no != null) {
      b.startNo = b.startNo == null ? no : Math.min(b.startNo, no);
      b.endNo = b.endNo == null ? no : Math.max(b.endNo, no);
    }
  });

  return Array.from(blocks.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

function renderBlocks(blocks) {
  blockListEl.innerHTML = "";
  emptyEl.style.display = blocks.length ? "none" : "block";
  countHint.textContent = blocks.length ? `${blocks.length} blok` : "";

  blocks.forEach((b) => {
    const blockId = String(b.blockId || "").trim();
    const startNo = b.startNo;
    const endNo = b.endNo;

    const title =
      (Number.isFinite(startNo) && Number.isFinite(endNo))
        ? `Blok ${startNo}-${endNo}`
        : `Blok ${blockId}`;

    const dateStr = b.createdAtMs
      ? new Date(b.createdAtMs).toLocaleString("tr-TR")
      : "-";

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="min-width:0;">
        <div style="font-weight:900;">${escapeHtml(title)}</div>
        <div class="meta">Blok ID: ${escapeHtml(blockId)}</div>
        <div class="meta">${escapeHtml(dateStr)} • ${b.count} dükkan</div>
      </div>
      <button class="btn btn-danger" data-del="${escapeAttr(blockId)}">Bloğu Komple Sil</button>
    `;
    blockListEl.appendChild(row);
  });

  blockListEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const blockId = btn.getAttribute("data-del");
      if (!blockId) return;
      await deleteBlockEverywhere(blockId);
    });
  });
}

async function deleteBlockEverywhere(blockId) {
  if (!confirm(`"${blockId}" bloğuna ait TÜM dükkanları silmek istiyor musun?`)) return;

  try {
    const dukkanlarRef = collection(db, "dukkanlar");
    const qs = query(dukkanlarRef, where("blockId", "==", blockId));
    const snap = await getDocs(qs);

    let deleted = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    const commits = [];

    snap.forEach((d) => {
      batch.delete(d.ref);
      deleted++;
      batchCount++;

      if (batchCount >= 450) {
        commits.push(batch.commit());
        batch = writeBatch(db);
        batchCount = 0;
      }
    });

    commits.push(batch.commit());
    await Promise.all(commits);

    // Eğer sende ileride bloklar koleksiyonu oluşursa diye:
    try { await deleteDoc(doc(db, "bloklar", blockId)); } catch (e) {}

    alert(`${deleted} dükkan silindi. Blok temizlendi.`);
  } catch (e) {
    console.error("deleteBlockEverywhere error", e);
    alert("Blok silinemedi. Console kontrol et.");
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

/**
 * ✅ CANLI BLOK DİNLEME (admin’deki sistem)
 */
function listenBlocksFromDukkanlarLive() {
  sourceHint.textContent = "dukkanlar (live)";
  const dukkanlarRef = collection(db, "dukkanlar");

  // En basit ve garanti yöntem: tüm dukkanlar snapshot
  // (blockId’li olanları client-side filtreliyoruz)
  return onSnapshot(dukkanlarRef, (snap) => {
    const blocks = buildBlocksFromDukkanlar(snap.docs);
    renderBlocks(blocks);
  }, (err) => {
    console.error("dukkanlar onSnapshot error", err);
    alert("Dükkanlar dinlenemedi. Firestore izinlerini kontrol et.");
  });
}

listenBlocksFromDukkanlarLive();
