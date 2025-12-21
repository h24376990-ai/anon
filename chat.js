import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  // 既存の設定をそのまま
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const uid = auth.currentUser.uid;

const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const recruitList = document.getElementById("recruitList");
const recruitInput = document.getElementById("recruitInput");
const recruitBtn = document.getElementById("recruitBtn");

/* ---------- 全体チャット表示 ---------- */
const messageQuery = query(
  collection(db, "messages"),
  orderBy("timestamp"),
  limit(50)
);

onSnapshot(messageQuery, (snapshot) => {
  messageList.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    const li = document.createElement("li");
    li.classList.add("msg");

    if (data.uid === uid) {
      li.classList.add("me");
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "author";
    nameSpan.textContent = data.author;
    nameSpan.onclick = () => {
      location.href = `user.html?uid=${data.uid}`;
    };

    const textSpan = document.createElement("span");
    textSpan.className = "text";
    textSpan.textContent = data.text;

    li.appendChild(nameSpan);
    li.appendChild(textSpan);
    messageList.appendChild(li);
  });

  messageList.scrollTop = messageList.scrollHeight;
});

/* ---------- 送信 ---------- */
sendBtn.onclick = async () => {
  if (!messageInput.value) return;

  await addDoc(collection(db, "messages"), {
    uid: uid,
    author: "匿名",
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

/* ---------- 募集欄 ---------- */
const recruitQuery = query(
  collection(db, "recruits"),
  orderBy("timestamp"),
  limit(30)
);

onSnapshot(recruitQuery, (snapshot) => {
  recruitList.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    const li = document.createElement("li");
    li.classList.add("msg");

    const nameSpan = document.createElement("span");
    nameSpan.className = "author recruit";
    nameSpan.textContent = data.author;
    nameSpan.onclick = () => {
      location.href = `user.html?uid=${data.uid}`;
    };

    const textSpan = document.createElement("span");
    textSpan.className = "text";
    textSpan.textContent = data.text;

    li.appendChild(nameSpan);
    li.appendChild(textSpan);
    recruitList.appendChild(li);
  });
});

/* ---------- 募集投稿 ---------- */
recruitBtn.onclick = async () => {
  if (!recruitInput.value) return;

  await addDoc(collection(db, "recruits"), {
    uid: uid,
    author: "匿名",
    text: recruitInput.value,
    timestamp: serverTimestamp()
  });

  recruitInput.value = "";
};
