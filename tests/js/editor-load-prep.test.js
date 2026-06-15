const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const { makeStandaloneInlineEditable, sanitizeExportedHtml } = require('../../static/js/editor-load-prep.js');

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

test('typed inline inside text-only div is normalized to the block owner', () => {
  const input = '<div id="owner"><b id="inline" data-gjs-type="text" draggable="true">Hi</b></div>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  const owner = doc.querySelector('#owner');
  const inline = doc.querySelector('#inline');

  assert.equal(owner.getAttribute('data-gjs-type'), 'text');
  assert.equal(inline.hasAttribute('data-gjs-type'), false);
  assert.equal(inline.hasAttribute('draggable'), false);
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

test('typed inline descendants inside headings are stripped so heading owns editing', () => {
  const input = '<h1 id="title" data-gjs-type="text">Municipal Library Notes <b id="date" data-gjs-type="text" draggable="true">December 2025</b></h1>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  const h1 = doc.querySelector('#title');
  const date = doc.querySelector('#date');
  assert.equal(h1.getAttribute('data-gjs-type'), 'text');
  assert.equal(date.hasAttribute('data-gjs-type'), false);
  assert.equal(date.hasAttribute('draggable'), false);
});

test('default-typed inline descendants are stripped from text blocks', () => {
  const input = '<p id="copy" data-gjs-type="text">Intro <strong id="strong" data-gjs-type="default" draggable="true">bold text</strong> end.</p>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  const copy = doc.querySelector('#copy');
  const strong = doc.querySelector('#strong');
  assert.equal(copy.getAttribute('data-gjs-type'), 'text');
  assert.equal(copy.textContent, 'Intro bold text end.');
  assert.equal(strong.hasAttribute('data-gjs-type'), false);
  assert.equal(strong.hasAttribute('draggable'), false);
});

test('table cell with image keeps paragraph editable without typing the image cell', () => {
  const input =
    '<table><tr>' +
    '<td id="image-cell"><img src="https://example.test/photo.jpg" width="260"></td>' +
    '<td id="text-cell"><p id="copy">Paragraph below or beside image</p></td>' +
    '</tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#image-cell').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#copy').getAttribute('data-gjs-type'), 'text');
});

test('already-typed maybe text block cleans typed inline descendants', () => {
  const input = '<table><tr><td id="cell" data-gjs-type="text">Copy <b id="b" data-gjs-type="text" draggable="true">bold</b></td></tr></table>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  const cell = doc.querySelector('#cell');
  const bold = doc.querySelector('#b');
  assert.equal(cell.getAttribute('data-gjs-type'), 'text');
  assert.equal(bold.hasAttribute('data-gjs-type'), false);
  assert.equal(bold.hasAttribute('draggable'), false);
});

test('stale typed spans in text-only div are stripped so the paragraph block owns editing', () => {
  const input =
    '<div id="copy"><span id="outer"><span id="inner">Intro ' +
    '<br id="br1" data-gjs-type="default" draggable="true">' +
    '<span id="stale" data-gjs-type="text" draggable="true">Body copy</span>' +
    '</span></span></div>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#copy').getAttribute('data-gjs-type'), 'text');
  assert.equal(doc.querySelector('#stale').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#stale').hasAttribute('draggable'), false);
  assert.equal(doc.querySelector('#br1').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#br1').hasAttribute('draggable'), false);
});

test('empty spacer paragraph does not throw and becomes a (harmless) text block', () => {
  const out = makeStandaloneInlineEditable('<p id="sp" class="paragraph"></p>');
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');
  assert.equal(doc.querySelector('#sp').getAttribute('data-gjs-type'), 'text');
});

test('malformed image-caption article table is flattened into editable flow content', () => {
  const input =
    '<table class="image-caption-block" id="bad-caption">' +
    '<tbody><tr>' +
    '<td id="empty-a"></td>' +
    '<td id="empty-b" style="vertical-align: top"></td>' +
    '<td id="real-content" align="center">' +
    '<img id="photo" src="https://example.test/photo.jpg" width="600" style="display:block;width:100%;max-width:600px">' +
    '<table id="empty-nested" class="image-caption-block"><tbody><tr><td></td></tr></tbody></table>' +
    '<p id="body" class="paragraph">By Lauren Gilbert, Director of the Municipal Library. Until 1881, when the Department of Street Cleaning was established, snow removal in New York City fell to the police department.</p>' +
    '</td>' +
    '</tr></tbody>' +
    '</table>';

  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.equal(doc.querySelector('#bad-caption'), null, 'broken wrapper table removed');
  assert.equal(doc.querySelector('#empty-a'), null, 'empty layout cells removed');
  assert.equal(doc.querySelector('#empty-b'), null, 'empty layout cells removed');
  assert.equal(doc.querySelector('#empty-nested'), null, 'empty nested caption tables removed');
  assert.equal(doc.querySelector('#photo').getAttribute('width'), '600', 'image sizing attribute preserved');
  assert.match(doc.querySelector('#photo').getAttribute('style'), /max-width:600px/, 'image sizing style preserved');
  assert.equal(doc.querySelector('#body').getAttribute('data-gjs-type'), 'text', 'article body remains editable text');
  assert.equal(doc.querySelector('#body').closest('td'), null, 'article body no longer trapped in side-column cell');
});

test('short image captions keep their caption table layout', () => {
  const input =
    '<table class="image-caption-block" id="caption">' +
    '<tbody><tr><td align="center">' +
    '<img id="photo" src="https://example.test/photo.jpg" width="300">' +
    '<p id="caption-text">Records storage room.</p>' +
    '</td></tr></tbody>' +
    '</table>';

  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  assert.ok(doc.querySelector('#caption'), 'normal caption table is preserved');
  assert.equal(doc.querySelector('#caption-text').getAttribute('data-gjs-type'), 'text');
});

// --- sanitizeExportedHtml: strip GrapesJS runtime junk on save/export ---

test('sanitizeExportedHtml strips gjs-selected and other gjs- runtime classes', () => {
  const input =
    '<h2 id="h2" data-gjs-type="text"><b class="gjs-selected" id="b1">Update from the</b></h2>' +
    '<div id="d1" class="gjs-hovered keep-me">x</div>';
  const out = sanitizeExportedHtml(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');
  // gjs-selected removed; element no longer carries a class attr (only class was gjs-)
  assert.equal(doc.querySelector('#b1').hasAttribute('class'), false, 'gjs-selected stripped');
  // non-gjs class preserved, gjs- class removed from a mixed list
  assert.equal(doc.querySelector('#d1').getAttribute('class'), 'keep-me', 'only gjs- class removed');
});

test('sanitizeExportedHtml strips data-gjs-type="default" and draggable but keeps "text"', () => {
  const input =
    '<h2 id="h2" data-gjs-type="text" data-gjs-editable="true">' +
    '<b data-gjs-type="default" draggable="true" id="b1">' +
    '<b data-gjs-type="default" id="b2">Update from the' +
    '<br data-gjs-type="default" draggable="true" id="br">Municipal Library</b></b></h2>';
  const out = sanitizeExportedHtml(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');

  // meaningful markers kept
  assert.equal(doc.querySelector('#h2').getAttribute('data-gjs-type'), 'text', 'h2 text marker kept');
  assert.equal(doc.querySelector('#h2').getAttribute('data-gjs-editable'), 'true', 'editable marker kept');
  // runtime junk removed from children
  assert.equal(doc.querySelector('#b1').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#b1').hasAttribute('draggable'), false);
  assert.equal(doc.querySelector('#b2').hasAttribute('data-gjs-type'), false);
  assert.equal(doc.querySelector('#br').hasAttribute('draggable'), false);
});

test('sanitizeExportedHtml preserves content attributes (id, href, src, style, alt)', () => {
  const input =
    '<p id="p1" class="paragraph gjs-selected" style="color:red">Happy ' +
    '<a draggable="true" data-gjs-type="link" href="https://example.com" id="a1">link</a></p>';
  const out = sanitizeExportedHtml(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');
  assert.equal(doc.querySelector('#p1').getAttribute('id'), 'p1');
  assert.equal(doc.querySelector('#p1').getAttribute('style'), 'color:red');
  assert.equal(doc.querySelector('#p1').getAttribute('class'), 'paragraph', 'gjs- removed, content class kept');
  assert.equal(doc.querySelector('#a1').getAttribute('href'), 'https://example.com', 'href preserved');
  assert.equal(doc.querySelector('#a1').hasAttribute('draggable'), false);
  assert.equal(doc.querySelector('#a1').hasAttribute('data-gjs-type'), false, 'non-text gjs type removed');
});

test('sanitizeExportedHtml returns empty/non-string input unchanged', () => {
  assert.equal(sanitizeExportedHtml(''), '');
  assert.equal(sanitizeExportedHtml(null), null);
  assert.equal(sanitizeExportedHtml(undefined), undefined);
});

test('makeStandaloneInlineEditable strips stored gjs-selected so existing files load clean', () => {
  // A previously-saved file baked the editor selection class onto an inner <b>.
  // On load GrapesJS would otherwise adopt it as a real author class and render
  // a broken nested selection box (the reported symptom).
  const input =
    '<h2 id="h2"><b class="gjs-selected" id="b1">Update from the</b></h2>';
  const out = makeStandaloneInlineEditable(input);
  const doc = new DOMParser().parseFromString('<body>' + out + '</body>', 'text/html');
  assert.equal(doc.querySelector('#b1').hasAttribute('class'), false, 'gjs-selected stripped on load');
  assert.equal(doc.querySelector('#h2').getAttribute('data-gjs-type'), 'text', 'h2 still typed text');
});
