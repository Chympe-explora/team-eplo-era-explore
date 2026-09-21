/**
 * form-validation.js
 * -----------------------------------------------------------------------
 * Real-time form validation with friendly error messages
 * 
 * Features:
 * - Real-time validation as user types
 * - Field-level error messages
 * - Form-level validation
 * - Mobile keyboard support
 * - Accessibility (aria-invalid, aria-describedby)
 * -----------------------------------------------------------------------
 */

export class FormValidator {
  constructor(formElement, options = {}) {
    this.form = formElement;
    this.fields = {};
    this.errors = {};
    this.options = {
      showErrorsOnBlur: true,
      showErrorsOnChange: true,
      clearErrorsOnFocus: true,
      ...options
    };
    
    this.init();
  }
  
  init() {
    // Find all form fields
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(field => {
      const fieldName = field.name || field.id;
      if (!fieldName) return;
      
      this.fields[fieldName] = {
        element: field,
        rules: this.parseRules(field),
        value: field.value,
        touched: false
      };
      
      // Add event listeners
      if (this.options.showErrorsOnChange) {
        field.addEventListener('input', () => this.validateField(fieldName));
        field.addEventListener('change', () => this.validateField(fieldName));
      }
      
      if (this.options.showErrorsOnBlur) {
        field.addEventListener('blur', () => {
          this.fields[fieldName].touched = true;
          this.validateField(fieldName);
        });
      }
      
      if (this.options.clearErrorsOnFocus) {
        field.addEventListener('focus', () => {
          this.clearFieldError(fieldName);
        });
      }
    });
  }
  
  /**
   * Parse validation rules from HTML attributes
   * data-required: true
   * data-email: true
   * data-phone: true
   * data-minlength: 3
   * data-maxlength: 50
   * data-pattern: regex
   * data-match: #fieldId (match another field)
   */
  parseRules(element) {
    const rules = {};
    
    if (element.hasAttribute('required') || element.dataset.required) {
      rules.required = true;
    }
    
    if (element.type === 'email' || element.dataset.email) {
      rules.email = true;
    }
    
    if (element.dataset.phone) {
      rules.phone = true;
    }
    
    if (element.dataset.minlength) {
      rules.minlength = parseInt(element.dataset.minlength);
    }
    
    if (element.dataset.maxlength) {
      rules.maxlength = parseInt(element.dataset.maxlength);
    }
    
    if (element.dataset.pattern) {
      rules.pattern = new RegExp(element.dataset.pattern);
    }
    
    if (element.dataset.match) {
      rules.match = element.dataset.match;
    }
    
    return rules;
  }
  
  /**
   * Validate a single field
   */
  validateField(fieldName) {
    const field = this.fields[fieldName];
    if (!field) return true;
    
    const element = field.element;
    const value = element.value.trim();
    const rules = field.rules;
    
    // Skip if not touched and not showing errors on change
    if (!field.touched && !this.options.showErrorsOnChange) {
      return true;
    }
    
    // Check each rule
    const errors = [];
    
    // Required
    if (rules.required && !value) {
      errors.push(this.getErrorMessage('required', element.placeholder || element.name));
    }
    
    // Email
    if (rules.email && value && !this.isValidEmail(value)) {
      errors.push(this.getErrorMessage('email'));
    }
    
    // Phone
    if (rules.phone && value && !this.isValidPhone(value)) {
      errors.push(this.getErrorMessage('phone'));
    }
    
    // Min length
    if (rules.minlength && value && value.length < rules.minlength) {
      errors.push(this.getErrorMessage('minlength', rules.minlength));
    }
    
    // Max length
    if (rules.maxlength && value && value.length > rules.maxlength) {
      errors.push(this.getErrorMessage('maxlength', rules.maxlength));
    }
    
    // Pattern
    if (rules.pattern && value && !rules.pattern.test(value)) {
      errors.push(this.getErrorMessage('pattern'));
    }
    
    // Match another field
    if (rules.match && value) {
      const matchElement = document.querySelector(rules.match);
      if (matchElement && matchElement.value !== value) {
        errors.push(this.getErrorMessage('match', matchElement.placeholder || 'Password'));
      }
    }
    
    // Update UI
    if (errors.length > 0) {
      this.showFieldError(fieldName, errors[0]);
      this.errors[fieldName] = errors[0];
      return false;
    } else {
      this.clearFieldError(fieldName);
      delete this.errors[fieldName];
      return true;
    }
  }
  
  /**
   * Validate entire form
   */
  validateForm() {
    let isValid = true;
    
    Object.keys(this.fields).forEach(fieldName => {
      this.fields[fieldName].touched = true;
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });
    
    return isValid;
  }
  
  /**
   * Show field error
   */
  showFieldError(fieldName, message) {
    const field = this.fields[fieldName];
    const element = field.element;
    
    // Add error class
    element.classList.add('field-error');
    element.setAttribute('aria-invalid', 'true');
    
    // Create or update error message
    let errorEl = element.nextElementSibling;
    if (!errorEl || !errorEl.classList.contains('field-error-message')) {
      errorEl = document.createElement('div');
      errorEl.className = 'field-error-message';
      element.parentNode.insertBefore(errorEl, element.nextSibling);
    }
    
    errorEl.textContent = message;
    errorEl.setAttribute('role', 'alert');
    element.setAttribute('aria-describedby', errorEl.id || 'error-' + fieldName);
  }
  
  /**
   * Clear field error
   */
  clearFieldError(fieldName) {
    const field = this.fields[fieldName];
    const element = field.element;
    
    element.classList.remove('field-error');
    element.setAttribute('aria-invalid', 'false');
    
    const errorEl = element.nextElementSibling;
    if (errorEl && errorEl.classList.contains('field-error-message')) {
      errorEl.remove();
    }
  }
  
  /**
   * Get friendly error messages
   */
  getErrorMessage(type, extra) {
    const messages = {
      required: `${extra} is required`,
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      minlength: `Must be at least ${extra} characters`,
      maxlength: `Must not exceed ${extra} characters`,
      pattern: 'Please enter a valid format',
      match: `Passwords do not match`
    };
    
    return messages[type] || 'Invalid input';
  }
  
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  /**
   * Validate phone format
   */
  isValidPhone(phone) {
    // Accept +91, 91, or just 10 digits
    const re = /^(\+?91|0)?[6-9]\d{9}$/;
    return re.test(phone.replace(/[\s-()]/g, ''));
  }
  
  /**
   * Get form data as object
   */
  getFormData() {
    const data = {};
    Object.keys(this.fields).forEach(fieldName => {
      data[fieldName] = this.fields[fieldName].element.value;
    });
    return data;
  }
  
  /**
   * Set form data from object
   */
  setFormData(data) {
    Object.entries(data).forEach(([fieldName, value]) => {
      if (this.fields[fieldName]) {
        this.fields[fieldName].element.value = value;
      }
    });
  }
  
  /**
   * Has errors
   */
  hasErrors() {
    return Object.keys(this.errors).length > 0;
  }
  
  /**
   * Get all errors
   */
  getErrors() {
    return this.errors;
  }
}

/**
 * CSS styles for form validation
 * Add this to your main CSS file:
 */
export const validationStyles = `
  .field-error {
    border-color: #ef4444 !important;
    background-color: rgba(239, 68, 68, 0.05);
  }
  
  .field-error:focus {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }
  
  .field-error-message {
    color: #ef4444;
    font-size: 12px;
    margin-top: 4px;
    padding: 0 4px;
    display: block;
    animation: slideDown 0.2s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .form-success .field-error {
    border-color: #22c55e;
    background-color: rgba(34, 197, 94, 0.05);
  }
  
  .form-success .field-error-message {
    color: #22c55e;
  }
`;

/**
 * Initialize all forms on the page
 * Call this after page load
 */
export function initializeAllForms(options = {}) {
  const forms = document.querySelectorAll('form[data-validate="true"], .needs-validation');
  
  const validators = {};
  forms.forEach((form, index) => {
    const formId = form.id || `form-${index}`;
    validators[formId] = new FormValidator(form, options);
  });
  
  return validators;
}

/**
 * Example usage in HTML:
 * <form id="bookingForm" data-validate="true">
 *   <div class="form-group">
 *     <label>Email</label>
 *     <input type="email" name="email" required data-email>
 *   </div>
 *   <div class="form-group">
 *     <label>Phone</label>
 *     <input type="tel" name="phone" required data-phone>
 *   </div>
 *   <button type="submit">Submit</button>
 * </form>
 * 
 * <script type="module">
 *   import { FormValidator } from './form-validation.js';
 *   
 *   const form = document.getElementById('bookingForm');
 *   const validator = new FormValidator(form);
 *   
 *   form.addEventListener('submit', (e) => {
 *     e.preventDefault();
 *     if (validator.validateForm()) {
 *       const data = validator.getFormData();
 *       // Submit data
 *       console.log(data);
 *     }
 *   });
 * </script>
 */
