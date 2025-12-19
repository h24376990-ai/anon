// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97",
  measurementId: "G-0KWK7SRJHZ"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("Firebase 初期化完了");

// HTML要素取得
const regName = document.getElementById("regName");
const regPassword = document.getElementById("regPassword");
const ageInput = document.getElementById("age");
const locationInput = document.getElementById("location");
const bioInput = document.getElementById("bio");
const registerBtn = document.getElementById("registerBtn");
const registerMessage = document.getElementById("registerMessage");

const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

// 新規登録
registerBtn.addEventListener("click", async () => {
  const email = `${regName.value}@himachat.com`; // 疑似メール
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, regPassword.value);
    const uid = userCredential.user.uid;

    // Firestore にプロフィール保存
    await setDoc(doc(db, "users", uid), {
      name: regName.value,
      age: ageInput.value,
      location: locationInput.value,
      bio: bioInput.value
    });

    alert("登録完了！ログインしてください"); // iPadでも確認可能
  } catch (error) {
    alert("登録に失敗しました: " + error.message);
    console.error(error);
  }
});

// ログイン
loginBtn.addEventListener("click", async () => {
  const email = `${loginName.value}@himachat.com`;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword.value);
    alert("ログイン成功！");
    // chat.html に遷移
    window.location.href = "chat.html?uid=" + userCredential.user.uid;
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      alert("その名前は登録されていません");
    } else if (error.code === "auth/wrong-password") {
      alert("合言葉が間違っています");
    } else {
      alert("ログインに失敗しました: " + error.message);
    }
    console.error(error);
  }
});
