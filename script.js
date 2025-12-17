// 募集を送信
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

// メッセージ送信関数にID追加
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

  const docRef = await db.collection("messages").add({
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

// 削除用関数
const deleteMessage = async (id) => {
  await db.collection("messages").doc(id).delete();
};

// リアルタイム表示（削除ボタン追加）
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

    // 自分のメッセージなら削除ボタン追加
    if (!data.isRecruit && data.username === (document.getElementById("username-input").value || "名無し")) {
      html += ` <button class="delete-btn" onclick="deleteMessage('${doc.id}')">削除</button>`;
    }

    div.innerHTML = html;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
});
