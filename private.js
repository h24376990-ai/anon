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
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML
const chatArea = document.getElementById("privateChatArea");
const input = document.getElementById("privateMessageInput");
const sendBtn = document.getElementById("privateSendBtn");

// URL
const params = new URLSearchParams(location.search);
const roomId = params.get("roomId");
const myUid = params.get("uid");

// 名前取得
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

// 送信
sendBtn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  const author = await getUserName(myUid);

  await addDoc(
    collection(db, "private_rooms", roomId, "messages"),
    {
      uid: myUid,
      author,
      text,
      timestamp: serverTimestamp()
    }
  );

  input.value = "";
};

// 表示
const msgQuery = query(
  collection(db, "private_rooms", roomId, "messages"),
  orderBy("timestamp")
);

onSnapshot(msgQuery, snap => {
  chatArea.innerHTML = "";

  snap.forEach(docSnap => {
    const m = docSnap.data();
    const div = document.createElement("div");
    div.textContent = `${m.author}：${m.text}`;
    chatArea.appendChild(div);
  });

  chatArea.scrollTop = chatArea.scrollHeight;
});
