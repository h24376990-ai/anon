import { db, auth } from "./firebase.js";

import {
collection,
query,
where,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const roomsDiv = document.getElementById("rooms");

async function loadRooms(){

const q = query(
collection(db,"dm_rooms"),
where("members","array-contains",auth.currentUser.uid)
);

const snapshot = await getDocs(q);

snapshot.forEach(doc=>{

const div = document.createElement("div");

div.className="message";

div.innerHTML = `
<a href="private.html?room=${doc.id}">
DMルーム
</a>
`;

roomsDiv.appendChild(div);

});

}

loadRooms();
