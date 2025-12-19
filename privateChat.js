import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const roomId = new URLSearchParams(location.search).get("roomId");
const chat = document.getElementById("chat");

onSnapshot(collection(db, "privateRooms", roomId, "messages"), (snap) => {
  chat.innerHTML = "";
  snap.forEach(d => {
    const m = d.data();
    const div = document.createElement("div");
    div.textContent = `${m.author}: ${m.text}`;
    chat.appendChild(div);
  });
});

send.onclick = async () => {
  await addDoc(collection(db, "privateRooms", roomId, "messages"), {
    author: auth.currentUser.uid,
    text: text.value,
    timestamp: serverTimestamp()
  });
  text.value = "";
};
