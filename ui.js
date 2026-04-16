(function () {
  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem("borrow_auth") || "null");
    } catch (err) {
      return null;
    }
  }

  function isAdmin() {
    const auth = getAuth();
    return Boolean(auth && auth.role === "admin" && auth.token);
  }

  function ensureToastHost() {
    let host = document.getElementById("appToastHost");
    if (host) return host;
    host = document.createElement("div");
    host.id = "appToastHost";
    host.className = "app-toast-host";
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, type = "info") {
    if (!message) return;
    const host = ensureToastHost();
    const toast = document.createElement("div");
    toast.className = `app-toast ${type}`;
    toast.textContent = message;
    host.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 180);
    }, 2600);
  }

  function bindAdminLinks() {
    document.querySelectorAll('a[href="admin.html"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        if (isAdmin()) return;
        event.preventDefault();
        showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
      });
    });
  }

  function bindInventoryLinks() {
    document.querySelectorAll('a[href="inventory.html"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        if (isAdmin()) return;
        event.preventDefault();
        showToast("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
      });
    });
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "confirm-modal";
      modal.innerHTML = `
        <div class="confirm-card" role="dialog" aria-modal="true" aria-label="ยืนยันการดำเนินการ">
          <div class="confirm-icon">!</div>
          <h3>ยืนยันการลบ</h3>
          <p></p>
          <div class="confirm-actions">
            <button type="button" class="ghost confirm-cancel">ยกเลิก</button>
            <button type="button" class="danger confirm-ok">ลบ</button>
          </div>
        </div>
      `;
      modal.querySelector("p").textContent = String(message || "");
      document.body.appendChild(modal);
      window.requestAnimationFrame(() => modal.classList.add("show"));
      const cleanup = (value) => {
        modal.classList.remove("show");
        window.setTimeout(() => modal.remove(), 180);
        resolve(value);
      };
      modal.addEventListener("click", (event) => {
        if (event.target === modal) cleanup(false);
      });
      modal.querySelector(".confirm-cancel")?.addEventListener("click", () => cleanup(false));
      modal.querySelector(".confirm-ok")?.addEventListener("click", () => cleanup(true));
    });
  }

  window.AppUI = {
    getAuth,
    isAdmin,
    showToast,
    bindAdminLinks,
    bindInventoryLinks,
    confirmAction
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAdminLinks);
    document.addEventListener("DOMContentLoaded", bindInventoryLinks);
  } else {
    bindAdminLinks();
    bindInventoryLinks();
  }
})();
