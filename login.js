import { auth } from "./firebase.js";

import {
signInWithEmailAndPassword,
createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.login = async function(){

const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

await signInWithEmailAndPassword(auth,email,password);

location.href="chat.html";

}

window.register = async function(){

const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

await createUserWithEmailAndPassword(auth,email,password);

alert("登録成功");

}
