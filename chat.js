import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

/* ===== Firebase 初期化 ===== */
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

/* ===== HTML ===== */
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

/* ===== ログイン確認 ===== */
let myUid = "";
let myName = "";

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  myUid = user.uid;

  const snap = await getDoc(doc(db, "users", myUid));
  myName = snap.exists() ? snap.data().name : "名無し";

  startChatListener();
});

/* ===== メッセージ送信 ===== */
sendBtn.onclick = async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    uid: myUid,
    authorName: myName,
    text: text,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

/* ===== メッセージ表示 ===== */
function startChatListener() {
  const q = query(
    collection(db, "messages"),
    orderBy("timestamp")
  );

  onSnapshot(q, snap => {
    chatArea.innerHTML = "";

    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = m.authorName;
      nameSpan.style.cursor = "pointer";

      // 自分の発言
      if (m.uid === myUid) {
        nameSpan.style.color = "blue";
        nameSpan.onclick = () => {
          location.href = "profile.html";
        };
      } 
      // 相手の発言
      else {
        nameSpan.onclick = () => {
          location.href = `user.html?uid=${m.uid}`;
        };
      }

      const textSpan = document.createElement("span");
      textSpan.textContent = `: ${m.text}`;

      div.appendChild(nameSpan);
      div.appendChild(textSpan);
      chatArea.appendChild(div);
    });

    chatArea.scrollTop = chatArea.scrollHeight;
  });
}
