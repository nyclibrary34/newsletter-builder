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
