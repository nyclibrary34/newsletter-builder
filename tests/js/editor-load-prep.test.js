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

test('nested <b> inside <p> is NOT re-typed', () => {
  const input = '<p>Hello <b>bold</b> world</p>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const nestedB = doc.querySelector('b');
  assert.equal(nestedB.getAttribute('data-gjs-type'), null, 'nested <b> inside text container must not be typed');
});

test('all six inline tags handled when standalone in <td>', () => {
  const tags = ['b', 'strong', 'i', 'em', 'u', 'strike'];
  tags.forEach((tag) => {
    const input = `<table><tr><td><${tag} id="x">Hello</${tag}></td></tr></table>`;
    const out = makeStandaloneInlineEditable(input);
    const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
    const el = doc.querySelector(tag);
    assert.equal(el.getAttribute('data-gjs-type'), 'text', `<${tag}> must be typed text`);
  });
});

test('preserves existing id and class on retyped element', () => {
  const input = '<div><b id="ihgoz" class="title">Hi</b></div>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const el = doc.querySelector('b');
  assert.equal(el.getAttribute('id'), 'ihgoz');
  assert.equal(el.getAttribute('class'), 'title');
  assert.equal(el.getAttribute('data-gjs-type'), 'text');
});

test('idempotent on already-typed element', () => {
  const input = '<div><b data-gjs-type="text">Hi</b></div>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const el = doc.querySelector('b');
  assert.equal(el.getAttribute('data-gjs-type'), 'text');
});

test('empty or non-string input returned unchanged', () => {
  assert.equal(makeStandaloneInlineEditable(''), '');
  assert.equal(makeStandaloneInlineEditable(null), null);
  assert.equal(makeStandaloneInlineEditable(undefined), undefined);
});

test('standalone <b> inside <h2> gets data-gjs-type="text"', () => {
  const input = '<h2><b id="ihgoz"><p><b id="iz5wc">Update from the Municipal Library</b></p></b></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const outerB = doc.querySelector('b#ihgoz');
  assert.equal(outerB.getAttribute('data-gjs-type'), 'text', 'outer <b> direct child of <h2> must be typed text');
});

test('<h2> without data-gjs-type gets data-gjs-type="text"', () => {
  const input = '<h2><b id="ihgoz"><p><b id="iz5wc">Update from the Municipal Library</b></p></b></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const h2 = doc.querySelector('h2');
  assert.equal(h2.getAttribute('data-gjs-type'), 'text', '<h2> heading must be typed text');
});

test('<h2> with existing data-gjs-type is not overwritten', () => {
  const input = '<h2 data-gjs-type="custom">Special heading</h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const h2 = doc.querySelector('h2');
  assert.equal(h2.getAttribute('data-gjs-type'), 'custom', 'existing type must be respected');
});

test('all six heading levels get data-gjs-type="text"', () => {
  const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  levels.forEach((tag) => {
    const input = `<${tag}>Heading</${tag}>`;
    const out = makeStandaloneInlineEditable(input);
    const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
    const el = doc.querySelector(tag);
    assert.equal(el.getAttribute('data-gjs-type'), 'text', `<${tag}> must be typed text`);
  });
});

test('Feb 2026 Word-exported heading structure becomes editable', () => {
  const input = '<h2 id="id-1e4424d1-4daa-46da-a052-92f91012e58a"><b id="ihgoz"><p id="i92ue" class="MsoNormal"><b id="iz5wc">Update from the <br id="iz6if">Municipal Library &amp; Archives</b></p></b></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const h2 = doc.querySelector('h2');
  assert.equal(h2.getAttribute('data-gjs-type'), 'text', 'the <h2> itself must be typed text');
});

test('inline-in-td regression: standalone <b> in <td> still typed', () => {
  const input = '<table><tr><td><b id="x">Hello</b></td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const b = doc.querySelector('b');
  assert.equal(b.getAttribute('data-gjs-type'), 'text', '<b> in <td> regression');
});
