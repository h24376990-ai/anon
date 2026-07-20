// ===============================
// つながり Home
// ===============================

// ログイン名取得
const userName = localStorage.getItem("userName") || "ゲスト";

// 表示
document.getElementById("userName").textContent = userName;
document.getElementById("profileName").textContent = userName;

// ===============================
// フレンド申請
// ===============================

const friendButtons = document.querySelectorAll(".friendCard button");

friendButtons.forEach(button => {

    button.addEventListener("click", () => {

        button.textContent = "申請済み";

        button.disabled = true;

        button.style.background = "#9ca3af";

        alert("フレンド申請を送りました！");

    });

});

// ===============================
// 下メニュー
// ===============================

const navButtons = document.querySelectorAll("nav button");

navButtons[0].addEventListener("click", () => {

    alert("ホーム");

});

navButtons[1].addEventListener("click", () => {

    alert("フレンド画面は次回作成します");

});

navButtons[2].addEventListener("click", () => {

    alert("チャット画面は次回作成します");

});

navButtons[3].addEventListener("click", () => {

    alert("通知画面は次回作成します");

});

navButtons[4].addEventListener("click", () => {

    alert("設定画面は次回作成します");

});

// ===============================
// タイムライン
// ===============================

const posts = document.querySelectorAll(".post");

posts.forEach(post => {

    post.addEventListener("click", () => {

        post.style.transform = "scale(.98)";

        setTimeout(() => {

            post.style.transform = "scale(1)";

        },120);

    });

});
