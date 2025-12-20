import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const nameInput = document.getElementById("emailInput"); // 名前欄を使う
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

loginBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!name || !password) {
    message.textContent = "名前とパスワードを入力してください";
    return;
  }

  try {
    // Firestore で名前とパスワードを照合
    const q = query(
      collection(db, "users"),
      where("name", "==", name),
      where("password", "==", password)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      message.textContent = "ログインに失敗しました";
      return;
    }

    // 成功したらチャット画面へ
    const userData = snap.docs[0].data();
    const uid = snap.docs[0].id;

    // uidをURLパラメータで渡す
    location.href = `chat.html?uid=${uid}`;
  } catch (err) {
    message.textContent = "ログイン中にエラーが発生しました: " + err.message;
  }
};
