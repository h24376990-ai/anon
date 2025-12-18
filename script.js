// Firebase設定（自分のプロジェクト用に置き換える）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const messagesDiv = document.getElementById("messages");

// メッセージ送信関数
const sendMessage = async () => {
  const username = document.getElementById("username-input").value || "名無し";
  const iconURL = document.getElementById("icon-input").value || "";
  const message = document.getElementById("message-input").value;
  const imageFile = document.getElementById("image-input").files[0];

  if (message.trim() === "" && !imageFile) return;

  let imageURL = "";
  if (imageFile) {
    const storageRef = storage.ref().child(`images/${Date.now()}_${imageFile.name}`);
    await storageRef.put(imageFile);
    imageURL = await storageRef.getDownloadURL();
  }

  await db.collection("messages").add({
    username,
    iconURL,
    message,
    imageURL,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    isRecruit: false
  });

  document.getElementById("message-input").value = "";
  document.getElementById("image-input").value = "";
};

// 募集送信
document.getElementById("recruit-button").addEventListener("click", async () => {
  const recruitText = document.getElementById("recruit-input").value;
  if (recruitText.trim() === "") return;

  const username = document.getElementById("username-input").value || "名無し";

  await db.collection("messages").add({
    username,
    message: `[募集] ${recruitText}`,
    iconURL: "",
    imageURL: "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    isRecruit: true
  });

  document.getElementById("recruit-input").value = "";
});

// 送信ボタン
document.getElementById("send-button").addEventListener("click", sendMessage);

// 削除用関数
const deleteMessage = async (id) => {
  await db.collection("messages").doc(id).delete();
};

// リアルタイムでメッセージ取得
db.collection("messages").orderBy("timestamp").onSnapshot(snapshot => {
  messagesDiv.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.classList.add("message");

    let html = "";
    if (data.iconURL) html += `<img src="${data.iconURL}" class="icon"> `;
    html += `<strong>${data.username}:</strong> ${data.message}`;
    if (data.imageURL) html += `<br><img src="${data.imageURL}" class="chat-image">`;

    // 自分のメッセージなら削除ボタン
    if (!data.isRecruit && data.username === (document.getElementById("username-input").value || "名無し")) {
      html += ` <button class="delete-btn" onclick="deleteMessage('${doc.id}')">削除</button>`;
    }

    // 募集メッセージ用のデータ属性
    if (data.isRecruit) div.dataset.recruit = "true";

    div.innerHTML = html;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
});
