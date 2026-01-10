import "./firebase.js";

const TOKEN_KEY = "atlas_token";
const USER_KEY  = "atlas_user";

function goTo(path) {
  // aynı klasörde app.html/login.html olduğu için direkt yeter
  window.location.href = path;
}

function setAuth(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUsername() {
  return localStorage.getItem(USER_KEY) || "";
}

export function requireAuth() {
  if (!getToken()) {
    goTo("login.html");
    return false;
  }
  return true;
}

export function login(username, token) {
  setAuth(token, username);
  goTo("app.html");
}

export function logout() {
  clearAuth();
  goTo("login.html");
}

export function currentUsername() {
  return getUsername();
}
