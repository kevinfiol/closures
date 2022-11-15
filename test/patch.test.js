import { suite } from 'flitch';
import { strict as assert } from 'assert';
import { Fragment, h, app } from "../index.js";

const test = suite('Patch Tests');

//  Fisher-Yates Shuffle
// code from https://stackoverflow.com/a/6274398/1430627
function shuffle(array) {
  let counter = array.length;

  // While there are elements in the array
  while (counter > 0) {
    // Pick a random index
    let index = Math.floor(Math.random() * counter);

    // Decrease counter by 1
    counter--;

    // And swap the last element with it
    let temp = array[counter];
    array[counter] = array[index];
    array[index] = temp;
  }

  return array;
}

test("DOM node", () => {
  const root = document.createElement("div");

  const node = document.createTextNode("node1");

  let redraw = app(node, root);
  const node1 = root.firstChild;

  node.nodeValue = "node1 new text";

  redraw(node);
  const node2 = root.firstChild;

  assert.equal(node, node1);
  assert.equal(node, node2);
  assert.equal(node.nodeValue, "node1 new text");
});

test("text node", () => {
  const root = document.createElement("div");

  let redraw = app("old text", root);
  const node1 = root.firstChild;

  redraw("new text");
  const node2 = root.firstChild;

  assert.equal(node1, node2);
  assert.equal(node2.nodeValue, "new text");
});

test("patch node with different types", () => {
  const root = document.createElement("div");

  const vnode1 = "old text";
  let redraw = app(vnode1, root);
  const node1 = root.firstChild;

  // see issue #31: Null doesn't remove previous node
  redraw(null);
  const node2 = root.firstChild;

  assert.notEqual(node1, node2);
  assert.equal(node2.nodeType, 8 /* comment node type*/);

  redraw(h("span"));
  const node3 = root.firstChild;

  assert.notEqual(node2, node3);
  assert.equal(node3.tagName, "SPAN");

  redraw(h("div"));
  const node4 = root.firstChild;

  assert.notEqual(node3, node4);
  assert.equal(node4.tagName, "DIV");
});

test("patch props", () => {
  const root = document.createElement("div");

  let redraw = app(
    h("input", {
      type: "text",
      value: "old value",
      style: "color: red",
    }),
    root
  );
  const node = root.firstChild;

  redraw(
    h("input", {
      type: "text",
      value: "new value",
      style: "color: green; border: 1px solid black",
    })
  );
  const node2 = root.firstChild;

  assert.equal(node2, node);
  assert.equal(node.type, "text");
  assert.equal(node.value, "new value");
  assert.equal(node.style.color, "green");
  assert.equal(node.style.border, "1px solid black");
});

test("patch attributes (svg)", () => {
  const root = document.createElement("div");

  let redraw = app(
    h(
      "div",
      {},
      h("span", {}, "..."),
      h("svg", {}, h("circle", { cx: 50, cy: 60, r: 30 })),
      h("span", {}, "...")
    ),
    root
  );
  const node = root.firstChild;

  let svgCircle = node.childNodes[1].firstChild;
  assert.equal(svgCircle.getAttribute("cx"), "50");
  assert.equal(svgCircle.getAttribute("cy"), "60");
  assert.equal(svgCircle.getAttribute("r"), "30");

  const onclick = () => {};
  redraw(
    h(
      "div",
      {},
      h("span", {}, "..."),
      h(
        "svg",
        {},
        h("circle", { cx: 50, cy: 40, stroke: "green", fill: "yellow" })
      ),
      h("span", { onclick }, "...")
    )
  );

  assert.equal(svgCircle.getAttribute("cx"), "50");
  assert.equal(svgCircle.getAttribute("cy"), "40");
  assert.equal(svgCircle.getAttribute("stroke"), "green");
  assert.equal(svgCircle.getAttribute("fill"), "yellow");
  assert.equal(svgCircle.hasAttribute("r"), false);

  // const span = node.childNodes[2];
  // assert.equal(
  //   span.onclick,
  //   onclick,
  //   "should patch props instead of attributes once svg context is off"
  // );
});

test("patch non keyed children", () => {
  const root = document.createElement("div");
  const view = (s) => h("div", {}, s.split(""));

  let node;
  let redraw = app(h("div", {}, "1"), root);
  node = root.firstChild;

  function testPatch(seq, message) {
    redraw(view(seq));
    // assert.plan(seq.length * 2 + 1);

    assert.equal(
      node.childNodes.length,
      seq.length,
      "should have same number of children"
    );
    for (var i = 0; i < seq.length; i++) {
      const text = seq[i];
      const childNode = node.childNodes[i];

      assert.equal(
        childNode.nodeName,
        "#text",
        "child should be a text node"
      );
      assert.equal(childNode.nodeValue, text, "should patch text content");
    }
  }

  testPatch("36", "append to an empty sequence");
  testPatch("3678", "append");
  testPatch("123678", "prepend");
  testPatch("12345678", "insert in the middle");
  testPatch("A0123456789B", "append + prepend");
  testPatch("12345678", "remove from edges");
  testPatch("123678", "remove from middle");
  testPatch("2x3y67z8", "multiple modificationq");
  testPatch(shuffle("2x3y67z8".split("")).join(""), "shuffle");
  testPatch("ABCDEF", "replace all");

  redraw(view(""));
  assert.equal(node.childNodes.length, 1, "should contain one empty node");
  assert.equal(node.firstChild.nodeType, 8, "empty child should be a comment");
});

test("patch keyed children", () => {
  const root = document.createElement("div");
  const view = (str) =>
    h(
      "div",
      {},
      str.split("").map((c) => h("span", { key: c }, c))
    );

  let redraw = app(h("div"), root);

  let node = root.firstChild,
    prevChildNodes = Array.from(node.childNodes),
    prevSeq = "";

  function testPatch(seq, message) {
    redraw(view(seq));
    let childNodes = Array.from(node.childNodes);

    // assert.plan(seq.length * 2 + 1);
    assert.equal(childNodes.length, seq.length);

    for (var i = 0; i < seq.length; i++) {
      const text = seq[i];

      const index = prevSeq.indexOf(text);
      if (index >= 0) {
        assert.equal(
          prevChildNodes[index],
          childNodes[i],
          "should preserve DOM node for " + text
        );
      } else {
        assert.ok(true, "new node " + text);
      }
      assert.equal(
        childNodes[i].firstChild.nodeValue,
        text,
        "should patch text content"
      );
    }
    prevSeq = seq;
    prevChildNodes = childNodes;
    //
  }

  testPatch("36", "append to an empty sequence");
  testPatch("3678", "append");
  testPatch("7836", "reorder");
  testPatch("3678", "reorde(2)");
  testPatch("123678", "prepend");
  testPatch("12345678", "insert in the middle");
  testPatch("A0123456789B", "append + prepend");
  testPatch("12345678", "remove from edges");
  testPatch("123678", "remove from middle");
  testPatch("2x6y37z8", "multiple modifications");
  testPatch(shuffle("2x6y37z8".split("")).join(""), "shuffle");
  testPatch("ABCDEF", "replace all");

  redraw(view(""));
  assert.equal(node.childNodes.length, 1, "should contain one empty node");
  assert.equal(node.firstChild.nodeType, 8, "empty child should be a comment");
});

test("patch fragments", () => {
  const root = document.createElement("div");

  const seq = (str, num) => {
    return h(
      Fragment,
      { key: num },
      str.split("").map((s) => h("span", { key: s, class: `seq-${num}` }, s))
    );
  };

  const view = (str) => {
    return h("div", {}, "first text", seq(str), seq(str), "last text");
  };

  const getChildNodes = (seq) => {
    const childNodes = Array.from(root.firstChild.childNodes);
    return [
      childNodes.slice(1, seq.length + 1),
      childNodes.slice(seq.length + 1, 2 * seq.length + 1),
    ];
  };

  let redraw = app(h("div"), root);

  let prevChildNodes = getChildNodes("");
  let prevSeq = "";

  function matchSeq(seq, prevSeq, childNodes, prevChildNodes, message) {
    // assert.plan(seq.length * 2 + 1);

    assert.equal(childNodes.length, seq.length);

    for (var i = 0; i < seq.length; i++) {
      const text = seq[i];

      const index = prevSeq.indexOf(text);
      if (index >= 0) {
        assert.equal(
          prevChildNodes[index],
          childNodes[i],
          "should preserve DOM node for " + text
        );
      } else {
        assert.ok(true, "new node");
      }
      assert.equal(
        childNodes[i].firstChild.nodeValue,
        text,
        "should patch text content for " + text
      );
    }
  }

  function testPatch(seq, message) {
    redraw(view(seq));
    let childNodes = getChildNodes(seq);
    matchSeq(
      seq,
      prevSeq,
      childNodes[0],
      prevChildNodes[0],
      `${message} - seq-1`
    );
    matchSeq(
      seq,
      prevSeq,
      childNodes[1],
      prevChildNodes[1],
      `${message} - seq-2`
    );
    prevChildNodes = childNodes;
    prevSeq = seq;
  }

  testPatch("36", "append to an empty sequence");
  testPatch("3678", "append");
  testPatch("7836", "reorder");
  testPatch("3678", "reorde(2)");
  testPatch("123678", "prepend");
  testPatch("12345678", "insert in the middle");
  testPatch("A0123456789B", "append + prepend");
  testPatch("12345678", "remove from edges");
  testPatch("123678", "remove from middle");
  testPatch("2x6y37z8", "multiple modifications");
  testPatch(shuffle("2x6y37z8".split("")).join(""), "shuffle");
  testPatch("ABCDEF", "replace all");
});

test("patch render functions", () => {
  // let renderCalls = 0;
  const root = document.createElement("div");

  function Box(props) {
    //renderCalls++;
    return h("h1", { title: props.title }, props.children);
  }

  let redraw = app(h(Box, { title: "box title" }, "box content"), root);
  const node = root.firstChild; // renderCalls = 1

  redraw(h(Box, { title: "another box title" }, "another box content"));
  // renderCalls = 2
  assert.equal(node.title, "another box title");
  assert.equal(node.firstChild.nodeValue, "another box content");
  /*
  const vnode3 = h(Box, { title: "another box title" }, "another box content");
  patch(vnode3, vnode2); // // renderCalls = 2
  assert.equal(
    renderCalls,
    2,
    "patch should not invoke render function if props & content have not changed"
  );

  assert.equal(node.title, "another box title");
  assert.equal(node.firstChild.nodeValue, "another box content");
    */
});

// TODO: replace these with closure component testcases
test.skip("Patch Component/sync rendering", () => {
  const root = document.createElement("div");

  const MyComponent = {
    mount: (me) => {
      me.app(me.props.prop);
    },
    patch: (me) => {
      me.app(me.props.prop + me.oldProps.prop);
    },
    unmount: () => {},
  };

  app(h(MyComponent, { prop: "prop1" }), root);
  const node = root.firstChild;
  assert.equal(node.nodeValue, "prop1");

  app(h(MyComponent, { prop: "prop2" }), root);

  assert.equal(node.nodeValue, "prop2prop1");
});

test.skip("Patch Component/async rendering", async () => {
  const root = document.createElement("div");

  let p = new Promise((resolve) => setTimeout(resolve, 0));
  const MyComponent = {
    mount: (me) => {
      me.app(me.props.prop);
    },
    patch: (me) => {
      p = p.then(() => {
        me.app(me.props.prop + me.oldProps.prop);
      });
    },
    unmount: () => {},
  };

  app(h(MyComponent, { prop: "prop1" }), root);

  app(h(MyComponent, { prop: "prop2" }), root);

  assert.equal(root.firstChild.nodeValue, "prop1");
  await p.then(() => {
    assert.equal(root.firstChild.nodeValue, "prop2prop1");
  });
});

test("issues #24: applyDiff fails to insert when oldChildren is modified", () => {
  const root = document.createElement("div");

  let redraw = app(
    h("div", {}, [
      h("p", null, "p"),
      h("div", { key: "x" }, "div"),
      h("pre", null, "pre"),
      h("code", null, "code"),
    ]),
    root
  );
  //const node = root.firstChild

  redraw(
    h("div", {}, [
      h("pre", null, "pre"),
      h("code", null, "code"),
      h("div", { key: "x" }, "div"),
      h("p", null, "p"),
    ])
  );
});

test("issues #25: applyDiff fails with empty strings", () => {
  const root = document.createElement("div");
  let redraw = app(
    h("div", {}, [
      h("p", null, "p"),
      "",
      h("pre", null, "pre"),
      h("code", null, "code"),
    ]),
    root
  );
  //const node = root.firstChild

  redraw(
    h("div", {}, [
      h("pre", null, "pre"),
      h("code", null, "code"),
      "",
      h("p", null, "p"),
    ])
  );
});

test("issues #26: applyDiff fails with blank strings", () => {
  const root = document.createElement("root");
  let redraw = app(
    h("div", {}, [
      h("p", null, "p"),
      " ",
      h("pre", null, "pre"),
      h("code", null, "code"),
    ]),
    root
  );

  redraw(
    h("div", {}, [
      h("pre", null, "pre"),
      h("code", null, "code"),
      " ",
      h("p", null, "p"),
    ])
  );
});

test("issues #27: New DOM-tree is not synced with vdom-tree", () => {
  const root = document.createElement("div");
  let redraw = app(
    h("div", {}, [
      h("p", {}, [
        "Text",
        h("code", {}, ["Text"]),
        "Text",
        h("code", {}, ["Text"]),
        "Text",
      ]),
      h("div", {}, []),
    ]),
    root
  );

  const vnode = h("div", {}, [
    h("p", {}, [h("a", {}, ["Text"])]),
    "Text",
    h("p", {}, [h("a", {}, ["Text"])]),
    "Text",
    h("p", {}, ["Text", h("a", {}, ["Text"]), "Text"]),
    h("div", {}, []),
  ]);
  redraw(vnode);
  const node = root.firstChild;

  function checkSimlilarity(vdomNode, domnode) {
    if (domnode.nodeType === 3) {
      assert.equal(domnode.textContent, vdomNode, "Text should be the same");
      return;
    }
    if (
      vdomNode.props.children == null ||
      vdomNode.props.children.length === 0
    ) {
      assert.equal(domnode.textContent, "", "Dom content should be empty");
      return;
    }

    assert.equal(
      domnode.childNodes.length,
      vdomNode.props.children.length,
      "Children length should match"
    );
    assert.equal(
      domnode.tagName.toLowerCase(),
      vdomNode._t.toLowerCase(),
      "Tag names should match"
    );
    for (let i = 0; i < vdomNode.props.children.length; i++) {
      checkSimlilarity(vdomNode.props.children[i], domnode.childNodes[i]);
    }
  }

  checkSimlilarity(vnode, node);
});
