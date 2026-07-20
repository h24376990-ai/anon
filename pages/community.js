document.querySelectorAll(".community button").forEach(button=>{

button.onclick=()=>{

button.textContent="参加中";

button.disabled=true;

button.style.background="#9ca3af";

};

});

document.getElementById("createCommunity").onclick=()=>{

const name=prompt("コミュニティ名を入力してください");

if(!name)return;

const list=document.getElementById("communityList");

const div=document.createElement("div");

div.className="community";

div.innerHTML=`

<div class="icon">🌟</div>

<div class="info">

<h3>${name}</h3>

<p>メンバー 1人</p>

</div>

<button>参加中</button>

`;

list.prepend(div);

};

document.getElementById("search").addEventListener("input",e=>{

const text=e.target.value.toLowerCase();

document.querySelectorAll(".community").forEach(c=>{

const name=c.querySelector("h3").textContent.toLowerCase();

c.style.display=name.includes(text)?"flex":"none";

});

});
