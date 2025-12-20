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

/* HTML */
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

/* 状態 */
let myUid = "";
let myName = "";

// 選択した相手
const targetUid = new URLSearchParams(location.search).get("uid");
let roomId = [targetUid].sort().join("_"); // roomIdを簡易で作る

/* ログイン監視 */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  myUid = user.uid;

  // 自分の名前取得
  const snap = await getDoc(doc(db, "users", myUid));
  myName = snap.exists() ? snap.data().name : "名無し";

  // roomId作成
  const sorted = [myUid, targetUid].sort();
  roomId = sorted.join("_");

  // チャット表示
  const messagesRef = collection(db, "private_rooms", roomId, "messages");
  const q = query(messagesRef, orderBy("timestamp"));

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
});

/* 送信 */
sendBtn.onclick = async () => {
  if (!messageInput.value.trim()) return;

  await addDoc(collection(db, "private_rooms", roomId, "messages"), {
    uid: myUid,
    author: myName,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};
