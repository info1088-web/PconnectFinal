// =========================
// IMPORT FIREBASE AUTH
// =========================
import { app } from "../firebase/firebase.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// =========================
// LẤY CÁC PHẦN TỬ TRÊN FORM ĐĂNG KÝ
// =========================
const auth = getAuth(app);
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const displayNameInput = document.getElementById("displayName");
const registerForm = document.getElementById("registerForm");

// =========================
// TẠO TÀI KHOẢN VÀ LƯU TÊN HIỂN THỊ
// =========================
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const displayName = displayNameInput.value.trim();

  if (!displayName) {
    alert("Vui lòng nhập tên của bạn!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName,
    });

    alert("Đăng ký thành công!");
    window.location.href = "./dnhap.html";
  } catch (error) {
    alert(error.message);
  }
});
