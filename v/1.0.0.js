/**
 * PASCORE ENGINE (pascore.js)
 * Internal WebOS Framework for PasPages.
 * Lightweight, zero-dependency Vanilla JS engine.
 * Version: 1.0.0 (Enterprise Pack: Global Delegation, EventBus, DragDrop & Scoped CSS)
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
            
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });

            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        },

        modal: function(modalId, action = 'show') {
            const el = document.getElementById(modalId);
            if (!el) return;

            if (action === 'show') {
                el.style.display = 'flex';
                requestAnimationFrame(() => {
                    el.classList.remove('opacity-0');
                    const child = el.firstElementChild;
                    if(child) child.classList.remove('scale-95', 'opacity-0');
                });
                document.body.style.overflow = 'hidden';
                el.setAttribute('data-pas-modal', 'true');
            } else {
                el.classList.add('opacity-0');
                const child = el.firstElementChild;
                if(child) child.classList.add('scale-95', 'opacity-0');
                
                setTimeout(() => {
                    el.style.display = 'none';
                    document.body.style.overflow = '';
                    el.removeAttribute('data-pas-modal');
                }, 200); 
            }
        },

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('[data-pas-modal="true"]').forEach(el => {
                if (el.style.display !== 'none') UI.modal(el.id, 'hide');
            });
        }
    });

    // =========================================================================
    // 3. PASCORE.EVENTS (Pub/Sub Event Bus for Widget Communication)
    // =========================================================================
    const Events = {
        _bus: document.createElement('div'),
        on: function(event, callback) {
            this._bus.addEventListener(event, (e) => callback(e.detail));
        },
        emit: function(event, detail = {}) {
            this._bus.dispatchEvent(new CustomEvent(event, { detail }));
        }
    };

    // =========================================================================
    // 4. PASCORE.DRAGGABLE (HTML5 Drag & Drop Engine)
    // =========================================================================
    const Draggable = {
        init: function(containerSelector, onOrderUpdateCallback) {
            const container = document.querySelector(containerSelector);
            if (!container) return;

            let draggedEl = null;

            // Make children draggable
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
                    // Returns array of data-id attributes reflecting the new order
                    const newOrder = Array.from(container.children)
                                          .map(el => el.getAttribute('data-id'))
                                          .filter(Boolean);
                    onOrderUpdateCallback(newOrder);
                }
            });
        }
    };

    // =========================================================================
    // 5. PASCORE.CSS (Scoped CSS Injector for Widgets)
    // =========================================================================
    const CSS = {
        injectScoped: function(cssString, scopeClass) {
            if (document.getElementById('pascore-style-' + scopeClass)) return;
            const style = document.createElement('style');
            style.id = 'pascore-style-' + scopeClass;
            
            // Regex to prefix CSS selectors without touching @keyframes or @media
            const scopedCss = cssString.replace(/(^|\}\s*)([^{]+)\{/g, (match, prefix, selectors) => {
                if (selectors.trim().startsWith('@')) return match;
                const scopedSelectors = selectors.split(',')
                                       .map(s => `.${scopeClass} ${s.trim()}`)
                                       .join(', ');
                return prefix + scopedSelectors + ' {';
            });
            
            style.innerHTML = scopedCss;
            document.head.appendChild(style);
        }
    };

    // =========================================================================
    // 6. PASCORE.STATE (Advanced Reactive Engine with Global Delegation)
    // =========================================================================
    const State = {
        create: function(rootSelector, initialData = {}, methods = {}) {
            const rootEl = document.querySelector(rootSelector);
            if (!rootEl) {
                console.warn(`[PasCore.State] Root element ${rootSelector} not found.`);
                return null;
            }

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
                // Text Content
                rootEl.querySelectorAll('[pas-text]').forEach(el => {
                    const val = evaluate(el.getAttribute('pas-text'), state);
                    if (val !== undefined && el.textContent !== String(val)) el.textContent = val;
                });

                // Visibility
                rootEl.querySelectorAll('[pas-show]').forEach(el => {
                    const condition = evaluate(el.getAttribute('pas-show'), state);
                    el.style.display = condition ? '' : 'none';
                });

                // Values Bindings
                rootEl.querySelectorAll('[pas-model]').forEach(el => {
                    const key = el.getAttribute('pas-model');
                    const val = evaluate(key, state);
                    if (val !== undefined) {
                        if (el.type === 'checkbox') el.checked = !!val;
                        else if (el.type === 'radio') el.checked = (el.value === String(val));
                        else if (el.value !== String(val)) el.value = val;
                    }
                });

                // Dynamic Attributes
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

                // CSS Classes
                rootEl.querySelectorAll('[pas-class]').forEach(el => {
                    const classObj = evaluate(el.getAttribute('pas-class'), state) || {};
                    for (let cls in classObj) {
                        const classes = cls.split(' ').filter(Boolean);
                        if (classObj[cls]) el.classList.add(...classes);
                        else el.classList.remove(...classes);
                    }
                });

                // Template Array Rendering (pas-for)
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

                    container.innerHTML = ''; 
                    
                    arrayData.forEach((item) => {
                        const clone = tpl.content.cloneNode(true);
                        
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

            // Expose methods to proxy
            for (let funcName in methods) {
                if (typeof methods[funcName] === 'function') {
                    stateProxy[funcName] = function(eventOrArgs) {
                        return methods[funcName].call(methods, stateProxy, eventOrArgs);
                    };
                }
            }

            // --- EVENT DELEGATION ENGINE ---
            // This replaces static loops so dynamically rendered elements are automatically clickable

            // 1. Two-Way Data Binding Inputs
            rootEl.addEventListener('input', (e) => {
                const el = e.target.closest('[pas-model]');
                if (el) {
                    const key = el.getAttribute('pas-model');
                    if (el.type === 'checkbox') stateProxy[key] = el.checked;
                    else stateProxy[key] = el.value;
                }
            });

            rootEl.addEventListener('change', (e) => {
                const el = e.target.closest('[pas-model]');
                if (el && (el.type === 'radio' || el.tagName === 'SELECT')) {
                    const key = el.getAttribute('pas-model');
                    stateProxy[key] = el.value;
                }
            });

            // 2. Global Event Handler for pas-click & pas-on:*
            const handleEvent = (e) => {
                // Handling standard pas-click
                if (e.type === 'click') {
                    const clickEl = e.target.closest('[pas-click]');
                    if (clickEl) {
                        const funcDef = clickEl.getAttribute('pas-click');
                        const funcName = funcDef.split('(')[0].trim();
                        if (typeof methods[funcName] === 'function') {
                            if (clickEl.tagName === 'A' || clickEl.tagName === 'BUTTON') e.preventDefault();
                            methods[funcName].call(methods, stateProxy, e);
                        }
                    }
                }

                // Handling advanced pas-on:[event] modifiers
                // Scans the path of the event to see if any element has pas-on:event
                const path = e.composedPath ? e.composedPath() : [];
                for (let el of path) {
                    if (!el.attributes) continue;
                    Array.from(el.attributes).forEach(attr => {
                        if (attr.name.startsWith(`pas-on:${e.type}`)) {
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

            // Register standard delegated events
            ['click', 'submit', 'keyup', 'keydown'].forEach(eventType => {
                rootEl.addEventListener(eventType, handleEvent);
            });

            // Initial DOM rendering
            updateDOM(stateProxy);
            return stateProxy;
        }
    };

    // =========================================================================
    // 7. PASCORE.EDITOR (Quill Real-Time WYSIWYG Integration)
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
    };

    // Expose all modules to the global scope
    return { Net, UI, Events, Draggable, CSS, State, Editor };

})();
