import { auth, db } from "./firebase.js";

import {
collection,
query,
where,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const div = document.getElementById("friends");

async function loadFriends(){

const q = query(
collection(db,"friends"),
where("users","array-contains",auth.currentUser.uid)
);

const snapshot = await getDocs(q);

snapshot.forEach(doc=>{

const data = doc.data();

const el = document.createElement("div");

el.className="message";

el.textContent = data.users.join(" / ");

div.appendChild(el);

});

}

loadFriends();
