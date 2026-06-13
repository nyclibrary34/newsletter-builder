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

  function isStandaloneInline(el) {
    if (!el || !el.parentElement) return false;
    if (INLINE_TAGS.indexOf(el.tagName) === -1) return false;
    return LAYOUT_PARENT_TAGS.indexOf(el.parentElement.tagName) !== -1;
  }

  function typeHeadingsAsText(body) {
    var selector = HEADING_TAGS.map(function (t) { return t.toLowerCase(); }).join(',');
    var nodes = body.querySelectorAll(selector);
    nodes.forEach(function (el) {
      if (!el.hasAttribute('data-gjs-type')) {
        el.setAttribute('data-gjs-type', 'text');
      }
    });
  }

  function typeStandaloneInlines(body) {
    var selector = INLINE_TAGS.map(function (t) { return t.toLowerCase(); }).join(',');
    var nodes = body.querySelectorAll(selector);
    nodes.forEach(function (el) {
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
    typeHeadingsAsText(doc.body);
    typeStandaloneInlines(doc.body);
    return doc.body.innerHTML;
  }

  return { makeStandaloneInlineEditable: makeStandaloneInlineEditable };
});
