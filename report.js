const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";

const EQUIPMENT_LIST = [
  "เตียงผู้ป่วย",
  "ที่นอนลม",
  "เครื่องผลิตออกซิเจน",
  "เครื่องวัดความดัน",
  "ไม้คำ้ยัน",
  "ไม้เท้า 4 ขา WALKER",
  "รถเข็น",
  "เครื่องดูดเสมหะ",
  "ไม้เท้าก้านร่ม",
  "ไม้เท้า 3-4 จุด",
  "กระบอกปัสสาวะ",
  "เก้าอี้สุขา"
];

const elStart = document.getElementById("startDate");
const elEnd = document.getElementById("endDate");
const elEquipment = document.getElementById("equipment");
const elStatus = document.getElementById("status");
const elReferenceSearch = document.getElementById("referenceSearch");
const elLoad = document.getElementById("loadBtn");
const elPdf = document.getElementById("pdfBtn");
const elMsg = document.getElementById("statusText");
const elBody = document.getElementById("reportBody");
const elAt = document.getElementById("generatedAt");
const elSumAll = document.getElementById("sumAll");
const elSumBorrow = document.getElementById("sumBorrow");
const elSumReturn = document.getElementById("sumReturn");
const elSumTransfer = document.getElementById("sumTransfer");
const elChips = document.getElementById("filterChips");
const reportLogoutBtn = document.getElementById("reportLogoutBtn");

let reportRows = [];

EQUIPMENT_LIST.forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  elEquipment.appendChild(option);
});

elLoad.addEventListener("click", loadReport);
elPdf.addEventListener("click", openPrintReportPage);

if (elReferenceSearch) {
  elReferenceSearch.addEventListener("input", () => render(applyReportFilters(reportRows)));
}

if (reportLogoutBtn) {
  reportLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("borrow_auth");
    window.location.href = "login.html";
  });
}

async function loadReport() {
  const originalLabel = elLoad ? elLoad.textContent : "";
  try {
    if (elLoad) {
      elLoad.disabled = true;
      elLoad.textContent = "กำลังโหลด...";
    }
    setMsg("กำลังโหลดรายงาน...");
    const params = new URLSearchParams({
      action: "report",
      startDate: elStart.value || "",
      endDate: elEnd.value || "",
      equipment: elEquipment.value || "",
      status: elStatus.value || ""
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`โหลดไม่สำเร็จ (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "โหลดรายงานไม่สำเร็จ");
    reportRows = data.rows || [];
    render(applyReportFilters(reportRows));
    setMsg(`โหลดแล้ว ${reportRows.length || 0} รายการ`, "success");
  } catch (err) {
    reportRows = [];
    render([]);
    setMsg(err.message || "เกิดข้อผิดพลาด", "error");
  } finally {
    if (elLoad) {
      elLoad.disabled = false;
      elLoad.textContent = originalLabel || "โหลดรายงาน";
    }
  }
}

function applyReportFilters(rows) {
  const refQuery = String((elReferenceSearch && elReferenceSearch.value) || "").trim().toLowerCase();
  if (!refQuery) return rows.slice();
  return rows.filter((row) => {
    const hay = [row.referenceNo, row.borrowerName, row.patientName, row.item, row.serviceUser]
      .join(" ")
      .toLowerCase();
    return hay.includes(refQuery);
  });
}

function render(rows) {
  if (!rows.length) {
    elBody.innerHTML = `<tr><td colspan="11">ยังไม่มีข้อมูล</td></tr>`;
    elSumAll.textContent = "0";
    elSumBorrow.textContent = "0";
    elSumReturn.textContent = "0";
    if (elSumTransfer) elSumTransfer.textContent = "0";
    elAt.textContent = new Date().toLocaleDateString("th-TH");
    renderChips([]);
    return;
  }

  let borrow = 0;
  let ret = 0;
  let transfer = 0;
  elBody.innerHTML = rows.map((r) => {
    if (r.status === "ยืม") borrow += 1;
    if (r.status === "คืน") ret += 1;
    if (r.status === "โอน") transfer += 1;
    const rowClass = r.status === "ยืม"
      ? "row-borrow"
      : r.status === "คืน"
        ? "row-return"
        : r.status === "โอน"
          ? "row-transfer"
          : "";
    const statusClass = r.status === "ยืม"
      ? "status-borrow"
      : r.status === "คืน"
        ? "status-return"
        : r.status === "โอน"
          ? "status-transfer"
          : "";
    return `
      <tr class="${rowClass}">
        <td>${esc(r.borrowDate || r.timestamp)}</td>
        <td>${esc(r.referenceNo || "-")}</td>
        <td>${esc(r.borrowerName)}</td>
        <td>${esc(r.serviceUser || "-")}</td>
        <td><div class="report-detail">${esc(r.addressText)}</div></td>
        <td><div class="report-detail">${esc(r.phoneNumber)}</div></td>
        <td><div class="report-item">${esc(r.item)}</div></td>
        <td>${esc(String(r.quantity ?? ""))}</td>
        <td><div class="report-detail">${esc(r.returnDate || "")}</div></td>
        <td><div class="report-detail">${esc(String(r.depositAmount ?? ""))}</div></td>
        <td><span class="status-chip ${statusClass}">${esc(r.status)}</span></td>
      </tr>
    `;
  }).join("");

  elSumAll.textContent = String(rows.length);
  elSumBorrow.textContent = String(borrow);
  elSumReturn.textContent = String(ret);
  if (elSumTransfer) elSumTransfer.textContent = String(transfer);
  elAt.textContent = new Date().toLocaleDateString("th-TH");
  renderChips(buildChipData());
}

function setMsg(msg, type = "") {
  elMsg.textContent = msg;
  elMsg.classList.remove("error", "success");
  if (type) elMsg.classList.add(type);
}

function buildChipData() {
  const chips = [];
  if (elStart.value) chips.push(`เริ่ม: ${elStart.value}`);
  if (elEnd.value) chips.push(`สิ้นสุด: ${elEnd.value}`);
  if (elEquipment.value) chips.push(`อุปกรณ์: ${elEquipment.value}`);
  if (elStatus.value) chips.push(`สถานะ: ${elStatus.value}`);
  const refQuery = String((elReferenceSearch && elReferenceSearch.value) || "").trim();
  if (refQuery) chips.push(`เลขอ้างอิง: ${refQuery}`);
  if (!chips.length) chips.push("ตัวกรอง: ทั้งหมด");
  return chips;
}

function renderChips(chips) {
  if (!elChips) return;
  elChips.innerHTML = chips.map((c) => `<span class="filter-chip">${esc(c)}</span>`).join("");
}

function esc(v) {
  return String(v || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openPrintReportPage() {
  const params = new URLSearchParams({
    startDate: elStart.value || "",
    endDate: elEnd.value || "",
    equipment: elEquipment.value || "",
    status: elStatus.value || "",
    referenceSearch: (elReferenceSearch && elReferenceSearch.value) || ""
  });
  window.location.href = `print-report.html?${params.toString()}`;
}

loadReport();
