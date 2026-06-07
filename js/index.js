// =========================
// IMPORT FIREBASE VÀ CONFIG
// =========================
import { app } from "../firebase/firebase.js";
import { cloudinaryConfig } from "../firebase/cloudinary.js";
import { isAdmin } from "./profile-auth.js";

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
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================
// FIREBASE
// =========================
const auth = getAuth(app);
const db = getFirestore(app);

const postsRef = collection(db, "posts");

const themeStorageKey = "pconnect-theme";

let currentUser = null;
let unsubscribePosts = null;

let selectedPostFile = null;
let selectedPostMediaType = "";

// =========================
// UTILS
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

  return name
    ? name.textContent.trim() || "Bạn"
    : "Bạn";
}

function getInitial(name) {
  return name.trim().charAt(0).toUpperCase() || "P";
}

function formatPostTime(createdAt) {
  const date = createdAt?.toDate
    ? createdAt.toDate()
    : null;

  if (!date) {
    return "Vừa xong";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// =========================
// DARK MODE
// =========================
function syncThemeButton() {
  const btn = document.getElementById("darkModeBtn");

  if (!btn) return;

  btn.textContent =
    document.body.classList.contains("dark-mode")
      ? "Sáng"
      : "Tối";
}

function applySavedTheme() {
  const savedTheme =
    localStorage.getItem(themeStorageKey);

  document.body.classList.toggle(
    "dark-mode",
    savedTheme === "dark"
  );

  syncThemeButton();
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");

  localStorage.setItem(
    themeStorageKey,
    document.body.classList.contains("dark-mode")
      ? "dark"
      : "light"
  );

  syncThemeButton();
}

// =========================
// PREVIEW MEDIA
// =========================
function previewPostMedia(event, mediaType) {
  const file = event.target.files[0];

  const preview =
    document.getElementById(
      "postImagePreview"
    );

  if (!file) {
    removePostMedia();
    return;
  }

  selectedPostFile = file;
  selectedPostMediaType = mediaType;

  const reader = new FileReader();

  reader.onload = function () {
    const result = reader.result;

    preview.innerHTML = `
      <div class="preview-image-wrap">

        ${
          mediaType === "video"
            ? `
              <video
                src="${result}"
                controls
                muted
              ></video>
            `
            : `
              <img
                src="${result}"
                alt="preview"
              />
            `
        }

        <button
          type="button"
          onclick="removePostMedia()"
        >
          ×
        </button>

      </div>
    `;
  };

  reader.readAsDataURL(file);
}

function removePostMedia() {
  selectedPostFile = null;
  selectedPostMediaType = "";

  document.getElementById(
    "postImageInput"
  ).value = "";

  document.getElementById(
    "postVideoInput"
  ).value = "";

  document.getElementById(
    "postImagePreview"
  ).innerHTML = "";
}

// =========================
// CLOUDINARY
// =========================
function isCloudinaryConfigured() {
  return (
    cloudinaryConfig.cloudName &&
    cloudinaryConfig.uploadPreset &&
    !cloudinaryConfig.cloudName.includes("YOUR_") &&
    !cloudinaryConfig.uploadPreset.includes("YOUR_")
  );
}

async function uploadMediaToCloudinary(file) {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Bạn chưa cấu hình Cloudinary."
    );
  }

  const formData = new FormData();

  formData.append("file", file);

  formData.append(
    "upload_preset",
    cloudinaryConfig.uploadPreset
  );

  formData.append(
    "folder",
    "pconnect-posts"
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        "Upload thất bại."
    );
  }

  return {
    url: data.secure_url,
    type:
      data.resource_type === "video"
        ? "video"
        : "image",
  };
}

// =========================
// CREATE POST
// =========================
function setPostLoading(isLoading) {
  const button =
    document.getElementById(
      "createPostBtn"
    );

  if (!button) return;

  button.disabled = isLoading;

  button.textContent = isLoading
    ? "..."
    : "⬆";
}

async function createPost() {
  const input =
    document.getElementById(
      "postInput"
    );

  const text = input.value.trim();

  if (!currentUser) {
    alert("Vui lòng đăng nhập.");
    return;
  }

  if (!text && !selectedPostFile) {
    alert(
      "Nhập nội dung hoặc chọn media."
    );

    return;
  }

  setPostLoading(true);

  try {
    const authorName =
      getCurrentProfileName();

    let uploadedMedia = {
      url: "",
      type: "",
    };

    if (selectedPostFile) {
      uploadedMedia =
        await uploadMediaToCloudinary(
          selectedPostFile
        );
    }

    await addDoc(postsRef, {
      text,
      mediaUrl: uploadedMedia.url,
      mediaType: uploadedMedia.type,
      authorId: currentUser.uid,
      authorName,
      authorInitial:
        getInitial(authorName),
      createdAt: serverTimestamp(),
    });

    input.value = "";

    removePostMedia();
  } catch (error) {
    alert(error.message);
  } finally {
    setPostLoading(false);
  }
}

// =========================
// DELETE POST
// =========================
async function deletePost(
  postId,
  authorId
) {
  if (
  !currentUser ||
  (
    currentUser.uid !== authorId &&
    !isAdmin(currentUser)
  )
) {
    alert(
      "Bạn chỉ có thể xóa bài của mình."
    );

    return;
  }

  await deleteDoc(
    doc(db, "posts", postId)
  );
}

// =========================
// COMMENT
// =========================
async function addComment(postId) {
  const input = document.getElementById(
    `comment-input-${postId}`
  );

  const text = input.value.trim();

  if (!text) {
    return;
  }

  const authorName =
    getCurrentProfileName();

  await addDoc(
    collection(
      db,
      "posts",
      postId,
      "comments"
    ),
    {
      text,
      authorId: currentUser.uid,
      authorName,
      authorInitial:
        getInitial(authorName),
      createdAt: serverTimestamp(),
    }
  );

  input.value = "";
}

async function deleteComment(
  postId,
  commentId,
  commentAuthorId
) {

  if (
    !currentUser ||
    (
      currentUser.uid !== commentAuthorId &&
      !isAdmin(currentUser)
    )
  ) {
    alert("Bạn không có quyền xóa bình luận này.");
    return;
  }

  await deleteDoc(
    doc(
      db,
      "posts",
      postId,
      "comments",
      commentId
    )
  );
}

// =========================
// LIKE
// =========================
async function toggleLike(postId) {
  if (!currentUser) return;

  const likeRef = doc(
    db,
    "posts",
    postId,
    "likes",
    currentUser.uid
  );

  const likeSnap =
    await getDoc(likeRef);

  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, {
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  }
}

// =========================
// COMMENT BOX
// =========================
function toggleCommentBox(postId) {
  const box = document.getElementById(
    `comments-${postId}`
  );

  if (!box) return;

  box.classList.toggle("show");
}

// =========================
// RENDER POSTS
// =========================
function renderPosts(snapshot) {
  const feed =
    document.getElementById("postFeed");

  if (snapshot.empty) {
    feed.innerHTML = `
      <p class="feed-status">
        Chưa có bài viết nào.
      </p>
    `;

    return;
  }

  feed.innerHTML = "";

  snapshot.forEach((postDoc) => {
    const post = postDoc.data();

    const postElement =
      document.createElement("article");

    postElement.classList.add(
      "post-card"
    );

    // =========================
    // COMMENTS REALTIME
    // =========================
    const commentsRef = query(
      collection(
        db,
        "posts",
        postDoc.id,
        "comments"
      ),
      orderBy("createdAt", "asc")
    );

    // =========================
    // LIKES REALTIME
    // =========================
    const likesRef = collection(
      db,
      "posts",
      postDoc.id,
      "likes"
    );

    let commentsHTML = "";
    
    let likeCount = 0;

    let liked = false;

    // =========================
    // POST HTML
    // =========================
    postElement.innerHTML = `
      <div class="post-header">

        <div class="post-user">

          <div class="user-avatar">
            ${escapeHTML(
              post.authorInitial || "P"
            )}
          </div>

          <div>
            <h4>
              ${escapeHTML(
                post.authorName
              )}
            </h4>

            <p>
              ${formatPostTime(
                post.createdAt
              )}
            </p>
          </div>

        </div>

        ${
  currentUser.uid === post.authorId ||
  isAdmin(currentUser)
    ? `
      <button
        class="delete-post"
        onclick="deletePost('${postDoc.id}', '${post.authorId}')"
      >
        Xóa
      </button>
    `
    : ""
}

      </div>

      ${
        post.text
          ? `
            <div class="post-content">
              ${escapeHTML(post.text)}
            </div>
          `
          : ""
      }

      ${
        post.mediaUrl
          ? `
            <div class="post-image">

              ${
                post.mediaType ===
                "video"
                  ? `
                    <video
                      src="${escapeHTML(
                        post.mediaUrl
                      )}"
                      controls
                    ></video>
                  `
                  : `
                    <img
                      src="${escapeHTML(
                        post.mediaUrl
                      )}"
                    />
                  `
              }

            </div>
          `
          : ""
      }

      <div class="post-footer">

        <button
          class="like-btn"
          id="like-btn-${postDoc.id}"
          onclick="toggleLike('${postDoc.id}')"
        >
          🤍
          <span id="like-count-${postDoc.id}">
            0
          </span>
        </button>

        <button
          class="comment-toggle-btn"
          onclick="toggleCommentBox('${postDoc.id}')"
        >
          💬
          <span id="comment-count-${postDoc.id}">
            0
          </span>
        </button>

      </div>

      <div
        class="comments-section"
        id="comments-${postDoc.id}"
      >

        <div class="comment-input-row">

          <input
            type="text"
            class="comment-input"
            id="comment-input-${postDoc.id}"
            placeholder="Viết bình luận..."
          />

          <button
            class="comment-send-btn"
            onclick="addComment('${postDoc.id}')"
          >
            Gửi
          </button>

        </div>

        <div
          class="comments-list"
          id="comments-list-${postDoc.id}"
        ></div>

      </div>
    `;

// =========================
// REALTIME COMMENTS
// =========================
onSnapshot(
  commentsRef,
  (commentsSnap) => {
    const commentsList =
      document.getElementById(
        `comments-list-${postDoc.id}`
      );

    const commentCount =
      document.getElementById(
        `comment-count-${postDoc.id}`
      );

    let commentsHTML = "";

    commentsSnap.forEach(
      (commentDoc) => {
        const comment =
          commentDoc.data();


        commentsHTML += `
          <div class="comment-item">

            <div class="user-avatar">
              ${escapeHTML(
                comment.authorInitial || "P"
              )}
            </div>

            <div class="comment-content">

              <div class="comment-bubble">

                <div class="comment-author">
                  ${escapeHTML(
                    comment.authorName
                  )}
                </div>

                <div class="comment-text">
                  ${escapeHTML(
                    comment.text
                  )}
                </div>

              </div>

              ${
  currentUser.uid === comment.authorId ||
  isAdmin(currentUser)
    ? `
      <div class="comment-actions">

        <button
          class="delete-comment-btn"
          onclick="deleteComment(
            '${postDoc.id}',
            '${commentDoc.id}',
            '${comment.authorId}'
          )"
        >
          Xóa
        </button>

      </div>
    `
    : ""
}

            </div>

          </div>
        `;
      }
    );

    commentsList.innerHTML =
      commentsHTML;

    commentCount.textContent =
      commentsSnap.size;
  }
);
    // =========================
    // REALTIME LIKES
    // =========================
    onSnapshot(
      likesRef,
      (likesSnap) => {
        const likeBtn =
          document.getElementById(
            `like-btn-${postDoc.id}`
          );

        const likeCountElement =
          document.getElementById(
            `like-count-${postDoc.id}`
          );

        liked = false;

        likesSnap.forEach((likeDoc) => {
          if (
            likeDoc.id ===
            currentUser.uid
          ) {
            liked = true;
          }
        });

        likeCount = likesSnap.size;

        likeBtn.innerHTML = `
          ${
            liked ? "❤️" : "🤍"
          }

          <span>
            ${likeCount}
          </span>
        `;

        if (liked) {
          likeBtn.classList.add(
            "liked"
          );
        } else {
          likeBtn.classList.remove(
            "liked"
          );
        }

        likeCountElement.textContent =
          likeCount;
      }
    );

    feed.appendChild(postElement);
  });
}

// =========================
// WATCH POSTS
// =========================
function watchPosts() {
  if (unsubscribePosts) {
    unsubscribePosts();
  }

  const postsQuery = query(
    postsRef,
    orderBy("createdAt", "desc")
  );

  unsubscribePosts = onSnapshot(
    postsQuery,
    renderPosts,
    (error) => {
      document.getElementById(
        "postFeed"
      ).innerHTML = `
        <p class="feed-status">
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  );
}

// =========================
// AUTH
// =========================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href =
      "./dnhap.html";

    return;
  }

  currentUser = user;

  watchPosts();
});

// =========================
// START
// =========================
applySavedTheme();

// =========================
// WINDOW
// =========================
window.toggleDarkMode =
  toggleDarkMode;

window.previewPostMedia =
  previewPostMedia;

window.removePostMedia =
  removePostMedia;

window.createPost =
  createPost;

window.deletePost =
  deletePost;

window.addComment =
  addComment;

window.deleteComment =
  deleteComment;

window.toggleLike =
  toggleLike;

window.toggleCommentBox =
  toggleCommentBox;