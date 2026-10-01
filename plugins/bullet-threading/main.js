(function () {
  'use strict';

  /**
   * 列表穿线：后台增强插件（location: 'background'，无按钮无面板）。
   * 原理：纯 CSS 增强——复用内置缩进参考线（.indent-line）作竖向轨道，
   * 用 gutter::before 补画圆角弯头连接子项标记；不写入文档正文，
   * 停用插件（宿主移除 style.css）即恢复原样。
   * 显示模式经「设置 → 插件 → 已下载 → 设置」调整，
   * 存储走插件隔离存储（plugin/bullet-threading/settings）。
   */
  const PLUGIN_ID = 'bullet-threading';
  const SETTINGS_EVENT = 'bullet-threading:settings-changed';
  const DEFAULTS = { mode: 'hover' };

  const { h, ref, onMounted } = window.Vue;

  // ===== 设置应用 =====

  function normalizeSettings(raw) {
    const s = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
    if (!['always', 'hover'].includes(s.mode)) s.mode = DEFAULTS.mode;
    return s;
  }

  // 规则全部由 style.css 按属性选择器决定，这里只负责把模式写到文档根；
  // 属性缺失时 style.css 全部规则不生效（等于关闭）
  function applySettings(settings) {
    const s = normalizeSettings(settings);
    document.documentElement.setAttribute('data-bt-mode', s.mode);
  }

  // 先用默认值立即生效，避免等待 IPC 期间没有连线
  applySettings(DEFAULTS);

  async function loadAndApply() {
    try {
      const res = await electronAPI.loadModuleData('settings');
      applySettings(res && res.success ? res.data : null);
    } catch (e) {
      /* 读取失败保持默认/现状 */
    }
  }

  // 设置面板保存后广播，主逻辑即时重载（两个组件同窗口，经 window 事件通信）
  window.addEventListener(SETTINGS_EVENT, loadAndApply);

  // ===== 光标链路跟踪（hover 模式的「聚焦」路径） =====
  // contenteditable 中 DOM focus 只落在 .ProseMirror 根元素上，列表项是其后代而非祖先，
  // CSS :focus-within 永远匹配不到列表项——必须经 selectionchange 手动给光标所在
  // 列表项及其各级祖先打 .bt-focus 类（类名只被 hover 模式的 CSS 消费，常驻模式无副作用）。
  let caretChain = [];
  let caretScheduled = false;

  function updateCaretChain() {
    caretScheduled = false;
    const sel = window.getSelection();
    const anchor = sel && sel.anchorNode;
    let el = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
    let item = null;
    if (el) {
      const pm = el.closest('.ProseMirror');
      if (pm) {
        const cand = el.closest('.flat-list-item');
        if (cand && pm.contains(cand)) item = cand;
      }
    }
    const chain = [];
    while (item) {
      chain.push(item);
      item = item.parentElement ? item.parentElement.closest('.flat-list-item') : null;
    }
    // 链没变就不碰 DOM，避免 selectionchange 高频抖动
    if (chain.length === caretChain.length && chain.every((c, i) => c === caretChain[i])) return;
    caretChain.forEach((c) => c.classList.remove('bt-focus'));
    chain.forEach((c) => c.classList.add('bt-focus'));
    caretChain = chain;
  }

  // 用 setTimeout 而不是 requestAnimationFrame 合并抖动：
  // rAF 依赖帧产出，静态/隐藏窗口下可能长时间不触发（类名更新被饿死）
  document.addEventListener('selectionchange', () => {
    if (caretScheduled) return;
    caretScheduled = true;
    setTimeout(updateCaretChain, 0);
  });

  // ===== 设置面板（在设置弹窗的插件弹层中渲染） =====

  const MODE_OPTIONS = [
    { key: 'always', label: '常驻显示', desc: '所有嵌套列表的穿线始终可见' },
    { key: 'hover', label: '悬停或聚焦时显示', desc: '平时隐藏，鼠标悬停或光标进入列表项时淡出其所在链路' }
  ];

  const BulletThreadingSettings = {
    name: 'BulletThreadingSettings',
    setup() {
      const mode = ref(DEFAULTS.mode);

      onMounted(async () => {
        try {
          const res = await electronAPI.loadModuleData('settings');
          mode.value = normalizeSettings(res && res.success ? res.data : null).mode;
        } catch (e) {
          /* 保持默认 */
        }
      });

      const onModeChange = (e) => {
        mode.value = e.target.value;
        persist();
      };

      const persist = async () => {
        try {
          await electronAPI.saveModuleData('settings', { mode: mode.value });
        } catch (e) {
          /* 存储失败不阻断界面 */
        }
        window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
      };

      return { mode, MODE_OPTIONS, onModeChange };
    },
    render() {
      return h('div', { class: 'bt-settings' }, [
        h('div', { class: 'bt-settings-group' }, [
          h('div', { class: 'bt-settings-label' }, '显示模式'),
          ...this.MODE_OPTIONS.map(opt =>
            h('label', { class: 'bt-settings-radio', key: opt.key }, [
              h('input', {
                type: 'radio',
                name: 'bt-mode',
                value: opt.key,
                checked: this.mode === opt.key,
                onChange: this.onModeChange
              }),
              h('span', { class: 'bt-settings-radio-text' }, [
                h('span', { class: 'bt-settings-radio-name' }, opt.label),
                h('span', { class: 'bt-settings-radio-desc' }, opt.desc)
              ])
            ])
          )
        ]),
        h('p', { class: 'bt-settings-hint' },
          '穿线的颜色与粗细跟随「设置 → 编辑器 → 缩进参考线」的层级配置；无序圆点、有序序号、待办复选框、三角折叠四种列表项均可连接。穿线为视觉叠加，不写入正文。')
      ]);
    }
  };

  // ===== 注册（background：无按钮无面板，注册纳入统一生命周期） =====

  window.registerPluginModule({
    key: PLUGIN_ID,
    label: '列表穿线',
    icon: '',
    location: 'background',
    // background 无面板，component 仅占位不渲染
    component: { name: 'BulletThreadingStub', render: () => null },
    settingsComponent: BulletThreadingSettings
  });

  loadAndApply();

  console.log('[BulletThreading] 插件已注册');
})();
