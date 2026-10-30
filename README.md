# 荒野余生

两个版本，同一个宇宙：

| 版本 | 入口 | 说明 |
|---|---|---|
| **3D 探索版**（新） | `start.html` → `explore.html` | 第三人称 3D，自己操控角色在未知岛屿上走动、砍树、生火、躲避野兽、熬过夜晚。手机竖屏优先。 |
| 2D 生存经营版 | `index.html` | 文字 + 数值面板，管理营地撑过 20 天等救援。 |

## 3D 探索版怎么玩

**横屏游玩**（手机请把屏幕转过来；加到主屏幕后会自动锁定横屏并全屏）。

- **移动**：手机左下角摇杆；电脑用 `WASD` / 方向键。跑动会自动变快，但会消耗体力。
- **转视角**：手指在屏幕右半边拖动；镜头会慢慢回正到角色背后。
- **行动**：靠近树或石头，准心亮起时按右下角的大按钮（键盘 `E` 或 `F`）。
  - 树：敲 3 下倒下，拿到 🪵 木材。
  - 石头：敲 3 下碎开，拿到 🪨 石料。
  - 有木材之后，站在空地上按一次按钮 = 搭一个 🔥 营火。
- **昼夜**：右上角圆盘表示一天走到哪了，圆点表示已经过了几天。天黑后视野会收窄，夜里野兽更凶，火把/营火能照亮周围。
- **四个状态**（无文字，纯图形）：体力、饥饿、口渴、冲刺耐力。任何一格见底都会让你倒下。

## 手机上玩（部署到 GitHub Pages）

1. 打开 https://github.com/settings/tokens?type=beta 新建 **Fine-grained token**：
   - Resource owner 选你自己的账号
   - Repository access 选 **All repositories**（第一次建仓库需要）
   - Permissions 勾选 **Contents: Read and write**、**Pages: Read and write**、**Administration: Read and write**
   - 生成后复制 `github_pat_...` 开头的 token
2. 在这个项目目录里运行（同一个 PowerShell 会话）：

```powershell
$env:GH_TOKEN = "github_pat_你的token"
node tools\deploy-gh-pages.mjs
```

3. 脚本会自动建仓库、上传所有文件、开启 Pages 并等到构建完成，最后打印访问地址：

```
https://<你的用户名>.github.io/wilderness-survival/start.html
```

4. 手机浏览器打开该地址 → 菜单里选「添加到主屏幕」。之后点图标进入就是**横屏全屏**，且可以离线玩。

> 部署前可以先跑 `node tools/check-deploy.mjs`：它会检查文件齐全、**路径大小写**（GitHub Pages 区分大小写，Windows 不区分，最容易在这里出错）、importmap 指向、PWA 清单和 Service Worker 缓存清单。

## 文件结构

```
wilderness-survival/
├─ start.html                入口选择页
├─ explore.html              3D 探索版
├─ index.html                2D 经营版
├─ css/game.css              3D 版样式（HUD / 摇杆 / 按钮）
├─ css/style.css             2D 版样式
├─ js3d/
│  ├─ world-data.js          程序化地形、植被、动物、出生点（纯逻辑，可在 Node 里测试）
│  ├─ main.js                Three.js 场景、角色、镜头、采集、昼夜、野兽
│  └─ overlay.js             HUD 覆盖层（状态条、昼夜盘、物品栏、气泡提示）
├─ vendor/
│  ├─ three.module.js        Three.js r160（本地库，离线可用）
│  └─ examples/jsm/          Three.js 附加模块（预留）
├─ js/                       2D 版逻辑
├─ tools/
│  ├─ deploy-gh-pages.mjs    GitHub Pages 一键部署（走 API，不需要 git）
│  ├─ check-deploy.mjs       部署前自检（文件、大小写、清单、缓存）
│  ├─ make-icons.py          生成 PWA 图标 PNG
│  ├─ test3d.js              3D 版静态一致性测试（不需要浏览器）
│  ├─ smoke-test.js          2D 版冒烟测试
│  ├─ balance.js             2D 版数值平衡模拟
│  └─ preview.html           2D 版界面自检页
├─ manifest.webmanifest      PWA 清单
└─ sw.js                     离线缓存
```

## 开发

```powershell
# 3D 版静态测试：DOM id、模块导出、岛屿生成质量、高度场一致性
node tools/test3d.js

# 2D 版测试
node tools/smoke-test.js
node tools/balance.js

# 本地预览（3D 版依赖 ES module + importmap，必须走 http，不能直接 file://）
python -m http.server 8000
# 然后打开 http://127.0.0.1:8000/start.html
```

> ⚠️ 3D 版用 `import` + `importmap` 加载 `vendor/three.module.js`，浏览器出于安全限制**不支持 `file://` 直接打开 ES module**。要么用上面任意静态服务器，要么部署到 GitHub Pages / 自己的服务器后再「添加到主屏幕」。

## 已知限制

- 当前环境的沙箱无法启动无头浏览器，因此 3D 画面没有经过截图验证；逻辑与资源加载已用静态测试 + 本地服务器验证。
- 世界规模：288×288 单位、约 210 棵树、100 块石头、26 只动物，生成耗时约 10ms。