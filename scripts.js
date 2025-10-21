	document.addEventListener('DOMContentLoaded', () => {
    // Estado centralizado de la aplicación
    const appState = {
        // Referencias DOM (cachear una sola vez)
        dom: {},
        
        // Estado de la aplicación
        laps: [],
        isRecording: false,
        isReadOnly: false,
        isViewingSession: false,
        currentSessionKey: null,
        sessionDirty: false,
        pendingRename: null,
        recordingName: 'Indeterminat',
        
        // Intervalos
        clockInterval: null,
        lastLapUpdateId: null,
        
        // Constantes
        SESSION_PREFIX: 'stopwatch_session_',
        
        // Referencias temporales
        finalizeViewHandler: null,
    };
    
    // Función para inicializar caché DOM
    function initDOMCache() {
        appState.dom = {
            // Elementos principales
            clock: document.getElementById('clock'),
            clockContainer: document.getElementById('clock-container'),
            
            // Summary
            totalWork: document.getElementById('total-work'),
            totalRest: document.getElementById('total-rest'),
            totalTime: document.getElementById('total-time'),
            
            // Laps y controles
            lapsContainer: document.getElementById('laps-container'),
            finalizeBtn: document.getElementById('finalize-btn'),
            
            // Vistas
            registrationView: document.getElementById('registration-view'),
            sessionsView: document.getElementById('sessions-view'),
            sessionsList: document.getElementById('sessions-list'),
            sessionsContainer: document.getElementById('sessions-container'),
            
            // Header
            toggleViewBtn: document.getElementById('toggle-view-btn'),
            wakeToggle: document.getElementById('wake-toggle'),
            wakeIndicator: document.getElementById('wake-indicator'),
            wakeLabel: document.getElementById('wake-label'),
        };
        
        // Aplicar estilo inicial al botón finalizar
        try { 
            if (appState.dom.finalizeBtn) {
                appState.dom.finalizeBtn.style.height = '64px';
            }
        } catch {}
        
        console.debug('[DOM] Cache inicializado');
    }
    
    // Inicializar caché DOM
    initDOMCache();
    
    // Aliases para compatibilidad con código existente
    const clockElement = appState.dom.clock;
    const clockContainer = appState.dom.clockContainer;
    const totalWorkElement = appState.dom.totalWork;
    const totalRestElement = appState.dom.totalRest;
    const totalTimeElement = appState.dom.totalTime;
    const lapsContainer = appState.dom.lapsContainer;
    const finalizeBtn = appState.dom.finalizeBtn;
    const sessionsList = appState.dom.sessionsList;
    const sessionsContainer = appState.dom.sessionsContainer;
    const toggleViewBtn = appState.dom.toggleViewBtn;
    const registrationView = appState.dom.registrationView;
    const sessionsView = appState.dom.sessionsView;
    
    // Aliases para variables de estado (compatibilidad)
    let laps = appState.laps;
    let clockInterval = appState.clockInterval;
    let isReadOnly = appState.isReadOnly;
    let isViewingSession = appState.isViewingSession;
    let currentSessionKey = appState.currentSessionKey;
    let isRecording = appState.isRecording;
    let sessionDirty = appState.sessionDirty;
    let pendingRename = appState.pendingRename;
    let recordingName = appState.recordingName;
    const sessionPrefix = appState.SESSION_PREFIX;
    let finalizeViewHandler = appState.finalizeViewHandler;

    const disketteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="black" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>`;
    const stopwatchIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 7V12H17M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" stroke-width="2" stroke="#f0f0f0" fill="none">
        <path d="M7 4v16l13 -8z" />
    </svg>`;
    const workIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
  <!-- Mancuerna W4: placas con sombrero/base y barra central -->
  <rect x="2" y="7" width="4" height="1" rx=".5"/>
  <rect x="2" y="8" width="4" height="8" rx="1.2"/>
  <rect x="2" y="16" width="4" height="1" rx=".5"/>
  <rect x="6.5" y="9.5" width="1.5" height="5" rx=".75"/>
  <rect x="8.5" y="11" width="7" height="2" rx="1"/>
  <rect x="16" y="9.5" width="1.5" height="5" rx=".75"/>
  <rect x="18" y="7" width="4" height="1" rx=".5"/>
  <rect x="18" y="8" width="4" height="8" rx="1.2"/>
  <rect x="18" y="16" width="4" height="1" rx=".5"/>
</svg>`;

    const restIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- Cup body -->         <path d="M3 10v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5z" />
        <!-- Handle --> <path d="M15 11h2a2 2 0 1 1 0 4h-2" />
        <!-- Base --> <path d="M5 20h10" />
        <!-- Steam --> <path d="M7 4c0 1 1 1 1 2s-1 1-1 2" />  <path d="M11 4c0 1 1 1 1 2s-1 1-1 2" />
    </svg>`;
    const totalIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M12 7v5l3 3" />
    </svg>`;
    const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
    const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
    const shareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const xIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const screenIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

    // --- WakeLockManager Class ---
    class WakeLockManager {
        constructor() {
            this.wakeLock = null;
            this.isSupported = 'wakeLock' in navigator;
            
            // Gestión de visibilitychange para re-adquirir el wake lock
            if (this.isSupported) {
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible' && this.wakeLock !== null) {
                        await this.request();
                    }
                });
            }
        }

        async request() {
            if (!this.isSupported) {
                console.warn('[WakeLock] No soportado en este navegador');
                return false;
            }

            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.debug('[WakeLock] Activado');
                
                this.wakeLock.addEventListener('release', () => {
                    console.debug('[WakeLock] Liberado');
                });
                
                return true;
            } catch (err) {
                console.error('[WakeLock] Error al activar:', err);
                this.wakeLock = null;
                return false;
            }
        }

        async release() {
            if (this.wakeLock !== null) {
                try {
                    await this.wakeLock.release();
                    this.wakeLock = null;
                    console.debug('[WakeLock] Liberado manualmente');
                    return true;
                } catch (err) {
                    console.error('[WakeLock] Error al liberar:', err);
                    return false;
                }
            }
            return true;
        }

        isActive() {
            return this.wakeLock !== null && !this.wakeLock.released;
        }
    }

    // --- Modal util ---
    const showModal = ({ title = '', message = '', okText = 'Aceptar', cancelText = 'Cancelar', type = 'confirm', defaultValue = '' } = {}) => {
        return new Promise((resolve) => {
            try {
                // Create modal overlay
                const overlay = createContainer({
                    className: 'modal-overlay',
                    direction: 'column',
                    justify: 'center',
                    align: 'center',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    padding: '20px'
                });

                Object.assign(overlay.style, {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100vw',
                    height: '100vh',
                    zIndex: '9999',
                    backdropFilter: 'blur(2px)'
                });

                // Create modal content
                const modal = createContainer({
                    className: 'modal',
                    direction: 'column',
                    justify: 'center',
                    align: 'center',
                    backgroundColor: 'var(--card-bg-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    gap: '16px'
                });

                Object.assign(modal.style, {
                    border: '1px solid var(--accent-color)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    textAlign: 'center',
                    maxWidth: '400px',
                    width: '90%',
                    transform: 'scale(0.96)',
                    opacity: '0',
                    transition: 'transform 120ms ease-out, opacity 120ms ease-out'
                });

                modal.setAttribute('role', type === 'alert' ? 'alertdialog' : 'dialog');
                modal.setAttribute('aria-modal', 'true');

                // Add title
                if (title) {
                    const titleEl = createTextSpan({
                        text: title,
                        fontSize: '1.6rem',
                        fontWeight: '700'
                    });
                    modal.appendChild(titleEl);
                }

                // Add message
                if (message) {
                    const messageEl = createTextSpan({
                        text: message,
                        fontSize: '1.1rem'
                    });
                    Object.assign(messageEl.style, {
                        lineHeight: '1.6',
                        marginBottom: '20px'
                    });
                    modal.appendChild(messageEl);
                }

                // Add input for prompt type
                let inputEl = null;
                if (type === 'prompt') {
                    inputEl = createInput({
                        value: defaultValue || '',
                        placeholder: 'Introduir valor'
                    });
                    modal.appendChild(inputEl);
                    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 0);
                }

                // Create buttons container
                const buttonsContainer = createContainer({
                    direction: 'row',
                    justify: 'center',
                    gap: '12px'
                });

                // Determine if this is a delete action
                const isDeleteAction = /eliminar|delete|suprimir/i.test((okText || title || ''));

                // Create OK button
                const okBtn = createButton({
                    text: okText,
                    icon: isDeleteAction ? trashIcon : '',
                    variant: isDeleteAction ? 'danger' : 'primary',
                    size: 'medium',
                    onClick: () => {
                        cleanup();
                        resolve(type === 'prompt' ? inputEl?.value : true);
                    }
                });

                buttonsContainer.appendChild(okBtn);

                // Create Cancel button for non-alert types
                if (type !== 'alert') {
                    const cancelBtn = createButton({
                        text: cancelText,
                        icon: xIcon,
                        variant: 'secondary',
                        size: 'medium',
                        onClick: () => {
                            cleanup();
                            resolve(type === 'prompt' ? null : false);
                        }
                    });
                    buttonsContainer.appendChild(cancelBtn);
                }

                modal.appendChild(buttonsContainer);
                overlay.appendChild(modal);

                // Handle keyboard events
                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        cleanup();
                        resolve(type === 'prompt' ? null : false);
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        okBtn.click();
                    }
                };
                document.addEventListener('keydown', onKey);

                // Cleanup function
                function cleanup() {
                    document.removeEventListener('keydown', onKey);
                    overlay.remove();
                    document.body.style.overflow = originalOverflow;
                }

                const originalOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                document.body.appendChild(overlay);

                // Trigger animation
                requestAnimationFrame(() => {
                    modal.style.transform = 'scale(1)';
                    modal.style.opacity = '1';
                });

            } catch (err) {
                console.error('Modal error:', err);
                // Fallback to browser dialogs
                if (type === 'alert') {
                    alert(message || title || 'Confirmar?');
                    resolve(true);
                } else if (type === 'prompt') {
                    const result = prompt(title || 'Introduir valor', defaultValue || '');
                    resolve(result);
                } else {
                    const result = confirm(message || title || 'Confirmar?');
                    resolve(result);
                }
            }
        });
    };

    const formatDate = (date) => {
        const days = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
        const months = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'];
        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        return `${dayName}, ${date.getDate()} de ${monthName} de ${date.getFullYear()}`;
    };

    

    // --- Utility functions for DOM operations ---

    // Create a styled button with consistent behavior
    const createButton = (options = {}) => {
        const {
            text = '',
            icon = '',
            className = '',
            ariaLabel = '',
            title = '',
            onClick = null,
            variant = 'primary', // 'primary', 'secondary', 'danger'
            size = 'medium' // 'small', 'medium', 'large'
        } = options;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;

        // Set content
        if (icon && text) {
            btn.innerHTML = `${icon} ${text}`;
        } else if (icon) {
            btn.innerHTML = icon;
        } else {
            btn.textContent = text;
        }

        // Set attributes
        if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
        if (title) btn.title = title;

        // Apply variant styles
        const baseStyles = {
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: '700' // Más grueso para modales
        };

        const variantStyles = {
            primary: {
                border: '1px solid var(--accent-color)',
                backgroundColor: 'var(--accent-color)',
                color: '#fff'
            },
            secondary: {
                border: '1px solid var(--secondary-color)',
                backgroundColor: 'transparent',
                color: 'var(--secondary-color)'
            },
            danger: {
                border: '1px solid #e74c3c',
                backgroundColor: 'transparent',
                color: '#e74c3c'
            }
        };

        const sizeStyles = {
            small: { padding: '6px 10px', fontSize: '0.9rem' },
            medium: { padding: '8px 16px', fontSize: '1rem' },
            large: { padding: '12px 24px', fontSize: '1.1rem' }
        };

        Object.assign(btn.style, baseStyles, variantStyles[variant], sizeStyles[size]);

        // Add hover effects
        btn.addEventListener('mouseenter', () => {
            if (variant === 'primary') {
                btn.style.filter = 'brightness(1.1)';
            } else {
                btn.style.filter = 'brightness(1.2)';
            }
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.filter = 'none';
        });

        // Add click handler
        if (onClick) btn.addEventListener('click', onClick);

        return btn;
    };

    // Create a flex container with common layout patterns
    const createContainer = (options = {}) => {
        const {
            className = '',
            direction = 'row', // 'row', 'column'
            justify = 'flex-start', // 'flex-start', 'center', 'space-between', etc.
            align = 'stretch', // 'stretch', 'center', 'flex-start', etc.
            gap = '0',
            padding = '0',
            backgroundColor = 'transparent',
            borderRadius = '0',
            flex = 'none'
        } = options;

        const container = document.createElement('div');
        container.className = className;

        container.style.display = 'flex';
        container.style.flexDirection = direction;
        container.style.justifyContent = justify;
        container.style.alignItems = align;
        container.style.gap = gap;
        container.style.padding = padding;
        container.style.backgroundColor = backgroundColor;
        container.style.borderRadius = borderRadius;
        if (flex !== 'none') container.style.flex = flex;

        return container;
    };

    // Create a text input with consistent styling
    const createInput = (options = {}) => {
        const {
            type = 'text',
            value = '',
            placeholder = '',
            className = '',
            onChange = null,
            onFocus = null,
            readOnly = false
        } = options;

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.placeholder = placeholder;
        input.className = className;
        input.readOnly = readOnly;

        // Common input styling
        input.style.border = '1px solid #3a3a3a';
        input.style.backgroundColor = 'transparent';
        input.style.color = '#f0f0f0';
        input.style.borderRadius = '6px';
        input.style.padding = '6px 8px';
        input.style.fontSize = '1rem';
        input.style.fontFamily = 'inherit';

        if (onChange) input.addEventListener('change', onChange);
        if (onFocus) input.addEventListener('focus', onFocus);

        return input;
    };

    // Create a span element with common text styling
    const createTextSpan = (options = {}) => {
        const {
            text = '',
            className = '',
            fontSize = '1rem',
            fontWeight = '400',
            color = 'inherit',
            opacity = '1'
        } = options;

        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;

        span.style.fontSize = fontSize;
        span.style.fontWeight = fontWeight;
        span.style.color = color;
        span.style.opacity = opacity;

        return span;
    };

    // Clear all children of an element
    const clearElement = (element) => {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    };

    // Safely remove an element by ID
    const removeElement = (id) => {
        const element = document.getElementById(id);
        if (element) element.remove();
    };

    // Consolidated time formatting function
    const formatTimeDuration = (input, options = {}) => {
        const {
            type = 'duration', // 'time' or 'duration'
            showMs = true,
            msSize = '0.5em',
            compact = false,
            fallback = '0:00:00.000'
        } = options;

        let seconds, date;

        if (type === 'time') {
            // For time display (current time)
            date = input instanceof Date ? input : new Date();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
            return showMs
                ? `${hours}:${minutes}:${seconds}<span style="font-size:${msSize}; vertical-align: super">.${milliseconds}</span>`
                : `${hours}:${minutes}:${seconds}`;
        } else {
            // For duration display
            if (isNaN(input) || input < 0) return fallback;

            const totalMilliseconds = Math.floor(input * 1000);
            const hours = Math.floor(totalMilliseconds / 3600000);
            const remainingAfterHours = totalMilliseconds % 3600000;
            const minutes = Math.floor(remainingAfterHours / 60000);
            const remainingMs = remainingAfterHours % 60000;
            const sec = Math.floor(remainingMs / 1000);
            const ms = String(remainingMs % 1000).padStart(3, '0');

            const timeStr = compact && hours === 0
                ? `${minutes}:${String(sec).padStart(2, '0')}`
                : `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

            return showMs
                ? `${timeStr}<span style="font-size:${msSize}; vertical-align: super">.${ms}</span>`
                : timeStr;
        }
    };

    // Backward compatibility aliases
    const formatTime = (date) => formatTimeDuration(date, { type: 'time', showMs: true, msSize: '0.5em' });
    const formatDuration = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.5em', fallback: '0:00:00.000' });
    const formatDurationCompact = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, compact: true, fallback: '0:00.000' });
    const formatDurationHTML = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.25em', fallback: '0:00:00<span style="font-size:0.25em; vertical-align: super">.000</span>' });
    const formatSummaryDurationHTML = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.5em', fallback: '0:00:00<span style="font-size:0.5em; vertical-align: super">.000</span>' });
    const formatDurationHTMLFull = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '1em', fallback: '0:00:00.000' });
    
    // Plain text version for exports (no HTML)
    const formatDurationPlain = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return '0:00:00.000';
        const totalMilliseconds = Math.floor(seconds * 1000);
        const hours = Math.floor(totalMilliseconds / 3600000);
        const remainingAfterHours = totalMilliseconds % 3600000;
        const minutes = Math.floor(remainingAfterHours / 60000);
        const remainingMs = remainingAfterHours % 60000;
        const sec = Math.floor(remainingMs / 1000);
        const ms = String(remainingMs % 1000).padStart(3, '0');
        return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
    };

    const formatSessionName = (date) => {
        const y = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
    };

    // Helpers para parsear/renombrar sesiones
    const parseSessionKey = (fullKey) => {
        const fileName = fullKey.replace(sessionPrefix, ''); // yyyy-mm-dd_hh-mi-ss_<name>.txt
        // timestamp fijo de 19 chars (YYYY-MM-DD_HH-MM-SS)
        const timestamp = fileName.slice(0, 19);
        const nameWithExt = fileName.slice(20);
        const dot = nameWithExt.lastIndexOf('.');
        const name = dot > -1 ? nameWithExt.slice(0, dot) : nameWithExt;
        const [dateStr, timeStr] = timestamp.split('_');
        return { fileName, timestamp, dateStr, timeStr: timeStr.replaceAll('-', ':'), name };
    };

    const renameSession = (oldKey, newName) => {
        try {
            const data = localStorage.getItem(oldKey);
            if (data == null) return null;
            const { timestamp } = parseSessionKey(oldKey);
            const newFileName = `${timestamp}_${newName}.txt`;
            const newKey = sessionPrefix + newFileName;
            // Evitar colisiones simples
            if (newKey !== oldKey && localStorage.getItem(newKey) != null) {
                showModal({ title: 'Conflicte de nom', message: 'Ja existeix una sessió amb aquest nom.', type: 'alert', okText: 'D’acord' });
                return null;
            }
            localStorage.setItem(newKey, data);
            localStorage.removeItem(oldKey);
            return newKey;
        } catch (e) {
            console.error('Error reanomenant la sessió', e);
            // Use modal for error
            showModal({ title: 'Error', message: 'Error en reanomenar la sessió.', type: 'alert', okText: 'Tancar' });
            return null;
        }
    };

    // --- Lògica de vistes ---

    const toggleView = async () => {
        console.debug('[DEBUG] toggleView invoked', { isRecording, isReadOnly, isViewingSession });
        if (isRecording && !isReadOnly) {
            await showModal({ title: 'ATENCIÓ', message: 'Finalitza la sessió actual abans de veure les sessions desades.', type: 'alert', okText: 'D’acord' });
            return;
        }

        if (isViewingSession) {
            // Si estamos viendo una sesión guardada, ir directamente al listado
            await closeSessionView(false);
            sessionsView.style.display = 'block';
            registrationView.style.display = 'none';
            updateToggleViewBtnLabel();
            renderSessions();
        } else if (isReadOnly) {
            // En mode lectura, tancar vista de sessió amb confirmació i anar a sessions
            await closeSessionView(false);
            sessionsView.style.display = 'block';
            registrationView.style.display = 'none';
            updateToggleViewBtnLabel();
            renderSessions();
        } else {
            const isSessionsView = (() => {
                try {
                    const disp = (typeof getComputedStyle === 'function') ? getComputedStyle(sessionsView).display : sessionsView.style.display;
                    return disp !== 'none';
                } catch { return sessionsView.style.display === 'block'; }
            })();
            console.debug('[DEBUG] toggleView state', { isSessionsView });
            if (isSessionsView) {
                sessionsView.style.display = 'none';
                registrationView.style.display = 'block';
                clockContainer.style.display = 'flex';
                finalizeBtn.style.display = 'block';
                updateToggleViewBtnLabel();

                // Refresh display
                startClock();
                updateInstructionText();
            } else {
                sessionsView.style.display = 'block';
                registrationView.style.display = 'none';
                updateToggleViewBtnLabel();
            }
        }
    };

    // --- Lògica principal ---

    const updateSummary = () => {
        let totalWorkSeconds = 0;
        let totalRestSeconds = 0;

        if (laps.length > 1) {
            for (let i = 0; i < laps.length - 1; i++) {
                const duration = (laps[i + 1].time - laps[i].time) / 1000;
                if (laps[i].type === 'work') {
                    totalWorkSeconds += duration;
                } else {
                    totalRestSeconds += duration;
                }
            }
        }

        totalWorkElement.innerHTML = formatSummaryDurationHTML(totalWorkSeconds);
        totalRestElement.innerHTML = formatSummaryDurationHTML(totalRestSeconds);
        totalTimeElement.innerHTML = formatSummaryDurationHTML(totalWorkSeconds + totalRestSeconds);
    };

    const enforceFinalLapName = () => {
        if (!Array.isArray(laps) || laps.length === 0) return;
        // Asegurar que ninguna vuelta que no sea la última tenga el nombre "-FINAL-"
        for (let i = 0; i < laps.length - 1; i++) {
            if (laps[i] && laps[i].name === '-FINAL-') {
                laps[i].name = `Volta ${i + 1}`;
            }
        }
        // Forzar nombre de la última vuelta
        const lastIndex = laps.length - 1;
        if (laps[lastIndex]) {
            laps[lastIndex].name = '-FINAL-';
        }
    };

    const updateToggleViewBtnLabel = () => {
        try {
            const isSessionsVisible = (() => {
                if (!sessionsView) return false;
                const disp = (typeof getComputedStyle === 'function') ? getComputedStyle(sessionsView).display : sessionsView.style.display;
                return disp !== 'none';
            })();
            if (isSessionsVisible) {
                toggleViewBtn.innerHTML = `${stopwatchIcon} <span class=\"toggle-label\">REGISTRAR</span>`;
                toggleViewBtn.setAttribute('aria-label', 'Canviar a vista de registre');
                console.debug('[DEBUG] updateToggleViewBtnLabel -> REGISTRAR');
            } else {
                toggleViewBtn.innerHTML = `${disketteIcon} <span class=\"toggle-label\">LLISTAT</span>`;
                toggleViewBtn.setAttribute('aria-label', 'Canviar a vista de sessions');
                console.debug('[DEBUG] updateToggleViewBtnLabel -> LLISTAT');
            }
        } catch (e) {
            console.debug('[DEBUG] updateToggleViewBtnLabel error', e);
        }
    };

    const renderLaps = () => {
        // Limpiar contenedor
        while (lapsContainer.firstChild) lapsContainer.removeChild(lapsContainer.firstChild);
        laps.forEach((lap, index) => {
            const lapItem = document.createElement('div');
            lapItem.className = `lap-item ${lap.type}`;

            // Índice correlativo (1-based)
            const lapIndex = document.createElement('span');
            lapIndex.className = 'lap-index';
            lapIndex.textContent = String(index + 1);

            const lapTime = document.createElement('span');
            lapTime.className = 'lap-duration';
            const t = (lap.time instanceof Date) ? lap.time : new Date(lap.time);
            lapTime.innerHTML = formatTime(t);

            const lapNameContainer = document.createElement('div');
            lapNameContainer.style.display = 'flex';
            lapNameContainer.style.alignItems = 'center';
            lapNameContainer.style.gap = '6px';
            lapNameContainer.style.flex = '1';

            const lapNameInput = document.createElement('input');
            lapNameInput.className = 'lap-name';
            lapNameInput.type = 'text';
            lapNameInput.value = lap.name;
            lapNameInput.style.textAlign = 'center'; // Centrar el texto
            lapNameInput.style.flex = '1'; // Tomar todo el espacio disponible
            lapNameInput.addEventListener('focus', (e) => e.target.select());
            lapNameInput.addEventListener('change', (e) => {
                if (!isReadOnly) {
                    laps[index].name = e.target.value;
                }
            });
            if (isReadOnly) {
                lapNameInput.readOnly = true;
            }
            
            // Añadir icono de lápiz para editar nombre en modo edición
            if (isViewingSession) {
                const editNameBtn = document.createElement('button');
                editNameBtn.type = 'button';
                editNameBtn.title = 'Editar nombre de la vuelta';
                editNameBtn.style.display = 'flex';
                editNameBtn.style.alignItems = 'center';
                editNameBtn.style.justifyContent = 'center';
                editNameBtn.style.padding = '4px';
                editNameBtn.style.borderRadius = '4px';
                editNameBtn.style.border = '1px solid var(--secondary-color)';
                editNameBtn.style.background = 'transparent';
                editNameBtn.style.color = 'var(--secondary-color)';
                editNameBtn.style.cursor = 'pointer';
                editNameBtn.style.flex = '0 0 auto';
                editNameBtn.innerHTML = editIcon;
                
                editNameBtn.addEventListener('click', async () => {
                    const newName = await showModal({ 
                        title: 'Editar nombre de vuelta', 
                        type: 'prompt', 
                        defaultValue: lap.name || '', 
                        okText: 'Guardar', 
                        cancelText: 'Cancelar' 
                    });
                    if (newName !== null && newName.trim() !== '') {
                        laps[index].name = newName.trim();
                        lapNameInput.value = newName.trim();
                        sessionDirty = true;
                    }
                });
                
                lapNameContainer.appendChild(lapNameInput);
                lapNameContainer.appendChild(editNameBtn);
            } else {
                lapNameContainer.appendChild(lapNameInput);
            }

            const durationSpan = document.createElement('span');
            durationSpan.className = 'lap-time';

            if (index < laps.length - 1) {
                const nextRaw = laps[index + 1].time;
                const nextT = (nextRaw instanceof Date) ? nextRaw : new Date(nextRaw);
                const duration = (nextT - t) / 1000;
                durationSpan.innerHTML = formatSummaryDurationHTML(duration);
            } else if (!isReadOnly) {
                const now = new Date();
                const duration = (now - t) / 1000;
                durationSpan.innerHTML = formatSummaryDurationHTML(duration);
            }

            const lapTypeToggle = document.createElement('button');
            lapTypeToggle.className = `lap-type-toggle ${lap.type}`;
            const isWork = lap.type === 'work';
            lapTypeToggle.innerHTML = `${isWork ? workIcon : restIcon} ${isWork ? 'Treball' : 'Descans'}`;
            lapTypeToggle.style.display = 'flex';
            lapTypeToggle.style.alignItems = 'center';
            lapTypeToggle.style.gap = '5px';
            lapTypeToggle.setAttribute('role', 'button');
            lapTypeToggle.setAttribute('aria-pressed', String(isWork));
            lapTypeToggle.setAttribute('tabindex', '0');
            lapTypeToggle.setAttribute('aria-label', isWork ? 'Canvia a descans' : 'Canvia a treball');
            lapTypeToggle.addEventListener('click', () => {
                // Permitir edición tanto en sesión activa como en sesión guardada
                if (!isReadOnly || isViewingSession) {
                    laps[index].type = laps[index].type === 'work' ? 'rest' : 'work';
                    const nowIsWork = laps[index].type === 'work';
                    lapTypeToggle.setAttribute('aria-pressed', String(nowIsWork));
                    lapTypeToggle.setAttribute('aria-label', nowIsWork ? 'Canvia a descans' : 'Canvia a treball');
                    
                    // Marcar como modificado si estamos viendo una sesión guardada
                    if (isViewingSession) {
                        sessionDirty = true;
                        const saveBtnEnable = document.getElementById('session-save-btn');
                        if (saveBtnEnable) saveBtnEnable.disabled = false;
                    }
                    
                    renderLaps();
                    updateSummary();
                }
            });
            
            // Aplicar estilos según el modo
            if (!isReadOnly || isViewingSession) {
                // Sesión activa o modo edición: botón activo
                lapTypeToggle.style.cursor = 'pointer';
                lapTypeToggle.style.opacity = '1';
                lapTypeToggle.style.pointerEvents = 'auto';
            } else {
                // Modo vista de sesión guardada: botón deshabilitado visualmente
                lapTypeToggle.style.cursor = 'default';
                lapTypeToggle.style.opacity = '0.6';
                lapTypeToggle.style.pointerEvents = 'none';
            }
            lapTypeToggle.addEventListener('keydown', (e) => {
                if ((!isReadOnly || isViewingSession) && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    lapTypeToggle.click();
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Eliminar volta';
            deleteBtn.setAttribute('aria-label', 'Eliminar volta');
            deleteBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>`;
            deleteBtn.addEventListener('click', () => {
                if (!isReadOnly && confirm(`Segur que vols eliminar "${lap.name}"?`)) {
                    laps.splice(index, 1);
                    renderLaps();
                    updateSummary();
                }
            });

            // Place delete button first (leftmost) when editable
            if (!isReadOnly) {
                lapItem.appendChild(deleteBtn);
            }
            lapItem.appendChild(lapIndex);
            lapItem.appendChild(lapTime);
            lapItem.appendChild(lapNameContainer);
            lapItem.appendChild(durationSpan);
            // En session-view, la vuelta "-FINAL-" no muestra icono de trabajo/descanso
            const isSessionViewContext = (typeof currentSessionKey !== 'undefined' && currentSessionKey) || isViewingSession || isReadOnly;
            if (!(isSessionViewContext && lap.name === '-FINAL-')) {
                lapItem.appendChild(lapTypeToggle);
            }
            lapsContainer.prepend(lapItem);
        });
    };

    const updateInstructionText = () => {
        instructionText.textContent = isRecording 
            ? 'PREM AQUÍ PER MARCAR UNA VOLTA'
            : 'PREM AQUÍ PER INICIAR UNA SESSIÓ';
    };

    // Mostrar/ocultar campo de nombre durante la grabación
    const mountRecordingNameRow = () => {
        const existing = document.getElementById('recording-name-row');
        if (existing) return;
        const row = document.createElement('div');
        row.id = 'recording-name-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        row.style.margin = '10px 0';

        const label = document.createElement('span');
        label.textContent = 'SESSIÓ:';
        label.style.opacity = '0.9';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = recordingName || 'Indeterminat';
        input.placeholder = 'Nom de la sessió';
        input.style.flex = '1 1 auto';
        input.style.minWidth = '0';
        input.style.border = '1px solid #3a3a3a';
        input.style.background = 'transparent';
        input.style.color = '#f0f0f0';
        input.style.borderRadius = '6px';
        input.style.padding = '6px 8px'; // menor margen interno
        input.style.fontSize = '1.2rem'; // texto más grande
        input.style.fontWeight = '700'; // negrita
        input.addEventListener('input', (e) => {
            recordingName = String(e.target.value ?? '').trimStart();
        });

        row.appendChild(label);
        row.appendChild(input);

        // Botón de edición (lápiz) para enfocar y preseleccionar
        const editBtn = document.createElement('button');
        editBtn.setAttribute('aria-label', 'Editar nom de la sessió');
        editBtn.title = 'Editar nom';
        editBtn.style.display = 'flex';
        editBtn.style.alignItems = 'center';
        editBtn.style.justifyContent = 'center';
        editBtn.style.padding = '6px';
        editBtn.style.borderRadius = '6px';
        editBtn.style.border = '1px solid var(--secondary-color)';
        editBtn.style.background = 'transparent';
        editBtn.style.color = 'var(--secondary-color)';
        editBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>`;
        editBtn.addEventListener('click', () => {
            input.focus();
            input.select();
        });

        row.appendChild(editBtn);

        // Insertar debajo del reloj (sin depender de #date-container)
        clockContainer.parentNode.insertBefore(row, clockContainer.nextSibling);
    };

    const unmountRecordingNameRow = () => {
        const existing = document.getElementById('recording-name-row');
        if (existing) existing.remove();
    };

    const addLap = () => {
        if (isReadOnly) return;
        const now = new Date();
        if (!isRecording) {
            isRecording = true;
            finalizeBtn.textContent = 'FINALITZAR SESSIÓ';
            updateInstructionText();
            
            // Forzar estilo verde durante grabación
            clockContainer.style.backgroundColor = '#2E7D32'; // Verde oscuro
            clockContainer.style.color = '#ffffff'; // Texto blanco
            clockElement.style.color = '#ffffff'; // Texto blanco para el reloj
            
            // Montar campo de nombre de sesión para grabación
            mountRecordingNameRow();
        }
        laps.push({
            time: now,
            name: `Volta ${laps.length + 1}`,
            type: 'work'
        });
        renderLaps();
        updateSummary();
        
        // Iniciar actualización incremental de la última vuelta
        if (laps.length >= 2) {
            startLastLapUpdate();
        }
    };

    // Actualizar solo la duración de la última vuelta (optimizado)
    const updateLastLapDuration = () => {
        if (isReadOnly || laps.length === 0) return;
        const lastLapElement = lapsContainer.firstChild;
        if (lastLapElement) {
            const durationSpan = lastLapElement.querySelector('.lap-time');
            if (durationSpan) {
                const now = new Date();
                const lastLap = laps[laps.length - 1];
                const duration = (now - lastLap.time) / 1000;
                const formatted = formatSummaryDurationHTML(duration);
                
                // Solo actualizar si cambió (optimización)
                if (durationSpan.innerHTML !== formatted) {
                    durationSpan.innerHTML = formatted;
                }
            }
        }
    };
    
    // Variables para actualización incremental de última vuelta
    let lastLapUpdateId = null;
    
    // Iniciar actualización periódica de la última vuelta
    function startLastLapUpdate() {
        if (lastLapUpdateId) return; // Ya está actualizando
        
        lastLapUpdateId = setInterval(() => {
            if (laps.length < 2) return;
            
            const lastLapElement = lapsContainer.firstChild;
            if (!lastLapElement) return;
            
            const durationSpan = lastLapElement.querySelector('.lap-time');
            if (durationSpan) {
                const lastLap = laps[laps.length - 1];
                const duration = (Date.now() - lastLap.time) / 1000;
                const formatted = formatSummaryDurationHTML(duration);
                
                // Solo actualizar si cambió
                if (durationSpan.innerHTML !== formatted) {
                    durationSpan.innerHTML = formatted;
                }
            }
        }, 100); // Actualizar cada 100ms (suficiente para mostrar cambios)
        
        console.debug('[Laps] Actualización incremental iniciada');
    }
    
    // Detener actualización de última vuelta
    function stopLastLapUpdate() {
        if (lastLapUpdateId) {
            clearInterval(lastLapUpdateId);
            lastLapUpdateId = null;
            console.debug('[Laps] Actualización incremental detenida');
        }
    }

    // Variables para requestAnimationFrame
    let lastClockUpdate = 0;
    let rafId = null;
    
    // Función de actualización del reloj con requestAnimationFrame
    function updateClock() {
        const now = Date.now();
        
        // Throttling: actualizar cada 50ms
        if (now - lastClockUpdate >= 50) {
            lastClockUpdate = now;
            
            const time = new Date();
            const formatted = formatTime(time);
            
            // Solo actualizar DOM si cambió el contenido
            if (clockElement.innerHTML !== formatted) {
                clockElement.innerHTML = formatted;
            }
            
            // Actualizar duración de última vuelta si está grabando
            updateLastLapDuration();
        }
        
        // Continuar el loop
        rafId = requestAnimationFrame(updateClock);
    }
    
    const startClock = () => {
        if (rafId) return; // Ya está corriendo
        rafId = requestAnimationFrame(updateClock);
        console.debug('[Clock] Iniciado con requestAnimationFrame');
    };
    
    const stopClock = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
            console.debug('[Clock] Detenido');
        }
    };

    const finalizeSession = async () => {
        // Safety: ensure view-mode finalize handler is detached
        try {
            if (finalizeViewHandler) {
                finalizeBtn.removeEventListener('click', finalizeViewHandler);
                finalizeViewHandler = null;
            }
        } catch {}
        // If currently recording, mark a lap as if the user tapped the clock
        if (isRecording && typeof clockContainer !== 'undefined' && clockContainer) {
            try { clockContainer.click(); } catch {}
            // Allow the click handler (addLap) to run before proceeding
            await new Promise(r => setTimeout(r, 25));
        }
        // If still no laps, inform the user and abort finalize
        if (laps.length === 0) {
            try {
                await showModal({ title: 'Informació', message: 'Prem sobre el Rellotge superior per inicial el reigstres de voltes.', type: 'alert', okText: 'D’acord' });
            } catch {}
            return;
        }

        // Aplicar regla: la última vuelta debe llamarse "-FINAL-" al finalizar
        enforceFinalLapName();
        
        // Pedir nombre de la sesión antes de guardar
        const sessionNameInput = await showModal({
            title: 'Nom de la sessió',
            message: 'Introdueix un nom per a aquesta sessió:',
            type: 'prompt',
            defaultValue: recordingName || 'Indeterminat',
            okText: 'Desar',
            cancelText: 'Cancel·lar'
        });
        
        // Si el usuario cancela, no guardar
        if (sessionNameInput === null || sessionNameInput === undefined) {
            console.debug('[Session] Guardado cancelado por el usuario');
            return;
        }
        
        const timestamp = formatSessionName(new Date(laps[0].time));
        const sessionNameValue = String(sessionNameInput || '').trim() || 'Indeterminat';
        const fullSessionName = `${timestamp}_${sessionNameValue}.txt`;
        try {
            localStorage.setItem(sessionPrefix + fullSessionName, JSON.stringify(laps));
            
            // Detener actualización incremental
            stopLastLapUpdate();
            
            laps = [];
            isRecording = false;
            recordingName = 'Indeterminat';
            
            // Restaurar texto del botón
            finalizeBtn.textContent = 'PREM EL RELLOTGE PER COMENÇAR';
            
            // Restaurar color original del clock-container
            clockContainer.style.backgroundColor = '#2E7D32'; // Verde oscuro original
            clockContainer.style.color = '#ffffff'; // Texto blanco original
            clockElement.style.color = '#ffffff'; // Texto blanco original para el reloj
            
            unmountRecordingNameRow();
            renderLaps();
            updateSummary();
            // Mostrar directamente la vista de sesiones y refrescar lista
            renderSessions();
            sessionsView.style.display = 'block';
            registrationView.style.display = 'none';
            toggleViewBtn.innerHTML = `${stopwatchIcon} <span class=\"toggle-label\">REGISTRAR</span>`;
        } catch (e) {
            await showModal({ title: 'Error', message: "Error en desar la sessió. L'emmagatzematge pot estar ple.", type: 'alert', okText: 'Tancar' });
            console.error(e);
        }
    };

    const renderSessions = () => {
        // Asegurar que no quede la barra superior de sesión colgada
        try {
            const danglingTopBar = document.getElementById('session-top-bar');
            if (danglingTopBar) {
                console.debug('[DEBUG] renderSessions removing dangling session-top-bar');
                danglingTopBar.remove();
            }
        } catch {}
        // Asegurar el estado correcto del botón toggle
        updateToggleViewBtnLabel();
        sessionsList.innerHTML = '';
        const sessions = Object.keys(localStorage)
            .filter(key => key.startsWith(sessionPrefix))
            .sort((a, b) => {
                // Extract date from session key (format: stopwatch_session_yyyy-mm-dd_hh-mi-ss)
                const dateA = a.split('_')[2] + a.split('_')[3];
                const dateB = b.split('_')[2] + b.split('_')[3];
                return dateB.localeCompare(dateA); // Most recent first
            });

        // Mantener visible el contenedor y el título aunque no haya sesiones
        sessionsContainer.parentElement.style.display = 'block';
        
        // Rest of renderSessions remains the same
        // Mostrar mensaje vacío cuando no hay sesiones
        if (sessions.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No hi ha sessions desades';
            emptyMsg.style.color = '#aaa';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '10px 0';
            sessionsList.appendChild(emptyMsg);
            return;
        }

        sessions.forEach(sessionKey => {
            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';

            const info = parseSessionKey(sessionKey);

            const nameSpan = document.createElement('span');
            nameSpan.style.marginTop = '4px';
            nameSpan.style.display = 'block';
            nameSpan.style.fontSize = '0.9em';
            nameSpan.style.opacity = '0.9';
            nameSpan.textContent = info.fileName;

            const detail = document.createElement('div');
            detail.style.color = '#f0f0f0';
            detail.style.fontSize = '1.1rem';
            detail.style.fontWeight = '600';
            // Calculate total duration and laps count from saved data (excluye "-FINAL-")
            let lapsCount = 0;
            let totalSeconds = 0;
            try {
                const saved = JSON.parse(localStorage.getItem(sessionKey));
                if (Array.isArray(saved) && saved.length > 0) {
                    lapsCount = saved.filter(l => l && l.name !== '-FINAL-').length;
                    for (let i = 0; i < saved.length - 1; i++) {
                        const t0 = new Date(saved[i].time);
                        const t1 = new Date(saved[i + 1].time);
                        totalSeconds += (t1 - t0) / 1000;
                    }
                }
            } catch {}
            const totalStr = lapsCount > 0 ? `  |  ${formatDurationCompact(totalSeconds)}  |  ${lapsCount} voltes` : '';
            detail.innerHTML = `${info.dateStr}  |  ${info.timeStr}${totalStr}`;

            // First line: session name (bold and larger)
            const nameLine = document.createElement('div');
            nameLine.textContent = info.name;
            nameLine.style.color = '#f0f0f0';
            nameLine.style.fontSize = '1.3rem';
            nameLine.style.fontWeight = '700';
            nameLine.style.marginBottom = '2px';

            // Left column with two rows (filename, and date | time | name)
            const infoCol = document.createElement('div');
            infoCol.style.display = 'flex';
            infoCol.style.flexDirection = 'column';
            infoCol.style.flex = '1 1 auto';
            // Order: name (big/bold), date|time, file name (bottom, smaller)
            infoCol.appendChild(nameLine);
            infoCol.appendChild(detail);
            infoCol.appendChild(nameSpan);

            // Right column with actions
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.flexDirection = 'column';
            buttonsContainer.style.gap = '5px';

            const viewBtn = document.createElement('button');
            viewBtn.innerHTML = `${searchIcon}`;
            viewBtn.setAttribute('aria-label', 'Veure');
            viewBtn.title = 'Veure';
            viewBtn.style.display = 'flex';
            viewBtn.style.alignItems = 'center';
            viewBtn.style.gap = '6px';
            viewBtn.addEventListener('click', () => viewSession(sessionKey));

            buttonsContainer.appendChild(viewBtn);

            // Left delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.setAttribute('aria-label', 'Eliminar sessió');
            deleteBtn.title = 'Eliminar';
            deleteBtn.style.display = 'flex';
            deleteBtn.style.alignItems = 'center';
            deleteBtn.style.justifyContent = 'center';
            deleteBtn.style.padding = '6px';
            deleteBtn.style.borderRadius = '6px';
            deleteBtn.style.border = '1px solid #e74c3c';
            deleteBtn.style.background = 'transparent';
            deleteBtn.style.color = '#e74c3c';
            deleteBtn.innerHTML = `${trashIcon}`;
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const ok = await showModal({
                    title: 'Eliminar sessió',
                    message: `Segur que vols eliminar la sessió "${sessionKey.replace(sessionPrefix, '')}"?`,
                    okText: 'Eliminar',
                    cancelText: 'Cancel·lar',
                    type: 'confirm'
                });
                if (ok) {
                    localStorage.removeItem(sessionKey);
                    // Si estamos viendo esta sesión, cerrar la vista y volver a la lista
                    if (typeof isViewingSession !== 'undefined' && isViewingSession && currentSessionKey === sessionKey) {
                        if (typeof closeSessionView === 'function') {
                            await closeSessionView(true);
                        }
                        const sessionsViewEl = document.getElementById('sessions-view');
                        const registrationViewEl = document.getElementById('registration-view');
                        if (sessionsViewEl && registrationViewEl) {
                            sessionsViewEl.style.display = 'block';
                            registrationViewEl.style.display = 'none';
                        }
                    }
                    renderSessions();
                }
            });

            // Append in order: delete | info | actions
            sessionItem.appendChild(deleteBtn);
            sessionItem.appendChild(infoCol);
            sessionItem.appendChild(buttonsContainer);
            sessionsList.appendChild(sessionItem);
        });
    };

    const viewSession = (sessionKey) => {
        let savedLaps = null;
        try {
            savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        } catch {}
        try {
            let details = null;
            if (Array.isArray(savedLaps)) {
                details = savedLaps.map((lap, i) => {
                    const t = (lap.time instanceof Date) ? lap.time : new Date(lap.time);
                    let nextDur = null;
                    if (i < savedLaps.length - 1) {
                        const nraw = savedLaps[i + 1].time;
                        const nt = (nraw instanceof Date) ? nraw : new Date(nraw);
                        nextDur = (nt - t) / 1000;
                    }
                    return {
                        index: i + 1,
                        timeISO: t.toISOString(),
                        type: lap.type,
                        name: lap.name,
                        nextDurationSec: nextDur,
                        nextDurationFmt: nextDur != null ? formatDurationCompact(nextDur) : null
                    };
                });
            }
        } catch {}
        if (!Array.isArray(savedLaps) || savedLaps.length === 0) {
            showModal({ title: 'Sessió buida', message: 'Aquesta sessió no conté voltes.', type: 'alert', okText: 'Tancar' });
            return;
        }
        if (savedLaps) {
            isReadOnly = true;
            isViewingSession = false; // Inicialmente en modo solo lectura
            currentSessionKey = sessionKey;
            laps = savedLaps.map(lap => ({...lap, time: new Date(lap.time)}));
            sessionDirty = false;
            pendingRename = null;
            
            // Variables de estado para modo edición
            let isEditMode = false;
            let originalLapsState = null;
            
            // Switch to registration view first
            sessionsView.style.display = 'none';
            registrationView.style.display = 'block';
            
            // Create top bar container
            const topBar = document.createElement('div');
            topBar.id = 'session-top-bar';
            topBar.style.position = 'fixed';
            // Place the session top bar just below the fixed app title
            const appTitleEl = document.getElementById('app-title');
            const appTitleHeight = appTitleEl ? appTitleEl.offsetHeight : 44;
            topBar.style.top = appTitleHeight + 'px';
            topBar.style.left = '0';
            topBar.style.width = '100%';
            topBar.style.padding = '8px'; // Reduced padding for more height
            topBar.style.backgroundColor = '#333';
            topBar.style.zIndex = '1000';
            topBar.style.display = 'flex';
            topBar.style.justifyContent = 'space-between';
            topBar.style.alignItems = 'stretch'; // Ensure full height usage
            topBar.style.boxSizing = 'border-box';
            topBar.style.height = '56px'; // Increased height for better button appearance

            // Crear botón propio para editar/validar en vista de sesión
            const sessionEditBtn = document.createElement('button');
            sessionEditBtn.className = 'session-edit-btn';
            sessionEditBtn.style.margin = '0';
            sessionEditBtn.style.flex = '1';
            sessionEditBtn.style.height = '36px';
            sessionEditBtn.innerHTML = `${editIcon} EDITAR`;
            sessionEditBtn.addEventListener('click', () => {
                if (isEditMode) {
                    validateEdit();
                } else {
                    toggleEditMode();
                }
            });
            // Update toggle button to show "LLISTAT" when viewing a session
            toggleViewBtn.innerHTML = `${disketteIcon} <span class="toggle-label">LLISTAT</span>`;
            toggleViewBtn.setAttribute('aria-label', 'Tornar al llistat de sessions');

            // Action buttons (Delete, Share, Share CSV) same as sessions list
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.flexDirection = 'column'; // Stack buttons vertically
            actions.style.gap = '5px'; // Gap between button rows
            actions.style.flex = '1'; // Take up remaining space
            actions.style.justifyContent = 'space-between'; // Distribute rows evenly
            actions.style.alignItems = 'stretch'; // Use full height

            const viewDeleteBtn = document.createElement('button');
            viewDeleteBtn.type = 'button';
            // Create larger trash icon for better visibility
            const largeTrashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
            viewDeleteBtn.innerHTML = `${largeTrashIcon} ELIMINAR`;
            viewDeleteBtn.style.display = 'flex';
            viewDeleteBtn.style.alignItems = 'center';
            viewDeleteBtn.style.justifyContent = 'center';
            viewDeleteBtn.style.gap = '6px';
            viewDeleteBtn.style.flex = '1'; // Take equal portion of space
            viewDeleteBtn.style.height = '36px'; // Fixed height for all buttons
            viewDeleteBtn.style.borderRadius = '8px'; // Rounded corners like lap-type-toggle
            viewDeleteBtn.style.border = `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim()}`; // Red border
            viewDeleteBtn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim(); // Red background
            viewDeleteBtn.style.color = '#fff'; // White text
            viewDeleteBtn.style.fontWeight = '700'; // Bold text
            viewDeleteBtn.style.fontSize = '0.9rem'; // Larger font size
            viewDeleteBtn.style.cursor = 'pointer';
            viewDeleteBtn.style.transition = 'all 0.2s';
            viewDeleteBtn.style.textTransform = 'uppercase';
            viewDeleteBtn.addEventListener('click', (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                console.debug('[DEBUG] viewDeleteBtn click', { from: 'session-view@registration-view', isEditMode, isViewingSession, currentSessionKey, sessionKey });
                if (isEditMode) {
                    cancelEdit();
                } else {
                    deleteSession(sessionKey);
                }
            });

            const viewShareBtn = document.createElement('button');
            // Create larger share icon for better visibility
            const largeShareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
            viewShareBtn.innerHTML = `${largeShareIcon} COMPARTIR`;
            viewShareBtn.style.display = 'flex';
            viewShareBtn.style.alignItems = 'center';
            viewShareBtn.style.justifyContent = 'center';
            viewShareBtn.style.gap = '6px';
            viewShareBtn.style.flex = '1'; // Take equal portion of space
            viewShareBtn.style.height = '36px'; // Fixed height for all buttons
            viewShareBtn.style.borderRadius = '8px'; // Rounded corners like lap-type-toggle
            viewShareBtn.style.border = `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()}`; // Blue border
            viewShareBtn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(); // Blue background
            viewShareBtn.style.color = '#fff'; // White text
            viewShareBtn.style.fontWeight = '700'; // Bold text
            viewShareBtn.style.fontSize = '0.9rem'; // Larger font size
            viewShareBtn.style.cursor = 'pointer';
            viewShareBtn.style.transition = 'all 0.2s';
            viewShareBtn.style.textTransform = 'uppercase';
            viewShareBtn.addEventListener('click', () => shareSession(sessionKey));

            const viewShareCsvBtn = document.createElement('button');
            // Create larger share icon for better visibility
            const largeShareIcon2 = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
            viewShareCsvBtn.innerHTML = `${largeShareIcon2} CSV ( ; )`;
            viewShareCsvBtn.style.display = 'flex';
            viewShareCsvBtn.style.alignItems = 'center';
            viewShareCsvBtn.style.justifyContent = 'center';
            viewShareCsvBtn.style.gap = '6px';
            viewShareCsvBtn.style.flex = '1'; // Take equal portion of space
            viewShareCsvBtn.style.height = '36px'; // Fixed height for all buttons
            viewShareCsvBtn.style.borderRadius = '8px'; // Rounded corners like lap-type-toggle
            viewShareCsvBtn.style.border = `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()}`; // Blue border
            viewShareCsvBtn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(); // Blue background
            viewShareCsvBtn.style.color = '#fff'; // White text
            viewShareCsvBtn.style.fontWeight = '700'; // Bold text
            viewShareCsvBtn.style.fontSize = '0.9rem'; // Larger font size
            viewShareCsvBtn.style.cursor = 'pointer';
            viewShareCsvBtn.style.transition = 'all 0.2s';
            viewShareCsvBtn.style.textTransform = 'uppercase';
            viewShareCsvBtn.addEventListener('click', () => shareSessionCSV(sessionKey));

            const viewShareCsvCommaBtn = document.createElement('button');
            // Create larger share icon for better visibility
            const largeShareIcon3 = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
            viewShareCsvCommaBtn.innerHTML = `${largeShareIcon3} CSV ( , )`;
            viewShareCsvCommaBtn.style.display = 'flex';
            viewShareCsvCommaBtn.style.alignItems = 'center';
            viewShareCsvCommaBtn.style.justifyContent = 'center';
            viewShareCsvCommaBtn.style.gap = '6px';
            viewShareCsvCommaBtn.style.flex = '1'; // Take equal portion of space
            viewShareCsvCommaBtn.style.height = '36px'; // Fixed height for all buttons
            viewShareCsvCommaBtn.style.borderRadius = '8px'; // Rounded corners like lap-type-toggle
            viewShareCsvCommaBtn.style.border = `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()}`; // Blue border
            viewShareCsvCommaBtn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(); // Blue background
            viewShareCsvCommaBtn.style.color = '#fff'; // White text
            viewShareCsvCommaBtn.style.fontWeight = '700'; // Bold text
            viewShareCsvCommaBtn.style.fontSize = '0.9rem'; // Larger font size
            viewShareCsvCommaBtn.style.cursor = 'pointer';
            viewShareCsvCommaBtn.style.transition = 'all 0.2s';
            viewShareCsvCommaBtn.style.textTransform = 'uppercase';
            viewShareCsvCommaBtn.addEventListener('click', () => shareSessionCSVComma(sessionKey));

            // Create top row with Delete and Close buttons
            const topRow = document.createElement('div');
            topRow.style.display = 'flex';
            topRow.style.gap = '5px';
            topRow.style.flex = '1';
            topRow.style.alignItems = 'stretch';
            
            // Create bottom row with Share buttons
            const bottomRow = document.createElement('div');
            bottomRow.style.display = 'flex';
            bottomRow.style.gap = '5px';
            bottomRow.style.flex = '1';
            bottomRow.style.alignItems = 'stretch';
            
            // Add buttons to their respective rows
            topRow.appendChild(viewDeleteBtn);
            topRow.appendChild(sessionEditBtn);
            bottomRow.appendChild(viewShareBtn);
            bottomRow.appendChild(viewShareCsvBtn);
            bottomRow.appendChild(viewShareCsvCommaBtn);
            
            // Funciones para manejo de modo edición
            const toggleEditMode = () => {
                isEditMode = !isEditMode;
                
                if (isEditMode) {
                    // Modo Vista → Edición
                    // Guardar estado original
                    originalLapsState = JSON.parse(JSON.stringify(laps));
                    
                    // Cambiar botones
                    sessionEditBtn.innerHTML = `${checkIcon} GUARDAR CAMBIOS`;
                    finalizeBtn.innerHTML = `${checkIcon} VALIDAR`;
                    viewDeleteBtn.innerHTML = `${xIcon} CANCELAR`;
                    
                    // Ocultar botones de compartir
                    bottomRow.style.display = 'none';
                    
                    // Habilitar edición de nombre de sesión
                    const nameLabel = document.querySelector('#session-name-row .nameLabel');
                    if (nameLabel) {
                        nameLabel.contentEditable = 'true';
                        nameLabel.style.border = '1px solid #00aaff';
                        nameLabel.style.borderRadius = '4px';
                        nameLabel.style.padding = '4px';
                        nameLabel.style.backgroundColor = 'rgba(0, 170, 255, 0.1)';
                    }
                    
                    // Mostrar botón "Editar nom"
                    const editBtn = document.querySelector('#session-name-row button');
                    if (editBtn) {
                        editBtn.style.display = 'flex';
                    }
                    
                    // Habilitar edición de tipos de vueltas
                    isViewingSession = true; // Permitir edición de tipos
                    renderLaps();
                } else {
                    // Modo Edición → Vista
                    // Cambiar botones
                    sessionEditBtn.innerHTML = `${editIcon} EDITAR`;
                    finalizeBtn.innerHTML = `${editIcon} EDITAR`;
                    viewDeleteBtn.innerHTML = `${largeTrashIcon} ELIMINAR`;
                    
                    // Mostrar botones de compartir
                    bottomRow.style.display = 'flex';
                    
                    // Deshabilitar edición de nombre de sesión
                    const nameLabel = document.querySelector('#session-name-row .nameLabel');
                    if (nameLabel) {
                        nameLabel.contentEditable = 'false';
                        nameLabel.style.border = 'none';
                        nameLabel.style.padding = '0';
                        nameLabel.style.backgroundColor = 'transparent';
                    }
                    
                    // Ocultar botón "Editar nom"
                    const editBtn = document.querySelector('#session-name-row button');
                    if (editBtn) {
                        editBtn.style.display = 'none';
                    }
                    
                    // Deshabilitar edición de tipos de vueltas
                    isViewingSession = false;
                    renderLaps();
                }
            };
            
            const cancelEdit = () => {
                // Restaurar datos originales
                if (originalLapsState) {
                    laps = JSON.parse(JSON.stringify(originalLapsState));
                    renderLaps();
                    updateSummary();
                }
                
                // Restaurar nombre de sesión original
                const nameLabel = document.querySelector('#session-name-row .nameLabel');
                if (nameLabel) {
                    const parsedInfo = parseSessionKey(currentSessionKey || sessionKey);
                    nameLabel.textContent = parsedInfo.name || 'Sessió';
                }
                
                // Resetear variables
                sessionDirty = false;
                pendingRename = null;
                
                // Volver a modo vista
                toggleEditMode();
            };
            
            const validateEdit = async () => {
                try {
                    // Guardar cambios en localStorage
                    if (pendingRename && pendingRename.trim() !== '') {
                        const { timestamp } = parseSessionKey(currentSessionKey);
                        const newFileName = `${timestamp}_${pendingRename}.txt`;
                        const newKey = sessionPrefix + newFileName;
                        localStorage.setItem(newKey, JSON.stringify(laps));
                        if (newKey !== currentSessionKey) {
                            localStorage.removeItem(currentSessionKey);
                            currentSessionKey = newKey;
                        }
                    } else {
                        localStorage.setItem(currentSessionKey, JSON.stringify(laps));
                    }
                    
                    // Resetear variables
                    sessionDirty = false;
                    pendingRename = null;
                    
                    // Volver a modo vista
                    toggleEditMode();
                    
                } catch (e) {
                    console.error('Error guardando cambios:', e);
                    await showModal({ title: 'Error', message: 'Error en guardar los cambios.', type: 'alert', okText: 'Tancar' });
                }
            };

            // Add rows to actions container
            actions.appendChild(topRow);
            actions.appendChild(bottomRow);
            topBar.appendChild(actions);
            document.body.insertBefore(topBar, document.body.firstChild);

            // Ocultar controls-container en vista de sesión guardada
            try {
                const controlsContainerEl = document.getElementById('controls-container');
                if (controlsContainerEl) controlsContainerEl.style.display = 'none';
            } catch {}

            // Add margin to registration view to account for both bars
            try {
                // Set fixed margin-top for registration view in session mode
                registrationView.style.marginTop = '90px';
            } catch {}
            
            // Hide only the clock text to keep laps list visible
            try { clockElement.style.display = 'none'; } catch {}
            try { clockContainer.style.display = 'none'; } catch {}
            
            // Remove existing session-info if present to avoid duplicates
            const existingSessionInfo = document.getElementById('session-info');
            if (existingSessionInfo) {
                existingSessionInfo.remove();
            }

            // Create session info container
            const sessionInfoContainer = document.createElement('div');
            sessionInfoContainer.id = 'session-info';
            sessionInfoContainer.style.textAlign = 'center';
            sessionInfoContainer.style.marginBottom = '5px';
            sessionInfoContainer.style.backgroundColor = '#d3d3d3'; // Gris claro
            sessionInfoContainer.style.padding = '10px';
            sessionInfoContainer.style.borderRadius = '8px';
            
            const sessionDate = laps.length > 0 ? new Date(laps[0].time) : new Date();
            const dateText = document.createElement('div');
            dateText.textContent = formatDate(sessionDate);
            dateText.style.fontSize = '1.2em';
            dateText.style.marginBottom = '10px';
            dateText.style.color = '#000000'; // Texto negro
            
            const timeText = document.createElement('div');
            const sessionTime = laps.length > 0 ? new Date(laps[0].time) : new Date();
            timeText.innerHTML = `Hora d'inici: ${formatTime(sessionTime)}`;
            timeText.style.fontSize = '1.1em';
            timeText.style.color = '#000000'; // Texto negro
            
            sessionInfoContainer.appendChild(dateText);
            sessionInfoContainer.appendChild(timeText);
            
            clockContainer.parentNode.insertBefore(sessionInfoContainer, clockContainer);

            // Session name row with edit icon below info box
            const existingNameRow = document.getElementById('session-name-row');
            if (existingNameRow) existingNameRow.remove();
            const nameRow = document.createElement('div');
            nameRow.id = 'session-name-row';
            nameRow.style.display = 'flex';
            nameRow.style.alignItems = 'center';
            nameRow.style.gap = '10px';
            nameRow.style.margin = '10px 0 5px 0';
            nameRow.style.width = '100%';
            nameRow.style.boxSizing = 'border-box';

            const namePrefix = document.createElement('span');
            namePrefix.textContent = 'SESSIÓ:';
            namePrefix.style.fontWeight = '400';
            namePrefix.style.opacity = '0.9';
            namePrefix.style.flex = '0 0 auto';
            namePrefix.style.textAlign = 'left';

            const nameLabel = document.createElement('span');
            const parsedNow = parseSessionKey(currentSessionKey || sessionKey);
            nameLabel.textContent = parsedNow.name || 'Sessió';
            nameLabel.style.fontSize = '1.3em';
            nameLabel.style.fontWeight = '600';
            nameLabel.style.flex = '1 1 auto';
            nameLabel.style.textAlign = 'center';
            nameLabel.contentEditable = 'false'; // Inicialmente no editable
            
            // Event listener para cambios en el nombre de la sesión
            nameLabel.addEventListener('input', () => {
                if (isEditMode) {
                    pendingRename = nameLabel.textContent.trim();
                    sessionDirty = true;
                }
            });

            const actionsRight = document.createElement('div');
            actionsRight.style.display = 'flex';
            actionsRight.style.gap = '8px';
            actionsRight.style.alignItems = 'center';
            actionsRight.style.flex = '0 0 auto';

            const editBtn = document.createElement('button');
            editBtn.setAttribute('aria-label', 'Editar nom de la sessió');
            editBtn.title = 'Editar nom';
            editBtn.style.display = 'none'; // Inicialmente oculto
            editBtn.style.alignItems = 'center';
            editBtn.style.justifyContent = 'center';
            editBtn.style.padding = '6px';
            editBtn.style.borderRadius = '6px';
            editBtn.style.border = '1px solid var(--secondary-color)';
            editBtn.style.background = 'transparent';
            editBtn.style.color = 'var(--secondary-color)';
            editBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>`;
            editBtn.addEventListener('click', async () => {
                const currentInfo = parseSessionKey(currentSessionKey || sessionKey);
                const newName = await showModal({ title: 'Editar nom', type: 'prompt', defaultValue: currentInfo.name || 'Sessió', okText: 'Desar', cancelText: 'Cancel·lar' });
                if (!newName) return;
                pendingRename = newName;
                nameLabel.textContent = newName;
                sessionDirty = true;
            });
            actionsRight.appendChild(editBtn);

            nameRow.appendChild(namePrefix);
            nameRow.appendChild(nameLabel);
            nameRow.appendChild(actionsRight);
            sessionInfoContainer.parentNode.insertBefore(nameRow, sessionInfoContainer.nextSibling);
            
            // Update display
            try { stopClock(); } catch {}
            try { renderLaps(); } catch (e) { console.error('renderLaps error', e); }
            try { updateSummary(); } catch (e) { console.error('updateSummary error', e); }
            try { lapsContainer.style.display = 'flex'; } catch {}
            // Fallback: if nothing rendered but there are laps, render minimal rows
            try {
                if (laps.length > 0 && lapsContainer.childElementCount === 0) {
                    const frag = document.createDocumentFragment();
                    laps.forEach((lap, i) => {
                        const row = document.createElement('div');
                        row.className = 'lap-item';
                        row.textContent = `#${i + 1} - ${new Date(lap.time).toLocaleTimeString()} - ${lap.name || ''}`;
                        frag.appendChild(row);
                    });
                    lapsContainer.appendChild(frag);
                }
            } catch {}
            try { lapsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
        }
    };

    const closeSessionView = async (skipPrompt = false) => {
        try {
            if (!skipPrompt && sessionDirty && currentSessionKey) {
                const ok = await showModal({ title: 'Desar canvis?', message: 'Vols desar els canvis?', okText: 'Desar', cancelText: 'No desar', type: 'confirm' });
                if (ok) {
                    // Guardar cambios (rename + tipos)
                    if (pendingRename && pendingRename.trim() !== '') {
                        const { timestamp } = parseSessionKey(currentSessionKey);
                        const newFileName = `${timestamp}_${pendingRename}.txt`;
                        const newKey = sessionPrefix + newFileName;
                        localStorage.setItem(newKey, JSON.stringify(laps));
                        if (newKey !== currentSessionKey) {
                            localStorage.removeItem(currentSessionKey);
                            currentSessionKey = newKey;
                        }
                    } else {
                        localStorage.setItem(currentSessionKey, JSON.stringify(laps));
                    }
                }
            }
        } catch (e) {
            console.error('Error en tancar la vista de sessió', e);
            await showModal({ title: 'Error', message: 'Error en desar els canvis.', type: 'alert', okText: 'Tancar' });
        } finally {
            sessionDirty = false;
            pendingRename = null;
        }
        isReadOnly = false;
        isViewingSession = false;
        currentSessionKey = null;
        laps = [];
        
        // Remove top bar and reset margins
        const topBar = document.getElementById('session-top-bar');
        if (topBar) {
            topBar.remove();
        }
        try { registrationView.style.marginTop = ''; } catch {}
        registrationView.style.marginTop = '0';
        // Restore finalize button to default behavior and remove view handler
        if (finalizeViewHandler) {
            try { finalizeBtn.removeEventListener('click', finalizeViewHandler); } catch {}
            finalizeViewHandler = null;
        }
        try { finalizeBtn.removeEventListener('click', finalizeSession); } catch {}
        finalizeBtn.addEventListener('click', finalizeSession);
        
        // Remove session-info if exists
        const existingSessionInfo = document.getElementById('session-info');
        if (existingSessionInfo) existingSessionInfo.remove();
        // Remove session-name row if exists
        const existingNameRow2 = document.getElementById('session-name-row');
        if (existingNameRow2) existingNameRow2.remove();

        // Reset finalize button (volver a su comportamiento normal de grabación)
        finalizeBtn.style.position = 'static';
        finalizeBtn.style.display = '';
        finalizeBtn.style.alignItems = '';
        finalizeBtn.style.justifyContent = '';
        finalizeBtn.style.height = '64px';
        finalizeBtn.style.borderRadius = '';
        finalizeBtn.style.border = '';
        finalizeBtn.style.backgroundColor = '';
        finalizeBtn.style.color = '';
        finalizeBtn.style.fontWeight = '';
        finalizeBtn.style.cursor = '';
        finalizeBtn.style.transition = '';
        finalizeBtn.style.textTransform = '';
        finalizeBtn.textContent = isRecording ? 'Finalitzar i Desar' : 'PREM EL RELLOTGE PER COMENÇAR';
        finalizeBtn.removeEventListener('click', closeSessionView);
        finalizeBtn.addEventListener('click', finalizeSession);
        // Ensure finalize button is back in its original container and visible
        const controlsContainer = document.getElementById('controls-container');
        if (controlsContainer && !controlsContainer.contains(finalizeBtn)) {
            controlsContainer.appendChild(finalizeBtn);
        }
        // Mostrar de nuevo el contenedor de controles al salir de la vista de sesión
        if (controlsContainer) controlsContainer.style.display = 'block';
        finalizeBtn.style.display = 'block';
        finalizeBtn.style.margin = '';
        // Restore registration view UI state
        clockContainer.style.display = 'flex';
        try { clockElement.style.display = ''; } catch {}
        renderLaps();
        updateSummary();
        try { updateInstructionText && updateInstructionText(); } catch {}
        try { startClock(); } catch {}
        // Caller decides which view to show next
    };

    const deleteSession = async (sessionKey) => {
        console.debug('[DEBUG] deleteSession invoked', { sessionKey, isViewingSession, currentSessionKey });
        const ok = await showModal({ title: 'Eliminar sessió', message: `Segur que vols eliminar aquesta sessió?`, okText: 'Eliminar', cancelText: 'Cancel·lar', type: 'confirm' });
        console.debug('[DEBUG] deleteSession confirm result', { ok });
        if (ok) {
            localStorage.removeItem(sessionKey);
            console.debug('[DEBUG] deleteSession removed from localStorage', { sessionKey });
            
            // Si estamos viendo esta sesión (incluida la vista embebida en registration-view), cerrarla y mostrar solo sessions-view
            if (isViewingSession && currentSessionKey === sessionKey) {
                console.debug('[DEBUG] deleteSession closing session view and switching to sessions-view');
                try { await closeSessionView(true); } catch (e) { console.debug('[DEBUG] closeSessionView failed', e); }
                // Remover explícitamente la top bar si quedó montada
                try {
                    const tb = document.getElementById('session-top-bar');
                    if (tb) { console.debug('[DEBUG] deleteSession removing session-top-bar'); tb.remove(); }
                } catch {}
                try { sessionsView.style.display = 'block'; } catch {}
                try { registrationView.style.display = 'none'; } catch {}
                updateToggleViewBtnLabel();
                // Normalizar flags de vista
                isReadOnly = false;
                isViewingSession = false;
                currentSessionKey = null;
                try { laps = []; renderLaps(); updateSummary(); } catch {}
            }
            
            // Asegurar: si estamos en registration-view sin isViewingSession pero con la vista de sesión todavía montada
            // forzar también la vista de sesiones (caso reportado por el usuario)
            if (!isViewingSession) {
                console.debug('[DEBUG] deleteSession ensuring sessions-view visible when not isViewingSession');
                // Cerrar vista de sesión si hubiera estado abierta en modo solo lectura
                try { await closeSessionView(true); } catch (e) { console.debug('[DEBUG] closeSessionView (not viewing) failed', e); }
                // Remover explícitamente la top bar si quedó montada
                try {
                    const tb = document.getElementById('session-top-bar');
                    if (tb) { console.debug('[DEBUG] deleteSession removing session-top-bar (not viewing)'); tb.remove(); }
                } catch {}
                try { sessionsView.style.display = 'block'; } catch {}
                try { registrationView.style.display = 'none'; } catch {}
                updateToggleViewBtnLabel();
                // Normalizar flags de vista
                isReadOnly = false;
                isViewingSession = false;
                currentSessionKey = null;
                try { laps = []; renderLaps(); updateSummary(); } catch {}
            }
            
            // Renderizar la lista actualizada
            renderSessions();
            updateToggleViewBtnLabel();
        }
    };

    const shareSession = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (savedLaps) {
            const sessionName = sessionKey.replace(sessionPrefix, '');
            const startDate = new Date(savedLaps[0].time);
            const startDateStr = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:${String(startDate.getSeconds()).padStart(2, '0')}.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

            let totalWorkSeconds = 0;
            let totalRestSeconds = 0;

            let shareText = `Sesión: ${sessionName}\nFecha: ${startDateStr}\nHora inicio: ${startTimeStr}\n\n`;
            // Encabezado (tabulado)
            shareText += `#\tHora\tTipo\tNombre\tDuración` + "\n";

            savedLaps.forEach((lap, index) => {
                const lapTime = new Date(lap.time);
                const lapTimeStr = `${String(lapTime.getHours()).padStart(2, '0')}:${String(lapTime.getMinutes()).padStart(2, '0')}:${String(lapTime.getSeconds()).padStart(2, '0')}.${String(lapTime.getMilliseconds()).padStart(3, '0')}`;
                const lapTypeLabel = lap.type === 'work' ? 'Trabajo' : 'Descanso';
                let line = `${index + 1}\t${lapTimeStr}\t${lapTypeLabel}\t${lap.name}`;
                if (index < savedLaps.length - 1) {
                    const nextTime = new Date(savedLaps[index + 1].time);
                    const duration = (nextTime - lapTime) / 1000;
                    if (lap.type === 'work') totalWorkSeconds += duration; else totalRestSeconds += duration;
                    line += `\t${formatDurationPlain(duration)}`;
                }
                shareText += line + "\n";
            });

            const totalTimeSeconds = totalWorkSeconds + totalRestSeconds;
            shareText += `\nResumen:\n`;
            shareText += `  Trabajo: ${formatDurationPlain(totalWorkSeconds)}\n`;
            shareText += `  Descanso: ${formatDurationPlain(totalRestSeconds)}\n`;
            shareText += `  Total: ${formatDurationPlain(totalTimeSeconds)}\n`;

            if (navigator.share) {
                navigator.share({
                    title: `Sesión: ${sessionName}`,
                    text: shareText,
                }).catch(() => {});
            } else {
                alert("La función de compartir no está disponible en este navegador. Puedes copiar el texto manualmente.");
                prompt("Copia este texto:", shareText);
            }
        }
    };

    const shareSessionCSV = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (!savedLaps) return;
        const sessionName = sessionKey.replace(sessionPrefix, '');
        const startDate = new Date(savedLaps[0].time);
        const startDateStr = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:${String(startDate.getSeconds()).padStart(2, '0')}.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

        let csv = `Sesion,${sessionName}\nFecha,${startDateStr}\nHora inicio,${startTimeStr}\n\n`;
        csv += `#;Hora;Tipo;Nombre;Duracion\n`; // cabecera CSV con ; separador

        let totalWorkSeconds = 0;
        let totalRestSeconds = 0;

        savedLaps.forEach((lap, index) => {
            const lapTime = new Date(lap.time);
            const lapTimeStr = `${String(lapTime.getHours()).padStart(2, '0')}:${String(lapTime.getMinutes()).padStart(2, '0')}:${String(lapTime.getSeconds()).padStart(2, '0')}.${String(lapTime.getMilliseconds()).padStart(3, '0')}`;
            const lapTypeLabel = lap.type === 'work' ? 'Trabajo' : 'Descanso';
            let durationStr = '';
            if (index < savedLaps.length - 1) {
                const nextTime = new Date(savedLaps[index + 1].time);
                const duration = (nextTime - lapTime) / 1000;
                if (lap.type === 'work') totalWorkSeconds += duration; else totalRestSeconds += duration;
                durationStr = formatDurationPlain(duration);
            }
            // Escapar comillas en nombre
            const safeName = String(lap.name).replaceAll('"', '""');
            csv += `${index + 1};${lapTimeStr};${lapTypeLabel};"${safeName}";${durationStr}\n`;
        });

        const totalTimeSeconds = totalWorkSeconds + totalRestSeconds;
        csv += `\nResumen;Trabajo;${formatDurationPlain(totalWorkSeconds)}\n`;
        csv += `Resumen;Descanso;${formatDurationPlain(totalRestSeconds)}\n`;
        csv += `Resumen;Total;${formatDurationPlain(totalTimeSeconds)}\n`;

        if (navigator.share && navigator.canShare && navigator.canShare({ text: csv })) {
            navigator.share({ title: `Sesión CSV: ${sessionName}`, text: csv })
                .catch(() => {});
        } else {
            // Fallback: prompt para copiar
            prompt('Copia el CSV:', csv);
        }
    };

    const shareSessionCSVComma = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (!savedLaps) return;
        const sessionName = sessionKey.replace(sessionPrefix, '');
        const startDate = new Date(savedLaps[0].time);
        const startDateStr = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:${String(startDate.getSeconds()).padStart(2, '0')}.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

        let csv = `Sesion,${sessionName}\nFecha,${startDateStr}\nHora inicio,${startTimeStr}\n\n`;
        csv += `#,Hora,Tipo,Nombre,Duracion\n`; // cabecera CSV con , separador

        let totalWorkSeconds = 0;
        let totalRestSeconds = 0;

        savedLaps.forEach((lap, index) => {
            const lapTime = new Date(lap.time);
            const lapTimeStr = `${String(lapTime.getHours()).padStart(2, '0')}:${String(lapTime.getMinutes()).padStart(2, '0')}:${String(lapTime.getSeconds()).padStart(2, '0')}.${String(lapTime.getMilliseconds()).padStart(3, '0')}`;
            const lapTypeLabel = lap.type === 'work' ? 'Trabajo' : 'Descanso';
            let durationStr = '';
            if (index < savedLaps.length - 1) {
                const nextTime = new Date(savedLaps[index + 1].time);
                const duration = (nextTime - lapTime) / 1000;
                if (lap.type === 'work') totalWorkSeconds += duration; else totalRestSeconds += duration;
                durationStr = formatDurationPlain(duration);
            }
            // Escapar comillas en nombre
            const safeName = String(lap.name).replaceAll('"', '""');
            csv += `${index + 1},${lapTimeStr},${lapTypeLabel},"${safeName}",${durationStr}\n`;
        });

        const totalTimeSeconds = totalWorkSeconds + totalRestSeconds;
        csv += `\nResumen,Trabajo,${formatDurationPlain(totalWorkSeconds)}\n`;
        csv += `Resumen,Descanso,${formatDurationPlain(totalRestSeconds)}\n`;
        csv += `Resumen,Total,${formatDurationPlain(totalTimeSeconds)}\n`;

        if (navigator.share && navigator.canShare && navigator.canShare({ text: csv })) {
            navigator.share({ title: `Sesión CSV (Coma): ${sessionName}`, text: csv })
                .catch(() => {});
        } else {
            // Fallback: prompt para copiar
            prompt('Copia el CSV (Coma):', csv);
        }
    };

    // --- PWA: Service Worker + Install prompt ---
    (function setupPWA(){
        try {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('sw.js', { scope: './' })
                        .then((reg) => {
                            console.debug('[DEBUG] SW registrado');
                            // Detectar updates del SW
                            if (reg.waiting) {
                                showUpdateToast(reg.waiting);
                            }
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                if (!newWorker) return;
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        showUpdateToast(newWorker);
                                    }
                                });
                            });
                            navigator.serviceWorker.addEventListener('controllerchange', () => {
                                // Recargar cuando el nuevo SW tome control
                                window.location.reload();
                            });
                        })
                        .catch((e) => console.debug('[DEBUG] SW error', e));
                });
            }
        } catch {}
        // beforeinstallprompt
        try {
            let deferredPrompt = null;
            const installBtn = document.getElementById('install-btn');
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                if (installBtn) installBtn.style.display = 'flex';
            });
            if (installBtn) installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                installBtn.disabled = true;
                try {
                    const result = await deferredPrompt.prompt();
                    console.debug('[DEBUG] A2HS', result.outcome);
                } catch {}
                installBtn.style.display = 'none';
                deferredPrompt = null;
            });
        } catch {}
    })();

    // Toast simple para avisos (instalación/actualización)
    function showToast(message, actions = []) {
        try {
            let toast = document.getElementById('pwa-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'pwa-toast';
                toast.style.position = 'fixed';
                toast.style.bottom = '16px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.background = '#222';
                toast.style.color = '#fff';
                toast.style.padding = '10px 14px';
                toast.style.borderRadius = '8px';
                toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
                toast.style.zIndex = '2000';
                toast.style.display = 'flex';
                toast.style.gap = '8px';
                toast.style.alignItems = 'center';
                document.body.appendChild(toast);
            }
            toast.innerHTML = '';
            const msg = document.createElement('span');
            msg.textContent = message;
            toast.appendChild(msg);
            actions.forEach(({ label, onClick, variant }) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.border = '1px solid #0d6efd';
                btn.style.background = variant === 'secondary' ? 'transparent' : '#0d6efd';
                btn.style.color = '#fff';
                btn.style.padding = '4px 8px';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', () => { try { onClick && onClick(); } catch {} });
                toast.appendChild(btn);
            });
            setTimeout(() => { try { toast.remove(); } catch {} }, 8000);
        } catch {}
    }

    function showUpdateToast(worker) {
        showToast('Nueva versión disponible', [
            { label: 'Actualizar', onClick: () => { try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch {} } },
            { label: 'Cerrar', onClick: () => {}, variant: 'secondary' }
        ]);
        try {
            navigator.serviceWorker.addEventListener('message', (e) => {
                // No-op; controllerchange recargará
            });
        } catch {}
    }

    // --- Inicialització ---
    // Create app title if it doesn't exist
    let appTitle = document.getElementById('app-title');
    if (!appTitle) {
        appTitle = document.createElement('div');
        appTitle.id = 'app-title';
        appTitle.textContent = 'LAPS';
        document.body.appendChild(appTitle);
    }

    // Set initial icon+label for registration view (go to list)
    toggleViewBtn.innerHTML = `${disketteIcon} <span class=\"toggle-label\">LLISTAT</span>`;
    toggleViewBtn.setAttribute('role', 'button');
    toggleViewBtn.setAttribute('tabindex', '0');
    toggleViewBtn.setAttribute('aria-label', 'Canviar a vista de sessions');
    toggleViewBtn.addEventListener('click', toggleView);
    toggleViewBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleView();
        }
    });
    clockContainer.addEventListener('click', addLap);
    clockContainer.setAttribute('role', 'button');
    clockContainer.setAttribute('tabindex', '0');
    clockContainer.setAttribute('aria-label', 'Rellotge, prem per marcar volta o començar');
    clockContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            addLap();
        }
    });
    finalizeBtn.addEventListener('click', finalizeSession);
    startClock();
    renderSessions();

    // --- Wake Lock Integration ---
    const wakeLockManager = new WakeLockManager();
    const wakeToggle = document.getElementById('wake-toggle');
    const wakeIndicator = document.getElementById('wake-indicator');
    const wakeLabel = document.getElementById('wake-label');
    const WAKE_LOCK_PREF_KEY = 'wakeLockEnabled';

    // Función para actualizar el estado visual del switch
    function updateWakeLockUI(isActive) {
        const toggle = wakeIndicator?.querySelector('span');
        if (!toggle) return;
        
        if (isActive) {
            wakeToggle.setAttribute('aria-checked', 'true');
            wakeIndicator.style.background = '#0d6efd';
            toggle.style.transform = 'translateX(14px)';
            toggle.style.background = '#fff';
            if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} BLOQ.`;
        } else {
            wakeToggle.setAttribute('aria-checked', 'false');
            wakeIndicator.style.background = '#666';
            toggle.style.transform = 'translateX(0)';
            toggle.style.background = '#bbb';
            if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} LIBRE`;
        }
    }

    // Cargar preferencia guardada
    async function loadWakeLockPreference() {
        try {
            const saved = localStorage.getItem(WAKE_LOCK_PREF_KEY);
            if (saved === 'true' && wakeLockManager.isSupported) {
                const success = await wakeLockManager.request();
                updateWakeLockUI(success);
            }
        } catch (err) {
            console.error('[WakeLock] Error cargando preferencia:', err);
        }
    }

    // Toggle Wake Lock
    async function toggleWakeLock() {
        if (!wakeLockManager.isSupported) {
            console.warn('[WakeLock] No soportado');
            return;
        }

        try {
            if (wakeLockManager.isActive()) {
                await wakeLockManager.release();
                localStorage.setItem(WAKE_LOCK_PREF_KEY, 'false');
                updateWakeLockUI(false);
            } else {
                const success = await wakeLockManager.request();
                localStorage.setItem(WAKE_LOCK_PREF_KEY, success ? 'true' : 'false');
                updateWakeLockUI(success);
            }
        } catch (err) {
            console.error('[WakeLock] Error en toggle:', err);
            updateWakeLockUI(false);
        }
    }

    // Event listeners para el switch
    if (wakeToggle) {
        wakeToggle.addEventListener('click', toggleWakeLock);
        wakeToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleWakeLock();
            }
        });

        // Ocultar si no está soportado
        if (!wakeLockManager.isSupported) {
            wakeToggle.style.display = 'none';
        }
    }

    // Inicializar Wake Lock
    // Establecer texto inicial por defecto
    if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} LIBRE`;
    loadWakeLockPreference();

    // Ocultar vista de sessions a l'inici
    sessionsView.style.display = 'none';
    registrationView.style.display = 'block';

    // Actualitzar text del botó finalitzar
    finalizeBtn.textContent = 'PREM EL RELLOTGE PER COMENÇAR';

    // Clear and rebuild clock container
    clockContainer.innerHTML = '';

    // Modify timeContainer styles
    const timeContainer = document.createElement('div');
    timeContainer.style.display = 'flex';
    timeContainer.style.alignItems = 'center';
    timeContainer.style.width = '100%';
    timeContainer.style.justifyContent = 'space-between';
    timeContainer.style.padding = '0 20px';

    const playIconSpan = document.createElement('span');
    playIconSpan.innerHTML = playIcon;
    playIconSpan.style.display = 'flex';
    playIconSpan.style.alignItems = 'center';
    playIconSpan.style.flexShrink = '0';

    clockElement.style.fontSize = '5rem';
    clockElement.style.flex = '1';
    clockElement.style.textAlign = 'center';
    clockElement.style.margin = '0 20px';
    clockElement.style.fontFamily = '"Arial Narrow", Arial, sans-serif';
    clockElement.style.letterSpacing = '-0.05em';

    timeContainer.appendChild(playIconSpan);
    timeContainer.appendChild(clockElement);
    clockContainer.appendChild(timeContainer);

    // Update clockElement styles
    clockElement.style.fontSize = 'min(18vw, 5rem)';  // Larger responsive font
    clockElement.style.lineHeight = '1';
    clockElement.style.fontWeight = 'bold';
    clockElement.style.letterSpacing = '-0.02em';

    // Add instruction text
    const instructionText = document.createElement('div');
    instructionText.textContent = 'PREM AQUÍ PER COMENÇAR A REGISTRAR UNA SESSIÓ';
    instructionText.style.fontSize = '0.8em';
    instructionText.style.opacity = '0.7';
    instructionText.style.marginTop = '10px';
    clockContainer.appendChild(instructionText);

    // Afegir estils al clock container
    // Fondo por defecto (no en grabación)
    clockContainer.style.backgroundColor = '#2E7D32';
    clockContainer.style.cursor = 'pointer';
    clockContainer.style.padding = '20px';
    clockContainer.style.borderRadius = '8px';
    clockContainer.style.transition = 'background-color 0.2s ease';

    // Desactivar cambios de fondo por hover para no interferir con grabación
    try { clockContainer.addEventListener && clockContainer.addEventListener('mouseover', () => {}); } catch {}
    try { clockContainer.addEventListener && clockContainer.addEventListener('mouseout', () => {}); } catch {}

    // In the initialization section, modify summary container texts
    const summaryContainer = document.getElementById('summary-container');
    const summaryLabels = [
        { icon: workIcon, text: 'Treball' },
        { icon: restIcon, text: 'Descans' },
        { icon: totalIcon, text: 'Total' }
    ];
    
    summaryLabels.forEach((label, index) => {
        const span = summaryContainer.querySelector(`.summary-item:nth-child(${index + 1}) span`);
        span.innerHTML = `${label.icon} ${label.text}`;
        span.style.display = 'flex';
        span.style.alignItems = 'center';
        span.style.gap = '5px';
    });

    // Clock container styles (estado base verde)
    clockContainer.style.backgroundColor = '#2E7D32';
    clockContainer.style.display = 'flex';
    clockContainer.style.flexDirection = 'column';
    clockContainer.style.alignItems = 'center';
    clockContainer.style.justifyContent = 'center';
    clockContainer.style.padding = '20px';
    clockContainer.style.borderRadius = '8px';
    clockContainer.style.cursor = 'pointer';
    clockContainer.style.transition = 'background-color 0.2s ease';
    clockContainer.style.maxWidth = '100%';  // Add max-width
    clockContainer.style.width = '100%';     // Add width
    clockContainer.style.boxSizing = 'border-box'; // Ensure padding is included in width
});
