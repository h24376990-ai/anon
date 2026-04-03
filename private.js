import { db } from "./firebase.js";

import {
collection,
addDoc,
query,
orderBy,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const room = params.get("room");

const chat = document.getElementById("chat");

const q = query(
collection(db,"dm_messages"),
orderBy("time")
);

onSnapshot(q,(snapshot)=>{

chat.innerHTML="";

snapshot.forEach(doc=>{

const data = doc.data();

if(data.room!==room) return;

const div = document.createElement("div");

div.className="message";

div.textContent = data.text;

chat.appendChild(div);

});

});

window.send = async function(){

const text = document.getElementById("msg").value;

await addDoc(collection(db,"dm_messages"),{

room,
text,
time:Date.now()

});

}
