/**
 * Simplified Client-side HTML Processor
 * Faithfully replicates juice server behavior for CSS inlining and ID cleanup
 * Focus: Simple, reliable processing without over-styling
 */

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return 'id-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


/**
 * Fix document structure issues common with GrapesJS export
 * @param {Document} doc - Document object
 */
function fixDocumentStructure(doc) {
  // Ensure proper HTML structure
  const html = doc.documentElement;
  if (!html) return;
  
  // Ensure html has proper attributes for email compatibility
  if (!html.getAttribute('lang')) {
    html.setAttribute('lang', 'en');
  }
  if (!html.getAttribute('xmlns')) {
    html.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  }
  if (!html.getAttribute('xmlns:v')) {
    html.setAttribute('xmlns:v', 'urn:schemas-microsoft-com:vml');
  }
  if (!html.getAttribute('xmlns:o')) {
    html.setAttribute('xmlns:o', 'urn:schemas-microsoft-com:office:office');
  }
  
  // Ensure head and body exist
  let head = doc.head;
  let body = doc.body;
  
  if (!head) {
    head = doc.createElement('head');
    html.insertBefore(head, body);
  }
  
  if (!body) {
    body = doc.createElement('body');
    html.appendChild(body);
  }
  
  // Move any meta tags from body to head
  const metasInBody = body.querySelectorAll('meta, title');
  metasInBody.forEach(meta => {
    head.appendChild(meta);
  });
  
  // Ensure required meta tags exist
  const requiredMetas = [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width' },
    { 'http-equiv': 'X-UA-Compatible', content: 'IE=edge' },
    { name: 'x-apple-disable-message-reformatting' },
    { name: 'format-detection', content: 'telephone=no,address=no,email=no,date=no,url=no' },
    { name: 'color-scheme', content: 'light' },
    { name: 'supported-color-schemes', content: 'light' }
  ];
  
  requiredMetas.forEach(metaAttrs => {
    const existing = head.querySelector(`meta[${Object.keys(metaAttrs)[0]}="${Object.values(metaAttrs)[0]}"]`);
    if (!existing) {
      const meta = doc.createElement('meta');
      Object.entries(metaAttrs).forEach(([key, value]) => {
        meta.setAttribute(key, value);
      });
      head.appendChild(meta);
    }
  });
  
  // Add MSO conditional comments if not present
  if (!head.innerHTML.includes('OfficeDocumentSettings')) {
    const msoComment = doc.createComment(`[if gte mso 9]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG />
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    <![endif]`);
    head.appendChild(msoComment);
  }
}

/**
 * Preserve existing good email layout patterns
 * @param {Document} doc - Document object
 */
function preserveLayoutPatterns(doc) {
  // Mark elements that should not be modified to preserve layout
  const elementsToPreserve = doc.querySelectorAll('table[width="100%"], .email-container, [role="presentation"]');
  
  elementsToPreserve.forEach(element => {
    element.setAttribute('data-preserve-layout', 'true');
  });
  
  // Specifically preserve logo containers and centered elements
  const centeredContainers = doc.querySelectorAll('td[style*="text-align: center"], td[style*="text-align:center"]');
  centeredContainers.forEach(container => {
    container.setAttribute('data-preserve-center', 'true');
  });
}

/**
 * Fix email compatibility issues for better client support
 * @param {Document} doc - Document object
 */
function fixEmailCompatibility(doc) {
  // First, identify and preserve existing good layout patterns
  preserveLayoutPatterns(doc);
  
  // Fix HTTP URLs to HTTPS for security
  fixHttpUrls(doc);
  
  // Add bgcolor fallbacks for Outlook
  addBgcolorFallbacks(doc);
  
  // Optimize image attributes
  optimizeImages(doc);
  
  // Add MSO properties for Outlook
  addMsoProperties(doc);
  
  // Clean up temporary preservation attributes
  doc.querySelectorAll('[data-preserve-layout], [data-preserve-center]').forEach(element => {
    element.removeAttribute('data-preserve-layout');
    element.removeAttribute('data-preserve-center');
  });
}

/**
 * Convert HTTP URLs to HTTPS for better email client security
 * @param {Document} doc - Document object
 */
function fixHttpUrls(doc) {
  // Fix image src attributes
  const images = doc.querySelectorAll('img[src^="http://"]');
  images.forEach(img => {
    const httpUrl = img.getAttribute('src');
    const httpsUrl = httpUrl.replace(/^http:\/\//, 'https://');
    img.setAttribute('src', httpsUrl);
  });
  
  // Fix link href attributes
  const links = doc.querySelectorAll('a[href^="http://"]');
  links.forEach(link => {
    const httpUrl = link.getAttribute('href');
    const httpsUrl = httpUrl.replace(/^http:\/\//, 'https://');
    link.setAttribute('href', httpsUrl);
  });
}

/**
 * Add bgcolor fallbacks for table cells with background colors
 * @param {Document} doc - Document object
 */
function addBgcolorFallbacks(doc) {
  const cellsWithBg = doc.querySelectorAll('td[style*="background-color"], th[style*="background-color"]');
  
  cellsWithBg.forEach(cell => {
    const style = cell.getAttribute('style') || '';
    const bgColorMatch = style.match(/background-color:\s*rgb\(([^)]+)\)/i);
    
    if (bgColorMatch && !cell.hasAttribute('bgcolor')) {
      // Check if this cell is in a preserved layout
      const isPreserved = cell.closest('[data-preserve-layout]');
      
      if (!isPreserved) {
        // Check if this cell is part of a full-width background structure
        const parentTable = cell.closest('table');
        const parentTableStyle = parentTable ? (parentTable.getAttribute('style') || '') : '';
        const parentTableWidth = parentTable ? parentTable.getAttribute('width') : '';
        
        // Don't add bgcolor to cells that are part of full-width structures 
        // unless they're content cells (not structural/container cells)
        const isInFullWidthTable = parentTableWidth === '100%' || parentTableStyle.includes('width: 100%');
        const cellHasPadding = style.includes('padding');
        const cellHasText = cell.textContent && cell.textContent.trim().length > 0;
        
        // Only add bgcolor fallbacks to content cells, not structural elements
        const isContentCell = cellHasPadding || cellHasText || !isInFullWidthTable;
        
        if (isContentCell) {
          const rgbValues = bgColorMatch[1].split(',').map(v => parseInt(v.trim()));
          if (rgbValues.length === 3) {
            const hexColor = '#' + rgbValues.map(v => {
              const hex = Math.max(0, Math.min(255, v)).toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            cell.setAttribute('bgcolor', hexColor);
          }
        }
      }
    }
  });
}

/**
 * Optimize image attributes for email compatibility
 * @param {Document} doc - Document object
 */
function optimizeImages(doc) {
  const images = doc.querySelectorAll('img');
  
  images.forEach(img => {
    // Ensure border="0" attribute
    if (!img.hasAttribute('border')) {
      img.setAttribute('border', '0');
    }
    
    // Only add display: block if it's needed and won't break layout
    const style = img.getAttribute('style') || '';
    if (!style.includes('display:') && !style.includes('display ')) {
      // Check if this image is in a preserved layout container
      const preservedParent = img.closest('[data-preserve-center], [data-preserve-layout]');
      
      if (!preservedParent) {
        // Check if this image is likely a logo or should maintain inline behavior
        const parent = img.closest('td, th, div');
        const parentStyle = parent ? (parent.getAttribute('style') || '') : '';
        
        // Don't add display: block to images in centered containers (likely logos)
        const isInCenteredContainer = parentStyle.includes('text-align: center') || 
                                     parentStyle.includes('text-align:center');
        const isSmallImage = img.getAttribute('width') && parseInt(img.getAttribute('width')) < 400;
        
        // Only add display: block for content images, not logos or inline images
        if (!isInCenteredContainer || !isSmallImage) {
          const newStyle = style + (style ? '; ' : '') + 'display: block';
          img.setAttribute('style', newStyle);
        }
      }
    }
  });
}

/**
 * Add MSO-specific properties for better Outlook compatibility
 * @param {Document} doc - Document object
 */
function addMsoProperties(doc) {
  const tables = doc.querySelectorAll('table');
  
  tables.forEach(table => {
    const style = table.getAttribute('style') || '';
    
    // Only add MSO properties if not already present and if it won't break layout
    if (!style.includes('mso-table-lspace') && !style.includes('mso-table-rspace')) {
      // Check if this table is marked for layout preservation
      const isPreserved = table.hasAttribute('data-preserve-layout');
      
      if (!isPreserved) {
        // Check if this table is part of a full-width background structure
        const width = table.getAttribute('width');
        const isFullWidth = width === '100%' || style.includes('width: 100%');
        const hasBackgroundColor = style.includes('background-color');
        
        // Don't add MSO spacing to full-width tables with backgrounds (they handle their own spacing)
        const isStructuralTable = isFullWidth && hasBackgroundColor;
        
        if (!isStructuralTable) {
          const msoProps = 'mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important';
          const newStyle = style + (style ? '; ' : '') + msoProps;
          table.setAttribute('style', newStyle);
        }
      }
    }
  });
}

/**
 * Replace auto-generated IDs with UUIDs and update references
 * @param {Document} doc - Document object
 */
function replaceIDs(doc) {
  const idMap = new Map();
  
  // Find all elements with IDs starting with 'i' followed by alphanumeric characters
  const elementsWithAutoIds = doc.querySelectorAll('[id^="i"]');
  
  elementsWithAutoIds.forEach(element => {
    const oldId = element.id;
    // Check if it's an auto-generated ID pattern (i followed by numbers/letters)
    if (/^i[a-zA-Z0-9]+$/.test(oldId)) {
      const newId = generateUUID();
      idMap.set(oldId, newId);
      element.id = newId;
    }
  });
  
  // Update all references to the old IDs
  idMap.forEach((newId, oldId) => {
    // Update href attributes pointing to the old ID
    const hrefElements = doc.querySelectorAll(`[href="#${oldId}"]`);
    hrefElements.forEach(el => el.setAttribute('href', `#${newId}`));
    
    // Update for attributes (labels) pointing to the old ID
    const forElements = doc.querySelectorAll(`[for="${oldId}"]`);
    forElements.forEach(el => el.setAttribute('for', newId));
  });
}

/**
 * Main processing function - match juice server behavior exactly
 * Only process styles that would actually be inlined by juice library
 * @param {string} htmlContent - Raw HTML content with <style> tags
 * @returns {string} Processed HTML with inlined styles and clean IDs
 */
function processHTML(htmlContent) {
  // Create a new document from the HTML content
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Fix common structural issues from GrapesJS export
  fixDocumentStructure(doc);
  
  // Extract and process only specific CSS rules that juice would inline
  const styleTags = doc.querySelectorAll('style');
  
  styleTags.forEach(styleTag => {
    const cssText = styleTag.textContent;
    
    // Only process class, ID, and specific element selectors for inlining
    const inlineableRules = extractInlineableRules(cssText);
    
    // Apply only these specific rules
    inlineableRules.forEach(rule => {
      try {
        const elements = doc.querySelectorAll(rule.selector);
        elements.forEach(element => {
          if (['SCRIPT', 'STYLE', 'META', 'TITLE', 'HEAD'].includes(element.tagName)) {
            return;
          }
          
          const existingStyle = element.getAttribute('style') || '';
          const existingProps = parseStyleAttribute(existingStyle);
          
          // Add new properties that don't already exist
          Object.keys(rule.declarations).forEach(prop => {
            if (!existingProps.has(prop)) {
              existingProps.set(prop, rule.declarations[prop]);
            }
          });
          
          // Set the updated style attribute
          if (existingProps.size > 0) {
            const styleValue = Array.from(existingProps.entries())
              .map(([prop, value]) => `${prop}: ${value}`)
              .join('; ');
            element.setAttribute('style', styleValue);
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });
  });
  
  // Remove all <style> tags after processing
  styleTags.forEach(styleTag => {
    styleTag.remove();
  });
  
  // Replace auto-generated IDs with UUIDs
  replaceIDs(doc);
  
  // Fix email compatibility issues
  fixEmailCompatibility(doc);
  
  // Return the processed HTML with proper DOCTYPE
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/**
 * Extract only CSS rules that should be inlined (similar to juice behavior)
 * @param {string} cssText - CSS content
 * @returns {Array} Array of inlineable rules
 */
function extractInlineableRules(cssText) {
  const rules = [];
  
  // Remove comments and media queries
  let css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  css = css.replace(/@[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  
  while ((match = ruleRegex.exec(css)) !== null) {
    const selectors = match[1].split(',').map(s => s.trim());
    const declarationText = match[2].trim();
    
    selectors.forEach(selector => {
      // Only inline styles for specific selectors (not global ones)
      if (shouldInlineSelector(selector)) {
        const declarations = parseDeclarations(declarationText);
        if (Object.keys(declarations).length > 0) {
          rules.push({ selector, declarations });
        }
      }
    });
  }
  
  return rules;
}

/**
 * Determine if a selector should have its styles inlined
 * @param {string} selector - CSS selector
 * @returns {boolean} Whether to inline this selector
 */
function shouldInlineSelector(selector) {
  // Don't inline universal or global selectors
  if (selector === '*' || 
      selector.includes(':root') ||
      selector.includes('html') ||
      selector.includes('body') ||
      selector.includes('table,') ||
      selector.includes('td') && !selector.includes('.') && !selector.includes('#') ||
      selector.includes(':hover') ||
      selector.includes(':focus') ||
      selector.includes(':active') ||
      selector.includes('::before') ||
      selector.includes('::after') ||
      selector.includes('[style') ||
      selector.includes('~') ||
      selector.includes('+')) {
    return false;
  }
  
  // Only inline specific selectors: classes, IDs, or specific elements with classes/IDs
  return selector.includes('.') || 
         selector.includes('#') || 
         selector.includes('[') ||
         /^[a-zA-Z]+$/.test(selector);
}

/**
 * Parse style attribute into a Map
 * @param {string} styleText - Style attribute value
 * @returns {Map} Map of property -> value
 */
function parseStyleAttribute(styleText) {
  const props = new Map();
  if (!styleText) return props;
  
  styleText.split(';').forEach(decl => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex > 0) {
      const prop = decl.substring(0, colonIndex).trim();
      const value = decl.substring(colonIndex + 1).trim();
      if (prop && value) {
        props.set(prop, value);
      }
    }
  });
  
  return props;
}

/**
 * Parse CSS declarations
 * @param {string} declarationText - CSS declarations
 * @returns {Object} Object of property -> value
 */
function parseDeclarations(declarationText) {
  const declarations = {};
  declarationText.split(';').forEach(decl => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex > 0) {
      const prop = decl.substring(0, colonIndex).trim();
      const value = decl.substring(colonIndex + 1).trim();
      if (prop && value) {
        declarations[prop] = value;
      }
    }
  });
  return declarations;
}

/**
 * Process HTML and trigger download
 * @param {string} htmlContent - Raw HTML content
 * @param {string} filename - Desired filename for download
 */
function processAndDownload(htmlContent, filename = 'newsletter.html') {
  try {
    // Process the HTML
    const processedHTML = processHTML(htmlContent);
    
    // Create blob and download
    const blob = new Blob([processedHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    return { success: true, message: 'HTML processed and downloaded successfully' };
  } catch (error) {
    console.error('HTML processing error:', error);
    return { success: false, error: error.message };
  }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    processHTML,
    processAndDownload,
    generateUUID,
    replaceIDs
  };
} else {
  // Browser environment - attach to window
  window.HTMLProcessor = {
    processHTML,
    processAndDownload,
    generateUUID,
    replaceIDs
  };
}
