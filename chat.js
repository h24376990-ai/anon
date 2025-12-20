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
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const recruitArea = document.getElementById("recruitArea");
const recruitInput = document.getElementById("recruitInput");
const recruitBtn = document.getElementById("recruitBtn");

const privateList = document.getElementById("privateList");

const profileBox = document.getElementById("profileBox");
const pName = document.getElementById("pName");
const pSex = document.getElementById("pSex");
const pAge = document.getElementById("pAge");
const pLocation = document.getElementById("pLocation");
const pBio = document.getElementById("pBio");
const startPrivateBtn = document.getElementById("startPrivateBtn");

// 状態
const myUid = new URLSearchParams(location.search).get("uid");
let targetUid = "";

// 共通
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

// ---------------- 全体チャット（最新50件） ----------------

sendBtn.onclick = async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    uid: myUid,
    author: await getUserName(myUid),
    text,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

const msgQuery = query(
  collection(db, "messages"),
  orderBy("timestamp", "desc"),
  limit(50)
);

onSnapshot(msgQuery, snap => {
  chatArea.innerHTML = "";

  snap.docs.reverse().forEach(docSnap => {
    const m = docSnap.data();
    const div = document.createElement("div");

    const name = document.createElement("span");
    name.textContent = m.author;
    name.style.color = "blue";
    name.style.cursor = "pointer";
    name.onclick = () => openProfile(m.uid);

    div.appendChild(name);
    div.append(`：${m.text}`);
    chatArea.appendChild(div);
  });

  chatArea.scrollTop = chatArea.scrollHeight;
});

// ---------------- 募集欄（最新20件） ----------------

recruitBtn.onclick = async () => {
  const text = recruitInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "recruits"), {
    uid: myUid,
    author: await getUserName(myUid),
    text,
    timestamp: serverTimestamp()
  });

  recruitInput.value = "";
};

const recruitQuery = query(
  collection(db, "recruits"),
  orderBy("timestamp", "desc"),
  limit(20)
);

onSnapshot(recruitQuery, snap => {
  recruitArea.innerHTML = "";

  snap.docs.reverse().forEach(docSnap => {
    const r = docSnap.data();
    const div = document.createElement("div");

    const name = document.createElement("span");
    name.textContent = r.author;
    name.style.color = "blue";
    name.style.cursor = "pointer";
    name.onclick = () => openProfile(r.uid);

    div.appendChild(name);
    div.append(`：${r.text}`);
    recruitArea.appendChild(div);
  });
});

// ---------------- プロフィール ----------------

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

// ---------------- 個人チャット作成 ----------------

startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === myUid) return;

  await addDoc(collection(db, "private_rooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });

  alert("個人チャット作成");
};

// ---------------- 個人チャット一覧 ----------------

const roomQuery = query(
  collection(db, "private_rooms"),
  orderBy("createdAt", "desc"),
  limit(20)
);

onSnapshot(roomQuery, async snap => {
  privateList.innerHTML = "";

  for (const docSnap of snap.docs) {
    const room = docSnap.data();
    if (!room.members.includes(myUid)) continue;

    const otherUid = room.members.find(u => u !== myUid);
    const name = await getUserName(otherUid);

    const div = document.createElement("div");
    div.textContent = name;
    div.style.color = "blue";
    div.style.cursor = "pointer";
    div.onclick = () => {
      location.href = `private.html?roomId=${docSnap.id}&uid=${myUid}`;
    };

    privateList.appendChild(div);
  }
});
