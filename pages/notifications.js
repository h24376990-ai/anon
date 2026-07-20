document.getElementById("readAll").onclick=()=>{

document.querySelectorAll(".unread").forEach(item=>{

item.classList.remove("unread");

});

alert("すべて既読にしました");

};
