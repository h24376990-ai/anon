// 既存の Firebase 初期化・全体チャット・個人チャット関数はそのまま

const loginBox = document.getElementById("loginBox");
const chatBox = document.getElementById("chatBox");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    myUid = user.uid;
    myName = user.displayName || "名無し";

    // ログイン成功したらフォーム非表示・チャット画面表示
    loginBox.style.display = "none";
    chatBox.style.display = "block";

    // 既存機能の呼び出し
    subscribeDMList(); // 個人チャット一覧
    initGlobalChat();  // 全体チャット
    // 既存のプロフィール・個人チャット作成もここで動かせます

  } catch (error) {
    alert("ログインに失敗しました: " + error.message);
  }
});
