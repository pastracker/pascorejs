/**
 * PASCOMMERCE SDK (pascommerce.js)
 * Official E-Commerce Frontend Engine for PasPages.
 * Lightweight, zero-dependency Vanilla JS engine for Cart & UI Components.
 * Version: 1.0.0 (Smart Catalog Fetcher, Variant Detection, Image Parser, Real Currency, Fallback Routing)
 */

window.PasCommerce = (function() {
  // --- 1. CONFIGURATION & STATE ---
  const config = {
    themeColor: '#5b42f3', 
    cartPosition: 'bottom-right', // Options: bottom-right, bottom-left, top-right, top-left
    currencySymbol: '$' 
  };

  const state = {
    cart: [],
    isCartOpen: false,
    productsCatalog: [] // Cache for database products
  };

  // --- 2. UI ENGINE ---
  const UI = {
    injectStyles: () => {
      if(document.getElementById('pc-styles')) return;
      const style = document.createElement('style');
      style.id = 'pc-styles';
      style.innerHTML = `
        .pc-toast-enter { transform: translateY(100%) scale(0.9); opacity: 0; }
        .pc-toast-active { transform: translateY(0) scale(1); opacity: 1; }
        .pc-cart-wiggle { animation: pc-wiggle 0.4s ease-in-out; }
        @keyframes pc-wiggle { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-10deg) scale(1.1); } 75% { transform: rotate(10deg) scale(1.1); } }
        .pc-modal-backdrop-enter { opacity: 0; }
        .pc-modal-backdrop-active { opacity: 1; }
        .pc-modal-panel-enter { transform: scale(0.95); opacity: 0; }
        .pc-modal-panel-active { transform: scale(1); opacity: 1; }
      `;
      document.head.appendChild(style);
    },

    toast: (msg, type = 'success') => {
      let container = document.getElementById('pc-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'pc-toast-container';
        container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      const isSuccess = type === 'success';
      const bgColor = isSuccess ? 'bg-slate-900' : 'bg-rose-600';
      const iconColor = isSuccess ? 'text-emerald-400' : 'text-white';
      
      const icon = isSuccess 
        ? `<svg class="w-5 h-5 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`
        : `<svg class="w-5 h-5 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;

      toast.className = `flex items-center gap-3 px-6 py-3.5 rounded-full text-white text-sm font-bold shadow-2xl transition-all duration-300 pc-toast-enter ${bgColor}`;
      toast.innerHTML = `${icon} <span>${msg}</span>`;
      
      container.appendChild(toast);
      
      // Trigger animation
      requestAnimationFrame(() => {
        toast.classList.remove('pc-toast-enter');
        toast.classList.add('pc-toast-active');
      });

      // Auto-remove toast after 3 seconds
      setTimeout(() => {
        toast.classList.remove('pc-toast-active');
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    renderFloatingCart: () => {
      if(document.getElementById('pc-floating-cart')) return;
      
      let posClasses = '';
      switch(config.cartPosition) {
        case 'bottom-left': posClasses = 'bottom-8 left-8'; break;
        case 'top-right': posClasses = 'top-8 right-8'; break;
        case 'top-left': posClasses = 'top-8 left-8'; break;
        default: posClasses = 'bottom-8 right-8';
      }

      const widget = document.createElement('button');
      widget.id = 'pc-floating-cart';
      widget.className = `fixed ${posClasses} w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white z-[9990] hover:scale-105 transition-transform focus:outline-none`;
      widget.style.backgroundColor = config.themeColor;
      widget.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
        <span id="pc-cart-badge" class="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white transform scale-0 transition-transform">0</span>
      `;
      widget.onclick = () => window.PasCommerce.openCart();
      document.body.appendChild(widget);
    },

    renderCartDrawer: () => {
      if(document.getElementById('pc-cart-drawer')) return;

      const drawer = document.createElement('div');
      drawer.id = 'pc-cart-drawer';
      drawer.className = 'fixed inset-0 z-[9999] pointer-events-none font-sans';
      drawer.innerHTML = `
        <div id="pc-cart-backdrop" onclick="PasCommerce.closeCart()" class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 transition-opacity duration-300 cursor-pointer"></div>
        <div id="pc-cart-panel" class="absolute top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl transform translate-x-full transition-transform duration-300 flex flex-col pointer-events-auto">
          <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
              <svg class="w-5 h-5" style="color:${config.themeColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              Shopping Cart
            </h2>
            <button onclick="window.PasCommerce.closeCart()" class="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full shadow-sm hover:shadow transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div id="pc-cart-items" class="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30"></div>
          <div class="p-6 border-t border-slate-100 bg-white">
            <div class="flex justify-between items-end mb-4">
              <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">Subtotal</span>
              <span id="pc-cart-subtotal" class="text-2xl font-black text-slate-900">${config.currencySymbol} 0</span>
            </div>
            <a href="/checkout" class="block w-full py-4 text-center text-white font-black rounded-xl shadow-lg transition-transform hover:-translate-y-1" style="background-color: ${config.themeColor}">
              Proceed to Checkout
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(drawer);
    },

    modal: (title, htmlContent, widthClass = 'max-w-lg') => {
      let modalWrapper = document.getElementById('pc-modal-wrapper');
      if(modalWrapper) modalWrapper.remove(); 

      modalWrapper = document.createElement('div');
      modalWrapper.id = 'pc-modal-wrapper';
      modalWrapper.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 font-sans';
      modalWrapper.innerHTML = `
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pc-modal-backdrop-enter transition-opacity duration-300" onclick="document.getElementById('pc-modal-wrapper').remove()"></div>
        <div class="bg-white rounded-3xl shadow-2xl w-full ${widthClass} relative flex flex-col pc-modal-panel-enter transition-all duration-300">
          <div class="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 class="text-xl font-black text-slate-900">${title}</h3>
            <button onclick="document.getElementById('pc-modal-wrapper').remove()" class="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[70vh]">
            ${htmlContent}
          </div>
        </div>
      `;
      document.body.appendChild(modalWrapper);
      
      requestAnimationFrame(() => {
        modalWrapper.children[0].classList.add('pc-modal-backdrop-active');
        modalWrapper.children[1].classList.add('pc-modal-panel-active');
      });
    },

    updateBadgeAndHTML: (count) => {
      const badge = document.getElementById('pc-cart-badge');
      if(badge) {
        badge.innerText = count;
        if(count > 0) badge.classList.remove('scale-0');
        else badge.classList.add('scale-0');
      }
      // Update any element bound to cart count
      document.querySelectorAll('[pc-bind="cart_count"]').forEach(el => el.innerText = count);
    },

    animateCartWiggle: () => {
      const btn = document.getElementById('pc-floating-cart');
      if(!btn) return;
      btn.classList.remove('pc-cart-wiggle');
      void btn.offsetWidth; // Trigger reflow to restart animation
      btn.classList.add('pc-cart-wiggle');
    }
  };

  // --- 3. CORE COMMERCE LOGIC ---
  const Actions = {
    addToCart: (productId, qty) => {
      // Find the actual product from the cached database
      const product = state.productsCatalog.find(p => p.id === productId);
      
      if (!product) {
        UI.toast('Still loading product data. Please try again in a moment.', 'error');
        return;
      }

      // 1. Determine Base Price (Prioritize sale_price if available)
      const baseP = parseFloat(product.price) || 0;
      const saleP = parseFloat(product.sale_price) || 0;
      let activePrice = (saleP > 0) ? saleP : baseP;
      
      // 2. Detect Selected Variant from the Product Page (If Any)
      let variantName = '';
      const variantSelect = document.getElementById('product-variants');
      if (variantSelect && variantSelect.value !== "") {
        try {
          const variantsJson = JSON.parse(product.variants_json.replace(/&quot;/g, '"') || '[]');
          const selectedVariant = variantsJson[variantSelect.value];
          if (selectedVariant) {
             variantName = selectedVariant.name;
             // If variant has a specific price, override the active price
             if (selectedVariant.price > 0) activePrice = selectedVariant.price;
          }
        } catch(e) { console.warn("Variant parsing failed", e); }
      }

      // 3. Extract Thumbnail from JSON Array
      let imgUrl = 'https://placehold.co/200x200/f8fafc/94a3b8?text=No+Image';
      try {
        const imgsJson = JSON.parse(product.images_json.replace(/&quot;/g, '"') || '[]');
        if (imgsJson && imgsJson.length > 0) imgUrl = imgsJson[0];
      } catch(e) {}

      // 4. Push to Cart State (Use a unique ID to prevent merging different variants)
      // Base64 encode the variant name to ensure a safe, unique cart item string
      const cartItemId = variantName ? `${productId}-${btoa(variantName)}` : productId;
      
      const existing = state.cart.find(i => i.cartItemId === cartItemId);
      if(existing) {
        existing.qty += qty;
      } else {
        state.cart.push({ 
          cartItemId: cartItemId,
          id: productId, 
          qty: qty, 
          price: activePrice,
          name: product.title,
          variant: variantName,
          img: imgUrl
        });
      }

      UI.toast(`Added to cart!`, 'success');
      UI.animateCartWiggle();
      Actions.refreshCartUI();
    },
    
    refreshCartUI: () => {
      const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
      const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      
      UI.updateBadgeAndHTML(totalItems);
      
      const itemsContainer = document.getElementById('pc-cart-items');
      const subtotalEl = document.getElementById('pc-cart-subtotal');
      if(!itemsContainer) return;
      
      if(state.cart.length === 0) {
        itemsContainer.innerHTML = `
          <div class="text-center text-slate-400 py-12">
            <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            </div>
            <p class="font-bold text-slate-500 mb-1">Your cart is empty.</p>
            <p class="text-xs">Looks like you haven't added anything yet.</p>
          </div>`;
      } else {
        itemsContainer.innerHTML = state.cart.map((item, idx) => `
          <div class="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0">
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-bold text-slate-800 truncate mb-1">${item.name}</h4>
              ${item.variant ? `<div class="text-[10px] font-bold text-slate-400 mb-1">${item.variant}</div>` : ''}
              <div class="text-xs font-black" style="color:${config.themeColor}">${config.currencySymbol} ${item.price.toLocaleString('en-US', {minimumFractionDigits:2})}</div>
            </div>
            <div class="flex items-center bg-slate-50 rounded-lg border border-slate-200 shrink-0">
              <button onclick="PasCommerce.updateQty(${idx}, -1)" class="w-8 h-8 flex items-center justify-center text-slate-500 font-bold hover:text-slate-900 transition-colors">-</button>
              <span class="text-xs font-bold w-6 text-center text-slate-900">${item.qty}</span>
              <button onclick="PasCommerce.updateQty(${idx}, 1)" class="w-8 h-8 flex items-center justify-center text-slate-500 font-bold hover:text-slate-900 transition-colors">+</button>
            </div>
          </div>
        `).join('');
      }
      
      if(subtotalEl) {
        // Safe string replacement without overriding potential inner HTML structures
        subtotalEl.innerText = `${config.currencySymbol} ${subtotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
      }
    }
  };

  const initScanner = () => {
    // Event delegation for action buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[pc-action]');
      if(!btn) return;
      const action = btn.getAttribute('pc-action');
      
      if(action === 'add_to_cart') {
        const id = btn.getAttribute('pc-id');
        const qtyTarget = btn.getAttribute('pc-qty-target');
        let qty = 1;
        
        // Handle custom quantity input mapping (mostly used in single product page)
        if(qtyTarget) {
          const input = document.querySelector(qtyTarget);
          if(input) qty = parseInt(input.value) || 1;
        }
        
        // Execute Core Add to Cart Logic
        Actions.addToCart(id, qty);
      } 
      else if(action === 'open_cart') {
        window.PasCommerce.openCart();
      }
    });
  };

  // --- 4. DATA SYNC BOOTSTRAPPER ---
  
  // Smart Helper for API Auto-Fallback (Handles Dev vs Production namespaces)
  const fetchApiWithFallback = async (endpoint) => {
    try {
      let res = await fetch(`/api/dev-pc_core${endpoint}`);
      // If development namespace fails (e.g., 404 Not Found), try the production namespace
      if (!res.ok) {
        res = await fetch(`/api/pc_core${endpoint}`);
      }
      return await res.json();
    } catch (err) {
      return {}; // Return empty object gracefully on complete failure
    }
  };

  const loadStoreData = async () => {
    try {
      // Fetch catalog and settings in parallel without blocking the UI
      const [prodRes, setRes] = await Promise.all([
        fetchApiWithFallback('/products/list'),
        fetchApiWithFallback('/settings/get')
      ]);

      // Cache the catalog so Add To Cart can accurately retrieve real prices
      if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
        state.productsCatalog = prodRes.data;
      }

      // Override the default currency configuration from Global Database Settings
      if (setRes && setRes.success && Array.isArray(setRes.data)) {
        const globalSet = setRes.data.find(s => s.id === 'global');
        if (globalSet && globalSet.config_json) {
           const parsedConfig = JSON.parse(globalSet.config_json);
           if (parsedConfig.currency_symbol) config.currencySymbol = parsedConfig.currency_symbol;
        }
      }
      
      // Refresh the Cart UI to apply the fetched Currency Symbol
      Actions.refreshCartUI();
    } catch(err) {
      console.warn('PasCommerce SDK failed to sync store data:', err);
    }
  };

  // --- 5. PUBLIC API EXPORTS ---
  return {
    init: (userConfig = {}) => {
      Object.assign(config, userConfig);
      UI.injectStyles();
      UI.renderFloatingCart();
      UI.renderCartDrawer();
      initScanner();
      loadStoreData(); // Trigger Background Data Sync
    },
    openCart: () => {
      document.getElementById('pc-cart-drawer').classList.remove('pointer-events-none');
      document.getElementById('pc-cart-backdrop').classList.replace('opacity-0', 'opacity-100');
      document.getElementById('pc-cart-panel').classList.replace('translate-x-full', 'translate-x-0');
    },
    closeCart: () => {
      document.getElementById('pc-cart-backdrop').classList.replace('opacity-100', 'opacity-0');
      document.getElementById('pc-cart-panel').classList.replace('translate-x-0', 'translate-x-full');
      setTimeout(() => document.getElementById('pc-cart-drawer').classList.add('pointer-events-none'), 300);
    },
    updateQty: (idx, change) => {
      if(state.cart[idx]) {
        state.cart[idx].qty += change;
        if(state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
        Actions.refreshCartUI();
      }
    },
    toast: UI.toast,
    modal: UI.modal,
    getCart: () => state.cart
  };
})();
