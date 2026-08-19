// 益智游戏-五子棋 插件入口
import { markRaw } from 'vue'
import Puzzle from './Puzzle.vue'

const manifest = {
  key: 'puzzle',
  label: '益智',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/></svg>',
  component: markRaw(Puzzle)
}

if (typeof window !== 'undefined' && window.registerPluginModule) {
  window.registerPluginModule(manifest)
}

export default manifest
