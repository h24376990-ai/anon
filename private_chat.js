// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase設定（いつもの）
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML要素
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// URLから roomId を取得
const params = new URLSearchParams(window.location.search);
const roomId = params.get("roomId");

// 安全チェック
if (!roomId) {
  alert("ルームIDがありません");
}

// メッセージ送信
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  const user = auth.currentUser;
  if (!user) {
    alert("ログインしてください");
    return;
  }

  await addDoc(
    collection(db, "private_rooms", roomId, "messages"),
    {
      uid: user.uid,
      text: text,
      timestamp: serverTimestamp()
    }
  );

  messageInput.value = "";
});

// メッセージ受信（リアルタイム）
const q = query(
  collection(db, "private_rooms", roomId, "messages"),
  orderBy("timestamp")
);

onSnapshot(q, (snapshot) => {
  chatArea.innerHTML = "";
  snapshot.forEach(doc => {
    const msg = doc.data();
    const div = document.createElement("div");
    div.textContent = msg.text;
    chatArea.appendChild(div);
  });
});
const params = new URLSearchParams(location.search);
const partnerUid = params.get("uid");
