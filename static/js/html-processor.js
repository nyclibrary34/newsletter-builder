/**
 * Client-side HTML Processor
 * Replaces juice server functionality for CSS inlining and ID cleanup
 * Compatible with all modern browsers
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
 * Parse CSS rules from a stylesheet text
 * @param {string} cssText - Raw CSS text
 * @returns {Array} Array of CSS rules with selectors and declarations
 */
function parseCSSRules(cssText) {
  const rules = [];
  // Remove comments and normalize whitespace
  const cleanCSS = cssText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  
  // Basic CSS rule parsing - handles simple selectors and declarations
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  
  while ((match = ruleRegex.exec(cleanCSS)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();
    
    // Skip media queries and other at-rules for now
    if (selector.startsWith('@')) continue;
    
    const declarationMap = {};
    const declRegex = /([^:;]+):([^;]+)/g;
    let declMatch;
    
    while ((declMatch = declRegex.exec(declarations)) !== null) {
      const property = declMatch[1].trim();
      const value = declMatch[2].trim();
      declarationMap[property] = value;
    }
    
    rules.push({
      selector: selector,
      declarations: declarationMap
    });
  }
  
  return rules;
}

/**
 * Calculate CSS specificity (simplified)
 * @param {string} selector - CSS selector
 * @returns {number} Specificity score
 */
function calculateSpecificity(selector) {
  let specificity = 0;
  // ID selectors
  specificity += (selector.match(/#/g) || []).length * 100;
  // Class selectors, attribute selectors, pseudo-classes
  specificity += (selector.match(/\./g) || []).length * 10;
  specificity += (selector.match(/\[/g) || []).length * 10;
  specificity += (selector.match(/:/g) || []).length * 10;
  // Element selectors
  specificity += (selector.match(/[a-zA-Z]/g) || []).length * 1;
  return specificity;
}

/**
 * Check if an element matches a CSS selector (simplified)
 * @param {Element} element - DOM element
 * @param {string} selector - CSS selector
 * @returns {boolean} Whether element matches selector
 */
function elementMatchesSelector(element, selector) {
  try {
    // Use native matches method with fallbacks
    const matches = element.matches || element.webkitMatchesSelector || element.mozMatchesSelector || element.msMatchesSelector;
    return matches && matches.call(element, selector);
  } catch (e) {
    // Fallback for complex selectors that might not be supported
    return false;
  }
}

/**
 * Apply CSS rules to elements and inline the styles
 * @param {Document} doc - Document object
 * @param {Array} cssRules - Array of CSS rules
 */
function applyCSSRules(doc, cssRules) {
  // Sort rules by specificity
  cssRules.sort((a, b) => calculateSpecificity(a.selector) - calculateSpecificity(b.selector));
  
  cssRules.forEach(rule => {
    try {
      const elements = doc.querySelectorAll(rule.selector);
      elements.forEach(element => {
        // Get existing inline styles
        const existingStyle = element.getAttribute('style') || '';
        const styleMap = {};
        
        // Parse existing inline styles
        if (existingStyle) {
          const styleDeclarations = existingStyle.split(';');
          styleDeclarations.forEach(decl => {
            const colonIndex = decl.indexOf(':');
            if (colonIndex > 0) {
              const prop = decl.substring(0, colonIndex).trim();
              const val = decl.substring(colonIndex + 1).trim();
              if (prop && val) {
                styleMap[prop] = val;
              }
            }
          });
        }
        
        // Add new CSS rule declarations (existing inline styles take precedence)
        Object.keys(rule.declarations).forEach(property => {
          if (!styleMap[property]) {
            styleMap[property] = rule.declarations[property];
          }
        });
        
        // Build new style attribute
        const newStyle = Object.keys(styleMap)
          .map(prop => `${prop}: ${styleMap[prop]}`)
          .join('; ');
        
        if (newStyle) {
          element.setAttribute('style', newStyle);
        }
      });
    } catch (e) {
      console.warn('Failed to process CSS selector:', rule.selector, e);
    }
  });
}

/**
 * Replace auto-generated IDs with UUIDs and update references
 * @param {Document} doc - Document object
 */
function replaceIDs(doc) {
  const idMap = new Map();
  
  // Find all elements with IDs starting with 'i' followed by numbers
  const elementsWithAutoIds = doc.querySelectorAll('[id^="i"]');
  
  elementsWithAutoIds.forEach(element => {
    const oldId = element.id;
    // Check if it's an auto-generated ID pattern (i followed by numbers)
    if (/^i\d+$/.test(oldId)) {
      const newId = generateUUID();
      idMap.set(oldId, newId);
      element.id = newId;
    }
  });
  
  // Update all references to the old IDs
  idMap.forEach((newId, oldId) => {
    // Update href attributes
    const hrefElements = doc.querySelectorAll(`[href="#${oldId}"]`);
    hrefElements.forEach(el => el.setAttribute('href', `#${newId}`));
    
    // Update for attributes (labels)
    const forElements = doc.querySelectorAll(`[for="${oldId}"]`);
    forElements.forEach(el => el.setAttribute('for', newId));
    
    // Update any other references in onclick or similar attributes
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      // Check onclick attributes
      const onclick = el.getAttribute('onclick');
      if (onclick && onclick.includes(oldId)) {
        el.setAttribute('onclick', onclick.replace(new RegExp(oldId, 'g'), newId));
      }
      
      // Check other common attributes that might reference IDs
      ['data-target', 'aria-controls', 'aria-labelledby', 'aria-describedby'].forEach(attr => {
        const value = el.getAttribute(attr);
        if (value === oldId) {
          el.setAttribute(attr, newId);
        } else if (value && value.includes(oldId)) {
          el.setAttribute(attr, value.replace(new RegExp(oldId, 'g'), newId));
        }
      });
    });
  });
}

/**
 * Main processing function - inline CSS and clean up IDs
 * @param {string} htmlContent - Raw HTML content with <style> tags
 * @returns {string} Processed HTML with inlined styles and clean IDs
 */
function processHTML(htmlContent) {
  // Create a new document
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Extract all CSS from <style> tags
  const styleTags = doc.querySelectorAll('style');
  let allCSS = '';
  
  styleTags.forEach(styleTag => {
    allCSS += styleTag.textContent + '\n';
  });
  
  // Parse CSS rules
  const cssRules = parseCSSRules(allCSS);
  
  // Apply CSS rules to elements (inline the styles)
  applyCSSRules(doc, cssRules);
  
  // Remove <style> tags after inlining
  styleTags.forEach(styleTag => {
    styleTag.remove();
  });
  
  // Replace auto-generated IDs with UUIDs
  replaceIDs(doc);
  
  // Return the processed HTML
  return doc.documentElement.outerHTML;
}

/**
 * Process HTML and trigger download (replaces juice server functionality)
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
    parseCSSRules,
    applyCSSRules,
    replaceIDs
  };
} else {
  // Browser environment - attach to window
  window.HTMLProcessor = {
    processHTML,
    processAndDownload,
    generateUUID,
    parseCSSRules,
    applyCSSRules,
    replaceIDs
  };
}