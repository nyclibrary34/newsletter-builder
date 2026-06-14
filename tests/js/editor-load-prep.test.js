const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const { makeStandaloneInlineEditable } = require('../../static/js/editor-load-prep.js');

test('standalone <b> inside <td> text block is not double-typed', () => {
  const input = '<table><tr><td><b id="ihgoz"><b id="iz5wc">Update from the<br>Municipal Library</b></b></td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const td = doc.querySelector('td');
  const outerB = doc.querySelector('b#ihgoz');
  assert.equal(td.getAttribute('data-gjs-type'), 'text', '<td> is the text block');
  assert.equal(outerB.hasAttribute('data-gjs-type'), false, 'inner <b> not double-typed when parent is text block');
});

test('nested <b> inside <p> is NOT re-typed', () => {
  const input = '<p>Hello <b>bold</b> world</p>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const nestedB = doc.querySelector('b');
  assert.equal(nestedB.getAttribute('data-gjs-type'), null, 'nested <b> inside text container must not be typed');
});

test('all six inline tags in <td> text block not double-typed', () => {
  const tags = ['b', 'strong', 'i', 'em', 'u', 'strike'];
  tags.forEach((tag) => {
    const input = `<table><tr><td id="tdx"><${tag} id="x">Hello</${tag}></td></tr></table>`;
    const out = makeStandaloneInlineEditable(input);
    const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
    const td = doc.querySelector('td');
    const el = doc.querySelector(tag);
    assert.equal(td.getAttribute('data-gjs-type'), 'text', `<td> is the text block`);
    assert.equal(el.hasAttribute('data-gjs-type'), false, `<${tag}> not double-typed inside text block`);
  });
});

test('preserves existing id and class on retyped element', () => {
  // Use a standalone <b> directly in body (not in a text block parent)
  const input = '<body><b id="ihgoz" class="title">Hi</b></body>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`${out}`, 'text/html');
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

test('standalone <b> inside <h2> text block not double-typed', () => {
  const input = '<h2><b id="ihgoz"><p><b id="iz5wc">Update from the Municipal Library</b></p></b></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const h2 = doc.querySelector('h2');
  const outerB = doc.querySelector('b#ihgoz');
  assert.equal(h2.getAttribute('data-gjs-type'), 'text', '<h2> is the text block');
  assert.equal(outerB.hasAttribute('data-gjs-type'), false, 'outer <b> child of <h2> text block not double-typed');
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
  assert.equal(doc.querySelector('h2 p'), null, '<p> block must be unwrapped from inside <h2>');
});

test('standalone inline inside a typed text block is not re-typed', () => {
  // <td> holds only inline content + text -> becomes a text block;
  // the inner <b> must NOT get its own data-gjs-type (parent owns the RTE).
  const input = '<table><tr><td id="cell">Note: <b id="bld">important</b> item</td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#cell').getAttribute('data-gjs-type'), 'text', 'cell is a text block');
  assert.equal(doc.querySelector('#bld').hasAttribute('data-gjs-type'), false, 'inner <b> not re-typed');
});

test('inline-in-td: <td> becomes text block, inner <b> not double-typed', () => {
  const input = '<table><tr><td id="tdx"><b id="x">Hello</b></td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  assert.equal(doc.querySelector('#tdx').getAttribute('data-gjs-type'), 'text', '<td> is the text block');
  assert.equal(doc.querySelector('#x').hasAttribute('data-gjs-type'), false, '<b> inside typed <td> must not be re-typed');
});

test('paragraph with links and strong becomes a single editable text block', () => {
  const input =
    '<p id="p1" class="paragraph">Happy ' +
    '<strong draggable="true" id="s1">National Library Week</strong> visit our ' +
    '<a draggable="true" href="https://example.com" id="a1">research platform</a>.</p>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  const p = doc.querySelector('#p1');
  assert.equal(p.getAttribute('data-gjs-type'), 'text', 'paragraph must be a text block');

  const strong = doc.querySelector('#s1');
  const anchor = doc.querySelector('#a1');
  assert.equal(strong.hasAttribute('draggable'), false, 'draggable stripped from <strong>');
  assert.equal(anchor.hasAttribute('draggable'), false, 'draggable stripped from <a>');
  // ids preserved for style hooks
  assert.equal(anchor.getAttribute('href'), 'https://example.com');
});

test('stale data-gjs-type="default" on inline children is stripped', () => {
  const input =
    '<p id="p2"><b data-gjs-type="default" draggable="true" id="b1">' +
    '<b data-gjs-type="default" id="b2">Update from the</b></b></p>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#p2').getAttribute('data-gjs-type'), 'text');
  assert.equal(doc.querySelector('#b1').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#b2').hasAttribute('data-gjs-type'), false);
});

test('title heading with draggable <br> is editable and br is cleaned', () => {
  const input =
    '<td id="hcell"><h1 id="h1">Municipal Library Notes' +
    '<br draggable="true" id="br1"> April 2026</h1></td>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#h1').getAttribute('data-gjs-type'), 'text');
  assert.equal(doc.querySelector('#br1').hasAttribute('draggable'), false);
});

test('Word-export h2>p>b>b with default-typed children flattens into one editable heading', () => {
  const input =
    '<h2 id="h2"><p class="MsoNormal" data-gjs-type="text" draggable="true" id="p">' +
    '<b data-gjs-type="default" draggable="true" id="b1">' +
    '<b data-gjs-type="default" id="b2">Update from the' +
    '<br data-gjs-type="default" id="br">Municipal Library</b></b></p></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  const h2 = doc.querySelector('#h2');
  assert.equal(h2.getAttribute('data-gjs-type'), 'text', 'h2 is the editable block');
  assert.equal(doc.querySelector('#p'), null, 'inner <p> unwrapped out of the heading');
  assert.equal(doc.querySelector('#b1').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#b2').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#br').hasAttribute('draggable'), false);
  assert.match(h2.textContent, /Update from the/);
});

test('empty spacer paragraph does not throw and becomes a (harmless) text block', () => {
  const out = makeStandaloneInlineEditable('<p id="sp" class="paragraph"></p>');
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');
  assert.equal(doc.querySelector('#sp').getAttribute('data-gjs-type'), 'text');
});
