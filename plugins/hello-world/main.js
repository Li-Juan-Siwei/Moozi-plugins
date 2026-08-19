(function() {
  'use strict';

  const { h, ref } = window.Vue;

  const HelloWorld = {
    name: 'HelloWorld',
    setup() {
      const count = ref(0);
      return { count };
    },
    render() {
      return h('div', { class: 'hello-world-plugin' }, [
        h('h3', { style: 'margin:0 0 12px 0;' }, '\uD83D\uDC4B Hello World \u5916\u90E8\u63D2\u4EF6'),
        h('p', { style: 'margin:0 0 12px 0;color:var(--text-secondary);' },
          '\u8FD9\u662F\u4E00\u4E2A\u5916\u90E8\u63D2\u4EF6\u793A\u4F8B\uFF0C\u6F14\u793A\u7B2C\u4E09\u65B9\u63D2\u4EF6\u7CFB\u7EDF\u5982\u4F55\u5DE5\u4F5C\u3002'),
        h('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
          h('span', {}, `\u70B9\u51FB\u6B21\u6570: ${this.count}`),
          h('button', {
            class: 'plugin-btn',
            onClick: () => this.count++
          }, '+1')
        ])
      ]);
    }
  };

  window.registerPluginModule({
    key: 'hello-world',
    label: 'Hello World',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
    component: HelloWorld
  });

  console.log('[HelloWorld] \u63D2\u4EF6\u5DF2\u6CE8\u518C');
})();
