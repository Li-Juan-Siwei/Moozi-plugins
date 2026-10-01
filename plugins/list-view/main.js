(function () {
  'use strict';

  /**
   * 列表视图：后台增强插件（location: 'background'，无按钮无面板）。
   * 原理：宿主把视图类型存在 run（同一父容器内连续 flatListItem 兄弟）首项的
   * view 属性上（DOM 表现为 data-list-view，随卡片 JSON 持久化、可撤销）；
   * 本插件只做两件事——用 MutationObserver 给锚点及 run 成员打 lv-* class，
   * 全部视图渲染交给 style.css。文档结构与编辑能力完全不变，停用插件即恢复普通列表。
   *
   * 门控（data-list-view-plugin，DragHandle 块菜单据此显示入口）：
   * 以样式元素 plugin-style-list-view 是否在场为准，refresh 时同步——自愈且
   * 随停用/卸载（宿主移除样式元素）自动撤除，无需监听事件。
   */
  const PLUGIN_ID = 'list-view';
  const EVENT_SET = 'list-view-set';
  const VIEWS = ['mindmap', 'kanban', 'table', 'timeline'];
  const LV_CLASSES = ['lv-root', 'lv-item'].concat(VIEWS.map((v) => 'lv-' + v));

  function syncGate() {
    const active = !!document.getElementById('plugin-style-' + PLUGIN_ID);
    if (active) document.documentElement.setAttribute('data-list-view-plugin', '');
    else document.documentElement.removeAttribute('data-list-view-plugin');
  }

  // ===== run 成员计算与 class 同步 =====

  function isFlatListItem(el) {
    return el && el.nodeType === 1 && el.classList.contains('flat-list-item');
  }

  function refresh() {
    syncGate();
    // 先清旧 class（run 缩小/还原/视图切换都会留下残留）
    document.querySelectorAll('.flat-list-item.lv-item').forEach((el) => {
      el.classList.remove.apply(el.classList, LV_CLASSES);
    });
    // 每个锚点（data-list-view）向前后扩展出 run，给成员打 class
    const done = new Set();
    document.querySelectorAll('.flat-list-item[data-list-view]').forEach((anchor) => {
      if (done.has(anchor)) return;
      const view = anchor.getAttribute('data-list-view');
      if (!VIEWS.includes(view)) return;
      // 防御：锚点正常应在 run 首项，但旧数据/手工编辑可能在中部——向前走到 run 起点
      let first = anchor;
      while (isFlatListItem(first.previousElementSibling)) {
        first = first.previousElementSibling;
      }
      for (let el = first; isFlatListItem(el); el = el.nextElementSibling) {
        done.add(el);
        el.classList.add('lv-item', 'lv-' + view);
        if (el === first) el.classList.add('lv-root');
      }
    });
  }

  // observer 回调里同步执行：后台/遮挡窗口下 setTimeout/setInterval 会被
  // Chrome 节流（实测 refresh 被钳到 ~20s 一次），而 MutationObserver 回调
  // 走微任务、不受节流影响；也不做防抖重排——编辑器活跃时 DOM 变动连绵不断，
  // 「每次变动都重排」会被无限推迟（实测 refresh 被饿死）。
  // 快速通路：无锚点且无已标记成员时，只同步门控就返回，避免打字风暴期全量扫描
  function guardedRefresh() {
    if (
      !document.querySelector('.flat-list-item[data-list-view]') &&
      !document.querySelector('.flat-list-item.lv-item')
    ) {
      syncGate();
      return;
    }
    refresh();
  }

  const observer = new MutationObserver(guardedRefresh);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-list-view']
  });
  refresh();

  // 兜底周期（后台节流时仅 ~1/min，主要覆盖 observer 漏报/热重载场景）
  setInterval(refresh, 2000);

  // ===== 注册（background：无按钮无面板，纳入统一生命周期） =====

  window.registerPluginModule({
    key: PLUGIN_ID,
    label: '列表视图',
    icon: '',
    location: 'background',
    component: { name: 'ListViewStub', render: () => null }
  });

  // ===== Ctrl+K 命令（经 window 事件桥交给宿主最近聚焦的编辑器执行） =====

  if (window.registerPluginCommand) {
    const CMDS = [
      { key: 'to-mindmap', label: '列表视图：转为思维导图', view: 'mindmap', keywords: 'siweidaotu mindmap swdt' },
      { key: 'to-kanban', label: '列表视图：转为看板', view: 'kanban', keywords: 'kanban kb' },
      { key: 'to-table', label: '列表视图：转为表格', view: 'table', keywords: 'biaoge table bg' },
      { key: 'to-timeline', label: '列表视图：转为时间线', view: 'timeline', keywords: 'shijianxian timeline sjx' },
      { key: 'to-list', label: '列表视图：还原为列表', view: null, keywords: 'liebiao list lb' }
    ];
    for (const c of CMDS) {
      window.registerPluginCommand({
        key: c.key,
        label: c.label,
        keywords: c.keywords,
        group: '列表视图',
        run: () => {
          window.dispatchEvent(new CustomEvent(EVENT_SET, { detail: { view: c.view } }));
        }
      });
    }
  }

  console.log('[ListView] 插件已注册');
})();
