/**
 * static/js/email-typography.js
 *
 * Single source of truth for the typography used both inside the GrapesJS editor
 * canvas AND in the exported HTML. Keep these in sync so the editor preview
 * matches what email clients render.
 *
 * Why these values:
 * - Arial / Helvetica are the only sans-serif families guaranteed to render
 *   identically across Outlook 2016+, Outlook.com, Gmail (web + mobile),
 *   Apple Mail, and Yahoo Mail without webfont loading.
 * - 16px / 1.65 matches the existing exporter defaults already in
 *   html-processor.js so we are not changing OTI's accepted output, only
 *   making the editor match it.
 */
(function (root) {
  var EMAIL_FONT_STACK = 'Arial, Helvetica, sans-serif';
  var EMAIL_BASE_FONT_SIZE = '16px';
  var EMAIL_BASE_LINE_HEIGHT = '1.65';
  var EMAIL_BASE_COLOR = '#111111';

  function getEmailBodyCss() {
    // CSS injected into the GrapesJS canvas so the editor renders the
    // same fonts the exporter will inline.
    return (
      'html, body { font-family: ' + EMAIL_FONT_STACK + ' !important; ' +
      'font-size: ' + EMAIL_BASE_FONT_SIZE + ' !important; ' +
      'line-height: ' + EMAIL_BASE_LINE_HEIGHT + ' !important; ' +
      'color: ' + EMAIL_BASE_COLOR + ' !important; }\n' +
      'table, td, th, p, h1, h2, h3, h4, h5, h6, li, span, div { ' +
      'font-family: ' + EMAIL_FONT_STACK + '; }\n'
    );
  }

  var api = {
    EMAIL_FONT_STACK: EMAIL_FONT_STACK,
    EMAIL_BASE_FONT_SIZE: EMAIL_BASE_FONT_SIZE,
    EMAIL_BASE_LINE_HEIGHT: EMAIL_BASE_LINE_HEIGHT,
    EMAIL_BASE_COLOR: EMAIL_BASE_COLOR,
    getEmailBodyCss: getEmailBodyCss
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EmailTypography = api;
  }
})(typeof window !== 'undefined' ? window : this);
