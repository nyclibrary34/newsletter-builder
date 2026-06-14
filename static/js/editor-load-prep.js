(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NewsletterEditorLoadPrep = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var INLINE_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'STRIKE'];
  var LAYOUT_PARENT_TAGS = ['TD', 'TH', 'DIV', 'BODY', 'TABLE', 'TR', 'TBODY', 'THEAD', 'TFOOT', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'];
  var HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  var TEXT_BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION'];
  var MAYBE_TEXT_BLOCK_TAGS = ['TD', 'TH', 'DIV'];
  var PHRASING_TAGS = ['A', 'B', 'STRONG', 'I', 'EM', 'U', 'STRIKE', 'S', 'SPAN', 'BR', 'SUP', 'SUB', 'FONT', 'O:P', 'SMALL', 'MARK', 'ABBR', 'CODE', 'WBR', 'LABEL', 'BIG', 'TT'];

  function lower(t) { return t.toLowerCase(); }

  function isStandaloneInline(el) {
    if (!el || !el.parentElement) return false;
    if (INLINE_TAGS.indexOf(el.tagName) === -1) return false;
    if (closestTextBlock(el.parentElement)) return false;
    return LAYOUT_PARENT_TAGS.indexOf(el.parentElement.tagName) !== -1;
  }

  function closestTextBlock(el) {
    var node = el;
    while (node) {
      if (node.getAttribute && node.getAttribute('data-gjs-type') === 'text') return node;
      node = node.parentElement;
    }
    return null;
  }

  function isPhrasingOnly(el) {
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      if (PHRASING_TAGS.indexOf(kids[i].tagName) === -1) return false;
      if (!isPhrasingOnly(kids[i])) return false;
    }
    return true;
  }

  function hasMeaningfulText(el) {
    return (el.textContent || '').trim().length > 0;
  }

  function cleanInlineDescendants(el) {
    var typed = el.querySelectorAll('[data-gjs-type]');
    Array.prototype.forEach.call(typed, function (d) {
      if (d === el) return;
      if (d.getAttribute('data-gjs-type') !== 'text') {
        d.removeAttribute('data-gjs-type');
      }
    });
    var draggables = el.querySelectorAll('[draggable]');
    Array.prototype.forEach.call(draggables, function (d) {
      if (d === el) return;
      d.removeAttribute('draggable');
    });
  }

  function flattenBlocksInHeadings(body) {
    var headingSel = HEADING_TAGS.map(lower).join(',');
    var blockSel = 'p,div,blockquote,pre';
    var headings = body.querySelectorAll(headingSel);
    Array.prototype.forEach.call(headings, function (h) {
      var blocks = h.querySelectorAll(blockSel);
      Array.from(blocks).reverse().forEach(function (block) {
        var parent = block.parentNode;
        if (!parent) return;
        while (block.firstChild) parent.insertBefore(block.firstChild, block);
        parent.removeChild(block);
      });
    });
  }

  function typeTextBlocks(body) {
    var alwaysSel = TEXT_BLOCK_TAGS.map(lower).join(',');
    Array.prototype.forEach.call(body.querySelectorAll(alwaysSel), function (el) {
      if (!el.hasAttribute('data-gjs-type')) {
        el.setAttribute('data-gjs-type', 'text');
      }
      cleanInlineDescendants(el);
    });

    var maybeSel = MAYBE_TEXT_BLOCK_TAGS.map(lower).join(',');
    Array.prototype.forEach.call(body.querySelectorAll(maybeSel), function (el) {
      if (el.hasAttribute('data-gjs-type')) return;
      if (hasMeaningfulText(el) && isPhrasingOnly(el)) {
        el.setAttribute('data-gjs-type', 'text');
        cleanInlineDescendants(el);
      }
    });
  }

  function typeStandaloneInlines(body) {
    var selector = INLINE_TAGS.map(lower).join(',');
    Array.prototype.forEach.call(body.querySelectorAll(selector), function (el) {
      if (isStandaloneInline(el)) {
        el.setAttribute('data-gjs-type', 'text');
      }
    });
  }

  function makeStandaloneInlineEditable(htmlString) {
    if (typeof htmlString !== 'string' || htmlString.length === 0) {
      return htmlString;
    }
    var doc = new DOMParser().parseFromString('<body>' + htmlString + '</body>', 'text/html');
    flattenBlocksInHeadings(doc.body);
    typeTextBlocks(doc.body);
    typeStandaloneInlines(doc.body);
    return doc.body.innerHTML;
  }

  return { makeStandaloneInlineEditable: makeStandaloneInlineEditable };
});
