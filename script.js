// Firebase初期化
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.appspot.com",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const storage = firebase.storage();

const messagesDiv = document.getElementById("messages");

// メッセージ送信
const sendMessage = async () => {
  const username = document.getElementById("username-input").value || "名無し";
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
    imageURL: "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    isRecruit: true
  });

  document.getElementById("recruit-input").value = "";
});

document.getElementById("send-button").addEventListener("click", sendMessage);

// リアルタイム取得
db.collection("messages").orderBy("timestamp").onSnapshot(snapshot => {
  messagesDiv.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.classList.add("message");

    let html = `<strong>${data.username}:</strong> ${data.message}`;
    if (data.imageURL) html += `<br><img src="${data.imageURL}" class="chat-image">`;

    div.innerHTML = html;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
});
