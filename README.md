# closures

This is a fork of [petit-dom](https://github.com/yelouafi/petit-dom) by Yassine Elouafi, but with added "closure components" inspired by [Mithril.js](https://mithril.js.org/components.html#closure-component-state). For more thorough documentation, checkout the README for `petit-dom`. **This is experimental and not well-tested, so I recommend using Mithril.js or Preact instead.**

## Example

[Live Example](https://flems.io/#0=N4IgZglgNgpgziAXAbVAOwIYFsZJAOgAsAXLKEAGhAGMB7NYmBvEAXwvW10QICsEqdBk2J4IWAA60ATsQAEwOYQpzpTACYxpK+gCUYWWgDcYc1nLDTaWOQHJqUWnACuauLYDcAHTQ+wztGpiCHo5AEEJCQAKRQg0CHlWAEoFHzk5AHoMuUdqDCg5OGIMRjkjCAw5BydXeDScmHk6APkAXjk4hO9fNHS1YldeqJTWgD45KPr0wijbdQgjWwop9KVZwgBGJaraFqTl3tXpqIARXYAjWBVFZoYzfZXjgBVpCAkrhR2W+4Oj49tzs5iMR6NtFPQHBBqABrRATEbjW7yADU7Q2ZhUtji1DUOAYtiSK0JhyS3VYPh8WUK4nepjoknoIjgfgCQRCvTOzkuMBiXzuyVSh36gzWtkIACZtki5AAqOTi0k+ck9KlFEowfwFelSNBMlmBYKhF5vWDDQXpIRwWiwfCOADmswAsrthOo5MbaQTuvU9AZjDyzWNzatLdaYLbaA7bABVNCGFowN0e2Be+rJb1Cxoi3nSgVBmZigDMUpd8jlhcVaGVPjUaE00iiMwiEmuHXixDhAFYfnJ1LRqM48cR8OdaOoAJ6kyggOAwWBs+gIHiF8WIAAshYAtAAGRDbtgcECYHB4fDUOACGj0RjMHhsAC6VCgcWhS9QR64eGqLjc09c5B4EhiAkOBECyAIJGhO0z2sDJv1qOAAAFt3wAB2fANgyeYijgxwf3gfAsDifB+GnYhxwkbgZxxN5RFYe9WCAA)

```js
import { h, render, onRemove } from 'closures';

function App({ init }) {
  // local state via closures
  let count = init;

  return () => (
    h('div',
      h('h1', count),
      h(Double, { count }),
      h(Triple, { count }),
      h('button', { onclick: () => count += 1 }, 'increment')
    )
  );
}

// simple components
function Double({ count }) {
  return h('h2', count * 2);
}

// stateful components
function Triple() {
  console.log('Mounted Triple');

  onRemove(() => {
    console.log('Unmounted Triple');
  });

  return ({ count }) => h('h3', count * 3);
}

render(h(App, { init: 5 }), document.body);
```