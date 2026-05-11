<div align="center">

<img src="src/assets/logo.png" alt="gifcat" width="128" height="128" />

# gifcat

**🐱 An open-source GIF editor for macOS — fast, native, and pixel-accurate.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.5-24C8DB?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org)
[![Made for macOS](https://img.shields.io/badge/macOS-14%2B-black?logo=apple)](https://www.apple.com/macos/)

[English](#english) · [简体中文](#简体中文)

</div>

---

## English

### What is gifcat?

**gifcat** is a lightweight, native-feeling GIF editor for macOS. Open a GIF, layer on text, images, or other GIFs, scrub the timeline, and export — what you see on the canvas is exactly what lands in the output file.

> Built with Tauri 2 + React + Rust. ~10 MB binary, no Electron, no telemetry.

### Highlights

- **Multi-layer compositing.** Stack text, images, and GIF overlays on top of any base GIF.
- **Per-clip timeline.** Every overlay gets its own track. Drag clip edges to retime, drag the body to reposition, fade-in / fade-out built in.
- **Pixel-accurate export.** The export pipeline rasterizes the same `Canvas` that drives the preview — no surprises between what you see and what ships.
- **Two export qualities.** Standard via `ffmpeg` (palettegen), High via [`gifski`](https://gif.ski) for cleaner, smaller GIFs.
- **Native macOS feel.** Vibrancy sidebars, system menu bar, light/dark/system theme, ⌘O / ⌘E / ⌘Z shortcuts.
- **Trilingual UI.** English, 简体中文, 日本語 — switch live, no restart.
- **Fast at scale.** Binary IPC (zero-copy `ArrayBuffer`) for decode/export, transient store channel keeps the undo stack clean during drag.

### Screenshots

> _Drop a screenshot here once the README is reviewed — `docs/screenshots/main.png` etc._

### Quick start

#### From source

```bash
# Prereqs: Node 20+, pnpm, Rust stable, Xcode CLT
brew install pnpm rust ffmpeg gifski

git clone https://github.com/Alouette98/gifcat.git
cd gifcat
pnpm install
pnpm tauri dev          # development
pnpm tauri build        # production .app + .dmg
```

The bundled app lives at `src-tauri/target/release/bundle/macos/gifcat.app`.

#### Runtime extensions

gifcat shells out to two binaries during export. The Settings → Extensions tab can install them via Homebrew with one click:

| Tool | Why | License |
|------|-----|---------|
| `ffmpeg` | Standard-quality export (palettegen + paletteuse) | LGPL / GPL |
| `gifski` | High-quality export (preferred for small text and gradients) | AGPL-3.0 |

> gifski is invoked as a separate process, so its AGPL terms apply only to its own distribution. gifcat itself is MIT.

### Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | Tauri 2.5 | Native menu, vibrancy, no Chromium bundle |
| Frontend | React 19 + Vite + TypeScript | Familiar, fast HMR |
| State | Zustand | Tiny, no provider hell, supports transient writes |
| Compositor | `OffscreenCanvas` shared between preview & export | Single source of truth = pixel parity |
| Decoder | `gif` crate (Rust) | Decodes once, sends frames as packed `ArrayBuffer` |
| i18n | i18next + browser-languagedetector | Cross-window event sync |
| Encoders | `ffmpeg` / `gifski` (subprocess) | Best-in-class without bundling AGPL into the binary |

### Project layout

```
gifcat/
├── src/                 # React frontend
│   ├── components/      # Toolbar, Canvas, Timeline, PropertiesPanel, SettingsApp
│   ├── engine/          # compose.ts (drawFrame), rasterize.ts, framePicker.ts
│   ├── store/           # playbackStore, projectStore (with transient channel)
│   ├── ipc/             # gif.ts (decode), menu.ts
│   └── i18n/            # en / zh-CN / ja
├── src-tauri/
│   ├── src/
│   │   ├── gif/         # decoder, packer
│   │   └── commands/    # decode_gif, export_gif, settings, menu
│   └── tauri.conf.json
└── docs/                # design notes & milestone plans
```

### Roadmap

- [x] M1 – App skeleton (open / play / scrub)
- [x] M2 – Overlay model + selection / drag / scale
- [x] M3 – Text / image / GIF / watermark overlays
- [x] M4 – ffmpeg standard export
- [x] M5 – gifski high-quality export, filter-graph parity tests
- [x] M6 – Multi-track timeline, transient store, native menu, i18n
- [ ] M7 – Time ruler ticks, fade-in / fade-out drag handles
- [ ] M8 – Cut / split clips at cursor
- [ ] M9 – Reorder layers via drag
- [ ] M10 – Windows / Linux builds

### Contributing

PRs welcome. Please:

1. Fork → branch → PR against `main`.
2. Run `pnpm test` and `pnpm exec tsc --noEmit` before opening the PR.
3. Keep changes focused — no drive-by refactors.

### License

[MIT](LICENSE) © gifcat contributors.
gifski (AGPL-3.0) and ffmpeg (LGPL/GPL) are user-installed; gifcat does not redistribute them.

---

## 简体中文

### gifcat 是什么？

**gifcat** 是一款轻量、原生的 macOS GIF 编辑器。打开 GIF，叠加文字 / 图片 / 其它 GIF，调整时间轴，一键导出——画布上看到的就是导出文件里看到的。

> 基于 Tauri 2 + React + Rust。约 10 MB 体积，没有 Electron，没有遥测。

### 主要特性

- **多图层合成**：在任何 GIF 上叠加文字、图片、GIF。
- **多轨时间轴**：每个图层一条独立轨道。拖边缘改起止，拖中间整体平移，自带淡入淡出。
- **像素级导出**：预览和导出走同一份 `Canvas` 合成代码——所见即所得。
- **两档导出画质**：标准走 `ffmpeg`（palettegen），高画质走 [`gifski`](https://gif.ski)，文字与渐变更干净。
- **原生 macOS 体验**：磨砂侧栏、系统菜单栏、浅色/深色/跟随系统、⌘O / ⌘E / ⌘Z 快捷键。
- **三语 UI**：英文、简体中文、日本語，切换无需重启。
- **大文件不卡**：解码/导出走二进制 IPC（零拷贝 `ArrayBuffer`），拖拽走 transient 通道，撤销栈不再被淹没。

### 截图

> _README 定稿后放置截图至 `docs/screenshots/main.png` 等。_

### 快速开始

#### 从源码运行

```bash
# 需要：Node 20+、pnpm、Rust stable、Xcode CLT
brew install pnpm rust ffmpeg gifski

git clone https://github.com/Alouette98/gifcat.git
cd gifcat
pnpm install
pnpm tauri dev          # 开发
pnpm tauri build        # 打包 .app + .dmg
```

打包产物在 `src-tauri/target/release/bundle/macos/gifcat.app`。

#### 运行时扩展

gifcat 在导出时会调用两个外部二进制。设置 → 扩展 标签页可一键通过 Homebrew 安装：

| 工具 | 用途 | 许可证 |
|------|------|--------|
| `ffmpeg` | 标准画质导出（palettegen + paletteuse） | LGPL / GPL |
| `gifski` | 高画质导出（小字、渐变更友好） | AGPL-3.0 |

> gifski 以独立子进程方式调用，AGPL 仅约束 gifski 自身分发。gifcat 本体使用 MIT。

### 技术栈

| 层 | 方案 | 原因 |
|----|------|------|
| 外壳 | Tauri 2.5 | 原生菜单、毛玻璃、不打包 Chromium |
| 前端 | React 19 + Vite + TypeScript | 熟悉、HMR 快 |
| 状态 | Zustand | 体积小、无 Provider、支持 transient 写入 |
| 合成器 | 预览/导出共享 `OffscreenCanvas` | 单一事实源，像素级一致 |
| 解码 | Rust `gif` crate | 一次解码、整段 `ArrayBuffer` 回传 |
| i18n | i18next + browser-languagedetector | Tauri 事件跨窗口同步 |
| 编码器 | 子进程调用 `ffmpeg` / `gifski` | 不把 AGPL 打进二进制 |

### 目录结构

```
gifcat/
├── src/                 # React 前端
│   ├── components/      # Toolbar / Canvas / Timeline / PropertiesPanel / SettingsApp
│   ├── engine/          # compose.ts（drawFrame）/ rasterize.ts / framePicker.ts
│   ├── store/           # playbackStore / projectStore（带 transient 通道）
│   ├── ipc/             # gif.ts（解码）/ menu.ts
│   └── i18n/            # en / zh-CN / ja
├── src-tauri/
│   ├── src/
│   │   ├── gif/         # 解码、打包
│   │   └── commands/    # decode_gif / export_gif / settings / menu
│   └── tauri.conf.json
└── docs/                # 设计文档与里程碑计划
```

### Roadmap

- [x] M1 – 应用骨架（打开 / 播放 / 拖动）
- [x] M2 – Overlay 数据模型 + 选中 / 拖动 / 缩放
- [x] M3 – 文字 / 图片 / GIF / 水印
- [x] M4 – ffmpeg 标准导出
- [x] M5 – gifski 高画质导出，filter-graph 一致性测试
- [x] M6 – 多轨时间轴、transient store、原生菜单、i18n
- [ ] M7 – 时间刻度尺、淡入淡出拖把手
- [ ] M8 – 在 cursor 处剪切片段
- [ ] M9 – 拖拽调整图层顺序
- [ ] M10 – Windows / Linux 构建

### 贡献

欢迎 PR：

1. Fork → branch → 向 `main` 提交 PR。
2. 提 PR 前跑一下 `pnpm test` 和 `pnpm exec tsc --noEmit`。
3. 改动聚焦——别顺手大刀阔斧重构。

### 许可证

[MIT](LICENSE) © gifcat 贡献者。
gifski（AGPL-3.0）和 ffmpeg（LGPL/GPL）由用户自行安装，gifcat 不再分发。
