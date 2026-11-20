// Asks visitors in Europe before Google Analytics may use cookies. Everyone else is counted by default.
// The head script sets the defaults (denied in the EEA, UK and Switzerland) and replays a saved choice.
export const CHOICE_KEY = 'll-stats';
const EUROPE_ATLANTIC = ['Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe', 'Atlantic/Reykjavik'];

/** True when the time zone suggests the visitor is in Europe, where cookies need consent. */
export const needsConsent = (tz) => String(tz).startsWith('Europe/') || EUROPE_ATLANTIC.includes(tz);

const save = (v) => { try { localStorage.setItem(CHOICE_KEY, v); } catch { /* private mode: ask again next time */ } };
const saved = () => { try { return localStorage.getItem(CHOICE_KEY); } catch { return null; } };

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.gtag || saved() || !needsConsent(Intl.DateTimeFormat().resolvedOptions().timeZone)) return;
    const bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Visit statistics');
    bar.innerHTML = '<p>May we count your visit with Google Analytics cookies? <a href="/privacy.html#website">Details</a></p>'
      + '<div class="consent-buttons"><button type="button" data-v="no" class="consent-no">No</button><button type="button" data-v="yes">Allow</button></div>';
    bar.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v) return;
      save(v);
      if (v === 'yes') window.gtag('consent', 'update', { analytics_storage: 'granted' });
      bar.remove();
    });
    document.body.append(bar);
  });
}
