import { db } from "./firebase.js";

import {
collection,
getDocs,
addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const div=document.getElementById("users");

async function load(){

const snap=await getDocs(collection(db,"users"));

snap.forEach(doc=>{

const data=doc.data();

if(doc.id===localStorage.getItem("uid")) return;

const el=document.createElement("div");

el.className="message";

el.innerHTML=`
${data.name}

<button onclick="friend('${doc.id}')">フレンド</button>
<button onclick="dm('${doc.id}')">DM</button>
<button onclick="block('${doc.id}')">ブロック</button>
<button onclick="report('${doc.id}')">通報</button>
`;

div.appendChild(el);

});

}

load();

window.friend=async function(uid){

await addDoc(collection(db,"friend_requests"),{

from:localStorage.getItem("uid"),
to:uid

});

alert("申請しました");

}

window.dm=async function(uid){

await addDoc(collection(db,"dm_rooms"),{

members:[localStorage.getItem("uid"),uid]

});

alert("DM作成");

}

window.block=async function(uid){

await addDoc(collection(db,"blocks"),{

from:localStorage.getItem("uid"),
to:uid

});

alert("ブロック");

}

window.report=async function(uid){

await addDoc(collection(db,"reports"),{

reporter:localStorage.getItem("uid"),
target:uid

});

alert("通報");

}
