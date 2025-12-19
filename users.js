import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userList = document.getElementById("userList");

onSnapshot(collection(db, "users"), (snapshot) => {
  userList.innerHTML = "";
  snapshot.forEach(doc => {
    const u = doc.data();
    const div = document.createElement("div");
    div.textContent = u.name;
    div.onclick = () => {
      location.href = `user.html?uid=${doc.id}`;
    };
    userList.appendChild(div);
  });
});
