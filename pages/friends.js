const buttons = document.querySelectorAll(".friend button");

buttons.forEach(button=>{

button.addEventListener("click",()=>{

button.textContent="追加済み";

button.style.background="#9ca3af";

button.disabled=true;

});

});

const search=document.getElementById("search");

search.addEventListener("input",()=>{

const value=search.value.toLowerCase();

const friends=document.querySelectorAll(".friend");

friends.forEach(friend=>{

const name=friend.querySelector("h3").textContent.toLowerCase();

friend.style.display=name.includes(value)?"flex":"none";

});

});
