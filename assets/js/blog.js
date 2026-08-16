(function () {
  'use strict';

  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const themeIcon = themeToggle.querySelector('.theme-icon');

  function setTheme(isDark) {
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '☀' : '☾';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

  themeToggle.addEventListener('click', function () {
    setTheme(root.getAttribute('data-theme') !== 'dark');
  });
})();
