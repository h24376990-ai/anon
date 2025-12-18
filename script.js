const sendBtn = document.getElementById("send");
const messagesDiv = document.getElementById("messages");

sendBtn.addEventListener("click", () => {
  const name = document.getElementById("name").value;
  const message = document.getElementById("message").value;

  if (!name || !message) return;

  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = `${name}：${message}`;

  messagesDiv.appendChild(div);
  document.getElementById("message").value = "";
});
