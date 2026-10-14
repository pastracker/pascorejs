/**
 * PASTOKO ENGINE (1.0.0.js)
 * Official Standalone Frontend & E-Commerce Engine.
 * Lightweight, zero-dependency Vanilla JS Framework for Hono JSX / SSR & SPA Storefronts.
 * Version: 1.0.0 (Standalone Complete Edition: Net, UI, Events, Draggable, Scoped CSS, Reactive State, Editor & Multi-Style Commerce)
 */

window.Pastoko = (function() {
  'use strict';

  // =========================================================================
  // 0. GLOBAL CONFIGURATION & CENTRAL STORE STATE
  // =========================================================================
  const config = {
    apiBase: '/api',
    tokenKey: 'pastoko_jwt',
    loginUrl: '/admin/login',
    checkoutUrl: '/checkout',
    productsEndpoint: '/products/list',
    settingsEndpoint: '/settings/get',
    autoFetchStoreData: true,

    // Branding & Formatting
    themeColor: '#0f172a',
    accentColor: '#3b82f6',
    currencySymbol: 'Rp',
    currencyPosition: 'left', // 'left' (Rp 10.000) | 'right' (10.000 Rp)
    locale: 'id-ID',
    fractionDigits: 0,

    // Cart Button & Drawer Customization (FITUR BARU)
    cartStyle: 'circle',        // 'circle' | 'pill' | 'square' | 'minimal' | 'none'
    cartMode: 'drawer',         // 'drawer' | 'modal' | 'bottom-sheet'
    cartPosition: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center'
    cartDrawerSide: 'right',    // 'right' | 'left'
    cartIcon: 'bag',            // 'bag' | 'cart' | 'basket'

    // Extra Commerce Features
    freeShippingThreshold: 0,   // Set > 0 (e.g. 100000) to show Free Shipping Progress Bar in cart
    enableOrderNotes: true,     // Allow customers to write order notes inside cart drawer
    whatsappNumber: '',         // Optional: e.g. '6281234567890' to enable Direct WhatsApp Checkout button
    whatsappTemplate: 'Halo, saya ingin memesan:\n{items}\n\n*Total: {total}*\nCatatan: {notes}'
  };

  const loadStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const storeState = {
    cart: loadStorage('ptk_cart', []),
    wishlist: loadStorage('ptk_wishlist', []),
    orderNotes: localStorage.getItem('ptk_order_notes') || '',
    isCartOpen: false,
    productsCatalog: [],
    scannerInitialized: false
  };

  // =========================================================================
  // 1. HELPER UTILITIES (Currency, Icons, Safe Base64)
  // =========================================================================
  const Helpers = {
    formatMoney: (amount) => {
      const num = parseFloat(amount) || 0;
      const formatted = num.toLocaleString(config.locale, {
        minimumFractionDigits: config.fractionDigits,
        maximumFractionDigits: config.fractionDigits
      });
      return config.currencyPosition === 'right'
        ? `${formatted} ${config.currencySymbol}`
        : `${config.currencySymbol} ${formatted}`;
    },

    safeId: (str) => {
      try {
        return btoa(unescape(encodeURIComponent(String(str)))).replace(/=/g, '');
      } catch (e) {
        return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
      }
    },

    getCartSvg: (iconType = config.cartIcon, className = 'w-6 h-6') => {
      if (iconType === 'cart') {
        return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
      }
      if (iconType === 'basket') {
        return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M3 11h18l-1.5 9.5a2 2 0 01-2 1.5H6.5a2 2 0 01-2-1.5L3 11z"></path></svg>`;
      }
      // Default: 'bag'
      return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`;
    }
  };

  // =========================================================================
  // 2. PASTOKO.NET (Standalone Networking & API Module)
  // =========================================================================
  const Net = {
    _getToken: function() {
      return localStorage.getItem(config.tokenKey) || localStorage.getItem('ptk_token');
    },

    getHeaders: function() {
      const token = this._getToken();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    },

    request: async function(endpoint, method = 'GET', data = null) {
      let url = endpoint;

      if (!endpoint.startsWith('http')) {
        const cleanBase = config.apiBase.replace(/\/$/, '');
        if (endpoint.startsWith(cleanBase + '/') || endpoint.startsWith('/api/')) {
          url = endpoint;
        } else {
          const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
          url = cleanBase + cleanPath;
        }
      }

      const options = {
        method: method.toUpperCase(),
        headers: this.getHeaders()
      };

      if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        options.body = JSON.stringify(data);
      }

      try {
        const response = await fetch(url, options);

        if (response.status === 401 || response.status === 403) {
          console.error('[Pastoko.Net] Unauthorized. Session expired.');
          UI.toast('error', 'Sesi Anda telah berakhir. Silakan login kembali.');
          if (config.loginUrl && window.location.pathname.startsWith('/admin')) {
            setTimeout(() => { window.location.href = config.loginUrl; }, 1500);
          }
          return { success: false, status: response.status, message: 'Unauthorized' };
        }

        const contentType = response.headers.get('content-type');
        let result = {};

        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
        } else {
          const textData = await response.text();
          result = { success: response.ok, message: textData };
        }

        return {
          ...result,
          success: response.ok && result.success !== false,
          data: result.data !== undefined ? result.data : result,
          message: result.message || (response.ok ? 'Berhasil' : 'Permintaan gagal'),
          status: response.status
        };
      } catch (error) {
        console.error(`[Pastoko.Net] Request Error (${url}):`, error);
        return {
          success: false,
          data: null,
          message: error.message || 'Gagal terhubung ke server.',
          status: 0
        };
      }
    },

    get: function(path) { return this.request(path, 'GET'); },
    post: function(path, data) { return this.request(path, 'POST', data); },
    put: function(path, data) { return this.request(path, 'PUT', data); },
    patch: function(path, data) { return this.request(path, 'PATCH', data); },
    del: function(path, data) { return this.request(path, 'DELETE', data); }
  };

  // =========================================================================
  // 3. PASTOKO.UI (Toast, Modal, Confirm, Lightbox Zoom & Loading)
  // =========================================================================
  const UI = {
    injectStyles: function() {
      if (document.getElementById('ptk-core-styles')) return;
      const style = document.createElement('style');
      style.id = 'ptk-core-styles';
      style.innerHTML = `
        .ptk-toast-enter { transform: translateY(20px) scale(0.95); opacity: 0; }
        .ptk-toast-active { transform: translateY(0) scale(1); opacity: 1; }
        .ptk-cart-wiggle { animation: ptk-wiggle 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        @keyframes ptk-wiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-12deg) scale(1.12); }
          40% { transform: rotate(10deg) scale(1.12); }
          60% { transform: rotate(-6deg) scale(1.05); }
          80% { transform: rotate(4deg) scale(1.02); }
        }
        .ptk-backdrop-enter { opacity: 0; }
        .ptk-backdrop-active { opacity: 1; }
        .ptk-panel-scale-enter { transform: scale(0.95); opacity: 0; }
        .ptk-panel-scale-active { transform: scale(1); opacity: 1; }
      `;
      document.head.appendChild(style);
    },

    toast: function(typeOrMsg, messageOrType) {
      this.injectStyles();

      // Mendukung UI.toast('success', 'Pesan') maupun UI.toast('Pesan', 'success')
      let type = 'success';
      let message = '';
      const validTypes = ['success', 'error', 'warning', 'info'];

      if (validTypes.includes(typeOrMsg)) {
        type = typeOrMsg;
        message = messageOrType || '';
      } else {
        message = typeOrMsg || '';
        if (validTypes.includes(messageOrType)) type = messageOrType;
      }

      let container = document.getElementById('ptk-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'ptk-toast-container';
        container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2.5 pointer-events-none w-full max-w-sm px-4';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      let bgClass = 'bg-slate-900 text-white';
      let iconHtml = `<svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

      if (type === 'error') {
        bgClass = 'bg-rose-600 text-white';
        iconHtml = `<svg class="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
      } else if (type === 'warning') {
        bgClass = 'bg-amber-500 text-white';
        iconHtml = `<svg class="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      } else if (type === 'info') {
        bgClass = 'bg-blue-600 text-white';
        iconHtml = `<svg class="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      }

      toast.className = `flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold shadow-2xl transition-all duration-300 pointer-events-auto ptk-toast-enter ${bgClass}`;
      toast.innerHTML = `${iconHtml} <span>${message}</span>`;

      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.remove('ptk-toast-enter');
        toast.classList.add('ptk-toast-active');
      });

      setTimeout(() => {
        toast.classList.remove('ptk-toast-active');
        toast.classList.add('ptk-toast-enter');
        setTimeout(() => toast.remove(), 300);
      }, 3200);
    },

    // Mendukung 2 Mode:
    // 1. Toggle elemen DOM berdasarkan ID: UI.modal('my-modal-id', 'show' | 'hide')
    // 2. Render modal dinamis langsung: UI.modal('Judul Modal', '<p>Isi HTML</p>', 'max-w-lg')
    modal: function(idOrTitle, actionOrHtml = 'show', widthClass = 'max-w-lg') {
      this.injectStyles();
      const existingEl = document.getElementById(idOrTitle);

      if (existingEl && (actionOrHtml === 'show' || actionOrHtml === 'hide')) {
        if (actionOrHtml === 'show') {
          existingEl.style.display = 'flex';
          requestAnimationFrame(() => {
            existingEl.classList.remove('opacity-0');
            const child = existingEl.firstElementChild;
            if (child) child.classList.remove('scale-95', 'opacity-0');
          });
          document.body.style.overflow = 'hidden';
          existingEl.setAttribute('data-ptk-modal', 'true');
        } else {
          existingEl.classList.add('opacity-0');
          const child = existingEl.firstElementChild;
          if (child) child.classList.add('scale-95', 'opacity-0');

          setTimeout(() => {
            existingEl.style.display = 'none';
            document.body.style.overflow = '';
            existingEl.removeAttribute('data-ptk-modal');
          }, 200);
        }
        return;
      }

      // Mode Render Dinamis
      let modalWrapper = document.getElementById('ptk-dynamic-modal');
      if (modalWrapper) modalWrapper.remove();

      modalWrapper = document.createElement('div');
      modalWrapper.id = 'ptk-dynamic-modal';
      modalWrapper.setAttribute('data-ptk-modal', 'dynamic');
      modalWrapper.className = 'fixed inset-0 z-[99998] flex items-center justify-center p-4 font-sans';
      modalWrapper.innerHTML = `
        <div id="ptk-dynamic-modal-backdrop" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm ptk-backdrop-enter transition-opacity duration-200 cursor-pointer"></div>
        <div id="ptk-dynamic-modal-panel" class="bg-white rounded-3xl shadow-2xl w-full ${widthClass} relative flex flex-col ptk-panel-scale-enter transition-all duration-200 overflow-hidden">
          <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 class="text-lg font-black text-slate-900">${idOrTitle}</h3>
            <button id="ptk-dynamic-modal-close" class="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full shadow-sm transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[75vh]">
            ${actionOrHtml}
          </div>
        </div>
      `;
      document.body.appendChild(modalWrapper);
      document.body.style.overflow = 'hidden';

      const closeDynamic = () => {
        const bp = document.getElementById('ptk-dynamic-modal-backdrop');
        const pn = document.getElementById('ptk-dynamic-modal-panel');
        if (bp) bp.classList.remove('ptk-backdrop-active');
        if (pn) pn.classList.remove('ptk-panel-scale-active');
        setTimeout(() => {
          modalWrapper.remove();
          document.body.style.overflow = '';
        }, 200);
      };

      modalWrapper.querySelector('#ptk-dynamic-modal-backdrop').onclick = closeDynamic;
      modalWrapper.querySelector('#ptk-dynamic-modal-close').onclick = closeDynamic;

      requestAnimationFrame(() => {
        modalWrapper.querySelector('#ptk-dynamic-modal-backdrop').classList.add('ptk-backdrop-active');
        modalWrapper.querySelector('#ptk-dynamic-modal-panel').classList.add('ptk-panel-scale-active');
      });
    },

    confirm: function(title, message, confirmText = 'Ya, Lanjutkan', cancelText = 'Batal') {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] opacity-0 transition-opacity duration-200 font-sans';

        const box = document.createElement('div');
        box.className = 'bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-sm w-full transform scale-95 transition-all duration-200';
        box.innerHTML = `
          <h3 class="text-lg font-black text-slate-900 mb-2">${title}</h3>
          <p class="text-sm text-slate-500 mb-6 leading-relaxed">${message}</p>
          <div class="flex justify-end gap-3">
            <button id="ptk-btn-no" class="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">${cancelText}</button>
            <button id="ptk-btn-yes" class="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-md">${confirmText}</button>
          </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
          overlay.classList.remove('opacity-0');
          box.classList.remove('scale-95');
        });

        const closeDialog = (result) => {
          overlay.classList.add('opacity-0');
          box.classList.add('scale-95');
          setTimeout(() => {
            overlay.remove();
            resolve(result);
          }, 200);
        };

        overlay.querySelector('#ptk-btn-no').onclick = () => closeDialog(false);
        overlay.querySelector('#ptk-btn-yes').onclick = () => closeDialog(true);
      });
    },

    zoomImage: function(src, caption = '') {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[99999] bg-slate-900/95 flex flex-col items-center justify-center p-4 cursor-zoom-out opacity-0 transition-opacity duration-300 backdrop-blur-sm';
      modal.innerHTML = `
        <img src="${src}" class="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl scale-90 transition-transform duration-300" />
        ${caption ? `<p class="text-white/90 text-sm font-medium mt-4 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur">${caption}</p>` : ''}
      `;
      modal.onclick = () => {
        modal.classList.remove('opacity-100');
        modal.querySelector('img').classList.remove('scale-100');
        setTimeout(() => modal.remove(), 300);
      };
      document.body.appendChild(modal);
      requestAnimationFrame(() => {
        modal.classList.add('opacity-100');
        modal.querySelector('img').classList.add('scale-100');
      });
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[data-ptk-modal]').forEach(el => {
        if (el.getAttribute('data-ptk-modal') === 'dynamic') {
          el.remove();
          document.body.style.overflow = '';
        } else if (el.style.display !== 'none') {
          UI.modal(el.id, 'hide');
        }
      });
      if (storeState.isCartOpen) {
        Commerce.closeCart();
      }
    }
  });

  // =========================================================================
  // 4. PASTOKO.EVENTS (Pub/Sub Event Bus for Component Communication)
  // =========================================================================
  const Events = {
    _bus: document.createElement('div'),
    on: function(event, callback) {
      this._bus.addEventListener(event, (e) => callback(e.detail));
    },
    emit: function(event, detail = {}) {
      this._bus.dispatchEvent(new CustomEvent(event, { detail }));
      window.dispatchEvent(new CustomEvent(event, { detail }));
    }
  };

  // =========================================================================
  // 5. PASTOKO.DRAGGABLE (HTML5 Drag & Drop Engine)
  // =========================================================================
  const Draggable = {
    init: function(containerSelector, onOrderUpdateCallback) {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      let draggedEl = null;

      Array.from(container.children).forEach(child => {
        if (!child.hasAttribute('draggable')) child.setAttribute('draggable', 'true');
      });

      container.addEventListener('dragstart', (e) => {
        draggedEl = e.target.closest('[draggable="true"]');
        if (!draggedEl) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', draggedEl.innerHTML);
        setTimeout(() => draggedEl.classList.add('opacity-50', 'bg-slate-50', 'scale-[0.98]'), 0);
      });

      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetEl = e.target.closest('[draggable="true"]');
        if (targetEl && targetEl !== draggedEl) {
          const bounding = targetEl.getBoundingClientRect();
          const offset = bounding.y + (bounding.height / 2);
          if (e.clientY - offset > 0) targetEl.after(draggedEl);
          else targetEl.before(draggedEl);
        }
      });

      container.addEventListener('dragend', () => {
        if (!draggedEl) return;
        draggedEl.classList.remove('opacity-50', 'bg-slate-50', 'scale-[0.98]');
        draggedEl = null;

        if (typeof onOrderUpdateCallback === 'function') {
          const newOrder = Array.from(container.children)
            .map(el => el.getAttribute('data-id'))
            .filter(Boolean);
          onOrderUpdateCallback(newOrder);
        }
      });
    }
  };

  // =========================================================================
  // 6. PASTOKO.CSS (Scoped CSS Injector for Isolated Components)
  // =========================================================================
  const CSS = {
    injectScoped: function(cssString, scopeClass) {
      if (document.getElementById('ptk-style-' + scopeClass)) return;
      const style = document.createElement('style');
      style.id = 'ptk-style-' + scopeClass;

      const scopedCss = cssString.replace(/(^|\}\s*)([^{]+)\{/g, (match, prefix, selectors) => {
        if (selectors.trim().startsWith('@')) return match;
        const scopedSelectors = selectors
          .split(',')
          .map(s => `.${scopeClass} ${s.trim()}`)
          .join(', ');
        return prefix + scopedSelectors + ' {';
      });

      style.innerHTML = scopedCss;
      document.head.appendChild(style);
    }
  };

  // =========================================================================
  // 7. PASTOKO.STATE (Reactive Engine with Deep Binding & Event Delegation)
  // Mendukung direktif ptk-* (utama) dan pas-* (kompatibilitas template)
  // =========================================================================
  const State = {
    create: function(rootSelector, initialData = {}, methods = {}) {
      const rootEl = document.querySelector(rootSelector);
      if (!rootEl) {
        console.warn(`[Pastoko.State] Root element ${rootSelector} tidak ditemukan.`);
        return initialData;
      }

      const evaluate = (expr, state, localVars = {}) => {
        try {
          const ctx = { ...state, ...localVars };
          return new Function('ctx', `with(ctx) { return ${expr}; }`)(ctx);
        } catch (e) {
          console.error(`[Pastoko.State] Expression error pada "${expr}":`, e);
          return undefined;
        }
      };

      const assignNestedValue = (obj, path, value) => {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          if (current[keys[i]] === undefined || current[keys[i]] === null) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
      };

      const getAttr = (el, name) => el.getAttribute(`ptk-${name}`) || el.getAttribute(`pas-${name}`);

      const updateDOM = (state) => {
        // 1. Text Content (ptk-text / pas-text)
        rootEl.querySelectorAll('[ptk-text], [pas-text]').forEach(el => {
          const val = evaluate(getAttr(el, 'text'), state);
          if (val !== undefined && el.textContent !== String(val)) el.textContent = val;
        });

        // 2. HTML Content (ptk-html / pas-html)
        rootEl.querySelectorAll('[ptk-html], [pas-html]').forEach(el => {
          const val = evaluate(getAttr(el, 'html'), state);
          if (val !== undefined && el.innerHTML !== String(val)) el.innerHTML = val;
        });

        // 3. Visibility (ptk-show / pas-show)
        rootEl.querySelectorAll('[ptk-show], [pas-show]').forEach(el => {
          const condition = evaluate(getAttr(el, 'show'), state);
          el.style.display = condition ? '' : 'none';
        });

        // 4. Two-Way Model Binding (ptk-model / pas-model)
        rootEl.querySelectorAll('[ptk-model], [pas-model]').forEach(el => {
          const key = getAttr(el, 'model');
          const val = evaluate(key, state);
          if (val !== undefined) {
            if (el.type === 'checkbox') el.checked = !!val;
            else if (el.type === 'radio') el.checked = (el.value === String(val));
            else if (el.value !== String(val)) el.value = val;
          }
        });

        // 5. Dynamic Attributes (ptk-bind:* / pas-bind:*)
        rootEl.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('ptk-bind:') || attr.name.startsWith('pas-bind:')) {
              const targetAttr = attr.name.split(':')[1];
              const val = evaluate(attr.value, state);
              if (val) {
                el.setAttribute(targetAttr, val === true ? targetAttr : val);
                if (val === true) el[targetAttr] = true;
              } else {
                el.removeAttribute(targetAttr);
                if (val === false) el[targetAttr] = false;
              }
            }
          });
        });

        // 6. Dynamic CSS Classes (ptk-class / pas-class)
        rootEl.querySelectorAll('[ptk-class], [pas-class]').forEach(el => {
          const classObj = evaluate(getAttr(el, 'class'), state) || {};
          for (let cls in classObj) {
            const classes = cls.split(' ').filter(Boolean);
            if (classObj[cls]) el.classList.add(...classes);
            else el.classList.remove(...classes);
          }
        });

        // 7. Template Loop Rendering (template[ptk-for] / template[pas-for])
        rootEl.querySelectorAll('template[ptk-for], template[pas-for]').forEach(tpl => {
          const expr = getAttr(tpl, 'for');
          const parts = expr.split(' in ');
          if (parts.length !== 2) return;

          const itemName = parts[0].trim();
          const arrayName = parts[1].trim();
          const arrayData = evaluate(arrayName, state) || [];

          let container = tpl.nextElementSibling;
          if (!container || !container.classList.contains('ptk-for-container')) {
            container = document.createElement('div');
            container.className = 'ptk-for-container contents';
            tpl.parentNode.insertBefore(container, tpl.nextSibling);
          }

          container.innerHTML = '';

          arrayData.forEach((item, index) => {
            const clone = tpl.content.cloneNode(true);

            const replaceTokens = (str) => {
              return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
                if (path === '$index') return index;
                if (path === itemName && typeof item !== 'object') return item;
                if (path.startsWith(itemName + '.')) {
                  const prop = path.slice(itemName.length + 1);
                  return prop.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : ''), item);
                }
                return match;
              });
            };

            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
            let textNode;
            while ((textNode = walker.nextNode())) {
              if (textNode.nodeValue.includes('{{')) {
                textNode.nodeValue = replaceTokens(textNode.nodeValue);
              }
            }

            clone.querySelectorAll('*').forEach(el => {
              Array.from(el.attributes).forEach(attr => {
                if (attr.value.includes('{{')) {
                  attr.value = replaceTokens(attr.value);
                }
              });
            });

            container.appendChild(clone);
          });
        });
      };

      const stateProxy = new Proxy({ ...initialData }, {
        set: function(target, property, value) {
          target[property] = value;
          updateDOM(target);
          return true;
        }
      });

      for (let funcName in methods) {
        if (typeof methods[funcName] === 'function') {
          stateProxy[funcName] = function(...args) {
            return methods[funcName].call(methods, stateProxy, ...args);
          };
        }
      }

      // Input & Change Delegation
      rootEl.addEventListener('input', (e) => {
        const el = e.target.closest('[ptk-model], [pas-model]');
        if (el) {
          const key = getAttr(el, 'model');
          const val = el.type === 'checkbox' ? el.checked : el.value;
          if (key.includes('.')) {
            assignNestedValue(stateProxy, key, val);
            updateDOM(stateProxy);
          } else {
            stateProxy[key] = val;
          }
        }
      });

      rootEl.addEventListener('change', (e) => {
        const el = e.target.closest('[ptk-model], [pas-model]');
        if (el && (el.type === 'radio' || el.tagName === 'SELECT')) {
          const key = getAttr(el, 'model');
          if (key.includes('.')) {
            assignNestedValue(stateProxy, key, el.value);
            updateDOM(stateProxy);
          } else {
            stateProxy[key] = el.value;
          }
        }
      });

      // Click & Custom Events Delegation (ptk-click / ptk-on:* / pas-click / pas-on:*)
      const handleEvent = (e) => {
        if (e.type === 'click') {
          const clickEl = e.target.closest('[ptk-click], [pas-click]');
          if (clickEl) {
            const funcDef = getAttr(clickEl, 'click');
            const funcName = funcDef.split('(')[0].trim();
            if (typeof methods[funcName] === 'function') {
              if (clickEl.tagName === 'A' || clickEl.tagName === 'BUTTON') e.preventDefault();
              methods[funcName].call(methods, stateProxy, e);
            }
          }
        }

        const path = e.composedPath ? e.composedPath() : [];
        for (let el of path) {
          if (!el.attributes) continue;
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith(`ptk-on:${e.type}`) || attr.name.startsWith(`pas-on:${e.type}`)) {
              const modifiers = attr.name.split('.').slice(1);
              const funcName = attr.value.split('(')[0].trim();
              if (typeof methods[funcName] === 'function') {
                if (modifiers.includes('prevent') || e.type === 'submit') e.preventDefault();
                if (modifiers.includes('stop')) e.stopPropagation();
                methods[funcName].call(methods, stateProxy, e);
              }
            }
          });
        }
      };

      ['click', 'submit', 'keyup', 'keydown'].forEach(eventType => {
        rootEl.addEventListener(eventType, handleEvent);
      });

      updateDOM(stateProxy);
      rootEl._ptkState = stateProxy;
      return stateProxy;
    }
  };

  // =========================================================================
  // 8. PASTOKO.EDITOR (Quill WYSIWYG Integration + ContentEditable Fallback)
  // =========================================================================
  const Editor = {
    init: function(elementId, initialContent = '', onChangeCallback = null) {
      const targetEl = document.getElementById(elementId);
      if (!targetEl) return null;

      if (typeof window.Quill !== 'undefined') {
        const quill = new window.Quill(targetEl, {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['link', 'image', 'video', 'code-block'],
              ['clean']
            ]
          }
        });

        if (initialContent) {
          quill.clipboard.dangerouslyPasteHTML(initialContent);
        }

        if (typeof onChangeCallback === 'function') {
          quill.on('text-change', () => {
            onChangeCallback(quill.root.innerHTML);
          });
        }

        return quill;
      }

      // Fallback ke ContentEditable standar jika Quill tidak dimuat
      targetEl.contentEditable = true;
      targetEl.className += ' p-4 outline-none';
      targetEl.innerHTML = initialContent || '';
      if (typeof onChangeCallback === 'function') {
        targetEl.addEventListener('input', () => onChangeCallback(targetEl.innerHTML));
      }
      return targetEl;
    }
  };

  // =========================================================================
  // 9. PASTOKO.COMMERCE (Standalone Storefront, Multi-Style Cart & Wishlist)
  // =========================================================================
  const Commerce = {
    _syncCart: function() {
      localStorage.setItem('ptk_cart', JSON.stringify(storeState.cart));
      Events.emit('ptk-cart-updated', {
        cart: storeState.cart,
        totalItems: this.getTotalItems(),
        subtotal: this.getSubtotal()
      });
    },

    _syncWishlist: function() {
      localStorage.setItem('ptk_wishlist', JSON.stringify(storeState.wishlist));
      Events.emit('ptk-wishlist-updated', { wishlist: storeState.wishlist });
    },

    getTotalItems: function() {
      return storeState.cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    },

    getSubtotal: function() {
      return storeState.cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.qty) || 0)), 0);
    },

    // --- A. RENDER FLOATING CART DENGAN PILIHAN BENTUK (circle, pill, square, minimal, none) ---
    renderFloatingCart: function() {
      const existing = document.getElementById('ptk-floating-cart');
      if (existing) existing.remove();

      if (config.cartStyle === 'none') return;

      let posClasses = 'bottom-6 right-6';
      switch (config.cartPosition) {
        case 'bottom-left': posClasses = 'bottom-6 left-6'; break;
        case 'top-right': posClasses = 'top-6 right-6'; break;
        case 'top-left': posClasses = 'top-6 left-6'; break;
        case 'bottom-center': posClasses = 'bottom-6 left-1/2 -translate-x-1/2'; break;
        default: posClasses = 'bottom-6 right-6';
      }

      const btn = document.createElement('button');
      btn.id = 'ptk-floating-cart';
      btn.type = 'button';
      btn.style.backgroundColor = config.themeColor;

      if (config.cartStyle === 'pill') {
        btn.className = `fixed ${posClasses} h-14 px-5 rounded-full shadow-2xl flex items-center gap-3 text-white z-[9990] hover:scale-105 active:scale-95 transition-all focus:outline-none font-sans`;
        btn.innerHTML = `
          <div class="relative flex items-center">
            ${Helpers.getCartSvg(config.cartIcon, 'w-5 h-5')}
          </div>
          <div class="flex flex-col items-start leading-tight text-left">
            <span class="text-[10px] font-bold uppercase tracking-wider opacity-80"><span id="ptk-cart-badge-pill">0</span> Item</span>
            <span id="ptk-cart-pill-total" class="text-xs font-black">${Helpers.formatMoney(0)}</span>
          </div>
        `;
      } else if (config.cartStyle === 'square') {
        btn.className = `fixed ${posClasses} w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center text-white z-[9990] hover:scale-105 active:scale-95 transition-all focus:outline-none font-sans`;
        btn.innerHTML = `
          ${Helpers.getCartSvg(config.cartIcon, 'w-6 h-6')}
          <span id="ptk-cart-badge" class="absolute -top-2 -right-2 bg-rose-500 text-white text-[11px] font-black min-w-[24px] h-6 px-1.5 rounded-lg flex items-center justify-center border-2 border-white transform scale-0 transition-transform">0</span>
        `;
      } else if (config.cartStyle === 'minimal') {
        btn.className = `fixed ${posClasses} h-11 px-4 rounded-xl shadow-lg flex items-center gap-2 text-white z-[9990] hover:opacity-95 active:scale-95 transition-all focus:outline-none font-sans`;
        btn.innerHTML = `
          ${Helpers.getCartSvg(config.cartIcon, 'w-4 h-4')}
          <span id="ptk-cart-badge" class="text-xs font-black">0</span>
        `;
      } else {
        // Default: 'circle'
        btn.className = `fixed ${posClasses} w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white z-[9990] hover:scale-105 active:scale-95 transition-all focus:outline-none font-sans`;
        btn.innerHTML = `
          ${Helpers.getCartSvg(config.cartIcon, 'w-6 h-6')}
          <span id="ptk-cart-badge" class="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white transform scale-0 transition-transform">0</span>
        `;
      }

      btn.onclick = () => this.openCart();
      document.body.appendChild(btn);
    },

    // --- B. RENDER CART CONTAINER DENGAN PILIHAN MODE (drawer, modal, bottom-sheet) ---
    renderCartContainer: function() {
      const existing = document.getElementById('ptk-cart-container');
      if (existing) existing.remove();

      const wrapper = document.createElement('div');
      wrapper.id = 'ptk-cart-container';
      wrapper.className = 'fixed inset-0 z-[9995] pointer-events-none font-sans';

      let panelPositionClass = '';
      let panelHiddenTransform = '';

      if (config.cartMode === 'modal') {
        panelPositionClass = 'inset-0 m-auto w-[92%] max-w-lg max-h-[85vh] rounded-3xl';
        panelHiddenTransform = 'scale-95 opacity-0';
      } else if (config.cartMode === 'bottom-sheet') {
        panelPositionClass = 'bottom-0 left-0 right-0 w-full max-w-2xl mx-auto max-h-[85vh] rounded-t-3xl';
        panelHiddenTransform = 'translate-y-full';
      } else {
        // Default: 'drawer'
        if (config.cartDrawerSide === 'left') {
          panelPositionClass = 'top-0 left-0 w-full max-w-md h-full';
          panelHiddenTransform = '-translate-x-full';
        } else {
          panelPositionClass = 'top-0 right-0 w-full max-w-md h-full';
          panelHiddenTransform = 'translate-x-full';
        }
      }

      wrapper.setAttribute('data-hidden-transform', panelHiddenTransform);

      wrapper.innerHTML = `
        <div id="ptk-cart-backdrop" class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm opacity-0 transition-opacity duration-300 cursor-pointer"></div>
        <div id="ptk-cart-panel" class="absolute ${panelPositionClass} bg-white shadow-2xl transform ${panelHiddenTransform} transition-all duration-300 flex flex-col pointer-events-auto overflow-hidden">
          <!-- Header -->
          <div class="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
            <h2 class="text-lg font-black text-slate-900 flex items-center gap-2.5">
              <span style="color:${config.themeColor}">${Helpers.getCartSvg(config.cartIcon, 'w-5 h-5')}</span>
              <span>Keranjang Belanja</span>
              <span id="ptk-drawer-count" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">0</span>
            </h2>
            <div class="flex items-center gap-2">
              <button id="ptk-cart-clear-btn" title="Kosongkan Keranjang" class="p-2 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors hidden">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
              <button id="ptk-cart-close-btn" class="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full shadow-sm hover:shadow transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          <!-- Free Shipping Bar (Optional) -->
          <div id="ptk-shipping-bar-wrap" class="px-6 py-3 bg-slate-50 border-b border-slate-100 hidden">
            <div id="ptk-shipping-text" class="text-xs font-bold text-slate-600 mb-1.5"></div>
            <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div id="ptk-shipping-progress" class="h-full transition-all duration-500 rounded-full" style="background-color:${config.accentColor}; width: 0%"></div>
            </div>
          </div>

          <!-- Cart Items List -->
          <div id="ptk-cart-items" class="flex-1 overflow-y-auto p-5 md:p-6 space-y-3.5 bg-slate-50/30"></div>

          <!-- Order Notes & Footer -->
          <div class="p-5 md:p-6 border-t border-slate-100 bg-white space-y-4">
            ${config.enableOrderNotes ? `
              <div>
                <textarea id="ptk-order-notes-input" rows="1" placeholder="Tambah catatan pesanan (opsional)..." class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 resize-none text-slate-700">${storeState.orderNotes}</textarea>
              </div>
            ` : ''}

            <div class="flex justify-between items-end">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
              <span id="ptk-cart-subtotal" class="text-xl md:text-2xl font-black text-slate-900">${Helpers.formatMoney(0)}</span>
            </div>

            <div class="flex flex-col gap-2.5">
              <a id="ptk-checkout-link" href="${config.checkoutUrl}" class="block w-full py-3.5 text-center text-white text-sm font-black rounded-xl shadow-lg transition-all hover:opacity-95 active:scale-[0.99]" style="background-color: ${config.themeColor}">
                Lanjut ke Pembayaran
              </a>
              ${config.whatsappNumber ? `
                <button id="ptk-wa-checkout-btn" type="button" class="w-full py-3 text-center text-white text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                  <span>Pesan Langsung via WhatsApp</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(wrapper);

      wrapper.querySelector('#ptk-cart-backdrop').onclick = () => this.closeCart();
      wrapper.querySelector('#ptk-cart-close-btn').onclick = () => this.closeCart();
      wrapper.querySelector('#ptk-cart-clear-btn').onclick = async () => {
        const ok = await UI.confirm('Kosongkan Keranjang?', 'Semua produk di dalam keranjang belanja Anda akan dihapus.');
        if (ok) this.clearCart();
      };

      const notesInput = wrapper.querySelector('#ptk-order-notes-input');
      if (notesInput) {
        notesInput.addEventListener('input', (e) => {
          storeState.orderNotes = e.target.value;
          localStorage.setItem('ptk_order_notes', storeState.orderNotes);
        });
      }

      const waBtn = wrapper.querySelector('#ptk-wa-checkout-btn');
      if (waBtn) {
        waBtn.onclick = () => this.checkoutWhatsApp();
      }
    },

    // --- C. BUKA & TUTUP KERANJANG ---
    openCart: function() {
      if (!document.getElementById('ptk-cart-container')) {
        this.renderCartContainer();
        this.refreshCartUI();
      }
      const container = document.getElementById('ptk-cart-container');
      const backdrop = document.getElementById('ptk-cart-backdrop');
      const panel = document.getElementById('ptk-cart-panel');
      const hiddenTransform = container.getAttribute('data-hidden-transform').split(' ');

      storeState.isCartOpen = true;
      container.classList.remove('pointer-events-none');
      backdrop.classList.replace('opacity-0', 'opacity-100');
      panel.classList.remove(...hiddenTransform);
      document.body.style.overflow = 'hidden';
    },

    closeCart: function() {
      const container = document.getElementById('ptk-cart-container');
      if (!container) return;
      const backdrop = document.getElementById('ptk-cart-backdrop');
      const panel = document.getElementById('ptk-cart-panel');
      const hiddenTransform = container.getAttribute('data-hidden-transform').split(' ');

      storeState.isCartOpen = false;
      backdrop.classList.replace('opacity-100', 'opacity-0');
      panel.classList.add(...hiddenTransform);
      document.body.style.overflow = '';

      setTimeout(() => {
        container.classList.add('pointer-events-none');
      }, 300);
    },

    // --- D. MANAJEMEN ITEM KERANJANG (ADD, UPDATE, REMOVE, CLEAR) ---
    // Mendukung pemanggilan via Objek langsung: Pastoko.addToCart({ id, title, price, ... }, qty, variant)
    // maupun via ID Produk dari atribut HTML: Pastoko.addToCart('prod_123', qty, variant)
    addToCart: function(productOrId, qty = 1, explicitVariant = null, silent = false) {
      const parsedQty = Math.max(1, parseInt(qty) || 1);
      let productObj = null;

      if (typeof productOrId === 'object' && productOrId !== null) {
        productObj = productOrId;
      } else {
        productObj = storeState.productsCatalog.find(p => String(p.id) === String(productOrId));
      }

      if (!productObj) {
        UI.toast('error', 'Data produk belum siap atau tidak ditemukan.');
        return;
      }

      const productId = productObj.id;
      const baseP = parseFloat(productObj.price) || 0;
      const saleP = parseFloat(productObj.sale_price) || 0;
      let activePrice = saleP > 0 ? saleP : baseP;

      // Deteksi Varian
      let variantName = explicitVariant !== null ? explicitVariant : (productObj.variant || '');
      const variantSelect = document.getElementById('product-variants') || document.querySelector(`[data-ptk-variant-for="${productId}"]`);
      if (!variantName && variantSelect && variantSelect.value !== '') {
        try {
          const variantsJson = JSON.parse((productObj.variants_json || '[]').replace(/&quot;/g, '"'));
          const selectedVariant = variantsJson[variantSelect.value] || variantsJson.find(v => v.name === variantSelect.value);
          if (selectedVariant) {
            variantName = selectedVariant.name;
            if (parseFloat(selectedVariant.price) > 0) activePrice = parseFloat(selectedVariant.price);
          } else {
            variantName = variantSelect.value;
          }
        } catch (e) {
          variantName = variantSelect.value;
        }
      }

      // Deteksi Gambar Thumbnail
      let imgUrl = productObj.img || productObj.image || productObj.thumbnail || 'https://placehold.co/200x200/f8fafc/94a3b8?text=Produk';
      if (productObj.images_json) {
        try {
          const imgsJson = JSON.parse(productObj.images_json.replace(/&quot;/g, '"') || '[]');
          if (Array.isArray(imgsJson) && imgsJson.length > 0) imgUrl = imgsJson[0];
        } catch (e) {}
      }

      const cartItemId = variantName ? `${productId}-${Helpers.safeId(variantName)}` : String(productId);
      const existing = storeState.cart.find(i => i.cartItemId === cartItemId || (String(i.id) === String(productId) && (i.variant || '') === variantName));

      if (existing) {
        existing.qty += parsedQty;
      } else {
        storeState.cart.push({
          cartItemId: cartItemId,
          id: productId,
          qty: parsedQty,
          price: activePrice,
          name: productObj.name || productObj.title || 'Produk',
          variant: variantName,
          img: imgUrl,
          slug: productObj.slug || ''
        });
      }

      this._syncCart();
      this.refreshCartUI();

      if (!silent) {
        UI.toast('success', 'Produk ditambahkan ke keranjang!');
        this.animateCartWiggle();
      }
    },

    buyNow: function(productOrId, qty = 1, explicitVariant = null) {
      this.addToCart(productOrId, qty, explicitVariant, true);
      window.location.href = config.checkoutUrl;
    },

    updateQty: function(idx, change) {
      if (storeState.cart[idx]) {
        storeState.cart[idx].qty += change;
        if (storeState.cart[idx].qty <= 0) {
          storeState.cart.splice(idx, 1);
        }
        this._syncCart();
        this.refreshCartUI();
      }
    },

    removeItem: function(idx) {
      if (storeState.cart[idx]) {
        storeState.cart.splice(idx, 1);
        this._syncCart();
        this.refreshCartUI();
      }
    },

    clearCart: function() {
      storeState.cart = [];
      localStorage.removeItem('ptk_cart');
      this._syncCart();
      this.refreshCartUI();
    },

    getCart: function() {
      return storeState.cart;
    },

    // --- E. WISHLIST ENGINE ---
    toggleWishlist: function(productId) {
      const idStr = String(productId);
      const idx = storeState.wishlist.indexOf(idStr);
      let added = false;

      if (idx > -1) {
        storeState.wishlist.splice(idx, 1);
        UI.toast('info', 'Dihapus dari daftar keinginan.');
      } else {
        storeState.wishlist.push(idStr);
        added = true;
        UI.toast('success', 'Disimpan ke daftar keinginan!');
      }

      this._syncWishlist();
      this.refreshWishlistUI();
      return added;
    },

    getWishlist: function() {
      return storeState.wishlist;
    },

    refreshWishlistUI: function() {
      document.querySelectorAll('[ptk-bind="wishlist_count"]').forEach(el => {
        el.innerText = storeState.wishlist.length;
      });
      document.querySelectorAll('[ptk-action="toggle_wishlist"]').forEach(btn => {
        const id = String(btn.getAttribute('ptk-id') || '');
        if (storeState.wishlist.includes(id)) {
          btn.classList.add('text-rose-500', 'is-wishlisted');
        } else {
          btn.classList.remove('text-rose-500', 'is-wishlisted');
        }
      });
    },

    // --- F. QUICK VIEW MODAL PRODUK ---
    quickView: function(productId) {
      const product = storeState.productsCatalog.find(p => String(p.id) === String(productId));
      if (!product) {
        UI.toast('error', 'Detail produk tidak ditemukan.');
        return;
      }

      let imgUrl = product.img || product.image || 'https://placehold.co/400x400/f8fafc/94a3b8?text=Produk';
      try {
        const imgs = JSON.parse((product.images_json || '[]').replace(/&quot;/g, '"'));
        if (imgs.length > 0) imgUrl = imgs[0];
      } catch (e) {}

      const price = parseFloat(product.sale_price) > 0 ? parseFloat(product.sale_price) : (parseFloat(product.price) || 0);

      const html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <img src="${imgUrl}" class="w-full aspect-square object-cover rounded-2xl bg-slate-100 cursor-zoom-in" onclick="window.Pastoko.UI.zoomImage('${imgUrl}')" />
          <div class="flex flex-col justify-between h-full space-y-4">
            <div>
              <h4 class="text-xl font-black text-slate-900 mb-2">${product.title || product.name}</h4>
              <div class="text-2xl font-black mb-4" style="color:${config.themeColor}">${Helpers.formatMoney(price)}</div>
              <p class="text-sm text-slate-500 leading-relaxed line-clamp-4">${product.description || 'Tidak ada deskripsi produk.'}</p>
            </div>
            <div class="pt-4 border-t border-slate-100 flex gap-3">
              <button type="button" onclick="window.Pastoko.Commerce.addToCart('${product.id}', 1); document.getElementById('ptk-dynamic-modal').remove(); document.body.style.overflow='';" class="flex-1 py-3.5 px-5 rounded-xl text-white font-black text-sm shadow-lg transition-opacity hover:opacity-95" style="background-color:${config.themeColor}">
                + Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      `;

      UI.modal(product.title || product.name || 'Detail Produk', html, 'max-w-2xl');
    },

    // --- G. WHATSAPP DIRECT CHECKOUT ---
    checkoutWhatsApp: function() {
      if (!config.whatsappNumber) return;
      if (storeState.cart.length === 0) {
        UI.toast('warning', 'Keranjang belanja Anda masih kosong.');
        return;
      }

      const itemsList = storeState.cart.map((item, i) => {
        const varText = item.variant ? ` (${item.variant})` : '';
        return `${i + 1}. ${item.name}${varText} x${item.qty} = ${Helpers.formatMoney(item.price * item.qty)}`;
      }).join('\n');

      const message = config.whatsappTemplate
        .replace('{items}', itemsList)
        .replace('{total}', Helpers.formatMoney(this.getSubtotal()))
        .replace('{notes}', storeState.orderNotes || '-');

      const cleanPhone = config.whatsappNumber.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    },

    // --- H. SINKRONISASI TAMPILAN DOM KERANJANG & BADGE ---
    animateCartWiggle: function() {
      const btn = document.getElementById('ptk-floating-cart');
      if (!btn) return;
      btn.classList.remove('ptk-cart-wiggle');
      void btn.offsetWidth;
      btn.classList.add('ptk-cart-wiggle');
    },

    refreshCartUI: function() {
      const totalItems = this.getTotalItems();
      const subtotal = this.getSubtotal();
      const formattedSubtotal = Helpers.formatMoney(subtotal);

      // Update Floating Badge (Circle / Square / Minimal)
      const badge = document.getElementById('ptk-cart-badge');
      if (badge) {
        badge.innerText = totalItems;
        if (config.cartStyle !== 'minimal') {
          if (totalItems > 0) badge.classList.remove('scale-0');
          else badge.classList.add('scale-0');
        }
      }

      // Update Pill Mode Badge & Subtotal
      const pillBadge = document.getElementById('ptk-cart-badge-pill');
      const pillTotal = document.getElementById('ptk-cart-pill-total');
      if (pillBadge) pillBadge.innerText = totalItems;
      if (pillTotal) pillTotal.innerText = formattedSubtotal;

      // Update Drawer Header Count & Clear Button
      const drawerCount = document.getElementById('ptk-drawer-count');
      if (drawerCount) drawerCount.innerText = totalItems;

      const clearBtn = document.getElementById('ptk-cart-clear-btn');
      if (clearBtn) {
        if (storeState.cart.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }

      // Update Free Shipping Progress Bar
      const shipWrap = document.getElementById('ptk-shipping-bar-wrap');
      if (shipWrap) {
        if (config.freeShippingThreshold > 0 && storeState.cart.length > 0) {
          shipWrap.classList.remove('hidden');
          const pct = Math.min(100, Math.round((subtotal / config.freeShippingThreshold) * 100));
          const remaining = Math.max(0, config.freeShippingThreshold - subtotal);
          const shipText = document.getElementById('ptk-shipping-text');
          const shipBar = document.getElementById('ptk-shipping-progress');

          if (shipBar) shipBar.style.width = `${pct}%`;
          if (shipText) {
            shipText.innerHTML = remaining === 0
              ? `<span class="text-emerald-600">Selamat! Pesanan Anda mendapat Gratis Ongkir!</span>`
              : `Tambah <span class="text-slate-900 font-black">${Helpers.formatMoney(remaining)}</span> lagi untuk Gratis Ongkir!`;
          }
        } else {
          shipWrap.classList.add('hidden');
        }
      }

      // Update semua elemen HTML di Header/Halaman yang memiliki atribut ptk-bind
      document.querySelectorAll('[ptk-bind="cart_count"]').forEach(el => { el.innerText = totalItems; });
      document.querySelectorAll('[ptk-bind="cart_subtotal"], [ptk-bind="cart_total"]').forEach(el => { el.innerText = formattedSubtotal; });

      // Update Daftar Item di Drawer
      const itemsContainer = document.getElementById('ptk-cart-items');
      const subtotalEl = document.getElementById('ptk-cart-subtotal');
      if (!itemsContainer) return;

      if (storeState.cart.length === 0) {
        itemsContainer.innerHTML = `
          <div class="text-center text-slate-400 py-14">
            <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              ${Helpers.getCartSvg(config.cartIcon, 'w-10 h-10')}
            </div>
            <p class="font-bold text-slate-600 mb-1">Keranjang belanja kosong</p>
            <p class="text-xs text-slate-400">Belum ada produk yang Anda tambahkan.</p>
          </div>
        `;
      } else {
        itemsContainer.innerHTML = storeState.cart.map((item, idx) => `
          <div class="flex items-center gap-3.5 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0 cursor-zoom-in" onclick="window.Pastoko.UI.zoomImage('${item.img}')" />
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-bold text-slate-800 truncate mb-0.5">${item.name}</h4>
              ${item.variant ? `<div class="text-[11px] font-semibold text-slate-400 mb-1">${item.variant}</div>` : ''}
              <div class="text-xs font-black" style="color:${config.themeColor}">${Helpers.formatMoney(item.price)}</div>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
              <button type="button" onclick="window.Pastoko.Commerce.removeItem(${idx})" class="text-slate-300 hover:text-rose-500 transition-colors p-0.5" title="Hapus">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              <div class="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                <button type="button" onclick="window.Pastoko.Commerce.updateQty(${idx}, -1)" class="w-7 h-7 flex items-center justify-center text-slate-600 font-bold hover:text-slate-900 transition-colors">-</button>
                <span class="text-xs font-bold w-6 text-center text-slate-900">${item.qty}</span>
                <button type="button" onclick="window.Pastoko.Commerce.updateQty(${idx}, 1)" class="w-7 h-7 flex items-center justify-center text-slate-600 font-bold hover:text-slate-900 transition-colors">+</button>
              </div>
            </div>
          </div>
        `).join('');
      }

      if (subtotalEl) {
        subtotalEl.innerText = formattedSubtotal;
      }
    },

    // --- I. DOM SCANNER UNTUK TOMBOL AKSI [ptk-action] ---
    initScanner: function() {
      if (storeState.scannerInitialized) return;
      storeState.scannerInitialized = true;

      document.addEventListener('click', (e) => {
        // Lightbox gambar otomatis untuk elemen dengan atribut [ptk-zoom]
        const zoomEl = e.target.closest('[ptk-zoom]');
        if (zoomEl) {
          const src = zoomEl.getAttribute('ptk-zoom') || zoomEl.getAttribute('src');
          const caption = zoomEl.getAttribute('alt') || '';
          if (src) UI.zoomImage(src, caption);
          return;
        }

        const btn = e.target.closest('[ptk-action]');
        if (!btn) return;

        const action = btn.getAttribute('ptk-action');
        const id = btn.getAttribute('ptk-id');
        const qtyTarget = btn.getAttribute('ptk-qty-target');
        const variantAttr = btn.getAttribute('ptk-variant');

        // Mendukung atribut data langsung pada tombol (tanpa harus menunggu fetch API katalog)
        const inlineTitle = btn.getAttribute('ptk-title') || btn.getAttribute('ptk-name');
        const inlinePrice = btn.getAttribute('ptk-price');
        const inlineImg = btn.getAttribute('ptk-img') || btn.getAttribute('ptk-image');

        let qty = parseInt(btn.getAttribute('ptk-qty')) || 1;
        if (qtyTarget) {
          const input = document.querySelector(qtyTarget);
          if (input) qty = parseInt(input.value) || 1;
        }

        const payload = inlineTitle ? {
          id: id || Helpers.safeId(inlineTitle),
          title: inlineTitle,
          price: parseFloat(inlinePrice) || 0,
          img: inlineImg || '',
          variant: variantAttr || ''
        } : id;

        if (action === 'add_to_cart') {
          e.preventDefault();
          this.addToCart(payload, qty, variantAttr);
        } else if (action === 'buy_now') {
          e.preventDefault();
          this.buyNow(payload, qty, variantAttr);
        } else if (action === 'open_cart') {
          e.preventDefault();
          this.openCart();
        } else if (action === 'close_cart') {
          e.preventDefault();
          this.closeCart();
        } else if (action === 'clear_cart') {
          e.preventDefault();
          this.clearCart();
        } else if (action === 'quick_view') {
          e.preventDefault();
          this.quickView(id);
        } else if (action === 'toggle_wishlist') {
          e.preventDefault();
          this.toggleWishlist(id);
        }
      });
    },

    // --- J. SINKRONISASI DATA TOKO MANDIRI ---
    loadStoreData: async function() {
      if (!config.autoFetchStoreData) return;
      try {
        const [prodRes, setRes] = await Promise.all([
          Net.get(config.productsEndpoint),
          Net.get(config.settingsEndpoint)
        ]);

        if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
          storeState.productsCatalog = prodRes.data;
        }

        if (setRes && setRes.success && Array.isArray(setRes.data)) {
          const globalSet = setRes.data.find(s => s.id === 'global');
          if (globalSet && globalSet.config_json) {
            const parsedConfig = JSON.parse(globalSet.config_json);
            if (parsedConfig.currency_symbol) config.currencySymbol = parsedConfig.currency_symbol;
            if (parsedConfig.theme_color) config.themeColor = parsedConfig.theme_color;
          }
        }

        this.refreshCartUI();
      } catch (err) {
        // Silent fail jika halaman berjalan secara statis / SSR murni tanpa endpoint
      }
    },

    init: function(userConfig = {}) {
      Object.assign(config, userConfig);
      UI.injectStyles();
      this.renderFloatingCart();
      this.renderCartContainer();
      this.initScanner();
      this.refreshCartUI();
      this.refreshWishlistUI();
      this.loadStoreData();
    }
  };

  // =========================================================================
  // 10. PUBLIC API EXPORTS (window.Pastoko)
  // =========================================================================
  return {
    config,
    init: (userConfig = {}) => Commerce.init(userConfig),

    // Core Modules
    Net,
    UI,
    Events,
    Draggable,
    CSS,
    State,
    Editor,
    Commerce,
    Helpers,

    // Top-Level Shortcuts untuk kemudahan pemanggilan di Hono JSX / Inline Event
    openCart: () => Commerce.openCart(),
    closeCart: () => Commerce.closeCart(),
    addToCart: (productOrId, qty, variant) => Commerce.addToCart(productOrId, qty, variant),
    buyNow: (productOrId, qty, variant) => Commerce.buyNow(productOrId, qty, variant),
    updateQty: (idx, change) => Commerce.updateQty(idx, change),
    removeItem: (idx) => Commerce.removeItem(idx),
    clearCart: () => Commerce.clearCart(),
    getCart: () => Commerce.getCart(),
    toggleWishlist: (id) => Commerce.toggleWishlist(id),
    quickView: (id) => Commerce.quickView(id),
    formatMoney: (amount) => Helpers.formatMoney(amount),
    toast: (typeOrMsg, msgOrType) => UI.toast(typeOrMsg, msgOrType),
    modal: (idOrTitle, actionOrHtml, widthClass) => UI.modal(idOrTitle, actionOrHtml, widthClass),
    confirm: (title, msg, yesText, noText) => UI.confirm(title, msg, yesText, noText),
    zoomImage: (src, caption) => UI.zoomImage(src, caption)
  };
})();
