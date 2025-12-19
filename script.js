// ==============================
// Firebase（CDN版）を読み込む
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ==============================
// Firebase 設定（←これはあなたのやつ）
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

// ==============================
// Firebase 初期化
// ==============================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesRef = collection(db, "messages");

console.log("🔥 Firebase 接続成功");

// ==============================
// HTML要素取得
// ==============================
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send");

// ==============================
// 送信ボタン
// ==============================
sendButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const text = messageInput.value.trim();

  if (!name || !text) {
    alert("名前とメッセージを入れてね");
    return;
  }

  await addDoc(messagesRef, {
    name: name,
    text: text,
    createdAt: serverTimestamp()
  });

  alert("Firestore に保存されたよ！");
  messageInput.value = "";
});
