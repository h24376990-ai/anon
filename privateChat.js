import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const roomId = params.get("roomId");
const uid = params.get("uid");

const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

async function getUserName(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().name : "名無し";
}

sendBtn.onclick = async () => {
  if (!messageInput.value) return;
  const name = await getUserName(uid);

  await addDoc(collection(db, "privateRooms", roomId, "messages"), {
    author: name,
    text: messageInput.value,
    timestamp: serverTimestamp()
  });

  messageInput.value = "";
};

onSnapshot(collection(db, "privateRooms", roomId, "messages"), (snap) => {
  chatArea.innerHTML = "";
  snap.forEach(d => {
    const m = d.data();
    const div = document.createElement("div");
    div.textContent = `${m.author}: ${m.text}`;
    chatArea.appendChild(div);
  });
});
