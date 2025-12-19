// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定（既存のものをそのまま）
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

const roomList = document.getElementById("roomList");
const newRoomInput = document.getElementById("newRoom");
const createRoomBtn = document.getElementById("createRoomBtn");

// URLからログインユーザーUID取得
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

// ユーザー名取得
async function getUserName(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data().name : "名無し";
}

// 全体チャット送信
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  const userName = await getUserName(uid);
  await addDoc(collection(db, "messages"), {
    author: userName,
    text: text,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
});

// 全体チャット表示（リアルタイム）
onSnapshot(collection(db, "messages"), (snapshot) => {
  chatArea.innerHTML = "";
  snapshot.docs.forEach(doc => {
    const msg = doc.data();
    const div = document.createElement("div");
    div.textContent = `${msg.author}: ${msg.text}`;
    chatArea.appendChild(div);
  });
});

// 募集ルーム作成
createRoomBtn.addEventListener("click", async () => {
  const roomName = newRoomInput.value.trim();
  if (!roomName) return;

  await addDoc(collection(db, "rooms"), {
    name: roomName,
    timestamp: serverTimestamp()
  });

  newRoomInput.value = "";
});

// 募集ルーム表示（リアルタイム）
onSnapshot(collection(db, "rooms"), (snapshot) => {
  roomList.innerHTML = "";
  snapshot.docs.forEach(doc => {
    const room = doc.data();
    const div = document.createElement("div");
    div.textContent = room.name;
    roomList.appendChild(div);
  });
});
import { query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const privateChatList = document.getElementById("privateChatList");

// 自分が入っている個人チャット一覧を取得
const q = query(
  collection(db, "privateRooms"),
  where("members", "array-contains", uid)
);

onSnapshot(q, (snapshot) => {
  privateChatList.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const room = docSnap.data();
    const roomId = docSnap.id;

    const div = document.createElement("div");
    div.textContent = `個人チャット：${roomId}`;
    div.style.cursor = "pointer";

    div.onclick = () => {
      window.location.href = `privateChat.html?roomId=${roomId}`;
    };

    privateChatList.appendChild(div);
  });
});
