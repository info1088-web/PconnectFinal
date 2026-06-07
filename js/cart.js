import { app } from "../firebase/firebase.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

/* ================= STATE ================= */
let currentUser = null;
let unsubscribeCart = null;

/* ================= PROFILE ================= */
function renderProfile(user) {
  const nameEl = document.getElementById("profileName");
  const avatarEl = document.getElementById("profileAvatar");

  if (!user || !nameEl || !avatarEl) return;

  const name =
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "User");

  nameEl.textContent = name;
  avatarEl.textContent = name.charAt(0).toUpperCase();
}

/* ================= UTILS ================= */
function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")}đ`;
}

/* ================= CART REF ================= */
function getCartItemRef(itemId) {
  return doc(db, "carts", currentUser.uid, "items", itemId);
}

/* ================= RENDER CART ================= */
function renderCart(items) {
  const list = document.getElementById("cartPageList");
  const count = document.getElementById("cartPageCount");
  const total = document.getElementById("cartPageTotal");

  if (!list || !count || !total) return;

  count.textContent = `${items.length} sản phẩm trong giỏ hàng`;

  if (!items.length) {
    list.innerHTML = `
      <div style="padding:40px;text-align:center;font-weight:600;">
        Giỏ hàng trống
      </div>
    `;
    total.textContent = "0đ";
    return;
  }

  let sum = 0;

  list.innerHTML = items.map((item) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const sub = qty * price;

    sum += sub;

    return `
      <div class="cart-item-row">

        <img src="${escapeHTML(item.image)}" class="cart-item-image" />

        <div class="cart-item-info">
          <h3>${escapeHTML(item.name)}</h3>
          <p>${escapeHTML(item.description || "")}</p>
        </div>

        <div class="cart-item-qty">
          <span>Qty: ${qty}</span>
        </div>

        <div class="cart-item-price">
          ${formatPrice(sub)}
        </div>

        <!-- Thanh toán lẻ -->
        <button onclick="goCheckout('${item.id}')">
          Thanh toán
        </button>

        <!-- Xoá -->
        <button onclick="removeCartItem('${item.id}')">
          ×
        </button>

      </div>
    `;
  }).join("");

  total.textContent = formatPrice(sum);
}

/* ================= WATCH CART ================= */
function watchCart() {
  if (unsubscribeCart) unsubscribeCart();

  const cartRef = collection(db, "carts", currentUser.uid, "items");
  const q = query(cartRef, orderBy("createdAt", "desc"));

  unsubscribeCart = onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    renderCart(items);
  });
}

/* ================= ACTIONS ================= */

/* checkout 1 sản phẩm */
function goCheckout(id) {
  if (!id) return;

  window.location.href = `./checkout.html?type=single&id=${id}`;
}

/* checkout all */
function checkoutAll() {
  window.location.href = "./checkout.html?type=cart";
}

/* remove item */
async function removeCartItem(itemId) {
  await deleteDoc(getCartItemRef(itemId));
}

/* update qty */
async function updateCartQuantity(itemId, quantity) {
  await updateDoc(getCartItemRef(itemId), {
    quantity: Number(quantity || 1),
  });
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./dnhap.html";
    return;
  }

  currentUser = user;

  // 🔥 FIX USERNAME
  renderProfile(user);

  watchCart();
});

/* ================= GLOBAL ================= */
window.removeCartItem = removeCartItem;
window.updateCartQuantity = updateCartQuantity;
window.goCheckout = goCheckout;
window.checkoutAll = checkoutAll;