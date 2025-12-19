// Firebase SDK の読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase 設定（あなたのもの）
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML要素取得
const registerBtn = document.getElementById("registerBtn");
const messageEl = document.getElementById("message");

// ボタンが押されたら
registerBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const password = document.getElementById("password").value.trim();
  const age = document.getElementById("age").value.trim();
  const location = document.getElementById("location").value.trim();
  const bio = document.getElementById("bio").value.trim();

  // 必須チェック
  if (!name || !password) {
    messageEl.textContent = "名前と合言葉は必須です";
    return;
  }

  // 暇チャット方式：名前 → ダミーメール
  const email = `${name}@himachat.local`;

  try {
    // Firebase Authentication に登録
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    // Firestore にプロフィール保存
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      age: age || null,
      location: location || null,
      bio: bio || null,
      createdAt: new Date()
    });

    messageEl.style.color = "green";
    messageEl.textContent = "登録完了！";

    // （次のフェーズでここに画面遷移を書く）

  } catch (error) {
    messageEl.style.color = "red";

    if (error.code === "auth/email-already-in-use") {
      messageEl.textContent = "その名前は既に使われています";
    } else if (error.code === "auth/weak-pass
