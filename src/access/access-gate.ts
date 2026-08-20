export type AccessAttempt = 'grant' | 'easter-egg' | 'reject';

export const ACCESS_STORAGE_KEY = 'viva:casual-access:v1';
export const ACCESS_STORAGE_VALUE = 'granted';
export const ACCESS_EASTER_EGG_MESSAGE = "Dulberger's one too";
export const ACCESS_EASTER_EGG_DURATION_MS = 3_600;

const PRIMARY_ACCESS_PHRASE = 'ShotgunsDueSoon';
const EASTER_EGG_PHRASE = 'TaylorsAHoe';

export interface AccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface AccessGateDocument {
  getElementById(id: string): AccessElement | null;
}

export interface AccessElement {
  hidden?: boolean;
  inert?: boolean;
  value?: string;
  checked?: boolean;
  textContent?: string | null;
  className?: string;
  disabled?: boolean;
  isConnected?: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute?(name: string): string | null;
  addEventListener(type: string, listener: (event: AccessEvent) => void): void;
  removeEventListener?(type: string, listener: (event: AccessEvent) => void): void;
  focus(options?: FocusOptions): void;
}

export interface AccessEvent {
  preventDefault(): void;
}

export interface AccessGateOptions {
  document?: AccessGateDocument | null;
  storage?: AccessStorage | null;
  persistentStorage?: AccessStorage | null;
  onGranted: () => void;
  setTimeout?: (callback: () => void, delay: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

export interface AccessGateController {
  initialize(): void;
  destroy(): void;
}

function globalDocument(): AccessGateDocument | null {
  return (globalThis as unknown as { document?: AccessGateDocument }).document || null;
}

function globalSessionStorage(): AccessStorage | null {
  try {
    return (globalThis as unknown as { sessionStorage?: AccessStorage }).sessionStorage || null;
  } catch {
    return null;
  }
}

function globalLocalStorage(): AccessStorage | null {
  try {
    return (globalThis as unknown as { localStorage?: AccessStorage }).localStorage || null;
  } catch {
    return null;
  }
}

function resolveStorage(storage: AccessStorage | null | undefined, fallback: () => AccessStorage | null): AccessStorage | null {
  return storage === undefined ? fallback() : storage;
}

export function evaluateAccessAttempt(value: string): AccessAttempt {
  if (value === PRIMARY_ACCESS_PHRASE) return 'grant';
  if (value === EASTER_EGG_PHRASE) return 'easter-egg';
  return 'reject';
}

function hasAccessGrantFrom(storage: AccessStorage | null | undefined, fallback: () => AccessStorage | null): boolean {
  try {
    return resolveStorage(storage, fallback)?.getItem(ACCESS_STORAGE_KEY) === ACCESS_STORAGE_VALUE;
  } catch {
    return false;
  }
}

export function hasAccessGrant(storage?: AccessStorage | null): boolean {
  return hasAccessGrantFrom(storage, globalSessionStorage);
}

function writeAccessGrantTo(storage: AccessStorage | null | undefined, fallback: () => AccessStorage | null): boolean {
  try {
    const target = resolveStorage(storage, fallback);
    if (!target) return false;
    target.setItem(ACCESS_STORAGE_KEY, ACCESS_STORAGE_VALUE);
    return true;
  } catch {
    return false;
  }
}

export function writeAccessGrant(storage?: AccessStorage | null): boolean {
  return writeAccessGrantTo(storage, globalSessionStorage);
}

function clearAccessGrantFrom(storage: AccessStorage | null | undefined, fallback: () => AccessStorage | null): boolean {
  try {
    const target = resolveStorage(storage, fallback);
    if (!target || typeof target.removeItem !== 'function') return false;
    target.removeItem(ACCESS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearAccessGrant(storage?: AccessStorage | null): boolean {
  return clearAccessGrantFrom(storage, globalSessionStorage);
}

export function hasPersistentAccessGrant(storage?: AccessStorage | null): boolean {
  return hasAccessGrantFrom(storage, globalLocalStorage);
}

export function writePersistentAccessGrant(storage?: AccessStorage | null): boolean {
  return writeAccessGrantTo(storage, globalLocalStorage);
}

export function clearPersistentAccessGrant(storage?: AccessStorage | null): boolean {
  return clearAccessGrantFrom(storage, globalLocalStorage);
}

function setShellLocked(shell: AccessElement | null, locked: boolean): void {
  if (!shell) return;
  shell.hidden = locked;
  shell.inert = locked;
  if (locked) {
    shell.setAttribute('inert', '');
    shell.setAttribute('aria-hidden', 'true');
  } else {
    shell.removeAttribute('inert');
    shell.removeAttribute('aria-hidden');
  }
}

function setGateVisible(gate: AccessElement | null, visible: boolean): void {
  if (gate) gate.hidden = !visible;
}

function clearStatus(status: AccessElement | null): void {
  if (!status) return;
  status.textContent = '';
  status.removeAttribute('data-access-result');
}

function showStatus(status: AccessElement | null, message: string, result: AccessAttempt): void {
  if (!status) return;
  status.textContent = message;
  if (result === 'easter-egg') status.setAttribute('data-access-result', result);
  else status.removeAttribute('data-access-result');
}

export function createAccessGate(options: AccessGateOptions): AccessGateController {
  const doc = options.document || globalDocument();
  const storage = options.storage;
  const persistentStorage = options.persistentStorage;
  const setTimer = options.setTimeout || ((callback, delay) => globalThis.setTimeout(callback, delay));
  const clearTimer = options.clearTimeout || (handle => globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]));
  let initialized = false;
  let started = false;
  let eggTimer: unknown = null;
  let form: AccessElement | null = null;
  let gateMain: AccessElement | null = null;
  let input: AccessElement | null = null;
  let remember: AccessElement | null = null;
  let status: AccessElement | null = null;
  let shell: AccessElement | null = null;
  let forgetButton: AccessElement | null = null;
  let eggSequence = 0;

  const focusInput = () => input?.focus();
  const resetInput = (invalid: boolean) => {
    if (!input) return;
    input.value = '';
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    focusInput();
  };
  const cancelEggStatusTimer = () => {
    if (eggTimer !== null) {
      clearTimer(eggTimer);
      eggTimer = null;
    }
    eggSequence += 1;
  };

  const grant = () => {
    if (started) return;
    started = true;
    cancelEggStatusTimer();
    writeAccessGrant(storage);
    if (remember?.checked) writePersistentAccessGrant(persistentStorage);
    clearStatus(status);
    if (input) {
      input.value = '';
      input.setAttribute('aria-invalid', 'false');
    }
    setGateVisible(gateMain, false);
    setGateVisible(form, false);
    setShellLocked(shell, false);
    doc?.getElementById('mainContent')?.focus();
    options.onGranted();
  };

  const lock = () => {
    started = false;
    cancelEggStatusTimer();
    clearAccessGrant(storage);
    clearPersistentAccessGrant(persistentStorage);
    clearStatus(status);
    if (input) {
      input.value = '';
      input.setAttribute('aria-invalid', 'false');
    }
    if (remember) remember.checked = false;
    setGateVisible(gateMain, true);
    setGateVisible(form, true);
    setShellLocked(shell, true);
    focusInput();
  };

  const onSubmit = (event: AccessEvent) => {
    event.preventDefault();
    if (started) return;
    const value = input?.value || '';
    const result = evaluateAccessAttempt(value);
    if (result === 'grant') {
      grant();
      return;
    }
    if (result === 'easter-egg') {
      cancelEggStatusTimer();
      const sequence = ++eggSequence;
      showStatus(status, ACCESS_EASTER_EGG_MESSAGE, result);
      resetInput(false);
      eggTimer = setTimer(() => {
        if (sequence !== eggSequence) return;
        eggTimer = null;
        clearStatus(status);
      }, ACCESS_EASTER_EGG_DURATION_MS);
      return;
    }
    cancelEggStatusTimer();
    showStatus(status, 'That phrase did not work. Try again.', result);
    resetInput(true);
  };

  const onForget = () => {
    lock();
  };

  const onInput = () => {
    if (!input || started) return;
    input.setAttribute('aria-invalid', 'false');
    if (status?.getAttribute?.('data-access-result') !== 'easter-egg') clearStatus(status);
  };

  const initialize = () => {
    if (initialized) return;
    initialized = true;
    gateMain = doc?.getElementById('accessGateMain') || null;
    form = doc?.getElementById('accessGate') || null;
    input = doc?.getElementById('accessPhrase') || null;
    remember = doc?.getElementById('accessRemember') || null;
    status = doc?.getElementById('accessGateStatus') || null;
    shell = doc?.getElementById('appShell') || null;
    forgetButton = doc?.getElementById('forgetAccessButton') || null;
    setGateVisible(gateMain, true);
    setGateVisible(form, true);
    setShellLocked(shell, true);
    form?.addEventListener('submit', onSubmit);
    input?.addEventListener('input', onInput);
    forgetButton?.addEventListener('click', onForget);
    if (hasAccessGrant(storage) || hasPersistentAccessGrant(persistentStorage)) {
      grant();
      return;
    }
    input?.setAttribute('aria-invalid', 'false');
    focusInput();
  };

  const destroy = () => {
    if (!initialized) return;
    form?.removeEventListener?.('submit', onSubmit);
    input?.removeEventListener?.('input', onInput);
    forgetButton?.removeEventListener?.('click', onForget);
    cancelEggStatusTimer();
    initialized = false;
  };

  return { initialize, destroy };
}
