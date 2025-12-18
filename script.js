// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase設定（これはそのままでOK）
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

// 初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML要素
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send");
const messagesDiv = document.getElementById("messages");

// 🔥 送信処理（画像処理は一切なし）
sendButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const text = messageInput.value.trim();

  if (!name || !text) return;

  await addDoc(collection(db, "messages"), {
    name: name,
    text: text,
    createdAt: serverTimestamp()
  });

  messageInput.value = "";
});

// 🔥 リアルタイム取得
const q = query(
  collection(db, "messages"),
  orderBy("createdAt", "asc")
);

onSnapshot(q, (snapshot) => {
  messagesDiv.innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    const div = document.createElement("div");
    div.textContent = `${data.name}：${data.text}`;
