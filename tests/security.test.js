const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeExternalURL, createNavigationPolicy } = require('../electron/security');
test('external links cannot invoke local programs or carry credentials', () => {
  for (const url of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'data:text/html,x', 'ms-settings:', 'https://user:password@example.com/', {}, 'not a url']) {
    assert.equal(isSafeExternalURL(url), false);
  }
  assert.equal(isSafeExternalURL('https://example.com/help'), true);
});
test('production navigation stays on the configured HTTPS origin', () => {
  const allowed = createNavigationPolicy({ productionURL:'https://budget.example/', devURL:'http://localhost:8000/', isDev:false, localURLs:['file:///C:/app/dist/offline.html'] });
  assert.equal(allowed('https://budget.example/jobs'), true);
  for (const url of ['https://budget.example.attacker.test/', 'http://budget.example/', 'https://attacker.test/', 'file:///C:/private.txt', 'https://user@budget.example/']) assert.equal(allowed(url), false);
  assert.equal(allowed('file:///C:/app/dist/offline.html#status'), true);
});
test('development cannot use a network-wide origin', () => {
  assert.throws(() => createNavigationPolicy({productionURL:'https://budget.example/',devURL:'http://192.168.1.5:8000/',isDev:true,localURLs:[]}));
  const allowed=createNavigationPolicy({productionURL:'https://budget.example/',devURL:'http://127.0.0.1:8000/',isDev:true,localURLs:[]});
  assert.equal(allowed('http://127.0.0.1:8000/'),true);
  assert.equal(allowed('http://127.0.0.1:9000/'),false);
});
