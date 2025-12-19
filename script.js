// ===== 確認用（これが出なければ script.js は読まれていない）=====
alert("script.js が読み込まれました");

// ===== Firebase SDK 読み込み =====
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

// ===== Firebase 設定 =====
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

// ===== 初期化 =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== HTML要素取得 =====
const registerBtn = document.getElementById("registerBtn");
const messageEl = document.getElementById("message");

// ===== ボタン存在チェック =====
if (!registerBtn) {
  alert("registerBtn が見つかりません");
}

// ===== ボタン処理 =====
registerBtn.addEventListener("click", async () => {
  alert("登録ボタンが押されました");

  const name = document.getElementById("name").value.trim();
  const password = document.getElementById("password").value.trim();
  const age = document.getElementById("age").value.trim();
  const location = document.getElementById("location").value.trim();
  const bio = document.getElementById("bio").value.trim();

  if (!name || !password) {
    messageEl.textContent = "名前と合言葉は必須です";
    return;
  }

  const email = `${name}@himachat.local`;

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      name,
      age: age || null,
      location: location || null,
      bio: bio || null,
      createdAt: new Date()
    });

    messageEl.style.color = "green";
    messageEl.textContent = "登録完了！";

  } catch (error) {
    alert("エラーが発生しました");

    messageEl.style.color = "red";
    messageEl.textContent = error.code || "登録失敗";

    console.error(error);
  }
});
