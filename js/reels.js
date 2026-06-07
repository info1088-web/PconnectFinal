// =========================
// IMPORT FIREBASE, FIRESTORE VÀ CLOUDINARY
// =========================
import { app } from "../firebase/firebase.js";
import { cloudinaryConfig } from "../firebase/cloudinary.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================
// KHỞI TẠO DỮ LIỆU CHUNG
// =========================
const auth = getAuth(app);
const db = getFirestore(app);
const reelsRef = collection(db, "reels");
const themeStorageKey = "pconnect-theme";

let currentUser = null;
let selectedReelFile = null;
let selectedReelPreview = "";
let userReels = [];
let currentReelIndex = 0;
let isReelChanging = false;
let reelScrollAnimation = null;
let reelsPlaybackEnabled = true;

const reelScrollDuration = 950;
const reelScrollCooldown = 1100;

const defaultReels = [
  {
    title: "Chú chó chạy tung tăng",
    authorName: "Pconnect Picks",
    videoUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4",
  },
  {
    title: "Khoảnh khắc boomerang vui nhộn",
    authorName: "Pconnect Picks",
    videoUrl: "https://res.cloudinary.com/demo/video/upload/so_3,eo_5,e_boomerang/dog-running.mp4",
  },
  {
    title: "Short demo dọc",
    authorName: "Pconnect Picks",
    videoUrl: "https://res.cloudinary.com/demo/video/upload/w_360,h_640,c_fill/dog.mp4",
  },
];

// =========================
// HÀM TIỆN ÍCH
// =========================
function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrentProfileName() {
  const name = document.getElementById("navProfileName");
  return name ? name.textContent.trim() || "Bạn" : "Bạn";
}

function isCloudinaryConfigured() {
  return (
    cloudinaryConfig.cloudName &&
    cloudinaryConfig.uploadPreset &&
    !cloudinaryConfig.cloudName.includes("YOUR_") &&
    !cloudinaryConfig.uploadPreset.includes("YOUR_")
  );
}

// =========================
// DARK MODE CHO TRANG REELS
// =========================
function syncThemeButton() {
  const btn = document.getElementById("darkModeBtn");

  if (!btn) {
    return;
  }

  btn.textContent = document.body.classList.contains("dark-mode")
    ? "Sáng"
    : "Tối";
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);

  document.body.classList.toggle("dark-mode", savedTheme === "dark");
  syncThemeButton();
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    themeStorageKey,
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
  syncThemeButton();
}

// =========================
// FORM ĐĂNG REELS
// =========================
function toggleReelComposer() {
  document.getElementById("reelComposer").classList.toggle("show");
}

function previewReelVideo(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("reelPreview");

  if (!file) {
    selectedReelFile = null;
    selectedReelPreview = "";
    preview.innerHTML = "<span>Chọn một clip ngắn từ máy của bạn</span>";
    return;
  }

  selectedReelFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    selectedReelPreview = reader.result;
    preview.innerHTML = `<video src="${selectedReelPreview}" controls muted></video>`;
  };
  reader.readAsDataURL(file);
}

function setReelPosting(isPosting) {
  const button = document.getElementById("postReelBtn");

  button.disabled = isPosting;
  button.textContent = isPosting ? "Đang post..." : "⬆ Post";
}

async function uploadReelToCloudinary(file) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Bạn cần điền Cloudinary cloudName và unsigned uploadPreset trước khi đăng reels.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", "pconnect-reels");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Không thể upload reels lên Cloudinary.");
  }

  return data.secure_url;
}

async function postReel() {
  const titleInput = document.getElementById("reelTitleInput");
  const title = titleInput.value.trim();

  if (!currentUser) {
    alert("Vui lòng đăng nhập trước khi đăng reels.");
    window.location.href = "./dnhap.html";
    return;
  }

  if (!title || !selectedReelFile) {
    alert("Vui lòng nhập title và chọn một clip để đăng reels.");
    return;
  }

  setReelPosting(true);

  try {
    const videoUrl = await uploadReelToCloudinary(selectedReelFile);

    await addDoc(reelsRef, {
      title,
      videoUrl,
      authorId: currentUser.uid,
      authorName: getCurrentProfileName(),
      authorEmail: currentUser.email || "",
      createdAt: serverTimestamp(),
    });

    titleInput.value = "";
    selectedReelFile = null;
    selectedReelPreview = "";
    document.getElementById("reelVideoInput").value = "";
    document.getElementById("reelPreview").innerHTML =
      "<span>Chọn một clip ngắn từ máy của bạn</span>";
    document.getElementById("reelComposer").classList.remove("show");
  } catch (error) {
    alert(error.message);
  } finally {
    setReelPosting(false);
  }
}

// =========================
// HIỂN THỊ REELS
// =========================
function renderReels() {
  const feed = document.getElementById("reelsFeed");
  const reels = [...userReels, ...defaultReels];

  feed.innerHTML = reels
    .map((reel, index) => {
      const badge = reel.isUserReel ? "Reels của cộng đồng" : "Gợi ý";
      const canDelete = reel.isUserReel && reel.authorId === currentUser?.uid;
      const deleteButton = canDelete
        ? `<button class="delete-reel-btn" type="button" title="Xóa reels" onclick="deleteReel('${escapeHTML(reel.id)}', ${index})">🗑</button>`
        : "";

      return `
        <article class="reel-card" data-reel-card>
          <video src="${escapeHTML(reel.videoUrl)}" controls loop playsinline></video>
          ${deleteButton}
          <div class="reel-scroll-hint">Scroll / Space</div>
          <div class="reel-info">
            <span>${badge}</span>
            <h3>${escapeHTML(reel.title)}</h3>
            <p>${escapeHTML(reel.authorName || "Pconnect")}</p>
          </div>
        </article>
      `;
    })
    .join("");

  currentReelIndex = Math.max(0, Math.min(currentReelIndex, reels.length - 1));
  activateReel(currentReelIndex, false);
}

async function deleteReel(reelId, reelIndex) {
  if (!currentUser || !reelId) {
    return;
  }

  const deletedReel = userReels.find((reel) => reel.id === reelId);

  if (!deletedReel || deletedReel.authorId !== currentUser.uid) {
    alert("Bạn chỉ có thể xóa reels do chính bạn đăng.");
    return;
  }

  const totalReels = userReels.length + defaultReels.length;
  currentReelIndex = Math.max(0, Math.min(reelIndex, totalReels - 2));

  try {
    await deleteDoc(doc(db, "reels", reelId));
  } catch (error) {
    alert(error.message || "Không thể xóa reels lúc này.");
  }
}

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

function animateReelScroll(feed, targetTop, duration) {
  const startTop = feed.scrollTop;
  const distance = targetTop - startTop;
  const startTime = performance.now();

  if (reelScrollAnimation) {
    cancelAnimationFrame(reelScrollAnimation);
  }

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    feed.scrollTop = startTop + distance * easeOutCubic(progress);

    if (progress < 1) {
      reelScrollAnimation = requestAnimationFrame(step);
      return;
    }

    feed.scrollTop = targetTop;
    reelScrollAnimation = null;
  }

  reelScrollAnimation = requestAnimationFrame(step);
}

function isReelsViewActive() {
  const reelsView = document.getElementById("reelsView");
  return !reelsView || reelsView.classList.contains("active");
}

function stopAllReelVideos({ reset = true } = {}) {
  document.querySelectorAll("[data-reel-card] video").forEach((video) => {
    video.pause();
    video.muted = true;

    if (reset) {
      video.currentTime = 0;
    }
  });
}

function setReelsPlaybackEnabled(isEnabled, { restart = false } = {}) {
  reelsPlaybackEnabled = isEnabled;

  if (!isEnabled) {
    stopAllReelVideos({ reset: true });
    return;
  }

  activateReel(currentReelIndex, false, { restart });
}

function activateReel(index, smooth = true, { restart = false } = {}) {
  const feed = document.getElementById("reelsFeed");
  const cards = Array.from(document.querySelectorAll("[data-reel-card]"));

  if (!feed || cards.length === 0) {
    return;
  }

  currentReelIndex = Math.max(0, Math.min(index, cards.length - 1));
  reelsPlaybackEnabled = isReelsViewActive();
  const targetTop = currentReelIndex * feed.clientHeight;

  if (smooth) {
    animateReelScroll(feed, targetTop, reelScrollDuration);
  } else {
    feed.scrollTop = targetTop;
  }

  cards.forEach((card, cardIndex) => {
    const video = card.querySelector("video");

    card.classList.toggle("active", cardIndex === currentReelIndex);
    card.classList.toggle("near-active", Math.abs(cardIndex - currentReelIndex) === 1);

    if (!video) {
      return;
    }

    if (cardIndex !== currentReelIndex) {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      return;
    }

    if (!reelsPlaybackEnabled) {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      return;
    }

    if (restart) {
      video.currentTime = 0;
    }

    video.muted = false;
    video.play().catch(() => {
      video.muted = true;

      video.play();
    });
  });
}

function moveReel(direction) {
  if (isReelChanging || !isReelsViewActive()) {
    return;
  }

  const cards = document.querySelectorAll("[data-reel-card]");
  const targetIndex = Math.max(0, Math.min(currentReelIndex + direction, cards.length - 1));

  if (targetIndex === currentReelIndex) {
    return;
  }

  isReelChanging = true;
  activateReel(targetIndex);

  window.setTimeout(() => {
    isReelChanging = false;
  }, reelScrollCooldown);
}

function setupReelControls() {
  const feed = document.getElementById("reelsFeed");

  if (!feed || feed.dataset.controlsReady) {
    return;
  }

  feed.dataset.controlsReady = "true";

  feed.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (Math.abs(event.deltaY) < 10) {
      return;
    }

    moveReel(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    const reelsView = document.getElementById("reelsView");

    if (!reelsView?.classList.contains("active")) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      moveReel(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveReel(-1);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveReel(1);
    }
  });
}

window.addEventListener("pconnect:view-change", (event) => {
  setReelsPlaybackEnabled(event.detail?.view === "reels", { restart: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAllReelVideos({ reset: false });
    return;
  }

  if (isReelsViewActive()) {
    setReelsPlaybackEnabled(true, { restart: false });
  }
});

function watchUserReels() {
  const reelsQuery = query(reelsRef, orderBy("createdAt", "desc"));

  onSnapshot(reelsQuery, (snapshot) => {
    userReels = snapshot.docs.map((doc) => ({
      id: doc.id,
      isUserReel: true,
      ...doc.data(),
    }));

    renderReels();
  }, (error) => {
    document.getElementById("reelsFeed").innerHTML =
      `<p class="feed-status">${escapeHTML(error.message)}</p>`;
  });
}

// =========================
// KHỞI ĐỘNG TRANG
// =========================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./dnhap.html";
    return;
  }

  currentUser = user;
  watchUserReels();
});

applySavedTheme();
renderReels();
setupReelControls();

window.toggleDarkMode = toggleDarkMode;
window.toggleReelComposer = toggleReelComposer;
window.previewReelVideo = previewReelVideo;
window.postReel = postReel;
window.deleteReel = deleteReel;
