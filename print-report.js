const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";

const elGeneratedAt = document.getElementById("generatedAt");
const elDateRange = document.getElementById("dateRange");
const elFilters = document.getElementById("filters");
const elDocBody = document.getElementById("docBody");

const query = new URLSearchParams(window.location.search);
const startDate = query.get("startDate") || "";
const endDate = query.get("endDate") || "";
const equipment = query.get("equipment") || "";
const status = query.get("status") || "";
const referenceSearch = (query.get("referenceSearch") || "").trim().toLowerCase();

function esc(v) {
  return String(v || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyReferenceFilter(rows) {
  if (!referenceSearch) return rows.slice();
  return rows.filter((row) => {
    const hay = [row.referenceNo, row.borrowerName, row.patientName, row.item, row.serviceUser]
      .join(" ")
      .toLowerCase();
    return hay.includes(referenceSearch);
  });
}

function setMeta() {
  if (elGeneratedAt) elGeneratedAt.textContent = new Date().toLocaleDateString("th-TH");
  if (elDateRange) {
    const rangeText = [startDate, endDate].filter(Boolean).join(" ถึง ") || "ทั้งหมด";
    elDateRange.textContent = rangeText;
  }
  if (elFilters) {
    const labels = [];
    if (equipment) labels.push(`อุปกรณ์: ${equipment}`);
    if (status) labels.push(`สถานะ: ${status}`);
    if (referenceSearch) labels.push(`เลขอ้างอิง: ${referenceSearch}`);
    elFilters.textContent = labels.join(" | ") || "ทั้งหมด";
  }
}

function render(rows) {
  if (!rows.length) {
    elDocBody.innerHTML = `<tr><td colspan="10">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
    return;
  }

  elDocBody.innerHTML = rows.map((r, idx) => {
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(r.borrowDate || r.timestamp)}</td>
        <td>${esc(r.referenceNo || "-")}</td>
        <td>${esc(r.borrowerName || "-")}</td>
        <td>${esc(r.serviceUser || "-")}</td>
        <td>${esc(r.item || "-")}</td>
        <td>${esc(String(r.quantity ?? ""))}</td>
        <td>${esc(r.returnDate || "-")}</td>
        <td>${esc(String(r.depositAmount ?? "-"))}</td>
        <td>${esc(r.status || "-")}</td>
      </tr>
    `;
  }).join("");
}

async function loadAndPrint() {
  setMeta();
  try {
    const params = new URLSearchParams({
      action: "report",
      startDate,
      endDate,
      equipment,
      status
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
    const filtered = applyReferenceFilter(data.rows || []);
    render(filtered);
  } catch (err) {
    elDocBody.innerHTML = `<tr><td colspan="10">โหลดข้อมูลไม่สำเร็จ: ${esc(err.message || "ไม่ทราบสาเหตุ")}</td></tr>`;
  } finally {
    setTimeout(() => window.print(), 200);
  }
}

loadAndPrint();
