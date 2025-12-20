import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ===== Firebase 設定（既存と同じ） ===== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===== DOM ===== */
const messagesDiv = document.getElementById("messages");
const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const chatTitle = document.getElementById("chatTitle");

/* ===== URL から相手UID取得 ===== */
const params = new URLSearchParams(location.search);
const partnerUid = params.get("uid");

/* ===== ログイン確認 ===== */
onAuthStateChanged(auth, async (user) => {
  if (!user || !partnerUid) {
    location.href = "index.html";
    return;
  }

  const myUid = user.uid;

  // roomId 作成
  const roomId = [myUid, partnerUid].sort().join("_");

  // 相手の名前表示
  loadPartnerName(partnerUid);

  // メッセージ監視
  listenMessages(roomId, myUid);

  // 送信処理
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!input.value.trim()) return;

    await addDoc(
      collection(db, "private_rooms", roomId, "messages"),
      {
        uid: myUid,
        text: input.value,
        timestamp: serverTimestamp()
      }
    );

    input.value = "";
  });
});

/* ===== 相手の名前取得 ===== */
async function loadPartnerName(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    chatTitle.textContent = `${userSnap.data().name} さんとのチャット`;
  } else {
    chatTitle.textContent = "チャット";
  }
}

/* ===== メッセージ表示 ===== */
function listenMessages(roomId, myUid) {
  const q = query(
    collection(db, "private_rooms", roomId, "messages"),
    orderBy("timestamp")
  );

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();

      const div = document.createElement("div");
      div.textContent = data.text;

      // 自分の発言かどうか
      if (data.uid === myUid) {
        div.style.textAlign = "right";
        div.style.color = "blue";
      } else {
        div.style.textAlign = "left";
      }

      messagesDiv.appendChild(div);
    });

    // 最新メッセージへスクロール
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}
