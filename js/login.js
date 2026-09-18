/**
 * NEOCARE Doctor Dashboard — Login Page Controller
 * ─────────────────────────────────────────────────
 * Stage 2: Controls login page behavior.
 *
 * Responsibilities:
 *   - Redirect already-authenticated users to the dashboard.
 *   - Wire up the login form: validation, submission, loading state.
 *   - Handle password show/hide toggle.
 *   - Handle Forgot Password modal open/close.
 *   - Handle demo credential fill buttons.
 *
 * Depends on:
 *   - NeoCareAuth (js/auth.js) — must be loaded first.
 *
 * Does NOT contain:
 *   - Session storage logic (that lives in auth.js).
 *   - Dashboard UI logic (that will live in dashboard.js).
 */

'use strict';

(function LoginController() {

  /* ══════════════════════════════════════════
     GUARD: already authenticated?
  ══════════════════════════════════════════ */

  // If a valid session already exists, go straight to the dashboard.
  if (NeoCareAuth.isAuthenticated()) {
    window.location.href = 'pages/dashboard.html';
    return; // stop executing login page logic
  }

  /* ══════════════════════════════════════════
     DOM REFERENCES
  ══════════════════════════════════════════ */

  const form              = document.getElementById('login-form');
  const emailInput        = document.getElementById('login-email');
  const passwordInput     = document.getElementById('login-password');
  const rememberMeInput   = document.getElementById('remember-me');
  const submitBtn         = document.getElementById('login-submit');
  const btnLabel          = document.getElementById('btn-label');
  const btnSpinner        = document.getElementById('btn-spinner');

  // Error elements
  const formErrorBanner   = document.getElementById('form-error-banner');
  const formErrorText     = document.getElementById('form-error-text');
  const emailError        = document.getElementById('email-error');
  const passwordError     = document.getElementById('password-error');
  const emailGroup        = document.getElementById('email-group');
  const passwordGroup     = document.getElementById('password-group');

  // Password visibility toggle
  const togglePasswordBtn = document.getElementById('toggle-password');
  const eyeShow           = document.getElementById('eye-icon-show');
  const eyeHide           = document.getElementById('eye-icon-hide');

  // Forgot password modal
  const forgotBtn         = document.getElementById('forgot-password-btn');
  const modalOverlay      = document.getElementById('forgot-modal-overlay');
  const modalClose        = document.getElementById('forgot-modal-close');

  // Demo credential fill buttons
  const fillBtns          = document.querySelectorAll('.demo-fill-btn');

  /* ══════════════════════════════════════════
     VALIDATION HELPERS
  ══════════════════════════════════════════ */

  /**
   * Displays a field-level error.
   *
   * @param {HTMLElement} inputEl   - The input element.
   * @param {HTMLElement} errorEl   - The error <span>.
   * @param {string}      message   - Error text.
   */
  function showFieldError(inputEl, errorEl, message) {
    inputEl.classList.add('input-error');
    inputEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  /**
   * Clears a field-level error.
   *
   * @param {HTMLElement} inputEl
   * @param {HTMLElement} errorEl
   */
  function clearFieldError(inputEl, errorEl) {
    inputEl.classList.remove('input-error');
    inputEl.removeAttribute('aria-invalid');
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  /**
   * Shows the form-level error banner.
   *
   * @param {string} message
   */
  function showFormError(message) {
    formErrorText.textContent = message;
    formErrorBanner.hidden = false;
  }

  /** Hides the form-level error banner. */
  function hideFormError() {
    formErrorBanner.hidden = true;
    formErrorText.textContent = '';
  }

  /**
   * Validates the email field.
   * Returns true if valid, false otherwise.
   *
   * @returns {boolean}
   */
  function validateEmail() {
    const value = emailInput.value.trim();

    if (!value) {
      showFieldError(emailInput, emailError, 'Please enter your email.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address.');
      return false;
    }

    clearFieldError(emailInput, emailError);
    return true;
  }

  /**
   * Validates the password field.
   * Returns true if valid, false otherwise.
   *
   * @returns {boolean}
   */
  function validatePassword() {
    const value = passwordInput.value;

    if (!value) {
      showFieldError(passwordInput, passwordError, 'Please enter your password.');
      return false;
    }

    clearFieldError(passwordInput, passwordError);
    return true;
  }

  /* ══════════════════════════════════════════
     LOADING STATE
  ══════════════════════════════════════════ */

  /** Switches the submit button to its loading/processing state. */
  function setLoading(isLoading) {
    submitBtn.disabled  = isLoading;
    btnLabel.textContent = isLoading ? 'Signing in…' : 'Sign In';
    btnSpinner.hidden   = !isLoading;
  }

  /* ══════════════════════════════════════════
     FORM SUBMISSION
  ══════════════════════════════════════════ */

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormError();

    // Run both validations; collect results before early returns
    const emailOk    = validateEmail();
    const passwordOk = validatePassword();

    if (!emailOk || !passwordOk) {
      return; // Focus will remain on the first errored field naturally
    }

    setLoading(true);

    try {
      const result = await NeoCareAuth.login(
        emailInput.value.trim(),
        passwordInput.value,
        rememberMeInput.checked
      );

      if (result.ok) {
        // Success: redirect to dashboard
        window.location.href = 'pages/dashboard.html';
      } else {
        // Auth failure: show inline error, stay on page
        setLoading(false);
        showFormError(result.error || 'Invalid email or password.');
        // Highlight both fields to indicate the combination was wrong
        emailInput.classList.add('input-error');
        passwordInput.classList.add('input-error');
        emailInput.focus();
      }
    } catch (err) {
      // Unexpected error
      setLoading(false);
      showFormError('An unexpected error occurred. Please try again.');
      console.error('[LoginController] Unexpected auth error:', err);
    }
  });

  /* ══════════════════════════════════════════
     INLINE VALIDATION ON BLUR
     Clear errors as the user corrects their input.
  ══════════════════════════════════════════ */

  emailInput.addEventListener('blur', () => {
    if (emailInput.value.trim()) {
      validateEmail();
    }
  });

  emailInput.addEventListener('input', () => {
    // Clear error state as user types (after it was shown)
    if (emailInput.classList.contains('input-error')) {
      clearFieldError(emailInput, emailError);
      hideFormError();
    }
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.classList.contains('input-error')) {
      clearFieldError(passwordInput, passwordError);
      hideFormError();
    }
  });

  /* ══════════════════════════════════════════
     PASSWORD VISIBILITY TOGGLE
  ══════════════════════════════════════════ */

  togglePasswordBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';

    passwordInput.type = isHidden ? 'text' : 'password';

    // Swap icons
    eyeShow.hidden = isHidden;
    eyeHide.hidden = !isHidden;

    // Update ARIA
    togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    togglePasswordBtn.setAttribute('aria-pressed', String(isHidden));
  });

  /* ══════════════════════════════════════════
     FORGOT PASSWORD MODAL
  ══════════════════════════════════════════ */

  /** Opens the forgot-password modal. */
  function openModal() {
    modalOverlay.hidden = false;
    modalOverlay.setAttribute('aria-hidden', 'false');
    // Move focus to the close button for keyboard users
    modalClose.focus();
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
  }

  /** Closes the forgot-password modal. */
  function closeModal() {
    modalOverlay.hidden = true;
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Return focus to the trigger
    forgotBtn.focus();
  }

  forgotBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);

  // Close on overlay click (outside the card)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) {
      closeModal();
    }
  });

  /* ══════════════════════════════════════════
     DEMO CREDENTIAL FILL BUTTONS
     Clicking a credential value fills the matching input.
  ══════════════════════════════════════════ */

  fillBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const value    = btn.dataset.value;
      const target   = document.getElementById(targetId);

      if (target && value) {
        target.value = value;
        // Clear any existing error state on the field
        if (targetId === 'login-email') {
          clearFieldError(emailInput, emailError);
        } else if (targetId === 'login-password') {
          clearFieldError(passwordInput, passwordError);
        }
        hideFormError();
      }
    });
  });

})();
