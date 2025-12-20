import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const uid = new URLSearchParams(location.search).get("uid");
let targetUid = "";

// 名前取得
async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : { name: "名無し", sex: "", age: "", location: "", bio: "" };
}

// 全体チャット送信
sendBtn.onclick = async () => {
  if (!messageInput.value.trim()) return;
  const user = await getUser(uid);

  await addDoc(collection(db, "messages"), {
    uid,
    author: user.name,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

// 全体チャット表示
const chatQuery = query(collection(db, "messages"), orderBy("timestamp"));
onSnapshot(chatQuery, snap => {
  chatArea.innerHTML = "";
  snap.forEach(d => {
    const m = d.data();
    const div = document.createElement("div");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = m.author;
    nameSpan.style.color = "blue";
    nameSpan.style.cursor = "pointer";
    nameSpan.onclick = () => openProfile(m.uid);

    div.appendChild(nameSpan);
    div.append(`: ${m.text}`);
    chatArea.appendChild(div);
  });
  chatArea.scrollTop = chatArea.scrollHeight;
});

// 募集投稿
recruitBtn.onclick = async () => {
  if (!recruitInput.value.trim()) return;
  await addDoc(collection(db, "recruits"), {
    uid,
    text: recruitInput.value,
    timestamp: serverTimestamp()
  });
  recruitInput.value = "";
};

// 募集表示
const recruitQuery = query(collection(db, "recruits"), orderBy("timestamp"));
onSnapshot(recruitQuery, snap => {
  recruitArea.innerHTML = "";
  snap.forEach(d => {
    const r = d.data();
    const div = document.createElement("div");
    div.textContent = r.text;
    recruitArea.appendChild(div);
  });
});

// プロフィール表示
async function openProfile(otherUid) {
  const u = await getUser(otherUid);
  targetUid = otherUid;

  pName.textContent = `名前：${u.name}`;
  pSex.textContent = `性別：${u.sex || ""}`;
  pAge.textContent = `年齢：${u.age || ""}`;
  pLocation.textContent = `出身：${u.location || ""}`;
  pBio.textContent = `ひとこと：${u.bio || ""}`;
  profileBox.style.display = "block";
}

// 個人チャット作成
startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === uid) return;
  await addDoc(collection(db, "privateRooms"), {
    members: [uid, targetUid],
    createdAt: serverTimestamp()
  });
  alert("個人チャット作成（次で画面遷移）");
};
