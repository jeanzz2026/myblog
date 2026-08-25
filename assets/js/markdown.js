/* =========================================================
   轻量 Markdown 渲染（自带转义，防 XSS）
   支持：标题 / 加粗 / 斜体 / 删除线 / 行内代码 / 代码块 /
        链接 / 裸链接 / 图片 / 列表 / 引用 / 分割线 / emoji
   ========================================================= */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^data:image\//i.test(u)) return u;
    if (/^(\.{0,2}\/)/.test(u)) return u;
    if (/^mailto:/i.test(u)) return u;
    return '#';
  }

  function inline(raw) {
    var out = escapeHtml(raw);

    // 行内代码（先占位，避免内部内容被后续规则改写）
    var codes = [];
    out = out.replace(/`([^`]+)`/g, function (m, c) {
      codes.push(c);
      return '\u0000CODE' + (codes.length - 1) + '\u0000';
    });

    // 图片 ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, url) {
      return '<img class="sp-inline-img" src="' + safeUrl(url) + '" alt="' + alt + '" loading="lazy">';
    });
    // 链接 [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, url) {
      return '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    // 加粗 / 斜体 / 删除线
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    // 裸链接（跳过已经在标签属性里的）
    out = out.replace(/(^|[\s(（【])((?:https?:\/\/)[^\s<)）】"']+)/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
    });

    // 还原行内代码
    out = out.replace(/\u0000CODE(\d+)\u0000/g, function (m, i) {
      return '<code>' + codes[Number(i)] + '</code>';
    });
    return out;
  }

  function render(text) {
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var html = [], i = 0, para = [], listType = null, listBuf = [];

    function flushPara() {
      if (para.length) { html.push('<p>' + para.join('<br>') + '</p>'); para = []; }
    }
    function flushList() {
      if (listBuf.length) {
        html.push('<' + listType + '>' + listBuf.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</' + listType + '>');
        listBuf = []; listType = null;
      }
    }

    while (i < lines.length) {
      var line = lines[i];

      // 代码块
      if (/^```/.test(line.trim())) {
        flushPara(); flushList();
        var lang = line.trim().slice(3).trim(), buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        i++;
        html.push('<pre><code data-lang="' + escapeHtml(lang) + '">' + escapeHtml(buf.join('\n')) + '</code></pre>');
        continue;
      }
      // 空行
      if (!line.trim()) { flushPara(); flushList(); i++; continue; }
      // 分割线
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flushPara(); flushList(); html.push('<hr>'); i++; continue; }
      // 标题
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara(); flushList();
        var lv = Math.min(h[1].length + 1, 5);
        html.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>');
        i++; continue;
      }
      // 引用
      if (/^\s*>\s?/.test(line)) {
        flushPara(); flushList();
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        html.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>');
        continue;
      }
      // 列表
      var ul = line.match(/^\s*[-*+]\s+(.*)$/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        var want = ul ? 'ul' : 'ol';
        if (listType && listType !== want) flushList();
        listType = want;
        listBuf.push(inline((ul || ol)[1]));
        i++; continue;
      }
      // 普通段落
      flushList();
      para.push(inline(line));
      i++;
    }
    flushPara(); flushList();
    return html.join('\n');
  }

  /* 纯文本摘要（用于搜索与列表摘要） */
  function plain(text) {
    return String(text == null ? '' : text)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' [图片] ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function excerpt(text, n) {
    var p = plain(text);
    n = n || 160;
    return p.length > n ? p.slice(0, n) + '…' : p;
  }

  global.MD = { render: render, plain: plain, excerpt: excerpt, escapeHtml: escapeHtml, safeUrl: safeUrl };
})(window);
