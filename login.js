const API_URL = "https://script.google.com/macros/s/AKfycbwXVXpxI0Hi3p5ueO_rSvpG2XHCjI-rPPvnvlQ6xofxCHmrmShHehA1DnAmuL9sDKWcSQ/exec";
const API_PLACEHOLDER = "YOUR_APPS_SCRIPT_WEB_APP_URL";

const form = document.getElementById("loginForm");
const statusEl = document.getElementById("loginStatus");
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "success");
  if (type) statusEl.classList.add(type);
}

async function authenticate(username, password) {
  if (!API_URL || API_URL === API_PLACEHOLDER) {
    throw new Error("ยังไม่ได้ตั้งค่า API_URL ใน web/login.js");
  }
  const payload = new URLSearchParams();
  payload.set("eventType", "auth");
  payload.set("username", username);
  payload.set("password", password);

  const res = await fetch(API_URL, {
    method: "POST",
    body: payload
  });
  if (!res.ok) {
    throw new Error(`เข้าสู่ระบบไม่สำเร็จ (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
  }
  return data.result || {};
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const originalLabel = submitButton ? submitButton.textContent : "";
  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "").trim();

  if (!username || !password) {
    setStatus("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน", "error");
    return;
  }

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "กำลังเข้าสู่ระบบ...";
    }
    const result = await authenticate(username, password);
    const user = result.user || { username };
    localStorage.setItem("borrow_auth", JSON.stringify({
      username: user.username || username,
      displayName: user.displayName || user.username || username,
      role: user.role || "user",
      token: result.token || "",
      ts: Date.now()
    }));
    setStatus("เข้าสู่ระบบสำเร็จ", "success");
    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 200);
  } catch (err) {
    setStatus(err.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel || "เข้าสู่ระบบ";
    }
  }
});
