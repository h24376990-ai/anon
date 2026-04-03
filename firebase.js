import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

apiKey: "ここ",
authDomain: "ここ",
projectId: "ここ",
storageBucket: "ここ",
messagingSenderId: "ここ",
appId: "ここ"

};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
