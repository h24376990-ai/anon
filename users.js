import { db } from "./firebase.js";

import {
collection,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const usersDiv = document.getElementById("users");

async function loadUsers(){

const snapshot = await getDocs(collection(db,"users"));

snapshot.forEach(doc=>{

const data = doc.data();

const div = document.createElement("div");

div.className="message";

div.innerHTML = `
<b>${data.name}</b><br>
${data.age} / ${data.sex}
`;

usersDiv.appendChild(div);

});

}

loadUsers();
