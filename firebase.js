import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

apiKey: "ここ",

authDomain: "ここ",

projectId: "ここ",

storageBucket: "ここ",

messagingSenderId: "ここ",

appId: "ここ"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
