import { suite } from 'flitch';
import { strict as assert } from 'assert';
import { h, app } from "../index.js";

const test = suite('Range Tests');

test("range input", () => {
  const root = document.createElement("div");
  let rerender = app(
    h("input", {
      value: "0.5",
      type: "range",
      min: "0",
      max: "1",
      step: "0.05",
    }),
    root
  );

  const node = root.firstChild;

  assert.equal(node.value, "0.5", "range value should be 0.5");

  rerender(
    h("input", {
      value: "1.5",
      type: "range",
      min: "0",
      max: "2",
      step: "0.05",
    })
  );

  assert.equal(node.value, "1.5", "range value should be 1.5");
});
