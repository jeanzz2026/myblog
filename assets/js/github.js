/* =========================================================
   GitHub 存储层
   ---------------------------------------------------------
   仓库结构（专属博客数据仓库）：
     data/index.json          清单：Space 信息 + 文章目录
     data/posts/<id>.json     单篇文章
     data/images/<file>       上传的图片
   读：公开仓库走 raw.githubusercontent（无需 Token）
   写：走 api.github.com Contents API（需 PAT）
   ========================================================= */
(function (global) {
  var API = 'https://api.github.com';

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  function GitHubStore(opt) {
    this.owner = (opt.owner || '').trim();
    this.repo = (opt.repo || '').trim();
    this.branch = (opt.branch || 'main').trim();
    this.token = opt.token || null;
    this.login = opt.login || null;
  }

  GitHubStore.prototype.canWrite = function () { return !!this.token; };

  GitHubStore.prototype.rawBase = function () {
    return 'https://raw.githubusercontent.com/' + this.owner + '/' + this.repo + '/' + this.branch + '/';
  };

  GitHubStore.prototype.api = function (path, opt) {
    opt = opt || {};
    var headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opt.headers || {});
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    if (opt.body) headers['Content-Type'] = 'application/json';

    return fetch(API + path, {
      method: opt.method || 'GET',
      headers: headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (res) {
      if (res.status === 404) return { notFound: true, status: 404 };
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { message: txt }; }
        if (!res.ok) {
          var msg = (data && data.message) || ('HTTP ' + res.status);
          if (res.status === 401) msg = 'Token 无效或已过期（401）';
          if (res.status === 403) msg = '权限不足或触发限流（403）：' + msg;
          if (res.status === 422) msg = '请求被拒绝（422）：' + msg;
          var err = new Error(msg); err.status = res.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  };

  /* ---------- 账号 / 仓库 ---------- */
  GitHubStore.prototype.getUser = function () { return this.api('/user'); };

  GitHubStore.prototype.getRepo = function () {
    return this.api('/repos/' + this.owner + '/' + this.repo);
  };

  GitHubStore.prototype.createRepo = function (desc) {
    var self = this;
    return this.api('/user/repos', {
      method: 'POST',
      body: {
        name: this.repo,
        description: desc || 'My MSN-Spaces-style blog data',
        private: false,
        auto_init: true,
        has_issues: false,
        has_projects: false,
        has_wiki: false
      }
    }).then(function (repo) {
      if (repo && repo.default_branch) self.branch = repo.default_branch;
      return repo;
    });
  };

  /* ---------- 文件读写 ---------- */
  GitHubStore.prototype.getFile = function (path) {
    var self = this;
    return this.api('/repos/' + this.owner + '/' + this.repo + '/contents/' +
      encodeURI(path) + '?ref=' + encodeURIComponent(this.branch)).then(function (r) {
      if (!r || r.notFound) return null;
      return { sha: r.sha, text: r.content ? b64decode(r.content) : '', raw: r };
    });
  };

  GitHubStore.prototype.putFile = function (path, contentB64, message, sha) {
    var body = { message: message || ('update ' + path), content: contentB64, branch: this.branch };
    if (sha) body.sha = sha;
    return this.api('/repos/' + this.owner + '/' + this.repo + '/contents/' + encodeURI(path), {
      method: 'PUT', body: body
    });
  };

  GitHubStore.prototype.putText = function (path, text, message, sha) {
    return this.putFile(path, b64encode(text), message, sha);
  };

  GitHubStore.prototype.deleteFile = function (path, message) {
    var self = this;
    return this.getFile(path).then(function (f) {
      if (!f) return null;
      return self.api('/repos/' + self.owner + '/' + self.repo + '/contents/' + encodeURI(path), {
        method: 'DELETE',
        body: { message: message || ('delete ' + path), sha: f.sha, branch: self.branch }
      });
    });
  };

  /* raw 优先读取（公开仓库免 Token、免限流）
     已登录作者：优先走 API（raw CDN 有秒级~分钟级滞后，发布后立即刷新会读到旧数据） */
  GitHubStore.prototype.readJson = function (path) {
    var self = this, url = this.rawBase() + path + '?_=' + Date.now();
    var fromRaw = function () {
      return fetch(url, { cache: 'no-store' }).then(function (res) {
        if (res.ok) return res.json();
        if (res.status === 404 && !self.token) return null;
        throw new Error('raw ' + res.status);
      });
    };
    var fromApi = function () {
      return self.getFile(path).then(function (f) {
        if (!f) return null;
        try { return JSON.parse(f.text); } catch (e) { return null; }
      });
    };
    if (self.token) return fromApi().catch(fromRaw);   // 作者：API 最新优先，raw 兜底
    return fromRaw().catch(fromApi);                   // 访客：raw 快读，API 兜底
  };

  /* ---------- 清单 ---------- */
  var MANIFEST = 'data/index.json';

  GitHubStore.prototype.readManifest = function () {
    return this.readJson(MANIFEST).then(function (m) {
      if (!m) return null;
      if (!Array.isArray(m.posts)) m.posts = [];
      m.blog = m.blog || {};
      return m;
    });
  };

  GitHubStore.prototype.writeManifest = function (manifest, message) {
    var self = this;
    manifest.updatedAt = new Date().toISOString();
    manifest.generator = 'msn-space-blog';
    var text = JSON.stringify(manifest, null, 2);
    return this.putManifestRetry(text, message || 'chore: update manifest', 3);
  };

  /* 清单写入带重试：每次尝试都重新取 sha，网络抖动/并发 422 时可安全重来 */
  GitHubStore.prototype.putManifestRetry = function (text, message, tries) {
    var self = this;
    return this.getFile(MANIFEST).then(function (f) {
      return self.putText(MANIFEST, text, message, f && f.sha);
    }).catch(function (err) {
      if (tries > 1) {
        return new Promise(function (res) { setTimeout(res, 1200); })
          .then(function () { return self.putManifestRetry(text, message, tries - 1); });
      }
      throw err;
    });
  };

  /* ---------- 文章 ---------- */
  GitHubStore.prototype.postPath = function (id) { return 'data/posts/' + id + '.json'; };

  GitHubStore.prototype.loadPosts = function (manifest, limit) {
    var self = this;
    var list = (manifest && manifest.posts) || [];
    if (limit) list = list.slice(0, limit);
    var out = [], idx = 0, CONC = 6;

    function worker() {
      if (idx >= list.length) return Promise.resolve();
      var meta = list[idx++];
      return self.readJson(meta.path || self.postPath(meta.id))
        .then(function (p) { if (p) out.push(Object.assign({}, meta, p)); })
        .catch(function () { /* 单篇失败不影响整体 */ })
        .then(worker);
    }
    var jobs = [];
    for (var k = 0; k < Math.min(CONC, list.length); k++) jobs.push(worker());
    return Promise.all(jobs).then(function () {
      out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return out;
    });
  };

  GitHubStore.prototype.savePost = function (post, manifest) {
    var self = this;
    var path = this.postPath(post.id);
    var isNew = !(manifest.posts || []).some(function (p) { return p.id === post.id; });
    var text = JSON.stringify(post, null, 2);

    return this.getFile(path).then(function (f) {
      return self.putText(path, text, (isNew ? 'post: ' : 'edit: ') + post.title, f && f.sha);
    }).then(function () {
      var meta = {
        id: post.id, title: post.title, path: path,
        createdAt: post.createdAt, updatedAt: post.updatedAt,
        tags: post.tags || [], mood: post.mood || '',
        location: post.location || '', timezone: post.timezone || '',
        excerpt: MD.excerpt(post.body, 160),
        images: (post.images || []).length
      };
      manifest.posts = (manifest.posts || []).filter(function (p) { return p.id !== post.id; });
      manifest.posts.unshift(meta);
      manifest.posts.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return self.writeManifest(manifest, (isNew ? 'post: ' : 'edit: ') + post.title);
    });
  };

  GitHubStore.prototype.removePost = function (post, manifest) {
    var self = this;
    return this.deleteFile(this.postPath(post.id), 'remove: ' + post.title).then(function () {
      manifest.posts = (manifest.posts || []).filter(function (p) { return p.id !== post.id; });
      return self.writeManifest(manifest, 'remove: ' + post.title);
    });
  };

  /* ---------- 图片上传 ---------- */
  GitHubStore.prototype.uploadImage = function (file) {
    var self = this;
    var clean = (file.name || 'image').replace(/[^\w.\-]+/g, '_').slice(-48);
    var path = 'data/images/' + Date.now() + '-' + clean;
    return file.arrayBuffer().then(function (buf) {
      return self.putFile(path, bufToB64(buf), 'img: ' + clean);
    }).then(function (res) {
      var url = (res && res.content && res.content.download_url) || (self.rawBase() + path);
      return { path: path, url: url, name: clean, size: file.size };
    });
  };

  /* ---------- 初始化专属仓库 ---------- */
  GitHubStore.prototype.bootstrap = function (blogMeta) {
    var self = this;
    return this.readManifest().then(function (m) {
      if (m) return m;
      var manifest = {
        generator: 'msn-space-blog',
        blog: Object.assign({
          title: '我的 Space',
          tagline: '记录一些不定期发生的小事 ✨',
          avatar: '', about: '', skin: 'blue',
          owner: self.owner
        }, blogMeta || {}),
        posts: [],
        createdAt: new Date().toISOString()
      };
      return self.writeManifest(manifest, 'init: create blog manifest').then(function () {
        return self.putText('README.md',
          '# ' + (manifest.blog.title || 'My Space') + '\n\n' +
          '这是 MSN Spaces 风格博客的**数据仓库**，由博客前端自动读写。\n\n' +
          '- `data/index.json` — 清单（Space 信息 + 文章目录）\n' +
          '- `data/posts/*.json` — 每篇文章\n' +
          '- `data/images/*` — 上传的图片\n',
          'docs: readme'
        ).catch(function () { /* README 已存在则忽略 */ }).then(function () { return manifest; });
      });
    });
  };

  global.GitHubStore = GitHubStore;
  global.GH_UTIL = { b64encode: b64encode, b64decode: b64decode };
})(window);
