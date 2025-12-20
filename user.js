// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase設定（いつものやつ）
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML要素
const nameEl = document.getElementById("userName");
const ageEl = document.getElementById("userAge");
const locationEl = document.getElementById("userLocation");
const bioEl = document.getElementById("userBio");
const privateChatBtn = document.getElementById("privateChatBtn");

// URLからuid取得
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

// プロフィール読み込み
async function loadProfile() {
  if (!uid) {
    nameEl.textContent = "ユーザーが見つかりません";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    nameEl.textContent = "プロフィール未設定";
    return;
  }

  const data = userDoc.data();
  nameEl.textContent = data.name || "名前なし";
  ageEl.textContent = data.age ? `年齢：${data.age}` : "";
  locationEl.textContent = data.location ? `出身：${data.location}` : "";
  bioEl.textContent = data.bio ? `ひとこと：${data.bio}` : "";
}

loadProfile();

// 個人チャット（まだ中身は次）
privateChatBtn.addEventListener("click", () => {
  alert("次は個人チャット機能を作るよ");
});
