document.getElementById("send-button").addEventListener("click", function() {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;

  if (message.trim() !== "") {
    const messageDiv = document.createElement("div");
    messageDiv.textContent = message;
    document.getElementById("messages").appendChild(messageDiv);
    messageInput.value = "";
    messageInput.focus();
  }
});
