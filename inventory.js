const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";
const API_PLACEHOLDER = "YOUR_APPS_SCRIPT_WEB_APP_URL";

const equipmentTabs = document.querySelectorAll(".equipment-tab");
const inventoryQtyInput = document.getElementById("inventoryQty");
const inventoryAddBtn = document.getElementById("inventoryAddBtn");
const inventoryRemoveBtn = document.getElementById("inventoryRemoveBtn");
const statusEl = document.getElementById("inventoryStatus");
const inventoryLogoutBtn = document.getElementById("inventoryLogoutBtn");

const invStatEquipment = document.getElementById("invStatEquipment");
const invStatTotal = document.getElementById("invStatTotal");
const invStatRemaining = document.getElementById("invStatRemaining");
const invStatBorrowed = document.getElementById("invStatBorrowed");

let currentEquipment = "เตียงผู้ป่วย";
let canUseInventory = false;

function requireAuth() {
  const raw = localStorage.getItem("borrow_auth");
  if (!raw) {
    if (window.AppUI && typeof window.AppUI.showToast === "function") {
      window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
    }
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username) {
      if (window.AppUI && typeof window.AppUI.showToast === "function") {
        window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
      }
      return false;
    }
    if (parsed.role !== "admin") {
      if (window.AppUI && typeof window.AppUI.showToast === "function") {
        window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
      }
      return false;
    }
  } catch (err) {
    if (window.AppUI && typeof window.AppUI.showToast === "function") {
      window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
    }
    return false;
  }
  return true;
}

canUseInventory = requireAuth();

function setStatus(message, type = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove("error", "success");
  if (type) statusEl.classList.add(type);
}

if (inventoryLogoutBtn) {
  inventoryLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("borrow_auth");
    window.location.href = "login.html";
  });
}

async function submitEvent(eventType, payload) {
  if (!API_URL || API_URL === API_PLACEHOLDER) {
    throw new Error("ยังไม่ได้ตั้งค่า API_URL ในไฟล์ inventory.js");
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
    updateInventoryDisplay(result.inventory || {});
  } catch (err) {
    updateInventoryDisplay({});
    setStatus(err.message || "โหลดข้อมูลไม่สำเร็จ", "error");
  }
}

function updateInventoryDisplay(inventory) {
  if (invStatEquipment) invStatEquipment.textContent = currentEquipment || "-";
  if (invStatTotal) invStatTotal.textContent = String(inventory.total ?? 0);
  if (invStatRemaining) invStatRemaining.textContent = String(inventory.remaining ?? 0);
  if (invStatBorrowed) invStatBorrowed.textContent = String(inventory.borrowed ?? 0);
  if (invStatRemaining) invStatRemaining.classList.toggle("negative", Number(inventory.remaining) < 0);
}

async function handleInventoryAdjust(eventType) {
  if (!canUseInventory) return;
  const qty = Number(inventoryQtyInput.value || 0);
  if (!isFinite(qty) || qty <= 0) {
    setStatus("จำนวนต้องมากกว่า 0", "error");
    return;
  }
  const sourceButton = eventType === "inventory_add" ? inventoryAddBtn : inventoryRemoveBtn;
  const originalLabel = sourceButton ? sourceButton.textContent : "";
  try {
    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.textContent = "กำลังบันทึก...";
    }
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
  } finally {
    if (sourceButton) {
      sourceButton.disabled = false;
      sourceButton.textContent = originalLabel || sourceButton.textContent;
    }
  }
}

equipmentTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (!canUseInventory) {
      if (window.AppUI && typeof window.AppUI.showToast === "function") {
        window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
      }
      return;
    }
    currentEquipment = tab.dataset.equipment || currentEquipment;
    equipmentTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    loadInventory();
    setStatus("");
  });
});

if (inventoryAddBtn) {
  inventoryAddBtn.addEventListener("click", () => handleInventoryAdjust("inventory_add"));
}
if (inventoryRemoveBtn) {
  inventoryRemoveBtn.addEventListener("click", () => handleInventoryAdjust("inventory_remove"));
}

if (canUseInventory) {
  loadInventory();
}
