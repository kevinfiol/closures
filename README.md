# closures

This is a fork of [petit-dom](https://github.com/yelouafi/petit-dom) by Yassine Elouafi, but with object components replaced with "closure components" inspired by [Mithril.js](https://mithril.js.org/components.html#closure-component-state).

```js
const { h, app, onRemove } = closures;

function App() {
  return (
    h('div.monospace',
      h('h1', 'A simple app'),
      h(Counter, { initialCount: 0 })
    )
  );
}

// simple components
function Double({ count }) {
  return h('h2', count * 2);
}

// stateful components
function Counter({ initialCount }) {
  let count = initialCount;

  onRemove(() => {
    console.log('Unmounted Counter');
  });

  return () => [
    h('h2', count),
    h('h3', 'doubled:'),
    h(Double, { count }),
    h('button', { onclick: () => count += 1 }, 'increment')
  ];
}

app(h(App), document.body);
```

## Install

```bash
npm install closures
```

## Examples

[Counter](https://keb.url.lol/flems-3-3-2023-0e4393)

[Todo List](https://keb.url.lol/flems-3-3-2023-405d28)

[Async](https://keb.url.lol/flems-3-3-2023-bc6b52)
