import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const privateList = document.getElementById("privateList");

// URLから自分の名前を取得
const myName = new URLSearchParams(location.search).get("name");
let targetName = "";

// 名前取得（そのまま）
async function getUserData(name) {
  const snap = await getDoc(doc(db, "users", name));
  return snap.exists() ? snap.data() : null;
}

// -------------------- 全体チャット --------------------

// メッセージ送信
sendBtn.onclick = async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  const userData = await getUserData(myName);
  const author = userData ? userData.name : "名無し";

  await addDoc(collection(db, "messages"), {
    name: myName,
    author,
    text,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

// メッセージ表示（最新50件・リアルタイム）
const msgQuery = query(
  collection(db, "messages"),
  orderBy("timestamp"),
  limit(50)
);
onSnapshot(msgQuery, snap => {
  chatArea.innerHTML = "";
  snap.forEach(docSnap => {
    const m = docSnap.data();
    const div = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = m.author;
    nameSpan.style.color = "blue";
    nameSpan.style.cursor = "pointer";
    nameSpan.onclick = () => openProfile(m.name);

    div.appendChild(nameSpan);
    div.append(`：${m.text}`);

    if (m.name === myName) div.classList.add("myMessage");

    chatArea.appendChild(div);
  });
  chatArea.scrollTop = chatArea.scrollHeight;
});

// -------------------- 募集欄 --------------------

// 投稿
recruitBtn.onclick = async () => {
  const text = recruitInput.value.trim();
  if (!text) return;

  const userData = await getUserData(myName);
  const author = userData ? userData.name : "名無し";

  await addDoc(collection(db, "recruits"), {
    name: myName,
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

    const nameSpan = document.createElement("span");
    nameSpan.textContent = r.author;
    nameSpan.style.color = "blue";
    nameSpan.style.cursor = "pointer";
    nameSpan.onclick = () => openProfile(r.name);

    div.appendChild(nameSpan);
    div.append(`：${r.text}`);
    recruitArea.appendChild(div);
  });
});

// -------------------- プロフィール表示 --------------------
async function openProfile(name) {
  const u = await getUserData(name);
  if (!u) return;

  targetName = name;

  pName.textContent = `名前：${u.name}`;
  pSex.textContent = `性別：${u.sex || ""}`;
  pAge.textContent = `年齢：${u.age || ""}`;
  pLocation.textContent = `出身：${u.location || ""}`;
  pBio.textContent = `ひとこと：${u.bio || ""}`;

  profileBox.style.display = "block";
}

// -------------------- 個人チャット作成 --------------------
startPrivateBtn.onclick = async () => {
  if (!targetName || targetName === myName) return;

  const members = [myName, targetName].sort();
  await addDoc(collection(db, "private_rooms"), {
    members,
    createdAt: serverTimestamp()
  });

  alert("個人チャット作成（次で画面遷移）");
};

// -------------------- 個人チャット一覧 --------------------
const roomQuery = query(
  collection(db, "private_rooms"),
  orderBy("createdAt")
);
onSnapshot(roomQuery, async snap => {
  privateList.innerHTML = "";
  for (const docSnap of snap.docs) {
    const room = docSnap.data();
    if (!room.members.includes(myName)) continue;

    const otherName = room.members.find(n => n !== myName);

    const div = document.createElement("div");
    div.textContent = otherName;
    div.style.color = "blue";
    div.style.cursor = "pointer";

    div.onclick = () => {
      location.href = `private.html?roomId=${docSnap.id}&name=${myName}`;
    };

    privateList.appendChild(div);
  }
});
