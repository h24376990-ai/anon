<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>暇チャット</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<div class="container">
  <h1>暇チャット</h1>

  <!-- 全体チャット -->
  <div id="chatArea"></div>
  <input id="messageInput" placeholder="メッセージ">
  <button id="sendBtn">送信</button>

  <!-- 相手プロフィール -->
  <div id="profileBox" style="display:none; border:1px solid #aaa; padding:8px;">
    <p id="pName"></p>
    <p id="pAge"></p>
    <p id="pLocation"></p>
    <p id="pBio"></p>
    <button id="startPrivateBtn">個人チャット開始</button>
  </div>
</div>

<script type="module" src="chat.js"></script>
</body>
</html>
