// =========================
// IMPORT FIREBASE AUTH
// =========================
import { app } from "../firebase/firebase.js";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// =========================
// LẤY CÁC PHẦN TỬ TRÊN FORM ĐĂNG NHẬP
// =========================
const auth = getAuth(app);
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorText = document.getElementById("error");

// =========================
// XỬ LÝ ĐĂNG NHẬP VÀ CHUYỂN VÀO TRANG CHÍNH
// =========================
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  errorText.textContent = "";

  if (!email || !password) {
    errorText.textContent = "Vui lòng nhập đầy đủ email và mật khẩu!";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "./index.html";
  } catch (error) {
    if (error.code === "auth/invalid-credential") {
      errorText.textContent = "Email hoặc mật khẩu không đúng!";
      return;
    }

    errorText.textContent = error.message;
  }
});
