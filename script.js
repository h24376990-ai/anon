// ----------------------
// 要素取得
// ----------------------

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const loginPage = document.getElementById("loginPage");
const registerPage = document.getElementById("registerPage");

const loginButton = loginPage.querySelector(".mainButton");
const registerButton = registerPage.querySelector(".mainButton");

// ----------------------
// ログイン画面
// ----------------------

loginTab.addEventListener("click", () => {

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginPage.classList.remove("hidden");
    registerPage.classList.add("hidden");

});

// ----------------------
// 新規登録画面
// ----------------------

registerTab.addEventListener("click", () => {

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerPage.classList.remove("hidden");
    loginPage.classList.add("hidden");

});

// ----------------------
// 仮ログイン
// ----------------------

loginButton.addEventListener("click", () => {

    const id = document.getElementById("loginId").value;
    const password = document.getElementById("loginPassword").value;

    if(id === "" || password === ""){

        alert("IDとパスワードを入力してください");
        return;

    }

    localStorage.setItem("userName", id);

    window.location.href = "pages/home.html";

});

// ----------------------
// 仮登録
// ----------------------

registerButton.addEventListener("click", () => {

    alert("登録機能は後で追加します！");

});
