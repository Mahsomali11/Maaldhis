/**
 * Global Double-Click & Duplicate Form Submission Guard
 * 
 * Intercepts user click events in the capture phase on primary action/submit buttons.
 * Immediately disables the button, replaces text/icon with a loading spinner,
 * and completely prevents duplicate clicks until the action completes or times out.
 */

let activeButtons = new Set<HTMLElement>();

/**
 * Checks if an element qualifies as a primary submit or action button.
 */
function isActionButton(el: HTMLElement): boolean {
  if (el.dataset.noGuard === 'true') return false;

  const tagName = el.tagName.toLowerCase();
  if (tagName !== 'button' && !(tagName === 'input' && (el as HTMLInputElement).type === 'submit')) {
    return false;
  }

  const button = el as HTMLButtonElement;

  // Submit buttons
  if (button.type === 'submit') return true;

  // Buttons inside forms without explicit type (default is submit)
  if (button.form && !button.getAttribute('type')) return true;

  // Check class list for primary or destructive styling
  const className = button.className || '';
  if (
    className.includes('bg-primary') ||
    className.includes('bg-destructive') ||
    className.includes('btn-primary') ||
    button.dataset.actionButton === 'true'
  ) {
    // Exclude purely cancel/close/hold buttons
    const text = (button.innerText || button.textContent || '').trim().toLowerCase();
    if (['cancel', 'close', 'hold', 'back', 'reset', 'clear'].includes(text)) {
      return false;
    }
    return true;
  }

  // Check text content for action keywords
  const text = (button.innerText || button.textContent || '').trim().toLowerCase();
  const actionKeywords = [
    'charge',
    'process purchase',
    'process return',
    'process partial return',
    'return full receipt',
    'submit payment',
    'submit',
    'save',
    'save changes',
    'save expense',
    'record payment',
    'record purchase',
    'record credit',
    'initiate transfer',
    'create store',
    'confirm return',
    'confirm',
  ];

  for (const keyword of actionKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Resets a guarded button back to its original interactive state.
 */
export function resetButton(button: HTMLElement | null) {
  if (!button) return;
  if (button.dataset.submitting !== 'true') return;

  activeButtons.delete(button);

  // Restore content
  if (button.dataset.originalHtml !== undefined) {
    button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }

  // Restore disabled state
  if (button.dataset.originalDisabled !== undefined) {
    (button as HTMLButtonElement).disabled = button.dataset.originalDisabled === 'true';
    delete button.dataset.originalDisabled;
  } else {
    (button as HTMLButtonElement).disabled = false;
  }

  // Restore minWidth
  if (button.dataset.originalMinWidth !== undefined) {
    button.style.minWidth = button.dataset.originalMinWidth;
    delete button.dataset.originalMinWidth;
  } else {
    button.style.minWidth = '';
  }

  delete button.dataset.submitting;
  button.removeAttribute('aria-busy');
}

/**
 * Resets all currently active guarded buttons.
 */
export function resetAllActionButtons() {
  activeButtons.forEach(btn => resetButton(btn));
  activeButtons.clear();
}

/**
 * Programmatic helper to execute an async action with global guard release.
 */
export async function guardAction<T>(actionFn: () => Promise<T>): Promise<T> {
  try {
    return await actionFn();
  } finally {
    window.dispatchEvent(new CustomEvent('action-complete'));
    resetAllActionButtons();
  }
}

/**
 * Initializes the global DOM click listener.
 */
export function initSubmitGuard() {
  if (typeof window === 'undefined') return;

  // Intercept clicks in capture phase to precede any synthetic/bubbled events
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const button = target.closest('button, input[type="submit"]') as HTMLButtonElement | null;
    if (!button) return;

    // 1. If button is already submitting, IMMEDIATELY drop this click
    if (button.dataset.submitting === 'true' || button.getAttribute('aria-busy') === 'true') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // 2. Check if this is an action or submit button
    if (!isActionButton(button)) {
      return;
    }

    // 3. If within a form, check HTML5 validation first
    if (button.form && typeof button.form.checkValidity === 'function') {
      if (!button.form.checkValidity()) {
        // Let standard browser form validation show missing field errors
        return;
      }
    }

    // 4. Mark as submitting synchronously to block any second click immediately
    button.dataset.submitting = 'true';
    button.setAttribute('aria-busy', 'true');
    activeButtons.add(button);

    // Freeze width to avoid visual layout jumping
    const rect = button.getBoundingClientRect();
    if (rect.width > 0) {
      button.dataset.originalMinWidth = button.style.minWidth || '';
      button.style.minWidth = `${Math.ceil(rect.width)}px`;
    }

    button.dataset.originalHtml = button.innerHTML;
    button.dataset.originalDisabled = button.disabled ? 'true' : 'false';

    // 5. In a microtask, disable the button and show spinner & "Processing..."
    // (A tiny delay ensures the browser still dispatches the initial click event to React)
    setTimeout(() => {
      if (button.dataset.submitting === 'true') {
        button.disabled = true;
        button.innerHTML = `
          <span class="inline-flex items-center justify-center gap-2 pointer-events-none">
            <svg class="animate-spin h-4 w-4 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
          </span>
        `;
      }
    }, 0);

    // 6. Safety timeout auto-recovery: restore after 3.5s if not reset sooner
    setTimeout(() => {
      resetButton(button);
    }, 3500);

  }, { capture: true, passive: false });

  // Listen for custom completion events
  window.addEventListener('action-complete', resetAllActionButtons);
  window.addEventListener('action-error', resetAllActionButtons);

  // Inertia page events
  document.addEventListener('inertia:finish', resetAllActionButtons);
  document.addEventListener('inertia:error', resetAllActionButtons);
}
