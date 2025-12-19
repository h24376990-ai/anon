import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0R2KYt2MgJHaiYQ9oM8IMXhX9oj-Ky_c",
  authDomain: "anon-chat-de585.firebaseapp.com",
  projectId: "anon-chat-de585",
  storageBucket: "anon-chat-de585.firebasestorage.app",
  messagingSenderId: "1035093625910",
  appId: "1:1035093625910:web:65ba2370a79f73e23b9c97"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const nameInput = document.getElementById("name");
const passwordInput = document.getElementById("password");
const ageInput = document.getElementById("age");
const locationInput = document.getElementById("location");
const bioInput = document.getElementById("bio");
const registerBtn = document.getElementById("registerBtn");
const messageEl = document.getElementById("message");

registerBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();
  const age = ageInput.value.trim();
  const location = locationInput.value.trim();
  const bio = bioInput.value.trim();

  if (!name || !password) {
    messageEl.textContent = "名前と合言葉は必須です";
    return;
  }

  const fakeEmail = `${name}@himachat.com`;

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      fakeEmail,
      password
    );

    const uid = userCredential.user.uid;

    await setDoc(doc(db, "users", uid), {
      name,
      age,
      location,
      bio,
      createdAt: new Date()
    });

    messageEl.textContent = "登録完了！";

  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      messageEl.textContent = "この名前はすでに使われています";
    } else {
      messageEl.textContent = "登録に失敗しました";
    }
    console.error(error);
  }
});
