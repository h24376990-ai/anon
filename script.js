const chatContainer = document.getElementById('chatContainer');
const sendBtn = document.getElementById('sendBtn');
const nameInput = document.getElementById('nameInput');
const iconInput = document.getElementById('iconInput');
const messageInput = document.getElementById('messageInput');

// 送信ボタンの処理
sendBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || '名無し';
  const icon = iconInput.value.trim();
  const messageText = messageInput.value.trim();
  if (!messageText) return;

  addMessage(name, icon, messageText);

  messageInput.value = '';
});

// メッセージをチャットに追加する関数
function addMessage(name, icon, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');

  // 自分か他人かを判定（簡易例：名前が「自分」なら self）
  if (name === '自分') {
    messageDiv.classList.add('self');
  } else {
    messageDiv.classList.add('other');
  }

  const bubbleDiv = document.createElement('div');
  bubbleDiv.classList.add('bubble');

  // 名前表示
  const nameDiv = document.createElement('div');
  nameDiv.classList.add('name');
  nameDiv.textContent = name;
  bubbleDiv.appendChild(nameDiv);

  // アイコン表示
  if (icon) {
    const img = document.createElement('img');
    img.src = icon;
    bubbleDiv.appendChild(img);
  }

  // メッセージ本文
  const textDiv = document.createElement('div');
  textDiv.textContent = text;
  bubbleDiv.appendChild(textDiv);

  messageDiv.appendChild(bubbleDiv);
  chatContainer.appendChild(messageDiv);

  // チャットを下までスクロール
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
