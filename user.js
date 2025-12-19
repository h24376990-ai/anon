import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const targetUid = params.get("uid");
const myUid = auth.currentUser.uid;

const userDoc = await getDoc(doc(db, "users", targetUid));
document.getElementById("name").textContent = userDoc.data().name;
document.getElementById("bio").textContent = userDoc.data().bio;

document.getElementById("startChat").onclick = async () => {
  const room = await addDoc(collection(db, "privateRooms"), {
    members: [myUid, targetUid],
    createdAt: serverTimestamp()
  });
  location.href = `privateChat.html?roomId=${room.id}`;
};
