import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML
const chatArea = document.getElementById("chatArea");
const recruitArea = document.getElementById("recruitArea");
const privateList = document.getElementById("privateList");
const messageInput = document.getElementById("messageInput");
const recruitInput = document.getElementById("recruitInput");
const sendBtn = document.getElementById("sendBtn");
const recruitBtn = document.getElementById("recruitBtn");

const profileBox = document.getElementById("profileBox");
const pName = document.getElementById("pName");
const pSex = document.getElementById("pSex");
const pAge = document.getElementById("pAge");
const pLocation = document.getElementById("pLocation");
const pBio = document.getElementById("pBio");
const startPrivateBtn = document.getElementById("startPrivateBtn");

let myUid = "";
let targetUid = "";

/* ===== Auth（重要修正ポイント） ===== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    myUid = user.uid;
    console.log("ログインUID:", myUid);
    init();
  } else {
    await signInAnonymously(auth);
  }
});

/* ===== utils ===== */
async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() && snap.data().name ? snap.data().name : "名無し";
}

/* ===== main ===== */
function init() {

  /* 全体チャット送信 */
  sendBtn.onclick = async () => {
    if (!messageInput.value) return;

    await addDoc(collection(db, "messages"), {
      uid: myUid,
      author: await getUserName(myUid),
      text: messageInput.value,
      timestamp: serverTimestamp()
    });

    messageInput.value = "";
  };

  /* 全体チャット表示 */
  onSnapshot(
    query(collection(db, "messages"), orderBy("timestamp"), limit(50)),
    snap => {
      chatArea.innerHTML = "";
      snap.forEach(d => {
        const m = d.data();
        const li = document.createElement("li");
        li.className = "msg";
        if (m.uid === myUid) li.classList.add("me");

        li.innerHTML = `
          <span class="name">${m.author}</span>
          <span class="text">${m.text}</span>
        `;

        li.querySelector(".name").onclick = () => openProfile(m.uid);
        chatArea.appendChild(li);
      });

      chatArea.scrollTop = chatArea.scrollHeight;
    }
  );

  /* 募集欄送信 */
  recruitBtn.onclick = async () => {
    if (!recruitInput.value) return;

    await addDoc(collection(db, "recruits"), {
      uid: myUid,
      author: await getUserName(myUid),
      text: recruitInput.value,
      timestamp: serverTimestamp()
    });

    recruitInput.value = "";
  };

  /* 募集欄表示 */
  onSnapshot(
    query(collection(db, "recruits"), orderBy("timestamp"), limit(20)),
    snap => {
      recruitArea.innerHTML = "";
      snap.forEach(d => {
        const r = d.data();
        const li = document.createElement("li");
        li.className = "msg";

        li.innerHTML = `
          <span class="name">${r.author}</span>
          <span class="text">${r.text}</span>
        `;

        li.querySelector(".name").onclick = () => openProfile(r.uid);
        recruitArea.appendChild(li);
      });
    }
  );

  /* 個人チャット一覧 */
  onSnapshot(collection(db, "private_rooms"), async snap => {
    privateList.innerHTML = "";
    for (const d of snap.docs) {
      const room = d.data();
      if (!room.members?.includes(myUid)) continue;

      const otherUid = room.members.find(u => u !== myUid);
      const li = document.createElement("li");
      li.textContent = await getUserName(otherUid);
      li.onclick = () => {
        location.href = `private.html?roomId=${d.id}`;
      };
      privateList.appendChild(li);
    }
  });
}

/* ===== profile ===== */
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

startPrivateBtn.onclick = async () => {
  if (!targetUid) return;

  await addDoc(collection(db, "private_rooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });
};
