import { suite } from 'flitch';
import { strict as assert } from 'assert';
import { h, app } from "../index.js";

const test = suite('Mount Tests');

test("DOM node", () => {
  const root = document.createElement("div");
  const vnode = document.createTextNode("dom node");

  app(vnode, root);
  assert.equal(root.firstChild, vnode);
});

test("text node", () => {
  const root = document.createElement("div");
  app("raw text", root);
  let node = root.firstChild;

  assert.equal(node.nodeName, "#text");
  assert.equal(node.nodeValue, "raw text");
});

test("simple element", () => {
  const root = document.createElement("div");
  const vnode = h(
    "span",
    // JSDOM bug?
    { /*"data-type": "span",*/ class: "input", style: "color: red" },
    "span content"
  );
  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.nodeName, "SPAN");
  //assert.equal(node.dataset.type, "span");
  assert.equal(node.className, "input");
  assert.equal(node.style.color, "red");
  assert.equal(node.childNodes.length, 1);
  assert.equal(node.firstChild.nodeValue, "span content");
});

test("simple element without children", () => {
  const root = document.createElement("div");

  const vnode = h("input", { type: "text" });

  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.nodeName, "INPUT");
  assert.equal(node.type, "text");
  assert.equal(node.childNodes.length, 0);
});

test("element with multiple children", () => {
  const root = document.createElement("div");

  const vnode = h(
    "div",
    {},
    h("span", {}, "span text"),
    h("input", { type: "number" }),
    "raw text"
  );

  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.nodeName, "DIV");
  assert.equal(node.childNodes.length, 3);

  const span = node.childNodes[0];
  assert.equal(span.nodeName, "SPAN");
  assert.equal(span.childNodes.length, 1);
  assert.equal(span.firstChild.nodeValue, "span text");

  const input = node.childNodes[1];
  assert.equal(input.nodeName, "INPUT");
  assert.equal(input.childNodes.length, 0);
  assert.equal(input.type, "number");

  const text = node.childNodes[2];
  assert.equal(text.nodeName, "#text");
  assert.equal(text.nodeValue, "raw text");
});

test("element with nested array", () => {
  const root = document.createElement("div");

  const vnode = h(
    "div",
    {},
    h("span", {}, ["span text"]),
    [h("input", { type: "number" }), ["nested text"]],
    "raw text"
  );

  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.nodeName, "DIV");
  assert.equal(node.childNodes.length, 4);

  const span = node.childNodes[0];
  assert.equal(span.nodeName, "SPAN");
  assert.equal(span.childNodes.length, 1);
  assert.equal(span.firstChild.nodeValue, "span text");

  const input = node.childNodes[1];
  assert.equal(input.nodeName, "INPUT");
  assert.equal(input.childNodes.length, 0);
  assert.equal(input.type, "number");

  const text1 = node.childNodes[2];
  assert.equal(text1.nodeName, "#text");
  assert.equal(text1.nodeValue, "nested text");

  const text2 = node.childNodes[3];
  assert.equal(text2.nodeName, "#text");
  assert.equal(text2.nodeValue, "raw text");
});

test("render functions", () => {
  const root = document.createElement("div");

  function Box(props) {
    return h("h1", { title: props.title }, props.children);
  }

  const vnode = h(Box, { title: "box title" }, "box content");

  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.nodeName, "H1");
  assert.equal(node.title, "box title");
  assert.equal(node.childNodes.length, 1);
  assert.equal(node.firstChild.nodeValue, "box content");
});

// TODO: refactor component testcases to use closures
test.skip("Component/sync rendering", () => {
  const root = document.createElement("div");

  const MyComponent = {
    mount(me) {
      me.app(me.props.some_prop);
    },
  };

  const props = { some_prop: "some_prop" };
  const vnode = h(MyComponent, props);

  app(vnode, root);
  const node = root.firstChild;
  assert.equal(node.nodeValue, props.some_prop);
});

test.skip("Mount Component/async rendering", async () => {
  const root = document.createElement("div");

  let p = new Promise((resolve) => setTimeout(resolve, 0));
  const MyComponent = {
    mount: (me) => {
      p = p.then(() => {
        me.app(me.props.prop);
      }, 0);
    },
  };

  app(h(MyComponent, { prop: "prop1" }), root);

  assert.equal(root.firstChild.nodeType, 8 /* comment node */);

  await p.then(() => {
    assert.equal(root.firstChild.nodeValue, "prop1");
  });
});

test.skip("svg elements", () => {
  const root = document.createElement("div");

  const onclick = () => {};

  const vnode = h(
    "div",
    {},
    h("span", {}, "..."),
    h(
      "svg",
      { width: 100, height: 200 },
      h("circle", { cx: 50, cy: 60, r: 40 }),
      h("a", { href: "/link", show: "/link2", actuate: "/link3" })
    ),
    h("span", { onclick }, "...")
  );

  app(vnode, root);
  const node = root.firstChild;

  assert.equal(node.childNodes.length, 3);

  const svgNode = node.childNodes[1];
  assert.equal(svgNode.nodeName, "svg");
  assert.equal(svgNode.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(svgNode.getAttribute("width"), "100");
  assert.equal(svgNode.getAttribute("height"), "200");
  assert.equal(svgNode.childNodes.length, 2);

  const svgCircle = svgNode.childNodes[0];
  assert.equal(svgCircle.nodeName, "circle");
  assert.equal(svgCircle.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(svgCircle.getAttribute("cx"), "50");
  assert.equal(svgCircle.getAttribute("cy"), "60");
  assert.equal(svgCircle.getAttribute("r"), "40");

  const svgA = svgNode.childNodes[1];
  assert.equal(svgA.nodeName, "a");
  assert.equal(svgA.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(
    svgA.getAttributeNS("http://www.w3.org/1999/xlink", "href"),
    "/link"
  );
  assert.equal(
    svgA.getAttributeNS("http://www.w3.org/1999/xlink", "show"),
    "/link2"
  );
  assert.equal(
    svgA.getAttributeNS("http://www.w3.org/1999/xlink", "actuate"),
    "/link3"
  );

  // TO-DO: this might be because the `onclick` function is recreated
  // const span = node.childNodes[2];
  // assert.equal(
  //   span.onclick,
  //   onclick,
  //   "should set props instead of attrs once svg context is off"
  // );
});
