import { app } from "../firebase/firebase.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

/* ================= STATE ================= */
let user = null;
let mode = "single";
let item = null;
let items = [];
let quantity = 1;
let paymentMethod = "Thẻ ngân hàng";

/* ================= FORMAT ================= */
const fmt = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;

/* ================= PARAMS ================= */
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    type: p.get("type"),
    id: p.get("id"),
  };
}

/* ================= LOAD ================= */
async function load() {
  const { type, id } = getParams();

  mode = type === "cart" ? "cart" : "single";

  const container = document.getElementById("checkoutProduct");

  /* ================= CART MODE ================= */
  if (mode === "cart") {
    const snap = await getDocs(collection(db, "carts", user.uid, "items"));

    items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    if (!items.length) {
      container.innerHTML = "Giỏ hàng trống";
      document.getElementById("checkoutTotal").textContent = "0đ";
      return;
    }

    renderCart();
    return;
  }

  /* ================= SINGLE MODE ================= */

  // ❗ FIX CHỐNG LỖI THIẾU ID
  if (!id) {
    container.innerHTML = `
      <div style="padding:20px;color:red">
        ❌ Thiếu ID sản phẩm<br><br>
        👉 Hãy quay lại giỏ hàng và chọn "Thanh toán"
      </div>
    `;
    return;
  }

  const snap = await getDoc(doc(db, "carts", user.uid, "items", id));

  if (!snap.exists()) {
    container.innerHTML = "Sản phẩm không tồn tại";
    return;
  }

  item = { id: snap.id, ...snap.data() };
  quantity = Number(item.quantity || 1);

  renderSingle();
}

/* ================= SINGLE ================= */
function renderSingle() {
  document.getElementById("checkoutProduct").innerHTML = `
    <h2>${item.name}</h2>
    <img src="${item.image}" style="width:120px;border-radius:12px"/>
    <p>${fmt(item.price)}</p>

    <div style="display:flex;gap:10px;align-items:center">
      <button onclick="changeQty(-1)">-</button>
      <span id="q">${quantity}</span>
      <button onclick="changeQty(1)">+</button>
    </div>
  `;

  updateTotal();
}

function updateTotal() {
  document.getElementById("checkoutTotal").textContent =
    fmt((item?.price || 0) * quantity);
}

/* ================= CART ================= */
function renderCart() {
  let total = 0;

  document.getElementById("checkoutProduct").innerHTML = items.map(i => {
    const q = Number(i.quantity || 1);
    const subtotal = Number(i.price || 0) * q;
    total += subtotal;

    return `
      <div style="margin-bottom:10px">
        <h3>${i.name}</h3>
        <p>${q} x ${fmt(i.price)} = <b>${fmt(subtotal)}</b></p>
      </div>
    `;
  }).join("");

  document.getElementById("checkoutTotal").textContent = fmt(total);
}

/* ================= PAYMENT ================= */
async function pay() {

  /* ===== CART ===== */
  if (mode === "cart") {

    if (!items.length) {
      alert("Giỏ hàng trống");
      return;
    }

    for (const i of items) {
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        productId: i.productId || i.id,
        name: i.name,
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 1),
        total: Number(i.price || 0) * Number(i.quantity || 1),
        image: i.image || "",
        paymentMethod,
        status: "paid",
        createdAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, "carts", user.uid, "items", i.id));
    }

    alert("Thanh toán tất cả thành công");
    location.href = "./cart.html";
    return;
  }

  /* ===== SINGLE ===== */
  await addDoc(collection(db, "orders"), {
    userId: user.uid,
    productId: item.productId || item.id,
    name: item.name,
    price: Number(item.price || 0),
    quantity,
    total: Number(item.price || 0) * quantity,
    image: item.image || "",
    paymentMethod,
    status: "paid",
    createdAt: serverTimestamp(),
  });

  alert("Thanh toán thành công");
  location.href = "./cart.html";
}

/* ================= QTY ================= */
function changeQty(v) {
  quantity = Math.max(1, quantity + v);
  document.getElementById("q").innerText = quantity;
  updateTotal();
}

/* ================= INIT ================= */
onAuthStateChanged(auth, (u) => {
  if (!u) {
    location.href = "./dnhap.html";
    return;
  }

  user = u;
  load();
});

/* ================= GLOBAL ================= */
window.changeQty = changeQty;
window.pay = pay;