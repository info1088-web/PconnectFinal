// =========================
// FRIENDS DEMO: lời mời kết bạn tự sinh theo thời gian ngẫu nhiên
// =========================
const acceptedFriendsKey = "pconnect-accepted-friends";
const pendingFriendsKey = "pconnect-pending-friend-requests";
const themeStorageKey = "pconnect-theme";

const friendPool = [
  { id: "minh-anh", name: "Minh Anh", bio: "Muốn kết bạn để cùng xem reels vui.", avatar: "https://i.pravatar.cc/120?img=5" },
  { id: "bao-khang", name: "Bảo Khang", bio: "Đã gửi lời mời kết bạn qua Pconnect.", avatar: "https://i.pravatar.cc/120?img=12" },
  { id: "linh-chi", name: "Linh Chi", bio: "Có vẻ hai bạn có cùng sở thích chia sẻ ảnh.", avatar: "https://i.pravatar.cc/120?img=32" },
  { id: "gia-huy", name: "Gia Huy", bio: "Muốn theo dõi những bài viết mới của bạn.", avatar: "https://i.pravatar.cc/120?img=14" },
  { id: "ngoc-mai", name: "Ngọc Mai", bio: "Đã xem profile của bạn và gửi lời mời.", avatar: "https://i.pravatar.cc/120?img=47" },
  { id: "quang-minh", name: "Quang Minh", bio: "Cùng lớp demo SPCK, muốn kết bạn.", avatar: "https://i.pravatar.cc/120?img=59" },
  { id: "ha-linh", name: "Hà Linh", bio: "Thích các reels vui nhộn trên Pconnect.", avatar: "https://i.pravatar.cc/120?img=25" },
  { id: "tuan-kiet", name: "Tuấn Kiệt", bio: "Muốn kết nối để nhắn tin sau này.", avatar: "https://i.pravatar.cc/120?img=60" },
];

function loadJSON(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPendingRequests() {
  return loadJSON(pendingFriendsKey);
}

function savePendingRequests(requests) {
  saveJSON(pendingFriendsKey, requests);
}

function syncThemeButton() {
  const btn = document.getElementById("darkModeBtn");

  if (!btn) {
    return;
  }

  btn.textContent = document.body.classList.contains("dark-mode") ? "Sáng" : "Tối";
}

function applySavedTheme() {
  document.body.classList.toggle(
    "dark-mode",
    localStorage.getItem(themeStorageKey) === "dark"
  );
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

function seedInitialRequests() {
  if (getPendingRequests().length > 0) {
    return;
  }

  savePendingRequests(friendPool.slice(0, 3));
}

function renderFriendRequests() {
  const container = document.getElementById("friendRequests");
  const pendingRequests = getPendingRequests();

  if (pendingRequests.length === 0) {
    container.innerHTML = `
      <div class="friends-empty">
        <h3>Đang chờ lời mời mới</h3>
        <p>Pconnect sẽ tự tạo thêm lời mời kết bạn sau một khoảng thời gian ngẫu nhiên.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingRequests
    .map((friend) => `
      <article class="friend-card">
        <img src="${friend.avatar}" alt="${friend.name}" />
        <div class="friend-info">
          <h3>${friend.name}</h3>
          <p>${friend.bio}</p>
        </div>
        <div class="friend-actions">
          <button type="button" onclick="acceptFriend('${friend.id}')">Chấp nhận</button>
          <button type="button" class="deny-btn" onclick="denyFriend('${friend.id}')">Deny</button>
        </div>
      </article>
    `)
    .join("");
}

function removePending(friendId) {
  const pendingRequests = getPendingRequests().filter((friend) => friend.id !== friendId);
  savePendingRequests(pendingRequests);
}

function acceptFriend(friendId) {
  const friend = getPendingRequests().find((item) => item.id === friendId);

  if (!friend) {
    return;
  }

  const acceptedFriends = loadJSON(acceptedFriendsKey);

  if (!acceptedFriends.some((item) => item.id === friend.id)) {
    acceptedFriends.push(friend);
    saveJSON(acceptedFriendsKey, acceptedFriends);
  }

  removePending(friendId);
  window.PconnectNotifications?.addNotification(
    "friend",
    "Đã kết bạn",
    `${friend.name} đã được thêm vào nhánh bạn bè cạnh chat box.`
  );
  window.renderChatFriends?.();
  renderFriendRequests();
}

function denyFriend(friendId) {
  const friend = getPendingRequests().find((item) => item.id === friendId);
  removePending(friendId);
  window.PconnectNotifications?.addNotification(
    "friend",
    "Đã từ chối lời mời",
    `Bạn đã từ chối lời mời kết bạn từ ${friend?.name || "một người dùng"}.`
  );
  renderFriendRequests();
}

function addRandomFriendRequest() {
  const pendingRequests = getPendingRequests();
  const acceptedFriends = loadJSON(acceptedFriendsKey);
  const unavailableIds = new Set([
    ...pendingRequests.map((friend) => friend.id),
    ...acceptedFriends.map((friend) => friend.id),
  ]);
  const availableFriends = friendPool.filter((friend) => !unavailableIds.has(friend.id));

  if (availableFriends.length === 0) {
    return;
  }

  const randomFriend = availableFriends[Math.floor(Math.random() * availableFriends.length)];
  savePendingRequests([randomFriend, ...pendingRequests]);
  renderFriendRequests();
  window.PconnectNotifications?.addNotification(
    "friend",
    "Lời mời kết bạn mới",
    `${randomFriend.name} vừa gửi lời mời kết bạn.`
  );
}

function scheduleRandomFriendRequest() {
  const nextDelay = Math.floor(Math.random() * 9000) + 7000;

  window.setTimeout(() => {
    addRandomFriendRequest();
    scheduleRandomFriendRequest();
  }, nextDelay);
}

applySavedTheme();
seedInitialRequests();
renderFriendRequests();
scheduleRandomFriendRequest();

window.toggleDarkMode = toggleDarkMode;
window.acceptFriend = acceptFriend;
window.denyFriend = denyFriend;
