import jsdom from 'jsdom';
import { run } from 'flitch';

// setup
const { JSDOM } = jsdom;
const { document, Node } = new JSDOM(`<!DOCTYPE html><body></body>`).window;

global.document = document;
global.Node = Node;

// run tests
run({ path: './test' });