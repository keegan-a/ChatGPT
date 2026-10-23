function isSafeExternalURL(value) {
  if (typeof value !== 'string' || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function createNavigationPolicy({ productionURL, devURL, isDev, localURLs }) {
  const production = new URL(productionURL);
  if (production.protocol !== 'https:' || production.username || production.password) {
    throw new Error('The hosted application requires an HTTPS origin without credentials');
  }
  const development = new URL(devURL);
  if (isDev && (!['localhost', '127.0.0.1', '[::1]'].includes(development.hostname) ||
      !['http:', 'https:'].includes(development.protocol) || development.username || development.password)) {
    throw new Error('The development server must be on loopback');
  }
  const origin = isDev ? development.origin : production.origin;
  return (value) => {
    try {
      const url = new URL(value);
      if (url.username || url.password) return false;
      if (url.protocol === 'file:') return localURLs.includes(url.href.split('#')[0]);
      return ['https:', 'http:'].includes(url.protocol) && url.origin === origin;
    } catch { return false; }
  };
}
module.exports = { isSafeExternalURL, createNavigationPolicy };
