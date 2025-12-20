import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ===== Firebase 設定（既存と同じもの） ===== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===== DOM ===== */
const dmListDiv = document.getElementById("dmList");

/* ===== ログイン確認 ===== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  loadDMList(user.uid);
});

/* ===== 個人チャット一覧取得 ===== */
async function loadDMList(myUid) {
  dmListDiv.innerHTML = "";

  const roomsSnap = await getDocs(collection(db, "private_rooms"));

  let hasRoom = false;

  for (const roomDoc of roomsSnap.docs) {
    const roomId = roomDoc.id;

    // 自分が参加していない room は無視
    if (!roomId.includes(myUid)) continue;

    hasRoom = true;

    const uids = roomId.split("_");
    const partnerUid = uids.find(uid => uid !== myUid);

    // 相手ユーザー情報取得
    const userSnap = await getDoc(doc(db, "users", partnerUid));
    const userData = userSnap.exists() ? userSnap.data() : { name: "不明なユーザー" };

    // 表示要素作成
    const item = document.createElement("div");
    item.className = "dm-item";

    item.innerHTML = `
      <strong>${userData.name}</strong><br>
      <button>チャットを開く</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      location.href = `private_chat.html?uid=${partnerUid}`;
    });

    dmListDiv.appendChild(item);
  }

  if (!hasRoom) {
    dmListDiv.innerHTML = "<p>まだ個人チャットはありません</p>";
  }
}
