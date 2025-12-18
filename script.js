// Firebaseの設定
import { db, auth } from './firebase.js'; // firebase.jsでFirebase設定をインポート

// 募集内容を追加する関数
function addRecruitment(name, profileLink) {
    const listItem = document.createElement('li');
    listItem.innerHTML = `<a href="${profileLink}">${name}</a>`;  // 名前をクリックでプロフィールページに飛ぶ
    document.getElementById('recruitmentList').appendChild(listItem);
}

// 募集リストにサンプルデータを追加
addRecruitment("ユーザーA", "/profile/1");
addRecruitment("ユーザーB", "/profile/2");

// フレンドリストにサンプルデータを追加
function addFriend(name) {
    const listItem = document.createElement('li');
    listItem.textContent = name;
    document.getElementById('friendList').appendChild(listItem);
}

addFriend("友達A");
addFriend("友達B");

// メッセージ送信ボタンのクリックイベント
document.getElementById('sendButton').addEventListener('click', function() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;

    if (message.trim() !== "") {
        addMessageToChat("あなた: " + message);
        messageInput.value = "";  // メッセージを送信後、入力フィールドをクリア
    }
});

// メッセージをチャットボックスに追加する関数
function addMessageToChat(message) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 新しいメッセージが下に来るようにスクロール
}

// プロフィール設定を保存する
document.getElementById('profileForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const photo = document.getElementById('photo').files[0];

    // Firestoreにプロフィール情報を保存
    const userId = auth.currentUser.uid;
    saveUserProfile(userId, name, photo);

    alert("プロフィールが保存されました!");
});

// プロフィール情報をFirestoreに保存する関数
function saveUserProfile(userId, name, photo) {
    db.collection('users').doc(userId).set({
        name: name,
        photoURL: photo ? URL.createObjectURL(photo) : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
        console.log("プロフィールが保存されました!");
    })
    .catch((error) => {
        console.error("エラーが発生しました: ", error);
    });
}
