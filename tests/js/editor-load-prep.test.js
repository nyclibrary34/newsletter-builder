const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const { makeStandaloneInlineEditable } = require('../../static/js/editor-load-prep.js');

test('standalone <b> inside <td> gets data-gjs-type="text"', () => {
  const input = '<table><tr><td><b id="ihgoz"><b id="iz5wc">Update from the<br>Municipal Library</b></b></td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const outerB = doc.querySelector('b#ihgoz');
  assert.equal(outerB.getAttribute('data-gjs-type'), 'text', 'outer standalone <b> must be typed text');
});
