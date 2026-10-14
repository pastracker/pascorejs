window.Pastoko = (function() {
  const API_BASE = '/api';

  const getHeaders = () => {
    const token = localStorage.getItem('paspages_jwt');
    return token ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } 
                 : { 'Content-Type': 'application/json' };
  };

  // --- 1. NETWORK REQUESTS ---
  const Net = {
    get: async (path) => {
      try {
        const res = await fetch(API_BASE + path, { headers: getHeaders() });
        return await res.json();
      } catch (e) { return { success: false, message: e.message }; }
    },
    post: async (path, data) => {
      try {
        const res = await fetch(API_BASE + path, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
        return await res.json();
      } catch (e) { return { success: false, message: e.message }; }
    },
    put: async (path, data) => {
      try {
        const res = await fetch(API_BASE + path, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
        return await res.json();
      } catch (e) { return { success: false, message: e.message }; }
    },
    del: async (path) => {
      try {
        const res = await fetch(API_BASE + path, { method: 'DELETE', headers: getHeaders() });
        return await res.json();
      } catch (e) { return { success: false, message: e.message }; }
    }
  };

  // --- 2. UI UTILITIES ---
  const UI = {
    toast: (type, message) => {
      const el = document.createElement('div');
      const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-amber-500';
      el.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl text-sm font-bold text-white z-50 transform transition-all duration-300 translate-y-10 opacity-0 ' + bg;
      el.innerText = message;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.remove('translate-y-10', 'opacity-0'));
      setTimeout(() => {
        el.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => el.remove(), 300);
      }, 3000);
    },
    confirm: (title, message) => {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 opacity-0 transition-opacity';
        modal.innerHTML = '<div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transform scale-95 transition-transform"><h3 class="text-lg font-black text-slate-900 mb-2">' + title + '</h3><p class="text-sm text-slate-500 mb-6">' + message + '</p><div class="flex justify-end gap-3"><button id="ptk-btn-no" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Batal</button><button id="ptk-btn-yes" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700">Ya, Lanjutkan</button></div></div>';
        document.body.appendChild(modal);
        requestAnimationFrame(() => { modal.classList.add('opacity-100'); modal.children[0].classList.add('scale-100'); });
        modal.querySelector('#ptk-btn-no').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#ptk-btn-yes').onclick = () => { modal.remove(); resolve(true); };
      });
    },
    zoomImage: (src) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[999] bg-slate-900/95 flex items-center justify-center p-4 cursor-zoom-out opacity-0 transition-opacity duration-300 backdrop-blur-sm';
      modal.innerHTML = '<img src="' + src + '" class="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl scale-90 transition-transform duration-300" />';
      modal.onclick = () => {
        modal.classList.remove('opacity-100');
        modal.querySelector('img').classList.remove('scale-100');
        setTimeout(() => modal.remove(), 300);
      };
      document.body.appendChild(modal);
      requestAnimationFrame(() => { modal.classList.add('opacity-100'); modal.querySelector('img').classList.add('scale-100'); });
    }
  };

  // --- 3. COMMERCE ---
  const Commerce = {
    init: (config) => { console.log('Pastoko Engine Ready', config); },
    getCart: () => JSON.parse(localStorage.getItem('ptk_cart') || '[]'),
    addToCart: (product, qty = 1, variant = null) => {
      const cart = Commerce.getCart();
      const existing = cart.find(i => i.id === product.id && i.variant === variant);
      if (existing) existing.qty += parseInt(qty);
      else cart.push({ ...product, qty: parseInt(qty), variant });
      localStorage.setItem('ptk_cart', JSON.stringify(cart));
      UI.toast('success', 'Produk ditambahkan ke keranjang!');
      window.dispatchEvent(new Event('ptk-cart-updated'));
    },
    clearCart: () => {
      localStorage.removeItem('ptk_cart');
      window.dispatchEvent(new Event('ptk-cart-updated'));
    }
  };

  // --- 4. STATE MANAGEMENT (DIPERBAIKI: Mendukung Methods Binding) ---
  const State = {
    create: (selector, stateObj = {}, methodsObj = {}) => {
      const el = document.querySelector(selector);
      if (!el) return stateObj;

      // Gabungkan state dan methods ke dalam satu objek target
      const combinedTarget = { ...stateObj };
      
      // Bind methods agar 'this' atau parameter state mengarah dengan benar
      for (const methodName in methodsObj) {
        if (typeof methodsObj[methodName] === 'function') {
          combinedTarget[methodName] = (...args) => methodsObj[methodName](stateProxy, ...args);
        }
      }

      const stateProxy = new Proxy(combinedTarget, {
        set: function(target, prop, value) {
          target[prop] = value;
          // Render sederhana untuk visibilitas DOM (opsional)
          return true;
        }
      });

      // Bind input [pas-model]
      el.querySelectorAll('[pas-model]').forEach(input => {
        const key = input.getAttribute('pas-model');
        const keys = key.split('.');
        
        // Sinkronisasi nilai awal jika ada
        if (keys.length === 1 && stateProxy[keys[0]] !== undefined) {
          input.value = stateProxy[keys[0]];
        }

        input.addEventListener('input', (e) => {
          if (keys.length === 1) stateProxy[keys[0]] = e.target.value;
          else if (keys.length === 2 && stateProxy[keys[0]]) stateProxy[keys[0]][keys[1]] = e.target.value;
        });
      });

      // Bind event click / submit kustom
      el.querySelectorAll('[pas-on\\:submit\\.prevent]').forEach(form => {
        const actionName = form.getAttribute('pas-on:submit.prevent');
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const cleanAction = actionName.replace('()', '');
          if (typeof stateProxy[cleanAction] === 'function') {
            stateProxy[cleanAction]();
          }
        });
      });

      el._pasState = stateProxy;
      return stateProxy;
    }
  };

  // --- 5. EDITOR POLYFILL ---
  const Editor = {
    init: (id, initial, onChange) => {
      const el = document.getElementById(id);
      if (el) {
        el.contentEditable = true;
        el.className += " p-4 outline-none";
        el.innerHTML = initial;
        el.addEventListener('input', () => onChange(el.innerHTML));
      }
    }
  };

  return { Net, UI, Commerce, State, Editor };
})();

// Global Aliases agar kompatibel dengan sisa kode
window.PasCore = window.Pastoko;
window.PasCommerce = window.Pastoko.Commerce;
