import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML
const regName = document.getElementById("regName");
const regSex = document.getElementById("regSex");
const regPassword = document.getElementById("regPassword");
const regBtn = document.getElementById("regBtn");
const regMessage = document.getElementById("regMessage");

const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

// 🔹 新規登録
regBtn.onclick = async () => {
  const name = regName.value.trim();
  const sex = regSex.value.trim();
  const password = regPassword.value;

  if (!name || !password) {
    regMessage.textContent = "名前とパスワードは必須です";
    return;
  }

  const userDoc = doc(db, "users", name);
  const snap = await getDoc(userDoc);

  if (snap.exists()) {
    regMessage.textContent = "その名前はすでに登録されています";
    return;
  }

  await setDoc(userDoc, { name, sex, password });

  regMessage.style.color = "green";
  regMessage.textContent = "登録成功！そのままログインしてください";

  regName.value = "";
  regSex.value = "";
  regPassword.value = "";
};

// 🔹 ログイン
loginBtn.onclick = async () => {
  const name = loginName.value.trim();
  const password = loginPassword.value;

  if (!name || !password) {
    loginMessage.textContent = "名前とパスワードを入力してください";
    return;
  }

  const userDoc = doc(db, "users", name);
  const snap = await getDoc(userDoc);

  if (!snap.exists()) {
    loginMessage.textContent = "その名前は存在しません";
    return;
  }

  const data = snap.data();
  if (data.password !== password) {
    loginMessage.textContent = "パスワードが違います";
    return;
  }

  // ログイン成功 → chat.html に名前を渡す
  location.href = `chat.html?name=${encodeURIComponent(name)}`;
};
