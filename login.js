import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    message.textContent = "メールとパスワードを入力してください";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.href = "chat.html"; // ログイン成功でチャット画面へ
  } catch (err) {
    message.textContent = "ログインに失敗しました: " + err.message;
  }
};
