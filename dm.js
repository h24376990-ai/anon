import { db } from "./firebase.js";

import {
collection,
query,
where,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const uid=localStorage.getItem("uid");

async function load(){

const q=query(
collection(db,"dm_rooms"),
where("members","array-contains",uid)
);

const snap=await getDocs(q);

snap.forEach(doc=>{

const div=document.createElement("div");

div.innerHTML=`
<a href="private.html?room=${doc.id}">
DMルーム
</a>
`;

document.body.appendChild(div);

});

}

load();
