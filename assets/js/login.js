import { login } from "./auth.js";

const form = document.querySelector("#loginForm");
const statusEl = document.querySelector("#loginStatus");

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!username || !password) {
      setStatus("Lütfen kullanıcı adı ve şifre girin.");
      return;
    }

    // Placeholder token: replace with real auth in backend integration.
    const token = `token_${Date.now()}`;
    login(username, token);
  });
}
