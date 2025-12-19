// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase 設定（自分の FirebaseConfig に置き換える）
const firebaseConfig = {
  apiKey: "xxxxxx",
  authDomain: "xxxxxx.firebaseapp.com",
  projectId: "xxxxxx",
  storageBucket: "xxxxxx.appspot.com",
  messagingSenderId: "xxxxxx",
  appId: "xxxxxx"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("Firebase 初期化完了");

// HTML要素
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

    registerMessage.style.color = "green";
    registerMessage.textContent = "登録完了！ログインしてください";
  } catch (error) {
    registerMessage.style.color = "red";
    registerMessage.textContent = "登録に失敗しました";
    console.error(error);
  }
});

// ログイン
loginBtn.addEventListener("click", async () => {
  const email = `${loginName.value}@himachat.com`;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword.value);
    loginMessage.style.color = "green";
    loginMessage.textContent = "ログイン成功！";

    // ログイン後、chat.html に遷移
    setTimeout(() => {
      window.location.href = "chat.html?uid=" + userCredential.user.uid;
    }, 500);
  } catch (error) {
    loginMessage.style.color = "red";
    if (error.code === "auth/user-not-found") {
      loginMessage.textContent = "その名前は登録されていません";
    } else if (error.code === "auth/wrong-password") {
      loginMessage.textContent = "合言葉が間違っています";
    } else {
      loginMessage.textContent = "ログインに失敗しました";
    }
    console.error(error);
  }
});
