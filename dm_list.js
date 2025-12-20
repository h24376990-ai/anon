import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const dmList = document.getElementById("dmList");

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "index.html";
  load(user.uid);
});

async function load(myUid) {
  dmList.innerHTML = "";
  const q = query(collection(db, "private_rooms"), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);

  for (const r of snap.docs) {
    const d = r.data();
    if (!d.members || !d.members.includes(myUid)) continue;

    const partnerUid = d.members.find(u => u !== myUid);
    const userSnap = await getDoc(doc(db, "users", partnerUid));
    const name = userSnap.exists() ? userSnap.data().name : "不明";

    const div = document.createElement("div");
    div.className = "dm-item";
    div.innerHTML = `<strong>${name}</strong><div class="last-message">${d.lastMessage || ""}</div>`;
    div.onclick = () => location.href = `private_chat.html?uid=${partnerUid}`;
    dmList.appendChild(div);
  }
}
