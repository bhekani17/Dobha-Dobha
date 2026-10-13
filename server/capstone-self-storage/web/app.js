'use strict';

const config = window.STORAGE_CONFIG || {};
const state = { idToken: '', email: '' };
const statusElement = document.getElementById('status');
const authPanel = document.getElementById('auth-panel');
const dashboard = document.getElementById('dashboard');

function showStatus(message, isError) {
  statusElement.textContent = message;
  statusElement.classList.toggle('status-error', Boolean(isError));
  statusElement.classList.toggle('status-success', !isError && Boolean(message));
}

function setBusy(form, busy) {
  for (const control of form.querySelectorAll('button, input')) control.disabled = busy;
}

async function cognito(target, payload) {
  if (!config.region || config.region.startsWith('REPLACE_')
      || !config.userPoolClientId || config.userPoolClientId.startsWith('REPLACE_')) {
    throw new Error('Set the AWS region and Cognito app client values in web/config.js before using the app.');
  }
  const result = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.message || 'Authentication request failed.');
  return data;
}

async function api(path, options) {
  const result = await fetch(`${config.apiBase || '/api'}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: state.idToken,
      ...(options && options.headers),
    },
  });
  const data = result.status === 204 ? {} : await result.json();
  if (!result.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function setSignedIn(signedIn) {
  authPanel.classList.toggle('hidden', signedIn);
  dashboard.classList.toggle('hidden', !signedIn);
  document.getElementById('signed-in-email').textContent = state.email;
  if (!signedIn) {
    state.idToken = '';
    state.email = '';
  }
}

function money(cents) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderUnits(units) {
  const target = document.getElementById('units');
  target.replaceChildren();
  if (!units.length) {
    target.append(element('p', 'muted empty-state', 'No storage units are listed yet.'));
    return;
  }
  for (const unit of units) {
    const card = element('article', 'unit-card');
    const badge = element('span', `badge ${unit.status === 'AVAILABLE' ? 'badge-available' : 'badge-reserved'}`,
      unit.status === 'AVAILABLE' ? 'Available' : 'Reserved');
    const title = element('h3', '', unit.name);
    const size = element('p', 'muted', unit.size);
    const priceText = element('p', 'price');
    priceText.append(document.createTextNode(money(unit.monthlyPriceCents)));
    priceText.append(element('span', 'muted price-suffix', ' / month'));
    const reserve = element('button', 'button button-primary', 'Reserve this unit');
    reserve.type = 'button';
    reserve.dataset.reserveUnit = unit.id;
    reserve.disabled = unit.status !== 'AVAILABLE';
    card.append(badge, title, size, priceText, reserve);
    target.append(card);
  }
}

function renderReservations(reservations) {
  const target = document.getElementById('reservations');
  target.replaceChildren();
  if (!reservations.length) {
    target.append(element('p', 'muted empty-state', 'You do not have any reservations yet.'));
    return;
  }
  for (const reservation of reservations) {
    const row = element('article', 'list-row');
    const info = element('div');
    info.append(
      element('strong', '', reservation.unitName),
      element('span', 'muted row-detail', `Reserved ${new Date(reservation.createdAt).toLocaleDateString()}`),
      element('span', `badge ${reservation.status === 'ACTIVE' ? 'badge-available' : 'badge-reserved'}`,
        reservation.status === 'ACTIVE' ? 'Active' : 'Released'),
    );
    row.append(info, element('span', 'price', money(reservation.monthlyPriceCents)));
    if (reservation.status === 'ACTIVE') {
      const release = element('button', 'button button-small button-outline', 'Release');
      release.type = 'button';
      release.dataset.releaseReservation = reservation.id;
      row.append(release);
    }
    target.append(row);
  }
}

function renderNotifications(notifications) {
  const target = document.getElementById('notifications');
  target.replaceChildren();
  if (!notifications.length) {
    target.append(element('p', 'muted empty-state', 'Notifications about your reservations will appear here.'));
    return;
  }
  for (const notification of notifications) {
    const row = element('article', 'list-row notification-row');
    const kind = notification.kind === 'RESERVATION_CREATED' ? 'Reservation confirmed' : 'Reservation released';
    row.append(
      element('strong', '', kind),
      element('span', 'muted row-detail', notification.unitName || 'Storage unit'),
      element('time', 'muted row-detail', new Date(notification.createdAt).toLocaleString()),
    );
    target.append(row);
  }
}

async function loadDashboard() {
  showStatus('Loading your storage dashboard…', false);
  try {
    const [units, reservations, notifications] = await Promise.all([
      api('/units'),
      api('/reservations'),
      api('/notifications'),
    ]);
    renderUnits(units.units || []);
    renderReservations(reservations.reservations || []);
    renderNotifications(notifications.notifications || []);
    showStatus('', false);
  } catch (error) {
    showStatus(error.message, true);
  }
}

document.getElementById('sign-in-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  try {
    const result = await cognito('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.userPoolClientId,
      AuthParameters: {
        USERNAME: values.get('email'),
        PASSWORD: values.get('password'),
      },
    });
    if (!result.AuthenticationResult?.IdToken) throw new Error('Sign-in did not return an ID token.');
    state.idToken = result.AuthenticationResult.IdToken;
    state.email = values.get('email');
    setSignedIn(true);
    form.reset();
    await loadDashboard();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(form, false);
  }
});

document.getElementById('sign-up-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  try {
    await cognito('SignUp', {
      ClientId: config.userPoolClientId,
      Username: values.get('email'),
      Password: values.get('password'),
      UserAttributes: [{ Name: 'email', Value: values.get('email') }],
    });
    document.querySelector('#confirm-form [name="email"]').value = values.get('email');
    document.getElementById('confirm-form').classList.remove('hidden');
    form.reset();
    showStatus('Account created. Check your email for the verification code.', false);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(form, false);
  }
});

document.getElementById('confirm-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  try {
    await cognito('ConfirmSignUp', {
      ClientId: config.userPoolClientId,
      Username: values.get('email'),
      ConfirmationCode: values.get('code'),
    });
    document.querySelector('#sign-in-form [name="email"]').value = values.get('email');
    form.reset();
    form.classList.add('hidden');
    showStatus('Email verified. Sign in to manage storage.', false);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(form, false);
  }
});

document.getElementById('sign-out').addEventListener('click', () => {
  setSignedIn(false);
  showStatus('You have signed out.', false);
});

document.getElementById('units').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-reserve-unit]');
  if (!button) return;
  button.disabled = true;
  try {
    await api('/reservations', {
      method: 'POST',
      body: JSON.stringify({ unitId: button.dataset.reserveUnit }),
    });
    showStatus('Storage unit reserved. Your notification will arrive shortly.', false);
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    showStatus(error.message, true);
  }
});

document.getElementById('reservations').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-release-reservation]');
  if (!button) return;
  button.disabled = true;
  try {
    await api(`/reservations/${encodeURIComponent(button.dataset.releaseReservation)}`, { method: 'DELETE' });
    showStatus('Reservation released. Your notification will arrive shortly.', false);
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    showStatus(error.message, true);
  }
});

document.getElementById('unit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  try {
    await api('/units', {
      method: 'POST',
      body: JSON.stringify({
        name: values.get('name'),
        size: values.get('size'),
        monthlyPrice: Number(values.get('monthlyPrice')),
      }),
    });
    form.reset();
    showStatus('Storage unit added.', false);
    await loadDashboard();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(form, false);
  }
});
