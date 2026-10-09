/**
 * PASCORE ENGINE (pascore.js)
 * Internal WebOS Framework for PasPages.
 * Lightweight, zero-dependency Vanilla JS engine.
 */

window.PasCore = (function() {
    'use strict';

    // =========================================================================
    // 1. PASCORE.NET (Networking & Context-Aware API Module)
    // =========================================================================
    const Net = {
        config: {
            tokenKey: 'paspages_jwt'
        },

        _getToken: function() {
            return localStorage.getItem(this.config.tokenKey) || localStorage.getItem('paspages_token');
        },

        request: async function(endpoint, method = 'GET', data = null, wrapPayload = true) {
            let url = endpoint;

            if (!endpoint.startsWith('http') && !endpoint.startsWith('/api/')) {
                let cleanPath = endpoint;
                if (cleanPath.startsWith('/admin/')) cleanPath = cleanPath.replace('/admin', '');
                if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
                
                const pluginUI = document.querySelector('.plugin-custom-ui');
                if (pluginUI) {
                    const ns = pluginUI.getAttribute('data-active-namespace');
                    url = `/api/${ns}${cleanPath}`;
                } else {
                    url = `/api/admin${cleanPath}`;
                }
            }

            const token = this._getToken();
            const options = {
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (token) options.headers['Authorization'] = `Bearer ${token}`;

            if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
                options.body = JSON.stringify(wrapPayload ? { payload: data } : data);
            }

            try {
                const response = await fetch(url, options);
                
                if (response.status === 401 || response.status === 403) {
                    console.error('[PasCore.Net] Unauthorized. Session expired.');
                    PasCore.UI.toast('error', 'Session expired. Please log in again.');
                    setTimeout(() => window.location.href = '/admin/login', 1500);
                    return { success: false, message: 'Unauthorized' };
                }

                const contentType = response.headers.get("content-type");
                let result = {};
                if (contentType && contentType.includes("application/json")) {
                    result = await response.json();
                } else {
                    const textData = await response.text();
                    result = { success: response.ok, message: textData };
                }
                
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
            
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });

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
        create: function(rootSelector, initialData = {}, methods = {}) {
            const rootEl = document.querySelector(rootSelector);
            if (!rootEl) return null;

            const updateDOM = (state) => {
                rootEl.querySelectorAll('[pas-text]').forEach(el => {
                    const key = el.getAttribute('pas-text');
                    if (state[key] !== undefined) el.textContent = state[key];
                });

                rootEl.querySelectorAll('[pas-show]').forEach(el => {
                    const key = el.getAttribute('pas-show');
                    const isNegated = key.startsWith('!');
                    const cleanKey = isNegated ? key.substring(1) : key;
                    const condition = isNegated ? !state[cleanKey] : !!state[cleanKey];
                    el.style.display = condition ? '' : 'none';
                });

                rootEl.querySelectorAll('[pas-model]').forEach(el => {
                    const key = el.getAttribute('pas-model');
                    if (state[key] !== undefined && el.value !== state[key]) {
                        if (el.type === 'checkbox') el.checked = !!state[key];
                        else el.value = state[key];
                    }
                });
            };

            const stateProxy = new Proxy({ ...initialData }, {
                set: function(target, property, value) {
                    target[property] = value;
                    updateDOM(target); 
                    return true;
                }
            });

            rootEl.querySelectorAll('[pas-model]').forEach(el => {
                const key = el.getAttribute('pas-model');
                if (el.type === 'checkbox') el.checked = !!stateProxy[key];
                else el.value = stateProxy[key] !== undefined ? stateProxy[key] : ''; 
                
                el.addEventListener('input', (e) => {
                    if (e.target.type === 'checkbox') stateProxy[key] = e.target.checked;
                    else stateProxy[key] = e.target.value;
                });
            });

            rootEl.querySelectorAll('[pas-click]').forEach(el => {
                const actionCall = el.getAttribute('pas-click');
                const funcName = actionCall.split('(')[0].trim(); 
                
                if (typeof methods[funcName] === 'function') {
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        methods[funcName].call(methods, stateProxy, e);
                    });
                }
            });

            updateDOM(stateProxy);
            return stateProxy;
        }
    };

    // =========================================================================
    // 4. PASCORE.EDITOR (Quill.js Integration Wrapper)
    // =========================================================================
    const Editor = {
        init: function(elementId, initialContent = '') {
            const targetEl = document.getElementById(elementId);
            if (!targetEl) return null;

            if (typeof window.Quill === 'undefined') {
                console.error('[PasCore.Editor] Quill library is missing. Make sure CDN is loaded.');
                return null;
            }

            const quill = new window.Quill(targetEl, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'align': [] }],
                        ['link', 'image', 'video', 'code-block'],
                        ['clean']
                    ]
                }
            });

            // Set Initial Content
            if (initialContent) {
                quill.clipboard.dangerouslyPasteHTML(initialContent);
            }

            // Return a standardized PasCore Interface so the plugin logic remains clean
            return {
                instance: quill,
                getContents: function() {
                    const html = quill.root.innerHTML;
                    return html === '<p><br></p>' ? '' : html;
                },
                setContents: function(html) {
                    quill.clipboard.dangerouslyPasteHTML(html || '');
                }
            };
        }
    };

    return { Net, UI, State, Editor };

})();
