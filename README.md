# Moozi-plugins

Mozi 桌面端的远程插件仓库。应用通过 jsDelivr CDN 拉取本仓库的插件清单和插件文件，下载后安装到本地用户目录（与主题仓库 Moozi-themes 同一套机制）。

## 仓库结构

```
plugins-repo/
├── plugins.json          # 插件清单（应用拉取的入口，由脚本生成，勿手改）
├── build-manifest.js     # 清单生成脚本
└── plugins/
    └── <plugin-id>/      # 每个插件一个目录，plugin-id 即目录名
        ├── manifest.json
        ├── main.js       # 入口文件，文件名以 manifest 的 entry 字段为准
        └── style.css     # 可选
```

## plugins.json 格式

数组，每项字段从对应插件的 `manifest.json` 提取，另带 `files` 哈希表：

```json
[
  {
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "description": "……",
    "author": "Moozi Team",
    "icon": "<svg …></svg>",
    "entry": "main.js",
    "category": "module",
    "dependencies": [],
    "files": { "manifest.json": "<sha256>", "main.js": "<sha256>", "style.css": "<sha256>" }
  }
]
```

- `id` 必须与 `plugins/` 下的目录名一致。
- `files` 记录插件目录内每个文件的 SHA-256，应用端下载后逐文件校验，校验失败拒绝安装，防止 CDN 缓存污染或传输损坏。
- `category` 为 `module`（功能模块）或 `game`（益智游戏）；主题请放到 Moozi-themes 仓库。

## 应用端 CDN 地址

应用按以下顺序依次尝试源，全部失败时使用本地磁盘缓存：

1. jsDelivr：`https://cdn.jsdelivr.net/gh/Li-Juan-Siwei/Moozi-plugins@main/plugins.json`
2. GitHub raw：`https://raw.githubusercontent.com/Li-Juan-Siwei/Moozi-plugins/main/plugins.json`

插件文件路径为 `<base>/plugins/<plugin-id>/<file>`。

## 如何新增 / 更新插件

1. 在 `plugins/` 下新建 `<plugin-id>/` 目录，编写 `manifest.json`（含 `entry`、`category`）和入口 JS，可选 `style.css`。插件开发规范见主项目 `PLUGIN_DEVELOPMENT.md`。
2. 运行 `node build-manifest.js` 重新生成 `plugins.json`（会自动带上最新文件的 SHA-256）。
3. 更新已有插件时记得提升 `manifest.json` 中的 `version`，应用端靠版本号差异提示更新。
4. 推送到 GitHub 后，jsDelivr 可能需要数分钟刷新缓存；如需立即生效，可临时用 `@<commit-sha>` 代替 `@main` 验证。

## 安全说明

插件是可执行 JS，加载后拥有渲染进程的完整能力。请务必：

- 只推送经过审阅的插件代码；不要把仓库写权限交给未信任的人。
- 不要修改 `build-manifest.js` 的哈希生成逻辑来绕过校验。
- 如果以后要开放第三方投稿，应增加人工审核流程。
