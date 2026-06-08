# QMast

QMast 是一个轻量的习惯记录与自我觉察工具，面向个人使用和小规模私有部署。它不需要 Node 构建链，也不依赖数据库服务器，把文件放到支持 PHP + SQLite 的虚拟主机即可运行。

## 功能状态

- 快速记录：一键新增记录，最近一条可编辑触发因素或删除。
- 数据看板：今日、本周、连续清净天数，以及周目标进度。
- 温和提醒：达到每日或每周阈值时弹出提示和替代建议。
- 周报总结：按周统计本周与上周变化。
- 账号系统：注册、登录、Token 鉴权。
- 云端同步：多设备同步记录，支持新增、编辑覆盖、删除同步和离线删除补偿。
- 数据迁移：JSON 导入、导出本地备份。
- 外观设置：浅色/深色模式、阈值和周目标配置。
- PWA 基础：提供 `manifest.json` 和应用图标，可被移动端识别为 Web App。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript。
- 后端：PHP 7.4+。
- 数据库：SQLite3，首次访问自动创建 `api/data.db`。
- 人机验证：Cloudflare Turnstile，可选。
- 部署目标：普通 PHP 虚拟主机、cPanel、宝塔、DirectAdmin 等常见环境。

## 目录结构

```text
.
├── index.html
├── style.css
├── script.js
├── manifest.json
├── icons/
│   └── icon.svg
└── api/
    ├── .htaccess
    ├── config.php
    ├── status.php
    ├── setup.php
    ├── register.php
    ├── login.php
    └── sync.php
```

运行后会自动生成：

- `api/data.db`：SQLite 数据库。
- `api/config.local.php`：安装向导保存的 Turnstile 密钥，可选。

这两个文件不要提交到公开仓库，也不要允许公网直接下载。

## 部署到虚拟主机

是的，常规情况下你只需要把这些项目文件上传到站点根目录，比如 `public_html`，然后打开绑定域名即可。

部署前确认主机满足：

- PHP 7.4 或更高版本。
- 启用 SQLite3 扩展。
- `api/` 目录允许 PHP 写入，用来生成数据库和本地配置。
- 如果使用 Turnstile 验证，PHP 需要启用 cURL 扩展。

部署步骤：

1. 上传全部文件到 `public_html`，保持 `api/` 和 `icons/` 目录结构不变。
2. 打开绑定域名，例如 `https://你的域名/`。
3. 首次进入会出现安装向导。
4. Turnstile 可以留空；如果你需要人机验证，就到 Cloudflare Turnstile 创建站点并填入 Site Key 与 Secret Key。
5. 创建管理员账号，进入应用。

## 安全建议

- 项目已在 `api/.htaccess` 中禁止直接访问 `data.db` 和 `config.local.php`。
- 如果你的虚拟主机使用 Nginx，`.htaccess` 不生效，需要在面板或 Nginx 配置中禁止访问：

```nginx
location ~ ^/api/(data\.db|config\.local\.php)$ {
  deny all;
}
```

- 建议开启 HTTPS，避免登录和同步请求被明文传输。
- 不要把运行后生成的 `api/data.db` 和 `api/config.local.php` 上传到公开仓库。

## 本地检查

前端脚本可以用 Node 做语法检查：

```bash
node --check script.js
```

如果本机安装了 PHP，可以检查接口语法：

```bash
php -l api/config.php
php -l api/status.php
php -l api/setup.php
php -l api/register.php
php -l api/login.php
php -l api/sync.php
```

## 上传到 GitHub

当前项目目标仓库：<https://github.com/lijboys/QMast>

如果本机已安装 Git，可以在项目目录执行：

```bash
git init
git branch -M main
git remote add origin https://github.com/lijboys/QMast.git
git add .
git commit -m "Improve QMast deployment and sync"
git push -u origin main
```

如果仓库已有内容，先执行 `git clone https://github.com/lijboys/QMast.git`，再把本项目文件复制进去提交，避免覆盖远端已有文件。

## 许可

MIT
