// Loads the webfont stylesheet without blocking first paint.
// Lives in an external file because the production CSP forbids inline scripts
// (script-src 'self'), so an onload= attribute would be blocked.
(function () {
  var fontStylesheet = document.createElement('link');
  fontStylesheet.rel = 'stylesheet';
  fontStylesheet.href =
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
  document.head.appendChild(fontStylesheet);
})();
