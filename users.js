import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const uid = params.get("uid");

if (!uid) {
  alert("ユーザーが指定されていません");
  location.href = "chat.html";
}

// プロフィール取得
const userRef = doc(db, "users", uid);
const snap = await getDoc(userRef);

if (!snap.exists()) {
  alert("ユーザーが見つかりません");
  location.href = "chat.html";
}

const data = snap.data();

document.getElementById("name").textContent = data.name;
document.getElementById("age").textContent = data.age || "未設定";
document.getElementById("location").textContent = data.location || "未設定";
document.getElementById("bio").textContent = data.bio || "";

// 個人チャット開始
document.getElementById("dmBtn").onclick = () => {
  const myUid = auth.currentUser.uid;
  const roomId = [myUid, uid].sort().join("_");
  location.href = `private_chat.html?roomId=${roomId}&uid=${uid}`;
};
