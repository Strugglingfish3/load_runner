import './style.css';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// On page load, sign out any existing user to ensure a clean login session for the store login page.
if (auth.currentUser) {
    signOut(auth);
}

const loginForm = document.getElementById('store-login-form');
const usernameInput = document.getElementById('store-username');
const passwordInput = document.getElementById('store-password');
const authError = document.getElementById('auth-error');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    authError.classList.add('hidden');

    if (!username || !password) {
        authError.textContent = "Store ID and password cannot be empty.";
        authError.classList.remove('hidden');
        return;
    }

    // Create a dummy email for Firebase Auth from the store username
    const email = `${username}@loadrun.store`;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // On success, redirect to the timer page with the store ID as a query parameter
            window.location.href = `timer.html?store=${username}`;
        })
        .catch((error) => {
            authError.textContent = "Invalid Store ID or password.";
            authError.classList.remove('hidden');
            console.error("Store login error:", error.code, error.message);
        });
});