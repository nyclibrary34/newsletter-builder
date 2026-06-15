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
  var OWNED_INLINE_DESCENDANT_TAGS = ['A', 'B', 'STRONG', 'I', 'EM', 'U', 'STRIKE', 'S', 'SPAN', 'BR', 'SUP', 'SUB', 'FONT', 'O:P', 'SMALL', 'MARK', 'ABBR', 'CODE', 'WBR', 'LABEL', 'BIG', 'TT'];
  var RUNTIME_ATTRS = [
    'data-gjs-type',
    'data-gjs-editable',
    'data-gjs-draggable',
    'data-gjs-droppable',
    'data-gjs-removable',
    'data-gjs-copyable',
    'data-gjs-resizable',
    'data-gjs-name',
    'data-gjs-stylable',
    'data-gjs-highlightable',
    'draggable',
    'contenteditable'
  ];

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

  function meaningfulTextLength(el) {
    return ((el.textContent || '').replace(/\s+/g, ' ').trim()).length;
  }

  function hasMedia(el) {
    return !!(el && el.querySelector && el.querySelector('img,picture,svg,video'));
  }

  function isEmptyLayoutCell(el) {
    return el && (el.tagName === 'TD' || el.tagName === 'TH') && !hasMedia(el) && !hasMeaningfulText(el);
  }

  function isArticleBodyBlock(el) {
    if (!el) return false;
    var len = meaningfulTextLength(el);
    if (len >= 120) return true;
    return el.tagName === 'P' && el.classList && el.classList.contains('paragraph') && len >= 80;
  }

  function isBrokenArticleCaptionBlock(table) {
    if (!table || !table.classList || !table.classList.contains('image-caption-block')) return false;
    if (!hasMedia(table)) return false;

    var bodyBlocks = Array.prototype.filter.call(
      table.querySelectorAll('p,div,blockquote,li'),
      isArticleBodyBlock
    );
    if (!bodyBlocks.length) return false;

    var hasEmptyCells = Array.prototype.some.call(table.querySelectorAll('td,th'), isEmptyLayoutCell);
    var hasNestedCaptionTable = !!table.querySelector('table.image-caption-block');
    return hasEmptyCells || hasNestedCaptionTable;
  }

  function isEmptyTable(el) {
    return el && el.tagName === 'TABLE' && !hasMedia(el) && !hasMeaningfulText(el);
  }

  function appendCellFlowNodes(fragment, cell) {
    var moved = false;
    while (cell.firstChild) {
      var child = cell.firstChild;
      cell.removeChild(child);

      if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE && isEmptyTable(child)) {
        continue;
      }

      fragment.appendChild(child);
      moved = true;
    }
    return moved;
  }

  function flattenBrokenArticleCaptionBlocks(body) {
    var tables = Array.prototype.slice.call(body.querySelectorAll('table.image-caption-block'));
    tables.forEach(function (table) {
      if (!table.parentNode || !isBrokenArticleCaptionBlock(table)) return;

      var fragment = document.createDocumentFragment();
      var moved = false;
      Array.prototype.forEach.call(table.querySelectorAll('td,th'), function (cell) {
        if (isEmptyLayoutCell(cell)) return;
        if (appendCellFlowNodes(fragment, cell)) {
          moved = true;
        }
      });

      if (moved) {
        table.parentNode.replaceChild(fragment, table);
      }
    });
  }

  function stripRuntimeAttrs(el) {
    RUNTIME_ATTRS.forEach(function (attr) {
      el.removeAttribute(attr);
    });
  }

  function cleanInlineDescendants(el) {
    Array.prototype.forEach.call(el.querySelectorAll('*'), function (d) {
      if (d === el) return;
      if (OWNED_INLINE_DESCENDANT_TAGS.indexOf(d.tagName) !== -1) {
        stripRuntimeAttrs(d);
      }
    });
  }

  function isMaybeTextBlock(el) {
    return el && MAYBE_TEXT_BLOCK_TAGS.indexOf(el.tagName) !== -1;
  }

  function isInvalidLayoutTextOwner(el) {
    return isMaybeTextBlock(el) && el.getAttribute('data-gjs-type') === 'text' && !isPhrasingOnly(el);
  }

  function stripInvalidLayoutTextOwners(body) {
    var selector = MAYBE_TEXT_BLOCK_TAGS.map(lower).map(function (tag) {
      return tag + '[data-gjs-type="text"]';
    }).join(',');

    Array.prototype.forEach.call(body.querySelectorAll(selector), function (el) {
      if (isInvalidLayoutTextOwner(el)) {
        stripRuntimeAttrs(el);
      }
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
      if (el.getAttribute('data-gjs-type') === 'text') {
        cleanInlineDescendants(el);
        return;
      }
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
        cleanInlineDescendants(el);
      }
    });
  }

  function makeStandaloneInlineEditable(htmlString) {
    if (typeof htmlString !== 'string' || htmlString.length === 0) {
      return htmlString;
    }
    var doc = new DOMParser().parseFromString('<body>' + htmlString + '</body>', 'text/html');
    // Existing files may have baked the editor selection class (gjs-selected)
    // and other runtime gjs- classes into the stored markup. GrapesJS would
    // adopt them as real author classes on load and render a broken nested
    // selection box, so strip them before typing.
    stripGjsClasses(doc.body);
    flattenBlocksInHeadings(doc.body);
    flattenBrokenArticleCaptionBlocks(doc.body);
    stripInvalidLayoutTextOwners(doc.body);
    typeTextBlocks(doc.body);
    typeStandaloneInlines(doc.body);
    return doc.body.innerHTML;
  }

  // Remove GrapesJS runtime-only artifacts before a newsletter is saved or
  // exported. GrapesJS bakes editor state into the canvas DOM — the selection
  // class (gjs-selected), child component types (data-gjs-type="default") and
  // draggable handles — and editor.getHtml() serializes them into the stored
  // file. Left in place they render a broken "selected" outline on the next
  // load and accumulate on every save. We keep the meaningful authoring markers
  // (data-gjs-type="text", data-gjs-editable) and every content attribute.
  function stripGjsClasses(body) {
    Array.prototype.forEach.call(body.querySelectorAll('[class]'), function (el) {
      var kept = (el.getAttribute('class') || '').split(/\s+/).filter(function (c) {
        return c && c.indexOf('gjs-') !== 0;
      });
      if (kept.length) {
        el.setAttribute('class', kept.join(' '));
      } else {
        el.removeAttribute('class');
      }
    });
  }

  function stripRuntimeGjsAttrs(body) {
    Array.prototype.forEach.call(body.querySelectorAll('[data-gjs-type]'), function (el) {
      if (isInvalidLayoutTextOwner(el)) {
        stripRuntimeAttrs(el);
      } else if (el.getAttribute('data-gjs-type') !== 'text') {
        el.removeAttribute('data-gjs-type');
      }
    });
    Array.prototype.forEach.call(body.querySelectorAll('[draggable]'), function (el) {
      el.removeAttribute('draggable');
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-gjs-highlightable]'), function (el) {
      el.removeAttribute('data-gjs-highlightable');
    });
  }

  function sanitizeExportedHtml(htmlString) {
    if (typeof htmlString !== 'string' || htmlString.length === 0) {
      return htmlString;
    }
    var doc = new DOMParser().parseFromString('<body>' + htmlString + '</body>', 'text/html');
    stripGjsClasses(doc.body);
    stripRuntimeGjsAttrs(doc.body);
    return doc.body.innerHTML;
  }

  return {
    makeStandaloneInlineEditable: makeStandaloneInlineEditable,
    sanitizeExportedHtml: sanitizeExportedHtml
  };
});
