#!/usr/bin/env node
/**
 * Utility to run the client-side export processor in Node via JSDOM.
 * Requires `npm install jsdom` in the repository root.
 */

const fs = require('fs');
const path = require('path');

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

const inputArg = getArg('--input');
if (!inputArg) {
  console.error('Usage: node scripts/process_export_with_jsdom.js --input <path> [--output <path>]');
  process.exit(1);
}

const outputArg = getArg('--output');
const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = outputArg
  ? path.resolve(process.cwd(), outputArg)
  : path.join(path.dirname(inputPath), `processed_${path.basename(inputPath)}`);

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');

global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.navigator = dom.window.navigator;

const processor = require('../static/js/html-processor.js');
const rawHtml = fs.readFileSync(inputPath, 'utf8');
const processedHtml = processor.processHTML(rawHtml);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, processedHtml, 'utf8');
console.log(`Processed export saved to ${outputPath}`);
