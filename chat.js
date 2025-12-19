import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定は同じ
const firebaseConfig = {
  apiKey: "xxxxxx",
  authDomain: "xxxxxx.firebaseapp.com",
  projectId: "xxxxxx",
  storageBucket: "xxxxxx.appspot.com",
  messagingSenderId: "xxxxxx",
  appId: "xxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URL から uid 取得
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const roomList = document.getElementById("roomList");
const newRoom = document.getElementById("newRoom");
const createRoomBtn = document.getElementById("createRoomBtn");

// チャット送信
sendBtn.addEventListener("click", async () => {
  const msg = messageInput.value.trim();
  if (!msg) return;

  await addDoc(collection(db, "messages"), {
    uid,
    message: msg,
    timestamp: Date.now()
  });
  messageInput.value = "";
});

// リアルタイム表示
const q = query(collection(db, "messages"), orderBy("timestamp"));
onSnapshot(q, (snapshot) => {
  chatArea.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.textContent = `${data.uid}: ${data.message}`;
    chatArea.appendChild(div);
  });
});

// ルーム作成
createRoomBtn.addEventListener("click", async () => {
  const roomName = newRoom.value.trim();
  if (!roomName) return;
  await addDoc(collection(db, "rooms"), {
    name: roomName,
    createdBy: uid,
    timestamp: Date.now()
  });
  newRoom.value = "";
});

// ルーム一覧表示
onSnapshot(collection(db, "rooms"), (snapshot) => {
  roomList.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.textContent = `${data.name} （作成者: ${data.createdBy}）`;
    roomList.appendChild(div);
  });
});
