const input=document.getElementById("messageInput");

const send=document.getElementById("send");

const messages=document.getElementById("messages");

send.addEventListener("click",sendMessage);

input.addEventListener("keypress",e=>{

if(e.key==="Enter"){

sendMessage();

}

});

function sendMessage(){

const text=input.value.trim();

if(text==="") return;

const msg=document.createElement("div");

msg.className="message me";

const now=new Date();

const h=String(now.getHours()).padStart(2,"0");

const m=String(now.getMinutes()).padStart(2,"0");

msg.innerHTML=`
${text}
<span>${h}:${m}</span>
`;

messages.appendChild(msg);

messages.scrollTop=messages.scrollHeight;

input.value="";

}

document.getElementById("back").onclick=()=>{

location.href="chat.html";

};
