(function () {
  'use strict';

  /**
   * 桌面挂件：后台增强插件（location: 'background'，无按钮无面板）。
   * 在主面板（#main-panel-root）右下角悬浮展示一张贴图，纯静态、鼠标可穿透。
   *
   * 三态状态机（与用户确认的规则）：
   * - silent（静默）：默认态；窗口失焦/最小化、鼠标纯移动、无法判定的活动都算静默
   * - typing（输入中）：可编辑元素内的按键/输入事件，优先于通用操作
   * - active（操作中）：点击、滚动、拖拽等其他操作
   * 任一活动进入对应状态并重置同一个 30s 倒计时（输入优先 = 后发生的输入覆盖操作态；
   * 输入保持期内发生操作则直接切到操作态）；连续 30s 无活动回落静默。
   *
   * 每个状态一张贴图：内置默认图，设置面板可分别换自定义图片
   * （存插件隔离存储 plugin/desk-widget/settings，随工作空间备份/同步）。
   */
  const PLUGIN_ID = 'desk-widget';
  const ELEMENT_ID = 'desk-widget-sticker';
  const SETTINGS_EVENT = 'desk-widget:settings-changed';
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 自定义图片上限，避免存储 JSON 过大
  // 打字会让编辑器自动滚动把光标挪进视野（Tiptap scrollIntoView），
  // 这种程序滚动不算用户操作：输入后 400ms 内的 scroll 事件忽略
  const TYPING_SCROLL_GUARD_MS = 400;

  const STATES = [
    { key: 'silent', label: '静默' },
    { key: 'typing', label: '输入中' },
    { key: 'active', label: '操作中' }
  ];
  const DEFAULTS = { images: { silent: '', typing: '', active: '' }, width: 120 };

  const { h, ref, onMounted } = window.Vue;

  // ===== 默认贴图（内联 SVG 小盆栽，三态不同表情/配饰；不打相对路径资源的主意） =====

  function makeSticker(faceSvg, extraSvg) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">' +
      '<ellipse cx="60" cy="134" rx="34" ry="5" fill="rgba(0,0,0,0.12)"/>' +
      '<path d="M35 100h50l-6 34H41z" fill="#d2703f"/>' +
      '<path d="M35 100h50l-2 10H37z" fill="#e08a5a"/>' +
      '<rect x="52" y="30" width="16" height="72" rx="8" fill="#5aa860"/>' +
      '<rect x="30" y="52" width="12" height="34" rx="6" fill="#5aa860"/>' +
      '<rect x="36" y="58" width="16" height="12" rx="6" fill="#5aa860"/>' +
      '<rect x="78" y="44" width="12" height="42" rx="6" fill="#5aa860"/>' +
      '<rect x="68" y="52" width="16" height="12" rx="6" fill="#5aa860"/>' +
      faceSvg +
      '<circle cx="48" cy="62" r="3" fill="rgba(255,150,150,0.55)"/>' +
      '<circle cx="72" cy="62" r="3" fill="rgba(255,150,150,0.55)"/>' +
      '<circle cx="60" cy="22" r="9" fill="#f2b8c6"/>' +
      '<circle cx="60" cy="22" r="4" fill="#f7d154"/>' +
      (extraSvg || '') +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  const DEFAULT_IMAGES = {
    // 静默：圆眼微笑
    silent: makeSticker(
      '<circle cx="56" cy="56" r="2.4" fill="#2d4a32"/>' +
      '<circle cx="64" cy="56" r="2.4" fill="#2d4a32"/>' +
      '<path d="M56 64q4 4 8 0" stroke="#2d4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    ),
    // 输入中：弯弯笑眼 + 手边一块小键盘
    typing: makeSticker(
      '<path d="M52 58q4-4.5 8 0" stroke="#2d4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<path d="M62 58q4-4.5 8 0" stroke="#2d4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<path d="M56 64q4 4.5 8 0" stroke="#2d4a32" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      '<rect x="86" y="90" width="26" height="14" rx="3" fill="#8a93a6"/>' +
      '<rect x="89" y="93.5" width="20" height="2" rx="1" fill="#dfe3ea"/>' +
      '<rect x="89" y="97.5" width="12" height="2" rx="1" fill="#dfe3ea"/>'
    ),
    // 操作中：睁眼张嘴 + 星星与速度线
    active: makeSticker(
      '<circle cx="56" cy="56" r="3" fill="#2d4a32"/>' +
      '<circle cx="64" cy="56" r="3" fill="#2d4a32"/>' +
      '<ellipse cx="60" cy="65" rx="3" ry="3.6" fill="#2d4a32"/>',
      '<path d="M96 28l2.1 4.5 4.8.5-3.6 3.3 1 4.7-4.3-2.4-4.3 2.4 1-4.7-3.6-3.3 4.8-.5z" fill="#f7d154"/>' +
      '<path d="M16 42h10M13 50h12" stroke="#8a93a6" stroke-width="2" stroke-linecap="round"/>'
    )
  };

  // ===== 设置 =====

  function normalizeSettings(raw) {
    const s = { images: { ...DEFAULTS.images }, width: DEFAULTS.width };
    if (raw && typeof raw === 'object') {
      if (raw.images && typeof raw.images === 'object') {
        for (const { key } of STATES) {
          if (typeof raw.images[key] === 'string') s.images[key] = raw.images[key];
        }
      } else if (typeof raw.image === 'string' && raw.image) {
        s.images.silent = raw.image; // 兼容 1.0.0 的单图设置
      }
      s.width = Math.min(240, Math.max(80, parseInt(raw.width, 10) || DEFAULTS.width));
    }
    return s;
  }

  let currentSettings = normalizeSettings(null);

  async function loadSettings() {
    try {
      const res = await electronAPI.loadModuleData('settings');
      currentSettings = normalizeSettings(res && res.success ? res.data : null);
    } catch (e) {
      currentSettings = normalizeSettings(null);
    }
    return currentSettings;
  }

  // ===== 状态机 =====

  let currentState = 'silent';
  let idleMs = 30000;
  let idleTimer = null;
  let lastTypingAt = 0;

  function currentSrc() {
    return currentSettings.images[currentState] || DEFAULT_IMAGES[currentState];
  }

  function applyState(next) {
    currentState = next;
    if (boxEl) {
      const img = boxEl.querySelector('img');
      if (img) img.src = currentSrc();
    }
  }

  function enterState(next) {
    if (next === 'typing') lastTypingAt = Date.now();
    applyState(next);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => applyState('silent'), idleMs);
  }

  function goSilent() {
    clearTimeout(idleTimer);
    idleTimer = null;
    applyState('silent');
  }

  // ===== 活动监听（capture 阶段，scroll 不冒泡必须 capture；mousemove 不算活动） =====

  const isEditableTarget = (t) =>
    !!(t && t.closest && t.closest('input, textarea, [contenteditable]:not([contenteditable="false"])'));

  const onKeydown = (e) => { if (isEditableTarget(e.target)) enterState('typing'); };
  const onInput = (e) => { if (isEditableTarget(e.target)) enterState('typing'); };
  const onPointerDown = () => enterState('active');
  const onWheel = () => enterState('active');
  const onDragStart = () => enterState('active');
  const onScroll = () => {
    if (Date.now() - lastTypingAt < TYPING_SCROLL_GUARD_MS) return; // 打字引发的程序滚动
    enterState('active');
  };
  const onWindowBlur = () => goSilent();
  const onVisibilityChange = () => { if (document.hidden) goSilent(); };

  function bindListeners() {
    window.addEventListener('keydown', onKeydown, true);
    window.addEventListener('input', onInput, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function unbindListeners() {
    window.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('input', onInput, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('wheel', onWheel, true);
    window.removeEventListener('dragstart', onDragStart, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  // ===== 挂件挂载 =====

  let boxEl = null;
  let mountObserver = null;

  function renderSticker() {
    const host = document.getElementById('main-panel-root');
    if (!host) return false;
    // 热重载会重复执行脚本，先去重
    document.getElementById(ELEMENT_ID)?.remove();
    const box = document.createElement('div');
    box.id = ELEMENT_ID;
    box.style.width = currentSettings.width + 'px';
    const img = document.createElement('img');
    img.src = currentSrc();
    img.alt = '';
    img.draggable = false;
    box.appendChild(img);
    host.appendChild(box);
    boxEl = box;
    return true;
  }

  async function mountSticker() {
    await loadSettings();
    if (renderSticker()) return;
    // 插件加载可能早于主面板渲染：等 #main-panel-root 出现
    mountObserver = new MutationObserver(() => {
      if (renderSticker()) {
        mountObserver.disconnect();
        mountObserver = null;
      }
    });
    mountObserver.observe(document.body, { childList: true, subtree: true });
  }

  // 设置面板保存后广播，挂件即时更新（换图/调宽不用重启）
  const onSettingsChanged = async () => {
    await loadSettings();
    renderSticker();
  };
  window.addEventListener(SETTINGS_EVENT, onSettingsChanged);

  // 自我清理：停用/卸载插件时宿主只移除 CSS link（plugin-style-<id>），
  // 不执行插件 JS。轮询该样式节点，消失即移除挂件 DOM、解绑监听并停掉定时器。
  const watchdog = setInterval(() => {
    if (!document.getElementById(`plugin-style-${PLUGIN_ID}`)) {
      clearTimeout(idleTimer);
      unbindListeners();
      window.removeEventListener(SETTINGS_EVENT, onSettingsChanged);
      mountObserver?.disconnect();
      mountObserver = null;
      document.getElementById(ELEMENT_ID)?.remove();
      boxEl = null;
      clearInterval(watchdog);
    }
  }, 2000);

  // ===== 设置面板（在设置弹窗的插件弹层中渲染） =====

  const DeskWidgetSettings = {
    name: 'DeskWidgetSettings',
    setup() {
      const images = ref({ ...DEFAULTS.images });
      const width = ref(DEFAULTS.width);
      const hint = ref('');

      onMounted(async () => {
        const s = await loadSettings();
        images.value = { ...s.images };
        width.value = s.width;
      });

      const persist = async () => {
        try {
          await electronAPI.saveModuleData('settings', {
            images: { ...images.value },
            width: width.value
          });
        } catch (e) {
          /* 存储失败不阻断界面 */
        }
        window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
      };

      const onPickFile = (stateKey, e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_IMAGE_BYTES) {
          hint.value = '图片超过 2MB，请换一张更小的图片';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          images.value = { ...images.value, [stateKey]: String(reader.result || '') };
          hint.value = '';
          persist();
        };
        reader.readAsDataURL(file);
      };

      const onReset = (stateKey) => {
        images.value = { ...images.value, [stateKey]: '' };
        hint.value = '';
        persist();
      };

      const onWidthInput = (e) => {
        width.value = parseInt(e.target.value, 10) || DEFAULTS.width;
        persist();
      };

      return { images, width, hint, STATES, DEFAULT_IMAGES, onPickFile, onReset, onWidthInput };
    },
    render() {
      return h('div', { class: 'dw-settings' }, [
        ...this.STATES.map(st =>
          h('div', { class: 'dw-state-row', key: st.key }, [
            h('img', {
              class: 'dw-state-preview',
              src: this.images[st.key] || this.DEFAULT_IMAGES[st.key],
              alt: st.label
            }),
            h('div', { class: 'dw-state-info' }, [
              h('div', { class: 'dw-state-name' },
                `${st.label}${this.images[st.key] ? '（自定义）' : '（默认）'}`),
              h('div', { class: 'dw-state-actions' }, [
                h('label', { class: 'plugin-btn dw-settings-btn' }, [
                  '选择图片',
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    style: 'display:none;',
                    onChange: (e) => this.onPickFile(st.key, e)
                  })
                ]),
                h('button', {
                  class: 'plugin-btn dw-settings-btn',
                  onClick: () => this.onReset(st.key)
                }, '恢复默认')
              ])
            ])
          ])
        ),
        this.hint
          ? h('p', { class: 'dw-settings-hint dw-settings-error' }, this.hint)
          : null,
        h('div', { class: 'dw-settings-group' }, [
          h('div', { class: 'dw-settings-label' }, `挂件宽度：${this.width}px`),
          h('input', {
            type: 'range',
            min: 80,
            max: 240,
            step: 10,
            value: this.width,
            onInput: this.onWidthInput
          })
        ]),
        h('p', { class: 'dw-settings-hint' },
          '贴图固定显示在主面板右下角，鼠标可穿透。输入文字时显示「输入中」，点击/滚动/拖拽显示「操作中」，30 秒无活动回到「静默」。')
      ]);
    }
  };

  // ===== 注册（background：无按钮无面板，注册纳入统一生命周期） =====

  window.registerPluginModule({
    key: PLUGIN_ID,
    label: '桌面挂件',
    icon: '',
    location: 'background',
    // background 无面板，component 仅占位不渲染
    component: { name: 'DeskWidgetStub', render: () => null },
    settingsComponent: DeskWidgetSettings
  });

  mountSticker();
  bindListeners();

  // 调试句柄（CDP/控制台查看状态，测试用）
  window.__deskWidget = {
    state: () => currentState,
    setIdleMs: (ms) => { idleMs = Math.max(200, parseInt(ms, 10) || idleMs); }
  };

  console.log('[DeskWidget] 插件已注册');
})();
