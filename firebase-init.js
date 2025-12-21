// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config（既存のものをそのまま）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

// 初期化
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 認証保証関数（重要）
export function ensureAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // すでにログイン済み
      callback(user);
    } else {
      // 未ログイン時のみ匿名ログイン
      await signInAnonymously(auth);
      // onAuthStateChanged が再度呼ばれる
    }
  });
}
