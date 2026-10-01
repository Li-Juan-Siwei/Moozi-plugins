// 五子棋插件入口
// 注意：在 Electron+Vite 环境下，运行时动态加载 .vue 文件受限
// 此文件保留给未来的外部插件扩展机制使用
// 当前版本通过内置组件映射表注册

if (typeof window !== 'undefined' && window.registerPluginModule) {
    // 由应用主进程在加载时调用
    console.log('[Gomoku Plugin] 入口文件已加载')
}
