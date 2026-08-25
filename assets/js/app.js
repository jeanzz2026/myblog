/* =========================================================
   极简博客 · 应用主逻辑
   ========================================================= */
(function () {
  'use strict';

  var LS_AUTH = 'spaceblog.auth';
  var LS_LOCAL = 'spaceblog.local';
  var LS_DRAFT = 'spaceblog.draft';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = {
    cfg: null, blog: null, auth: null, store: null, manifest: null, posts: [],
    view: 'home', postId: null,
    q: '', tag: null, month: null, page: 1,
    editing: null, demo: false, expand: {}, loading: false
  };

  /* ---------------- 工具 ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function D(iso) { var d = new Date(iso); return isNaN(d) ? new Date() : d; }
  function fmtFull(iso) {
    var d = D(iso);
    return d.getFullYear() + '年' + pad(d.getMonth() + 1) + '月' + pad(d.getDate()) + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtShort(iso) { var d = D(iso); return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDay(iso) { var d = D(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthKey(iso) { var d = D(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function monthLabel(k) { var p = k.split('-'); return p[0] + ' 年 ' + Number(p[1]) + ' 月'; }
  function fromNow(iso) {
    var s = (Date.now() - D(iso).getTime()) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    return fmtDay(iso);
  }
  function esc(s) { return MD.escapeHtml(s == null ? '' : s); }
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'sp-toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, isErr ? 4200 : 2200);
  }
  function busy(on, txt) {
    $('#busyTxt').textContent = txt || '正在处理…';
    $('#busy').hidden = !on;
  }
  function splitTags(s) {
    return String(s || '').split(/[,，;；\s]+/).map(function (x) { return x.trim(); })
      .filter(Boolean).slice(0, 12);
  }
  function newId(iso) {
    var d = D(iso);
    return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' +
      Math.random().toString(36).slice(2, 5);
  }
  function localDatetimeValue(iso) {
    var d = D(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  var DEFAULT_AVATAR = 'data:image/svg+xml;base64,' + btoa(
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>" +
    "<rect width='128' height='128' fill='#dceaf8'/>" +
    "<circle cx='64' cy='48' r='24' fill='#7db3e2'/>" +
    "<path d='M16 128c0-30 21-48 48-48s48 18 48 48z' fill='#2f6fb5'/></svg>");

  /* ---------------- 本地存储 ---------------- */
  function loadAuth() {
    try {
      var raw = localStorage.getItem(LS_AUTH) || sessionStorage.getItem(LS_AUTH);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveAuth(a, remember) {
    try {
      localStorage.removeItem(LS_AUTH); sessionStorage.removeItem(LS_AUTH);
      (remember ? localStorage : sessionStorage).setItem(LS_AUTH, JSON.stringify(a));
    } catch (e) { }
  }
  function clearAuth() {
    try { localStorage.removeItem(LS_AUTH); sessionStorage.removeItem(LS_AUTH); } catch (e) { }
  }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_LOCAL) || '{}'); } catch (e) { return {}; } }
  function saveLocal(o) { try { localStorage.setItem(LS_LOCAL, JSON.stringify(o)); } catch (e) { } }

  /* ---------------- 演示数据 ---------------- */
  var DEMO_IMG = 'data:image/svg+xml;base64,' + btoa(
    "<svg xmlns='http://www.w3.org/2000/svg' width='560' height='210'>" +
    "<rect width='560' height='210' fill='#6aa6dc'/>" +
    "<circle cx='470' cy='46' r='26' fill='#ffd45e'/>" +
    "<ellipse cx='120' cy='52' rx='58' ry='20' fill='#ffffff' opacity='0.75'/>" +
    "<ellipse cx='250' cy='40' rx='42' ry='15' fill='#ffffff' opacity='0.6'/>" +
    "<path d='M0 165 L120 96 L215 155 L330 104 L560 168 L560 210 L0 210 Z' fill='#4b8f45'/>" +
    "<text x='24' y='44' font-family='Tahoma' font-size='22' fill='#ffffff'>My Space Photo</text></svg>");

  function demoPosts() {
    var now = Date.now();
    function iso(dayAgo, h) { return new Date(now - dayAgo * 86400000 - (h || 0) * 3600000).toISOString(); }
    return [
      {
        id: 'demo-3', title: '搬进新 Space 啦 🎉', mood: '🎧', tags: ['随笔', '公告'],
        createdAt: iso(0, 2), updatedAt: iso(0, 1),
        body: '好久没写博客了，回来记录点日常 😊\n\n这里支持：\n\n- 文字排版：**加粗**、*斜体*、~~删除线~~、`行内代码`\n- 图片上传（直接存进 GitHub 仓库）\n- 链接：[GitHub 主页](https://github.com)，裸链接也会自动识别 https://workbuddy.cn\n- 各种 emoji ✨🐱🍜🚀\n\n> 左边栏可以搜索、看最新更新、按月份翻存档。\n\n先这样，之后不定期更新～'
      },
      {
        id: 'demo-2', title: '周末去了山里，随手拍了几张', mood: '⛰️', tags: ['照片', '生活'],
        createdAt: iso(3, 5), updatedAt: iso(3, 5),
        body: '天气好得不像话，云一层一层压在山脊上。\n\n![山里的照片](' + DEMO_IMG + ')\n\n回来的路上买了两串烤玉米 🌽，比风景更让人记得住。\n\n1. 早上 6 点出发\n2. 中午在半山吃泡面 🍜\n3. 下午三点下山\n\n---\n\n下次想带三脚架。'
      },
      {
        id: 'demo-1', title: '记一段代码片段：把图片转成 base64', mood: '💻', tags: ['技术', '前端'],
        createdAt: iso(9, 8), updatedAt: iso(8, 3),
        body: '备份一下常用写法，免得每次都翻资料 👇\n\n```js\nconst b64 = await new Promise((res) => {\n  const r = new FileReader();\n  r.onload = () => res(r.result);\n  r.readAsDataURL(file);\n});\n```\n\n顺手贴个参考链接：[MDN FileReader](https://developer.mozilla.org/docs/Web/API/FileReader) 📚'
      }
    ];
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    var base = window.BLOG_CONFIG || {};
    var local = loadLocal();
    S.cfg = Object.assign({ branch: 'main', pageSize: 8 }, base, local.cfg || {});
    S.blog = {
      title: S.cfg.title || '我的 Space',
      tagline: S.cfg.tagline || '',
      avatar: S.cfg.avatar || '',
      about: S.cfg.about || '',
      skin: (local.skin || S.cfg.skin || 'blue')
    };
    S.auth = loadAuth();
    applySkin(S.blog.skin);
    $('#footYear').textContent = new Date().getFullYear();
    bindGlobal();
    parseHash();
    renderChrome();
    render();
    loadData();
  }

  function applySkin(skin) {
    document.documentElement.setAttribute('data-skin', skin || 'dark');
  }

  function targetRepo() {
    if (S.auth && S.auth.owner && S.auth.repo) {
      return { owner: S.auth.owner, repo: S.auth.repo, branch: S.auth.branch || 'main', token: S.auth.token, login: S.auth.login };
    }
    if (S.cfg.owner && S.cfg.repo) {
      return { owner: S.cfg.owner, repo: S.cfg.repo, branch: S.cfg.branch || 'main' };
    }
    return null;
  }

  function loadData() {
    var t = targetRepo();
    if (!t) {
      S.demo = true; S.posts = demoPosts(); S.manifest = null; S.store = null;
      renderChrome(); render();
      return Promise.resolve();
    }
    S.demo = false;
    S.store = new GitHubStore(t);
    S.loading = true; render();

    return S.store.readManifest().then(function (m) {
      if (!m && S.store.canWrite()) return S.store.bootstrap(S.blog);
      return m;
    }).then(function (m) {
      S.manifest = m || { blog: {}, posts: [] };
      if (m && m.blog) {
        ['title', 'tagline', 'avatar', 'about', 'skin'].forEach(function (k) {
          if (m.blog[k]) S.blog[k] = m.blog[k];
        });
        var local = loadLocal();
        if (local.skin) S.blog.skin = local.skin;
        applySkin(S.blog.skin);
      }
      return S.store.loadPosts(S.manifest);
    }).then(function (posts) {
      S.posts = posts;
      S.loading = false;
      renderChrome(); render();
    }).catch(function (err) {
      S.loading = false;
      console.error(err);
      toast('读取仓库失败：' + err.message, true);
      if (!S.posts.length) { S.demo = true; S.posts = demoPosts(); }
      renderChrome(); render();
    });
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var seg = h.split('/').map(decodeURIComponent);
    S.postId = null;
    if (!h) { S.view = 'home'; return; }
    switch (seg[0]) {
      case 'post': S.view = 'post'; S.postId = seg[1] || null; break;
      case 'new': S.view = 'editor'; break;
      case 'edit': S.view = 'editor'; S.postId = seg[1] || null; break;
      case 'archive': S.view = 'archive'; break;
      case 'about': S.view = 'about'; break;
      case 'tag': S.view = 'home'; S.tag = seg[1] || null; S.month = null; S.page = 1; break;
      case 'month': S.view = 'home'; S.month = seg[1] || null; S.tag = null; S.page = 1; break;
      case 'search': S.view = 'home'; S.q = seg[1] || ''; S.page = 1; break;
      case 'page': S.view = 'home'; S.page = Number(seg[1] || 1) || 1; break;
      default: S.view = 'home';
    }
  }
  function go(hash) {
    document.body.classList.remove('sidebar-open');
    if (('#' + hash) === location.hash) { parseHash(); render(); }
    else location.hash = hash;
  }

  window.addEventListener('hashchange', function () {
    var wasEditor = S.view === 'editor';
    parseHash();
    if (S.view === 'editor') prepareEditing();
    else if (wasEditor) S.editing = null;
    render();
    window.scrollTo(0, 0);
  });

  /* ---------------- 顶部 / 导航 ---------------- */
  function renderChrome() {
    document.body.classList.toggle('is-auth', !!(S.auth && S.auth.token));
    $('#blogTitle').textContent = S.blog.title || '狗子的Space';
    $('#blogTagline').textContent = S.blog.tagline || '';
    $('#brandName').textContent = S.blog.title || '狗子的Space';
    document.title = (S.blog.title || '狗子的Space') + ' · 极简博客';

    $$('.sb-nav a').forEach(function (a) {
      var v = a.dataset.nav;
      var active = (v === 'home' && (S.view === 'home' || S.view === 'post')) || (v === S.view);
      a.classList.toggle('on', !!active);
    });
  }

  function lastUpdated() {
    var t = null;
    visiblePosts().forEach(function (p) {
      var u = p.updatedAt || p.createdAt;
      if (!t || String(u) > String(t)) t = u;
    });
    return t;
  }

  /* ---------------- 可见性（草稿仅作者可见） ---------------- */
  /* 单用户博客：持有效 PAT 即视为作者本人 */
  function isOwner() { return !!(S.auth && S.auth.token); }

  function visiblePosts() {
    if (isOwner()) return S.posts;
    return S.posts.filter(function (p) { return p.status !== 'draft'; });
  }

  /* ---------------- 过滤 ---------------- */
  function filtered() {
    var q = S.q.trim().toLowerCase();
    return visiblePosts().filter(function (p) {
      if (S.tag && !(p.tags || []).some(function (t) { return t === S.tag; })) return false;
      if (S.month && monthKey(p.createdAt) !== S.month) return false;
      if (q) {
        var hay = (p.title + ' ' + MD.plain(p.body || p.excerpt || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar() {
    var vp = visiblePosts();
    var recents = vp.slice().sort(function (a, b) {
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    }).slice(0, 6);

    var months = {};
    vp.forEach(function (p) { var k = monthKey(p.createdAt); months[k] = (months[k] || 0) + 1; });
    var mKeys = Object.keys(months).sort().reverse();

    var tags = {};
    vp.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var tKeys = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; });

    var html = '';

    /* 导航（简洁，三入口） */
    html += '<nav class="sb-nav">' +
      '<a href="#" data-nav="home">首页</a>' +
      '<a href="#" data-nav="archive">存档</a>' +
      '<a href="#" data-nav="about">关于</a>' +
      '</nav>';

    /* 搜索 */
    var res = S.q.trim() ? filtered().length : null;
    html += mod('🔍 搜索', '' +
      '<div class="sp-search">' +
      '<input type="text" id="sbQ" placeholder="关键词、标签…" value="' + esc(S.q) + '">' +
      '<button class="sp-btn" data-act="search">搜索</button></div>' +
      '<div class="sp-search-hint">' +
      (res === null ? '标题、正文、标签全文匹配' : ('找到 <b>' + res + '</b> 篇 · <a href="#" data-act="clearq">清除</a>')) +
      '</div>');

    /* 最新更新 */
    html += mod('🆕 最新更新', recents.length ?
      '<ul class="lst">' + recents.map(function (p) {
        var upd = p.updatedAt && p.updatedAt !== p.createdAt;
        return '<li><span class="lst-dot">●</span><a href="#/post/' + encodeURIComponent(p.id) + '">' +
          esc(p.mood ? p.mood + ' ' : '') + esc(p.title) + '</a>' +
          '<span class="lst-date">' + (upd ? '✏️ 更新于 ' : '📅 发表于 ') + fmtFull(p.updatedAt || p.createdAt) + '</span></li>';
      }).join('') + '</ul>' : '<div class="sp-search-hint">还没有文章</div>', recents.length);

    /* 存档 */
    html += mod('🗂️ 按月存档', mKeys.length ?
      '<ul class="arc">' + mKeys.slice(0, 14).map(function (k) {
        return '<li><a href="#/month/' + k + '" class="' + (S.month === k ? 'on' : '') + '">' +
          '<span>' + monthLabel(k) + '</span><span class="n">' + months[k] + ' 篇</span></a></li>';
      }).join('') + '</ul>' +
      (S.month ? '<div class="sp-search-hint"><a href="#/">← 显示全部月份</a></div>' : '')
      : '<div class="sp-search-hint">还没有存档</div>', mKeys.length);

    /* 标签 */
    if (tKeys.length) {
      html += mod('🏷️ 标签', '<div class="tags">' + tKeys.map(function (t) {
        return '<a class="tag ' + (S.tag === t ? 'on' : '') + '" href="#/tag/' + encodeURIComponent(t) + '">' +
          esc(t) + ' <span class="n">' + tags[t] + '</span></a>';
      }).join('') + '</div>' + (S.tag ? '<div class="sp-search-hint"><a href="#/">← 取消标签筛选</a></div>' : ''), tKeys.length);
    }

    /* 云端（同步 / 上传覆盖） */
    var cloudState = S.demo ? '演示模式（未连接仓库）'
      : (S.store ? ('已连接云端：' + esc(S.store.owner + '/' + S.store.repo))
        : (S.cfg.owner && S.cfg.repo ? ('只读模式：' + esc(S.cfg.owner + '/' + S.cfg.repo)) : '未连接'));
    html += mod('☁️ 云端', '' +
      '<div class="sp-search-hint" style="margin:0 0 9px">' + cloudState + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:7px">' +
      '<button class="sp-btn" data-act="sync" style="width:100%">🔄 从云端同步</button>' +
      '<button class="sp-btn sp-btn-primary" data-act="upload" style="width:100%">⬆️ 上传到云端（覆盖文章+图片）</button>' +
      '</div>' +
      '<div class="sp-search-hint" style="margin-top:7px">图片在插入时已直接存进仓库，此操作会再次覆盖全部文章，并把正文里仍内嵌的本地图片一并上传。</div>', 1);

    $('#sidebar').innerHTML = html;
  }

  function mod(title, body, count) {
    return '<div class="mod"><div class="mod-bar"><span>' + title + '</span>' +
      (count ? '<span class="mod-count">' + count + '</span>' : '') +
      '</div><div class="mod-in">' + body + '</div></div>';
  }

  /* ---------------- 正文区 ---------------- */
  function render() {
    renderChrome();
    renderSidebar();
    var m = $('#main');
    if (S.view === 'editor') { renderEditor(m); return; }
    if (S.view === 'about') { renderAbout(m); return; }
    if (S.view === 'archive') { renderArchive(m); return; }
    if (S.view === 'post') { renderSingle(m); return; }
    renderList(m);
  }

  function loadingBox(txt) {
    return '<div class="sp-empty"><b>' + (txt || '正在从 GitHub 读取…') + '</b>稍等一下 ⏳</div>';
  }

  function renderList(m) {
    if (S.loading && !S.posts.length) { m.innerHTML = loadingBox(); return; }

    var list = filtered();
    var html = '';

    if (S.demo) {
      html += '<div class="sp-filterbar">🧪 <b>演示模式</b>：当前显示的是示例文章。登录你的 GitHub Token（或在 <code>config.js</code> 填好 owner/repo）后即可读写真实内容。' +
        '<button class="sp-btn sp-btn-primary" data-act="login">立即登录</button></div>';
    }
    if (S.q.trim() || S.tag || S.month) {
      html += '<div class="sp-filterbar">当前筛选：' +
        (S.q.trim() ? '关键词 <b>' + esc(S.q) + '</b> ' : '') +
        (S.tag ? '标签 <b>' + esc(S.tag) + '</b> ' : '') +
        (S.month ? '月份 <b>' + monthLabel(S.month) + '</b> ' : '') +
        '· 共 <b>' + list.length + '</b> 篇' +
        '<button class="sp-btn" data-act="clearall">清除筛选</button></div>';
    }

    if (!list.length) {
      html += '<div class="sp-empty"><b>这里还空着</b>' +
        (S.posts.length ? '没有符合条件的文章，换个关键词试试 🔍' :
          '登录后点「写新文章」，就能开始不定期更新了 ✏️') + '</div>';
      m.innerHTML = html; return;
    }

    var size = Number(S.cfg.pageSize) || 8;
    var pages = Math.max(1, Math.ceil(list.length / size));
    if (S.page > pages) S.page = pages;
    var slice = list.slice((S.page - 1) * size, S.page * size);

    html += slice.map(function (p) { return entryHtml(p, false); }).join('');

    if (pages > 1) {
      var pg = '<div class="pager">';
      pg += S.page > 1 ? '<a href="#/page/' + (S.page - 1) + '">« 上一页</a>' : '';
      for (var i = 1; i <= pages; i++) {
        pg += '<a href="#/page/' + i + '" class="' + (i === S.page ? 'on' : '') + '">' + i + '</a>';
      }
      pg += S.page < pages ? '<a href="#/page/' + (S.page + 1) + '">下一页 »</a>' : '';
      pg += '<span>共 ' + list.length + ' 篇</span></div>';
      html += pg;
    }
    m.innerHTML = html;
  }

  function renderSingle(m) {
    var p = S.posts.filter(function (x) { return x.id === S.postId; })[0];
    if (!p || (p.status === 'draft' && !isOwner())) {
      m.innerHTML = (S.loading ? loadingBox() :
        '<div class="sp-empty"><b>找不到这篇文章</b><a href="#/">← 回到首页</a></div>');
      return;
    }
    m.innerHTML = '<div class="sp-filterbar"><a href="#/">← 返回文章列表</a></div>' + entryHtml(p, true);
  }

  function entryHtml(p, full) {
    var body = p.body || p.excerpt || '';
    var long = MD.plain(body).length > 900;
    var collapsed = !full && long && !S.expand[p.id];
    var upd = p.updatedAt && p.updatedAt !== p.createdAt;

    return '<article class="entry' + (collapsed ? ' is-collapsed' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="entry-head">' +
      '<div class="entry-title">' + (p.status === 'draft' && isOwner() ? '<span class="draft-badge">📝 草稿</span> ' : '') +
      (p.mood ? esc(p.mood) + ' ' : '') +
      '<a href="#/post/' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a></div>' +
      '<div class="entry-meta">' +
      '<span>📅 发表于 ' + fmtFull(p.createdAt) + '</span>' +
      (upd ? '<span>✏️ 最后更新 ' + fmtFull(p.updatedAt) + '（' + fromNow(p.updatedAt) + '）</span>' : '<span>' + fromNow(p.createdAt) + '</span>') +
      '</div></div>' +
      '<div class="entry-body">' + MD.render(body) + '</div>' +
      '<div class="entry-foot">' +
      ((p.tags || []).length ? '<span class="tags">' + p.tags.map(function (t) {
        return '<a class="tag" href="#/tag/' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
      }).join('') + '</span>' : '<span class="sp-search-hint" style="margin:0">无标签</span>') +
      '<span class="sp-actions">' +
      (collapsed ? '<button class="sp-btn" data-act="expand" data-id="' + esc(p.id) + '">阅读全文 ▾</button>' : '') +
      '<button class="sp-link-btn" data-act="permalink" data-id="' + esc(p.id) + '">🔗 链接</button>' +
      (S.auth && S.auth.token && !S.demo ?
        '<button class="sp-link-btn" data-act="edit" data-id="' + esc(p.id) + '">✏️ 编辑</button>' +
        '<button class="sp-link-btn" data-act="del" data-id="' + esc(p.id) + '" style="color:#a3403e">🗑 删除</button>' : '') +
      '</span></div></article>';
  }

  function renderArchive(m) {
    var groups = {};
    visiblePosts().forEach(function (p) {
      var k = monthKey(p.createdAt);
      (groups[k] = groups[k] || []).push(p);
    });
    var keys = Object.keys(groups).sort().reverse();
    if (!keys.length) { m.innerHTML = '<div class="sp-empty"><b>暂无存档</b>发布第一篇文章后这里会自动按月份归档。</div>'; return; }

    m.innerHTML = keys.map(function (k) {
      var items = groups[k].slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return '<div class="mod"><div class="mod-bar"><span>🗓️ ' + monthLabel(k) + '</span>' +
        '<span class="mod-count">' + items.length + ' 篇</span></div><div class="mod-in">' +
        '<ul class="lst">' + items.map(function (p) {
          return '<li><span class="lst-dot">●</span><a href="#/post/' + encodeURIComponent(p.id) + '">' +
            esc(p.mood ? p.mood + ' ' : '') + esc(p.title) + '</a>' +
            '<span class="lst-date">📅 ' + fmtDay(p.createdAt) +
            (p.updatedAt && p.updatedAt !== p.createdAt ? ' · ✏️ 更新 ' + fmtDay(p.updatedAt) : '') +
            ((p.tags || []).length ? ' · 🏷️ ' + esc(p.tags.join('、')) : '') + '</span></li>';
        }).join('') + '</ul></div></div>';
    }).join('');
  }

  function renderAbout(m) {
    m.innerHTML = '<div class="mod"><div class="mod-bar"><span>👋 关于这个 Space</span></div><div class="mod-in">' +
      '<div class="entry-body" style="padding:0">' +
      (S.blog.about ? MD.render(S.blog.about) : '<p>这个 Space 的主人还没写自我介绍。</p>') +
      '</div>' +
      '<hr style="border:none;border-top:1px dotted var(--sp-line);margin:12px 0">' +
      '<table class="kv">' +
      '<tr><td>Space 名称</td><td>' + esc(S.blog.title) + '</td></tr>' +
      '<tr><td>数据仓库</td><td>' + (S.store ? '<a href="https://github.com/' + esc(S.store.owner) + '/' + esc(S.store.repo) + '" target="_blank" rel="noopener">' + esc(S.store.owner + '/' + S.store.repo) + '</a>' : '演示模式') + '</td></tr>' +
      '<tr><td>文章数</td><td>' + S.posts.length + '</td></tr>' +
      '<tr><td>最后更新</td><td>' + (lastUpdated() ? fmtFull(lastUpdated()) : '—') + '</td></tr>' +
      '</table>' +
      '<p class="sp-search-hint" style="margin-top:10px">整站为纯静态页面，登录凭据（PAT）只保存在你的浏览器本地。</p>' +
      '</div></div>';
  }

  /* ---------------- 编辑器 ---------------- */
  function prepareEditing() {
    if (S.postId) {
      var p = S.posts.filter(function (x) { return x.id === S.postId; })[0];
      S.editing = p ? JSON.parse(JSON.stringify(p)) : null;
      if (!S.editing) { toast('找不到要编辑的文章', true); go('/'); return; }
      S.editing._isNew = false;
    } else if (!S.editing || !S.editing._isNew) {
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch (e) { }
      var nowIso = new Date().toISOString();
      S.editing = draft && draft._isNew ? draft : {
        id: newId(nowIso), title: '', body: '', tags: [], mood: '',
        createdAt: nowIso, updatedAt: nowIso, images: [], _isNew: true
      };
    }
  }

  function renderEditor(m) {
    if (!S.editing) prepareEditing();
    if (!S.editing) return;
    var p = S.editing;

    m.innerHTML = '<div class="mod"><div class="mod-bar"><span>' +
      (p._isNew ? '✏️ 写新文章' : '✏️ 编辑：' + esc(p.title || '无标题')) + '</span>' +
      '<span class="mod-count">' + (S.auth && S.auth.token ? '可发布' : '未登录') + '</span></div>' +
      '<div class="mod-in">' +
      (S.auth && S.auth.token ? '' :
        '<div class="sp-filterbar">⚠️ 还没登录，写完也无法保存到仓库。<button class="sp-btn sp-btn-primary" data-act="login">先去登录</button></div>') +
      '<div class="ed-grid"><div class="ed-left">' +
      '<div class="ed-row"><label>标题</label><input type="text" id="edTitle" placeholder="给这篇文章起个名字…" value="' + esc(p.title) + '"></div>' +
      '<div class="ed-row"><label>正文（支持 Markdown / 图片 / 链接 / emoji）</label>' +
      '<div class="ed-toolbar">' +
      tb('bold', 'B', '加粗 **文字**') + tb('italic', 'I', '斜体 *文字*') + tb('strike', 'S', '删除线 ~~文字~~') +
      '<span class="sep"></span>' +
      tb('h2', 'H2', '小标题') + tb('quote', '❝', '引用') + tb('ul', '• 列表', '无序列表') + tb('ol', '1. 列表', '有序列表') +
      '<span class="sep"></span>' +
      tb('link', '🔗 链接', '插入链接') + tb('img-url', '🖼 图片地址', '插入网络图片') +
      tb('img-up', '⬆️ 上传图片', '从本机上传到仓库') + tb('emoji', '😀 表情', '插入 emoji') +
      '<span class="sep"></span>' +
      tb('code', '</>', '代码块') + tb('hr', '—', '分割线') +
      '</div>' +
      '<textarea id="edBody" placeholder="今天想写点什么？😊&#10;&#10;支持 **加粗**、[链接](https://example.com)、![图片](地址)、emoji ✨">' + esc(p.body) + '</textarea>' +
      '<div class="ed-hint">小技巧：Ctrl+S 保存 · 直接把图片粘贴/拖进输入框也能上传</div></div>' +
      '<div class="ed-row"><label>实时预览</label><div class="ed-preview" id="edPreview"></div></div>' +
      '</div><div class="ed-right">' +
      '<div class="ed-row"><label>标签（逗号分隔）</label><input type="text" id="edTags" placeholder="随笔, 照片, 技术" value="' + esc((p.tags || []).join(', ')) + '"></div>' +
      '<div class="ed-row"><label>心情 emoji</label><div style="display:flex;gap:4px">' +
      '<input type="text" id="edMood" maxlength="4" style="width:70px" value="' + esc(p.mood || '') + '">' +
      '<button class="sp-btn" data-act="emoji-mood">选一个 😀</button></div></div>' +
      '<div class="ed-row"><label>发表时间</label><input type="datetime-local" id="edDate" value="' + localDatetimeValue(p.createdAt) + '"></div>' +
      '<div class="ed-row"><label>上传图片到仓库</label>' +
      '<input type="file" id="edFile" accept="image/*" multiple style="border:none;padding:0">' +
      '<div class="ed-hint">图片会提交到 <code>data/images/</code>，插入的是仓库直链。</div>' +
      '<div class="ed-imgs" id="edImgs">' + imgThumbs(p) + '</div></div>' +
      '</div></div>' +
      '<div class="ed-foot">' +
      (p._isNew
        ? '<button class="sp-btn sp-btn-primary" data-act="save">🚀 发布</button>' +
          '<button class="sp-btn" data-act="savedraft">💾 保存草稿</button>'
        : '<button class="sp-btn sp-btn-primary" data-act="save">💾 保存修改</button>') +
      '<button class="sp-btn" data-act="cancel">取消</button>' +
      '<span class="right">' +
      (p._isNew ? '<button class="sp-link-btn" data-act="cleardraft">清空草稿</button>' :
        '<button class="sp-link-btn" data-act="del" data-id="' + esc(p.id) + '" style="color:#a3403e">🗑 删除这篇</button>') +
      '</span></div>' +
      '</div></div>';

    var body = $('#edBody');
    updatePreview();
    body.addEventListener('input', function () { updatePreview(); saveDraft(); });
    $('#edTitle').addEventListener('input', saveDraft);
    $('#edTags').addEventListener('input', saveDraft);
    $('#edFile').addEventListener('change', function (e) { uploadFiles(e.target.files); e.target.value = ''; });
    body.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && /^image\//.test(items[i].type)) files.push(items[i].getAsFile());
      }
      if (files.length) { e.preventDefault(); uploadFiles(files); }
    });
    body.addEventListener('dragover', function (e) { e.preventDefault(); });
    body.addEventListener('drop', function (e) {
      var fs = e.dataTransfer && e.dataTransfer.files;
      if (fs && fs.length) { e.preventDefault(); uploadFiles(fs); }
    });
  }

  function tb(act, label, title) {
    return '<button type="button" data-tb="' + act + '" title="' + title + '">' + label + '</button>';
  }
  function imgThumbs(p) {
    return (p.images || []).map(function (im) {
      return '<figure><img src="' + esc(im.url) + '" alt="" data-act="insert-img" data-url="' + esc(im.url) + '" title="点击插入正文">' +
        '<figcaption>' + esc(im.name || '') + '</figcaption></figure>';
    }).join('');
  }
  function updatePreview() {
    var v = $('#edBody') ? $('#edBody').value : '';
    $('#edPreview').innerHTML = v.trim() ? MD.render(v) : '<span class="sp-search-hint">左边输入内容，这里实时预览…</span>';
  }
  function saveDraft() {
    if (!S.editing || !S.editing._isNew) return;
    collectEditor(true);
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(S.editing)); } catch (e) { }
  }
  function collectEditor(silent) {
    var p = S.editing;
    if (!p || !$('#edBody')) return p;
    p.title = $('#edTitle').value.trim();
    p.body = $('#edBody').value;
    p.tags = splitTags($('#edTags').value);
    p.mood = $('#edMood').value.trim();
    var dv = $('#edDate').value;
    if (dv) {
      var d = new Date(dv);
      if (!isNaN(d)) p.createdAt = d.toISOString();
    }
    if (!silent) p.updatedAt = new Date().toISOString();
    return p;
  }

  /* 文本插入 */
  function surround(before, after, placeholder) {
    var ta = $('#edBody'); if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var sel = v.slice(s, e) || (placeholder || '');
    ta.value = v.slice(0, s) + before + sel + after + v.slice(e);
    ta.focus();
    ta.selectionStart = s + before.length;
    ta.selectionEnd = s + before.length + sel.length;
    updatePreview(); saveDraft();
  }
  function insertAtCursor(text) {
    var ta = $('#edBody'); if (!ta) return;
    var s = ta.selectionStart, v = ta.value;
    ta.value = v.slice(0, s) + text + v.slice(ta.selectionEnd);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + text.length;
    updatePreview(); saveDraft();
  }
  function prefixLines(prefix, ordered) {
    var ta = $('#edBody'); if (!ta) return;
    var v = ta.value, s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    var e = ta.value.indexOf('\n', ta.selectionEnd);
    if (e < 0) e = v.length;
    var block = v.slice(s, e) || '内容';
    var out = block.split('\n').map(function (l, i) {
      return (ordered ? (i + 1) + '. ' : prefix) + l.replace(/^([-*+]\s+|\d+[.)]\s+|>\s?|#+\s+)/, '');
    }).join('\n');
    ta.value = v.slice(0, s) + out + v.slice(e);
    ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + out.length;
    updatePreview(); saveDraft();
  }

  function handleToolbar(act) {
    switch (act) {
      case 'bold': return surround('**', '**', '加粗文字');
      case 'italic': return surround('*', '*', '斜体文字');
      case 'strike': return surround('~~', '~~', '删除线');
      case 'h2': return prefixLines('## ');
      case 'quote': return prefixLines('> ');
      case 'ul': return prefixLines('- ');
      case 'ol': return prefixLines('', true);
      case 'code': return insertAtCursor('\n```\n' + '在这里写代码' + '\n```\n');
      case 'hr': return insertAtCursor('\n\n---\n\n');
      case 'link': {
        var u = prompt('链接地址：', 'https://');
        if (!u) return;
        var t = prompt('链接文字：', '点这里') || u;
        return insertAtCursor('[' + t + '](' + u + ')');
      }
      case 'img-url': {
        var iu = prompt('图片地址：', 'https://');
        if (!iu) return;
        return insertAtCursor('\n![图片](' + iu + ')\n');
      }
      case 'img-up': {
        var f = $('#edFile'); if (f) f.click(); return;
      }
    }
  }

  /* 图片上传 */
  function uploadFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    if (!(S.auth && S.auth.token) || !S.store || !S.store.canWrite()) {
      toast('上传图片需要先登录（PAT）', true); return;
    }
    collectEditor(true);
    var done = 0;
    busy(true, '正在上传图片 0/' + files.length);
    var seq = Promise.resolve();
    files.forEach(function (f) {
      seq = seq.then(function () {
        return S.store.uploadImage(f).then(function (im) {
          S.editing.images = S.editing.images || [];
          S.editing.images.push(im);
          insertAtCursor('\n![' + (im.name || '图片') + '](' + im.url + ')\n');
          $('#edImgs').innerHTML = imgThumbs(S.editing);
          done++;
          busy(true, '正在上传图片 ' + done + '/' + files.length);
        });
      });
    });
    seq.then(function () {
      busy(false);
      toast('已上传 ' + done + ' 张图片 🖼️');
      saveDraft();
    }).catch(function (err) {
      busy(false);
      toast('上传失败：' + err.message, true);
    });
  }

  /* 保存 / 删除
     mode: 'draft'  → 存为草稿（仅作者可见）
           'publish' → 发布（前台可见） */
  var saving = false; /* 防止连点重复提交 */
  function savePost(mode) {
    if (saving) return;
    if (!(S.auth && S.auth.token) || !S.store || !S.store.canWrite()) { openLogin(); return; }
    var p = collectEditor();
    var isDraft = (mode === 'draft');

    if (isDraft) {
      if (!p.title.trim() && !p.body.trim()) { toast('草稿还是空的，先写点什么吧', true); $('#edBody').focus(); return; }
    } else {
      if (!p.title.trim()) { toast('给文章起个标题吧', true); $('#edTitle').focus(); return; }
      if (!p.body.trim()) { toast('正文还是空的', true); $('#edBody').focus(); return; }
    }

    var payload = {
      id: p.id,
      title: p.title.trim() || '未命名草稿',
      body: p.body,
      tags: p.tags || [],
      mood: p.mood || '',
      createdAt: p.createdAt,
      updatedAt: new Date().toISOString(),
      images: p.images || [],
      status: isDraft ? 'draft' : 'published'
    };
    saving = true;
    busy(true, isDraft ? '正在保存草稿…' : '正在发布到 GitHub…');
    S.manifest = S.manifest || { blog: {}, posts: [] };
    S.store.savePost(payload, S.manifest).then(function () {
      busy(false);
      saving = false;
      if (isDraft) {
        /* 云端草稿 + 本机备份（未登录/换浏览器也能续写） */
        try { payload._isNew = p._isNew; localStorage.setItem(LS_DRAFT, JSON.stringify(payload)); } catch (e) { }
      } else {
        try { localStorage.removeItem(LS_DRAFT); } catch (e) { }
      }
      S.editing = null;
      /* 写入云端已成功，立即如实提示；刷新列表失败不再误报“发布失败” */
      toast(isDraft ? '草稿已保存 📝' : '已发布 ✅');
      refreshAfterSave(payload.id, isDraft);
    }).catch(function (err) {
      busy(false);
      saving = false;
      toast((isDraft ? '保存草稿失败' : '发布失败') + '：' + err.message, true);
    });
  }

  /* 发布/草稿/删除/上传写入云端成功后，刷新列表并跳转；raw/API 网络抖动时自动重试 */
  function refreshAfterSave(id, isDraft) {
    var tries = 0;
    function attempt() {
      tries++;
      loadData().then(function () {
        if (id) go(isDraft ? '/' : '/post/' + encodeURIComponent(id));
        else go('/');
      }).catch(function (err) {
        if (tries < 3) { setTimeout(attempt, 1200); return; }
        toast('数据已保存到云端，但列表刷新失败：' + err.message, true);
        go('/');
      });
    }
    attempt();
  }

  /* Ctrl+S：新文章快速存草稿，编辑已有文章则保存修改 */
  function quickSave() {
    if (S.editing && S.editing._isNew) savePost('draft');
    else savePost('publish');
  }

  function delPost(id) {
    var p = S.posts.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!confirm('确定删除《' + p.title + '》吗？\n（会从 GitHub 仓库中删除对应文章文件，此操作不可撤销）')) return;
    busy(true, '正在删除…');
    S.store.removePost(p, S.manifest).then(function () {
      busy(false); toast('已删除');
      S.editing = null;
      refreshAfterSave(null, true);
    }).catch(function (err) { busy(false); toast('删除失败：' + err.message, true); });
  }

  /* ---------------- 登录 / 设置 ---------------- */
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  function openLogin() {
    $('#inToken').value = '';
    $('#loginMsg').textContent = '';
    openModal('loginModal');
    setTimeout(function () { var t = $('#inToken'); if (t) t.focus(); }, 60);
  }

  function doLogin() {
    var owner = (S.cfg.owner || '').trim();
    var repo = (S.cfg.repo || '').trim();
    var branch = (S.cfg.branch || 'main').trim() || 'main';
    var token = $('#inToken').value.trim();
    var remember = $('#inRemember').checked;
    var msg = $('#loginMsg');
    msg.className = 'sp-msg';

    if (!owner || !repo) { msg.textContent = '配置文件未设置 owner / repo'; return; }
    if (!token) { msg.textContent = '请填写 Personal Access Token'; return; }

    busy(true, '正在验证 Token…');
    var store = new GitHubStore({ owner: owner, repo: repo, branch: branch, token: token });

    store.getUser().then(function (u) {
      var login = u && u.login;
      msg.className = 'sp-msg ok';
      msg.textContent = '身份 OK：' + (login || owner) + '，检查仓库…';
      return store.getRepo().then(function (r) {
        if (r && r.notFound) {
          busy(false);
          if (login && login !== owner) throw new Error('仓库 ' + owner + '/' + repo + ' 不存在，且不属于当前 Token 账号 ' + login);
          if (!confirm('仓库 ' + owner + '/' + repo + ' 还不存在。\n\n现在用这个 Token 创建一个公开的专属博客仓库吗？')) {
            throw new Error('已取消');
          }
          busy(true, '正在创建专属仓库…');
          return store.createRepo('博客数据仓库').then(function (rr) {
            branch = rr.default_branch || branch;
            store.branch = branch;
            return new Promise(function (res) { setTimeout(res, 1200); });
          });
        }
        if (r && r.default_branch && r.default_branch !== branch) {
          store.branch = branch = r.default_branch;
        }
        return r;
      }).then(function () {
        busy(true, '正在初始化博客数据…');
        return store.bootstrap(S.blog);
      }).then(function () {
        S.auth = { owner: store.owner, repo: repo, branch: store.branch, token: token, login: login };
        saveAuth(S.auth, remember);
        busy(false);
        closeModal('loginModal');
        toast('登录成功，欢迎回来 ' + (login || owner) + ' 👋');
        return loadData();
      });
    }).catch(function (err) {
      busy(false);
      msg.className = 'sp-msg';
      msg.textContent = err.message || '登录失败';
    });
  }

  function doLogout() {
    if (!confirm('退出登录？（本机保存的 Token 会被清除）')) return;
    clearAuth();
    S.auth = null;
    toast('已退出登录');
    S.editing = null;
    go('/');
    loadData();
  }

  /* 设置：上传头像到仓库 */
  function uploadAvatar(file) {
    if (!file) return;
    if (!(S.auth && S.auth.token) || !S.store || !S.store.canWrite()) {
      toast('上传头像需要先登录（PAT）', true); return;
    }
    busy(true, '正在上传头像…');
    S.store.uploadImage(file).then(function (im) {
      $('#setAvatar').value = im.url;
      var prev = $('#setAvatarPrev');
      prev.src = im.url; prev.hidden = false;
      busy(false);
      toast('头像已上传 🖼️');
    }).catch(function (err) {
      busy(false);
      toast('头像上传失败：' + err.message, true);
    });
  }

  function openSettings() {
    $('#setTitle').value = S.blog.title || '';
    $('#setTagline').value = S.blog.tagline || '';
    $('#setAvatar').value = S.blog.avatar || '';
    var prev = $('#setAvatarPrev');
    if (prev) {
      if (S.blog.avatar) { prev.src = S.blog.avatar; prev.hidden = false; }
      else { prev.removeAttribute('src'); prev.hidden = true; }
    }
    $('#setAvatarHint').textContent = (S.auth && S.auth.token)
      ? '图片会提交到 data/images/，保存后头像即刻生效。'
      : '未登录，当前只能填网络图片链接；登录后可上传本地图片。';
    $('#setAbout').value = S.blog.about || '';
    $('#setMsg').textContent = '';
    applySkin(S.blog.skin);
    openModal('settingsModal');
  }

  function saveSettings() {
    S.blog.title = $('#setTitle').value.trim() || '我的 Space';
    S.blog.tagline = $('#setTagline').value.trim();
    S.blog.avatar = $('#setAvatar').value.trim();
    S.blog.about = $('#setAbout').value;

    var local = loadLocal();
    local.skin = S.blog.skin;
    saveLocal(local);
    renderChrome(); render();

    if (!(S.auth && S.auth.token) || !S.store || !S.store.canWrite()) {
      closeModal('settingsModal');
      toast('已在本机生效；登录后可同步到仓库');
      return;
    }
    busy(true, '正在保存 Space 信息…');
    S.manifest = S.manifest || { blog: {}, posts: [] };
    S.manifest.blog = Object.assign({}, S.manifest.blog, {
      title: S.blog.title, tagline: S.blog.tagline, avatar: S.blog.avatar,
      about: S.blog.about, skin: S.blog.skin, owner: S.store.owner
    });
    S.store.writeManifest(S.manifest, 'chore: update space profile').then(function () {
      busy(false); closeModal('settingsModal'); toast('设置已保存到仓库 ✅');
      renderChrome(); render();
    }).catch(function (err) {
      busy(false);
      $('#setMsg').textContent = '保存失败：' + err.message;
    });
  }

  /* ---------------- emoji 选择器 ---------------- */
  var emojiTarget = 'body';
  function buildEmoji() {
    var tabs = $('#emojiTabs'), grid = $('#emojiGrid');
    tabs.innerHTML = window.EMOJI_SETS.map(function (s, i) {
      return '<button data-ei="' + i + '" title="' + s.name + '" class="' + (i === 0 ? 'on' : '') + '">' + s.icon + '</button>';
    }).join('');
    fillEmoji(0);
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ei]'); if (!b) return;
      $$('#emojiTabs button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      fillEmoji(Number(b.dataset.ei));
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-em]'); if (!b) return;
      var ch = b.dataset.em;
      if (emojiTarget === 'mood') { $('#edMood').value = ch; saveDraft(); }
      else insertAtCursor(ch);
      $('#emojiPop').hidden = true;
    });
  }
  function fillEmoji(i) {
    $('#emojiGrid').innerHTML = window.EMOJI_SETS[i].list.map(function (c) {
      return '<button data-em="' + c + '">' + c + '</button>';
    }).join('');
  }
  function showEmoji(anchor, target) {
    emojiTarget = target || 'body';
    var pop = $('#emojiPop');
    var r = anchor.getBoundingClientRect();
    pop.hidden = false;
    var top = r.bottom + window.scrollY + 4;
    var left = Math.min(r.left + window.scrollX, window.innerWidth - 275);
    pop.style.top = top + 'px';
    pop.style.left = Math.max(8, left) + 'px';
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindGlobal() {
    buildEmoji();

    $('#btnLogin').addEventListener('click', function (e) { e.preventDefault(); openLogin(); });
    $('#btnLogout').addEventListener('click', function (e) { e.preventDefault(); doLogout(); });
    $('#btnSettings').addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
    $('#footHelp').addEventListener('click', function (e) { e.preventDefault(); openModal('helpModal'); });
    $('#doLogin').addEventListener('click', doLogin);
    $('#doSaveSettings').addEventListener('click', saveSettings);
    $('#inToken').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#setAvatarFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) uploadAvatar(f);
      e.target.value = '';
    });
    $('#setAvatarClear').addEventListener('click', function () {
      $('#setAvatar').value = '';
      var prev = $('#setAvatarPrev');
      prev.removeAttribute('src'); prev.hidden = true;
    });

    // 移动端侧栏抽屉
    var btnSb = $('#btnSidebar');
    if (btnSb) btnSb.addEventListener('click', function () { document.body.classList.toggle('sidebar-open'); });
    var scrim = $('#scrim');
    if (scrim) scrim.addEventListener('click', function () { document.body.classList.remove('sidebar-open'); });

    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var closer = e.target.closest('[data-close]');
      if (closer) { closeModal(closer.dataset.close); return; }

      var nav = e.target.closest('[data-nav]');
      if (nav) {
        e.preventDefault();
        var v = nav.dataset.nav;
        if (v === 'home') { S.q = ''; S.tag = null; S.month = null; S.page = 1; go('/'); }
        else if (v === 'new') {
          // 需求：快速发布 = 用 Token 登录（未登录时直接打开登录）
          if (!(S.auth && S.auth.token)) { openLogin(); return; }
          S.editing = null; go('/new');
        }
        else go('/' + v);
        return;
      }

      var tbBtn = e.target.closest('[data-tb]');
      if (tbBtn) {
        e.preventDefault();
        if (tbBtn.dataset.tb === 'emoji') { showEmoji(tbBtn, 'body'); return; }
        handleToolbar(tbBtn.dataset.tb);
        return;
      }

      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.dataset.act;
        if (a !== 'insert-img') e.preventDefault();
        switch (a) {
          case 'login': openLogin(); break;
          case 'new': S.editing = null; go('/new'); break;
          case 'sync': doSync(); break;
          case 'upload': pushCloud(); break;
          case 'savedraft': savePost('draft'); break;
          case 'search': doSearch(); break;
          case 'clearq': S.q = ''; S.page = 1; render(); break;
          case 'clearall': S.q = ''; S.tag = null; S.month = null; S.page = 1; go('/'); render(); break;
          case 'expand': S.expand[act.dataset.id] = true; render(); break;
          case 'permalink': copyPermalink(act.dataset.id); break;
          case 'edit': S.editing = null; go('/edit/' + encodeURIComponent(act.dataset.id)); break;
          case 'del': delPost(act.dataset.id); break;
          case 'save': savePost('publish'); break;
          case 'cancel':
            if (S.editing && S.editing._isNew && $('#edBody') && $('#edBody').value.trim() &&
              !confirm('放弃这次编辑？（未保存的草稿仍会留在本机）')) return;
            S.editing = null; go('/'); break;
          case 'cleardraft':
            try { localStorage.removeItem(LS_DRAFT); } catch (er) { }
            S.editing = null; prepareEditing(); render(); toast('草稿已清空'); break;
          case 'emoji-mood': showEmoji(act, 'mood'); break;
          case 'insert-img': insertAtCursor('\n![图片](' + act.dataset.url + ')\n'); break;
        }
        return;
      }

      if (!e.target.closest('#emojiPop') && !e.target.closest('[data-tb="emoji"]') && !e.target.closest('[data-act="emoji-mood"]')) {
        $('#emojiPop').hidden = true;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $$('.sp-overlay').forEach(function (o) { o.hidden = true; });
        $('#emojiPop').hidden = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.view === 'editor') {
        e.preventDefault(); quickSave();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'sbQ') { e.preventDefault(); doSearch(); }
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'sbQ') {
        clearTimeout(doSearch._t);
        doSearch._t = setTimeout(doSearch, 260);
      }
    });
  }

  function doSearch() {
    document.body.classList.remove('sidebar-open');
    var box = $('#sbQ'); if (!box) return;
    var v = box.value;
    S.q = v; S.page = 1;
    if (S.view !== 'home') { S.view = 'home'; if (location.hash) { location.hash = '#/'; return; } }
    render();
    var again = $('#sbQ');
    if (again) { again.focus(); again.selectionStart = again.selectionEnd = again.value.length; }
  }

  function copyPermalink(id) {
    var url = location.origin + location.pathname + '#/post/' + encodeURIComponent(id);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('链接已复制 🔗'); },
        function () { prompt('复制这个链接：', url); });
    } else prompt('复制这个链接：', url);
  }

  /* ---------------- 云端：同步 / 上传覆盖 ---------------- */
  function doSync() {
    if (!S.store) { openLogin(); return; }
    busy(true, '正在从云端同步…');
    loadData().then(function () {
      busy(false);
      toast('已同步云端最新内容 🔄');
    }).catch(function (err) {
      busy(false);
      toast('同步失败：' + err.message, true);
    });
  }

  /* 把正文里仍内嵌的本地图片（data: URI）上传到仓库，并改写正文与图片清单 */
  function pushImagesInBody(p) {
    var body = p.body || '';
    var re = /!\[[^\]]*\]\((data:image\/[^;]+;base64,[^)\s]+)\)/g;
    var found = [], m;
    while ((m = re.exec(body))) found.push(m[1]);
    if (!found.length) return Promise.resolve(p);

    var seq = Promise.resolve();
    found.forEach(function (uri) {
      seq = seq.then(function () {
        var meta = /^data:(image\/\w+);base64,/.exec(uri);
        var mime = meta ? meta[1] : 'image/png';
        var bin = atob(uri.split(',')[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var name = 'pasted-' + Date.now() + '.' + (mime.split('/')[1] || 'png');
        var file = new File([arr], name, { type: mime });
        return S.store.uploadImage(file).then(function (im) {
          p.body = p.body.split(uri).join(im.url);
          p.images = p.images || [];
          p.images.push(im);
        });
      });
    });
    return seq.then(function () { return p; });
  }

  /* 把本地当前文章（含内嵌图片）上传并覆盖云端 */
  function pushCloud() {
    if (!S.store || !S.store.canWrite()) { openLogin(); return; }
    if (!S.posts.length) { toast('本地还没有文章可上传', true); return; }
    if (!confirm('将把本地当前的 ' + S.posts.length + ' 篇文章（含正文里内嵌的图片）上传并覆盖云端（' +
      esc(S.store.owner + '/' + S.store.repo) + '），确定继续？')) return;
    busy(true, '正在上传到云端…');
    S.manifest = S.manifest || { blog: {}, posts: [] };
    var seq = Promise.resolve(), n = 0;
    S.posts.forEach(function (p) {
      seq = seq.then(function () {
        if (!p || !p.id) return;
        return pushImagesInBody(p).then(function (upd) {
          if (!upd.id || !upd.title) return;
          return S.store.savePost(upd, S.manifest).then(function () { n++; });
        });
      });
    });
    seq.then(function () {
      busy(false);
      toast('已上传 ' + n + ' 篇到云端 ⬆️');
      refreshAfterSave(null, true);
    }).catch(function (err) { busy(false); toast('上传失败：' + err.message, true); });
  }

  /* ---------------- 启动 ---------------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
