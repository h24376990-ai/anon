// Firebase 設定（自分のプロジェクトに置き換える）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// ログイン済みの UID と名前（仮に取得済み）
let myUid = "";
let myName = "";

// ログイン情報取得
auth.onAuthStateChanged(user => {
  if (user) {
    myUid = user.uid;
    myName = user.displayName || "名無し";
    subscribeDMList(); // ページ読み込み時に個人チャット一覧表示
  } else {
    console.log("ログインしていません");
  }
});

// ----------------------------
// UID からユーザー名を取得
async function getUserName(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    return userDoc.data().name;
  } else {
    return "名無し";
  }
}

// ----------------------------
// 個人チャット一覧を表示
async function subscribeDMList() {
  const dmListDiv = document.getElementById("dmList");
  dmListDiv.innerHTML = ""; // 初期化

  const q = db.collection("private_rooms")
              .where("members", "array-contains", myUid)
              .orderBy("timestamp", "desc");

  q.onSnapshot(async snapshot => {
    dmListDiv.innerHTML = "";

    for (const doc of snapshot.docs) {
      const room = doc.data();
      const roomId = doc.id;

      const otherUid = room.members.find(uid => uid !== myUid);
      const otherName = await getUserName(otherUid);

      const div = document.createElement("div");
      div.className = "dm-item";
      div.innerHTML = `
        <span class="dm-name">${otherName}</span>
        <button class="start-chat-btn" data-room-id="${roomId}">チャット</button>
      `;
      dmListDiv.appendChild(div);

      div.querySelector(".start-chat-btn").addEventListener("click", () => {
        openPrivateChat(roomId, otherUid, otherName);
      });
    }
  });
}

// ----------------------------
// 個人チャット画面へ遷移
function openPrivateChat(roomId, otherUid, otherName) {
  localStorage.setItem("dmRoomId", roomId);
  localStorage.setItem("dmOtherUid", otherUid);
  localStorage.setItem("dmOtherName", otherName);
  window.location.href = "private_chat.html";
}

// ----------------------------
// 新規部屋作成（重複チェックあり）
async function createPrivateRoom(otherUid) {
  const members = [myUid, otherUid].sort();

  const snapshot = await db.collection("private_rooms")
                           .where("members", "==", members)
                           .get();
  if (!snapshot.empty) {
    console.log("既存の部屋があります");
    return snapshot.docs[0].id;
  }

  const roomRef = await db.collection("private_rooms").add({
    members,
    timestamp: Date.now()
  });

  return roomRef.id;
}
