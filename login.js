import { db } from "./firebase.js";
import {
collection,
addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.enter = async function(){

const name=document.getElementById("name").value;

const doc=await addDoc(collection(db,"users"),{

name:name,
time:Date.now()

});

localStorage.setItem("uid",doc.id);
localStorage.setItem("name",name);

location.href="chat.html";

}
