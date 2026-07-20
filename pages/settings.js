let dark=false;

document.getElementById("theme").onclick=()=>{

dark=!dark;

document.body.classList.toggle("dark");

document.getElementById("theme").textContent=
dark ? "ダークモード ON" : "ダークモード OFF";

};

document.getElementById("editName").onclick=()=>{

const name=prompt("新しい名前");

if(name){

localStorage.setItem("userName",name);

alert("変更しました");

}

};

document.getElementById("logout").onclick=()=>{

if(confirm("ログアウトしますか？")){

localStorage.clear();

location.href="../index.html";

}

};
