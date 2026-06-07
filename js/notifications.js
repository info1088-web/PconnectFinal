// =========================
// THÔNG BÁO DÙNG CHUNG CHO PCONNECT
// =========================
import { app } from "../firebase/firebase.js";
import {
  getFirestore,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(app);
const notificationKey = "pconnect-notifications";
const friendRequestNotifyKey = "pconnect-demo-friend-request-notified";

let notifications = loadNotifications();
let watchedPostsOnce = false;
let watchedReelsOnce = false;

function loadNotifications() {
  return JSON.parse(localStorage.getItem(notificationKey) || "[]");
}

function saveNotifications() {
  localStorage.setItem(notificationKey, JSON.stringify(notifications));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNotificationBadge() {
  const badge = document.getElementById("notificationBadge");

  if (!badge) {
    return;
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
  badge.classList.toggle("show", unreadCount > 0);
}

function renderNotificationList() {
  const list = document.getElementById("notificationList");

  if (!list) {
    return;
  }

  if (notifications.length === 0) {
    list.innerHTML = `<p class="notification-empty">Chưa có thông báo nào.</p>`;
    return;
  }

  list.innerHTML = notifications
    .map((item) => `
      <div class="notification-item ${item.read ? "" : "unread"}">
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.message)}</p>
      </div>
    `)
    .join("");
}

function showNotificationPopup(title, message) {
  const popup = document.getElementById("notificationPopup");

  if (!popup) {
    return;
  }

  popup.innerHTML = `
    <strong>${escapeHTML(title)}</strong>
    <p>${escapeHTML(message)}</p>
  `;
  popup.classList.add("show");

  window.setTimeout(() => {
    popup.classList.remove("show");
  }, 3200);
}

function addNotification(type, title, message) {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    message,
    read: false,
    createdAt: Date.now(),
  };

  notifications = [notification, ...notifications].slice(0, 30);
  saveNotifications();
  renderNotificationBadge();
  renderNotificationList();
  showNotificationPopup(title, message);
}

function toggleNotificationPanel() {
  const panel = document.getElementById("notificationPanel");

  if (!panel) {
    return;
  }

  panel.classList.toggle("show");

  if (panel.classList.contains("show")) {
    notifications = notifications.map((item) => ({ ...item, read: true }));
    saveNotifications();
    renderNotificationBadge();
    renderNotificationList();
  }
}

function watchCollectionNotifications(collectionName, type, title, getMessage) {
  onSnapshot(collection(db, collectionName), (snapshot) => {
    const isReady = type === "post" ? watchedPostsOnce : watchedReelsOnce;

    if (!isReady) {
      if (type === "post") {
        watchedPostsOnce = true;
      } else {
        watchedReelsOnce = true;
      }
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type !== "added") {
        return;
      }

      addNotification(type, title, getMessage(change.doc.data()));
    });
  });
}

watchCollectionNotifications("posts", "post", "Bài viết mới", (post) =>
  `${post.authorName || "Một người dùng"} vừa đăng một bài viết mới.`
);

watchCollectionNotifications("reels", "reel", "Reels mới", (reel) =>
  `${reel.authorName || "Một người dùng"} vừa đăng reels: ${reel.title || "Video mới"}.`
);

if (!localStorage.getItem(friendRequestNotifyKey)) {
  localStorage.setItem(friendRequestNotifyKey, "true");
  window.setTimeout(() => {
    addNotification(
      "friend",
      "Lời mời kết bạn mới",
      "Bạn có một vài lời mời kết bạn mới trong mục Friends."
    );
  }, 1000);
}

renderNotificationBadge();
renderNotificationList();

window.toggleNotificationPanel = toggleNotificationPanel;
window.PconnectNotifications = {
  addNotification,
  renderNotificationBadge,
  renderNotificationList,
};
