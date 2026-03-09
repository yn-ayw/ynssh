# WebSSH Xshell

一个基于 Vue 3 + Express + Socket.IO + `ssh2` 的 Web SSH 管理工具，当前主界面为 `TerminalNew`，提供 Xshell 风格的多标签终端、会话树、临时连接和内置 SFTP 文件管理。

## 功能概览

- 用户注册、登录、JWT 鉴权
- 首个注册用户自动成为管理员
- 服务器管理
  - 保存服务器
  - 分组管理
  - 编辑、删除、移动分组
  - 密码认证 / 私钥认证
- 终端能力
  - 多标签 SSH 会话
  - 会话管理器
  - 标签右键菜单
  - 常用命令面板
  - 地址栏临时连接
  - 临时连接支持密码和私钥
- 文件管理
  - 已保存会话支持 SFTP
  - 临时连接同样支持 SFTP
  - 文件浏览、编辑、上传、下载、重命名、删除、新建目录
- 管理员能力
  - 用户管理
  - 系统统计
  - 健康检查
  - 连接日志清理
- 安全相关
  - 服务端保存的 SSH 凭据使用 AES 加密
  - 临时 SFTP 载荷通过 RSA + AES 混合加密传输

## 当前可用页面

- `/login`
- `/register`
- `/terminal-new`
- `/user-management`（管理员）

当前路由已将 `/dashboard`、`/terminal`、`/group-management` 重定向到 `/terminal-new`。

## 技术栈

- 前端：Vue 3、Vite、Pinia、Element Plus、xterm.js、Monaco Editor
- 后端：Node.js、Express、Socket.IO、ssh2、mysql2、bcryptjs、jsonwebtoken
- 数据库：MySQL

## 项目结构

```text
webssh-main/
├─ backend/
│  ├─ config/          # 数据库初始化与连接
│  ├─ middleware/      # JWT 认证中间件
│  ├─ routes/          # 认证、服务器、SFTP、管理员接口
│  ├─ socket/          # SSH WebSocket 连接处理
│  ├─ utils/           # 加密、SFTP 工具
│  └─ server.js        # 后端入口
├─ frontend/
│  ├─ src/components/  # 终端、SFTP、命令库等组件
│  ├─ src/router/      # 前端路由
│  ├─ src/stores/      # Pinia store
│  └─ src/views/       # 登录、注册、终端、用户管理页面
├─ install.sql         # 推荐使用的数据库初始化脚本
├─ package.json        # 根脚本
└─ README.md
```

## 环境要求

- Node.js 18+
- MySQL 5.7+ 或 MySQL 8.x

## 安装与启动

### 1. 安装依赖

在项目根目录执行：

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

如果根目录、`backend`、`frontend` 已经分别存在 `node_modules`，可以跳过对应步骤。

### 2. 初始化数据库

推荐直接导入 `install.sql`：

```bash
mysql -u root -p < install.sql
```

说明：

- 后端在启动时会尝试自动创建基础表
- 但当前项目的完整用户字段（如 `is_admin`、`is_active`、`last_login`）以 `install.sql` 为准
- 如果你需要管理员功能，建议始终先导入 `install.sql`

### 3. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`：

```bash
cp backend/.env.example backend/.env
```

示例：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=webssh

JWT_SECRET=your_jwt_secret_key_here

PORT=3000
NODE_ENV=development

ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

注意：

- `ENCRYPTION_KEY` 必须正好 32 字节，否则后端启动会失败
- `JWT_SECRET` 请替换为随机强密码
- 开发模式下前端默认运行在 `5173`，后端默认运行在 `3000`

### 4. 开发模式启动

根目录同时启动前后端：

```bash
npm run dev
```

等价脚本：

- `npm run dev:backend`
- `npm run dev:frontend`

开发模式下：

- 前端：`http://localhost:5173`
- 后端 API / Socket：`http://localhost:3000`

### 5. 生产方式运行

先构建前端：

```bash
npm run build
```

再启动后端：

```bash
npm start
```

说明：

- 后端会直接托管 `frontend/dist`
- 默认访问地址为 `http://localhost:3000`

## 默认行为说明

### 首个用户

- 第一个注册的用户会自动拥有管理员权限
- 管理员可进入 `/user-management`

### 临时连接

- 地址栏支持 `ssh://user@host:port`
- 也支持直接输入 `host` 或 `host:port`
- 回车后会弹出临时连接表单
- 可选择密码认证或私钥认证
- 临时连接同样可以打开 SFTP 文件管理

### 已保存会话

- 会话树支持右键管理
- 会话管理器空白处右键可新建分组
- 标签页右键可关闭、重命名、保存到分组

## 主要接口

后端已挂载的接口前缀：

- `/api/auth`
- `/api/servers`
- `/api/sftp`
- `/api/sftp/quick`
- `/api/users`
- `/api/admin`

WebSocket 由 Socket.IO 提供，主要事件包括：

- `authenticate`
- `connect-ssh`
- `quick-connect`
- `ssh-input`
- `resize`
- `disconnect-ssh`

## 常见问题

### 1. 后端启动时报 `ENCRYPTION_KEY must be exactly 32 bytes long`

说明你的 `backend/.env` 中 `ENCRYPTION_KEY` 长度不对。请改成固定 32 个字符。

示例：

```env
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
```

### 2. 登录后没有管理员入口

- 只有首个注册用户会自动成为管理员
- 如果数据库已有用户，后续注册用户默认不是管理员

### 3. 临时连接提示 `All configured authentication methods failed`

通常是认证信息不匹配，不是前端界面问题。优先检查：

- 用户名是否正确
- 目标机器是否允许密码登录
- 是否应改用私钥认证
- SSH 服务端是否禁用了 `root` 登录

### 4. SFTP 无法打开

检查：

- 当前会话是否已经成功建立 SSH 连接
- 凭据是否正确
- 目标机器是否支持 SFTP 子系统

## 开发说明

当前代码里存在一些旧页面与新页面并存的情况，例如：

- `QuickConnect.vue`
- `QuickConnectTerminal.vue`
- `Terminal.vue`
- `Dashboard.vue`

但当前路由实际入口已经集中到 `TerminalNew.vue`。如果继续迭代，建议优先围绕 `TerminalNew.vue`、`backend/socket/socketHandler.js`、`backend/routes/sftp*.js` 这条主链路开发。

## 已验证的根脚本

根目录 `package.json` 当前可直接使用：

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run build
npm start
```

## 许可证

当前仓库中未看到单独的 `LICENSE` 文件。如需开源发布，建议补充明确许可证后再对外分发。
