const userName = localStorage.getItem("userName") || "ゲスト";

document.getElementById("name").textContent = userName;

document.getElementById("editBtn").addEventListener("click",()=>{

const bio = prompt("自己紹介を入力してください");

if(bio){

document.querySelector(".bio").textContent = bio;

}

});
