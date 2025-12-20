import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  serverTimestamp, doc, getDoc
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

// HTML
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const profileBox = document.getElementById("profileBox");
const pName = document.getElementById("pName");
const pAge = document.getElementById("pAge");
const pLocation = document.getElementById("pLocation");
const pBio = document.getElementById("pBio");
const startPrivateBtn = document.getElementById("startPrivateBtn");

const uid = new URLSearchParams(location.search).get("uid");
let targetUid = "";

// ユーザー名取得
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

// 送信
sendBtn.onclick = async () => {
  if (!messageInput.value.trim()) return;
  const name = await getUserName(uid);

  await addDoc(collection(db, "messages"), {
    uid,
    author: name,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

// 表示
onSnapshot(collection(db, "messages"), snap => {
  chatArea.innerHTML = "";
  snap.forEach(d => {
    const m = d.data();
    const div = document.createElement("div");

    const name = document.createElement("span");
    name.textContent = m.author;
    name.style.color = "blue";
    name.style.cursor = "pointer";
    name.onclick = () => openProfile(m.uid);

    div.appendChild(name);
    div.append(`: ${m.text}`);
    chatArea.appendChild(div);
  });
});

// プロフィール表示
async function openProfile(otherUid) {
  const snap = await getDoc(doc(db, "users", otherUid));
  if (!snap.exists()) return;

  const u = snap.data();
  targetUid = otherUid;

  pName.textContent = `名前：${u.name}`;
  pAge.textContent = `年齢：${u.age}`;
  pLocation.textContent = `出身：${u.location}`;
  pBio.textContent = `ひとこと：${u.bio}`;
  profileBox.style.display = "block";
}

// 個人チャット作成
startPrivateBtn.onclick = async () => {
  const room = await addDoc(collection(db, "privateRooms"), {
    members: [uid, targetUid],
    createdAt: serverTimestamp()
  });
  alert("個人チャット作成（次で画面遷移）");
};
