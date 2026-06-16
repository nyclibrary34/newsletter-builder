const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

// Setup jsdom globals
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.navigator = dom.window.navigator;

const processor = require('../../static/js/html-processor.js');

function wrap(bodyHtml) {
  return `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`;
}

function outputDoc(bodyHtml) {
  return new JSDOM(processor.processHTML(wrap(bodyHtml))).window.document;
}

test('content image preserves explicit max-width instead of broad 100 percent rewrite', () => {
  const doc = outputDoc(
    '<table><tr><td align="center"><img src="https://www.nyc.gov/photo.jpg" alt="Newsletter image" width="600" style="display:block; width:100%; max-width:600px; margin:0 auto 8px;"></td></tr></table>'
  );
  const img = doc.querySelector('img');
  const style = img.getAttribute('style') || '';

  assert.equal(img.getAttribute('src'), 'https://www.nyc.gov/photo.jpg');
  assert.equal(img.getAttribute('width'), '600');
  assert.match(style, /max-width:\s*600px/i);
  assert.doesNotMatch(style, /max-width:\s*100%/i);
});

test('feature image preserves 260px max-width and does not resize to full email width', () => {
  const doc = outputDoc(
    '<table><tr><td width="40%" align="center">' +
    '<img src="https://www.nyc.gov/feature.jpg" alt="Feature image" width="260" style="display:block; width:100%; max-width:260px; margin:0 auto;">' +
    '</td><td width="60%"><p>Paragraph below or beside image</p></td></tr></table>'
  );
  const img = doc.querySelector('img');
  const paragraph = doc.querySelector('p');
  const style = img.getAttribute('style') || '';

  assert.equal(img.getAttribute('width'), '260');
  assert.match(style, /max-width:\s*260px/i);
  assert.equal(paragraph.getAttribute('data-gjs-type'), 'text');
});

test('social icon images keep inline-block display', () => {
  const doc = outputDoc(
    '<p><a href="https://www.facebook.com/nycrecords" style="display:inline-block !important">' +
    '<img alt="Facebook" src="https://www1.nyc.gov/assets/home/images/agencies/social/fb-50x50.png" width="42" height="42" style="display:inline-block !important; height:auto;">' +
    '</a></p>'
  );
  const link = doc.querySelector('a');
  const img = doc.querySelector('img');
  const linkStyle = link.getAttribute('style') || '';
  const imgStyle = img.getAttribute('style') || '';

  assert.match(linkStyle, /display:\s*inline-block/i);
  assert.match(imgStyle, /display:\s*inline-block/i);
  assert.doesNotMatch(imgStyle, /display:\s*block/i);
});

test('non-social image without pixel sizing does not receive arbitrary email width', () => {
  const doc = outputDoc(
    '<img src="https://www.nyc.gov/no-width.jpg" style="height:auto;">'
  );
  const img = doc.querySelector('img');

  assert.notEqual(img.getAttribute('width'), '600');
});

test('font-family:inherit resolves to ancestor inline font', () => {
  const out = processor.processHTML(wrap(
    '<div style="font-family: Arial"><span style="font-family: inherit">text</span></div>'
  ));
  assert(!out.includes('font-family: inherit'));
  assert(out.includes('font-family: Arial'));
});

test('font-family:inherit without styled ancestor falls back to Arial', () => {
  const out = processor.processHTML(wrap(
    '<span style="font-family: inherit">text</span>'
  ));
  assert(!out.includes('font-family: inherit'));
  assert(out.includes('font-family: Arial'));
});

test('font-size:inherit resolves to ancestor inline value', () => {
  const out = processor.processHTML(wrap(
    '<div style="font-size: 16px"><p style="font-size: inherit">text</p></div>'
  ));
  assert(!out.includes('font-size: inherit'));
  assert(out.includes('font-size: 16px'));
});

test('font-size:inherit without styled ancestor falls back to 16px', () => {
  const out = processor.processHTML(wrap(
    '<p style="font-size: inherit">text</p>'
  ));
  assert(!out.includes('font-size: inherit'));
  assert(out.includes('font-size: 16px'), 'fallback font-size should be 16px');
});

test('color:inherit resolves to ancestor inline color', () => {
  const out = processor.processHTML(wrap(
    '<div style="color: #333"><span style="color: inherit">text</span></div>'
  ));
  assert(!out.includes('color: inherit'));
  assert(out.includes('color: #333'));
});

test('preserves non-inherit typography values', () => {
  const out = processor.processHTML(wrap(
    '<span style="font-family: Verdana; color: blue">text</span>'
  ));
  assert(out.includes('font-family: Verdana'));
  assert(out.includes('color: blue'));
  assert(!out.includes('font-family: inherit'));
  assert(!out.includes('color: inherit'));
});

test('color:inherit without styled ancestor falls back to #111111', () => {
  const out = processor.processHTML(wrap(
    '<p style="color: inherit">text</p>'
  ));
  assert(!out.includes('color: inherit'));
  assert(out.includes('color: #111111'), 'fallback color should be #111111');
});

test('line-height:inherit resolves to ancestor inline value', () => {
  const out = processor.processHTML(wrap(
    '<div style="line-height: 2"><p style="line-height: inherit">text</p></div>'
  ));
  assert(!out.includes('line-height: inherit'));
  assert(out.includes('line-height: 2'));
});

test('line-height:inherit without styled ancestor falls back to 1.65', () => {
  const out = processor.processHTML(wrap(
    '<p style="line-height: inherit">text</p>'
  ));
  assert(!out.includes('line-height: inherit'));
  assert(out.includes('line-height: 1.65'), 'fallback line-height should be 1.65');
});

test('p and h3 without font-family get explicit Arial inline', () => {
  const out = processor.processHTML(wrap(
    '<table><tr><td><h3 style="margin:0;">Title</h3>' +
    '<p style="margin:0;">Body text</p></td></tr></table>'
  ));
  const pMatch = out.match(/<p[^>]*style="([^"]*)"/i);
  const hMatch = out.match(/<h3[^>]*style="([^"]*)"/i);
  assert.ok(pMatch && /font-family/i.test(pMatch[1]), 'p needs inline font-family');
  assert.ok(hMatch && /font-family/i.test(hMatch[1]), 'h3 needs inline font-family');
});

test('li without font-family gets explicit Arial inline', () => {
  const out = processor.processHTML(wrap(
    '<ul><li style="margin:0;">List item</li></ul>'
  ));
  const liMatch = out.match(/<li[^>]*style="([^"]*)"/i);
  assert.ok(liMatch && /font-family/i.test(liMatch[1]), 'li needs inline font-family');
});

test('blockquote without font-family gets explicit Arial inline', () => {
  const out = processor.processHTML(wrap(
    '<blockquote style="margin:0;">Quote text</blockquote>'
  ));
  const bqMatch = out.match(/<blockquote[^>]*style="([^"]*)"/i);
  assert.ok(bqMatch && /font-family/i.test(bqMatch[1]), 'blockquote needs inline font-family');
});

test('text elements with existing font-family not overwritten', () => {
  const out = processor.processHTML(wrap(
    '<p style="font-family:Georgia;">Text with Georgia</p>'
  ));
  const pMatch = out.match(/<p[^>]*style="([^"]*)"/i);
  assert.ok(pMatch, 'p tag should have style attribute');
  const styleContent = pMatch[1];
  assert(styleContent.includes('Georgia'), 'p style should preserve Georgia');
  assert(!styleContent.includes('Arial'), 'p style should not add Arial');
});

test('p with font-family in complex style preserves other properties', () => {
  const out = processor.processHTML(wrap(
    '<p style="color:red;margin:0;">Red text</p>'
  ));
  const pMatch = out.match(/<p[^>]*style="([^"]*)"/i);
  assert.ok(pMatch && /font-family/i.test(pMatch[1]), 'p should have font-family');
  assert.ok(pMatch && /color/i.test(pMatch[1]), 'should preserve color property');
});

test('ensureMsoFontFallback adds MSO conditional comment to head', () => {
  const out = processor.processHTML(wrap(
    '<p>Test</p>'
  ));
  assert(out.includes('[if mso]'), 'should contain MSO conditional start');
  assert(out.includes('data-mso-font-fallback'), 'should have mso-font-fallback marker');
  assert(out.includes('font-family: Arial'), 'should set font-family to Arial in MSO style');
  assert(out.includes('<![endif]'), 'should have MSO conditional end');
});

test('ensureMsoFontFallback is idempotent (no duplicate if already present)', () => {
  const out = processor.processHTML(wrap(
    '<p>Test</p>'
  ));
  // Count occurrences of the marker
  const count = (out.match(/data-mso-font-fallback/g) || []).length;
  assert.equal(count, 1, 'MSO fallback should appear exactly once');
});

test('ensureMsoFontFallback targets correct elements', () => {
  const out = processor.processHTML(wrap(
    '<p>Test</p>'
  ));
  assert(out.includes('body, table, td, p, h1, h2, h3, h4, h5, h6, li, a, span'),
    'should target all email elements');
});
