/**
 * PASCORE ENGINE (pascore.js)
 * Internal WebOS Framework for PasPages.
 * Lightweight, zero-dependency Vanilla JS engine.
 * Version: 1.0.0 (Full UI & Reactive Pack + Advanced Data Binding)
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

        request: async function(endpoint, method = 'GET', data = null) {
            let url = endpoint;

            // Automatically resolve relative paths based on the current plugin context
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

            // Attach flat JSON payload for specific HTTP methods
            if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
                options.body = JSON.stringify(data);
            }

            try {
                const response = await fetch(url, options);
                
                // Handle unauthorized access globally
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
        post: function(endpoint, data) { return this.request(endpoint, 'POST', data); },
        put: function(endpoint, data) { return this.request(endpoint, 'PUT', data); },
        del: function(endpoint, data) { return this.request(endpoint, 'DELETE', data); }
    };

    // =========================================================================
    // 2. PASCORE.UI (DOM & Layout Utilities)
    // =========================================================================
    const UI = {
        // Global Toast Notification System
        toast: function(type, message) {
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
            
            // Trigger entrance animation
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });

            // Auto-remove after 4 seconds
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        },

        // Modal Controller
        modal: function(modalId, action = 'show') {
            const el = document.getElementById(modalId);
            if (!el) return;

            if (action === 'show') {
                el.style.display = 'flex';
                // Trigger entrance animation for modal overlay and content box
                requestAnimationFrame(() => {
                    el.classList.remove('opacity-0');
                    const child = el.firstElementChild;
                    if(child) child.classList.remove('scale-95', 'opacity-0');
                });
                document.body.style.overflow = 'hidden'; // Lock body scroll
                el.setAttribute('data-pas-modal', 'true');
            } else {
                el.classList.add('opacity-0');
                const child = el.firstElementChild;
                if(child) child.classList.add('scale-95', 'opacity-0');
                
                // Match timeout with CSS transition duration
                setTimeout(() => {
                    el.style.display = 'none';
                    document.body.style.overflow = ''; // Unlock body scroll
                    el.removeAttribute('data-pas-modal');
                }, 200); 
            }
        },

        // Global Confirm Dialog (Promise-based)
        confirm: function(title, message, confirmText = 'Yes, Proceed', cancelText = 'Cancel') {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] opacity-0 transition-opacity duration-200';
                
                const box = document.createElement('div');
                box.className = 'bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-[90%] transform scale-95 transition-all duration-200';
                box.innerHTML = `
                    <h3 class="text-xl font-black text-slate-900 mb-2">${title}</h3>
                    <p class="text-sm text-slate-500 mb-8 leading-relaxed">${message}</p>
                    <div class="flex gap-3">
                        <button id="pas-confirm-cancel" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-colors">${cancelText}</button>
                        <button id="pas-confirm-ok" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md">${confirmText}</button>
                    </div>
                `;

                overlay.appendChild(box);
                document.body.appendChild(overlay);

                // Trigger entrance animation
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

                overlay.querySelector('#pas-confirm-cancel').addEventListener('click', () => closeDialog(false));
                overlay.querySelector('#pas-confirm-ok').addEventListener('click', () => closeDialog(true));
            });
        }
    };

    // Global listener to close active modals when pressing the ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('[data-pas-modal="true"]').forEach(el => {
                if (el.style.display !== 'none') UI.modal(el.id, 'hide');
            });
        }
    });

    // =========================================================================
    // 3. PASCORE.STATE (Advanced Reactive Engine)
    // =========================================================================
    const State = {
        create: function(rootSelector, initialData = {}, methods = {}) {
            const rootEl = document.querySelector(rootSelector);
            if (!rootEl) {
                console.warn(`[PasCore.State] Root element ${rootSelector} not found.`);
                return null;
            }

            // Smart evaluator function to translate strings into JavaScript logic
            const evaluate = (expr, state, localVars = {}) => {
                try {
                    const ctx = { ...state, ...localVars };
                    return new Function('ctx', `with(ctx) { return ${expr}; }`)(ctx);
                } catch(e) {
                    console.error(`[PasCore.State] Expression error on "${expr}":`, e);
                    return undefined;
                }
            };

            const updateDOM = (state) => {
                // 1. Text Content Binding
                rootEl.querySelectorAll('[pas-text]').forEach(el => {
                    const val = evaluate(el.getAttribute('pas-text'), state);
                    if (val !== undefined) el.textContent = val;
                });

                // 2. Visibility Binding
                rootEl.querySelectorAll('[pas-show]').forEach(el => {
                    const condition = evaluate(el.getAttribute('pas-show'), state);
                    el.style.display = condition ? '' : 'none';
                });

                // 3. Input Value Binding (Handles select, radio, checkbox seamlessly)
                rootEl.querySelectorAll('[pas-model]').forEach(el => {
                    const key = el.getAttribute('pas-model');
                    const val = evaluate(key, state);

                    if (val !== undefined) {
                        if (el.type === 'checkbox') {
                            el.checked = !!val;
                        } else if (el.type === 'radio') {
                            el.checked = (el.value === String(val));
                        } else if (el.tagName === 'SELECT') {
                            if (el.value !== String(val)) el.value = val;
                        } else {
                            if (el.value !== String(val)) el.value = val;
                        }
                    }
                });

                // 4. Dynamic Attribute Binding
                rootEl.querySelectorAll('*').forEach(el => {
                    Array.from(el.attributes).forEach(attr => {
                        if (attr.name.startsWith('pas-bind:')) {
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

                // 5. Conditional CSS Class Binding
                rootEl.querySelectorAll('[pas-class]').forEach(el => {
                    const classObj = evaluate(el.getAttribute('pas-class'), state) || {};
                    for (let cls in classObj) {
                        const classes = cls.split(' ').filter(Boolean);
                        if (classObj[cls]) el.classList.add(...classes);
                        else el.classList.remove(...classes);
                    }
                });

                // 6. Template Array Rendering (For loops)
                // Usage: <template pas-for="item in arrayData" pas-key="id"> ...HTML... </template>
                rootEl.querySelectorAll('template[pas-for]').forEach(tpl => {
                    const expr = tpl.getAttribute('pas-for'); 
                    const parts = expr.split(' in ');
                    if (parts.length !== 2) return;
                    
                    const itemName = parts[0].trim();
                    const arrayName = parts[1].trim();
                    const arrayData = evaluate(arrayName, state) || [];

                    let container = tpl.nextElementSibling;
                    if (!container || !container.classList.contains('pas-for-container')) {
                        container = document.createElement('div');
                        container.className = 'pas-for-container contents';
                        tpl.parentNode.insertBefore(container, tpl.nextSibling);
                    }

                    container.innerHTML = ''; // Clear for re-render
                    
                    arrayData.forEach((item) => {
                        const clone = tpl.content.cloneNode(true);
                        
                        // Parse simple {{item.prop}} templating within the loop
                        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
                        let textNode;
                        while ((textNode = walker.nextNode())) {
                            if (textNode.nodeValue.includes('{{')) {
                                textNode.nodeValue = textNode.nodeValue.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
                                    if (path.startsWith(itemName + '.')) {
                                        const prop = path.split('.')[1];
                                        return item[prop] !== undefined ? item[prop] : '';
                                    }
                                    return match;
                                });
                            }
                        }
                        
                        // Attribute parsing within loop
                        clone.querySelectorAll('*').forEach(el => {
                            Array.from(el.attributes).forEach(attr => {
                                if (attr.value.includes('{{')) {
                                    attr.value = attr.value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
                                         if (path.startsWith(itemName + '.')) {
                                            const prop = path.split('.')[1];
                                            return item[prop] !== undefined ? item[prop] : '';
                                        }
                                        return match;
                                    });
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

            // Expose methods to stateProxy
            for (let funcName in methods) {
                if (typeof methods[funcName] === 'function') {
                    stateProxy[funcName] = function(eventOrArgs) {
                        return methods[funcName].call(methods, stateProxy, eventOrArgs);
                    };
                }
            }

            // Init Two-Way Data Binding for Inputs via Event Delegation (Safe for dynamic elements)
            rootEl.addEventListener('input', (e) => {
                const el = e.target;
                if (el.hasAttribute('pas-model')) {
                    const key = el.getAttribute('pas-model');
                    if (el.type === 'checkbox') stateProxy[key] = el.checked;
                    else stateProxy[key] = el.value;
                }
            });

            // Handle Radio Button and Select changes specifically
            rootEl.addEventListener('change', (e) => {
                const el = e.target;
                if (el.hasAttribute('pas-model') && (el.type === 'radio' || el.tagName === 'SELECT')) {
                     const key = el.getAttribute('pas-model');
                     stateProxy[key] = el.value;
                }
            });

            // Init Event Listeners
            rootEl.querySelectorAll('*').forEach(el => {
                Array.from(el.attributes).forEach(attr => {
                    let isEvent = false;
                    let eventType = '';
                    let modifiers = [];
                    
                    if (attr.name === 'pas-click') {
                        isEvent = true;
                        eventType = 'click';
                    } else if (attr.name.startsWith('pas-on:')) {
                        isEvent = true;
                        const parts = attr.name.split(':');
                        const eventParts = parts[1].split('.');
                        eventType = eventParts[0];
                        modifiers = eventParts.slice(1);
                    }

                    if (isEvent) {
                        const funcName = attr.value.split('(')[0].trim(); 
                        if (typeof methods[funcName] === 'function') {
                            el.addEventListener(eventType, (e) => {
                                // Apply Modifiers (.prevent, .stop)
                                if (modifiers.includes('prevent') || eventType === 'submit' || el.tagName === 'A') e.preventDefault();
                                if (modifiers.includes('stop')) e.stopPropagation();

                                methods[funcName].call(methods, stateProxy, e);
                            });
                        }
                    }
                });
            });

            // Initial render
            updateDOM(stateProxy);
            return stateProxy;
        }
    };

    // =========================================================================
    // 4. PASCORE.EDITOR (Quill Real-Time WYSIWYG Integration)
    // =========================================================================
    const Editor = {
        init: function(elementId, initialContent = '', onChangeCallback = null) {
            const targetEl = document.getElementById(elementId);
            if (!targetEl) return null;

            if (typeof window.Quill === 'undefined') {
                console.error('[PasCore.Editor] Quill library dependency is missing.');
                return null;
            }

            const quill = new window.Quill(targetEl, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'image', 'video', 'code-block'],
                        ['clean']
                    ]
                }
            });

            // Inject initial HTML content
            if (initialContent) {
                quill.clipboard.dangerouslyPasteHTML(initialContent);
            }

            // Real-time synchronization to State context
            if (typeof onChangeCallback === 'function') {
                quill.on('text-change', () => {
                    onChangeCallback(quill.root.innerHTML);
                });
            }

            return quill;
        }
    };

    // Expose modules to the global scope
    return { Net, UI, State, Editor };

})();
