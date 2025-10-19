import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

const DEFAULT_DIALOG_TITLE = 'Share this content';

function normalizeShareData(data = {}) {
  const { title = '', text = '', url = '', dialogTitle = DEFAULT_DIALOG_TITLE } = data;
  return { title, text, url, dialogTitle };
}

async function shareViaCapacitor(payload) {
  if (!Capacitor?.isNativePlatform?.()) {
    return { completed: false, reason: 'not-native' };
  }

  if (!Share || typeof Share.share !== 'function') {
    return { completed: false, reason: 'plugin-missing' };
  }

  try {
    if (typeof Share.canShare === 'function') {
      const { value } = await Share.canShare(payload);
      if (!value) {
        return { completed: false, reason: 'plugin-unavailable' };
      }
    }

    await Share.share(payload);
    return { completed: true, method: 'capacitor-share' };
  } catch (error) {
    console.warn('[Share] Native share failed, falling back to web handling.', error);
    return { completed: false, reason: 'native-error', error };
  }
}

async function shareViaWebApi(payload) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { completed: false, reason: 'web-share-unsupported' };
  }

  try {
    await navigator.share(payload);
    return { completed: true, method: 'web-share-api' };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { completed: false, reason: 'user-dismissed' };
    }

    console.warn('[Share] Web Share API failed, falling back to clipboard.', error);
    return { completed: false, reason: 'web-share-error', error };
  }
}

async function shareViaClipboard(payload) {
  const textToCopy = [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
  if (!textToCopy) {
    return { completed: false, reason: 'no-content' };
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return { completed: true, method: 'clipboard-copy' };
    } catch (error) {
      console.warn('[Share] Clipboard copy failed.', error);
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        return { completed: true, method: 'exec-command-copy' };
      }
    } catch (error) {
      console.warn('[Share] execCommand copy fallback failed.', error);
    }
  }

  console.info('[Share] Unable to share content automatically. Displaying manual fallback.');
  if (typeof window !== 'undefined' && typeof alert === 'function') {
    alert(`Share this content manually:\n\n${textToCopy}`);
  }
  return { completed: false, reason: 'manual-fallback' };
}

export async function shareContent(data) {
  const payload = normalizeShareData(data);

  const nativeResult = await shareViaCapacitor(payload);
  if (nativeResult.completed) {
    return nativeResult;
  }

  const webResult = await shareViaWebApi(payload);
  if (webResult.completed) {
    return webResult;
  }

  return shareViaClipboard(payload);
}

export function registerShareButton(target, shareData, options = {}) {
  if (typeof document === 'undefined') {
    console.warn('[Share] registerShareButton called outside a browser context.');
    return () => {};
  }

  const payload = normalizeShareData(shareData);
  const button = typeof target === 'string' ? document.querySelector(target) : target;
  if (!button) {
    console.warn('[Share] Unable to find button for selector', target);
    return () => {};
  }

  const { preventDefault = true } = options;
  const handler = async (event) => {
    if (preventDefault) {
      event.preventDefault();
    }

    const result = await shareContent(payload);
    if (!result.completed && options.onFallback) {
      options.onFallback(result);
    }
    if (result.completed && options.onComplete) {
      options.onComplete(result);
    }
  };

  button.addEventListener('click', handler);
  return () => button.removeEventListener('click', handler);
}

export async function canUseNativeShare(payload) {
  if (!Capacitor?.isNativePlatform?.()) {
    return false;
  }
  if (!Share || typeof Share.canShare !== 'function') {
    return false;
  }
  try {
    const result = await Share.canShare(normalizeShareData(payload));
    return !!result?.value;
  } catch (error) {
    console.warn('[Share] Failed to check native share availability.', error);
    return false;
  }
}

if (import.meta?.main) {
  shareContent({
    title: 'Capacitor Share Example',
    text: 'Sharing from a Capacitor-enabled JavaScript module.',
    url: 'https://capacitorjs.com/',
  }).then((result) => {
    console.info('[Share] Share attempt finished:', result);
  });
}
