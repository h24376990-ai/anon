import { auth, db } from "./firebase.js";

import {
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.save = async function(){

const user = auth.currentUser;

const name = document.getElementById("name").value;
const age = document.getElementById("age").value;
const sex = document.getElementById("sex").value;
const bio = document.getElementById("bio").value;

await setDoc(doc(db,"users",user.uid),{

name,
age,
sex,
bio

});

alert("保存しました");

}
