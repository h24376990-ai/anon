// ----------------------------
// Firebase 初期化
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ----------------------------
// HTML 要素
const loginBox = document.getElementById("loginBox");
const chatBox = document.getElementById("chatBox");
const welcomeText = document.getElementById("welcomeText");

// ----------------------------
// ログインボタン
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // ログイン成功 → 画面切り替え
    loginBox.style.display = "none";
    chatBox.style.display = "block";

    welcomeText.textContent = `ようこそ、${user.email}さん！`;

  } catch (error) {
    alert("ログインに失敗しました: " + error.message);
  }
});
