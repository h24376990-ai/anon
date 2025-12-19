import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定（自分の FirebaseConfig に置き換える）
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebaseapp.com",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML要素
const profileName = document.getElementById("profileName");
const profileAge = document.getElementById("profileAge");
const profileLocation = document.getElementById("profileLocation");
const profileBio = document.getElementById("profileBio");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileMessage = document.getElementById("profileMessage");
const goChatBtn = document.getElementById("goChatBtn");

// アラートで読み込み確認
alert("profile.js が読み込まれました");

// 保存ボタン
saveProfileBtn.addEventListener("click", async () => {
  const uid = auth.currentUser.uid;
  if (!profileName.value.trim()) {
    profileMessage.textContent = "名前は必須です";
    return;
  }
  await setDoc(doc(db, "users", uid), {
    name: profileName.value,
    age: profileAge.value,
    location: profileLocation.value,
    bio: profileBio.value
  });
  profileMessage.textContent = "プロフィール保存完了！";
});

// チャットに進む
goChatBtn.addEventListener("click", () => {
  const uid = auth.currentUser.uid;
  window.location.href = `chat.html?uid=${uid}`;
});
