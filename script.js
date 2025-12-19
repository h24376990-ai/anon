// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML要素取得（登録用）
const nameInput = document.getElementById("name");
const passwordInput = document.getElementById("password");
const ageInput = document.getElementById("age");
const locationInput = document.getElementById("location");
const bioInput = document.getElementById("bio");
const registerBtn = document.getElementById("registerBtn");
const messageEl = document.getElementById("message");

// HTML要素取得（ログイン用）
const loginNameInput = document.getElementById("loginName");
const loginPasswordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessageEl = document.getElementById("loginMessage");

// ===== 登録処理 =====
registerBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();
  const age = ageInput.value.trim();
  const location = locationInput.value.trim();
  const bio = bioInput.value.trim();

  if (!name || !password) {
    messageEl.textContent = "名前と合言葉は必須です";
    return;
  }

  const fakeEmail = `${name}@himachat.com`;

  try {
    // 新規ユーザー登録
    const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
    const uid = userCredential.user.uid;

    // Firestore にプロフィール保存
    await setDoc(doc(db, "users", uid), {
      name,
      age: age || "",
      location: location || "",
      bio: bio || "",
      createdAt: new Date()
    });

    messageEl.style.color = "green";
    messageEl.textContent = "登録完了！";

    // （後でチャット画面へ移動）
    // location.href = "chat.html";

  } catch (error) {
    messageEl.style.color = "red";
    if (error.code === "auth/email-already-in-use") {
      messageEl.textContent = "この名前はすでに使われています";
    } else {
      messageEl.textContent = "登録に失敗しました";
    }
    console.error(error);
  }
});

// ===== ログイン処理 =====
loginBtn.addEventListener("click", async () => {
  const name = loginNameInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!name || !password) {
    loginMessageEl.textContent = "名前と合言葉を入力してください";
    return;
  }

  const fakeEmail = `${name}@himachat.com`;

  try {
    // 既存ユーザーでログイン
    const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);

    loginMessageEl.style.color = "green";
    loginMessageEl.textContent = "ログイン成功！";

    // （後でチャット画面へ移動）
    // location.href = "chat.html";

  } catch (error) {
    loginMessageEl.style.color = "red";
    if (error.code === "auth/user-not-found") {
      loginMessageEl.textContent = "その名前は登録されていません";
    } else if (error.code === "auth/wrong-password") {
      loginMessageEl.textContent = "合言葉が間違っています";
    } else {
      loginMessageEl.textContent = "ログインに失敗しました";
    }
    console.error(error);
  }
});
