/*
  Shared behaviour for Apiona screens.
  Sidebar: collapsed to icons by default; the toggle expands it to show labels.
  The choice is remembered on this computer.
*/
(function () {
  var app = document.querySelector('.app');
  var toggle = document.querySelector('.sidebar-toggle');
  if (!app || !toggle) return;

  var KEY = 'apiona.sidebar.expanded';
  function set(expanded) {
    app.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Collapse menu' : 'Expand menu');
    try { localStorage.setItem(KEY, expanded ? '1' : '0'); } catch (e) {}
  }
  var saved = false;
  try { saved = localStorage.getItem(KEY) === '1'; } catch (e) {}
  set(saved);
  requestAnimationFrame(function () { app.classList.add('is-ready'); });
  toggle.addEventListener('click', function () { set(!app.classList.contains('is-expanded')); });
})();
