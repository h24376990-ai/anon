import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/* ====== HTML要素 ====== */
const regName = document.getElementById("regName");
const regPassword = document.getElementById("regPassword");
const regBtn = document.getElementById("regBtn");
const regMessage = document.getElementById("regMessage");

const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

/* ====== 新規登録処理 ====== */
regBtn.onclick = async () => {
  const name = regName.value.trim();
  const password = regPassword.value.trim();

  if (!name || !password) {
    regMessage.textContent = "名前とパスワードを入力してください";
    return;
  }

  // 同じ名前がないか確認
  const q = query(collection(db, "users"), where("name", "==", name));
  const snap = await getDocs(q);
  if (!snap.empty) {
    regMessage.textContent = "その名前はすでに使われています";
    return;
  }

  // Firestore にユーザー作成
  await addDoc(collection(db, "users"), {
    name,
    password,
    age: "",
    location: "",
    bio: "",
    createdAt: new Date()
  });

  regMessage.style.color = "green";
  regMessage.textContent = "登録完了！ログインしてください";
  regName.value = "";
  regPassword.value = "";
};

/* ====== ログイン処理 ====== */
loginBtn.onclick = async () => {
  const name = loginName.value.trim();
  const password = loginPassword.value.trim();

  if (!name || !password) {
    loginMessage.textContent = "名前とパスワードを入力してください";
    return;
  }

  // ユーザー検索
  const q = query(collection(db, "users"),
                  where("name", "==", name),
                  where("password", "==", password));
  const snap = await getDocs(q);

  if (snap.empty) {
    loginMessage.textContent = "ログインに失敗しました";
    return;
  }

  // ログイン成功
  const docData = snap.docs[0].data();
  const uid = snap.docs[0].id;

  // chat.html に遷移
  location.href = `chat.html?uid=${uid}`;
};
