import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, doc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const privateChatList = document.getElementById("privateChatList");

const params = new URLSearchParams(location.search);
const uid = params.get("uid");

// ユーザー名取得
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

// 全体チャット送信
sendBtn.onclick = async () => {
  if (!messageInput.value) return;
  const name = await getUserName(uid);

  await addDoc(collection(db, "messages"), {
    author: name,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

// 全体チャット表示
onSnapshot(collection(db, "messages"), (snap) => {
  chatArea.innerHTML = "";
  snap.forEach(d => {
    const m = d.data();
    const div = document.createElement("div");
    div.textContent = `${m.author}: ${m.text}`;
    chatArea.appendChild(div);
  });
});

// 個人チャット一覧
const q = query(
  collection(db, "privateRooms"),
  where("members", "array-contains", uid)
);

onSnapshot(q, (snap) => {
  privateChatList.innerHTML = "";
  snap.forEach(d => {
    const div = document.createElement("div");
    div.textContent = "個人チャット";
    div.onclick = () => {
      location.href = `privateChat.html?roomId=${d.id}&uid=${uid}`;
    };
    privateChatList.appendChild(div);
  });
});

