// =========================
// IMPORT FIREBASE AUTH
// =========================
import { app } from "../firebase/firebase.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// =========================
// LẤY CÁC PHẦN TỬ TRONG PROFILE PANEL
// =========================
const auth = getAuth(app);
const profileButton = document.getElementById("profileButton");
const profilePanel = document.getElementById("profilePanel");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const navProfileName = document.getElementById("navProfileName");
const avatarInput = document.getElementById("avatarInput");
const logoutBtn = document.getElementById("logoutBtn");
const avatarTargets = document.querySelectorAll("[data-user-avatar]");

let currentUser = null;

// =========================
// HÀM TIỆN ÍCH CHO PROFILE
// =========================
function getUserName(user) {
  return user.displayName || user.email?.split("@")[0] || "Người dùng";
}

function getInitial(name) {
  return name.trim().charAt(0).toUpperCase() || "P";
}

function getAvatarKey(user) {
  return `pconnect-avatar-${user.uid}`;
}

// =========================
// HIỂN THỊ AVATAR VÀ THÔNG TIN NGƯỜI DÙNG
// =========================
function renderProfile(user) {
  const name = getUserName(user);
  const avatarData = localStorage.getItem(getAvatarKey(user));

  if (profileName) {
    profileName.textContent = name;
  }

  if (profileEmail) {
    profileEmail.textContent = user.email || "";
  }

  if (navProfileName) {
    navProfileName.textContent = name;
  }

  renderAvatar(name, avatarData);
}

// =========================
// MỞ/ĐÓNG PROFILE PANEL
// =========================
if (profileButton && profilePanel) {
  profileButton.addEventListener("click", () => {
    profilePanel.classList.toggle("show");
  });
}

// =========================
// ĐỔI AVATAR VÀ LƯU THEO TỪNG TÀI KHOẢN TRÊN TRÌNH DUYỆT
// =========================
if (avatarInput) {
  avatarInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file || !currentUser) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      localStorage.setItem(getAvatarKey(currentUser), reader.result);
      renderProfile(currentUser);
    };

    reader.readAsDataURL(file);
  });
}

// =========================
// ĐĂNG XUẤT KHỎI FIREBASE
// =========================
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./dnhap.html";
  });
}

// =========================
// KIỂM TRA PHIÊN ĐĂNG NHẬP VÀ RENDER PROFILE
// =========================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./dnhap.html";
    return;
  }

  currentUser = user;
  renderProfile(user);
});

export const ADMIN_EMAIL = "admin@pconnect.com";

export function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}
