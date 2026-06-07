// =========================
// CẤU HÌNH FIREBASE CHO PCONNECT
// =========================
import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Firebase dùng cho đăng nhập, đăng ký và Firestore.
const firebaseConfig = {
  apiKey: "AIzaSyDUySRg3r7SYI3qJSak5RS0vH9gNXRIISc",
  authDomain: "socialmedia-app-4320c.firebaseapp.com",
  projectId: "socialmedia-app-4320c",
  storageBucket: "socialmedia-app-4320c.firebasestorage.app",
  messagingSenderId: "218750636637",
  appId: "1:218750636637:web:4a1ba53f87e70611bf33b4",
};

// Export app để các file JS khác dùng chung một kết nối Firebase.
export const app = initializeApp(firebaseConfig);
