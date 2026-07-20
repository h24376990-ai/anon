document.querySelectorAll(".like").forEach(button=>{

button.addEventListener("click",()=>{

const span=button.querySelector("span");

let count=Number(span.textContent);

count++;

span.textContent=count;

button.disabled=true;

button.style.background="#ffd6d6";

});

});

document.getElementById("newPost").onclick=()=>{

const text=prompt("投稿内容を入力してください");

if(!text)return;

const container=document.querySelector(".container");

const post=document.createElement("div");

post.className="post";

post.innerHTML=`

<div class="top">

<div class="avatar">😊</div>

<div>

<h3>あなた</h3>

<small>たった今</small>

</div>

</div>

<p class="text">${text}</p>

<div class="actions">

<button class="like">❤️ <span>0</span></button>

<button>💬 コメント</button>

</div>

`;

container.prepend(post);

};
