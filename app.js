// เปลี่ยนค่า URL นี้หลังจาก Deploy Apps Script เป็น Web App แล้ว
const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";
const API_PLACEHOLDER = "YOUR_APPS_SCRIPT_WEB_APP_URL";

const formTabs = document.querySelectorAll('[data-tab]');
const equipmentTabs = document.querySelectorAll(".equipment-tab");
const forms = document.querySelectorAll(".form");
const statusEl = document.getElementById("status");
const recentBody = document.getElementById("recentBody");
const refreshBtn = document.getElementById("refreshBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const logoutBtn = document.getElementById("logoutBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const equipmentSidebar = document.getElementById("equipmentSidebar");
const equipmentSidebarToggle = document.getElementById("equipmentSidebarToggle");
const equipmentSidebarClose = document.getElementById("equipmentSidebarClose");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const RECENT_FETCH_STEP = 20;
const RECENT_INITIAL_VISIBLE = 3;
const RECENT_LOAD_MORE_COUNT = 5;
const MAX_IMAGE_DIM = 1280;
const JPEG_QUALITY = 0.72;

const statEquipment = document.getElementById("statEquipment");
const statStatus = document.getElementById("statStatus");
const statBorrower = document.getElementById("statBorrower");
const statServiceUser = document.getElementById("statServiceUser");
const statPatient = document.getElementById("statPatient");
const statUpdated = document.getElementById("statUpdated");
const statPhone = document.getElementById("statPhone");
const statTotal = document.getElementById("statTotal");
const statAvailable = document.getElementById("statAvailable");
const inventoryEquipmentLabel = document.getElementById("inventoryEquipmentLabel");
const inventoryQtyInput = document.getElementById("inventoryQty");
const inventoryAddBtn = document.getElementById("inventoryAddBtn");
const inventoryRemoveBtn = document.getElementById("inventoryRemoveBtn");
const userLabel = document.getElementById("userLabel");
const recentSearchInput = document.getElementById("recentSearch");
const filterButtons = document.querySelectorAll(".chip-btn[data-filter]");
const transferKindSelect = document.querySelector('#transferForm select[name="transferKind"]');
const imageModal = document.getElementById("imageModal");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");
const imageModalClose = document.getElementById("imageModalClose");
const depositImageLink = document.getElementById("depositImageLink");
const depositImagePreview = document.getElementById("depositImagePreview");
const depositImageEmpty = document.getElementById("depositImageEmpty");
const idCardImageLink = document.getElementById("idCardImageLink");
const idCardImagePreview = document.getElementById("idCardImagePreview");
const idCardImageEmpty = document.getElementById("idCardImageEmpty");
let currentEquipment = "เตียงผู้ป่วย";
let recentRows = [];
let recentLimit = RECENT_FETCH_STEP;
let visibleRecentRows = RECENT_INITIAL_VISIBLE;
let currentInventory = { total: 0, remaining: 0 };
let activeFilter = "all";
let visibleRowsCache = [];

function getCurrentAuth() {
  try {
    return JSON.parse(localStorage.getItem("borrow_auth") || "null");
  } catch (err) {
    return null;
  }
}

function getCurrentDisplayName() {
  const auth = getCurrentAuth();
  return String((auth && (auth.displayName || auth.username)) || "-").trim() || "-";
}

function requireAuth() {
  const auth = getCurrentAuth();
  if (!auth) {
    window.location.href = "login.html";
    return false;
  }
  try {
    if (!auth || !auth.username) {
      localStorage.removeItem("borrow_auth");
      window.location.href = "login.html";
      return false;
    }
  } catch (err) {
    localStorage.removeItem("borrow_auth");
    window.location.href = "login.html";
    return false;
  }
  if (userLabel) userLabel.textContent = auth.displayName || auth.username || "-";
  return true;
}

formTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    formTabs.forEach((t) => t.classList.remove("active"));
    forms.forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`[data-form="${tab.dataset.tab}"]`).classList.add("active");
    setStatus("");
  });
});

function setSidebarOpen(open) {
  if (!equipmentSidebar) return;
  equipmentSidebar.classList.toggle("sidebar-open", open);
  if (sidebarBackdrop) sidebarBackdrop.classList.toggle("show", open);
  if (equipmentSidebarToggle) {
    equipmentSidebarToggle.setAttribute("aria-expanded", String(open));
  }
}

if (equipmentSidebarToggle) {
  equipmentSidebarToggle.addEventListener("click", () => {
    const open = equipmentSidebar?.classList.contains("sidebar-open");
    setSidebarOpen(!open);
  });
}

if (equipmentSidebarClose) {
  equipmentSidebarClose.addEventListener("click", () => setSidebarOpen(false));
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
}

equipmentTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentEquipment = tab.dataset.equipment || currentEquipment;
    visibleRecentRows = RECENT_INITIAL_VISIBLE;
    recentLimit = RECENT_FETCH_STEP;
    equipmentTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    syncEquipmentToForms();
    loadRecent();
    loadInventory();
    setStatus("");
    setSidebarOpen(false);
  });
});

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "success");
  if (type) statusEl.classList.add(type);
}

async function formToObject(form) {
  const data = {};
  const fileTasks = [];
  new FormData(form).forEach((value, key) => {
    if (value instanceof File) {
      if (!value.size) return;
      if (value.size > MAX_UPLOAD_BYTES) {
        throw new Error("ไฟล์รูปใหญ่เกินไป (สูงสุด 1.5MB)");
      }
      fileTasks.push(
        fileToDataUrl(value).then((dataUrl) => {
          data[key] = dataUrl;
          data[`${key}Name`] = value.name || "deposit-image";
          data[`${key}Type`] = "image/jpeg";
        })
      );
      return;
    }
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  await Promise.all(fileTasks);
  return data;
}

function fileToDataUrl(file) {
  return compressImage(file);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        if (dataUrl.length > 3 * 1024 * 1024) {
          reject(new Error("ไฟล์รูปใหญ่เกินไปหลังบีบอัด"));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function syncEquipmentToForms() {
  const borrowEquipment = document.querySelector('#borrowForm input[name="equipmentName"]');
  const returnEquipment = document.querySelector('#returnForm input[name="equipmentName"]');
  const transferEquipment = document.querySelector('#transferForm input[name="equipmentName"]');
  const borrowLabel = document.getElementById("borrowEquipmentLabel");
  const returnLabel = document.getElementById("returnEquipmentLabel");
  const transferLabel = document.getElementById("transferEquipmentLabel");

  if (borrowEquipment) borrowEquipment.value = currentEquipment;
  if (returnEquipment) returnEquipment.value = currentEquipment;
  if (transferEquipment) transferEquipment.value = currentEquipment;
  if (borrowLabel) borrowLabel.value = currentEquipment;
  if (returnLabel) returnLabel.value = currentEquipment;
  if (transferLabel) transferLabel.value = currentEquipment;
}

function todayInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seedDefaultDates(form) {
  if (!form) return;
  const dateInputNames = ["borrowDate", "returnDate", "transferDate"];
  dateInputNames.forEach((name) => {
    const input = form.querySelector(`input[name="${name}"]`);
    if (input && !input.value) input.value = todayInputValue();
  });
}

function validatePayload(eventType, payload) {
  const quantity = Number(payload.quantity || 0);
  if (!isFinite(quantity) || quantity <= 0) {
    throw new Error("จำนวนต้องมากกว่า 0");
  }
  if (eventType === "borrow" && !payload.borrowDate) {
    throw new Error("กรุณาเลือกวันที่ยืม");
  }
  if (eventType === "return" && !payload.returnDate) {
    throw new Error("กรุณาเลือกวันที่คืน");
  }
  if (eventType === "transfer" && !payload.transferDate) {
    throw new Error("กรุณาเลือกวันที่โอน");
  }
  if (eventType === "transfer_cross") {
    const fromEquipment = payload.transferFromEquipment || payload.fromEquipment || "";
    const toEquipment = payload.transferToEquipment || payload.toEquipment || "";
    if (!fromEquipment || !toEquipment) {
      throw new Error("กรุณาเลือกอุปกรณ์ต้นทางและปลายทาง");
    }
    if (fromEquipment === toEquipment) {
      throw new Error("อุปกรณ์ต้นทางและปลายทางต้องไม่เหมือนกัน");
    }
  }
}

async function submitEvent(eventType, payload) {
  if (!API_URL || API_URL === API_PLACEHOLDER) {
    throw new Error("ยังไม่ได้ตั้งค่า API_URL ในไฟล์ web/app.js");
  }

  const formPayload = new URLSearchParams();
  formPayload.set("eventType", eventType);
  Object.entries(payload).forEach(([key, value]) => {
    formPayload.set(key, String(value ?? ""));
  });

  const res = await fetch(API_URL, {
    method: "POST",
    body: formPayload
  });

  if (!res.ok) {
    throw new Error(`ส่งข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
  }

  const result = await res.json();
  if (!result.ok) {
    throw new Error(result.error || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  }
  return result;
}

async function handleSubmit(event, eventType) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalLabel = submitButton ? submitButton.textContent : "";

  try {
    const payload = await formToObject(form);
    payload.serviceUser = getCurrentDisplayName();
    validatePayload(eventType, payload);
    if (eventType === "return" && payload.removeIdCard) {
      const ok = window.confirm("ต้องการลบรูปบัตรประชาชนของรายการล่าสุดจริงหรือไม่");
      if (!ok) return;
    }
    if (eventType === "transfer_cross") {
      const ok = window.confirm("ยืนยันการโอนข้ามอุปกรณ์ ระบบจะบันทึกเป็นคืนอุปกรณ์เดิม + ยืมอุปกรณ์ใหม่");
      if (!ok) return;
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "กำลังบันทึก...";
    }
    if (eventType !== "transfer_cross") {
      applyOptimisticRow(payload, eventType);
    }
    setStatus("กำลังบันทึกข้อมูลและซิงก์...");
    const result = await submitEvent(eventType, payload);
    const refText = result && result.result && result.result.referenceNo ? ` | เลขอ้างอิง: ${result.result.referenceNo}` : "";
    setStatus(`บันทึกข้อมูลสำเร็จ${refText}`, "success");
    form.reset();
    if (form.querySelector('input[name="quantity"]')) {
      form.querySelector('input[name="quantity"]').value = "1";
    }
    syncEquipmentToForms();
    seedDefaultDates(form);
    await new Promise((r) => setTimeout(r, 350));
    await loadRecent();
    await loadInventory();
  } catch (err) {
    await loadRecent();
    await loadInventory();
    setStatus(err.message || "บันทึกข้อมูลไม่สำเร็จ", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel || "บันทึก";
    }
  }
}

async function loadRecent() {
  if (!API_URL || API_URL === API_PLACEHOLDER) return;

  try {
    const params = new URLSearchParams({
      action: "recent",
      equipment: currentEquipment,
      limit: String(recentLimit)
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || "โหลดรายการล่าสุดไม่สำเร็จ");
    const rows = (result.rows || []).filter((row) => String(row.item || "") === currentEquipment);
    recentRows = rows;
    renderRecentFiltered();
    updateStats(recentRows);
  } catch (err) {
    recentRows = [];
    renderRecentFiltered();
    updateStats(recentRows);
    setStatus(err.message || "โหลดรายการล่าสุดไม่สำเร็จ", "error");
  }
}

async function loadInventory() {
  if (!API_URL || API_URL === API_PLACEHOLDER) return;
  try {
    const params = new URLSearchParams({
      action: "inventory",
      equipment: currentEquipment
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`โหลดจำนวนคงเหลือไม่สำเร็จ (HTTP ${res.status})`);
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || "โหลดจำนวนคงเหลือไม่สำเร็จ");
    currentInventory = result.inventory || { total: 0, remaining: 0 };
    updateInventoryDisplay();
  } catch (err) {
    currentInventory = { total: 0, remaining: 0 };
    updateInventoryDisplay();
  }
}

function renderRecentFiltered() {
  let rows = recentRows.slice();
  const query = recentSearchInput ? recentSearchInput.value.trim().toLowerCase() : "";
  if (query) {
    rows = rows.filter((row) => {
      const hay = [
        row.actor,
        row.serviceUser,
        row.referenceNo,
        row.item,
        row.detail,
        row.typeLabel
      ].join(" ").toLowerCase();
      return hay.indexOf(query) !== -1;
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activeFilter === "today") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    rows = rows.filter((row) => {
      const d = parseRowDate(row.timestamp);
      return d && d >= today && d < end;
    });
  } else if (activeFilter === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    rows = rows.filter((row) => {
      const d = parseRowDate(row.timestamp);
      return d && d >= start && d <= today;
    });
  } else if (activeFilter === "borrow") {
    rows = rows.filter((row) => row.typeLabel === "ยืม");
  } else if (activeFilter === "return") {
    rows = rows.filter((row) => row.typeLabel === "คืน");
  }

  renderRecent(rows.slice(0, visibleRecentRows));
  if (loadMoreBtn) {
    loadMoreBtn.disabled = rows.length <= visibleRecentRows;
  }
}

function parseRowDate(text) {
  if (!text) return null;
  const direct = new Date(text);
  if (isFinite(direct.getTime())) return direct;
  const parts = String(text).split("/");
  if (parts.length === 3) {
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    let year = Number(parts[2]);
    if (year > 2400) year -= 543;
    const d = new Date(year, month, day);
    return isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function rowTemplate(row, idx) {
  const status = String(row.typeLabel || "");
  const statusClass = status === "ยืม"
    ? "status-borrow"
    : status === "คืน"
      ? "status-return"
      : status === "โอน"
        ? "status-transfer"
        : "";
  const rowClass = row.optimistic
    ? "row-optimistic"
    : status === "ยืม"
      ? "row-borrow"
      : status === "คืน"
        ? "row-return"
        : status === "โอน"
          ? "row-transfer"
        : "";
  const extraParts = [];
  if (row.phoneNumber) extraParts.push(`เบอร์โทร: ${row.phoneNumber}`);
  if (row.referenceNo) extraParts.push(`เลขอ้างอิง: ${row.referenceNo}`);
  const detailText = extraParts.length
    ? `${row.detail || "-"} | ${extraParts.join(" | ")}`
    : (row.detail || "-");
  return `
    <tr class="${rowClass}" data-row-index="${idx}">
      <td>${escapeHtml(row.timestamp || "-")}</td>
      <td>${escapeHtml(row.referenceNo || "-")}</td>
      <td>${escapeHtml(row.actor || "-")}</td>
      <td>${escapeHtml(row.serviceUser || "-")}</td>
      <td><span class="status-chip ${statusClass}">${escapeHtml(row.typeLabel || "-")}</span></td>
      <td>${escapeHtml(row.item || "-")}</td>
      <td>${escapeHtml(String(row.quantity || "-"))}</td>
      <td><div class="recent-detail">${escapeHtml(detailText)}</div></td>
    </tr>
  `;
}

function renderRecent(rows) {
  visibleRowsCache = rows.slice();
  if (!rows.length) {
    recentBody.innerHTML = `<tr><td colspan="8">ยังไม่มีข้อมูลของ ${escapeHtml(currentEquipment)}</td></tr>`;
    return;
  }
  recentBody.innerHTML = rows.map((row, idx) => rowTemplate(row, idx)).join("");
}

function setImageNode(imageUrl, linkEl, imageEl, emptyEl) {
  const hasImage = Boolean(String(imageUrl || "").trim());
  if (!linkEl || !imageEl || !emptyEl) return;
  if (!hasImage) {
    linkEl.hidden = true;
    linkEl.removeAttribute("href");
    imageEl.removeAttribute("src");
    emptyEl.hidden = false;
    return;
  }
  const url = String(imageUrl).trim();
  linkEl.hidden = false;
  linkEl.href = url;
  imageEl.src = url;
  emptyEl.hidden = true;
}

function openImageModalByRow(row) {
  if (!row || !imageModal) return;
  setImageNode(row.depositImageUrl, depositImageLink, depositImagePreview, depositImageEmpty);
  setImageNode(row.idCardImageUrl, idCardImageLink, idCardImagePreview, idCardImageEmpty);
  if (!row.depositImageUrl && !row.idCardImageUrl) {
    setStatus("รายการนี้ยังไม่มีรูปหลักฐาน", "error");
    return;
  }
  imageModal.hidden = false;
}

function closeImageModal() {
  if (!imageModal) return;
  imageModal.hidden = true;
}

function updateStats(rows) {
  const row = rows && rows.length ? rows[0] : null;
  if (statEquipment) statEquipment.textContent = currentEquipment || "-";
  if (statStatus) statStatus.textContent = row ? (row.typeLabel || "-") : "-";
  if (statBorrower) statBorrower.textContent = row ? (row.actor || "-") : "-";
  if (statServiceUser) statServiceUser.textContent = row ? (row.serviceUser || "-") : "-";
  if (statPatient) {
    const patient = row && row.detail ? row.detail.match(/ผู้ป่วย:\s*([^|]+)/) : null;
    statPatient.textContent = patient ? patient[1].trim() : "-";
  }
  if (statPhone) statPhone.textContent = row ? (row.phoneNumber || "-") : "-";
  if (statUpdated) statUpdated.textContent = row ? (row.timestamp || "-") : "-";
}

function updateInventoryDisplay() {
  if (!statTotal || !statAvailable) return;
  const total = currentInventory ? currentInventory.total : 0;
  const remaining = currentInventory ? currentInventory.remaining : 0;
  statTotal.textContent = String(total ?? 0);
  statAvailable.textContent = String(remaining ?? 0);
  statAvailable.classList.toggle("negative", Number(remaining) < 0);
  if (inventoryEquipmentLabel) {
    inventoryEquipmentLabel.textContent = `อุปกรณ์: ${currentEquipment || "-"}`;
  }
}

function applyOptimisticRow(payload, eventType) {
  if (!payload || !eventType) return;
  const now = new Date();
  let status = "คืน";
  if (eventType === "borrow") status = "ยืม";
  if (eventType === "transfer") status = "โอน";
  const patient = payload.patientName ? `ผู้ป่วย: ${payload.patientName}` : "";
  const oldPatient = payload.patientOldName ? `ผู้ป่วยเดิม: ${payload.patientOldName}` : "";
  let dateLabel = "สิ้นสุด";
  let dateValue = payload.returnDate;
  if (eventType === "borrow") {
    dateLabel = "วันที่ยืม";
    dateValue = payload.borrowDate;
  } else if (eventType === "transfer") {
    dateLabel = "วันที่โอน";
    dateValue = payload.transferDate;
  }
  const eventNote = payload.eventNote ? `| ${payload.eventNote}` : "";
  const parts = [];
  if (patient) parts.push(patient);
  if (oldPatient) parts.push(oldPatient);
  parts.push(`${dateLabel}: ${dateValue || "-"}`);
  if (eventNote) parts.push(eventNote.replace(/^\|\s*/, ""));
  const detail = parts.join(" | ").trim();

  const row = {
    optimistic: true,
    timestamp: now.toLocaleDateString("th-TH"),
    typeLabel: status,
    actor: payload.borrowerName || "-",
    serviceUser: getCurrentDisplayName(),
    item: currentEquipment,
    quantity: payload.quantity || "-",
    phoneNumber: payload.phoneNumber || "",
    addressText: payload.addressText || "",
    detail: detail || "-"
  };

  recentRows = [row, ...recentRows].slice(0, recentLimit);
  renderRecentFiltered();
  updateStats(recentRows);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function handleInventoryAdjust(eventType) {
  if (!inventoryQtyInput) return;
  const qty = Number(inventoryQtyInput.value || 0);
  if (!isFinite(qty) || qty <= 0) {
    setStatus("จำนวนต้องเป็นตัวเลขมากกว่า 0", "error");
    return;
  }
  try {
    setStatus("กำลังปรับจำนวน...");
    await submitEvent(eventType, {
      equipmentName: currentEquipment,
      quantity: qty
    });
    setStatus("ปรับจำนวนสำเร็จ", "success");
    inventoryQtyInput.value = "1";
    await loadInventory();
  } catch (err) {
    setStatus(err.message || "ปรับจำนวนไม่สำเร็จ", "error");
  }
}

function setTransferGroupState(kind) {
  const isCross = kind === "cross";
  const crossGroup = document.querySelector(".transfer-cross");
  const sameGroup = document.querySelector(".transfer-same");
  if (crossGroup) {
    crossGroup.style.display = isCross ? "block" : "none";
    crossGroup.querySelectorAll("select, input").forEach((el) => {
      el.disabled = !isCross;
    });
  }
  if (sameGroup) {
    sameGroup.style.display = isCross ? "none" : "block";
    sameGroup.querySelectorAll("select, input").forEach((el) => {
      el.disabled = isCross;
    });
  }
}

function handleTransferSubmit(event) {
  event.preventDefault();
  const kind = transferKindSelect ? transferKindSelect.value : "same";
  const eventType = kind === "cross" ? "transfer_cross" : "transfer";
  handleSubmit(event, eventType);
}

document.getElementById("borrowForm").addEventListener("submit", (e) => handleSubmit(e, "borrow"));
document.getElementById("returnForm").addEventListener("submit", (e) => handleSubmit(e, "return"));
document.getElementById("transferForm").addEventListener("submit", (e) => handleTransferSubmit(e));
if (inventoryAddBtn) {
  inventoryAddBtn.addEventListener("click", () => handleInventoryAdjust("inventory_add"));
}
if (inventoryRemoveBtn) {
  inventoryRemoveBtn.addEventListener("click", () => handleInventoryAdjust("inventory_remove"));
}
if (transferKindSelect) {
  setTransferGroupState(transferKindSelect.value);
  transferKindSelect.addEventListener("change", () => {
    setTransferGroupState(transferKindSelect.value);
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("borrow_auth");
    window.location.href = "login.html";
  });
}
refreshBtn.addEventListener("click", () => {
  recentLimit = RECENT_FETCH_STEP;
  visibleRecentRows = RECENT_INITIAL_VISIBLE;
  loadRecent();
  loadInventory();
});

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    visibleRecentRows += RECENT_LOAD_MORE_COUNT;
    if (visibleRecentRows > recentRows.length) {
      recentLimit += RECENT_FETCH_STEP;
      loadRecent();
      return;
    }
    renderRecentFiltered();
  });
}

if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => {
    if (window.scrollY > 400) scrollTopBtn.classList.add("show");
    else scrollTopBtn.classList.remove("show");
  });
}

if (recentBody) {
  recentBody.addEventListener("click", (event) => {
    const targetRow = event.target && event.target.closest ? event.target.closest("tr[data-row-index]") : null;
    if (!targetRow) return;
    const idx = Number(targetRow.dataset.rowIndex || -1);
    if (!isFinite(idx) || idx < 0 || idx >= visibleRowsCache.length) return;
    openImageModalByRow(visibleRowsCache[idx]);
  });
}

if (imageModalClose) {
  imageModalClose.addEventListener("click", closeImageModal);
}

if (imageModalBackdrop) {
  imageModalBackdrop.addEventListener("click", closeImageModal);
}

if (recentSearchInput) {
  recentSearchInput.addEventListener("input", () => renderRecentFiltered());
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter || "all";
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderRecentFiltered();
  });
});

if (!requireAuth()) {
  // redirected
} else {
syncEquipmentToForms();
  seedDefaultDates(document.getElementById("borrowForm"));
  seedDefaultDates(document.getElementById("returnForm"));
  seedDefaultDates(document.getElementById("transferForm"));
  setSidebarOpen(false);
  const activeForm = document.querySelector(".form.active");
  if (activeForm) activeForm.classList.add("form-focus");
loadRecent();
loadInventory();
}







