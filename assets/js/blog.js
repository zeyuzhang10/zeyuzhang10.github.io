(function () {
  'use strict';

  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const listPanel = document.getElementById('blogListPanel');
  const editorPanel = document.getElementById('blogEditorPanel');
  const detailPanel = document.getElementById('blogDetailPanel');
  const blogPostList = document.getElementById('blogPostList');
  const newPostButton = document.getElementById('newPostButton');
  const backButton = document.getElementById('backToPostsButton');
  const backFromDetailButton = document.getElementById('backToPostsFromDetailButton');
  const form = document.getElementById('blogForm');
  const titleInput = document.getElementById('postTitle');
  const tagsInput = document.getElementById('postTags');
  const markdownInput = document.getElementById('postMarkdown');
  const preview = document.getElementById('markdownPreview');
  const previewTags = document.getElementById('previewTags');
  const status = document.getElementById('blogStatus');
  const submissionDate = document.getElementById('submissionDate');
  const editorHeading = document.getElementById('editorHeading');
  const submitPostButton = document.getElementById('submitPostButton');
  const detailDate = document.getElementById('detailDate');
  const detailHeading = document.getElementById('detailHeading');
  const detailTags = document.getElementById('detailTags');
  const detailMarkdown = document.getElementById('detailMarkdown');
  const editPostButton = document.getElementById('editPostButton');
  const deletePostButton = document.getElementById('deletePostButton');

  const draftKey = 'zeyu-blog-draft-v1';
  const postsKey = 'zeyu-blog-posts-v1';
  const overridesKey = 'zeyu-blog-overrides-v1';
  const deletedKey = 'zeyu-blog-deleted-v1';
  let editingId = null;
  let selectedPost = null;

  const staticPosts = Array.from(blogPostList.children).map(function (entry, index) {
    return {
      id: entry.dataset.postId || ('built-in-' + index),
      title: entry.querySelector('h2').textContent.trim(),
      markdown: entry.querySelector('p').textContent.trim(),
      tags: Array.from(entry.querySelectorAll('.blog-tags span')).map(function (tag) {
        return tag.textContent.trim();
      }),
      createdAt: entry.querySelector('time').getAttribute('datetime'),
      builtIn: true
    };
  });

  function setTheme(isDark) {
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '☀' : '☾';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
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
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function parseTags(value) {
    return value
      .split(/[\s,]+/)
      .map(function (tag) { return tag.trim().replace(/^#+/, ''); })
      .filter(Boolean)
      .filter(function (tag, index, tags) {
        return tags.findIndex(function (candidate) {
          return candidate.toLowerCase() === tag.toLowerCase();
        }) === index;
      });
  }

  function tagsMarkup(tags) {
    return (tags || []).map(function (tag) {
      return '<span>' + escapeHtml(String(tag).replace(/^#+/, '')) + '</span>';
    }).join('');
  }

  function normalizeLocalPosts() {
    const posts = readJson(postsKey, []);
    if (!Array.isArray(posts)) return [];
    return posts.map(function (post, index) {
      return {
        id: post.id || ('local-' + index + '-' + String(post.createdAt || Date.now()).replace(/\W/g, '')),
        title: String(post.title || 'Untitled'),
        markdown: String(post.markdown || ''),
        tags: Array.isArray(post.tags) ? post.tags : [],
        createdAt: post.createdAt || new Date().toISOString(),
        updatedAt: post.updatedAt || null,
        builtIn: false
      };
    });
  }

  function getAllPosts() {
    const overrides = readJson(overridesKey, {});
    const deletedIds = readJson(deletedKey, []);
    const activeDeletedIds = Array.isArray(deletedIds) ? deletedIds : [];
    const activeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
    const builtInPosts = staticPosts
      .filter(function (post) { return activeDeletedIds.indexOf(post.id) === -1; })
      .map(function (post) {
        return Object.assign({}, post, activeOverrides[post.id] || {}, { id: post.id, builtIn: true });
      });
    return builtInPosts.concat(normalizeLocalPosts()).sort(function (first, second) {
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }

  function findPost(postId) {
    return getAllPosts().find(function (post) { return post.id === postId; });
  }

  function excerptFrom(markdown) {
    const plainText = String(markdown || '').replace(/[#>*_`-]/g, ' ').replace(/\s+/g, ' ').trim();
    return plainText.length > 150 ? plainText.slice(0, 147) + '…' : plainText;
  }

  function postMarkup(post) {
    return '<article class="blog-entry" data-post-id="' + escapeHtml(post.id) + '">' +
      '<time datetime="' + escapeHtml(post.createdAt) + '">' + escapeHtml(formatDate(post.createdAt)) + '</time>' +
      '<div class="blog-entry-content"><div class="blog-entry-title-row">' +
        '<h2><a class="blog-post-title" href="#post-' + encodeURIComponent(post.id) + '">' + escapeHtml(post.title) + '</a></h2>' +
        '<div class="blog-entry-actions" aria-label="Post actions">' +
          '<button class="blog-icon-button" data-action="edit" type="button" title="Edit post" aria-label="Edit ' + escapeHtml(post.title) + '"><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i></button>' +
          '<button class="blog-icon-button blog-danger-button" data-action="delete" type="button" title="Delete post" aria-label="Delete ' + escapeHtml(post.title) + '"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>' +
        '</div></div>' +
        '<p>' + escapeHtml(excerptFrom(post.markdown)) + '</p>' +
        '<div class="blog-tags">' + tagsMarkup(post.tags) + '</div>' +
      '</div></article>';
  }

  function renderPosts() {
    const posts = getAllPosts();
    blogPostList.innerHTML = posts.length
      ? posts.map(postMarkup).join('')
      : '<p class="blog-empty-state">No posts yet. Create your first note.</p>';
  }

  function setVisiblePanel(panel) {
    listPanel.hidden = panel !== listPanel;
    editorPanel.hidden = panel !== editorPanel;
    detailPanel.hidden = panel !== detailPanel;
  }

  function showDetail(post) {
    selectedPost = post;
    detailDate.textContent = formatDate(post.createdAt);
    detailHeading.textContent = post.title;
    detailTags.innerHTML = tagsMarkup(post.tags);
    detailMarkdown.innerHTML = renderMarkdown(post.markdown);
    setVisiblePanel(detailPanel);
  }

  function openPost(postId, updateHash) {
    const post = findPost(postId);
    if (!post) {
      showList(updateHash);
      return;
    }
    if (updateHash) {
      const nextHash = '#post-' + encodeURIComponent(post.id);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
        return;
      }
    }
    showDetail(post);
  }

  function showList(clearHash) {
    editingId = null;
    selectedPost = null;
    setVisiblePanel(listPanel);
    if (clearHash && window.location.hash.indexOf('#post-') === 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function openEditor(post) {
    const savedDraft = readJson(draftKey, {});
    const draft = post || (!savedDraft.editingId ? savedDraft : {});
    editingId = post ? post.id : null;
    selectedPost = post || null;
    editorHeading.textContent = editingId ? 'Edit Blog Post' : 'New Blog Post';
    submitPostButton.textContent = editingId ? 'Update Markdown' : 'Publish Markdown';
    titleInput.value = draft.title || '';
    tagsInput.value = (draft.tags || []).map(function (tag) { return String(tag).replace(/^#+/, ''); }).join(' #');
    markdownInput.value = draft.markdown || '';
    submissionDate.textContent = editingId ? 'Editing ' + formatDate(draft.createdAt) : 'Submitted ' + formatDate(new Date());
    status.hidden = true;
    setVisiblePanel(editorPanel);
    updatePreview();
    titleInput.focus();
  }

  function updatePreview() {
    const title = titleInput.value.trim() || 'Untitled';
    const markdown = markdownInput.value.trim();
    preview.innerHTML = '<h2>' + escapeHtml(title) + '</h2>' + (markdown ? renderMarkdown(markdown) : '<p>Your Markdown preview will appear here.</p>');
    previewTags.innerHTML = tagsMarkup(parseTags(tagsInput.value));
  }

  function deletePost(post) {
    if (!post || !window.confirm('Delete “' + post.title + '”? This cannot be undone in this browser.')) return;
    if (post.builtIn) {
      const deletedIds = readJson(deletedKey, []);
      const nextDeletedIds = Array.isArray(deletedIds) ? deletedIds.slice() : [];
      if (nextDeletedIds.indexOf(post.id) === -1) nextDeletedIds.push(post.id);
      writeJson(deletedKey, nextDeletedIds);
      const overrides = readJson(overridesKey, {});
      delete overrides[post.id];
      writeJson(overridesKey, overrides);
    } else {
      writeJson(postsKey, normalizeLocalPosts().filter(function (item) { return item.id !== post.id; }));
    }
    renderPosts();
    showList(true);
    newPostButton.focus();
  }

  function routeFromHash() {
    if (window.location.hash.indexOf('#post-') !== 0) {
      if (editorPanel.hidden) showList(false);
      return;
    }
    try {
      openPost(decodeURIComponent(window.location.hash.slice(6)), false);
    } catch (error) {
      showList(true);
    }
  }

  const savedTheme = localStorage.getItem('theme');
  setTheme(savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  themeToggle.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') !== 'dark'); });

  blogPostList.addEventListener('click', function (event) {
    const entry = event.target.closest('.blog-entry');
    if (!entry) return;
    const post = findPost(entry.dataset.postId);
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      if (actionButton.dataset.action === 'edit') openEditor(post);
      if (actionButton.dataset.action === 'delete') deletePost(post);
      return;
    }
    const titleLink = event.target.closest('.blog-post-title');
    if (titleLink && window.location.hash === titleLink.hash) {
      event.preventDefault();
      showDetail(post);
    }
  });

  newPostButton.addEventListener('click', function () { openEditor(null); });
  backButton.addEventListener('click', function () { showList(true); newPostButton.focus(); });
  backFromDetailButton.addEventListener('click', function () { showList(true); newPostButton.focus(); });
  editPostButton.addEventListener('click', function () { openEditor(selectedPost); });
  deletePostButton.addEventListener('click', function () { deletePost(selectedPost); });
  titleInput.addEventListener('input', updatePreview);
  tagsInput.addEventListener('input', updatePreview);
  markdownInput.addEventListener('input', updatePreview);
  window.addEventListener('hashchange', routeFromHash);

  document.getElementById('saveDraftButton').addEventListener('click', function () {
    writeJson(draftKey, {
      editingId: editingId,
      title: titleInput.value,
      tags: parseTags(tagsInput.value),
      markdown: markdownInput.value,
      createdAt: selectedPost ? selectedPost.createdAt : null
    });
    status.textContent = 'Draft saved in this browser.';
    status.hidden = false;
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const title = titleInput.value.trim();
    const markdown = markdownInput.value.trim();
    if (!title || !markdown) return;
    const now = new Date().toISOString();
    const tags = parseTags(tagsInput.value);
    let savedId = editingId;

    if (editingId && selectedPost && selectedPost.builtIn) {
      const overrides = readJson(overridesKey, {});
      overrides[editingId] = { title: title, tags: tags, markdown: markdown, updatedAt: now };
      writeJson(overridesKey, overrides);
    } else {
      const posts = normalizeLocalPosts();
      const index = posts.findIndex(function (post) { return post.id === editingId; });
      if (index === -1) {
        savedId = 'local-' + Date.now().toString(36);
        posts.unshift({ id: savedId, title: title, tags: tags, markdown: markdown, createdAt: now, updatedAt: null, builtIn: false });
      } else {
        posts[index] = Object.assign({}, posts[index], { title: title, tags: tags, markdown: markdown, updatedAt: now });
      }
      writeJson(postsKey, posts);
    }

    localStorage.removeItem(draftKey);
    editingId = null;
    renderPosts();
    openPost(savedId, true);
  });

  renderPosts();
  updatePreview();
  routeFromHash();
})();
