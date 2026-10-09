/**
 * PASCORE ENGINE (pascore.js)
 * Internal WebOS Framework for PasPages.
 * Lightweight, zero-dependency Vanilla JS engine replacing Alpine.js & Axios.
 */

window.PasCore = (function() {
    'use strict';

    // =========================================================================
    // 1. PASCORE.NET (Networking & API Module)
    // =========================================================================
    const Net = {
        config: {
            apiPrefix: '/api/dev-pasapp', // Can be dynamically updated based on the active plugin
            tokenKey: 'paspages_jwt'
        },

        _getToken: function() {
            return localStorage.getItem(this.config.tokenKey) || localStorage.getItem('paspages_token');
        },

        request: async function(endpoint, method = 'GET', data = null, wrapPayload = true) {
            const url = endpoint.startsWith('http') ? endpoint : `${this.config.apiPrefix}${endpoint}`;
            const token = this._getToken();
            
            const options = {
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (token) {
                options.headers['Authorization'] = `Bearer ${token}`;
            }

            // Enforce PasCore Backend standard: wrap outgoing data inside { payload: ... }
            if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
                options.body = JSON.stringify(wrapPayload ? { payload: data } : data);
            }

            try {
                const response = await fetch(url, options);
                
                // Intercept unauthorized or expired sessions globally
                if (response.status === 401 || response.status === 403) {
                    console.error('[PasCore.Net] Unauthorized. Session expired.');
                    PasCore.UI.toast('error', 'Session expired. Please log in again.');
                    setTimeout(() => window.location.href = '/admin/login', 1500);
                    return { success: false, message: 'Unauthorized' };
                }

                const result = await response.json();
                
                // Standardize the return payload
                return {
                    success: response.ok && result.success !== false,
                    data: result.data || result,
                    message: result.message || (response.ok ? 'Operation successful' : 'Operation failed'),
                    status: response.status
                };
            } catch (error) {
                console.error(`[PasCore.Net] Fetch Error (${url}):`, error);
                return { success: false, data: null, message: 'Network connection failed.', status: 0 };
            }
        },

        get: function(endpoint) { return this.request(endpoint, 'GET'); },
        post: function(endpoint, data, wrap = true) { return this.request(endpoint, 'POST', data, wrap); },
        put: function(endpoint, data, wrap = true) { return this.request(endpoint, 'PUT', data, wrap); },
        del: function(endpoint, data, wrap = true) { return this.request(endpoint, 'DELETE', data, wrap); }
    };


    // =========================================================================
    // 2. PASCORE.UI (DOM Utilities & Notifications)
    // =========================================================================
    const UI = {
        toast: function(type, message) {
            // Fallback to legacy Alpine toast if it still exists in the DOM transition period
            if (window.Alpine && window.Alpine.store('toast')) {
                window.Alpine.store('toast').show(type, message);
                return;
            }

            let container = document.getElementById('pascore-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pascore-toast-container';
                container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-2';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            const bgClass = type === 'success' ? 'bg-white border-emerald-200 text-slate-800' : 
                            (type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800');
            
            toast.className = `flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border transition-all transform translate-y-10 opacity-0 ${bgClass}`;
            toast.innerHTML = `<span class="font-bold text-sm pr-4">${message}</span>`;
            
            container.appendChild(toast);
            
            // Trigger entry animation
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });

            // Auto remove toast after 4 seconds
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    };


    // =========================================================================
    // 3. PASCORE.STATE (Reactive Engine - WebOS Core)
    // =========================================================================
    const State = {
        /**
         * Initialize a reactive state bounded to a specific DOM context.
         * @param {string} rootSelector - The target container (e.g., '#app-form-container')
         * @param {object} initialData - Default state values
         * @param {object} methods - Action methods (e.g., save(), delete())
         * @returns {Proxy} - Reactive proxy object
         */
        create: function(rootSelector, initialData = {}, methods = {}) {
            const rootEl = document.querySelector(rootSelector);
            if (!rootEl) {
                console.warn(`[PasCore.State] Root element ${rootSelector} not found.`);
                return null;
            }

            // Core engine to parse and update DOM elements when state mutates
            const updateDOM = (state) => {
                // 1. Update text nodes (pas-text)
                rootEl.querySelectorAll('[pas-text]').forEach(el => {
                    const key = el.getAttribute('pas-text');
                    if (state[key] !== undefined) el.textContent = state[key];
                });

                // 2. Update visibility (pas-show) with simple negation support
                rootEl.querySelectorAll('[pas-show]').forEach(el => {
                    const key = el.getAttribute('pas-show');
                    const isNegated = key.startsWith('!');
                    const cleanKey = isNegated ? key.substring(1) : key;
                    const condition = isNegated ? !state[cleanKey] : !!state[cleanKey];
                    el.style.display = condition ? '' : 'none';
                });

                // 3. Synchronize input values (pas-model: State to DOM)
                rootEl.querySelectorAll('[pas-model]').forEach(el => {
                    const key = el.getAttribute('pas-model');
                    if (state[key] !== undefined && el.value !== state[key]) {
                        el.value = state[key];
                    }
                });
            };

            // Setup Proxy to intercept state changes and trigger DOM updates
            const stateProxy = new Proxy({ ...initialData }, {
                set: function(target, property, value) {
                    target[property] = value;
                    updateDOM(target); 
                    return true;
                }
            });

            // Initialize two-way binding listeners (DOM to State)
            rootEl.querySelectorAll('[pas-model]').forEach(el => {
                const key = el.getAttribute('pas-model');
                el.value = stateProxy[key] || ''; 
                
                el.addEventListener('input', (e) => {
                    stateProxy[key] = e.target.value;
                });
            });

            // Attach click action listeners
            rootEl.querySelectorAll('[pas-click]').forEach(el => {
                const actionCall = el.getAttribute('pas-click');
                // Extract clean function name (e.g., "saveApp()" -> "saveApp")
                const funcName = actionCall.replace(/\(\)/g, '').trim(); 
                
                if (typeof methods[funcName] === 'function') {
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        methods[funcName].call(methods, stateProxy, e);
                    });
                } else {
                    console.warn(`[PasCore.State] Method '${funcName}' is not defined.`);
                }
            });

            // Initial DOM render
            updateDOM(stateProxy);

            return stateProxy;
        }
    };


    // =========================================================================
    // 4. PASCORE.EDITOR (WYSIWYG Integration Wrapper)
    // =========================================================================
    const Editor = {
        init: function(elementId, initialContent = '', onChangeCallback = null) {
            const targetEl = document.getElementById(elementId);
            if (!targetEl) return null;

            if (typeof SUNEDITOR === 'undefined') {
                console.error('[PasCore.Editor] SunEditor library is missing.');
                return null;
            }

            const editorInstance = SUNEDITOR.create(targetEl, {
                plugins: SUNEDITOR.plugins,
                height: '300px',
                value: initialContent,
                buttonList: [
                    ['undo', 'redo'],
                    ['formatBlock'],
                    ['bold', 'underline', 'italic', 'strike'],
                    ['fontColor', 'hiliteColor'],
                    ['align', 'list', 'lineHeight'],
                    ['link', 'image', 'video'],
                    ['fullScreen', 'showBlocks', 'codeView']
                ]
            });

            if (onChangeCallback) {
                editorInstance.onChange = onChangeCallback;
            }

            return editorInstance;
        }
    };

    // Expose Internal WebOS Modules
    return {
        Net,
        UI,
        State,
        Editor
    };

})();
