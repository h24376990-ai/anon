import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Firebase初期化 */
const firebaseConfig = { /* 省略 */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* HTML要素 */
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

/* 状態 */
let myUid = "";
let myName = "";
let targetUid = "";

/* ログイン監視 */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  myUid = user.uid;

  // 自分の名前取得
  const snap = await getDoc(doc(db, "users", myUid));
  myName = snap.exists() ? snap.data().name : "名無し";

  // 個人チャット一覧取得
  updateDMList();
});

/* メッセージ送信 */
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

/* 全体チャット表示 */
const q = query(collection(db, "messages"), orderBy("timestamp"));
onSnapshot(q, (snap) => {
  chatArea.innerHTML = "";
  snap.forEach(docSnap => {
    const m = docSnap.data();
    const div = document.createElement("div");
    div.textContent = `${m.author}：${m.text}`;
    chatArea.appendChild(div);
  });
  chatArea.scrollTop = chatArea.scrollHeight;
});

/* 個人チャット一覧表示 */
async function updateDMList() {
  dmList.innerHTML = "";

  const roomsSnap = await getDoc(collection(db, "private_rooms"));
  const roomsQuery = query(collection(db, "private_rooms"));

  onSnapshot(roomsQuery, async (snap) => {
    dmList.innerHTML = "";

    snap.forEach(async (roomDoc) => {
      const room = roomDoc.data();
      if (!room.members.includes(myUid)) return;

      // 相手UID取得
      const otherUid = room.members.find(uid => uid !== myUid);
      const userSnap = await getDoc(doc(db, "users", otherUid));
      if (!userSnap.exists()) return;

      const user = userSnap.data();
      const div = document.createElement("div");
      div.className = "dm-item";
      div.innerHTML = `<strong>${user.name}</strong>`;
      const btn = document.createElement("button");
      btn.textContent = "チャット";
      btn.onclick = () => {
        targetUid = otherUid;
        alert(`個人チャット画面へ（${user.name}）`);
      };
      div.appendChild(btn);
      dmList.appendChild(div);
    });
  });
}

/* プロフィール表示 */
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

/* 個人チャット作成 */
startPrivateBtn.onclick = async () => {
  if (!targetUid || targetUid === myUid) return;
  await addDoc(collection(db, "private_rooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });
  alert("個人チャット作成（次で画面遷移）");
};
