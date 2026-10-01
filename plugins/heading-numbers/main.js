(function () {
  'use strict';

  /**
   * 标题序号：后台增强插件（location: 'background'，无按钮无面板）。
   * 原理：CSS 计数器在编辑器标题前叠加序号，不写入文档正文，
   * 停用插件即恢复原文；每个文档（ProseMirror 实例）独立从 1 编号。
   * 编号风格等选项经「设置 → 插件 → 已下载 → 设置」调整，
   * 存储走插件隔离存储（plugin/heading-numbers/settings）。
   */
  const PLUGIN_ID = 'heading-numbers';
  const SETTINGS_EVENT = 'heading-numbers:settings-changed';
  const DEFAULTS = { style: 'decimal', skipFirstH1: false, startLevel: 1 };

  const { h, ref, onMounted } = window.Vue;

  // ===== 设置应用 =====

  function normalizeSettings(raw) {
    const s = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
    if (!['decimal', 'chinese', 'flat'].includes(s.style)) s.style = DEFAULTS.style;
    s.skipFirstH1 = !!s.skipFirstH1;
    s.startLevel = Math.min(4, Math.max(1, parseInt(s.startLevel, 10) || 1));
    return s;
  }

  // 编号规则全部由 style.css 按属性选择器决定，这里只负责把设置写到文档根
  function applySettings(settings) {
    const s = normalizeSettings(settings);
    const root = document.documentElement;
    root.setAttribute('data-hn-style', s.style);
    root.setAttribute('data-hn-start', String(s.startLevel));
    if (s.skipFirstH1) root.setAttribute('data-hn-skip-h1', '');
    else root.removeAttribute('data-hn-skip-h1');
  }

  // 先用默认值立即生效，避免等待 IPC 期间没有编号
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

  // ===== 设置面板（在设置弹窗的插件弹层中渲染） =====

  const STYLE_OPTIONS = [
    { key: 'decimal', label: '多级数字', sample: '1. 标题 / 1.1 标题 / 1.1.1 标题' },
    { key: 'chinese', label: '中文层级', sample: '一、标题 /（一）标题 / 1. 标题' },
    { key: 'flat', label: '连续平铺', sample: '1. 标题 / 2. 标题 / 3. 标题（不分层级）' }
  ];

  const HeadingNumbersSettings = {
    name: 'HeadingNumbersSettings',
    setup() {
      const style = ref(DEFAULTS.style);
      const skipFirstH1 = ref(DEFAULTS.skipFirstH1);
      const startLevel = ref(DEFAULTS.startLevel);

      onMounted(async () => {
        try {
          const res = await electronAPI.loadModuleData('settings');
          const s = normalizeSettings(res && res.success ? res.data : null);
          style.value = s.style;
          skipFirstH1.value = s.skipFirstH1;
          startLevel.value = s.startLevel;
        } catch (e) {
          /* 保持默认 */
        }
      });

      const persist = async () => {
        try {
          await electronAPI.saveModuleData('settings', {
            style: style.value,
            skipFirstH1: skipFirstH1.value,
            startLevel: startLevel.value
          });
        } catch (e) {
          /* 存储失败不阻断界面 */
        }
        window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
      };

      const onStyleChange = (e) => {
        style.value = e.target.value;
        persist();
      };
      const onSkipChange = (e) => {
        skipFirstH1.value = e.target.checked;
        persist();
      };
      const onStartChange = (level) => {
        startLevel.value = level;
        persist();
      };

      return { style, skipFirstH1, startLevel, STYLE_OPTIONS, onStyleChange, onSkipChange, onStartChange };
    },
    render() {
      return h('div', { class: 'hn-settings' }, [
        h('div', { class: 'hn-settings-group' }, [
          h('div', { class: 'hn-settings-label' }, '编号风格'),
          ...this.STYLE_OPTIONS.map(opt =>
            h('label', { class: 'hn-settings-radio', key: opt.key }, [
              h('input', {
                type: 'radio',
                name: 'hn-style',
                value: opt.key,
                checked: this.style === opt.key,
                onChange: this.onStyleChange
              }),
              h('span', { class: 'hn-settings-radio-text' }, [
                h('span', { class: 'hn-settings-radio-name' }, opt.label),
                h('span', { class: 'hn-settings-radio-sample' }, opt.sample)
              ])
            ])
          )
        ]),
        h('div', { class: 'hn-settings-group' }, [
          h('div', { class: 'hn-settings-label' }, '起始层级'),
          h('div', { class: 'hn-settings-start-group' },
            [1, 2, 3, 4].map(level =>
              h('label', { class: 'hn-settings-start-item', key: level }, [
                h('input', {
                  type: 'radio',
                  name: 'hn-start-level',
                  checked: this.startLevel === level,
                  onChange: () => this.onStartChange(level)
                }),
                h('span', {}, `${level} 级`)
              ])
            )
          ),
          h('p', { class: 'hn-settings-hint', style: 'margin-top:8px;' },
            '从所选层级开始编号，之前的标题不编号、也不占用序号（适合用一级标题当文档标题、正文从二级开始的笔记）。')
        ]),
        h('label', { class: 'hn-settings-checkbox' }, [
          h('input', {
            type: 'checkbox',
            checked: this.skipFirstH1,
            onChange: this.onSkipChange
          }),
          h('span', {}, '首个一级标题不编号（仍占用序号，与「起始层级」不冲突）')
        ]),
        h('p', { class: 'hn-settings-hint' },
          '序号为视觉叠加，不写入正文；每个文档独立从 1 开始编号。')
      ]);
    }
  };

  // ===== 注册（background：无按钮无面板，注册纳入统一生命周期） =====

  window.registerPluginModule({
    key: PLUGIN_ID,
    label: '标题序号',
    icon: '',
    location: 'background',
    // background 无面板，component 仅占位不渲染
    component: { name: 'HeadingNumbersStub', render: () => null },
    settingsComponent: HeadingNumbersSettings
  });

  loadAndApply();

  console.log('[HeadingNumbers] 插件已注册');
})();
