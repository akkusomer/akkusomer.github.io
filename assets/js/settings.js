const $ = (s) => document.querySelector(s);

document.addEventListener("DOMContentLoaded", () => {
  $("#btnBack").addEventListener("click", () => {
    window.location.href = "./app.html";
  });

  $("#btnLogout").addEventListener("click", () => {
    window.location.href = "./login.html";
  });
});
