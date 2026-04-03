import { db } from "./firebase.js";

import {
collection,
query,
where,
getDocs,
addDoc,
deleteDoc,
doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const uid=localStorage.getItem("uid");

async function load(){

const q=query(
collection(db,"friend_requests"),
where("to","==",uid)
);

const snap=await getDocs(q);

snap.forEach(d=>{

const data=d.data();

const div=document.createElement("div");

div.innerHTML=`
申請:${data.from}

<button onclick="accept('${d.id}','${data.from}')">承認</button>
`;

document.body.appendChild(div);

});

}

load();

window.accept=async function(id,user){

await addDoc(collection(db,"friends"),{

users:[uid,user]

});

await deleteDoc(doc(db,"friend_requests",id));

alert("フレンド追加");

}
