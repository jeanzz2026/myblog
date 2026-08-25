# 我的 Space · 极简博客平台

一个**纯静态**的个人博客：左侧模块栏 + 右侧正文的双栏布局（桌面），移动端自动变成单栏 + 侧栏抽屉，
整体采用**深色极简**风格。数据全部存放在**你自己 GitHub 的专属仓库**里，登录方式是 GitHub **PAT（Personal Access Token）**。

没有服务器、没有数据库、没有第三方后端。前端直接调 GitHub REST API 读写内容。

---

## 功能一览

| 分类 | 能力 |
| --- | --- |
| 登录 | GitHub PAT 登录；自动校验身份；**专属数据仓库不存在时可一键创建**并初始化 |
| 发布 | 不定期发文；标题 / 正文 / 标签 / 心情 emoji / 自定义发表时间；**草稿（仅作者可见）与发布分离**，草稿自动存本机，一键「保存草稿 / 发布」 |
| 内容 | 文字（Markdown 子集：加粗、斜体、删除线、标题、列表、引用、代码块、分割线）、**图片上传**、链接（含裸链接自动识别）、**emoji 选择器** |
| 图片 | 本机选择 / 粘贴 / 拖拽上传 → 提交到仓库 `data/images/` → 自动插入正文直链；设置页头像支持**上传本地图片**或网络链接 |
| 左侧栏 | 简洁导航、**搜索**（标题+正文+标签全文）、**最新更新**、**按月归档**、标签云、**云端同步 / 上传覆盖（文章+图片）** |
| 草稿 | 草稿状态的文章前台不可见，仅登录作者可见（列表带「📝 草稿」徽标）；发布后才对访客可见 |
| 阅读 | 首页分页、长文折叠「阅读全文」、单篇永久链接（`#/post/<id>`）、存档页、关于页 |
| 访客 | 公开仓库无需登录即可浏览（走 raw.githubusercontent.com） |

---

## 快速开始

### 1. 申请 GitHub Token

GitHub → Settings → Developer settings → Personal access tokens

- **Classic token**：勾选 `repo` 即可（想让程序自动建仓库也够用）。
- **Fine-grained token**：对目标仓库授予 `Contents: Read and write`；若还需要「自动创建仓库」，再加 `Administration: Read and write`。

Token 只保存在你浏览器的 localStorage/sessionStorage，仅发往 `api.github.com`。

### 2. 打开站点并登录

- 本地直接双击 `index.html` 就能用；
- 或起一个静态服务（推荐，链接/剪贴板功能更完整）：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

点右上角**登录**，只需填写 **Personal Access Token**：

- 仓库所有者、仓库名、分支已在 `config.js` 中配置好，登录框不再询问。
- Token 只保存在你浏览器的 localStorage/sessionStorage，仅发往 `api.github.com`。

登录成功后仓库里会自动出现 `data/index.json` 与 `README.md`。若仓库不存在，会提示创建。

### 3. 写文章

点「✏️ 写新文章」：左边写正文（工具栏有加粗 / 链接 / 图片 / emoji / 代码块），右边填标签、心情、发表时间、上传图片。

- **💾 保存草稿**：存为草稿，前台不可见，仅登录后可见（带「📝 草稿」徽标），可随时回来继续编辑。
- **🚀 发布**：提交到云端并立即可被访客看到。
- 编辑已有文章时点「保存修改」；`Ctrl+S` 新文章快速存草稿、编辑文章时保存修改。

每次保存都是一次 GitHub commit，历史可回溯。

### 4. 让访客免登录浏览

编辑根目录 `config.js`：

```js
window.BLOG_CONFIG = {
  owner: 'jeanzz2026',   // 仓库所有者
  repo: 'myblog',        // 专属数据仓库（与 GitHub 仓库名一致）
  branch: 'main',
  title: '狗子的Space',
  tagline: '记录一些不定期发生的小事 ✨',
  skin: 'dark',          // 单一暗色主题
  pageSize: 8
};
```

`owner` 留空时站点进入**演示模式**（显示示例文章，便于预览界面）。

### 5. 部署到 GitHub Pages（可选）

把本目录推到任意仓库（可以和数据仓库分开，也可以同一个），在仓库
Settings → Pages 里选择分支与根目录即可。已含 `.nojekyll`，无需额外配置。

---

## 数据结构

专属数据仓库里长这样：

```
data/
  index.json          # 清单：Space 资料 + 文章目录（标题/时间/标签/摘要）
  posts/
    20260825-133000-a1b.json
  images/
    1756100000000-photo.png
README.md
```

单篇文章：

```json
{
  "id": "20260825-133000-a1b",
  "title": "搬进新 Space 啦 🎉",
  "body": "正文，Markdown 子集 + emoji",
  "tags": ["随笔", "公告"],
  "mood": "🎧",
  "status": "published",
  "createdAt": "2026-08-25T05:30:00.000Z",
  "updatedAt": "2026-08-25T06:10:00.000Z",
  "images": [{ "path": "data/images/xxx.png", "url": "https://raw.githubusercontent.com/..." }]
}
```

`status` 为 `published`（前台可见）或 `draft`（仅作者可见）。纯 JSON + 文本，随时可以导出、迁移或用脚本二次加工。

---

## 文件说明

```
index.html              页面骨架 + 各对话框
config.js               站点默认配置（访客读取用）
assets/css/style.css    深色极简主题 + 响应式布局
assets/js/github.js     GitHub 存储层（PAT 校验、建仓、读写、图片上传）
assets/js/markdown.js   轻量 Markdown 渲染（自带 HTML 转义，防 XSS）
assets/js/emoji.js      emoji 选择器数据
assets/js/app.js        路由、渲染、编辑器、搜索、存档、设置
```

## 注意事项

- **私有仓库**：raw 直链不可用，登录状态下会自动回退到 API 读取；但图片直链在未登录时无法显示，建议数据仓库设为公开。
- **Token 安全**：不要把 Token 写进 `config.js` 或提交到仓库；它只应存在浏览器里。共用电脑请在登录时取消「记住我」。
- **限流**：未登录读取走 raw CDN，基本不受限；登录后的 API 调用配额为每小时 5000 次，正常写作远远够用。
