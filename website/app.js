const categories = [
  'All categories',
  'Jackets',
  'Denim',
  'Sneakers',
  'Workwear',
  'Vintage Tees',
  'Knitwear',
  'Clothing & Accessories',
  'Shoes',
  'Electronics',
  'Home & Living',
  'Books & Media',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Collectibles',
  'Other',
];
const categoryCards = [
  ['Clothing & Accessories', '◈', 'Clothes, bags, jewellery, and everyday accessories'],
  ['Electronics', '⌁', 'Phones, gadgets, computers, and useful tech'],
  ['Home & Living', '⌂', 'Furniture, kitchen finds, decor, and more'],
  ['Books & Media', '▤', 'Books, music, games, and things to watch'],
  ['Sports & Outdoors', '↗', 'Fitness, outdoor gear, and sporting finds'],
  ['Toys & Games', '✳', 'Playthings, board games, and collectibles'],
  ['Collectibles', '✥', 'Collectible objects, keepsakes, and unusual finds'],
  ['Shoes', '⌑', 'Everyday pairs and special finds'],
  ['Beauty & Personal Care', '✧', 'Beauty tools and personal care essentials'],
  ['Other', '＋', 'Something different? It belongs here too'],
];
const savedTheme = localStorage.getItem('dobha-theme');
const apiBase = String(window.DOBHA_CONFIG?.apiBase || 'https://dobha-live.ndlovubhekani17.workers.dev').replace(/\/+$/, '');
const termsVersion = window.DOBHA_CONFIG?.termsVersion || '2026-10-02';
const state = {
  token: localStorage.getItem('dobha-token') || '',
  user: null,
  theme: savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  items: [],
  cursor: '',
  category: 'All categories',
  query: '',
  location: 'All Joburg',
  page: 'home',
  inlineStream: false,
  authMode: 'login',
  stream: null,
  cart: [],
  savedItems: [],
  offers: [],
  orders: [],
  notifications: [],
  chats: [],
  selectedChat: '',
  chatPoll: null,
  roomPoll: null,
  resetEmail: '',
};
const byId = (id) => document.getElementById(id);
const resolveMedia = (path) => path && path.startsWith('/') ? `${apiBase}${path}` : path;
function setFieldGroup(group, visible) {
  group.classList.toggle('hidden', !visible);
  group.querySelectorAll('input,select,textarea,button').forEach((field) => {
    field.disabled = !visible;
  });
}
async function uploadAvatar(event) {
  event.preventDefault();
  const file = event.currentTarget.elements.avatar.files[0];
  if (!file) return;
  try {
    const { user } = await api('/api/me/avatar', { method: 'PUT', raw: file, contentType: file.type });
    state.user = user;
    localStorage.setItem('dobha-user', JSON.stringify(user));
    setMessage('avatar-message', 'Profile photo updated.');
  } catch (error) {
    setMessage('avatar-message', error.message, true);
  }
}
async function removeAvatar() {
  try {
    const { user } = await api('/api/me/avatar', { method: 'DELETE' });
    state.user = user;
    localStorage.setItem('dobha-user', JSON.stringify(user));
    setMessage('avatar-message', 'Profile photo removed.');
  } catch (error) {
    setMessage('avatar-message', error.message, true);
  }
}
async function deleteAccount(event) {
  event.preventDefault();
  if (!confirm('Permanently delete your Dobha-Dobha account?')) return;
  const data = new FormData(event.currentTarget);
  try {
    await api('/api/me', { method: 'DELETE', body: { confirm: data.get('confirm'), password: data.get('password') || '' } });
    signOut();
    location.hash = 'home';
    notify('Your account was deleted.');
  } catch (error) {
    setMessage('delete-message', error.message, true);
  }
}
const api = async (path, { method = 'GET', body, raw, contentType, auth = !!state.token } = {}) => {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (raw !== undefined) headers['content-type'] = contentType || 'application/octet-stream';
  if (auth && state.token) headers.authorization = `Bearer ${state.token}`;
  const url = /^https?:\/\//i.test(path) ? path : `${apiBase}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(raw !== undefined ? { body: raw } : {}),
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
};
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const money = (amount) => {
  // Handle API's "R 4599.00" string format — strip non-numeric chars except dot
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.]/g, '')) : amount;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(num || 0);
};
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  byId('theme-toggle').textContent = theme === 'dark' ? '☀' : '☾';
  byId('theme-toggle').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  byId('theme-toggle').title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  document.querySelectorAll('.brand-symbol img').forEach((image) => {
    image.src = `assets/images/logo-${theme}.png`;
  });
}
function notify(message, error = false) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  toast.style.background = error ? '#a83e2a' : '';
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => toast.classList.remove('visible'), 3200);
}
function setMessage(id, message, error = false) {
  const element = byId(id);
  element.textContent = message;
  element.classList.toggle('error', error);
}
function openDialog(id) {
  const dialog = byId(id);
  if (!dialog.open) dialog.showModal();
}
function closeDialog(id) {
  const dialog = byId(id);
  if (dialog.open) dialog.close();
}
function apiPrivate(path, options = {}) {
  return api(`/api${path}`, { ...options, auth: true });
}
function setSignedIn(user, token) {
  state.user = user;
  state.token = token;
  localStorage.setItem('dobha-token', token);
  localStorage.setItem('dobha-user', JSON.stringify(user));
  byId('auth-button').textContent = user.name?.split(' ')[0] || 'Account';
  byId('account-nav').classList.remove('hidden');
  if (state.page === 'sell') renderPage();
  loadItems();
}
function signOut() {
  state.user = null;
  state.token = '';
  localStorage.removeItem('dobha-token');
  localStorage.removeItem('dobha-user');
  byId('auth-button').textContent = 'Sign in';
  byId('account-nav').classList.add('hidden');
}
async function loadProfile() {
  if (!state.token) return;
  try {
    const { user } = await api('/api/me');
    state.user = user;
    localStorage.setItem('dobha-user', JSON.stringify(user));
    byId('auth-button').textContent = user.name?.split(' ')[0] || 'Account';
    byId('account-nav').classList.remove('hidden');
    if (state.page === 'sell') renderPage();
    if (state.page === 'account') renderAccount();
    loadItems();
  } catch (error) {
    signOut();
    console.error('Session restore failed:', error);
    notify('Your session could not be restored. Please sign in again.', true);
    if (!['home', 'shop', 'live', 'about', 'support'].includes(state.page)) renderPage();
    else loadItems();
  }
}
function showAuth(mode = 'login') {
  state.authMode = mode;
  const form = byId('auth-form');
  form.reset();
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isForgot = mode === 'forgot';
  const hasCode = isReset;
  form.elements.name.closest('label').classList.toggle('hidden', !isRegister);
  form.elements.name.disabled = !isRegister;
  form.elements.name.required = isRegister;
  form.elements.handle.closest('label').classList.toggle('hidden', !isRegister);
  form.elements.handle.disabled = !isRegister;
  form.elements.handle.required = isRegister;
  form.elements.terms.closest('label').classList.toggle('hidden', !isRegister);
  form.elements.terms.disabled = !isRegister;
  form.elements.terms.required = isRegister;
  form.elements.email.disabled = isReset;
  form.elements.code.closest('label').classList.toggle('hidden', !hasCode);
  form.elements.code.disabled = !hasCode;
  form.elements.code.required = hasCode;
  form.elements.password.closest('label').classList.toggle('hidden', isForgot);
  form.elements.password.disabled = isForgot;
  form.elements.password.required = !isForgot;
  byId('auth-title').textContent = isRegister ? 'Create an account' : isReset ? 'Choose a new password' : isForgot ? 'Reset password' : 'Sign in';
  byId('auth-submit').textContent = isRegister ? 'Create account' : isReset ? 'Reset password' : isForgot ? 'Send reset code' : 'Sign in';
  byId('auth-switch').classList.toggle('hidden', isReset || isForgot);
  byId('google-signin').classList.toggle('hidden', isReset || isForgot);
  byId('forgot-link').classList.toggle('hidden', isRegister || isReset || isForgot);
  byId('auth-switch').textContent = isRegister ? 'Already have an account? Sign in' : 'New here? Create an account';
  setMessage('auth-message', '');
  openDialog('auth-dialog');
}
function renderFilters() {
  byId('filters').innerHTML = categories.map((category) => `<button class="filter-chip${state.category === category ? ' active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
  byId('filters').querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    renderFilters();
    loadItems();
  }));
}
function renderItems() {
  const query = state.query.toLowerCase();
  const visible = state.items.filter((item) => (state.category === 'All categories' || item.category === state.category)
    && (!query || `${item.title} ${item.description} ${item.sellerName} ${item.category}`.toLowerCase().includes(query)));
  byId('empty-state').classList.toggle('hidden', visible.length > 0);
  const cards = visible.map((item) => listingCard(item));
  byId('listing-grid').innerHTML = cards.join('');
  byId('home-grid').innerHTML = visible.slice(0, 8).map((item) => cards[visible.indexOf(item)]).join('');
  for (const grid of [byId('listing-grid'), byId('home-grid')]) {
    grid.querySelectorAll('[data-item]').forEach((card) => {
      card.addEventListener('click', () => showProduct(card.dataset.item));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showProduct(card.dataset.item);
        }
      });
    });
  }
  byId('load-more').classList.toggle('hidden', !state.cursor);
}
async function loadItems(append = false) {
  if (!append) {
    state.items = [];
    state.cursor = '';
    byId('listing-grid').innerHTML = '<p class="spinner">Finding the good stuff…</p>';
  }
  const params = new URLSearchParams({ limit: '40' });
  if (state.query) params.set('q', state.query);
  if (state.category !== 'All categories') params.set('category', state.category);
  if (state.location !== 'All Joburg') params.set('location', state.location);
  if (append && state.cursor) params.set('offset', state.cursor);
  try {
    const result = await api(`/api/items?${params}`);
    state.items = append ? [...state.items, ...result.items] : result.items;
    state.cursor = result.nextCursor || '';
    renderItems();
  } catch (error) {
    byId('listing-grid').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
function showProduct(id) {
  const item = state.items.find((listing) => listing.id === id);
  if (!item) return;
  // Normalise API fields
  const seller = item.seller || {};
  const sellerName = seller.name || item.sellerName || 'Dobha seller';
  const sellerHandle = seller.handle ? `@${seller.handle}` : (item.sellerHandle || '');
  const sellerId = seller.id || item.sellerId || '';
  const photoSrc = (item.photos && item.photos[0]) || item.photoUrl || '';
  const media = photoSrc
    ? `<img src="${escapeHtml(resolveMedia(photoSrc))}" alt="${escapeHtml(item.title)}">`
    : `<div class="item-placeholder" style="${categoryPlaceholder(item.category).match(/style="([^"]+)"/)?.[1] || ''}">${categoryPlaceholder(item.category).match(/<span[^>]*>([^<]+)<\/span>/g)?.join('') || ''}</div>`;
  byId('product-detail').innerHTML = `<div class="product-detail">
    <div class="product-preview">${media}</div>
    <div class="product-copy"><p class="eyebrow">${escapeHtml(item.category)} · ${escapeHtml(item.condition || 'Pre-loved')}</p>
      <h2>${escapeHtml(item.title)}</h2><p class="product-price">${money(item.priceZar)}</p>
      <p class="seller-line">Listed by ${escapeHtml(sellerName)} ${escapeHtml(sellerHandle)}</p>
      <p class="product-description">${escapeHtml(item.description || 'A one-of-a-kind find, ready for its next home.')}</p>
      ${item.size && item.size !== 'N/A' ? `<p class="product-description">Size / Details: ${escapeHtml(item.size)}</p>` : ''}
      ${item.brand ? `<p class="product-description">Brand: ${escapeHtml(item.brand)}</p>` : ''}
      <p class="product-description">${Number(item.quantity) || 1} available · ${Number(item.likesCount) || 0} likes</p>
      <div class="product-actions"><button class="button button-dark" id="cart-button">Add to bag</button><button class="button button-outline" id="save-button">${item.isSaved ? 'Unsave' : 'Save'}</button><button class="button button-outline" id="like-button">${item.isLiked ? 'Unlike' : 'Like'}</button><button class="button button-outline" id="offer-button">Make an offer</button></div>
      <a class="text-button seller-profile-link" href="#profile?id=${encodeURIComponent(sellerId)}">View seller profile →</a>
      <button class="text-button" id="message-product-seller">Message seller →</button>
      <section class="product-comments"><h3>Comments</h3><div id="comments-list"><p class="muted">Loading comments…</p></div><form id="comment-form" class="form-stack"><label class="field">Add a comment<textarea name="text" maxlength="500" required></textarea></label><button class="button button-outline">Comment</button></form><button class="text-button" id="report-button">Report this listing</button></section>
    </div></div>`;
  byId('cart-button').addEventListener('click', () => addToCart(item.id));
  byId('save-button').addEventListener('click', () => itemAction(item.id, 'save', 'Saved items'));
  byId('like-button').addEventListener('click', () => itemAction(item.id, 'like', 'Likes'));
  byId('offer-button').addEventListener('click', () => makeOffer(item));
  byId('message-product-seller').addEventListener('click', () => {
    if (!requireSignIn()) return;
    state.selectedChat = sellerId;
    closeDialog('product-dialog');
    location.hash = 'messages';
  });
  byId('report-button').addEventListener('click', () => reportItem(item.id));
  byId('comment-form').addEventListener('submit', (event) => addComment(event, item.id));
  loadComments(item.id);
  openDialog('product-dialog');
}
async function addToCart(itemId) {
  if (!state.token) {
    closeDialog('product-dialog');
    showAuth();
    return;
  }
  try {
    const { items } = await api(`/api/cart/${itemId}`, { method: 'POST' });
    state.cart = items;
    updateCartBadge();
    notify('Added to your bag.');
  } catch (error) {
    notify(error.message, true);
  }
}
async function loadLiveRooms() {
  const lists = [byId('live-list'), byId('home-live-list')];
  lists.forEach((list) => {
    list.innerHTML = '<p class="muted">Checking who is live…</p>';
  });
  try {
    const rooms = await api('/api/rooms');
    if (!rooms.length) {
      lists.forEach((list) => {
        list.innerHTML = '<p class="muted">No one is live right now. Check back soon.</p>';
      });
      return;
    }
    const cards = rooms.map((room) => {
      const hostName = room.host?.name || 'Dobha seller';
      const avatar = room.host?.avatarUrl
        ? `<img src="${escapeHtml(resolveMedia(room.host.avatarUrl))}" alt="">`
        : '';
      return `<article class="live-card">
        <div class="live-card-top">
          <div class="live-avatar">${avatar}<span>${escapeHtml(hostName.slice(0, 1).toUpperCase())}</span></div>
          <span class="live-status"><span class="live-status-dot"></span>Live now</span>
        </div>
        <div class="live-info"><strong>${escapeHtml(hostName)}</strong><span>${Number(room.viewers) || 0} watching · Join the stream</span></div>
        <button class="button button-dark" data-room="${escapeHtml(room.name)}" aria-label="Watch ${escapeHtml(hostName)} live">Watch live <span aria-hidden="true">↗</span></button>
      </article>`;
    }).join('');
    lists.forEach((list) => {
      list.innerHTML = cards;
      list.querySelectorAll('.live-avatar img').forEach((image) => image.addEventListener('error', () => image.remove(), { once: true }));
      list.querySelectorAll('[data-room]').forEach((button) => button.addEventListener('click', () => watchStream(button.dataset.room, list.id === 'live-list')));
    });
  } catch (error) {
    lists.forEach((list) => {
      list.innerHTML = `<p class="muted">${escapeHtml(error.message)}. Please check back soon.</p>`;
    });
  }
}
async function watchStream(room, inline = false) {
  await stopStream();
  const player = inline
    ? { frame: byId('inline-video-frame'), video: byId('inline-live-video'), placeholder: byId('inline-live-placeholder'), message: 'inline-live-message' }
    : { frame: byId('video-frame'), video: byId('live-video'), placeholder: byId('live-placeholder'), message: 'live-message' };
  if (inline) {
    state.inlineStream = true;
    byId('inline-live-title').textContent = 'Live stream';
    byId('inline-live-player').classList.remove('hidden');
  } else {
    byId('live-title').textContent = 'Join the stream';
    openDialog('live-dialog');
  }
  player.placeholder.textContent = 'Connecting to the live stream…';
  player.placeholder.classList.remove('hidden');
  player.video.srcObject = null;
  setMessage(player.message, '');
  try {
    const result = await api(`/api/token?room=${encodeURIComponent(room)}&role=viewer`);
    const Room = window.LivekitClient?.Room;
    const Track = window.LivekitClient?.Track;
    const RoomEvent = window.LivekitClient?.RoomEvent;
    if (!Room || !Track || !RoomEvent) throw new Error('The live video player could not be loaded.');
    const liveRoom = new Room();
    state.stream = liveRoom;
    liveRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        track.attach(player.video);
        player.placeholder.classList.add('hidden');
      } else {
        const audio = track.attach();
        audio.className = 'stream-audio';
        player.frame.append(audio);
      }
    });
    liveRoom.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => {
      if (element !== player.video) element.remove();
      else element.srcObject = null;
    }));
    liveRoom.on(RoomEvent.Disconnected, () => {
      player.placeholder.textContent = 'This stream has ended.';
      player.placeholder.classList.remove('hidden');
    });
    await liveRoom.connect(result.url, result.token);
    if (inline) byId('inline-live-title').textContent = `Watching ${room}`;
  } catch (error) {
    setMessage(player.message, error.message, true);
    player.placeholder.textContent = 'The stream could not be joined.';
    player.placeholder.classList.remove('hidden');
  }
}
async function stopStream() {
  if (state.stream) {
    await state.stream.disconnect();
    state.stream = null;
  }
  if (state.inlineStream) {
    state.inlineStream = false;
    byId('inline-live-player').classList.add('hidden');
    byId('inline-live-video').srcObject = null;
    byId('inline-live-placeholder').textContent = 'Connecting to the live stream…';
    setMessage('inline-live-message', '');
  }
}
async function loadOrders() {
  if (!state.token) {
    showAuth();
    return;
  }
  byId('orders-list').innerHTML = '<p class="muted">Loading your orders…</p>';
  try {
    const { orders } = await apiPrivate('/orders');
    state.orders = orders;
    byId('orders-list').innerHTML = orders.length ? orders.map((order) => `<article class="order-card feature-card">
      <div><strong>${escapeHtml(order.item?.title || 'Dobha item')}</strong><span>${escapeHtml(order.id)} · ${escapeHtml(new Date(order.createdAt).toLocaleDateString())}</span><span>${order.isSeller ? 'Sale' : 'Purchase'} · ${escapeHtml(order.deliveryMethod || '')}</span></div>
      <div><strong>${money(order.amountZar + (order.shippingFeeZar || 0))}</strong><span class="order-status">${escapeHtml(order.status)}</span>
        ${order.isSeller && order.status === 'paymentHeld' ? (order.deliveryMethod === 'Downtown Joburg Safe Hub' ? `<button data-order-action="dispatch" data-order-id="${escapeHtml(order.id)}" class="button button-outline">Mark ready for collection</button>` : `<form data-order-form="dispatch" data-order-id="${escapeHtml(order.id)}"><input name="trackingNumber" required minlength="4" maxlength="40" placeholder="Tracking number"><button class="button button-outline">Mark dispatched</button></form>`) : ''}
        ${!order.isSeller && ['paymentHeld','vendorDispatched'].includes(order.status) ? `<button data-order-action="confirm" data-order-id="${escapeHtml(order.id)}" class="button button-dark">Confirm received</button><button data-order-action="dispute" data-order-id="${escapeHtml(order.id)}" class="button button-outline">Report a problem</button>` : ''}
        ${order.canReview ? `<button data-order-action="review" data-order-id="${escapeHtml(order.id)}" class="button button-outline">Review seller</button>` : ''}
      </div>
    </article>`).join('') : '<p class="muted">No orders yet. Your finds will show up here.</p>';
    byId('orders-list').querySelectorAll('[data-order-action]').forEach((button) => button.addEventListener('click', () => orderAction(button.dataset.orderId, button.dataset.orderAction)));
    byId('orders-list').querySelectorAll('[data-order-form="dispatch"]').forEach((form) => form.addEventListener('submit', (event) => dispatchOrder(event, form)));
  } catch (error) {
    byId('orders-list').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function uploadFile(file) {
  const upload = await api('/api/uploads', {
    method: 'POST',
    raw: file,
    contentType: file.type,
  });
  return { key: upload.key };
}
function renderHomeCategories() {
  byId('home-categories').innerHTML = categoryCards.map(([name, icon, description]) => `
    <a class="category-card" href="#shop" data-category-card="${escapeHtml(name)}">
      <span class="category-icon" aria-hidden="true">${icon}</span>
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(description)}</small>
    </a>`).join('');
  byId('home-categories').querySelectorAll('[data-category-card]').forEach((card) => {
    card.addEventListener('click', () => {
      state.category = card.dataset.categoryCard;
    });
  });
}
function renderPage() {
  const requested = location.hash.slice(1).split('?')[0] || 'home';
  const page = ['home', 'shop', 'live', 'sell', 'orders', 'cart', 'saved', 'offers', 'wallet', 'messages', 'notifications', 'account', 'support', 'people', 'profile', 'about'].includes(requested) ? requested : 'home';
  state.page = page;
  if (state.inlineStream && page !== 'live') stopStream();
  clearInterval(state.chatPoll);
  state.chatPoll = null;
  clearInterval(state.roomPoll);
  state.roomPoll = null;
  document.querySelectorAll('[data-page]').forEach((section) => {
    section.classList.toggle('hidden', section.dataset.page !== page);
  });
  document.querySelectorAll('[data-page-link]').forEach((link) => {
    if (link.dataset.pageLink === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (page === 'sell') {
    if (!state.token) showAuth();
    else {
      const vendor = state.user?.role !== 'vendor';
      setFieldGroup(document.querySelector('.vendor-fields'), vendor);
      setFieldGroup(document.querySelector('.listing-fields'), !vendor);
      byId('sell-title').textContent = vendor ? 'Your corner of the marketplace' : 'List your next find';
    }
  }
  if (page === 'orders') loadOrders();
  if (page === 'cart') loadCart();
  if (page === 'saved') loadSaved();
  if (page === 'offers') loadOffers();
  if (page === 'wallet') loadWallet();
  if (page === 'messages') {
    loadChats();
    state.chatPoll = setInterval(() => loadChats(), 5000);
  }
  if (page === 'notifications') loadNotifications();
  if (page === 'account') renderAccount();
  if (page === 'support') loadSupport();
  if (page === 'people') byId('people-results').innerHTML = '';
  if (page === 'sell' && state.user?.role === 'vendor') loadMyListings();
  if (page === 'profile') loadSellerProfile(new URLSearchParams(location.hash.split('?')[1] || '').get('id'));
  if (page === 'shop') {
    renderFilters();
    loadItems();
  }
  if (page === 'home' || page === 'live') {
    loadLiveRooms();
    state.roomPoll = setInterval(loadLiveRooms, 10_000);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
async function createVendor() {
  const form = byId('sell-form');
  const data = new FormData(form);
  const button = byId('vendor-submit');
  button.disabled = true;
  setMessage('sell-message', 'Setting up your seller profile…');
  try {
    const { user } = await api('/api/me', {
      method: 'PATCH',
      body: { shopName: data.get('shopName'), stallLocation: data.get('stallLocation'), role: 'vendor' },
    });
    state.user = user;
    localStorage.setItem('dobha-user', JSON.stringify(user));
    setMessage('sell-message', 'Your shop is ready. Add your first listing below.');
    setFieldGroup(document.querySelector('.vendor-fields'), false);
    setFieldGroup(document.querySelector('.listing-fields'), true);
    byId('sell-title').textContent = 'List your first item';
  } catch (error) {
    setMessage('sell-message', error.message, true);
  } finally {
    button.disabled = false;
  }
}
async function createListing(event) {
  event.preventDefault();
  const form = byId('sell-form');
  const data = new FormData(form);
  const files = [...form.elements.media.files];
  if (!files.length) {
    setMessage('sell-message', 'Choose at least one photo.', true);
    return;
  }
  const button = byId('listing-submit');
  button.disabled = true;
  setMessage('sell-message', 'Uploading your photos and publishing the listing…');
  try {
    const media = [];
    for (const file of files) media.push(await uploadFile(file));
    await apiPrivate('/items', {
      method: 'POST',
      body: {
        title: data.get('title'),
        priceZar: Number(data.get('priceZar')),
        category: data.get('category'),
        condition: data.get('condition'),
        description: data.get('description'),
        media,
      },
    });
    notify('Your listing is live in the marketplace.');
    state.category = 'All categories';
    renderFilters();
    await loadItems();
    await loadMyListings();
    window.location.hash = 'shop';
  } catch (error) {
    setMessage('sell-message', error.message, true);
  } finally {
    button.disabled = false;
  }
}
async function loadMyListings() {
    const target = byId('my-listings');
    if (!state.token || state.user?.role !== 'vendor') {
      target.innerHTML = '<p class="muted">Become a seller to manage your listings here.</p>';
      return;
    }
    try {
      const { items } = await api('/api/items/mine');
      target.innerHTML = items.length ? items.map((item) => `<article class="order-card"><div><strong>${escapeHtml(item.title)}</strong><span>${money(item.priceZar)} · ${escapeHtml(item.category)} · ${Number(item.quantity)} in stock</span><span class="order-status">${item.isClaimed ? 'Sold' : 'Active'}</span></div><div class="action-row">${!item.isClaimed ? `<button class="button button-outline" data-edit-listing="${escapeHtml(item.id)}">Edit</button><button class="button button-outline" data-delete-listing="${escapeHtml(item.id)}">Remove</button>` : ''}</div></article>`).join('') : '<p class="muted">You have not listed anything yet.</p>';
      target.querySelectorAll('[data-edit-listing]').forEach((button) => button.addEventListener('click', () => editListing(button.dataset.editListing)));
      target.querySelectorAll('[data-delete-listing]').forEach((button) => button.addEventListener('click', () => removeListing(button.dataset.deleteListing)));
    } catch (error) {
      target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
    }
  }
  async function editListing(itemId) {
    let item = state.items.find((listing) => listing.id === itemId);
    if (!item) {
      try {
        item = (await api(`/api/items/${itemId}`)).item;
      } catch (error) {
        notify(error.message, true);
        return;
      }
    }
    const title = prompt('Listing title:', item.title);
    if (title === null) return;
    const priceZar = Number(prompt('Price in ZAR:', item.priceZar));
    if (!Number.isFinite(priceZar) || priceZar <= 0) return;
    const quantity = Number(prompt('Quantity available:', item.quantity));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return;
    try {
      await api(`/api/items/${itemId}`, {
        method: 'PATCH',
        body: { title, priceZar, quantity, description: item.description || '', category: item.category, condition: item.condition || '' },
      });
      await Promise.all([loadMyListings(), loadItems()]);
      notify('Listing updated.');
    } catch (error) {
      notify(error.message, true);
    }
  }
  async function removeListing(itemId) {
    if (!confirm('Remove this listing from the marketplace?')) return;
    try {
      await api(`/api/items/${itemId}`, { method: 'DELETE' });
      await Promise.all([loadMyListings(), loadItems()]);
      notify('Listing removed.');
    } catch (error) {
      notify(error.message, true);
    }
  }
  async function searchPeople(event) {
    event.preventDefault();
    if (!requireSignIn()) return;
    const query = new FormData(event.currentTarget).get('query').trim();
    await renderPeople(query);
  }
  async function renderPeople(query) {
    const target = byId('people-results');
    target.innerHTML = '<p class="muted">Searching…</p>';
    try {
      const { users } = await api(`/api/users?q=${encodeURIComponent(query)}`);
      target.innerHTML = users.length ? users.map((person) => `<article class="order-card"><div><strong>${escapeHtml(person.name)} ${escapeHtml(person.handle)}</strong><span>${person.isVendor ? 'Seller' : 'Community member'}</span></div><div class="action-row"><a class="button button-outline" href="#profile?id=${encodeURIComponent(person.id)}">Profile</a>${!person.isMe ? `<button class="button button-dark" data-follow-person="${escapeHtml(person.id)}" data-following="${person.isFollowing}">${person.isFollowing ? 'Unfollow' : 'Follow'}</button>` : ''}</div></article>`).join('') : '<p class="muted">No people matched that search.</p>';
      target.querySelectorAll('[data-follow-person]').forEach((button) => button.addEventListener('click', async () => {
        try {
          const method = button.dataset.following === 'true' ? 'DELETE' : 'POST';
          await api(`/api/users/${button.dataset.followPerson}/follow`, { method });
          await renderPeople(query);
        } catch (error) {
          notify(error.message, true);
        }
      }));
    } catch (error) {
      target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
    }
}
function requireSignIn() {
  if (state.token) return true;
  showAuth();
  return false;
}
function updateCartBadge() {
  const count = state.cart.length;
  byId('cart-count').textContent = String(count);
  byId('cart-count').classList.toggle('hidden', !count);
}
function categoryPlaceholder(category) {
  const map = {
    'Fashion': { emoji: '👗', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    'Electronics': { emoji: '📱', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    'Footwear': { emoji: '👟', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    'Accessories': { emoji: '💎', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    'Home & Garden': { emoji: '🏡', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  };
  // Fuzzy match: check if category string contains any key
  const match = Object.keys(map).find((key) => (category || '').toLowerCase().includes(key.toLowerCase()));
  const { emoji, gradient } = map[match] || { emoji: '🛍️', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' };
  return `<div class="item-placeholder" style="background:${gradient}"><span class="item-placeholder-emoji">${emoji}</span><span class="item-placeholder-label">${escapeHtml(category || 'Find')}</span></div>`;
}

function listingCard(item) {
  const conditionClass = item.condition === 'New' || item.condition === 'new' ? 'condition-new' : item.condition ? 'condition-preloved' : '';
  // API returns item.photos[] array and item.seller.name — normalise here
  const photoSrc = (item.photos && item.photos[0]) || item.photoUrl || null;
  const sellerName = (item.seller && item.seller.name) || item.sellerName || 'Dobha seller';
  const media = photoSrc
    ? `<img src="${escapeHtml(resolveMedia(photoSrc))}" alt="${escapeHtml(item.title)}" loading="lazy">`
    : categoryPlaceholder(item.category);
  return `<article class="item-card ${conditionClass}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.title)}" data-item="${escapeHtml(item.id)}">
    <div class="item-image">${media}<span class="item-category">${escapeHtml(item.category)}</span></div>
    <div class="item-meta"><div><h3>${escapeHtml(item.title)}</h3><p class="seller-line">${escapeHtml(sellerName)}</p></div><strong>${money(item.priceZar)}</strong></div>
  </article>`;
}
function bindListingCards(target) {
  target.querySelectorAll('[data-item]').forEach((card) => {
    card.addEventListener('click', () => {
      const item = [...state.items, ...state.savedItems, ...state.cart].find((listing) => listing.id === card.dataset.item);
      if (item) showProduct(item.id);
      else api(`/api/items/${card.dataset.item}`).then(({ item: fullItem }) => {
        state.items.push(fullItem);
        showProduct(fullItem.id);
      }).catch((error) => notify(error.message, true));
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
  });
}
async function itemAction(itemId, action, label) {
  if (!requireSignIn()) return;
  try {
    const { item } = await api(`/api/items/${itemId}/${action}`, { method: 'POST' });
    if (state.items.some((listing) => listing.id === itemId)) {
      state.items = state.items.map((listing) => listing.id === itemId ? item : listing);
    } else {
      state.items.push(item);
    }
    state.savedItems = item.isSaved
      ? [...state.savedItems.filter((listing) => listing.id !== itemId), item]
      : state.savedItems.filter((listing) => listing.id !== itemId);
    showProduct(itemId);
    notify(`${label} updated.`);
  } catch (error) {
    notify(error.message, true);
  }
}
async function loadComments(itemId) {
  try {
    const { comments } = await api(`/api/items/${itemId}/comments`);
    byId('comments-list').innerHTML = comments.length ? comments.map((comment) => `<article class="comment"><strong>${escapeHtml(comment.name)} ${escapeHtml(comment.handle)}</strong><p>${escapeHtml(comment.text)}</p><small>${escapeHtml(new Date(comment.createdAt).toLocaleString())}</small></article>`).join('') : '<p class="muted">No comments yet.</p>';
  } catch (error) {
    byId('comments-list').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}
async function addComment(event, itemId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api(`/api/items/${itemId}/comments`, { method: 'POST', body: { text: new FormData(form).get('text') } });
    form.reset();
    await loadComments(itemId);
  } catch (error) {
    notify(error.message, true);
  }
}
async function reportItem(itemId) {
  const reason = prompt('Why are you reporting this listing? Choose one: Fake or counterfeit; Misleading photos or description; Prohibited item; Scam or spam; Offensive');
  if (!reason) return;
  try {
    await api(`/api/items/${itemId}/report`, { method: 'POST', body: { reason } });
    notify('Thanks. The listing has been hidden from your feed and reported.');
    closeDialog('product-dialog');
    await loadItems();
  } catch (error) {
    notify(error.message, true);
  }
}
async function makeOffer(item) {
  if (!requireSignIn()) return;
  const amount = Number(prompt(`Your offer in ZAR (listed for ${money(item.priceZar)}):`));
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    await api(`/api/items/${item.id}/offers`, { method: 'POST', body: { amountZar: amount } });
    notify('Your offer has been sent.');
  } catch (error) {
    notify(error.message, true);
  }
}
async function loadCart() {
  if (!requireSignIn()) return;
  byId('cart-list').innerHTML = '<p class="muted">Loading your bag…</p>';
  try {
    const { items } = await api('/api/cart');
    state.cart = items;
    updateCartBadge();
    byId('cart-list').innerHTML = items.length ? items.map((item) => `<article class="order-card"><div><strong>${escapeHtml(item.title)}</strong><span>${money(item.priceZar)} · ${escapeHtml(item.sellerName || '')}</span><span class="order-status">${item.available ? 'Available' : 'No longer available'}</span></div><button class="button button-outline" data-remove-cart="${escapeHtml(item.id)}">Remove</button></article>`).join('') : '<p class="muted">Your bag is empty. Browse the shop to find something good.</p>';
    byId('cart-list').querySelectorAll('[data-remove-cart]').forEach((button) => button.addEventListener('click', () => removeFromCart(button.dataset.removeCart)));
    byId('checkout-form').classList.toggle('hidden', !items.some((item) => item.available));
  } catch (error) {
    byId('cart-list').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function removeFromCart(itemId) {
  try {
    const { items } = await api(`/api/cart/${itemId}`, { method: 'DELETE' });
    state.cart = items;
    updateCartBadge();
    await loadCart();
  } catch (error) {
    notify(error.message, true);
  }
}
async function checkout(event) {
  event.preventDefault();
  if (!requireSignIn()) return;
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage('checkout-message', 'Placing your order requests…');
  const data = new FormData(form);
  try {
    const result = await api('/api/cart/checkout', { method: 'POST', body: Object.fromEntries(data) });
    const failures = (result.failed || []).map((entry) => entry.error);
    setMessage('checkout-message', `${result.orders.length} order(s) placed.${failures.length ? ` Some items could not be ordered: ${failures.join('; ')}` : ''}`);
    await Promise.all([loadCart(), loadOrders()]);
  } catch (error) {
    setMessage('checkout-message', error.message, true);
  } finally {
    button.disabled = false;
  }
}
async function loadSaved() {
  if (!requireSignIn()) return;
  const target = byId('saved-list');
  target.innerHTML = '<p class="muted">Loading saved items…</p>';
  try {
    const { items } = await api('/api/saved');
    state.savedItems = items;
    target.innerHTML = items.length ? items.map(listingCard).join('') : '<p class="muted">You have not saved any items yet.</p>';
    bindListingCards(target);
  } catch (error) {
    target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function loadOffers() {
  if (!requireSignIn()) return;
  const target = byId('offers-list');
  target.innerHTML = '<p class="muted">Loading offers…</p>';
  try {
    const { offers } = await api('/api/offers');
    state.offers = offers;
    target.innerHTML = offers.length ? offers.map((offer) => `<article class="order-card feature-card"><div><strong>${escapeHtml(offer.item.title)}</strong><span>${offer.isSeller ? `Offer from ${escapeHtml(offer.buyerName)}` : 'Your offer'} · ${money(offer.amountZar)}</span><span class="order-status">${escapeHtml(offer.status)}</span></div><div class="action-row">
      ${offer.isSeller && offer.status === 'pending' ? `<button data-offer-action="accept" data-offer="${escapeHtml(offer.id)}" class="button button-dark">Accept</button><button data-offer-action="decline" data-offer="${escapeHtml(offer.id)}" class="button button-outline">Decline</button><button data-offer-action="counter" data-offer="${escapeHtml(offer.id)}" class="button button-outline">Counter</button>` : ''}
      ${!offer.isSeller && offer.status === 'pending' ? `<button data-offer-action="cancel" data-offer="${escapeHtml(offer.id)}" class="button button-outline">Cancel</button>` : ''}
      ${!offer.isSeller && offer.status === 'countered' ? `<button data-offer-action="accept" data-offer="${escapeHtml(offer.id)}" class="button button-dark">Accept counter</button><button data-offer-action="decline" data-offer="${escapeHtml(offer.id)}" class="button button-outline">Decline</button>` : ''}
      ${offer.status === 'accepted' && !offer.isSeller ? `<form class="offer-checkout form-stack" data-item="${escapeHtml(offer.item.id)}" data-offer-id="${escapeHtml(offer.id)}"><label class="field">Delivery address<textarea name="deliveryAddress" minlength="5" maxlength="200" required></textarea></label><label class="field">Delivery method<select name="deliveryMethod"><option>PUDO Locker-to-Locker</option><option>Courier Guy Door-to-Door</option><option>Downtown Joburg Safe Hub</option></select></label><label class="field">Payment method<select name="paymentMethod"><option>Dobha In-App Wallet</option><option>Capitec Pay (Instant)</option><option>Ozow Instant EFT</option><option>Debit / Credit Card</option></select></label><p class="field-hint">Use the accepted offer price (${money(offer.amountZar)}). Payment is simulated.</p><button class="button button-dark">Buy at accepted price</button></form>` : ''}
      </div></article>`).join('') : '<p class="muted">No offers yet.</p>';
    target.querySelectorAll('[data-offer-action]').forEach((button) => button.addEventListener('click', () => offerAction(button.dataset.offer, button.dataset.offerAction)));
    target.querySelectorAll('.offer-checkout').forEach((form) => form.addEventListener('submit', placeAcceptedOffer));
  } catch (error) {
    target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function placeAcceptedOffer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try {
    await api('/api/orders', {
      method: 'POST',
      body: { ...values, itemId: form.dataset.item, offerId: form.dataset.offerId },
    });
    notify('Order placed at the accepted offer price.');
    await loadOffers();
  } catch (error) {
    notify(error.message, true);
  }
}
async function offerAction(offerId, action) {
  let body;
  if (action === 'counter') {
    const amountZar = Number(prompt('Enter your counter offer in ZAR:'));
    if (!Number.isFinite(amountZar) || amountZar <= 0) return;
    body = { amountZar };
  }
  try {
    await api(`/api/offers/${offerId}/${action}`, { method: 'POST', ...(body ? { body } : {}) });
    await loadOffers();
  } catch (error) {
    notify(error.message, true);
  }
}
async function loadWallet() {
  if (!requireSignIn()) return;
  try {
    const wallet = await api('/api/wallet');
    byId('wallet-summary').innerHTML = `<div class="wallet-balance"><article><span>Available</span><strong>${money(wallet.availableZar)}</strong></article><article><span>On hold</span><strong>${money(wallet.lockedZar)}</strong></article><article><span>Pending</span><strong>${money(wallet.pendingZar)}</strong></article></div>`;
    byId('wallet-transactions').innerHTML = wallet.transactions.length ? wallet.transactions.map((transaction) => `<article class="order-card"><div><strong>${escapeHtml(transaction.title)}</strong><span>${escapeHtml(transaction.subtitle || '')} · ${escapeHtml(transaction.date ? new Date(transaction.date).toLocaleDateString() : '')}</span></div><div><strong>${money(transaction.amountZar)}</strong><span class="order-status">${escapeHtml(transaction.status)}</span></div></article>`).join('') : '<p class="muted">No wallet transactions.</p>';
  } catch (error) {
    byId('wallet-summary').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function walletAction(event, path) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  body.amountZar = Number(body.amountZar);
  try {
    await api(path, { method: 'POST', body });
    form.reset();
    notify('Wallet updated. This is a simulated transaction.');
    await loadWallet();
  } catch (error) {
    notify(error.message, true);
  }
}
async function loadNotifications() {
  if (!requireSignIn()) return;
  const target = byId('notifications-list');
  target.innerHTML = '<p class="muted">Loading notifications…</p>';
  try {
    const result = await api('/api/notifications');
    state.notifications = result.notifications;
    target.innerHTML = `<button class="button button-outline" id="mark-read">Mark all read</button>` + (result.notifications.length ? result.notifications.map((notification) => `<article class="order-card ${notification.read ? '' : 'unread'}"><div><strong>${escapeHtml(notification.title)}</strong><span>${escapeHtml(notification.body)}</span><small>${escapeHtml(new Date(notification.createdAt).toLocaleString())}</small></div>${notification.itemId ? `<a class="text-button" href="#shop" data-notification-item="${escapeHtml(notification.itemId)}">View item</a>` : ''}</article>`).join('') : '<p class="muted">You are all caught up.</p>');
    byId('mark-read').addEventListener('click', async () => {
      try {
        await api('/api/notifications/read', { method: 'POST' });
        await loadNotifications();
      } catch (error) {
        notify(error.message, true);
      }
    });
    target.querySelectorAll('[data-notification-item]').forEach((link) => link.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const { item } = await api(`/api/items/${link.dataset.notificationItem}`);
        state.items.push(item);
        showProduct(item.id);
      } catch (error) {
        notify(error.message, true);
      }
    }));
  } catch (error) {
    target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function loadChats() {
  if (!requireSignIn()) return;
  try {
    const { chats } = await api('/api/chats');
    state.chats = chats;
    byId('chat-list').innerHTML = chats.length ? chats.map((chat) => `<button class="chat-row" data-chat="${escapeHtml(chat.userId)}"><strong>${escapeHtml(chat.name)} ${escapeHtml(chat.handle)}</strong><span>${escapeHtml(chat.lastMessage)}</span>${chat.unread ? `<b>${Number(chat.unread)}</b>` : ''}</button>`).join('') : '<p class="muted">No conversations yet. Open a listing and contact its seller.</p>';
    byId('chat-list').querySelectorAll('[data-chat]').forEach((button) => button.addEventListener('click', () => loadChat(button.dataset.chat)));
    if (state.selectedChat) await loadChat(state.selectedChat);
  } catch (error) {
    byId('chat-list').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function loadChat(userId) {
  state.selectedChat = userId;
  try {
    const result = await api(`/api/chats/${encodeURIComponent(userId)}`);
    byId('chat-thread').innerHTML = `<h2>${escapeHtml(result.with.name)} ${escapeHtml(result.with.handle)}</h2><div class="chat-messages">${result.messages.map((message) => `<article class="chat-message ${message.fromMe ? 'mine' : ''}"><p>${escapeHtml(message.text)}</p><small>${escapeHtml(new Date(message.createdAt).toLocaleString())}</small></article>`).join('')}</div><form id="chat-form" class="chat-send"><label class="field"><span class="visually-hidden">Message</span><input name="text" maxlength="1000" required placeholder="Write a message…"></label><button class="button button-dark">Send</button></form>`;
    byId('chat-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = new FormData(event.currentTarget).get('text');
      try {
        await api(`/api/chats/${encodeURIComponent(userId)}`, { method: 'POST', body: { text } });
        await loadChat(userId);
      } catch (error) {
        notify(error.message, true);
      }
    });
    const messages = document.querySelector('.chat-messages');
    messages.scrollTop = messages.scrollHeight;
  } catch (error) {
    byId('chat-thread').innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function loadSupport() {
  if (!state.token) {
    byId('support-list').innerHTML = '<p class="muted">Sign in to see your support history.</p>';
    return;
  }
  try {
    const { requests } = await api('/api/support');
    byId('support-list').innerHTML = requests.length ? requests.map((request) => `<article class="order-card"><div><strong>${escapeHtml(request.topic)}</strong><span>${escapeHtml(request.message)}</span><span class="order-status">${escapeHtml(request.status)}</span>${request.reply ? `<p>Reply: ${escapeHtml(request.reply)}</p>` : ''}</div></article>`).join('') : '<p class="muted">No support requests yet.</p>';
  } catch (error) {
    byId('support-list').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}
function renderAccount() {
  if (!requireSignIn()) return;
  const user = state.user;
  if (!user) {
    byId('account-summary').innerHTML = '<p class="muted">Loading your profile…</p>';
    return;
  }
  byId('account-summary').innerHTML = `<h2>${escapeHtml(user.name || 'Dobha member')}</h2><p>${escapeHtml(user.handle || '')} · ${escapeHtml(user.email || '')}</p><p>${escapeHtml(user.role || 'shopper')}${user.shopName ? ` · ${escapeHtml(user.shopName)}` : ''}</p>`;
  const form = byId('profile-form');
  for (const field of ['name', 'phone', 'bio', 'location', 'shopName', 'stallLocation', 'role']) form.elements[field].value = user[field] || '';
  byId('password-form').classList.toggle('hidden', !user.hasPassword);
}
async function saveProfile(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const { user } = await api('/api/me', { method: 'PATCH', body: data });
    state.user = user;
    localStorage.setItem('dobha-user', JSON.stringify(user));
    byId('sell-title').textContent = user.role === 'vendor' ? 'List your next find' : 'Your corner of the marketplace';
    renderAccount();
    setMessage('profile-message', 'Profile updated.');
  } catch (error) {
    setMessage('profile-message', error.message, true);
  }
}
async function changePassword(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    await api('/api/me/password', { method: 'POST', body: { current: data.get('currentPassword'), password: data.get('newPassword') } });
    event.currentTarget.reset();
    setMessage('password-message', 'Password changed.');
  } catch (error) {
    setMessage('password-message', error.message, true);
  }
}
async function submitSupport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/support', { method: 'POST', body: data });
    form.reset();
    setMessage('support-message', 'Your message has been sent.');
    await loadSupport();
  } catch (error) {
    setMessage('support-message', error.message, true);
  }
}
async function loadSellerProfile(userId) {
  const target = byId('seller-profile');
  byId('seller-items').innerHTML = '';
  byId('seller-reviews').innerHTML = '';
  byId('seller-follow-list').innerHTML = '';
  if (!userId) {
    target.innerHTML = '<p class="muted">Seller profile not found.</p>';
    return;
  }
  try {
    const result = await api(`/api/users/${encodeURIComponent(userId)}`);
    const profile = result.profile;
    byId('seller-name').innerHTML = `${escapeHtml(profile.shopName || profile.name)} <span>${escapeHtml(profile.handle)}</span>`;
    target.innerHTML = `<p>${escapeHtml(profile.bio || 'A Dobha-Dobha community seller.')} · ${escapeHtml(profile.stallLocation || profile.location || '')}</p><p><button class="text-button" data-follow-list="followers">${Number(profile.followerCount)} followers</button> · <button class="text-button" data-follow-list="following">${Number(profile.followingCount)} following</button> · ${Number(profile.salesCount)} sales${profile.rating ? ` · ${escapeHtml(profile.rating)} ★ (${Number(profile.reviewCount)} reviews)` : ''}</p><button class="button button-outline" id="follow-button">${profile.isFollowing ? 'Unfollow' : 'Follow'}</button><button class="button button-dark" id="message-seller">Message seller</button>`;
    target.querySelectorAll('[data-follow-list]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const { users } = await api(`/api/users/${encodeURIComponent(userId)}/${button.dataset.followList}`);
        byId('seller-follow-list').innerHTML = users.length ? users.map((person) => `<article class="order-card"><div><strong>${escapeHtml(person.name)} ${escapeHtml(person.handle)}</strong></div><a class="button button-outline" href="#profile?id=${encodeURIComponent(person.id)}">View profile</a></article>`).join('') : '<p class="muted">No people in this list yet.</p>';
      } catch (error) {
        notify(error.message, true);
      }
    }));
    byId('follow-button').addEventListener('click', async () => {
      try {
        await api(`/api/users/${encodeURIComponent(userId)}/follow`, { method: profile.isFollowing ? 'DELETE' : 'POST' });
        await loadSellerProfile(userId);
      } catch (error) {
        notify(error.message, true);
      }
    });
    byId('message-seller').addEventListener('click', () => {
      if (!requireSignIn()) return;
      state.selectedChat = userId;
      location.hash = 'messages';
    });
    state.items = [...state.items, ...result.items];
    const targetItems = byId('seller-items');
    targetItems.innerHTML = result.items.length ? result.items.map(listingCard).join('') : '<p class="muted">No active listings.</p>';
    bindListingCards(targetItems);
    byId('seller-reviews').innerHTML = result.reviews.length ? result.reviews.map((review) => `<article class="order-card"><div><strong>${Number(review.rating)} ★ · ${escapeHtml(review.buyerName)}</strong><span>${escapeHtml(review.itemTitle)}</span><p>${escapeHtml(review.text || '')}</p></div></article>`).join('') : '<p class="muted">No reviews yet.</p>';
  } catch (error) {
    target.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p>`;
  }
}
async function orderAction(orderId, action) {
  if (action === 'review') {
    const rating = Number(prompt('Seller rating (1 to 5):'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const text = prompt('Optional review comment:') || '';
    try {
      await api(`/api/orders/${orderId}/review`, { method: 'POST', body: { rating, text } });
      await loadOrders();
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === 'confirm' && !confirm('Confirm that you received this order? This releases the simulated escrow.')) return;
  if (action === 'dispute' && !confirm('Report a problem and pause the simulated payout?')) return;
  try {
    await api(`/api/orders/${orderId}/${action}`, { method: 'POST' });
    await loadOrders();
    notify(action === 'confirm' ? 'Order confirmed.' : action === 'dispute' ? 'Support has been notified.' : 'Order updated.');
  } catch (error) {
    notify(error.message, true);
  }
}
async function dispatchOrder(event, form) {
  event.preventDefault();
  try {
    await api(`/api/orders/${form.dataset.orderId}/dispatch`, { method: 'POST', body: { trackingNumber: new FormData(form).get('trackingNumber') } });
    await loadOrders();
  } catch (error) {
    notify(error.message, true);
  }
}
async function submitAuth(event) {
  event.preventDefault();
  const form = byId('auth-form');
  const data = new FormData(form);
  const email = state.authMode === 'reset' ? state.resetEmail : data.get('email');
  const button = byId('auth-submit');
  button.disabled = true;
  setMessage('auth-message', 'One moment…');
  try {
    if (state.authMode === 'register') {
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: {
          email,
          password: data.get('password'),
          name: data.get('name'),
          handle: data.get('handle'),
          acceptTerms: form.elements.terms.checked,
          termsVersion,
        },
      });
      setSignedIn(result.user, result.token);
      closeDialog('auth-dialog');
      notify(`Welcome${result.user.name ? `, ${result.user.name.split(' ')[0]}` : ''}!`);
      renderPage();
    } else if (state.authMode === 'forgot') {
      await api('/api/auth/forgot', { method: 'POST', body: { email } });
      state.resetEmail = email;
      showAuth('reset');
      form.elements.email.value = email;
      setMessage('auth-message', 'If the account exists, a reset code has been sent to its email address.');
    } else if (state.authMode === 'reset') {
      const result = await api('/api/auth/reset', {
        method: 'POST',
        body: { email, code: data.get('code'), password: data.get('password') },
      });
      state.resetEmail = '';
      setSignedIn(result.user, result.token);
      closeDialog('auth-dialog');
      notify('Your password has been reset.');
      renderPage();
    } else {
      const result = await api('/api/auth/login', { method: 'POST', body: { email, password: data.get('password') } });
      setSignedIn(result.user, result.token);
      closeDialog('auth-dialog');
      notify(`Welcome${result.user.name ? `, ${result.user.name.split(' ')[0]}` : ''}!`);
      renderPage();
    }
  } catch (error) {
    setMessage('auth-message', error.message, true);
  } finally {
    button.disabled = false;
  }
}
function init() {
  applyTheme(state.theme);
  byId('year').textContent = new Date().getFullYear();
  byId('search').addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    if (state.query && state.page !== 'shop') location.hash = 'shop';
    clearTimeout(init.searchTimeout);
    init.searchTimeout = setTimeout(() => loadItems(), 250);
  });
  byId('load-more').addEventListener('click', () => loadItems(true));
  byId('refresh-live').addEventListener('click', loadLiveRooms);
  byId('theme-toggle').addEventListener('click', () => {
    const theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('dobha-theme', theme);
    applyTheme(theme);
  });
  byId('mobile-menu-toggle').addEventListener('click', () => {
    const expanded = byId('mobile-menu-toggle').getAttribute('aria-expanded') === 'true';
    byId('mobile-menu-toggle').setAttribute('aria-expanded', String(!expanded));
    byId('top-actions').classList.toggle('mobile-open', !expanded);
  });
  byId('top-actions').querySelectorAll('[data-page-link]').forEach((link) => {
    link.addEventListener('click', () => {
      byId('mobile-menu-toggle').setAttribute('aria-expanded', 'false');
      byId('top-actions').classList.remove('mobile-open');
    });
  });
  byId('signout-button').addEventListener('click', () => {
    api('/api/auth/logout', { method: 'POST' }).catch((error) => console.error('Sign-out failed:', error));
    signOut();
    location.hash = 'home';
    notify('You have signed out.');
  });
  byId('signout-account').addEventListener('click', () => {
    api('/api/auth/logout', { method: 'POST' }).catch((error) => console.error('Sign-out failed:', error));
    signOut();
    location.hash = 'home';
    notify('You have signed out.');
  });
  byId('auth-button').addEventListener('click', () => state.user ? location.hash = 'account' : showAuth());
  byId('account-nav').addEventListener('click', () => { if (!state.token) showAuth(); });
  byId('cart-nav').addEventListener('click', () => { location.hash = 'cart'; });
  byId('auth-form').addEventListener('submit', submitAuth);
  byId('auth-switch').addEventListener('click', () => showAuth(state.authMode === 'register' ? 'login' : 'register'));
  byId('forgot-link').addEventListener('click', () => showAuth('forgot'));
  byId('google-signin').addEventListener('click', () => {
    if (!window.google?.accounts?.id || !window.DOBHA_CONFIG?.googleClientId) {
      setMessage('auth-message', 'Google sign-in is not available right now.', true);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: window.DOBHA_CONFIG.googleClientId,
      callback: async ({ credential }) => {
        try {
          const result = await api('/api/auth/google', { method: 'POST', body: { idToken: credential, termsVersion } });
          setSignedIn(result.user, result.token);
          closeDialog('auth-dialog');
          renderPage();
          notify('Signed in with Google.');
        } catch (error) {
          setMessage('auth-message', error.message, true);
        }
      },
    });
    window.google.accounts.id.prompt();
  });
  byId('vendor-submit').addEventListener('click', createVendor);
  byId('sell-form').addEventListener('submit', createListing);
  byId('checkout-form').addEventListener('submit', checkout);
  byId('wallet-topup').addEventListener('submit', (event) => walletAction(event, '/api/wallet/topup'));
  byId('wallet-withdraw').addEventListener('submit', (event) => walletAction(event, '/api/wallet/withdraw'));
  byId('profile-form').addEventListener('submit', saveProfile);
  byId('avatar-form').addEventListener('submit', uploadAvatar);
  byId('remove-avatar').addEventListener('click', removeAvatar);
  byId('password-form').addEventListener('submit', changePassword);
  byId('delete-account-form').addEventListener('submit', deleteAccount);
  byId('support-form').addEventListener('submit', submitSupport);
  byId('people-search-form').addEventListener('submit', searchPeople);
  byId('stop-inline-stream').addEventListener('click', stopStream);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));
  byId('live-dialog').addEventListener('close', stopStream);
  window.addEventListener('hashchange', () => {
    byId('mobile-menu-toggle').setAttribute('aria-expanded', 'false');
    byId('top-actions').classList.remove('mobile-open');
    renderPage();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      byId('search').focus();
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (!localStorage.getItem('dobha-theme')) applyTheme(event.matches ? 'dark' : 'light');
  });
  const categorySelect = byId('sell-form').elements.category;
  categorySelect.innerHTML = categories.slice(1).map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  byId('location-filter').addEventListener('change', (event) => {
    state.location = event.target.value;
    loadItems();
  });
  setFieldGroup(document.querySelector('.vendor-fields'), true);
  setFieldGroup(document.querySelector('.listing-fields'), false);
  renderFilters();
  renderHomeCategories();
  renderPage();
  loadProfile();
  loadItems();
}
init();
