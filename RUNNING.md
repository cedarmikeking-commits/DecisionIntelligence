# 产教融合综合管理平台 - 运行指南

## 项目概述
这是一个基于 React 和 Vite 构建的产教融合综合管理平台，用于专业建设与产业发展深度融合的智能决策支持。

## 环境要求
- Node.js (版本 18.x 或更高)
- npm 或 yarn 包管理器

## 安装步骤

1. 确保已安装 Node.js：
   ```bash
   node --version
   npm --version
   ```

2. 如果未安装 Node.js，请从 [Node.js 官网](https://nodejs.org/) 下载并安装。

3. 克隆或下载项目到本地目录。

4. 在项目根目录下安装依赖：
   ```bash
   npm install
   # 或者
   yarn install
   ```

5. 启动开发服务器：
   ```bash
   npm run dev
   # 或者
   yarn dev
   ```

## 脚本命令

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run preview` - 预览构建后的应用

## 访问应用

启动开发服务器后，应用将在浏览器中自动打开，通常地址为 `http://localhost:5173`。

## 静态预览

如果暂时无法运行开发环境，可以打开项目根目录下的 `preview.html` 文件查看界面预览。

## 技术栈

- React 19.x
- TypeScript
- Vite
- Tailwind CSS (推测)
- SQLite (通过 jsDelivr CDN)

## 项目结构

项目包含以下主要功能模块：
- 数据可视化
- 专业管理
- 智能决策
- 企业协同
- 服务管理