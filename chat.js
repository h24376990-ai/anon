import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp,
  doc, getDoc, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ================= Firebase 初期化 ================= */
const firebaseConfig = { /* ここにFirebase設定 */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= HTML ================= */
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const dmList = document.getElementById("dmList");

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

  // 全体チャット表示
  subscribeMessages();

  // 個人チャット一覧表示
  subscribeDMList();
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

/* ================= 全体チャット表示 ================= */
function subscribeMessages() {
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
}

/* ================= 個人チャット一覧 ================= */
async function subscribeDMList() {
  const snap = await getDocs(collection(db, "private_rooms"));
  dmList.innerHTML = "";

  for (let roomDoc of snap.docs) {
    const room = roomDoc.data();
    if (!room.members.includes(myUid)) continue;

    const otherUid = room.members.find(uid => uid !== myUid);
    if (!otherUid) continue;

    const userSnap = await getDoc(doc(db, "users", otherUid));
    if (!userSnap.exists()) continue;
    const user = userSnap.data();

    const div = document.createElement("div");
    div.className = "dm-item";
    div.innerHTML = `<strong>${user.name}</strong>`;

    const btn = document.createElement("button");
    btn.textContent = "チャット";
    btn.onclick = () => {
      location.href = `private_chat.html?uid=${otherUid}`;
    };

    div.appendChild(btn);
    dmList.appendChild(div);
  }
}

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

/* ================= 個人チャット作成 ================= */
startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === myUid) return;

  // 既存の部屋があるか確認
  const snap = await getDocs(collection(db, "private_rooms"));
  let exists = false;

  for (let docSnap of snap.docs) {
    const room = docSnap.data();
    if ([myUid, targetUid].sort().join() === room.members.sort().join()) {
      exists = true;
      break;
    }
  }

  if (!exists) {
    await addDoc(collection(db, "private_rooms"), {
      members: [myUid, targetUid].sort(),
      createdAt: serverTimestamp()
    });
  }

  location.href = `private_chat.html?uid=${targetUid}`;
};
