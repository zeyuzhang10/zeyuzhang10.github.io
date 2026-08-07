(function () {
  'use strict';

  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const listPanel = document.getElementById('blogListPanel');
  const editorPanel = document.getElementById('blogEditorPanel');
  const newPostButton = document.getElementById('newPostButton');
  const backButton = document.getElementById('backToPostsButton');
  const form = document.getElementById('blogForm');
  const titleInput = document.getElementById('postTitle');
  const visibilityInput = document.getElementById('postVisibility');
  const markdownInput = document.getElementById('postMarkdown');
  const preview = document.getElementById('markdownPreview');
  const previewVisibility = document.getElementById('previewVisibility');
  const status = document.getElementById('blogStatus');
  const submissionDate = document.getElementById('submissionDate');
  const localPosts = document.getElementById('localPosts');
  const draftKey = 'zeyu-blog-draft-v1';
  const postsKey = 'zeyu-blog-posts-v1';

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

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.getFullYear() + '.' + (date.getMonth() + 1) + '.' + date.getDate();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }

  function renderInline(value) {
    return value
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  function renderMarkdown(markdown) {
    const lines = escapeHtml(markdown).split(/\r?\n/);
    const output = [];
    let inList = false;

    lines.forEach(function (line) {
      if (/^[-*] /.test(line)) {
        if (!inList) {
          output.push('<ul>');
          inList = true;
        }
        output.push('<li>' + renderInline(line.slice(2)) + '</li>');
        return;
      }

      if (inList) {
        output.push('</ul>');
        inList = false;
      }

      if (line.startsWith('### ')) output.push('<h3>' + renderInline(line.slice(4)) + '</h3>');
      else if (line.startsWith('## ')) output.push('<h2>' + renderInline(line.slice(3)) + '</h2>');
      else if (line.startsWith('# ')) output.push('<h1>' + renderInline(line.slice(2)) + '</h1>');
      else if (line.startsWith('> ')) output.push('<blockquote>' + renderInline(line.slice(2)) + '</blockquote>');
      else if (line.trim()) output.push('<p>' + renderInline(line) + '</p>');
    });

    if (inList) output.push('</ul>');
    return output.join('');
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
  }

  function updatePreview() {
    const title = titleInput.value.trim() || 'Untitled';
    const body = markdownInput.value.trim() ? renderMarkdown(markdownInput.value) : '<p>Your Markdown preview will appear here.</p>';
    preview.innerHTML = '<h2>' + escapeHtml(title) + '</h2>' + body;
    const isPrivate = visibilityInput.value === 'private';
    previewVisibility.innerHTML = '<i class="fa-solid ' + (isPrivate ? 'fa-lock' : 'fa-globe') + '" aria-hidden="true"></i>' + (isPrivate ? 'Private' : 'Public');
  }

  function renderLocalPosts() {
    const posts = readJson(postsKey, []);
    localPosts.innerHTML = posts.map(function (post) {
      const plainText = post.markdown.replace(/[#>*_`-]/g, ' ').replace(/\s+/g, ' ').trim();
      const excerpt = plainText.length > 150 ? plainText.slice(0, 147) + '…' : plainText;
      const privacy = post.visibility === 'private'
        ? '<span class="blog-private"><i class="fa-solid fa-lock" aria-hidden="true"></i>Private</span>'
        : '';
      return '<article class="blog-entry">' +
        '<time datetime="' + escapeHtml(post.createdAt) + '">' + escapeHtml(formatDate(post.createdAt)) + '</time>' +
        '<div class="blog-entry-content"><div class="blog-entry-title-row"><h2>' + escapeHtml(post.title) + '</h2>' + privacy + '</div>' +
        '<p>' + escapeHtml(excerpt) + '</p><div class="blog-tags"><span>Markdown</span></div></div></article>';
    }).join('');
  }

  function openEditor() {
    const draft = readJson(draftKey, {});
    titleInput.value = draft.title || '';
    visibilityInput.value = draft.visibility || 'public';
    markdownInput.value = draft.markdown || '';
    submissionDate.textContent = 'Submitted ' + formatDate(new Date());
    status.hidden = true;
    listPanel.hidden = true;
    editorPanel.hidden = false;
    updatePreview();
    titleInput.focus();
  }

  function closeEditor() {
    editorPanel.hidden = true;
    listPanel.hidden = false;
    newPostButton.focus();
  }

  newPostButton.addEventListener('click', openEditor);
  backButton.addEventListener('click', closeEditor);
  titleInput.addEventListener('input', updatePreview);
  markdownInput.addEventListener('input', updatePreview);
  visibilityInput.addEventListener('change', updatePreview);

  document.getElementById('saveDraftButton').addEventListener('click', function () {
    localStorage.setItem(draftKey, JSON.stringify({
      title: titleInput.value,
      visibility: visibilityInput.value,
      markdown: markdownInput.value
    }));
    showStatus('Draft saved in this browser.');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const title = titleInput.value.trim();
    const markdown = markdownInput.value.trim();
    if (!title || !markdown) return;

    const posts = readJson(postsKey, []);
    posts.unshift({
      title: title,
      visibility: visibilityInput.value,
      markdown: markdown,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(postsKey, JSON.stringify(posts));
    localStorage.removeItem(draftKey);
    renderLocalPosts();
    showStatus('Markdown post saved in this browser.');
    window.setTimeout(closeEditor, 650);
  });

  renderLocalPosts();
  updatePreview();
})();

