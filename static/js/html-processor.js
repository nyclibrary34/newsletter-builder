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


const PREVIEW_TEXT = 'Municipal Library Notes (Optional)';

const SMART_CHAR_MAP = new Map([
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201a', ','],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u201e', '"'],
  ['\u2010', '-'],
  ['\u2011', '-'],
  ['\u2012', '-'],
  ['\u2013', '-'],
  ['\u2014', '--'],
  ['\u2015', '--'],
  ['\u2026', '...'],
  ['\u00a0', ' '],
  ['\u2007', ' '],
  ['\u2009', ' '],
  ['\u200a', ' '],
  ['\u200b', '']
]);

let textDecoderInstance = null;

const CP1252_REVERSE_MAP = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function getTextDecoder() {
  if (!textDecoderInstance && typeof TextDecoder !== 'undefined') {
    textDecoderInstance = new TextDecoder('utf-8', { fatal: false });
  }
  return textDecoderInstance;
}

function decodeMojibake(value) {
  if (!value) return value;
  const decoder = getTextDecoder();
  if (!decoder) return value;

  let requiresDecode = false;
  const bytes = new Uint8Array(value.length);

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0xff) {
      bytes[i] = code;
      if (code >= 0x80) {
        requiresDecode = true;
      }
    } else if (CP1252_REVERSE_MAP[code] !== undefined) {
      bytes[i] = CP1252_REVERSE_MAP[code];
      requiresDecode = true;
    } else {
      return value;
    }
  }

  if (!requiresDecode) {
    return value;
  }

  try {
    const decoded = decoder.decode(bytes);
    return decoded.includes('\ufffd') ? value : decoded;
  } catch (error) {
    console.warn('Mojibake decode failed, keeping original text', error);
    return value;
  }
}

function replaceSmartCharacters(value) {
  if (!value) return value;
  let result = value;
  SMART_CHAR_MAP.forEach((replacement, character) => {
    if (result.includes(character)) {
      result = result.split(character).join(replacement);
    }
  });
  return result;
}

function normalizeTextContent(doc) {
  if (!doc || !doc.body) return;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node || !node.nodeValue) continue;
    const parentTag = node.parentNode ? node.parentNode.nodeName : '';
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE') {
      continue;
    }
    const original = node.nodeValue;
    let normalized = decodeMojibake(original);
    normalized = replaceSmartCharacters(normalized);
    if (normalized !== original) {
      node.nodeValue = normalized;
    }
  }

  const attributeTargets = new Set([
    'title',
    'alt',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'data-tooltip',
    'data-tooltip-title',
    'data-tooltip-content'
  ]);

  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes || []).forEach((attr) => {
      if (!attributeTargets.has(attr.name)) {
        return;
      }
      const original = attr.value;
      let normalized = decodeMojibake(original);
      normalized = replaceSmartCharacters(normalized);
      if (normalized !== original) {
        element.setAttribute(attr.name, normalized);
      }
    });
  });
}

function ensurePreviewText(doc) {
  // Find the center element (main email container)
  const center = doc.querySelector('center[role="article"]');
  if (!center) return;
  
  // Check if preview text div already exists
  const existingPreview = center.querySelector('div[aria-hidden="true"]');
  if (existingPreview) {
    // Normalize preview text content and attributes
    existingPreview.textContent = PREVIEW_TEXT;
    const existingStyle = existingPreview.getAttribute('style') || '';
    if (!existingStyle.includes('max-height')) {
      existingPreview.setAttribute(
        'style',
        'max-height: 0px; overflow-x: hidden; overflow-y: hidden'
      );
    }
    return;
  }
  
  // Find the "Visually Hidden Preheader Text: BEGIN" comment
  let previewComment = null;
  const walker = doc.createTreeWalker(center, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent.includes('Visually Hidden Preheader Text: BEGIN')) {
      previewComment = walker.currentNode;
      break;
    }
  }
  
  if (!previewComment) return;
  
  // Create the preview text div
  const previewDiv = doc.createElement('div');
  previewDiv.setAttribute('aria-hidden', 'true');
  previewDiv.setAttribute('id', 'id-e784080a-da99-4659-8d9c-960b25096c4c');
  previewDiv.setAttribute('style', 'max-height: 0px; overflow-x: hidden; overflow-y: hidden');
  previewDiv.textContent = PREVIEW_TEXT;
  
  // Insert after the BEGIN comment
  if (previewComment.nextSibling) {
    previewComment.parentNode.insertBefore(previewDiv, previewComment.nextSibling);
  } else {
    previewComment.parentNode.appendChild(previewDiv);
  }
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
 * Fix footer link colors for better contrast on dark backgrounds
 * @param {Document} doc - Document object
 */
function fixFooterLinkColors(doc) {
  // Find the footer table (identified by black background)
  const footerTables = doc.querySelectorAll('table[style*="background-color: rgb(0, 0, 0)"], table[style*="background-color:rgb(0,0,0)"], table[style*="background-color:#000"]');
  
  footerTables.forEach(footerTable => {
    // Find all links within the footer
    const footerLinks = footerTable.querySelectorAll('a');
    
    footerLinks.forEach(link => {
      // Skip social media icon links (they are images)
      const hasImage = link.querySelector('img');
      if (hasImage) {
        return; // Skip this link, it's an image link
      }
      
      // Change text link color to white for contrast
      const style = link.getAttribute('style') || '';
      
      // Parse the style attribute properly to avoid malformed CSS
      const styleProps = new Map();
      
      // Split by semicolon and parse each property
      style.split(';').forEach(prop => {
        const colonIndex = prop.indexOf(':');
        if (colonIndex > 0) {
          const propName = prop.substring(0, colonIndex).trim();
          const propValue = prop.substring(colonIndex + 1).trim();
          if (propName && propValue) {
            styleProps.set(propName, propValue);
          }
        }
      });
      
      // Remove color and text-decoration related properties
      styleProps.delete('color');
      styleProps.delete('text-decoration');
      styleProps.delete('text-decoration-line');
      styleProps.delete('text-decoration-thickness');
      styleProps.delete('text-decoration-style');
      styleProps.delete('text-decoration-color');
      
      // Add white color and underline
      styleProps.set('color', 'rgb(255, 255, 255)');
      styleProps.set('text-decoration', 'underline');
      
      // Rebuild the style string
      const newStyleArray = [];
      styleProps.forEach((value, name) => {
        newStyleArray.push(`${name}: ${value}`);
      });
      
      link.setAttribute('style', newStyleArray.join('; '));
    });
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
  
  // Ensure alignment styles are preserved
  ensureAlignmentStyles(doc);
  
  // Fix footer link colors for contrast
  fixFooterLinkColors(doc);
  
  // Clean up temporary preservation attributes
  doc.querySelectorAll('[data-preserve-layout], [data-preserve-center]').forEach(element => {
    element.removeAttribute('data-preserve-layout');
    element.removeAttribute('data-preserve-center');
  });
}

/**
 * Ensure alignment styles are preserved
 * @param {Document} doc - Document object
 */
function ensureAlignmentStyles(doc) {
  // Find all centered table cells and ensure text-align is inline
  const centeredCells = doc.querySelectorAll('td[align="center"], th[align="center"]');
  centeredCells.forEach(cell => {
    const style = cell.getAttribute('style') || '';
    if (!style.includes('text-align')) {
      cell.setAttribute('style', style + (style ? '; ' : '') + 'text-align: center');
    }
  });
  
  // Find NYC logo and ensure it's centered
  const logos = doc.querySelectorAll('img[src*="logo.png"], img[src*="nyc.gov"]');
  logos.forEach(logo => {
    const style = logo.getAttribute('style') || '';
    // Skip social media platform logos
    const parentLink = logo.closest('a');
    const isSocialIcon = parentLink && (
      parentLink.href.includes('facebook') ||
      parentLink.href.includes('twitter') ||
      parentLink.href.includes('instagram') ||
      parentLink.href.includes('youtube') ||
      parentLink.href.includes('tumblr') ||
      parentLink.href.includes('linkedin')
    );
    
    if (!isSocialIcon) {
      // Only apply centering to non-social logos (like NYC logo)
      if (!style.includes('margin') && !style.includes('display: inline')) {
        logo.setAttribute('style', style + (style ? '; ' : '') + 'margin: 0 auto; display: block');
      }
      // Also ensure parent cell is centered
      const parentCell = logo.closest('td, th');
      if (parentCell && !parentCell.getAttribute('align')) {
        parentCell.setAttribute('align', 'center');
        const parentStyle = parentCell.getAttribute('style') || '';
        if (!parentStyle.includes('text-align')) {
          parentCell.setAttribute('style', parentStyle + (parentStyle ? '; ' : '') + 'text-align: center');
        }
      }
    }
  });
  
  // Ensure social media icons stay inline with proper display
  const socialLinks = doc.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="youtube"], a[href*="tumblr"], a[href*="linkedin"]');
  socialLinks.forEach(link => {
    // Force inline-block display for social links
    const style = link.getAttribute('style') || '';
    const updatedStyle = style.replace(/display\s*:\s*[^;]+;?/gi, ''); // Remove existing display
    link.setAttribute('style', updatedStyle + (updatedStyle ? '; ' : '') + 'display: inline-block !important; text-decoration: none !important');
    
    // Ensure images inside social links are properly styled
    const img = link.querySelector('img');
    if (img) {
      const imgStyle = img.getAttribute('style') || '';
      // Remove existing display and vertical-align to avoid conflicts
      let updatedImgStyle = imgStyle.replace(/display\s*:\s*[^;]+;?/gi, '');
      updatedImgStyle = updatedImgStyle.replace(/vertical-align\s*:\s*[^;]+;?/gi, '');
      img.setAttribute('style', updatedImgStyle + (updatedImgStyle ? '; ' : '') + 'display: inline-block !important');
    }
  });
  
  // Ensure footer social container maintains proper text alignment
  const footerCells = doc.querySelectorAll('td');
  footerCells.forEach(cell => {
    // Check if this cell contains social links
    const socialLinksInCell = cell.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="youtube"], a[href*="tumblr"], a[href*="linkedin"]');
    if (socialLinksInCell.length > 1) {
      // This is likely the social media container
      const style = cell.getAttribute('style') || '';
      if (!style.includes('text-align')) {
        cell.setAttribute('style', style + (style ? '; ' : '') + 'text-align: left');
      }
    }
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
    
    // CRITICAL: Ensure all images have HTML width attribute for Outlook compatibility
    // Outlook will scale images to original size without this attribute
    const widthAttr = (img.getAttribute('width') || '').trim();
    if (!widthAttr || !/^\d+$/.test(widthAttr)) {
      const style = img.getAttribute('style') || '';

      // Check if this is a social icon first
      const parent = img.closest('a');
      const isSocialIcon = parent && (
        parent.href?.includes('facebook') ||
        parent.href?.includes('twitter') ||
        parent.href?.includes('instagram') ||
        parent.href?.includes('youtube') ||
        parent.href?.includes('tumblr') ||
        parent.href?.includes('linkedin')
      );

      // Try to extract width from inline styles
      // Match various width patterns: width: 100%, width: 573px, width:auto, etc.
      const widthPxMatch = style.match(/width\s*:\s*(\d+)(?:px)?(?:\s|;|$)/i);
      const maxWidthPxMatch = style.match(/max-width\s*:\s*(\d+)(?:px)?(?:\s|;|$)/i);
      const widthPercentMatch = style.match(/width\s*:\s*(\d+)%/i);

      if (widthPxMatch && parseInt(widthPxMatch[1]) > 0) {
        // Use explicit pixel width from styles
        img.setAttribute('width', widthPxMatch[1]);
      } else if (maxWidthPxMatch && parseInt(maxWidthPxMatch[1]) > 0) {
        // Use max-width as width
        img.setAttribute('width', maxWidthPxMatch[1]);
      } else if (widthPercentMatch && parseInt(widthPercentMatch[1]) === 100) {
        // 100% width images should use 600 (standard email width)
        img.setAttribute('width', '600');
      } else if (isSocialIcon) {
        // Social icons default to 42px
        img.setAttribute('width', '42');
      } else {
        // For other images without explicit width, use 600 as safe default
        // This prevents Outlook from using the image's original size
        img.setAttribute('width', '600');
      }
    }
    
    // Check if image is part of social media icons or logos
    const parent = img.closest('a');
    const isSocialIcon = parent && (
      parent.href?.includes('facebook') ||
      parent.href?.includes('twitter') ||
      parent.href?.includes('instagram') ||
      parent.href?.includes('youtube') ||
      parent.href?.includes('tumblr') ||
      parent.href?.includes('linkedin')
    );
    
    // Don't modify display property for social icons or small inline images
    if (!isSocialIcon) {
      const style = img.getAttribute('style') || '';
      if (!style.includes('display:') && !style.includes('display ')) {
        // Check if this image is in a preserved layout container
        const preservedParent = img.closest('[data-preserve-center], [data-preserve-layout]');
        
        if (!preservedParent) {
          // Check if this image is likely a logo or should maintain inline behavior
          const parentTd = img.closest('td, th, div');
          const parentStyle = parentTd ? (parentTd.getAttribute('style') || '') : '';
          
          // Don't add display: block to images in centered containers (likely logos)
          const isInCenteredContainer = parentStyle.includes('text-align: center') || 
                                       parentStyle.includes('text-align:center');
          const isSmallImage = img.getAttribute('width') && parseInt(img.getAttribute('width')) < 400;
          
          // Only add display: block for large content images, not logos or inline images
          if (!isInCenteredContainer && !isSmallImage) {
            // Parse existing styles and remove vertical-align (incompatible with display: block)
            const styleProps = parseStyleAttribute(style);
            styleProps.delete('vertical-align');
            styleProps.set('display', 'block');
            
            const newStyle = Array.from(styleProps.entries())
              .map(([prop, value]) => `${prop}: ${value}`)
              .join('; ');
            img.setAttribute('style', newStyle);
          }
        }
      }
    }
  });
}

/**
 * Clean up MSO-specific properties that trigger CSS validation warnings.
 * Historically we injected `mso-table-lspace/rspace` for Outlook, but they now
 * live in exported HTML and surface lint errors. Since modern layouts rely on
 * `border-collapse` and zero cell spacing instead, strip those MSO properties.
 * @param {Document} doc - Document object
 */
function addMsoProperties(doc) {
  const tables = doc.querySelectorAll('table');

  tables.forEach(table => {
    const style = table.getAttribute('style');
    if (!style) return;

    let updatedStyle = style;

    // Remove Outlook-specific spacing properties that trigger CSS validation warnings
    updatedStyle = updatedStyle.replace(/mso-table-lspace\s*:\s*0pt\s*!important;?/gi, '');
    updatedStyle = updatedStyle.replace(/mso-table-rspace\s*:\s*0pt\s*!important;?/gi, '');

    if (updatedStyle !== style) {
      // Collapse duplicate semicolons/whitespace created by the removals
      updatedStyle = updatedStyle
        .replace(/;;+/g, ';')
        .replace(/;\s*;/g, ';')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // Ensure style ends with semicolon if there are multiple declarations
      if (updatedStyle && !updatedStyle.trim().endsWith(';') && updatedStyle.includes(';')) {
        updatedStyle = `${updatedStyle.trim()};`;
      }

      table.setAttribute('style', updatedStyle);
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
  
  // Ensure preview text is present
  ensurePreviewText(doc);
  
  // Normalize text content to prevent encoding glitches
  normalizeTextContent(doc);
  
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
 * Format HTML with proper indentation (Prettier-like)
 * @param {string} html - HTML content to format
 * @returns {string} Formatted HTML
 */
function formatHTMLContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  const inlineElements = new Set([
    'a',
    'abbr',
    'b',
    'cite',
    'code',
    'em',
    'i',
    'img',
    'label',
    'mark',
    'q',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
    'br'
  ]);
  
  function isInlineElement(tagName) {
    return inlineElements.has(tagName);
  }
  
  function formatNode(node, level = 0, inlineParent = false) {
    const indent = inlineParent ? '' : '  '.repeat(level);
    const asciiWhitespace = /[ \t\r\n\f\v]+/g;
    
    if (node.nodeType === Node.TEXT_NODE) {
      const rawText = node.textContent || '';
      if (!rawText) {
        return '';
      }
      
      const hasVisibleChars = /[^\s\u00a0]/.test(rawText);
      if (!hasVisibleChars) {
        if (rawText.includes('\u00a0')) {
          const nbspOnly = rawText.replace(asciiWhitespace, '');
          if (!nbspOnly) {
            return '';
          }
          return inlineParent ? nbspOnly : indent + nbspOnly;
        }
        return '';
      }
      
      const leadingSpace = /^[ \t\r\n\f\v]/.test(rawText);
      const trailingSpace = /[ \t\r\n\f\v]$/.test(rawText);
      let normalized = rawText.replace(asciiWhitespace, ' ');
      normalized = normalized.replace(/^[ \t\r\n\f\v]+/, '').replace(/[ \t\r\n\f\v]+$/, '');
      
      if (!normalized) {
        return '';
      }
      
      if (inlineParent) {
        // Check if the text starts with punctuation
        const startsWithPunctuation = /^[\.,;:!?]/.test(normalized);
        
        if (leadingSpace && !startsWithPunctuation) {
          normalized = ' ' + normalized;
        }
        if (trailingSpace) {
          normalized = normalized + ' ';
        }
      }
      
      // Remove spaces before punctuation
      normalized = normalized.replace(/ ([\.,;:!?])/g, '$1');
      
      return inlineParent ? normalized : indent + normalized;
    }
    
    if (node.nodeType === Node.COMMENT_NODE) {
      return indent + '<!--' + node.textContent + '-->';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const isVoid = voidElements.includes(tagName);
      const isInline = isInlineElement(tagName) || inlineParent;
      
      let result = indent + '<' + tagName;
      
      for (let attr of node.attributes) {
        result += ' ' + attr.name;
        if (attr.value) {
          result += '="' + attr.value.replace(/"/g, '&quot;') + '"';
        }
      }
      
      if (isVoid) {
        result += '>';
        return result;
      }
      
      result += '>';
      
      const children = Array.from(node.childNodes);
      const inlineChildrenOnly = children.every(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          return true;
        }
        if (child.nodeType === Node.COMMENT_NODE) {
          return true;
        }
        if (child.nodeType === Node.ELEMENT_NODE) {
          return isInlineElement(child.tagName.toLowerCase());
        }
        return false;
      });
      
      if (children.length > 0) {
        const childInlineContext = isInline || inlineChildrenOnly || inlineParent;
        const childrenFormatted = [];
        
        for (let child of children) {
          const formatted = formatNode(child, level + 1, childInlineContext);
          if (formatted) {
            childrenFormatted.push(formatted);
          }
        }
        
        if (childrenFormatted.length > 0) {
          const shouldAddNewlines = !isInline && !inlineParent && !inlineChildrenOnly && tagName !== 'title';
          if (shouldAddNewlines) {
            result += '\n' + childrenFormatted.join('\n') + '\n' + indent;
          } else {
            // For inline content, merge text starting with punctuation with previous element
            const merged = [];
            for (let i = 0; i < childrenFormatted.length; i++) {
              const current = childrenFormatted[i];
              // Check if current text starts with punctuation (after trimming leading whitespace)
              const trimmed = current.trimStart();
              if (trimmed && /^[\.,;:!?]/.test(trimmed) && merged.length > 0) {
                // Merge with previous element, removing any whitespace between them
                merged[merged.length - 1] += trimmed;
              } else {
                merged.push(current);
              }
            }
            result += merged.join('');
          }
        }
      }
      
      result += '</' + tagName + '>';
      return result;
    }
    
    return '';
  }
  
  let formatted = '<!DOCTYPE html>\n';
  formatted += formatNode(doc.documentElement, 0, false);
  return formatted;
}

/**
 * Process HTML and trigger download
 * @param {string} htmlContent - Raw HTML content
 * @param {string} filename - Desired filename for download
 */
function processAndDownload(htmlContent, filename = 'newsletter.html') {
  try {
    // Process the HTML
    let processedHTML = processHTML(htmlContent);
    
    // Format the HTML for better readability
    try {
      processedHTML = formatHTMLContent(processedHTML);
    } catch (formatError) {
      console.warn('HTML formatting failed, using processed but unformatted HTML:', formatError);
    }
    
    // Ensure filename has .html extension
    if (!filename.endsWith('.html')) {
      filename += '.html';
    }
    
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
    formatHTMLContent,
    generateUUID,
    replaceIDs
  };
} else {
  // Browser environment - attach to window
  window.HTMLProcessor = {
    processHTML,
    processAndDownload,
    formatHTMLContent,
    generateUUID,
    replaceIDs
  };
}
