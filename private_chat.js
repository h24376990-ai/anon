import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  serverTimestamp, doc, getDoc, setDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const partnerUid = params.get("uid");

const messages = document.getElementById("messages");
const form = document.getElementById("messageForm");
const input = document.getElementById("messageInput");
const title = document.getElementById("chatTitle");

onAuthStateChanged(auth, async user => {
  if (!user || !partnerUid) return location.href = "index.html";

  const myUid = user.uid;
  const roomId = [myUid, partnerUid].sort().join("_");

  const userSnap = await getDoc(doc(db, "users", partnerUid));
  if (userSnap.exists()) title.textContent = `${userSnap.data().name} さんとのチャット`;

  const q = query(collection(db, "private_rooms", roomId, "messages"), orderBy("timestamp"));
  onSnapshot(q, snap => {
    messages.innerHTML = "";
    snap.forEach(d => {
      const div = document.createElement("div");
      div.textContent = d.data().text;
      div.style.textAlign = d.data().uid === myUid ? "right" : "left";
      messages.appendChild(div);
    });
    messages.scrollTop = messages.scrollHeight;
  });

  form.onsubmit = async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    await addDoc(collection(db, "private_rooms", roomId, "messages"), {
      uid: myUid, text, timestamp: serverTimestamp()
    });

    await setDoc(doc(db, "private_rooms", roomId), {
      members: [myUid, partnerUid],
      lastMessage: text,
      updatedAt: serverTimestamp()
    }, { merge: true });

    input.value = "";
  };
});
