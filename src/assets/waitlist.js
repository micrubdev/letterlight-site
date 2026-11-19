// Beta waitlist form. The form also works without JavaScript: it posts to the API, which answers with a thank-you page.

/** Sends the form as JSON. Returns 'done' only on a 2xx response. */
export async function submitWaitlist(form, fetchImpl = fetch) {
  const f = form.elements;
  const body = { email: f.email.value.trim(), page: f.page.value, website: f.website.value };
  try {
    const res = await fetchImpl(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok ? 'done' : 'error';
  } catch {
    return 'error';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    for (const form of document.querySelectorAll('form.waitlist')) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button');
        const error = form.querySelector('.waitlist-error');
        button.disabled = true;
        error.textContent = '';
        if ((await submitWaitlist(form)) === 'done') {
          const done = document.createElement('p');
          done.className = 'waitlist-done';
          done.setAttribute('role', 'status');
          done.textContent = "You're on the list. We'll write when the beta opens.";
          form.replaceWith(done);
        } else {
          error.textContent = "Couldn't reach the server. Try again in a minute.";
          button.disabled = false;
        }
      });
    }
  });
}
