/**
 * save-progress.js
 * -----------------------------------------------------------------------
 * Auto-save booking form progress to localStorage
 * 
 * Features:
 * - Auto-save form as user types (debounced)
 * - Recover saved progress on page reload
 * - Clear saved progress after successful booking
 * - Show "unsaved changes" indicator
 * - Per-site and per-package progress storage
 * 
 * Storage structure:
 * localStorage['booking-progress:siteId:packageKey'] = {
 *   data: { name, email, phone, travelers, ... },
 *   savedAt: timestamp,
 *   expiresAt: timestamp (7 days)
 * }
 * -----------------------------------------------------------------------
 */

export class SaveProgress {
  constructor(formElement, siteId, packageKey, options = {}) {
    this.form = formElement;
    this.siteId = siteId;
    this.packageKey = packageKey;
    this.storageKey = `booking-progress:${siteId}:${packageKey}`;
    this.autoSaveDelay = options.autoSaveDelay || 2000; // 2 seconds
    this.expiryDays = options.expiryDays || 7;
    
    this.autoSaveTimer = null;
    this.hasUnsavedChanges = false;
    this.lastSavedData = null;
    
    this.init();
  }
  
  init() {
    // Recover saved progress on load
    this.recoverProgress();
    
    // Listen to form changes
    this.form.addEventListener('input', () => this.onFormChange());
    this.form.addEventListener('change', () => this.onFormChange());
    
    // Save before leaving
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        this.saveProgress();
      }
    });
    
    // Clear on successful submit
    this.form.addEventListener('submit', (e) => {
      // Don't clear immediately - let the submit complete first
      setTimeout(() => this.clearProgress(), 1000);
    });
  }
  
  /**
   * Called when form changes
   */
  onFormChange() {
    this.hasUnsavedChanges = true;
    
    // Show unsaved indicator
    this.showUnsavedIndicator();
    
    // Debounce auto-save
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveProgress();
    }, this.autoSaveDelay);
  }
  
  /**
   * Get current form data
   */
  getFormData() {
    const data = {};
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(field => {
      const name = field.name || field.id;
      if (name) {
        if (field.type === 'checkbox') {
          data[name] = field.checked;
        } else if (field.type === 'radio') {
          if (field.checked) data[name] = field.value;
        } else {
          data[name] = field.value;
        }
      }
    });
    
    return data;
  }
  
  /**
   * Save progress to localStorage
   */
  saveProgress() {
    try {
      const data = this.getFormData();
      const now = Date.now();
      const expiresAt = now + (this.expiryDays * 24 * 60 * 60 * 1000);
      
      const progress = {
        data,
        savedAt: now,
        expiresAt,
        siteId: this.siteId,
        packageKey: this.packageKey
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(progress));
      
      this.lastSavedData = data;
      this.hasUnsavedChanges = false;
      this.hideUnsavedIndicator();
      
      // Show save notification
      this.showSaveNotification('Progress saved automatically');
      
      return true;
    } catch (e) {
      console.error('Failed to save progress:', e);
      return false;
    }
  }
  
  /**
   * Recover saved progress from localStorage
   */
  recoverProgress() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return false;
      
      const progress = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() > progress.expiresAt) {
        this.clearProgress();
        return false;
      }
      
      // Restore form data
      this.restoreFormData(progress.data);
      
      this.lastSavedData = progress.data;
      this.hasUnsavedChanges = false;
      
      // Show recovery message
      this.showRecoveryNotification(progress);
      
      return true;
    } catch (e) {
      console.error('Failed to recover progress:', e);
      return false;
    }
  }
  
  /**
   * Restore form data
   */
  restoreFormData(data) {
    Object.entries(data).forEach(([name, value]) => {
      let field = this.form.querySelector(`[name="${name}"]`);
      if (!field) {
        field = this.form.querySelector(`#${name}`);
      }
      
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = value === true;
        } else if (field.type === 'radio') {
          const radio = this.form.querySelector(`[name="${name}"][value="${value}"]`);
          if (radio) radio.checked = true;
        } else {
          field.value = value;
        }
        
        // Trigger change event for dependent fields
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  
  /**
   * Clear saved progress
   */
  clearProgress() {
    try {
      localStorage.removeItem(this.storageKey);
      this.lastSavedData = null;
      this.hasUnsavedChanges = false;
      this.hideUnsavedIndicator();
      return true;
    } catch (e) {
      console.error('Failed to clear progress:', e);
      return false;
    }
  }
  
  /**
   * Show unsaved changes indicator
   */
  showUnsavedIndicator() {
    let indicator = document.getElementById('unsaved-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'unsaved-indicator';
      indicator.className = 'unsaved-indicator';
      indicator.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>
          Unsaved changes
        </span>
      `;
      document.body.insertBefore(indicator, document.body.firstChild);
    }
    indicator.style.display = 'flex';
  }
  
  /**
   * Hide unsaved changes indicator
   */
  hideUnsavedIndicator() {
    const indicator = document.getElementById('unsaved-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
  
  /**
   * Show save notification
   */
  showSaveNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'save-notification';
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => {
      notif.style.animation = 'slideDown 0.3s ease-out forwards';
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }
  
  /**
   * Show recovery notification
   */
  showRecoveryNotification(progress) {
    const savedTime = new Date(progress.savedAt).toLocaleString();
    const notif = document.createElement('div');
    notif.className = 'recovery-notification';
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000;
      max-width: 300px;
      animation: slideUp 0.3s ease-out;
    `;
    notif.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">We found your saved progress!</div>
      <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 12px;">Saved at ${savedTime}</div>
      <div style="display: flex; gap: 10px;">
        <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Keep</button>
        <button onclick="location.reload()" style="background: rgba(239, 68, 68, 0.3); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Start Over</button>
      </div>
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => {
      if (notif.parentElement) {
        notif.style.animation = 'slideDown 0.3s ease-out forwards';
        setTimeout(() => notif.remove(), 300);
      }
    }, 8000);
  }
  
  /**
   * Get time since last save
   */
  getTimeSinceSave() {
    if (!this.lastSavedData) return null;
    
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return null;
    
    const progress = JSON.parse(stored);
    const seconds = Math.floor((Date.now() - progress.savedAt) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  
  /**
   * Get all saved progresses (across all sites/packages)
   */
  static getAllSavedProgress() {
    const all = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('booking-progress:')) {
        try {
          const progress = JSON.parse(localStorage.getItem(key));
          
          // Check if expired
          if (Date.now() <= progress.expiresAt) {
            all[key] = progress;
          } else {
            localStorage.removeItem(key);
          }
        } catch (e) {
          console.error('Error reading saved progress:', e);
        }
      }
    }
    
    return all;
  }
  
  /**
   * Clear all saved progresses
   */
  static clearAllSavedProgress() {
    const all = SaveProgress.getAllSavedProgress();
    Object.keys(all).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

/**
 * CSS for save progress UI
 */
export const saveProgressStyles = `
  #unsaved-indicator {
    position: fixed;
    top: 0;
    right: 0;
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
    padding: 12px 20px;
    z-index: 999;
    font-size: 13px;
    border-left: 2px solid #ef4444;
    display: none;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideDown {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(20px);
    }
  }
`;

/**
 * Example usage in HTML:
 * 
 * <form id="bookingForm">
 *   <input type="text" name="name" placeholder="Full Name">
 *   <input type="email" name="email" placeholder="Email">
 *   <button type="submit">Book Now</button>
 * </form>
 * 
 * <script type="module">
 *   import { SaveProgress } from './save-progress.js';
 *   
 *   const form = document.getElementById('bookingForm');
 *   const saver = new SaveProgress(form, 'krem-chympe', 'sharedTour', {
 *     autoSaveDelay: 2000,
 *     expiryDays: 7
 *   });
 * </script>
 */
