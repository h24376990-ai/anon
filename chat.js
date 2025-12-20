import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 初期化
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
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const recruitArea = document.getElementById("recruitArea");
const recruitInput = document.getElementById("recruitInput");
const recruitBtn = document.getElementById("recruitBtn");

const profileBox = document.getElementById("profileBox");
const pName = document.getElementById("pName");
const pSex = document.getElementById("pSex");
const pAge = document.getElementById("pAge");
const pLocation = document.getElementById("pLocation");
const pBio = document.getElementById("pBio");
const startPrivateBtn = document.getElementById("startPrivateBtn");

// URLから自分のuidを取得
const myUid = new URLSearchParams(location.search).get("uid");
let targetUid = "";

// 名前取得
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

// -------------------- 全体チャット --------------------

// メッセージ送信
sendBtn.onclick = async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  const author = await getUserName(myUid);

  await addDoc(collection(db, "messages"), {
    uid: myUid,
    author,
    text,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

// メッセージ表示（リアルタイム）
const msgQuery = query(collection(db, "messages"), orderBy("timestamp"));
onSnapshot(msgQuery, snap => {
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

// -------------------- 募集欄 --------------------

// 投稿
recruitBtn.onclick = async () => {
  const text = recruitInput.value.trim();
  if (!text) return;

  const author = await getUserName(myUid);

  await addDoc(collection(db, "recruits"), {
    uid: myUid,
    author,
    text,
    timestamp: serverTimestamp()
  });

  recruitInput.value = "";
};

// 表示
const recruitQuery = query(collection(db, "recruits"), orderBy("timestamp"));
onSnapshot(recruitQuery, snap => {
  recruitArea.innerHTML = "";
  snap.forEach(docSnap => {
    const r = docSnap.data();
    const div = document.createElement("div");
    div.textContent = `${r.author}：${r.text}`;
    recruitArea.appendChild(div);
  });
});

// -------------------- プロフィール表示 --------------------

async function openProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;

  const u = snap.data();
  targetUid = uid;

  pName.textContent = `名前：${u.name}`;
  pSex.textContent = `性別：${u.sex || ""}`;
  pAge.textContent = `年齢：${u.age || ""}`;
  pLocation.textContent = `出身：${u.location || ""}`;
  pBio.textContent = `ひとこと：${u.bio || ""}`;

  profileBox.style.display = "block";
}

// -------------------- 個人チャット作成 --------------------

startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === myUid) return;

  await addDoc(collection(db, "private_rooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });

  alert("個人チャット作成（次で画面遷移）");
};
