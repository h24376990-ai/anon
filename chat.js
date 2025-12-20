// ----------------------------
// Firebase 初期化
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ----------------------------
// グローバル変数
let myUid = "";
let myName = "";

// ----------------------------
// HTML 要素
const loginBox = document.getElementById("loginBox");
const chatBox = document.getElementById("chatBox");

// ----------------------------
// ログインボタン
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    myUid = user.uid;
    myName = user.displayName || "名無し";

    // ログイン成功 → 画面切り替え
    loginBox.style.display = "none";
    chatBox.style.display = "block";

    // 既存機能の初期化
    subscribeDMList(); // 個人チャット一覧
    initGlobalChat();  // 全体チャット
    // プロフィールや個人チャット作成もここで動かす

  } catch (error) {
    alert("ログインに失敗しました: " + error.message);
  }
});

// ----------------------------
// UID からユーザー名取得
async function getUserName(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    return userDoc.data().name;
  } else {
    return "名無し";
  }
}

// ----------------------------
// 個人チャット一覧
async function subscribeDMList() {
  const dmListDiv = document.getElementById("dmList");
  dmListDiv.innerHTML = "";

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
// 新規部屋作成（重複チェック）
async function createPrivateRoom(otherUid) {
  const members = [myUid, otherUid].sort();
  const snapshot = await db.collection("private_rooms")
                           .where("members", "==", members)
                           .get();
  if (!snapshot.empty) return snapshot.docs[0].id;

  const roomRef = await db.collection("private_rooms").add({
    members,
    timestamp: Date.now()
  });
  return roomRef.id;
}

// ----------------------------
// 全体チャット初期化
function initGlobalChat() {
  const chatArea = document.getElementById("chatArea");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  db.collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      chatArea.innerHTML = "";
      snapshot.forEach(doc => {
        const msg = doc.data();
        chatArea.innerHTML += `<p><strong>${msg.name}:</strong> ${msg.text}</p>`;
      });
    });

  sendBtn.addEventListener("click", async () => {
    const text = messageInput.value;
    if (text.trim() === "") return;

    await db.collection("messages").add({
      uid: myUid,
      name: myName,
      text,
      timestamp: Date.now()
    });
    messageInput.value = "";
  });
}
