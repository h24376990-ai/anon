import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ================= Firebase ================= */

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

/* ================= HTML ================= */

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const onlineCount = document.getElementById("onlineCount");

const profileBox = document.getElementById("profileBox");
const pName = document.getElementById("pName");
const pAge = document.getElementById("pAge");
const pLocation = document.getElementById("pLocation");
const pBio = document.getElementById("pBio");
const startPrivateBtn = document.getElementById("startPrivateBtn");

/* ================= 状態 ================= */

let myUid = "";
let myName = "";
let targetUid = "";

/* ================= ログイン監視 ================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  myUid = user.uid;

  // 自分の名前取得
  const snap = await getDoc(doc(db, "users", myUid));
  myName = snap.exists() ? snap.data().name : "名無し";

  // オンライン登録
  await setDoc(doc(db, "onlineUsers", myUid), {
    name: myName,
    joinedAt: serverTimestamp()
  });

  // ページ閉じたらオンライン削除
  window.addEventListener("beforeunload", () => {
    deleteDoc(doc(db, "onlineUsers", myUid));
  });
});

/* ================= オンライン人数 ================= */

onSnapshot(collection(db, "onlineUsers"), (snap) => {
  onlineCount.textContent = `オンライン：${snap.size}人`;
});

/* ================= メッセージ送信 ================= */

sendBtn.onclick = async () => {
  if (!messageInput.value.trim()) return;

  await addDoc(collection(db, "messages"), {
    uid: myUid,
    author: myName,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

/* ================= メッセージ表示 ================= */

const q = query(collection(db, "messages"), orderBy("timestamp"));

onSnapshot(q, (snap) => {
  chatArea.innerHTML = "";

  snap.forEach(docSnap => {
    const m = docSnap.data();
    const div = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = m.author;
    nameSpan.style.color = "blue";
    nameSpan.style.cursor = "pointer";

    nameSpan.onclick = () => openProfile(m.uid);

    div.appendChild(nameSpan);
    div.append(`：${m.text}`);

    chatArea.appendChild(div);
  });

  chatArea.scrollTop = chatArea.scrollHeight;
});

/* ================= プロフィール表示 ================= */

async function openProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;

  const u = snap.data();
  targetUid = uid;

  pName.textContent = `名前：${u.name}`;
  pAge.textContent = `年齢：${u.age}`;
  pLocation.textContent = `出身：${u.location}`;
  pBio.textContent = `ひとこと：${u.bio}`;

  profileBox.style.display = "block";
}

/* ================= 個人チャット作成（次） ================= */

startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === myUid) return;

  await addDoc(collection(db, "privateRooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });

  alert("個人チャット作成（次で画面遷移）");
};
