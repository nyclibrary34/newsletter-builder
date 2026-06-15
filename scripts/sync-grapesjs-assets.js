const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const assets = [
  {
    candidates: ['node_modules/grapesjs/dist/grapes.min.js'],
    target: 'static/js/grapes.min.js',
  },
  {
    candidates: ['node_modules/grapesjs/dist/css/grapes.min.css'],
    target: 'static/stylesheets/grapes.min.css',
  },
  {
    candidates: [
      'node_modules/grapesjs-preset-newsletter/dist/index.js',
      'node_modules/grapesjs-preset-newsletter/dist/grapesjs-preset-newsletter.min.js',
    ],
    target: 'static/js/grapesjs-preset-newsletter.min.js',
  },
  {
    candidates: [
      'node_modules/grapesjs-plugin-ckeditor/dist/index.js',
      'node_modules/grapesjs-plugin-ckeditor/dist/grapesjs-plugin-ckeditor.min.js',
    ],
    target: 'static/js/grapesjs-plugin-ckeditor/index.js',
  },
];

function firstExisting(candidates) {
  return candidates
    .map((candidate) => path.join(root, candidate))
    .find((candidatePath) => fs.existsSync(candidatePath));
}

for (const asset of assets) {
  const source = firstExisting(asset.candidates);
  if (!source) {
    throw new Error(`No GrapesJS asset candidate found for ${asset.target}`);
  }

  const target = path.join(root, asset.target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`${path.relative(root, source)} -> ${asset.target}`);
}
