import { app } from "../firebase/firebase.js";
import { cloudinaryConfig } from "../firebase/cloudinary.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);
const productsRef = collection(db, "products");

let currentUser = null;
let products = [];
let apiProducts = [];
let currentFilter = "new";
let unsubscribeProducts = null;
let unsubscribeCart = null;

const defaultProducts = [
  {
    id: "ao-hoodie-pconnect",
    name: "Áo hoodie Pconnect",
    price: 399000,
    description: "Áo hoodie mềm, dễ mặc hằng ngày và phù hợp với phong cách năng động.",
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80",
    tags: ["new", "best"],
  },
  {
    id: "tai-nghe-mini-bass",
    name: "Tai nghe Mini Bass",
    price: 249000,
    description: "Âm thanh gọn, pin bền và thiết kế nhỏ nhẹ cho việc học tập, giải trí.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    tags: ["best", "sale"],
  },
  {
    id: "balo-di-hoc",
    name: "Balo đi học",
    price: 319000,
    description: "Nhiều ngăn tiện dụng, chất liệu chống bám bẩn và quai đeo êm vai.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
    tags: ["new"],
  },
  {
    id: "binh-giu-nhiet",
    name: "Bình giữ nhiệt",
    price: 159000,
    description: "Giữ nóng lạnh tốt, nắp kín và dễ mang theo trong mọi lịch trình.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80",
    tags: ["sale"],
  },
  {
    id: "so-tay-sang-tao",
    name: "Sổ tay sáng tạo",
    price: 89000,
    description: "Giấy dày, bìa cứng và bố cục tối giản cho ghi chú mỗi ngày.",
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80",
    tags: ["new", "sale"],
  },
  {
    id: "den-ban-led",
    name: "Đèn bàn LED",
    price: 229000,
    description: "Ánh sáng dịu mắt, nhiều mức sáng và góc gập linh hoạt.",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
    tags: ["best"],
  },
];

const filterLabels = {
  new: "Mới nhất",
  best: "Bán chạy",
  sale: "Khuyến mãi",
};

const externalProductsApi = "https://fakestoreapi.com/products";

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

function normalizeApiProduct(product) {
  const price = Math.round(Number(product.price || 0) * 25000);
  const tags = ["new"];

  if (product.rating?.rate >= 4) {
    tags.push("best");
  }

  if (Number(product.price || 0) <= 50) {
    tags.push("sale");
  }

  return {
    id: `api-${product.id}`,
    name: product.title,
    price,
    description: product.description,
    image: product.image,
    tags,
    sellerId: "external-api",
    sellerName: "Kho API",
  };
}

async function fetchExternalProducts() {
  try {
    const response = await fetch(externalProductsApi);

    if (!response.ok) {
      throw new Error("Không thể tải sản phẩm từ API ngoài.");
    }

    const data = await response.json();
    apiProducts = Array.isArray(data)
      ? data.map(normalizeApiProduct)
      : [];
    renderProducts();
  } catch {
    apiProducts = [];
    renderProducts();
  }
}

function getCartRef() {
  if (!currentUser) {
    return null;
  }

  return collection(db, "carts", currentUser.uid, "items");
}

function isCloudinaryConfigured() {
  return (
    cloudinaryConfig.cloudName &&
    cloudinaryConfig.uploadPreset &&
    !cloudinaryConfig.cloudName.includes("YOUR_") &&
    !cloudinaryConfig.uploadPreset.includes("YOUR_")
  );
}

async function uploadProductImage(file) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Bạn cần cấu hình Cloudinary trước khi đăng sản phẩm.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", "pconnect-products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Không thể tải ảnh sản phẩm lên Cloudinary.");
  }

  return data.secure_url;
}

async function seedDefaultProducts() {
  await Promise.all(defaultProducts.map((product) =>
    setDoc(doc(db, "products", product.id), {
      ...product,
      sellerId: "pconnect",
      sellerName: "Pconnect",
      isDefault: true,
      createdAt: serverTimestamp(),
    }, { merge: true })
  ));
}

function renderProducts() {
  const grid = document.getElementById("productGrid");

  if (!grid) {
    return;
  }

  const source = [
    ...products,
    ...apiProducts,
    ...defaultProducts.filter((defaultProduct) =>
      !products.some((product) => product.id === defaultProduct.id)
    ),
  ];
  const visibleProducts = source.filter((product) =>
    product.tags?.includes(currentFilter)
  );

  if (visibleProducts.length === 0) {
    grid.innerHTML = `<div class="grid-message">Chưa có sản phẩm trong mục này.</div>`;
    return;
  }

  grid.innerHTML = visibleProducts
    .map((product) => `
      <article class="product-card">
        <div class="product-media">
          <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" />
        </div>
        <div class="product-body">
          <h2>${escapeHTML(product.name)}</h2>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-description">${escapeHTML(product.description)}</p>
          <button class="buy-button" type="button" onclick="addProductToCart('${escapeHTML(product.id)}')">Thêm vào giỏ</button>
        </div>
      </article>
    `)
    .join("");
}

function renderCart(items) {
  const list = document.getElementById("cartList");
  const total = document.getElementById("cartTotal");

  if (!list || !total) {
    return;
  }

  if (items.length === 0) {
    list.innerHTML = `<p class="cart-empty">Giỏ hàng của bạn đang trống.</p>`;
    total.textContent = "Tổng cộng: 0đ";
    return;
  }

  list.innerHTML = items.map((item) => `
    <article class="cart-item">
      <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" />
      <div>
        <h4>${escapeHTML(item.name)}</h4>
        <p>${escapeHTML(item.description)}</p>
        <strong>${formatPrice(item.price)}</strong>
      </div>
    </article>
  `).join("");

  const sum = items.reduce((totalPrice, item) => totalPrice + Number(item.price || 0), 0);
  total.textContent = `Tổng cộng: ${formatPrice(sum)}`;
}

function setupShoppingFilters() {
  const buttons = Array.from(document.querySelectorAll(".pill"));

  if (buttons.length === 0) {
    return;
  }

  const fallbackFilters = ["new", "best", "sale"];

  buttons.forEach((button, index) => {
    if (!button.dataset.shopFilter) {
      button.dataset.shopFilter = fallbackFilters[index] || "new";
    }

    button.type = "button";
    button.textContent = filterLabels[button.dataset.shopFilter] || button.textContent.trim();

    button.addEventListener("click", () => {
      currentFilter = button.dataset.shopFilter;
      buttons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderProducts();
    });
  });
}

function watchProducts() {
  if (unsubscribeProducts) {
    unsubscribeProducts();
  }

  const productsQuery = query(productsRef, orderBy("createdAt", "desc"));

  unsubscribeProducts = onSnapshot(productsQuery, async (snapshot) => {
    products = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    if (products.length === 0) {
      await seedDefaultProducts();
      return;
    }

    renderProducts();
  }, () => {
    products = defaultProducts;
    renderProducts();
  });
}

function watchCart() {
  if (unsubscribeCart) {
    unsubscribeCart();
  }

  const cartRef = getCartRef();

  if (!cartRef) {
    renderCart([]);
    return;
  }

  unsubscribeCart = onSnapshot(
    query(cartRef, orderBy("createdAt", "desc")),
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      renderCart(items);
    },
    () => renderCart([])
  );
}

function toggleProductComposer() {
  document.getElementById("productComposer")?.classList.toggle("show");
}

function toggleCartPanel() {
  document.getElementById("cartPanel")?.classList.toggle("show");
}

async function postProduct() {
  if (!currentUser) {
    alert("Vui lòng đăng nhập trước khi đăng sản phẩm.");
    window.location.href = "./dnhap.html";
    return;
  }

  const nameInput = document.getElementById("productNameInput");
  const priceInput = document.getElementById("productPriceInput");
  const descriptionInput = document.getElementById("productDescriptionInput");
  const imageInput = document.getElementById("productImageInput");
  const submitButton = document.getElementById("submitProductBtn");

  const name = nameInput?.value.trim();
  const price = Number(priceInput?.value || 0);
  const description = descriptionInput?.value.trim();
  const imageFile = imageInput?.files?.[0];

  if (!name || !price || !description || !imageFile) {
    alert("Vui lòng nhập đầy đủ tên, giá, mô tả và ảnh sản phẩm.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Đang đăng...";

  try {
    const image = await uploadProductImage(imageFile);

    await addDoc(productsRef, {
      name,
      price,
      description,
      image,
      tags: ["new"],
      sellerId: currentUser.uid,
      sellerName: currentUser.displayName || currentUser.email || "Người bán",
      createdAt: serverTimestamp(),
    });

    nameInput.value = "";
    priceInput.value = "";
    descriptionInput.value = "";
    imageInput.value = "";
    document.getElementById("productComposer")?.classList.remove("show");
  } catch (error) {
    alert(error.message || "Không thể đăng sản phẩm lúc này.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Đăng sản phẩm";
  }
}

async function addProductToCart(productId) {
  if (!currentUser) {
    alert("Vui lòng đăng nhập trước khi thêm sản phẩm vào giỏ hàng.");
    window.location.href = "./dnhap.html";
    return;
  }

  const product = products.find((item) => item.id === productId) ||
    apiProducts.find((item) => item.id === productId) ||
    defaultProducts.find((item) => item.id === productId);

  if (!product) {
    alert("Không tìm thấy sản phẩm.");
    return;
  }

  const cartRef = getCartRef();

  await addDoc(cartRef, {
    productId: product.id,
    name: product.name,
    price: Number(product.price || 0),
    description: product.description,
    image: product.image,
    sellerId: product.sellerId || "pconnect",
    sellerName: product.sellerName || "Pconnect",
    quantity: 1,
    createdAt: serverTimestamp(),
  });

  document.getElementById("cartPanel")?.classList.add("show");
}

async function addProductsToFirestore(productList) {
  if (!Array.isArray(productList)) {
    throw new Error("Dữ liệu sản phẩm phải là một mảng.");
  }

  await Promise.all(productList.map((product) =>
    addDoc(productsRef, {
      name: product.name,
      price: Number(product.price || 0),
      description: product.description,
      image: product.image,
      tags: product.tags || ["new"],
      sellerId: currentUser?.uid || "api",
      sellerName: currentUser?.displayName || currentUser?.email || "API",
      createdAt: serverTimestamp(),
    })
  ));
}

setupShoppingFilters();
renderProducts();
fetchExternalProducts();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  watchProducts();
  watchCart();
});

window.toggleProductComposer = toggleProductComposer;
window.toggleCartPanel = toggleCartPanel;
window.postProduct = postProduct;
window.addProductToCart = addProductToCart;
window.addProductsToFirestore = addProductsToFirestore;
