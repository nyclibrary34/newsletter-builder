/**
 * Filename Manager Module
 * Provides a unified interface for renaming files across the newsletter builder application
 * Handles validation, persistence, and UI updates for both editor and upload pages
 */

(function(window) {
  'use strict';

  // ========================================================================
  // CONSTANTS AND CONFIGURATION
  // ========================================================================
  const STORAGE_KEY = 'newsletter:filenames:v1';
  const VALID_CHARS_REGEX = /^[A-Za-z0-9\s\-_.()+]+$/;  // Added parentheses to allow (1), (2) etc.
  const MAX_LENGTH = 100;
  const MIN_LENGTH = 1;
  const RESERVED_NAMES = ['.', '..'];

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================
  
  /**
   * Remove .html extension from filename
   * @param {string} name - Full filename
   * @returns {string} Base name without extension
   */
  function stripHtmlExt(name) {
    if (!name) return '';
    return name.replace(/\.html$/i, '');
  }

  /**
   * Ensure filename has .html extension
   * @param {string} base - Base filename without extension
   * @returns {string} Full filename with .html extension
   */
  function ensureHtmlExt(base) {
    if (!base) return 'untitled.html';
    return base + '.html';
  }

  /**
   * Sanitize base filename
   * @param {string} base - Raw input
   * @returns {string} Sanitized base name
   */
  function sanitizeBase(base) {
    if (!base) return '';
    // Trim and collapse multiple spaces
    return base.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate base filename
   * @param {string} base - Base name to validate
   * @returns {{valid: boolean, error?: string}}
   */
  function validateBase(base) {
    const sanitized = sanitizeBase(base);
    
    if (!sanitized || sanitized.length < MIN_LENGTH) {
      return { valid: false, error: 'Filename cannot be empty' };
    }
    
    if (sanitized.length > MAX_LENGTH) {
      return { valid: false, error: `Filename cannot exceed ${MAX_LENGTH} characters` };
    }
    
    if (RESERVED_NAMES.includes(sanitized)) {
      return { valid: false, error: 'Reserved filename' };
    }
    
    if (!VALID_CHARS_REGEX.test(sanitized)) {
      return { valid: false, error: 'Use only letters, numbers, spaces, dashes, underscores, dots and parentheses' };
    }
    
    return { valid: true };
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get safe storage wrapper with fallback
   * @param {'local'|'session'} type - Storage type
   * @returns {object} Storage wrapper with getItem/setItem methods
   */
  function safeStorage(type = 'local') {
    const storage = type === 'session' ? window.sessionStorage : window.localStorage;
    
    return {
      getItem(key) {
        try {
          return storage.getItem(key);
        } catch (e) {
          console.warn(`Failed to read from ${type}Storage:`, e);
          return null;
        }
      },
      
      setItem(key, value) {
        try {
          storage.setItem(key, value);
          return true;
        } catch (e) {
          console.warn(`Failed to write to ${type}Storage:`, e);
          // Try fallback to other storage
          if (type === 'local') {
            return safeStorage('session').setItem(key, value);
          }
          return false;
        }
      }
    };
  }

  /**
   * Load filename map from storage
   * @param {'local'|'session'} storageType - Storage type
   * @returns {object} Filename map
   */
  function loadMap(storageType = 'local') {
    const storage = safeStorage(storageType);
    const data = storage.getItem(STORAGE_KEY);
    
    if (!data) {
      // Check for migration from old storage keys
      const oldKey = storage.getItem('filename_');
      if (oldKey) {
        // Migrate old data structure
        const map = { files: {} };
        // Migration logic would go here
        saveMap(map, storageType);
        return map;
      }
      return { files: {} };
    }
    
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse storage data:', e);
      return { files: {} };
    }
  }

  /**
   * Save filename map to storage
   * @param {object} map - Filename map
   * @param {'local'|'session'} storageType - Storage type
   * @returns {boolean} Success status
   */
  function saveMap(map, storageType = 'local') {
    const storage = safeStorage(storageType);
    try {
      return storage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Failed to save filename map:', e);
      return false;
    }
  }

  // ========================================================================
  // FILENAME MANAGER CLASS
  // ========================================================================
  
  class FilenameManager {
    constructor(options = {}) {
      // Merge options with defaults
      this.options = Object.assign({
        container: null,
        getInitialName: () => 'untitled.html',
        fileKey: null,
        storage: 'local',
        storageKeyPrefix: STORAGE_KEY,
        onNameChange: null,
        messages: {
          successTitle: 'Filename Updated',
          successText: 'File has been renamed to',
          invalidTitle: 'Invalid Filename',
          invalidText: null, // Will use validation error message
          emptyError: 'Filename cannot be empty',
          toast: true,
          toastTimer: 1500
        }
      }, options);
      
      // Instance properties
      this.container = null;
      this.currentBase = '';
      this.isEditing = false;
      this.elements = {};
      this.boundHandlers = {};
      
      // Derive fileKey if not provided
      if (!this.options.fileKey) {
        const initialName = this.options.getInitialName();
        this.options.fileKey = stripHtmlExt(initialName).toLowerCase().replace(/\s+/g, '-');
      }
    }

    /**
     * Initialize the filename manager
     */
    init() {
      // Find container element
      if (typeof this.options.container === 'string') {
        this.container = document.querySelector(this.options.container);
      } else {
        this.container = this.options.container;
      }
      
      if (!this.container) {
        console.error('FilenameManager: Container not found');
        return;
      }
      
      // Load initial name
      this.currentBase = this.getInitialBase();
      
      // Render UI
      this.render();
      
      // Bind events
      this.bindEvents();
    }

    /**
     * Get initial base name from storage or options
     * @returns {string} Base filename
     */
    getInitialBase() {
      // First check storage
      const map = loadMap(this.options.storage);
      const storedBase = map.files[this.options.fileKey];
      
      if (storedBase) {
        return storedBase;
      }
      
      // Fall back to initial name from options
      const initialName = this.options.getInitialName();
      return stripHtmlExt(initialName);
    }

    /**
     * Render the UI
     */
    render() {
      if (!this.container) return;
      
      // Clear container
      this.container.innerHTML = '';
      
      // Add class for styling
      this.container.classList.add('fnm');
      
      // Create elements
      if (this.isEditing) {
        this.renderEditMode();
      } else {
        this.renderViewMode();
      }
    }

    /**
     * Render view mode (display name with edit button)
     */
    renderViewMode() {
      // Create base name span
      const baseSpan = document.createElement('span');
      baseSpan.className = 'fnm__base';
      baseSpan.setAttribute('aria-label', 'Filename');
      baseSpan.textContent = this.currentBase;
      baseSpan.title = ensureHtmlExt(this.currentBase);
      
      // Create extension span
      const extSpan = document.createElement('span');
      extSpan.className = 'fnm__ext';
      extSpan.textContent = '.html';
      
      // Create edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'fnm__edit';
      editBtn.setAttribute('aria-label', 'Edit filename');
      editBtn.setAttribute('title', 'Edit filename (click or Alt+E)');
      editBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
        </svg>
      `;
      
      // Store references
      this.elements.baseSpan = baseSpan;
      this.elements.extSpan = extSpan;
      this.elements.editBtn = editBtn;
      
      // Append elements
      this.container.appendChild(baseSpan);
      this.container.appendChild(extSpan);
      this.container.appendChild(editBtn);
    }

    /**
     * Render edit mode (input field with save/cancel)
     */
    renderEditMode() {
      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'fnm__edit-wrapper';
      
      // Create input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'fnm__input';
      input.value = this.currentBase;
      input.setAttribute('aria-label', 'Edit filename');
      input.setAttribute('placeholder', 'Enter filename...');
      
      // Create extension display
      const extSpan = document.createElement('span');
      extSpan.className = 'fnm__ext-fixed';
      extSpan.textContent = '.html';
      
      // Create action buttons wrapper
      const actions = document.createElement('div');
      actions.className = 'fnm__actions';
      
      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'fnm__save';
      saveBtn.setAttribute('aria-label', 'Save');
      saveBtn.setAttribute('title', 'Save (Enter)');
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
        </svg>
      `;
      
      // Cancel button
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'fnm__cancel';
      cancelBtn.setAttribute('aria-label', 'Cancel');
      cancelBtn.setAttribute('title', 'Cancel (Escape)');
      cancelBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
        </svg>
      `;
      
      // Store references
      this.elements.input = input;
      this.elements.saveBtn = saveBtn;
      this.elements.cancelBtn = cancelBtn;
      this.elements.extSpan = extSpan;
      
      // Append elements
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      
      wrapper.appendChild(input);
      wrapper.appendChild(extSpan);
      wrapper.appendChild(actions);
      
      this.container.appendChild(wrapper);
      
      // Focus and select input text
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
      // View mode events
      if (!this.isEditing && this.elements.editBtn) {
        this.boundHandlers.editClick = () => this.enterEditMode();
        this.elements.editBtn.addEventListener('click', this.boundHandlers.editClick);
        
        // Keyboard shortcut (Alt+E)
        this.boundHandlers.keydown = (e) => {
          if (e.altKey && e.key === 'e') {
            e.preventDefault();
            this.enterEditMode();
          }
        };
        this.container.addEventListener('keydown', this.boundHandlers.keydown);
      }
      
      // Edit mode events
      if (this.isEditing) {
        // Save button
        if (this.elements.saveBtn) {
          this.boundHandlers.saveClick = () => this.save();
          this.elements.saveBtn.addEventListener('click', this.boundHandlers.saveClick);
        }
        
        // Cancel button
        if (this.elements.cancelBtn) {
          this.boundHandlers.cancelClick = () => this.exitEditMode(false);
          this.elements.cancelBtn.addEventListener('click', this.boundHandlers.cancelClick);
        }
        
        // Input events
        if (this.elements.input) {
          this.boundHandlers.inputKeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              this.exitEditMode(false);
            }
          };
          this.elements.input.addEventListener('keydown', this.boundHandlers.inputKeydown);
        }
      }
    }

    /**
     * Remove event handlers
     */
    unbindEvents() {
      // Remove all bound handlers
      Object.keys(this.boundHandlers).forEach(key => {
        const handler = this.boundHandlers[key];
        if (this.elements.editBtn && key === 'editClick') {
          this.elements.editBtn.removeEventListener('click', handler);
        }
        if (this.elements.saveBtn && key === 'saveClick') {
          this.elements.saveBtn.removeEventListener('click', handler);
        }
        if (this.elements.cancelBtn && key === 'cancelClick') {
          this.elements.cancelBtn.removeEventListener('click', handler);
        }
        if (this.elements.input && key === 'inputKeydown') {
          this.elements.input.removeEventListener('keydown', handler);
        }
        if (this.container && key === 'keydown') {
          this.container.removeEventListener('keydown', handler);
        }
      });
      
      this.boundHandlers = {};
    }

    /**
     * Enter edit mode
     */
    enterEditMode() {
      this.isEditing = true;
      this.unbindEvents();
      this.render();
      this.bindEvents();
    }

    /**
     * Exit edit mode
     * @param {boolean} save - Whether to save changes
     */
    exitEditMode(save = false) {
      if (save && this.elements.input) {
        const newBase = sanitizeBase(this.elements.input.value);
        const validation = validateBase(newBase);
        
        if (!validation.valid) {
          this.showError(validation.error);
          return;
        }
        
        // Check if name changed
        if (newBase === this.currentBase) {
          // No change, just exit
          this.isEditing = false;
          this.unbindEvents();
          this.render();
          this.bindEvents();
          return;
        }
        
        // Save to storage
        const map = loadMap(this.options.storage);
        map.files[this.options.fileKey] = newBase;
        
        if (saveMap(map, this.options.storage)) {
          this.currentBase = newBase;
          
          // Call change callback
          if (this.options.onNameChange) {
            const fullName = ensureHtmlExt(newBase);
            this.options.onNameChange(fullName, {
              base: newBase,
              key: this.options.fileKey
            });
          }
          
          // Show success message
          this.showSuccess(ensureHtmlExt(newBase));
        } else {
          this.showError('Failed to save filename');
          return;
        }
      }
      
      this.isEditing = false;
      this.unbindEvents();
      this.render();
      this.bindEvents();
    }

    /**
     * Save current changes
     */
    save() {
      this.exitEditMode(true);
    }

    /**
     * Show success message
     * @param {string} fullName - Full filename with extension
     */
    showSuccess(fullName) {
      if (typeof Swal !== 'undefined') {
        const config = {
          icon: 'success',
          title: this.options.messages.successTitle,
          text: `${this.options.messages.successText} "${fullName}"`,
          showConfirmButton: false
        };
        
        if (this.options.messages.toast) {
          config.toast = true;
          config.position = 'top-end';
          config.timer = this.options.messages.toastTimer;
        } else {
          config.timer = 2000;
        }
        
        Swal.fire(config);
      }
    }

    /**
     * Show error message
     * @param {string} error - Error message
     */
    showError(error) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: this.options.messages.invalidTitle,
          text: this.options.messages.invalidText || error,
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        }).then(() => {
          // Return focus to input
          if (this.elements.input) {
            this.elements.input.focus();
            this.elements.input.select();
          }
        });
      } else {
        alert(error);
      }
    }

    /**
     * Get current full filename
     * @returns {string} Full filename with extension
     */
    getCurrentFullName() {
      return ensureHtmlExt(this.currentBase);
    }

    /**
     * Set base filename programmatically
     * @param {string} base - New base name
     * @returns {Promise<void>}
     */
    async setBaseName(base) {
      const sanitized = sanitizeBase(base);
      const validation = validateBase(sanitized);
      
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      this.currentBase = sanitized;
      
      // Save to storage
      const map = loadMap(this.options.storage);
      map.files[this.options.fileKey] = sanitized;
      
      if (!saveMap(map, this.options.storage)) {
        throw new Error('Failed to save filename');
      }
      
      // Update UI if not editing
      if (!this.isEditing) {
        this.render();
      }
      
      // Call change callback
      if (this.options.onNameChange) {
        const fullName = ensureHtmlExt(sanitized);
        this.options.onNameChange(fullName, {
          base: sanitized,
          key: this.options.fileKey
        });
      }
    }

    /**
     * Update file context (for dynamic file changes)
     * @param {string} fileKey - New file key
     * @param {string} initialName - New initial name
     */
    updateContext(fileKey, initialName) {
      this.options.fileKey = fileKey;
      this.options.getInitialName = () => initialName;
      this.currentBase = this.getInitialBase();
      
      // Re-render if not editing
      if (!this.isEditing) {
        this.render();
      }
    }

    /**
     * Destroy the filename manager
     */
    destroy() {
      this.unbindEvents();
      if (this.container) {
        this.container.innerHTML = '';
        this.container.classList.remove('fnm');
      }
      this.elements = {};
      this.container = null;
    }
  }

  // ========================================================================
  // EXPORT
  // ========================================================================
  
  // Export for use in other scripts
  window.FilenameManager = FilenameManager;
  
  // Also export utilities for external use
  window.FilenameManager.utils = {
    stripHtmlExt,
    ensureHtmlExt,
    sanitizeBase,
    validateBase,
    escapeHtml
  };

})(window);
