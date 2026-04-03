import { db } from "./firebase.js";

import {
collection,
addDoc,
query,
orderBy,
limit,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const chat=document.getElementById("chat");

const q=query(
collection(db,"messages"),
orderBy("time","desc"),
limit(100)
);

onSnapshot(q,(snapshot)=>{

chat.innerHTML="";

snapshot.forEach(doc=>{

const data=doc.data();

const div=document.createElement("div");

div.className="message";

div.textContent=data.name+" : "+data.text;

chat.prepend(div);

});

});

window.send=async function(){

const text=document.getElementById("msg").value;

await addDoc(collection(db,"messages"),{

text:text,
name:localStorage.getItem("name"),
uid:localStorage.getItem("uid"),
time:Date.now()

});

document.getElementById("msg").value="";

}
