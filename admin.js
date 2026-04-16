const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";
const API_PLACEHOLDER = "YOUR_APPS_SCRIPT_WEB_APP_URL";

const adminForm = document.getElementById("adminForm");
const adminStatus = document.getElementById("adminStatus");
const adminUsersBody = document.getElementById("adminUsersBody");
const reloadUsersBtn = document.getElementById("reloadUsersBtn");
const adminLabel = document.getElementById("adminLabel");
const adminTotalUsers = document.getElementById("adminTotalUsers");
const adminTotalAdmins = document.getElementById("adminTotalAdmins");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("borrow_auth") || "null");
  } catch (err) {
    return null;
  }
}

function requireAdmin() {
  const auth = getAuth();
  if (!auth || auth.role !== "admin" || !auth.token) return null;
  if (adminLabel) adminLabel.textContent = auth.displayName || auth.username || "-";
  return auth;
}

const auth = requireAdmin();
if (!auth) {
  const deniedPanel = document.getElementById("adminAccessDenied");
  if (deniedPanel) deniedPanel.hidden = false;
  if (window.AppUI && typeof window.AppUI.showToast === "function") {
    window.AppUI.showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
  }
} else {
  function setStatus(message, type = "") {
    if (!adminStatus) return;
    adminStatus.textContent = message;
    adminStatus.classList.remove("error", "success");
    if (type) adminStatus.classList.add(type);
  }

  async function apiGet(params) {
    if (!API_URL || API_URL === API_PLACEHOLDER) {
      throw new Error("ยังไม่ได้ตั้งค่า API_URL ในไฟล์ admin.js");
    }
    const q = new URLSearchParams(params);
    const res = await fetch(`${API_URL}?${q.toString()}`);
    if (!res.ok) throw new Error(`เรียกข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "เรียกข้อมูลไม่สำเร็จ");
    return data;
  }

  async function apiPost(payload) {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => body.set(k, String(v ?? "")));
    const res = await fetch(API_URL, {
      method: "POST",
      body
    });
    if (!res.ok) throw new Error(`บันทึกไม่สำเร็จ (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
    return data;
  }

  function renderUsers(users) {
    const rows = Array.isArray(users) ? users : [];
    if (adminTotalUsers) adminTotalUsers.textContent = String(rows.length);
    if (adminTotalAdmins) adminTotalAdmins.textContent = String(rows.filter((u) => u.role === "admin").length);

    if (!rows.length) {
      adminUsersBody.innerHTML = `<tr><td colspan="6">ยังไม่มีข้อมูล</td></tr>`;
      return;
    }

    adminUsersBody.innerHTML = rows.map((user) => {
      const roleChip = user.role === "admin"
        ? '<span class="status-chip status-transfer">ผู้ดูแล</span>'
        : '<span class="status-chip status-return">ผู้ใช้</span>';
      const statusChip = user.active === false
        ? '<span class="status-chip status-borrow">ปิดใช้งาน</span>'
        : '<span class="status-chip status-return">ใช้งานได้</span>';
      const created = user.createdAt ? new Date(user.createdAt).toLocaleString("th-TH") : "-";
      return `
        <tr>
          <td>${esc(user.displayName || "-")}</td>
          <td>${esc(user.username || "-")}</td>
          <td>${roleChip}</td>
          <td>${statusChip}</td>
          <td>${esc(created)}</td>
          <td>
            <div class="admin-actions">
              <button type="button" class="ghost" data-edit="${escAttr(user.username || "")}">แก้ไข</button>
              <button type="button" class="danger" data-delete="${escAttr(user.username || "")}">ลบ</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    adminUsersBody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const username = btn.getAttribute("data-edit") || "";
        const user = rows.find((item) => String(item.username || "") === username);
        if (!user) return;
        adminForm.displayName.value = user.displayName || "";
        adminForm.username.value = user.username || "";
        adminForm.password.value = "";
        adminForm.role.value = user.role || "user";
        adminForm.scrollIntoView({ behavior: "smooth", block: "start" });
        adminForm.password.focus();
        setStatus(`กำลังแก้ไขบัญชี: ${user.username} (เว้นรหัสผ่านไว้หากไม่ต้องการเปลี่ยน)`, "success");
      });
    });

    adminUsersBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const username = btn.getAttribute("data-delete") || "";
        if (!username) return;
        const confirmDelete = window.AppUI && typeof window.AppUI.confirmAction === "function"
          ? await window.AppUI.confirmAction(`ต้องการลบบัญชี ${username} ใช่หรือไม่`)
          : window.confirm(`ต้องการลบบัญชี ${username} ใช่หรือไม่`);
        if (!confirmDelete) return;
        try {
          await apiPost({
            eventType: "admin_delete",
            token: auth.token,
            username
          });
          if (window.AppUI && typeof window.AppUI.showToast === "function") {
            window.AppUI.showToast(`ลบบัญชี ${username} สำเร็จ`, "success");
          }
          setStatus(`ลบบัญชี ${username} สำเร็จ`, "success");
          await loadUsers();
        } catch (err) {
          if (window.AppUI && typeof window.AppUI.showToast === "function") {
            window.AppUI.showToast(err.message || "ลบบัญชีไม่สำเร็จ", "error");
          }
          setStatus(err.message || "ลบบัญชีไม่สำเร็จ", "error");
        }
      });
    });
  }

  async function loadUsers() {
    setStatus("กำลังโหลดรายชื่อบัญชี...");
    try {
      const data = await apiGet({
        action: "accounts",
        token: auth.token
      });
      renderUsers(data.users || []);
      setStatus(`โหลดบัญชีแล้ว ${String((data.users || []).length)} รายการ`, "success");
    } catch (err) {
      adminUsersBody.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
      setStatus(err.message || "โหลดข้อมูลไม่สำเร็จ", "error");
    }
  }

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      eventType: "admin_save",
      token: auth.token,
      displayName: String(adminForm.displayName.value || "").trim(),
      username: String(adminForm.username.value || "").trim(),
      password: String(adminForm.password.value || "").trim(),
      role: adminForm.role.value || "user"
    };
    try {
      setStatus("กำลังบันทึกบัญชี...");
      await apiPost(payload);
      setStatus(`บันทึกบัญชี ${payload.username} สำเร็จ`, "success");
      adminForm.password.value = "";
      await loadUsers();
    } catch (err) {
      setStatus(err.message || "บันทึกบัญชีไม่สำเร็จ", "error");
    }
  });

  if (reloadUsersBtn) {
    reloadUsersBtn.addEventListener("click", loadUsers);
  }

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      localStorage.removeItem("borrow_auth");
      window.location.href = "login.html";
    });
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escAttr(value) {
    return esc(value).replaceAll("`", "&#096;");
  }

  loadUsers();
}
