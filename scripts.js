const appVersion = '3.0.0'; // Versión desde manifest.json
const appDateVersion = '2026-03-31'; // Versión desde manifest.json

// Función principal de inicialización
function initApp() {
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
        recordingName: 'SessióSenseNom',
        lapsOrderDescending: true, // true = descendente (más nueva arriba), false = ascendente

        // Configuración
        settings: {
            showRepetitions: true,  // Por defecto habilitado
            goToSessionsAfterFinalize: true,  // Por defecto ir al listado después de finalizar
            isLocked: false,  // Por defecto desbloqueado
            volumeButtonsEnabled: false,  // Por defecto desactivado (botones de volumen para marcar vueltas)
            csvExportAsFile: false  // Por defecto exportar como texto (false = texto, true = archivo)
        },

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

            // Import/Export
            importSessionsBtn: document.getElementById('import-sessions-btn'),
            exportSessionsBtn: document.getElementById('export-sessions-btn'),

            // Header
            toggleViewBtn: document.getElementById('toggle-view-btn'),
            wakeToggle: document.getElementById('wake-toggle'),
            wakeIndicator: document.getElementById('wake-indicator'),
            wakeLabel: document.getElementById('wake-label'),
        };

        // Aplicar estilo inicial al botón finalizar
        try {
            if (appState.dom.finalizeBtn) {
                appState.dom.finalizeBtn.style.height = 'auto';
            }
        } catch { }
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
    let lapsOrderDescending = appState.lapsOrderDescending;
    const sessionPrefix = appState.SESSION_PREFIX;
    const ACTIVE_RECORDING_KEY = 'voltes_active_recording';

    // Debug temporal: verificar dimensiones del contenedor de vueltas
    setTimeout(() => {
        if (lapsContainer) {
            const rect = lapsContainer.getBoundingClientRect();
            const styles = window.getComputedStyle(lapsContainer);
        }
    }, 1000);

    // Estado para modo multiselección
    let isMultiSelectMode = false;
    let selectedSessions = new Set(); // Set de session keys seleccionadas
    let finalizeViewHandler = appState.finalizeViewHandler;
    let exitConfirmationInProgress = false;

    // =======================
    // FUNCIONES DE CONFIGURACIÓN
    // =======================

    const loadSettings = () => {
        try {
            const saved = localStorage.getItem('voltes_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                appState.settings.showRepetitions = settings.showRepetitions !== undefined ? settings.showRepetitions : true;
                appState.settings.goToSessionsAfterFinalize = settings.goToSessionsAfterFinalize !== undefined ? settings.goToSessionsAfterFinalize : true;
                appState.settings.isLocked = settings.isLocked !== undefined ? settings.isLocked : false;
                appState.settings.volumeButtonsEnabled = settings.volumeButtonsEnabled !== undefined ? settings.volumeButtonsEnabled : false;
                appState.settings.csvExportAsFile = settings.csvExportAsFile !== undefined ? settings.csvExportAsFile : false;
            }
        } catch (e) {
            console.warn('Error cargando configuración:', e);
            appState.settings.showRepetitions = true;
            appState.settings.goToSessionsAfterFinalize = true;
            appState.settings.isLocked = false;
            appState.settings.volumeButtonsEnabled = false;
            appState.settings.csvExportAsFile = false;
        }
    };

    const saveSettings = () => {
        try {
            localStorage.setItem('voltes_settings', JSON.stringify(appState.settings));
        } catch (e) {
            console.warn('Error guardando configuración:', e);
        }
    };

    const toggleLock = () => {
        appState.settings.isLocked = !appState.settings.isLocked;
        saveSettings();

        // Actualizar UI del botón de bloqueo
        const lockBtn = document.getElementById('lock-btn');
        const lockLabel = document.getElementById('lock-label');
        const lockToggle = document.getElementById('lock-toggle');

        if (lockBtn && lockLabel && lockToggle) {
            lockBtn.innerHTML = appState.settings.isLocked ? lockIcon : unlockIcon;
            lockLabel.textContent = appState.settings.isLocked ? 'BLOCAT' : 'OBERT';
            lockBtn.style.color = appState.settings.isLocked ? '#dc3545' : '#28a745';
            lockLabel.style.color = appState.settings.isLocked ? '#dc3545' : '#28a745';
            lockToggle.style.borderColor = appState.settings.isLocked ? '#dc3545' : '#28a745';
        }

        // Aplicar el estado de bloqueo a todos los botones
        applyLockState();
    };

    const applyLockState = () => {
        const isLocked = appState.settings.isLocked;

        // Selector para todos los botones excepto el de bloqueo
        const selectors = [
            '#clock-container',
            '#finalize-btn',
            '#delete-all-btn',
            '#toggle-view-btn',
            '.wake-lock-toggle',
            '.lap-delete-btn',
            '.lap-type-toggle',
            'button[id^="edit-time-btn"]',
            '.repetition-button',
            '.add-repetition-btn',
            '.add-rep-after-btn',
            'button[id^="rep-edit-time-btn"]',
            'button[id^="rep-type-toggle"]',
            '.repetition-delete-btn',
            '.lap-name',
            '.repetition-name',
            '#recording-name-input',
            '#session-save-btn',
            '#session-delete-btn',
            '#session-share-btn'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (isLocked) {
                    el.style.pointerEvents = 'none';
                    el.style.opacity = '0.5';
                    if (el.tagName === 'INPUT') {
                        el.disabled = true;
                    }
                } else {
                    el.style.pointerEvents = '';
                    el.style.opacity = '';
                    if (el.tagName === 'INPUT') {
                        el.disabled = false;
                    }
                }
            });
        });

        // Añadir overlay visual si está bloqueado
        let lockOverlay = document.getElementById('lock-overlay');
        if (isLocked && !lockOverlay) {
            lockOverlay = document.createElement('div');
            lockOverlay.id = 'lock-overlay';
            lockOverlay.style.position = 'fixed';
            lockOverlay.style.top = '0';
            lockOverlay.style.left = '0';
            lockOverlay.style.width = '100%';
            lockOverlay.style.height = '100%';
            lockOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
            lockOverlay.style.pointerEvents = 'none';
            lockOverlay.style.zIndex = '999';
            lockOverlay.style.display = 'flex';
            lockOverlay.style.alignItems = 'center';
            lockOverlay.style.justifyContent = 'center';
            lockOverlay.innerHTML = '<div style="background: rgba(220, 53, 69, 0.9); color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 1.2rem;">🔒 PANTALLA BLOCADA</div>';
            document.body.appendChild(lockOverlay);
        } else if (!isLocked && lockOverlay) {
            lockOverlay.remove();
        }
    };

    const disketteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="black" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>`;
    const stopwatchIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 7V12H17M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const stopwatchIconColor = `<svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <!-- Botón superior -->
        <circle cx="256" cy="60" r="40" fill="#e0e0e0" stroke="#999" stroke-width="8"/>
        <rect x="236" y="60" width="40" height="80" fill="#5f7684" rx="8"/>
        
        <!-- Botones laterales -->
        <path d="M 120 180 L 80 140 L 140 120 L 160 180 Z" fill="#5f7684"/>
        <path d="M 392 180 L 432 140 L 372 120 L 352 180 Z" fill="#5f7684"/>
        
        <!-- Cuerpo del cronómetro -->
        <circle cx="256" cy="300" r="180" fill="#5f7684" stroke="#3d4f5c" stroke-width="12"/>
        <circle cx="256" cy="300" r="150" fill="#f0f0f0" stroke="#ddd" stroke-width="8"/>
        
        <!-- Marcas de hora -->
        <rect x="250" y="160" width="12" height="30" fill="#2c3e50"/>
        <rect x="380" y="294" width="30" height="12" fill="#2c3e50"/>
        <rect x="250" y="410" width="12" height="30" fill="#2c3e50"/>
        <rect x="138" y="294" width="30" height="12" fill="#2c3e50"/>
        
        <!-- Marcas secundarias -->
        <rect x="325" y="195" width="8" height="20" fill="#2c3e50" transform="rotate(45 329 205)"/>
        <rect x="355" y="225" width="8" height="20" fill="#2c3e50" transform="rotate(65 359 235)"/>
        <rect x="355" y="365" width="8" height="20" fill="#2c3e50" transform="rotate(-65 359 375)"/>
        <rect x="325" y="395" width="8" height="20" fill="#2c3e50" transform="rotate(-45 329 405)"/>
        <rect x="179" y="195" width="8" height="20" fill="#2c3e50" transform="rotate(-45 183 205)"/>
        <rect x="149" y="225" width="8" height="20" fill="#2c3e50" transform="rotate(-65 153 235)"/>
        <rect x="149" y="365" width="8" height="20" fill="#2c3e50" transform="rotate(65 153 375)"/>
        <rect x="179" y="395" width="8" height="20" fill="#2c3e50" transform="rotate(45 183 405)"/>
        
        <!-- Sector rojo (cuarto de círculo) -->
        <path d="M 256 300 L 256 150 A 150 150 0 0 1 406 300 Z" fill="#ff6b6b" opacity="0.8"/>
        
        <!-- Manecillas -->
        <line x1="256" y1="300" x2="256" y2="180" stroke="#2c3e50" stroke-width="8" stroke-linecap="round"/>
        <line x1="256" y1="300" x2="340" y2="360" stroke="#2c3e50" stroke-width="10" stroke-linecap="round"/>
        
        <!-- Centro -->
        <circle cx="256" cy="300" r="20" fill="#2c3e50"/>
    </svg>`;
    const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" stroke-width="3" stroke="#f0f0f0" fill="none">
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
    const clockIcon = `<svg width="28" height="28" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <!-- Botón superior -->
        <circle cx="256" cy="60" r="40" fill="#e0e0e0" stroke="#999" stroke-width="8"/>
        <rect x="236" y="60" width="40" height="80" fill="#5f7684" rx="8"/>
        
        <!-- Botones laterales -->
        <path d="M 120 180 L 80 140 L 140 120 L 160 180 Z" fill="#5f7684"/>
        <path d="M 392 180 L 432 140 L 372 120 L 352 180 Z" fill="#5f7684"/>
        
        <!-- Cuerpo del cronómetro -->
        <circle cx="256" cy="300" r="180" fill="#5f7684" stroke="#3d4f5c" stroke-width="12"/>
        <circle cx="256" cy="300" r="150" fill="#f0f0f0" stroke="#ddd" stroke-width="8"/>
        
        <!-- Marcas de hora -->
        <rect x="250" y="160" width="12" height="30" fill="#2c3e50"/>
        <rect x="380" y="294" width="30" height="12" fill="#2c3e50"/>
        <rect x="250" y="410" width="12" height="30" fill="#2c3e50"/>
        <rect x="138" y="294" width="30" height="12" fill="#2c3e50"/>
        
        <!-- Marcas secundarias -->
        <rect x="325" y="195" width="8" height="20" fill="#2c3e50" transform="rotate(45 329 205)"/>
        <rect x="355" y="225" width="8" height="20" fill="#2c3e50" transform="rotate(65 359 235)"/>
        <rect x="355" y="365" width="8" height="20" fill="#2c3e50" transform="rotate(-65 359 375)"/>
        <rect x="325" y="395" width="8" height="20" fill="#2c3e50" transform="rotate(-45 329 405)"/>
        <rect x="179" y="195" width="8" height="20" fill="#2c3e50" transform="rotate(-45 183 205)"/>
        <rect x="149" y="225" width="8" height="20" fill="#2c3e50" transform="rotate(-65 153 235)"/>
        <rect x="149" y="365" width="8" height="20" fill="#2c3e50" transform="rotate(65 153 375)"/>
        <rect x="179" y="395" width="8" height="20" fill="#2c3e50" transform="rotate(45 183 405)"/>
        
        <!-- Sector rojo (cuarto de círculo) -->
        <path d="M 256 300 L 256 150 A 150 150 0 0 1 406 300 Z" fill="#ff6b6b" opacity="0.8"/>
        
        <!-- Manecillas -->
        <line x1="256" y1="300" x2="256" y2="180" stroke="#2c3e50" stroke-width="8" stroke-linecap="round"/>
        <line x1="256" y1="300" x2="340" y2="360" stroke="#2c3e50" stroke-width="10" stroke-linecap="round"/>
        
        <!-- Centro -->
        <circle cx="256" cy="300" r="20" fill="#2c3e50"/>
    </svg>`;
    const shareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
    const editTimeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const xIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const screenIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const unlockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

    // --- WakeLockManager Class ---
    class WakeLockManager {
        constructor() {
            this.wakeLock = null;
            this.isCordova = !!window.cordova;
            this._isActive = false;

            // Detectar soporte según el entorno
            if (this.isCordova) {
                // En Cordova, verificar si existe el plugin insomnia
                this.isSupported = !!(window.plugins && window.plugins.insomnia);
            } else {
                // En Web, usar Wake Lock API
                this.isSupported = 'wakeLock' in navigator;

                // Gestión de visibilitychange para re-adquirir el wake lock (solo Web)
                if (this.isSupported) {
                    document.addEventListener('visibilitychange', async () => {
                        if (document.visibilityState === 'visible' && this.wakeLock !== null) {
                            await this.request();
                        }
                    });
                }
            }
        }

        async request() {
            if (!this.isSupported) {
                return false;
            }

            try {
                if (this.isCordova) {
                    // Cordova: Usar plugin insomnia
                    if (window.plugins && window.plugins.insomnia) {
                        window.plugins.insomnia.keepAwake();
                        this._isActive = true;
                        return true;
                    }
                    return false;
                } else {
                    // Web: Usar Wake Lock API
                    this.wakeLock = await navigator.wakeLock.request('screen');
                    this._isActive = true;
                    return true;
                }
            } catch (err) {
                this.wakeLock = null;
                this._isActive = false;
                return false;
            }
        }

        async release() {
            try {
                if (this.isCordova) {
                    // Cordova: Liberar insomnia
                    if (window.plugins && window.plugins.insomnia) {
                        window.plugins.insomnia.allowSleepAgain();
                        this._isActive = false;
                        return true;
                    }
                    return false;
                } else {
                    // Web: Liberar Wake Lock
                    if (this.wakeLock !== null) {
                        await this.wakeLock.release();
                        this.wakeLock = null;
                        this._isActive = false;
                        return true;
                    }
                    return true;
                }
            } catch (err) {
                return false;
            }
        }

        isActive() {
            if (this.isCordova) {
                return this._isActive;
            } else {
                return this.wakeLock !== null && !this.wakeLock.released;
            }
        }
    }

    // --- Modal util ---
    const showModal = ({ id = '', title = '', message = '', okText = 'Aceptar', cancelText = 'Cancelar', type = 'confirm', defaultValue = '', okButtonStyle = '', cancelButtonStyle = '', buttonLayout = 'column', reverseButtons = false } = {}) => {
        return new Promise((resolve) => {
            try {
                // Create modal overlay
                const overlay = createContainer({
                    className: 'modal-overlay',
                    direction: 'column',
                    justify: 'flex-start',
                    align: 'center',
                    backgroundColor: 'rgba(0,0,0,0.75)', // Más oscuro para mejor visibilidad
                    padding: '20px'
                });

                Object.assign(overlay.style, {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100vw',
                    height: '100vh',
                    zIndex: '9999',
                    backdropFilter: 'blur(4px)', // Más blur para mejor efecto
                    padding: '60px 20px 20px 20px', // Padding con margen superior
                    boxSizing: 'border-box'
                });

                // Create modal content
                const modal = createContainer({
                    className: 'modal',
                    direction: 'column',
                    justify: 'center',
                    align: 'center',
                    backgroundColor: 'var(--card-bg-color)',
                    borderRadius: '12px',
                    padding: '4px', // Padding base del modal
                    gap: '2px' // Gap base entre elementos
                });

                Object.assign(modal.style, {
                    border: '1px solid var(--accent-color)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    textAlign: 'center',
                    maxWidth: '500px', // Aumentar el ancho máximo
                    width: '95vw', // Ajustar al ancho de la pantalla
                    maxWidth: 'min(500px, 95vw)', // Máximo 500px pero no más del 95% del viewport
                    maxHeight: 'calc(100vh - 140px)', // Altura máxima para evitar que ocupe toda la pantalla
                    overflowY: 'auto', // Scroll si el contenido es muy largo
                    transform: 'scale(0.96)',
                    opacity: '0',
                    transition: 'transform 120ms ease-out, opacity 120ms ease-out',
                    fontSize: '1.1rem', // Aumentar el tamaño de fuente base del modal
                    boxSizing: 'border-box',
                    margin: '0 auto' // Centrar horizontalmente
                });

                // Detectar si es el modal de GUARDAR SESSIÓ o un modal de confirmación simple
                const normalizedTitle = String(title || '').toUpperCase();
                const isSaveSessionModal = /GUARDAR\s+SESSI(Ó|O)/.test(normalizedTitle);

                // Para el modal de GUARDAR SESSIÓ, ocupar todo el alto disponible
                if (isSaveSessionModal) {
                    // Overlay sin padding para que el modal ocupe todo el espacio
                    overlay.style.padding = '0';
                    overlay.style.alignItems = 'stretch';
                    overlay.style.justifyContent = 'stretch';
                    // Modal ocupa toda la altura disponible
                    modal.style.width = '100vw';
                    modal.style.maxWidth = '100vw';
                    modal.style.height = '100vh';
                    modal.style.maxHeight = '100vh';
                    modal.style.borderRadius = '0';
                    modal.style.padding = '20px';
                    modal.style.gap = '334px';
                    modal.style.margin = '0';
                }

                modal.setAttribute('role', type === 'alert' ? 'alertdialog' : 'dialog');
                modal.setAttribute('aria-modal', 'true');

                // Añadir identificador al modal si se proporciona
                if (id) {
                    modal.setAttribute('id', id);
                    modal.setAttribute('data-modal-id', id);
                }

                // Add title
                if (title) {
                    const titleEl = createTextSpan({
                        text: title,
                        fontSize: '1.3rem', // Tamaño del título más reducido
                        fontWeight: '700'
                    });
                    titleEl.id = `${id}-title`;
                    modal.appendChild(titleEl);
                }

                // Add message
                if (message) {
                    const messageEl = createTextSpan({
                        text: message,
                        fontSize: '1rem' // Tamaño del mensaje más reducido
                    });
                    messageEl.id = `${id}-message`;
                    // Si el mensaje contiene HTML (como <br>), usar innerHTML en lugar de textContent
                    if (message.includes('<br>') || message.includes('<')) {
                        messageEl.innerHTML = message;
                    }
                    Object.assign(messageEl.style, {
                        color: '#fff',
                        lineHeight: '1.3',
                        marginBottom: '0px' // Sin espacio
                    });
                    modal.appendChild(messageEl);
                }


                // Add input for prompt type
                let inputEl = null;
                if (type === 'prompt') {
                    inputEl = createInput({
                        value: defaultValue || '',
                        placeholder: 'Introduir nom de sessió...'
                    });
                    inputEl.id = `${id}-input`;
                    // High contrast input: white background, black text, larger font
                    inputEl.style.fontSize = '1.2rem'; // Tamaño de texto más reducido
                    inputEl.style.padding = '8px 12px'; // Padding más reducido
                    inputEl.style.width = '100%';
                    inputEl.style.boxSizing = 'border-box';
                    inputEl.style.border = '2px solid #333'; // Borde más fino
                    inputEl.style.backgroundColor = '#fff'; // Fondo blanco
                    inputEl.style.borderRadius = '6px';
                    inputEl.style.marginBottom = '4px'; // Margin más reducido
                    inputEl.style.color = '#000'; // Texto negro
                    inputEl.style.fontWeight = '600'; // Texto grueso
                    inputEl.style.textShadow = 'none'; // Sin sombra de texto

                    // Para el modal de GUARDAR SESSIÓ, hacer el input más bajo sin cambiar el tamaño de texto
                    if (isSaveSessionModal) {
                        inputEl.style.padding = '4px 10px';
                        inputEl.style.marginBottom = '2px';
                    }

                    modal.appendChild(inputEl);
                    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 0);
                }
                const isDeleteSessionModal = id === 'modal-delete-session-confirm' || id === 'modal-delete-lap-confirm';
                const isHorizontalLayout = buttonLayout === 'horizontal' || isDeleteSessionModal;

                // Create buttons container - columna para GUARDAR SESSIÓ, fila para otros
                const buttonsContainer = createContainer({
                    direction: isHorizontalLayout ? 'row' : 'column',
                    justify: 'center',
                    // Reducimos el espacio vertical entre botones, y aún más para el modal de guardar sesión
                    gap: isSaveSessionModal ? '1.5px' : '6px'
                });
                buttonsContainer.id = `${id}-buttons-container`;
                buttonsContainer.className = 'modal-buttons';
                buttonsContainer.style.width = '100%';

                // Create buttons for non-alert types
                let okBtn = null;
                if (type !== 'alert') {
                    if (isHorizontalLayout) {
                        // Para modal horizontal: orden según reverseButtons
                        // Por defecto: CANCEL.LAR (izq) - CONFIRMAR (der)
                        // reverseButtons: CONFIRMAR (izq) - CANCEL.LAR (der)

                        const cancelBtn = createButton({
                            text: cancelText,
                            icon: xIcon,
                            variant: 'danger',
                            size: 'large',
                            onClick: () => {
                                cleanup();
                                resolve(type === 'prompt' ? null : false);
                            }
                        });
                        cancelBtn.id = `${id}-cancel-btn`;
                        cancelBtn.className = 'modal-delete-session-cancel-btn';
                        cancelBtn.style.fontSize = '1.2rem';
                        cancelBtn.style.padding = '5px 5px';
                        cancelBtn.style.flex = '1';
                        if (cancelBtn.querySelector('svg')) {
                            cancelBtn.querySelector('svg').style.width = '24px';
                            cancelBtn.querySelector('svg').style.height = '12px';
                        }
                        // Aplicar estilo personalizado si se proporciona
                        if (cancelButtonStyle) {
                            cancelBtn.style.cssText += cancelButtonStyle;
                        }

                        okBtn = createButton({
                            text: okText,
                            icon: checkIcon,
                            variant: 'success',
                            size: 'large',
                            onClick: () => {
                                cleanup();
                                resolve(type === 'prompt' ? inputEl?.value : true);
                            }
                        });
                        okBtn.id = `${id}-ok-btn`;
                        okBtn.className = 'modal-delete-session-ok-btn';
                        okBtn.style.fontSize = '1.2rem';
                        okBtn.style.padding = '5px 5px';
                        okBtn.style.flex = '1';
                        if (okBtn.querySelector('svg')) {
                            okBtn.querySelector('svg').style.width = '24px';
                            okBtn.querySelector('svg').style.height = '24px';
                        }
                        // Aplicar estilo personalizado si se proporciona
                        if (okButtonStyle) {
                            okBtn.style.cssText += okButtonStyle;
                        }

                        // Añadir botones en el orden correcto
                        if (reverseButtons) {
                            buttonsContainer.appendChild(okBtn);
                            buttonsContainer.appendChild(cancelBtn);
                        } else {
                            buttonsContainer.appendChild(cancelBtn);
                            buttonsContainer.appendChild(okBtn);
                        }
                    } else {
                        // Para modal de guardar sesión: orden vertical OK - CONTINUAR - CANCEL
                        okBtn = createButton({
                            text: isSaveSessionModal ? ' \nGUARDAR SESSIÓ' : okText,
                            icon: checkIcon,
                            variant: 'success',
                            size: 'large',
                            onClick: () => {
                                cleanup();
                                resolve(type === 'prompt' ? inputEl?.value : true);
                            }
                        });
                        okBtn.id = `${id}-ok-btn`;
                        okBtn.style.width = '100%';
                        okBtn.style.fontSize = '0.95rem';
                        okBtn.style.lineHeight = '1.1';
                        okBtn.style.padding = isSaveSessionModal ? '1px 10px' : '8px 16px';
                        okBtn.style.position = 'relative';
                        okBtn.style.zIndex = '10';
                        okBtn.style.cursor = 'pointer';
                        if (okBtn.querySelector('svg')) {
                            okBtn.querySelector('svg').style.width = '18px';
                            okBtn.querySelector('svg').style.height = '18px';
                        }
                        buttonsContainer.appendChild(okBtn);

                        // Continue button (middle) - only for GUARDAR SESSIÓ modal
                        if (isSaveSessionModal) {
                            const continueBtn = createButton({
                                text: ' \nCONTINUAR GRAVACIÓ',
                                icon: clockIcon,
                                variant: 'info',
                                size: 'large',
                                onClick: () => {
                                    cleanup();
                                    // Retornar objeto con el nombre y la acción
                                    resolve({
                                        action: '__CONTINUE_RECORDING__',
                                        name: inputEl?.value || 'SessióSenseNom'
                                    });
                                }
                            });
                            continueBtn.id = `${id}-continue-btn`;
                            continueBtn.style.width = '100%';
                            continueBtn.style.fontSize = '0.95rem';
                            continueBtn.style.lineHeight = '1.1';
                            continueBtn.style.padding = '1px 10px';
                            if (continueBtn.querySelector('svg')) {
                                continueBtn.querySelector('svg').style.width = '18px';
                                continueBtn.querySelector('svg').style.height = '18px';
                            }
                            buttonsContainer.appendChild(continueBtn);
                        }

                        // Cancel button (bottom)
                        const cancelBtn = createButton({
                            text: isSaveSessionModal ? 'CANCEL.LAR GRAVACIÓ' : cancelText,
                            icon: xIcon,
                            variant: 'danger',
                            size: 'large',
                            onClick: () => {
                                cleanup();
                                resolve(isSaveSessionModal ? '__NEW_RECORDING__' : false);
                            }
                        });
                        cancelBtn.id = `${id}-cancel-btn`;
                        cancelBtn.style.width = '100%';
                        cancelBtn.style.fontSize = '0.95rem';
                        cancelBtn.style.lineHeight = '1.1';
                        cancelBtn.style.padding = isSaveSessionModal ? '1px 10px' : '8px 16px';
                        if (cancelBtn.querySelector('svg')) {
                            cancelBtn.querySelector('svg').style.width = '18px';
                            cancelBtn.querySelector('svg').style.height = '18px';
                        }
                        buttonsContainer.appendChild(cancelBtn);
                    }
                } else {
                    // Alert type keeps a single centered OK button
                    okBtn = createButton({
                        text: okText,
                        icon: '',
                        variant: 'primary',
                        size: 'large', // Usar botones más grandes
                        onClick: () => {
                            cleanup();
                            resolve(true);
                        }
                    });
                    okBtn.id = `${id}-ok-btn`;
                    okBtn.style.fontSize = '1.2rem'; // Texto más grande
                    okBtn.style.padding = '16px 20px'; // Padding más grande
                    buttonsContainer.style.justifyContent = 'center';
                    buttonsContainer.appendChild(okBtn);
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
                    if (e.key === 'Enter' && type === 'prompt' && inputEl) {
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

    // Función para mostrar modal de edición de tiempo con spinwheels
    const showEditTimeModal = (currentTime, lapIndex, allLaps) => {
        return new Promise((resolve) => {
            try {
                // Parsear el tiempo actual
                const hours = currentTime.getHours();
                const minutes = currentTime.getMinutes();
                const seconds = currentTime.getSeconds();
                const milliseconds = currentTime.getMilliseconds();

                // Obtener tiempos de vueltas anterior y posterior para validación
                const previousLapTime = lapIndex > 0 ? allLaps[lapIndex - 1].time : null;
                const nextLapTime = lapIndex < allLaps.length - 1 ? allLaps[lapIndex + 1].time : null;

                // Crear overlay
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0,0,0,0.75);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    box-sizing: border-box;
                    backdrop-filter: blur(4px);
                `;

                // Crear modal
                const modal = document.createElement('div');
                modal.style.cssText = `
                    background: var(--card-bg-color);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 95vw;
                    border: 1px solid var(--accent-color);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                `;

                // Título
                const title = document.createElement('h2');
                title.textContent = 'EDITAR TEMPS';
                title.style.cssText = `
                    margin: 0;
                    color: var(--primary-color);
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-align: center;
                `;

                // Mostrar tiempo actual formateado
                const currentTimeContainer = document.createElement('div');
                currentTimeContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 10px;
                    background: rgba(0,170,255,0.1);
                    border-radius: 8px;
                    border: 1px solid var(--accent-color);
                `;

                const currentTimeLabel = document.createElement('div');
                currentTimeLabel.textContent = 'VALOR ACTUAL:';
                currentTimeLabel.style.cssText = `
                    color: white;
                    font-size: 1.2rem;
                    font-weight: 700;
                `;

                const currentTimeDisplay = document.createElement('div');
                currentTimeDisplay.style.cssText = `
                    font-size: 2.5rem;
                    color: var(--accent-color);
                    font-weight: 600;
                `;
                // Formatear el tiempo manualmente para evitar HTML escapado
                const h = String(hours).padStart(2, '0');
                const m = String(minutes).padStart(2, '0');
                const s = String(seconds).padStart(2, '0');
                const ms = String(milliseconds).padStart(3, '0');
                currentTimeDisplay.textContent = `${h}:${m}:${s}.${ms}`;

                currentTimeContainer.appendChild(currentTimeLabel);
                currentTimeContainer.appendChild(currentTimeDisplay);

                // Variable para callback de validación
                let validationCallback = null;

                // Crear función para crear spinwheel
                const createSpinwheel = (label, value, max, digits = 2) => {
                    const container = document.createElement('div');
                    container.style.cssText = `
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                        flex: 1;
                    `;

                    const labelEl = document.createElement('label');
                    labelEl.textContent = label;
                    labelEl.style.cssText = `
                        color: white;
                        font-size: 1.2rem;
                        font-weight: 700;
                    `;

                    const spinContainer = document.createElement('div');
                    spinContainer.style.cssText = `
                        position: relative;
                        width: 100%;
                        height: 150px;
                        overflow: hidden;
                        border: 2px solid var(--accent-color);
                        border-radius: 8px;
                        background: #1a1a1a;
                    `;

                    // Indicador central
                    const indicator = document.createElement('div');
                    indicator.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 0;
                        right: 0;
                        height: 50px;
                        transform: translateY(-50%);
                        background: rgba(0,170,255,0.2);
                        border-top: 2px solid var(--accent-color);
                        border-bottom: 2px solid var(--accent-color);
                        pointer-events: none;
                        z-index: 1;
                    `;

                    const itemsContainer = document.createElement('div');
                    itemsContainer.style.cssText = `
                        position: absolute;
                        width: 100%;
                        transition: transform 0.3s ease;
                    `;

                    // Crear opciones (añadir opciones antes y después para efecto circular)
                    const items = [];
                    for (let i = 0; i <= max; i++) {
                        const item = document.createElement('div');
                        item.textContent = String(i).padStart(digits, '0');
                        item.dataset.value = i;
                        item.style.cssText = `
                            height: 50px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: var(--secondary-color);
                            font-size: 1.8rem;
                            font-weight: 600;
                            cursor: pointer;
                            user-select: none;
                        `;
                        items.push(item);
                        itemsContainer.appendChild(item);
                    }

                    let currentValue = value;
                    let startY = 0;
                    let startTransform = 0;

                    const updatePosition = (value) => {
                        currentValue = Math.max(0, Math.min(max, value));
                        const translateY = 50 - (currentValue * 50);
                        itemsContainer.style.transform = `translateY(${translateY}px)`;

                        // Actualizar estilos de items
                        items.forEach((item, idx) => {
                            if (idx === currentValue) {
                                item.style.color = 'white';
                                item.style.fontSize = '2rem';
                            } else {
                                item.style.color = 'var(--secondary-color)';
                                item.style.fontSize = '1.8rem';
                            }
                        });

                        // Llamar al callback de validación si existe
                        if (validationCallback) {
                            validationCallback();
                        }
                    };

                    // Touch events
                    spinContainer.addEventListener('touchstart', (e) => {
                        startY = e.touches[0].clientY;
                        const transform = itemsContainer.style.transform;
                        startTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        itemsContainer.style.transition = 'none';
                    });

                    spinContainer.addEventListener('touchmove', (e) => {
                        e.preventDefault();
                        const deltaY = e.touches[0].clientY - startY;
                        const newTransform = startTransform + deltaY;
                        itemsContainer.style.transform = `translateY(${newTransform}px)`;
                    });

                    spinContainer.addEventListener('touchend', (e) => {
                        itemsContainer.style.transition = 'transform 0.3s ease';
                        const transform = itemsContainer.style.transform;
                        const currentTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        const newValue = Math.round((50 - currentTransform) / 50);
                        updatePosition(newValue);
                    });

                    // Mouse events
                    let isDragging = false;
                    spinContainer.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        startY = e.clientY;
                        const transform = itemsContainer.style.transform;
                        startTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        itemsContainer.style.transition = 'none';
                    });

                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        e.preventDefault();
                        const deltaY = e.clientY - startY;
                        const newTransform = startTransform + deltaY;
                        itemsContainer.style.transform = `translateY(${newTransform}px)`;
                    });

                    document.addEventListener('mouseup', () => {
                        if (!isDragging) return;
                        isDragging = false;
                        itemsContainer.style.transition = 'transform 0.3s ease';
                        const transform = itemsContainer.style.transform;
                        const currentTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        const newValue = Math.round((50 - currentTransform) / 50);
                        updatePosition(newValue);
                    });

                    // Click en items
                    items.forEach((item, idx) => {
                        item.addEventListener('click', () => {
                            updatePosition(idx);
                        });
                    });

                    updatePosition(value);

                    spinContainer.appendChild(indicator);
                    spinContainer.appendChild(itemsContainer);
                    container.appendChild(labelEl);
                    container.appendChild(spinContainer);

                    return { container, getValue: () => currentValue };
                };

                // Crear spinwheels
                const spinwheelsContainer = document.createElement('div');
                spinwheelsContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                `;

                const hourSpinner = createSpinwheel('HH', hours, 23, 2);
                const minuteSpinner = createSpinwheel('MM', minutes, 59, 2);
                const secondSpinner = createSpinwheel('SS', seconds, 59, 2);

                // Declarar validateBtn aquí para que sea accesible en validateTime
                let validateBtn;

                // Función para crear separador ":"
                const createSeparator = () => {
                    const sep = document.createElement('div');
                    sep.textContent = ':';
                    sep.style.cssText = `
                        color: white;
                        font-size: 3rem;
                        font-weight: 700;
                        padding-top: 35px;
                    `;
                    return sep;
                };

                spinwheelsContainer.appendChild(hourSpinner.container);
                spinwheelsContainer.appendChild(createSeparator());
                spinwheelsContainer.appendChild(minuteSpinner.container);
                spinwheelsContainer.appendChild(createSeparator());
                spinwheelsContainer.appendChild(secondSpinner.container);

                // Mensaje de validación (inicialmente oculto)
                const validationMessage = document.createElement('div');
                validationMessage.style.cssText = `
                    display: none;
                    color: #f44336;
                    background: rgba(244, 67, 54, 0.1);
                    border: 2px solid #f44336;
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 15px;
                    text-align: center;
                    font-size: 1.1rem;
                    font-weight: 700;
                `;

                // Función de validación
                const validateTime = () => {
                    const selectedTime = new Date(currentTime);
                    selectedTime.setHours(hourSpinner.getValue());
                    selectedTime.setMinutes(minuteSpinner.getValue());
                    selectedTime.setSeconds(secondSpinner.getValue());
                    selectedTime.setMilliseconds(0);

                    let isValid = true;
                    let errorMsg = '';

                    // Verificar con vuelta anterior
                    if (previousLapTime) {
                        const prevTime = (previousLapTime instanceof Date) ? previousLapTime : new Date(previousLapTime);
                        if (selectedTime <= prevTime) {
                            isValid = false;
                            errorMsg = 'SELECCIÓ INVÀLIDA, es solapa amb la volta anterior';
                        }
                    }

                    // Verificar con vuelta posterior
                    if (isValid && nextLapTime) {
                        const nextTime = (nextLapTime instanceof Date) ? nextLapTime : new Date(nextLapTime);
                        if (selectedTime >= nextTime) {
                            isValid = false;
                            errorMsg = 'SELECCIÓ INVÀLIDA, es solapa amb la volta posterior';
                        }
                    }

                    // Actualizar UI según validación
                    if (isValid) {
                        validationMessage.style.display = 'none';
                        if (validateBtn) {
                            validateBtn.disabled = false;
                            validateBtn.style.opacity = '1';
                            validateBtn.style.cursor = 'pointer';
                        }
                    } else {
                        validationMessage.textContent = errorMsg;
                        validationMessage.style.display = 'block';
                        if (validateBtn) {
                            validateBtn.disabled = true;
                            validateBtn.style.opacity = '0.5';
                            validateBtn.style.cursor = 'not-allowed';
                        }
                    }

                    return isValid;
                };

                // Asignar callback de validación
                validationCallback = validateTime;

                // Botones
                const buttonsContainer = document.createElement('div');
                buttonsContainer.style.cssText = `
                    display: flex;
                    gap: 16px;
                    margin-top: 10px;
                `;

                // Botón CANCELAR (izquierda, rojo, X)
                const cancelBtn = document.createElement('button');
                cancelBtn.innerHTML = `${xIcon} CANCELAR`;
                cancelBtn.style.cssText = `
                    flex: 1;
                    padding: 16px 20px;
                    font-size: 1.2rem;
                    font-weight: 700;
                    border-radius: 8px;
                    border: 1px solid #f44336;
                    background: #f44336;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                `;
                cancelBtn.addEventListener('mouseover', () => {
                    cancelBtn.style.background = '#d32f2f';
                });
                cancelBtn.addEventListener('mouseout', () => {
                    cancelBtn.style.background = '#f44336';
                });
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(null);
                });

                // Botón VALIDAR (derecha, verde, CHECK)
                validateBtn = document.createElement('button');
                validateBtn.innerHTML = `${checkIcon} VALIDAR`;
                validateBtn.style.cssText = `
                    flex: 1;
                    padding: 16px 20px;
                    font-size: 1.2rem;
                    font-weight: 700;
                    border-radius: 8px;
                    border: 1px solid #4CAF50;
                    background: #4CAF50;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                `;
                validateBtn.addEventListener('mouseover', () => {
                    if (!validateBtn.disabled) {
                        validateBtn.style.background = '#45a049';
                    }
                });
                validateBtn.addEventListener('mouseout', () => {
                    if (!validateBtn.disabled) {
                        validateBtn.style.background = '#4CAF50';
                    }
                });
                validateBtn.addEventListener('click', () => {
                    if (validateTime()) {
                        const newTime = new Date(currentTime);
                        newTime.setHours(hourSpinner.getValue());
                        newTime.setMinutes(minuteSpinner.getValue());
                        newTime.setSeconds(secondSpinner.getValue());
                        newTime.setMilliseconds(0); // Siempre poner milisegundos a 000
                        cleanup();
                        resolve(newTime);
                    }
                });

                buttonsContainer.appendChild(cancelBtn);
                buttonsContainer.appendChild(validateBtn);

                // Ensamblar modal
                modal.appendChild(title);
                modal.appendChild(currentTimeContainer);
                modal.appendChild(spinwheelsContainer);
                modal.appendChild(validationMessage);
                modal.appendChild(buttonsContainer);
                overlay.appendChild(modal);

                // Realizar validación inicial
                validateTime();

                // Manejar ESC
                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        cleanup();
                        resolve(null);
                    }
                };

                // Función de limpieza
                const cleanup = () => {
                    document.removeEventListener('keydown', onKey);
                    overlay.remove();
                    document.body.style.overflow = originalOverflow;
                };

                document.addEventListener('keydown', onKey);

                const originalOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                document.body.appendChild(overlay);

            } catch (err) {
                resolve(null);
            }
        });
    };

    // Función para mostrar modal de añadir vuelta entre dos existentes
    const showAddLapBetweenModal = (previousLapTime, nextLapTime, isLastLap = false) => {
        return new Promise((resolve) => {
            try {
                // Calcular un tiempo inicial en el medio de las dos vueltas
                const prevTime = (previousLapTime instanceof Date) ? previousLapTime : new Date(previousLapTime);
                const nextTime = (nextLapTime instanceof Date) ? nextLapTime : new Date(nextLapTime);

                // Si es la última vuelta, usar la misma hora que la anterior como inicial
                const middleTime = isLastLap ? new Date(prevTime.getTime()) : new Date((prevTime.getTime() + nextTime.getTime()) / 2);

                const hours = middleTime.getHours();
                const minutes = middleTime.getMinutes();
                const seconds = middleTime.getSeconds();

                // Crear overlay
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0,0,0,0.75);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    box-sizing: border-box;
                    backdrop-filter: blur(4px);
                `;

                // Crear modal
                const modal = document.createElement('div');
                modal.style.cssText = `
                    background: var(--card-bg-color);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 95vw;
                    border: 1px solid var(--accent-color);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                `;

                // Título
                const title = document.createElement('h2');
                title.textContent = 'AFEGIR VOLTA';
                title.style.cssText = `
                    margin: 0;
                    color: var(--primary-color);
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-align: center;
                `;

                // Mostrar tiempos de referencia
                const referenceContainer = document.createElement('div');
                referenceContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 10px;
                    background: rgba(0,170,255,0.1);
                    border-radius: 8px;
                    border: 1px solid var(--accent-color);
                `;

                const prevTimeContainer = document.createElement('div');
                prevTimeContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                `;

                const prevLabel = document.createElement('div');
                prevLabel.textContent = 'VOLTA ANTERIOR:';
                prevLabel.style.cssText = `
                    color: white;
                    font-size: 1.1rem;
                    font-weight: 700;
                `;

                const prevTimeDisplay = document.createElement('div');
                prevTimeDisplay.style.cssText = `
                    font-size: 1.5rem;
                    color: var(--accent-color);
                    font-weight: 600;
                `;
                const prevH = String(prevTime.getHours()).padStart(2, '0');
                const prevM = String(prevTime.getMinutes()).padStart(2, '0');
                const prevS = String(prevTime.getSeconds()).padStart(2, '0');
                const prevMs = String(prevTime.getMilliseconds()).padStart(3, '0');
                prevTimeDisplay.textContent = `${prevH}:${prevM}:${prevS}.${prevMs}`;

                prevTimeContainer.appendChild(prevLabel);
                prevTimeContainer.appendChild(prevTimeDisplay);

                referenceContainer.appendChild(prevTimeContainer);

                // Solo mostrar la volta posterior si NO es la última vuelta
                if (!isLastLap) {
                    const nextTimeContainer = document.createElement('div');
                    nextTimeContainer.style.cssText = `
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    `;

                    const nextLabel = document.createElement('div');
                    nextLabel.textContent = 'VOLTA POSTERIOR:';
                    nextLabel.style.cssText = `
                        color: white;
                        font-size: 1.1rem;
                        font-weight: 700;
                    `;

                    const nextTimeDisplay = document.createElement('div');
                    nextTimeDisplay.style.cssText = `
                        font-size: 1.5rem;
                        color: var(--accent-color);
                        font-weight: 600;
                    `;
                    const nextH = String(nextTime.getHours()).padStart(2, '0');
                    const nextM = String(nextTime.getMinutes()).padStart(2, '0');
                    const nextS = String(nextTime.getSeconds()).padStart(2, '0');
                    const nextMs = String(nextTime.getMilliseconds()).padStart(3, '0');
                    nextTimeDisplay.textContent = `${nextH}:${nextM}:${nextS}.${nextMs}`;

                    nextTimeContainer.appendChild(nextLabel);
                    nextTimeContainer.appendChild(nextTimeDisplay);

                    referenceContainer.appendChild(nextTimeContainer);
                }

                // Variable para callback de validación
                let validationCallback = null;

                // Crear función para crear spinwheel (misma que en showEditTimeModal)
                const createSpinwheel = (label, value, max, digits = 2) => {
                    const container = document.createElement('div');
                    container.style.cssText = `
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                        flex: 1;
                    `;

                    const labelEl = document.createElement('label');
                    labelEl.textContent = label;
                    labelEl.style.cssText = `
                        color: white;
                        font-size: 1.2rem;
                        font-weight: 700;
                    `;

                    const spinContainer = document.createElement('div');
                    spinContainer.style.cssText = `
                        position: relative;
                        width: 100%;
                        height: 150px;
                        overflow: hidden;
                        border: 2px solid var(--accent-color);
                        border-radius: 8px;
                        background: #1a1a1a;
                    `;

                    // Indicador central
                    const indicator = document.createElement('div');
                    indicator.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 0;
                        right: 0;
                        height: 50px;
                        transform: translateY(-50%);
                        background: rgba(0,170,255,0.2);
                        border-top: 2px solid var(--accent-color);
                        border-bottom: 2px solid var(--accent-color);
                        pointer-events: none;
                        z-index: 1;
                    `;

                    const itemsContainer = document.createElement('div');
                    itemsContainer.style.cssText = `
                        position: absolute;
                        width: 100%;
                        transition: transform 0.3s ease;
                    `;

                    // Crear opciones
                    const items = [];
                    for (let i = 0; i <= max; i++) {
                        const item = document.createElement('div');
                        item.textContent = String(i).padStart(digits, '0');
                        item.dataset.value = i;
                        item.style.cssText = `
                            height: 50px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: var(--secondary-color);
                            font-size: 1.8rem;
                            font-weight: 600;
                            cursor: pointer;
                            user-select: none;
                        `;
                        items.push(item);
                        itemsContainer.appendChild(item);
                    }

                    let currentValue = value;
                    let startY = 0;
                    let startTransform = 0;

                    const updatePosition = (value) => {
                        currentValue = Math.max(0, Math.min(max, value));
                        const translateY = 50 - (currentValue * 50);
                        itemsContainer.style.transform = `translateY(${translateY}px)`;

                        // Actualizar estilos de items
                        items.forEach((item, idx) => {
                            if (idx === currentValue) {
                                item.style.color = 'white';
                                item.style.fontSize = '2rem';
                            } else {
                                item.style.color = 'var(--secondary-color)';
                                item.style.fontSize = '1.8rem';
                            }
                        });

                        // Llamar al callback de validación si existe
                        if (validationCallback) {
                            validationCallback();
                        }
                    };

                    // Touch events
                    spinContainer.addEventListener('touchstart', (e) => {
                        startY = e.touches[0].clientY;
                        const transform = itemsContainer.style.transform;
                        startTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        itemsContainer.style.transition = 'none';
                    });

                    spinContainer.addEventListener('touchmove', (e) => {
                        e.preventDefault();
                        const deltaY = e.touches[0].clientY - startY;
                        const newTransform = startTransform + deltaY;
                        itemsContainer.style.transform = `translateY(${newTransform}px)`;
                    });

                    spinContainer.addEventListener('touchend', (e) => {
                        itemsContainer.style.transition = 'transform 0.3s ease';
                        const transform = itemsContainer.style.transform;
                        const currentTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        const newValue = Math.round((50 - currentTransform) / 50);
                        updatePosition(newValue);
                    });

                    // Mouse events
                    let isDragging = false;
                    spinContainer.addEventListener('mousedown', (e) => {
                        isDragging = true;
                        startY = e.clientY;
                        const transform = itemsContainer.style.transform;
                        startTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        itemsContainer.style.transition = 'none';
                    });

                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        e.preventDefault();
                        const deltaY = e.clientY - startY;
                        const newTransform = startTransform + deltaY;
                        itemsContainer.style.transform = `translateY(${newTransform}px)`;
                    });

                    document.addEventListener('mouseup', () => {
                        if (!isDragging) return;
                        isDragging = false;
                        itemsContainer.style.transition = 'transform 0.3s ease';
                        const transform = itemsContainer.style.transform;
                        const currentTransform = transform ? parseInt(transform.match(/-?\d+/)[0]) : 0;
                        const newValue = Math.round((50 - currentTransform) / 50);
                        updatePosition(newValue);
                    });

                    // Click en items
                    items.forEach((item, idx) => {
                        item.addEventListener('click', () => {
                            updatePosition(idx);
                        });
                    });

                    updatePosition(value);

                    spinContainer.appendChild(indicator);
                    spinContainer.appendChild(itemsContainer);
                    container.appendChild(labelEl);
                    container.appendChild(spinContainer);

                    return { container, getValue: () => currentValue };
                };

                // Crear spinwheels
                const spinwheelsContainer = document.createElement('div');
                spinwheelsContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                `;

                const hourSpinner = createSpinwheel('HH', hours, 23, 2);
                const minuteSpinner = createSpinwheel('MM', minutes, 59, 2);
                const secondSpinner = createSpinwheel('SS', seconds, 59, 2);

                // Declarar validateBtn aquí
                let validateBtn;

                // Función para crear separador ":"
                const createSeparator = () => {
                    const sep = document.createElement('div');
                    sep.textContent = ':';
                    sep.style.cssText = `
                        color: white;
                        font-size: 3rem;
                        font-weight: 700;
                        padding-top: 35px;
                    `;
                    return sep;
                };

                spinwheelsContainer.appendChild(hourSpinner.container);
                spinwheelsContainer.appendChild(createSeparator());
                spinwheelsContainer.appendChild(minuteSpinner.container);
                spinwheelsContainer.appendChild(createSeparator());
                spinwheelsContainer.appendChild(secondSpinner.container);

                // Mensaje de validación
                const validationMessage = document.createElement('div');
                validationMessage.style.cssText = `
                    display: none;
                    color: #f44336;
                    background: rgba(244, 67, 54, 0.1);
                    border: 2px solid #f44336;
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 15px;
                    text-align: center;
                    font-size: 1.1rem;
                    font-weight: 700;
                `;

                // Función de validación
                const validateTime = () => {
                    const selectedTime = new Date(middleTime);
                    selectedTime.setHours(hourSpinner.getValue());
                    selectedTime.setMinutes(minuteSpinner.getValue());
                    selectedTime.setSeconds(secondSpinner.getValue());
                    selectedTime.setMilliseconds(0);

                    let isValid = true;
                    let errorMsg = '';

                    // Verificar que sea posterior a la vuelta anterior
                    if (selectedTime <= prevTime) {
                        isValid = false;
                        errorMsg = 'SELECCIÓ INVÀLIDA, ha de ser posterior a la volta anterior';
                    }
                    // Solo verificar límite superior si NO es la última vuelta
                    else if (!isLastLap && selectedTime >= nextTime) {
                        isValid = false;
                        errorMsg = 'SELECCIÓ INVÀLIDA, ha de ser anterior a la volta posterior';
                    }

                    // Actualizar UI según validación
                    if (isValid) {
                        validationMessage.style.display = 'none';
                        if (validateBtn) {
                            validateBtn.disabled = false;
                            validateBtn.style.opacity = '1';
                            validateBtn.style.cursor = 'pointer';
                        }
                    } else {
                        validationMessage.textContent = errorMsg;
                        validationMessage.style.display = 'block';
                        if (validateBtn) {
                            validateBtn.disabled = true;
                            validateBtn.style.opacity = '0.5';
                            validateBtn.style.cursor = 'not-allowed';
                        }
                    }

                    return isValid;
                };

                // Asignar callback de validación
                validationCallback = validateTime;

                // Botones
                const buttonsContainer = document.createElement('div');
                buttonsContainer.style.cssText = `
                    display: flex;
                    gap: 16px;
                    margin-top: 10px;
                `;

                // Botón CANCELAR
                const cancelBtn = document.createElement('button');
                cancelBtn.innerHTML = `${xIcon} CANCELAR`;
                cancelBtn.style.cssText = `
                    flex: 1;
                    padding: 16px 20px;
                    font-size: 1.2rem;
                    font-weight: 700;
                    border-radius: 8px;
                    border: 1px solid #f44336;
                    background: #f44336;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                `;
                cancelBtn.addEventListener('mouseover', () => {
                    cancelBtn.style.background = '#d32f2f';
                });
                cancelBtn.addEventListener('mouseout', () => {
                    cancelBtn.style.background = '#f44336';
                });
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(null);
                });

                // Botón AFEGIR
                validateBtn = document.createElement('button');
                validateBtn.innerHTML = `${checkIcon} AFEGIR`;
                validateBtn.style.cssText = `
                    flex: 1;
                    padding: 16px 20px;
                    font-size: 1.2rem;
                    font-weight: 700;
                    border-radius: 8px;
                    border: 1px solid #4CAF50;
                    background: #4CAF50;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                `;
                validateBtn.addEventListener('mouseover', () => {
                    if (!validateBtn.disabled) {
                        validateBtn.style.background = '#45a049';
                    }
                });
                validateBtn.addEventListener('mouseout', () => {
                    if (!validateBtn.disabled) {
                        validateBtn.style.background = '#4CAF50';
                    }
                });
                validateBtn.addEventListener('click', () => {
                    if (validateTime()) {
                        const newTime = new Date(middleTime);
                        newTime.setHours(hourSpinner.getValue());
                        newTime.setMinutes(minuteSpinner.getValue());
                        newTime.setSeconds(secondSpinner.getValue());
                        newTime.setMilliseconds(0);
                        cleanup();
                        resolve(newTime);
                    }
                });

                buttonsContainer.appendChild(cancelBtn);
                buttonsContainer.appendChild(validateBtn);

                // Ensamblar modal
                modal.appendChild(title);
                modal.appendChild(referenceContainer);
                modal.appendChild(spinwheelsContainer);
                modal.appendChild(validationMessage);
                modal.appendChild(buttonsContainer);
                overlay.appendChild(modal);

                // Realizar validación inicial
                validateTime();

                // Manejar ESC
                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        cleanup();
                        resolve(null);
                    }
                };

                // Función de limpieza
                const cleanup = () => {
                    document.removeEventListener('keydown', onKey);
                    overlay.remove();
                    document.body.style.overflow = originalOverflow;
                };

                document.addEventListener('keydown', onKey);

                const originalOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                document.body.appendChild(overlay);

            } catch (err) {
                resolve(null);
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

        // Set content with icon next to text (horizontal)
        if (icon && text) {
            btn.innerHTML = `${icon} ${text}`;
            btn.style.flexDirection = 'row';
            btn.style.gap = '4px';
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
            gap: '4px',
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
                border: '1px solid #dc3545',
                backgroundColor: '#dc3545',
                color: '#fff'
            },
            success: {
                border: '1px solid #28a745',
                backgroundColor: '#28a745',
                color: '#fff'
            },
            info: {
                border: '1px solid #0d6efd',
                backgroundColor: '#0d6efd',
                color: '#fff'
            }
        };

        const sizeStyles = {
            small: { padding: '6px 10px', fontSize: '0.9rem' },
            medium: { padding: '8px 16px', fontSize: '1rem' },
            large: { padding: '8px 16px', fontSize: '1.05rem' }
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
        input.style.border = '3px solid #666';
        input.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
        input.style.color = '#fff';
        input.style.borderRadius = '8px';
        input.style.padding = '12px 16px';
        input.style.fontSize = '1.1rem';
        input.style.fontFamily = 'inherit';
        input.style.fontWeight = '600';
        input.style.transition = 'all 0.2s ease';
        input.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';

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

    // Backward compatibility aliases - definidas aquí para que estén disponibles antes de su uso
    const formatTime = (date) => formatTimeDuration(date, { type: 'time', showMs: true, msSize: '0.5em' });
    const formatDuration = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.5em', fallback: '0:00:00.000' });
    const formatDurationCompact = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, compact: true, fallback: '0:00.000' });
    const formatDurationHTML = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.25em', fallback: '0:00:00<span style="font-size:0.25em; vertical-align: super">.000</span>' });
    const formatSummaryDurationHTML = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '0.5em', fallback: '0:00:00<span style="font-size:0.5em; vertical-align: super">.000</span>' });
    const formatDurationHTMLFull = (seconds) => formatTimeDuration(seconds, { type: 'duration', showMs: true, msSize: '1em', fallback: '0:00:00.000' });

    // Function to format session name timestamp (yyyy-mm-dd_hh-mm-ss)
    const formatSessionName = (date) => {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    };

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

    // Guardar el estado de la grabación en curso para poder reanudarla
    const persistActiveRecordingState = () => {
        try {
            if (!isRecording || laps.length === 0) {
                localStorage.removeItem(ACTIVE_RECORDING_KEY);
                return;
            }

            const payload = {
                laps: laps.map(lap => ({
                    ...lap,
                    time: lap.time instanceof Date ? lap.time.toISOString() : lap.time
                })),
                recordingName: recordingName || 'SessióSenseNom',
                savedAt: new Date().toISOString()
            };

            localStorage.setItem(ACTIVE_RECORDING_KEY, JSON.stringify(payload));
        } catch (err) {
            console.warn('No s\'ha pogut guardar la sessió activa:', err);
        }
    };

    // Eliminar el estado persistido de la grabación
    const clearActiveRecordingState = () => {
        try {
            localStorage.removeItem(ACTIVE_RECORDING_KEY);
        } catch (err) {
        }
    };

    // Rehidratar la grabación activa si existe en localStorage
    const restoreActiveRecordingState = () => {
        try {
            const saved = localStorage.getItem(ACTIVE_RECORDING_KEY);
            if (!saved) return false;

            const parsed = JSON.parse(saved);
            if (!parsed || !Array.isArray(parsed.laps) || parsed.laps.length === 0) return false;

            laps = parsed.laps.map(lap => ({
                ...lap,
                time: new Date(lap.time)
            }));
            appState.laps = laps; // Sincronizar con appState

            recordingName = parsed.recordingName || 'SessióSenseNom';
            appState.recordingName = recordingName; // Sincronizar con appState

            isRecording = true;
            appState.isRecording = true; // Sincronizar con appState

            // Ajustar UI para modo grabación
            finalizeBtn.textContent = 'FINALITZAR SESSIÓ';
            clockContainer.style.backgroundColor = '#2E7D32';
            clockContainer.style.color = '#ffffff';
            clockElement.style.color = '#ffffff';
            mountRecordingNameRow();
            updateRecordingNameRow();
            renderLaps();
            updateSummary();

            if (laps.length >= 2) {
                startLastLapUpdate();
            }

            try { startClock(); } catch { }
            updateInstructionText();
            return true;
        } catch (err) {
            console.warn('No s\'ha pogut restaurar la sessió activa:', err);
            return false;
        }
    };
    const resetAppState = () => {
        // Limpiar estado de la aplicación
        laps = [];
        appState.laps = laps; // Sincronizar con appState
        isRecording = false;
        appState.isRecording = false; // Sincronizar con appState
        recordingName = 'SessióSenseNom';
        appState.recordingName = recordingName; // Sincronizar con appState
        sessionDirty = false;
        appState.sessionDirty = false; // Sincronizar con appState
        pendingRename = null;
        clearActiveRecordingState();

        // Detener actualizaciones
        stopLastLapUpdate();
        stopClock();

        // Limpiar contenedores de la interfaz
        clearElement(lapsContainer);

        // Limpiar contenedores de resumen
        totalWorkElement.textContent = '0:00:00.000';
        totalRestElement.textContent = '0:00:00.000';
        totalTimeElement.textContent = '0:00:00.000';

        // Remover elementos dinámicos
        unmountRecordingNameRow();

        // Remover cualquier información de sesión si existe
        const sessionInfo = document.getElementById('session-info');
        if (sessionInfo) sessionInfo.remove();

        const sessionNameRow = document.getElementById('session-name-row');
        if (sessionNameRow) sessionNameRow.remove();

        // Remover barras superiores si existen
        const sessionTopBar = document.getElementById('session-top-bar');
        if (sessionTopBar) sessionTopBar.remove();

        // Resetear márgenes de registration view
        registrationView.style.marginTop = '0';

        // Asegurar que la vista de registro esté activa
        sessionsView.style.display = 'none';
        registrationView.style.display = 'flex';

        // Resetear botón toggle
        toggleViewBtn.innerHTML = `${disketteIcon} <span class="toggle-label">LLISTAT</span>`;
        toggleViewBtn.setAttribute('aria-label', 'Canviar a vista de sessions');

        // Resetear botón finalizar
        finalizeBtn.textContent = 'PREM EL RELLOTGE PER COMENÇAR';
        finalizeBtn.style.position = 'static';
        finalizeBtn.style.display = '';
        finalizeBtn.style.alignItems = '';
        finalizeBtn.style.justifyContent = '';
        finalizeBtn.style.height = 'auto';
        finalizeBtn.style.borderRadius = '';
        finalizeBtn.style.border = '';
        finalizeBtn.style.backgroundColor = '';
        finalizeBtn.style.color = '';
        finalizeBtn.style.fontWeight = '';
        finalizeBtn.style.cursor = '';
        finalizeBtn.style.transition = '';
        finalizeBtn.style.textTransform = '';

        // Asegurar que el botón finalize esté en su contenedor correcto
        const controlsContainer = document.getElementById('controls-container');
        if (controlsContainer && !controlsContainer.contains(finalizeBtn)) {
            controlsContainer.appendChild(finalizeBtn);
        }
        if (controlsContainer) controlsContainer.style.display = 'block';

        // Resetear estilos del clock container
        clockContainer.style.backgroundColor = '#2E7D32';
        clockContainer.style.color = '#ffffff';
        clockElement.style.color = '#ffffff';
        clockContainer.style.display = 'flex';

        // Actualizar texto de instrucciones
        updateInstructionText();

        // Reiniciar el reloj
        startClock();

        // Renderizar elementos actualizados
    };

    const parseSessionKey = (fullKey) => {
        const fileName = fullKey.replace(sessionPrefix, ''); // yyyy-mm-dd_hh-mi-ss_name.txt o name.txt
        const dot = fileName.lastIndexOf('.');

        if (dot === -1) {
            return {
                fileName,
                timestamp: null,
                dateStr: null,
                timeStr: null,
                name: fileName
            };
        }

        const name = fileName.slice(0, dot);
        const ext = fileName.slice(dot + 1);

        // Verificar si el nombre contiene el patrón de timestamp (19 caracteres: yyyy-mm-dd_hh-mm-ss)
        const timestampPattern = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/;

        if (timestampPattern.test(name)) {
            // Tiene timestamp completo: yyyy-mm-dd_hh-mm-ss_name
            const timestamp = name.slice(0, 19); // 19 chars: yyyy-mm-dd_hh-mm-ss
            const userName = name.slice(20);    // Todo después del timestamp + "_"
            const [dateStr, timeStr] = timestamp.split('_');
            return { fileName, timestamp, dateStr, timeStr: timeStr.replaceAll('-', ':'), name: userName };
        } else {
            // Solo nombre personalizado (sin timestamp)
            return {
                fileName,
                timestamp: null,
                dateStr: null,
                timeStr: null,
                name: name
            };
        }
    };

    const renameSession = (oldKey, newName) => {
        try {
            const data = localStorage.getItem(oldKey);
            if (data == null) return null;
            const parsedInfo = parseSessionKey(oldKey);

            // Si la sesión original tiene timestamp, mantenerlo para el nuevo nombre
            // Si no tiene timestamp (nombre personalizado), no añadir timestamp
            let newFileName;
            if (parsedInfo.timestamp) {
                newFileName = `${parsedInfo.timestamp}_${newName}.txt`;
            } else {
                newFileName = `${newName}.txt`;
            }

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
            // Use modal for error
            showModal({ title: 'Error', message: 'Error en reanomenar la sessió.', type: 'alert', okText: 'Tancar' });
            return null;
        }
    };

    // Omple l’alçada del viewport sota #app-title; tot el desplaçament vertical del llistat és dins #sessions-list
    const applySessionsViewLayout = () => {
        if (!sessionsView || !sessionsContainer || !sessionsList) { return; }
        sessionsView.style.setProperty('display', 'flex', 'important');
        sessionsView.style.flexDirection = 'column';
        sessionsView.style.flex = '1 1 0%';
        sessionsView.style.minHeight = '0';
        sessionsView.style.height = '0';
        sessionsView.style.removeProperty('overflow-y');

        sessionsContainer.style.display = 'flex';
        sessionsContainer.style.flexDirection = 'column';
        sessionsContainer.style.flex = '1 1 0%';
        sessionsContainer.style.minHeight = '0';
        sessionsContainer.style.height = '0';
        sessionsContainer.style.removeProperty('overflow-y');

        sessionsList.style.display = 'flex';
        sessionsList.style.flexDirection = 'column';
        sessionsList.style.flex = '1 1 0%';
        sessionsList.style.minHeight = '0';
        sessionsList.style.height = '0';
        sessionsList.style.overflowY = 'auto';
        sessionsList.style.removeProperty('max-height');
    };

    // --- Lògica de vistes ---

    const toggleView = async () => {
        if (isRecording && !isReadOnly) {
            await showModal({ title: 'ATENCIÓ', message: 'Finalitza la sessió actual abans de veure les sessions desades.', type: 'alert', okText: 'D’acord' });
            return;
        }

        if (isViewingSession) {
            // Si estamos viendo una sesión guardada, ir directamente al listado
            await closeSessionView(false);
            registrationView.style.display = 'none';
            applySessionsViewLayout();
            updateToggleViewBtnLabel();
            applySessionsHeaderMultiselectUI();
            renderSessions();
        } else if (isReadOnly) {
            // En mode lectura, tancar vista de sessió amb confirmació i anar a sessions
            await closeSessionView(false);
            registrationView.style.display = 'none';
            applySessionsViewLayout();
            updateToggleViewBtnLabel();
            applySessionsHeaderMultiselectUI();
            renderSessions();
        } else {
            const isSessionsView = (() => {
                try {
                    const disp = (typeof getComputedStyle === 'function') ? getComputedStyle(sessionsView).display : sessionsView.style.display;
                    return disp !== 'none';
                } catch { return sessionsView.style.display !== 'none'; }
            })();
            if (isSessionsView) {
                if (isMultiSelectMode) {
                    selectedSessions.clear();
                    isMultiSelectMode = false;
                    applySessionsHeaderMultiselectUI();
                }
                sessionsView.style.display = 'none';
                registrationView.style.display = 'flex';
                clockContainer.style.display = 'flex';
                finalizeBtn.style.display = 'block';
                updateToggleViewBtnLabel();

                // Refresh display
                startClock();
                updateInstructionText();
            } else {
                registrationView.style.display = 'none';
                applySessionsViewLayout();
                updateToggleViewBtnLabel();
                applySessionsHeaderMultiselectUI();

                // Renderizar DESPUÉS de aplicar estilos
                renderSessions();
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
            } else {
                toggleViewBtn.innerHTML = `${disketteIcon} <span class=\"toggle-label\">LLISTAT</span>`;
                toggleViewBtn.setAttribute('aria-label', 'Canviar a vista de sessions');
            }
        } catch (e) {
        }
    };

    const renderLaps = () => {
        // Limpiar contenedor
        while (lapsContainer.firstChild) lapsContainer.removeChild(lapsContainer.firstChild);
        laps.forEach((lap, index) => {
            const lapItem = document.createElement('div');
            lapItem.className = `lap-item ${lap.type}`;
            lapItem.id = `lap-item-${index}`;

            // Índice correlativo (1-based)
            const lapIndex = document.createElement('span');
            lapIndex.className = 'lap-index';
            lapIndex.id = `lap-index-${index}`;
            lapIndex.textContent = String(index + 1);

            const lapTime = document.createElement('span');
            lapTime.className = 'lap-duration';
            lapTime.id = `lap-time-${index}`;
            const t = (lap.time instanceof Date) ? lap.time : new Date(lap.time);
            lapTime.innerHTML = formatTime(t);

            // Contenedor para el tiempo con botón de editar
            const lapTimeContainer = document.createElement('div');
            lapTimeContainer.style.display = 'flex';
            lapTimeContainer.style.alignItems = 'center';
            lapTimeContainer.style.gap = '4px';
            lapTimeContainer.style.flex = '0 0 auto';

            // Botón de editar tiempo
            const editTimeBtn = document.createElement('button');
            editTimeBtn.type = 'button';
            editTimeBtn.id = `lap-edit-time-btn-${index}`;
            editTimeBtn.title = 'Editar temps de la volta';
            editTimeBtn.style.display = 'flex';
            editTimeBtn.style.alignItems = 'center';
            editTimeBtn.style.justifyContent = 'center';
            editTimeBtn.style.padding = '2px';
            editTimeBtn.style.borderRadius = '4px';
            editTimeBtn.style.border = '1px solid var(--accent-color)';
            editTimeBtn.style.background = 'transparent';
            editTimeBtn.style.color = 'var(--accent-color)';
            editTimeBtn.style.cursor = 'pointer';
            editTimeBtn.style.flex = '0 0 auto';
            editTimeBtn.innerHTML = editTimeIcon;

            editTimeBtn.addEventListener('click', async () => {
                // Solo permitir edición en sesión activa o en modo edición
                if (!isReadOnly || isViewingSession) {
                    const currentTime = (lap.time instanceof Date) ? lap.time : new Date(lap.time);
                    const newTime = await showEditTimeModal(currentTime, index, laps);
                    if (newTime !== null) {
                        laps[index].time = newTime;
                        lapTime.innerHTML = formatTime(newTime);

                        // Marcar como modificado si estamos viendo una sesión guardada
                        if (isViewingSession) {
                            sessionDirty = true;
                            const saveBtnEnable = document.getElementById('session-save-btn');
                            if (saveBtnEnable) saveBtnEnable.disabled = false;
                        }

                        // Actualizar vista
                        renderLaps();
                        updateSummary();
                    }
                }
            });

            // Aplicar estilos según el modo
            if (!isReadOnly || isViewingSession) {
                // Sesión activa o modo edición: botón activo
                editTimeBtn.style.cursor = 'pointer';
                editTimeBtn.style.opacity = '1';
                editTimeBtn.style.pointerEvents = 'auto';
            } else {
                // Modo vista de sesión guardada: botón deshabilitado visualmente
                editTimeBtn.style.cursor = 'default';
                editTimeBtn.style.opacity = '0.4';
                editTimeBtn.style.pointerEvents = 'none';
            }

            // Icono a la izquierda del tiempo
            lapTimeContainer.appendChild(editTimeBtn);
            lapTimeContainer.appendChild(lapTime);

            const lapNameContainer = document.createElement('div');
            lapNameContainer.style.display = 'flex';
            lapNameContainer.style.alignItems = 'center';
            lapNameContainer.style.gap = '6px';
            lapNameContainer.style.flex = '1';

            const lapNameInput = document.createElement('input');
            lapNameInput.className = 'lap-name';
            lapNameInput.type = 'text';
            lapNameInput.id = `lap-name-${index}`;
            lapNameInput.value = lap.name;
            lapNameInput.style.textAlign = 'left'; // Alinear el texto a la izquierda
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

            // Botón de editar nombre (lápiz azul) - siempre visible
            const editNameBtn = document.createElement('button');
            editNameBtn.type = 'button';
            editNameBtn.id = `lap-edit-name-btn-${index}`;
            editNameBtn.title = 'Editar nombre de la volta';
            editNameBtn.style.display = 'flex';
            editNameBtn.style.alignItems = 'center';
            editNameBtn.style.justifyContent = 'center';
            editNameBtn.style.padding = '4px';
            editNameBtn.style.borderRadius = '4px';
            editNameBtn.style.border = '1px solid var(--accent-color)';
            editNameBtn.style.background = 'transparent';
            editNameBtn.style.color = 'var(--accent-color)';
            editNameBtn.style.cursor = 'pointer';
            editNameBtn.style.flex = '0 0 auto';
            editNameBtn.innerHTML = editIcon;

            editNameBtn.addEventListener('click', async () => {
                // Solo permitir edición en sesión activa o en modo edición
                if (!isReadOnly || isViewingSession) {
                    const newName = await showModal({
                        id: 'modal-edit-lap-name',
                        title: 'Editar nombre de vuelta',
                        type: 'prompt',
                        defaultValue: lap.name || '',
                        okText: 'Guardar',
                        cancelText: 'Cancelar',
                        buttonLayout: 'horizontal'
                    });
                    if (newName !== null && newName.trim() !== '') {
                        // Actualizar el array de laps
                        laps[index].name = newName.trim();
                        // Sincronizar con appState
                        appState.laps = laps;

                        // Marcar como modificado si estamos en modo vista de sesión
                        if (isViewingSession) {
                            sessionDirty = true;
                            const saveBtnEnable = document.getElementById('session-save-btn');
                            if (saveBtnEnable) saveBtnEnable.disabled = false;
                        }

                        // Actualizar vista (renderLaps recreará el DOM con el nuevo nombre)
                        renderLaps();
                        updateSummary();
                    }
                }
            });

            // Aplicar estilos según el modo
            if (!isReadOnly || isViewingSession) {
                // Sesión activa o modo edición: botón activo
                editNameBtn.style.cursor = 'pointer';
                editNameBtn.style.opacity = '1';
                editNameBtn.style.pointerEvents = 'auto';
            } else {
                // Modo vista de sesión guardada: botón deshabilitado visualmente
                editNameBtn.style.cursor = 'default';
                editNameBtn.style.opacity = '0.4';
                editNameBtn.style.pointerEvents = 'none';
            }

            // Botón a la izquierda del nombre
            lapNameContainer.appendChild(editNameBtn);
            lapNameContainer.appendChild(lapNameInput);

            const durationSpan = document.createElement('span');
            durationSpan.className = 'lap-time';
            durationSpan.id = `lap-duration-${index}`;

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
            lapTypeToggle.id = `lap-type-toggle-${index}`;
            const isWork = lap.type === 'work';
            lapTypeToggle.innerHTML = `${isWork ? workIcon : restIcon}`;
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
            deleteBtn.id = `lap-delete-btn-${index}`;
            deleteBtn.title = 'Eliminar volta';
            deleteBtn.setAttribute('aria-label', 'Eliminar volta');
            deleteBtn.style.color = '#f44336'; // Color rojo
            deleteBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>`;
            deleteBtn.addEventListener('click', async () => {
                if (!isReadOnly || isViewingSession) {
                    const confirmDelete = await showModal({
                        id: 'modal-delete-lap-confirm',
                        title: 'Eliminar volta',
                        message: `Segur que vols eliminar "${lap.name}"?`,
                        okText: 'ELIMINAR',
                        cancelText: 'CANCEL.LAR',
                        type: 'confirm',
                        buttonLayout: 'horizontal',
                        reverseButtons: false,
                        okButtonStyle: 'background: #4CAF50; color: white; border: 1px solid #4CAF50;',
                        cancelButtonStyle: 'background: #f44336; color: white; border: 1px solid #f44336;'
                    });
                    if (confirmDelete) {
                        laps.splice(index, 1);

                        // Marcar como modificado si estamos viendo una sesión guardada
                        if (isViewingSession) {
                            sessionDirty = true;
                            const saveBtnEnable = document.getElementById('session-save-btn');
                            if (saveBtnEnable) saveBtnEnable.disabled = false;
                        }

                        renderLaps();
                        updateSummary();
                    }
                }
            });

            // Aplicar estilos según el modo
            if (!isReadOnly || isViewingSession) {
                // Sesión activa o modo edición: botón activo
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.opacity = '1';
                deleteBtn.style.pointerEvents = 'auto';
            } else {
                // Modo vista de sesión guardada: botón deshabilitado visualmente
                deleteBtn.style.cursor = 'default';
                deleteBtn.style.opacity = '0.4';
                deleteBtn.style.pointerEvents = 'none';
            }

            // Place delete button first (leftmost) when editable
            if (!isReadOnly || isViewingSession) {
                lapItem.appendChild(deleteBtn);
            }
            lapItem.appendChild(lapIndex);
            lapItem.appendChild(lapTimeContainer);
            lapItem.appendChild(lapNameContainer);
            lapItem.appendChild(durationSpan);
            // En session-view, la vuelta "-FINAL-" no muestra icono de Treball/descans
            const isSessionViewContext = (typeof currentSessionKey !== 'undefined' && currentSessionKey) || isViewingSession || isReadOnly;
            if (!(isSessionViewContext && lap.name === '-FINAL-')) {
                lapItem.appendChild(lapTypeToggle);
            }

            // Añadir botón "+" a la derecha de cada vuelta en modo edición o durante la grabación
            if (isViewingSession || (isRecording && !isReadOnly)) {
                const addLapAfterBtn = document.createElement('button');
                addLapAfterBtn.className = 'add-lap-after-btn';
                addLapAfterBtn.id = `add-lap-after-btn-${index}`;
                addLapAfterBtn.innerHTML = plusIcon;
                addLapAfterBtn.title = 'Afegir volta després d\'aquesta';
                addLapAfterBtn.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    padding: 0;
                    margin-left: 8px;
                    background: white;
                    color: #000000;
                    border: 2px solid #FFC107;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                `;

                addLapAfterBtn.addEventListener('mouseover', () => {
                    addLapAfterBtn.style.background = '#FFF9E6';
                    addLapAfterBtn.style.transform = 'scale(1.1)';
                });

                addLapAfterBtn.addEventListener('mouseout', () => {
                    addLapAfterBtn.style.background = 'white';
                    addLapAfterBtn.style.transform = 'scale(1)';
                });

                addLapAfterBtn.addEventListener('click', async () => {
                    // Determinar los tiempos límite
                    const currentLapTime = laps[index].time;
                    const isLastLap = index === laps.length - 1;
                    let nextLapTime;
                    let isLastLapDuringRecording = false;

                    if (!isLastLap) {
                        // No es la última vuelta: añadir entre esta y la siguiente
                        nextLapTime = laps[index + 1].time;
                    } else {
                        // Es la última vuelta
                        if (isRecording && !isReadOnly) {
                            // Grabando: usar tiempo actual como límite superior
                            nextLapTime = new Date();
                            isLastLapDuringRecording = false; // Sí hay límite superior
                        } else {
                            // Editando sesión guardada: sin límite superior
                            nextLapTime = currentLapTime;
                            isLastLapDuringRecording = true; // No validar límite superior
                        }
                    }

                    // Mostrar modal para seleccionar tiempo
                    const newTime = await showAddLapBetweenModal(currentLapTime, nextLapTime, isLastLapDuringRecording);

                    if (newTime !== null) {
                        // Si era la última vuelta, cambiar su tipo a 'rest' y su nombre (ya no será la final)
                        if (isLastLap) {
                            laps[index].type = 'rest';
                            // Cambiar el nombre de "-FINAL-" a un nombre normal para que muestre el icono
                            if (laps[index].name === '-FINAL-') {
                                laps[index].name = `Volta ${index + 1}`;
                            }
                        }

                        // Crear nueva vuelta con tipo 'rest' por defecto
                        const newLap = {
                            time: newTime,
                            name: `Volta ${index + 2}`,
                            type: 'rest'
                        };

                        // Insertar la nueva vuelta después de la actual
                        laps.splice(index + 1, 0, newLap);

                        // Si se está grabando y se añadió después de la última vuelta,
                        // reiniciar el seguimiento de la última vuelta
                        if (isLastLap && isRecording && !isReadOnly) {
                            stopLastLapUpdate();
                            startLastLapUpdate();
                        }

                        // Marcar como modificado
                        sessionDirty = true;
                        const saveBtnEnable = document.getElementById('session-save-btn');
                        if (saveBtnEnable) saveBtnEnable.disabled = false;

                        // Actualizar vista
                        renderLaps();
                        updateSummary();
                    }
                });

                lapItem.appendChild(addLapAfterBtn);
            }

            // Agregar al contenedor según preferencia de orden
            if (lapsOrderDescending) {
                lapsContainer.prepend(lapItem); // Descendente: más nueva arriba
            } else {
                lapsContainer.appendChild(lapItem); // Ascendente: más reciente al final
            }
        });

        // Añadir espaciador al final para asegurar que la última vuelta se vea completamente
        const spacer = document.createElement('div');
        spacer.style.height = '50px'; // Aumentado a 50px para más espacio
        spacer.style.flexShrink = '0';
        spacer.style.width = '100%';
        spacer.id = 'laps-container-spacer';
        // Eliminar espaciador anterior si existe
        const existingSpacer = document.getElementById('laps-container-spacer');
        if (existingSpacer) {
            existingSpacer.remove();
        }
        lapsContainer.appendChild(spacer);

        // Si el orden es ascendente, hacer scroll automático hacia las últimas vueltas (solo en el contenedor)
        if (!lapsOrderDescending && lapsContainer.lastChild) {
            // Usar doble requestAnimationFrame para asegurar que el DOM se haya actualizado y el layout recalculado
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Hacer scroll al final del contenedor para mostrar las últimas vueltas
                    lapsContainer.scrollTo({
                        top: lapsContainer.scrollHeight,
                        behavior: 'smooth'
                    });

                });
            });
        }

        // Reaplica el estado de bloqueo después de renderizar
        if (typeof applyLockState === 'function') {
            applyLockState();
        }
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
        row.style.margin = '5px 0';
        row.style.flex = '0 0 auto';

        const label = document.createElement('span');
        label.id = 'recording-name-label';
        label.textContent = 'SESSIÓ:';
        label.style.opacity = '0.9';

        const input = document.createElement('input');
        input.id = 'recording-name-input';
        input.type = 'text';
        input.value = recordingName || 'SessióSenseNom';
        input.placeholder = 'Nom de la sessió';
        input.style.flex = '1 1 auto';
        input.style.minWidth = '0';
        input.style.border = '1px solid #3a3a3a';
        input.style.background = 'transparent';
        input.style.color = '#f0f0f0';
        input.style.borderRadius = '6px';
        input.style.padding = '4px 6px'; // menor margen interno
        input.style.fontSize = '1rem'; // texto más grande
        input.style.fontWeight = '700'; // negrita
        input.addEventListener('input', (e) => {
            recordingName = String(e.target.value ?? '').trimStart();
        });

        row.appendChild(label);
        row.appendChild(input);

        // Botón de edición (lápiz) para enfocar y preseleccionar
        const editBtn = document.createElement('button');
        editBtn.id = 'recording-name-edit-btn';
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

    const updateRecordingNameRow = () => {
        const input = document.getElementById('recording-name-input');
        if (input) {
            input.value = recordingName || 'SessióSenseNom';
        }
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
        persistActiveRecordingState();

        // Iniciar actualización incremental de la última vuelta
        if (laps.length >= 2) {
            startLastLapUpdate();
        }
    };

    // Actualizar solo la duración de la última vuelta (optimizado)
    const updateLastLapDuration = () => {
        if (isReadOnly || laps.length === 0) return;
        // Obtener el elemento correcto según el orden
        const lastLapElement = lapsOrderDescending ? lapsContainer.firstChild : lapsContainer.lastChild;
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

            // Obtener el elemento correcto según el orden
            const lastLapElement = lapsOrderDescending ? lapsContainer.firstChild : lapsContainer.lastChild;
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

    }

    // Detener actualización de última vuelta
    function stopLastLapUpdate() {
        if (lastLapUpdateId) {
            clearInterval(lastLapUpdateId);
            lastLapUpdateId = null;
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
    };

    const stopClock = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    const finalizeSession = async () => {
        // Safety: ensure view-mode finalize handler is detached
        try {
            if (finalizeViewHandler) {
                finalizeBtn.removeEventListener('click', finalizeViewHandler);
                finalizeViewHandler = null;
            }
        } catch { }

        // Guardar el número de vueltas antes de añadir la vuelta automática
        const lapsCountBeforeFinalize = laps.length;
        let autoLapAdded = false;

        // If currently recording, mark a lap as if the user tapped the clock
        if (isRecording && typeof clockContainer !== 'undefined' && clockContainer) {
            try { clockContainer.click(); } catch { }
            // Allow the click handler (addLap) to run before proceeding
            await new Promise(r => setTimeout(r, 25));
            // Verificar si se añadió una vuelta
            if (laps.length > lapsCountBeforeFinalize) {
                autoLapAdded = true;
            }
        }
        // If still no laps, inform the user and abort finalize
        if (laps.length === 0) {
            try {
                await showModal({ id: 'modal-no-laps-info', title: 'Informació', message: 'Prem sobre el Rellotge superior per inicial el reigstres de voltes.', type: 'alert', okText: 'D\'acord' });
            } catch { }
            return;
        }


        // Pedir nombre de la sesión antes de guardar
        const sessionNameInput = await showModal({
            id: 'modal-finalize-session',
            title: 'GUARDAR SESSIÓ',
            message: 'Introdueix un nom per a aquesta sessió:',
            type: 'prompt',
            defaultValue: recordingName || 'SessióSenseNom',
            okText: 'GUARDAR SESSIÓ',
            cancelText: 'CANCEL.LAR'
        });


        // Manejar respuesta del modal (puede ser string o objeto)
        let action = null;
        let newName = null;

        if (typeof sessionNameInput === 'object' && sessionNameInput !== null) {
            // Es un objeto con acción y nombre
            action = sessionNameInput.action;
            newName = sessionNameInput.name;
        } else {
            // Es un string (nombre) o null/undefined
            action = sessionNameInput;
        }

        // Si el usuario cancela, elige continuar grabación o iniciar nueva, no guardar
        if (action === null || action === undefined || action === '__CONTINUE_RECORDING__' || action === '__NEW_RECORDING__') {

            // Reanudar grabación si aplica
            if (action === '__CONTINUE_RECORDING__') {
                // Eliminar la vuelta automática añadida
                if (autoLapAdded && laps.length > lapsCountBeforeFinalize) {
                    laps.pop(); // Eliminar la última vuelta
                    renderLaps();
                    updateSummary();
                }

                // Actualizar el nombre de la sesión si se modificó
                if (newName && newName.trim() !== '' && newName !== 'SessióSenseNom') {
                    recordingName = newName.trim();
                    // Actualizar la fila del nombre si existe
                    updateRecordingNameRow();
                }
                try { startClock(); } catch { }
                isRecording = true;
            }
            // Cancelación - pedir confirmación antes de cancelar
            else if (action === '__NEW_RECORDING__' || action === null || action === undefined) {
                // Pedir confirmación de cancelar
                const confirmCancel = await showModal({
                    id: 'modal-confirm-cancel-session',
                    title: 'CONFIRMAR CANCEL.LACIÓ',
                    message: 'Estàs segur que vols cancel·lar la sessió actual?\n Es perdran totes les dades registrades.',
                    type: 'confirm',
                    okText: 'SÍ\nCANCEL·LAR',
                    cancelText: 'NO\nCONTINUAR',
                    okButtonStyle: 'background: #f44336; color: white; border: 1px solid #f44336;',
                    cancelButtonStyle: 'background: #4CAF50; color: white; border: 1px solid #4CAF50;',
                    buttonLayout: 'horizontal',
                    reverseButtons: false
                });

                if (confirmCancel) {
                    // Usuario confirmó: cancelar sesión (resetAppState limpiará todo)
                    resetAppState();
                } else {
                    // Usuario decidió no cancelar: eliminar la vuelta automática y volver
                    if (autoLapAdded && laps.length > lapsCountBeforeFinalize) {
                        laps.pop(); // Eliminar la última vuelta
                        renderLaps();
                        updateSummary();
                    }
                    // Reactivar el reloj si estaba grabando
                    if (isRecording) {
                        try { startClock(); } catch { }
                    }
                    return;
                }
            }

            return;
        }

        // Aplicar regla: la última vuelta debe llamarse "-FINAL-" solo cuando se va a guardar realmente
        enforceFinalLapName();

        const timestamp = formatSessionName(new Date(laps[0].time));
        // Usar 'action' que contiene el nombre real (no el objeto)
        const sessionNameInputTrimmed = String(action || '').trim();
        const defaultName = 'SessióSenseNom';

        // Detectar si el usuario dejó el nombre vacío o sin cambios significativos
        const isEmptyOrDefault = sessionNameInputTrimmed === '' ||
            sessionNameInputTrimmed === defaultName ||
            sessionNameInputTrimmed === 'Sessió Sense Nom';

        let fullSessionName;
        if (isEmptyOrDefault) {
            // Nombre vacío o por defecto: usar timestamp + nombre por defecto
            fullSessionName = `${timestamp}_${defaultName}.txt`;
        } else {
            // Usuario proporcionó un nombre: usar timestamp + nombre personalizado
            fullSessionName = `${timestamp}_${sessionNameInputTrimmed}.txt`;
        }
        try {
            const storageKey = sessionPrefix + fullSessionName;
            const lapsJson = JSON.stringify(laps);

            localStorage.setItem(storageKey, lapsJson);

            // Verificar que se guardó
            const saved = localStorage.getItem(storageKey);
            clearActiveRecordingState();

            // Detener actualización incremental
            stopLastLapUpdate();

            laps = [];
            appState.laps = laps; // Sincronizar con appState
            isRecording = false;
            appState.isRecording = false; // Sincronizar con appState
            recordingName = 'SessióSenseNom';
            appState.recordingName = recordingName; // Sincronizar con appState

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

            // IMPORTANTE: Primero ocultar registration-view
            registrationView.style.display = 'none';

            // Forzar reflow para asegurar que el layout se recalcula
            void registrationView.offsetHeight;

            applySessionsViewLayout();
            applySessionsHeaderMultiselectUI();

            // Forzar reflow
            void sessionsView.offsetHeight;

            // Ahora renderizar las sesiones con el layout correcto
            renderSessions();

            toggleViewBtn.innerHTML = `${stopwatchIcon} <span class=\"toggle-label\">REGISTRAR</span>`;
        } catch (e) {
            await showModal({ id: 'modal-save-session-error', title: 'Error', message: "Error en desar la sessió. L'emmagatzematge pot estar ple.", type: 'alert', okText: 'Tancar' });
        }
    };

    // --- Funciones de modo multiselección ---

    const SESSIONS_MULTISELECT_TOGGLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;

    const applySessionsHeaderMultiselectUI = () => {
        const importBtn = document.getElementById('import-sessions-btn');
        const exportBtn = document.getElementById('export-sessions-btn');
        const multiselectToggleBtn = document.getElementById('multiselect-toggle-btn');
        const selectAllToggleBtn = document.getElementById('multiselect-select-all-btn');
        const cancelBtn = document.getElementById('multiselect-cancel-btn');
        const deleteBtn = document.getElementById('multiselect-delete-btn');
        const multiselectActionsBar = document.getElementById('multiselect-actions-bar');
        if (multiselectActionsBar) multiselectActionsBar.style.display = 'none';

        if (isMultiSelectMode) {
            if (importBtn) importBtn.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'flex';
            if (multiselectToggleBtn) multiselectToggleBtn.style.display = 'none';
            if (selectAllToggleBtn) selectAllToggleBtn.style.display = 'flex';
            if (cancelBtn) cancelBtn.style.display = 'flex';
            if (deleteBtn) deleteBtn.style.display = 'flex';
        } else {
            if (importBtn) importBtn.style.display = 'flex';
            if (exportBtn) exportBtn.style.display = 'flex';
            if (multiselectToggleBtn) {
                multiselectToggleBtn.style.display = 'flex';
                multiselectToggleBtn.innerHTML = SESSIONS_MULTISELECT_TOGGLE_ICON;
                multiselectToggleBtn.style.color = 'white';
                multiselectToggleBtn.setAttribute('aria-label', 'Activar mode multiselecció');
                multiselectToggleBtn.title = 'Activar mode multiselecció';
            }
            if (selectAllToggleBtn) selectAllToggleBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    };

    const updateMultiselectSelectAllButtonUI = () => {
        const btn = document.getElementById('multiselect-select-all-btn');
        if (!btn || !isMultiSelectMode) return;
        const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith(sessionPrefix));
        const total = sessionKeys.length;
        const allAreSelected = total > 0 && selectedSessions.size === total;

        if (allAreSelected) {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">CAP</span>`;
            btn.setAttribute('aria-label', 'Desmarcar totes les sessions');
            btn.title = 'Desmarcar totes';
            btn.style.color = '#0d6efd';
        } else {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">TOTES</span>`;
            btn.setAttribute('aria-label', 'Marcar totes les sessions');
            btn.title = 'Marcar totes';
            btn.style.color = 'white';
        }
    };

    /** Activa el modo multiselección (salida solo con cancelar o eliminar). */
    const enterMultiSelectMode = () => {
        if (isMultiSelectMode) return;
        isMultiSelectMode = true;
        selectedSessions.clear();
        applySessionsHeaderMultiselectUI();
        updateMultiselectSelectAllButtonUI();
        renderSessions();
    };

    const toggleSelectAll = () => {
        if (!isMultiSelectMode) return;
        const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith(sessionPrefix));
        const total = sessionKeys.length;
        const allAreSelected = total > 0 && selectedSessions.size === total;
        if (allAreSelected) {
            selectedSessions.clear();
        } else {
            sessionKeys.forEach(key => selectedSessions.add(key));
        }
        renderSessions();
    };

    const toggleSessionSelection = (sessionKey) => {
        if (!isMultiSelectMode) return;

        if (selectedSessions.has(sessionKey)) {
            selectedSessions.delete(sessionKey);
        } else {
            selectedSessions.add(sessionKey);
        }

        // Actualizar checkbox visual
        const checkbox = document.getElementById(`checkbox-${sessionKey}`);
        if (checkbox) {
            checkbox.checked = selectedSessions.has(sessionKey);
        }

        updateMultiselectActionBar();
        updateMultiselectSelectAllButtonUI();
    };

    const updateMultiselectActionBar = () => {
        const countSpan = document.getElementById('multiselect-count');
        if (countSpan) {
            const count = selectedSessions.size;
            countSpan.textContent = count > 0 ? `( ${count} seleccionades )` : '';
        }
    };

    const selectAllSessions = () => {
        const sessions = Object.keys(localStorage)
            .filter(key => key.startsWith(sessionPrefix));
        
        sessions.forEach(sessionKey => {
            selectedSessions.add(sessionKey);
            const checkbox = document.getElementById(`checkbox-${sessionKey}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        updateMultiselectActionBar();
    };

    const deleteSelectedSessions = async () => {
        if (selectedSessions.size === 0) {
            await showModal({
                id: 'modal-no-selection',
                title: 'Cap selecció',
                message: 'No hi ha sessions seleccionades per eliminar.',
                type: 'alert',
                okText: 'D\'acord'
            });
            return;
        }

        const count = selectedSessions.size;
        const ok = await showModal({
            id: 'modal-delete-multiple-sessions',
            title: 'ELIMINAR SESSIONS',
            message: `Segur que vols eliminar ${count} ${count === 1 ? 'sessió' : 'sessions'}?`,
            okText: 'CONFIRMAR (Eliminar)',
            cancelText: 'CANCEL.LAR (Conservar)',
            type: 'confirm'
        });

        if (ok) {
            // Eliminar todas las sesiones seleccionadas
            selectedSessions.forEach(sessionKey => {
                localStorage.removeItem(sessionKey);
            });

            // Limpiar selección y salir del modo multiselección
            selectedSessions.clear();
            isMultiSelectMode = false;

            applySessionsHeaderMultiselectUI();
            renderSessions();
        }
    };

    const cancelMultiSelect = () => {
        selectedSessions.clear();
        isMultiSelectMode = false;
        applySessionsHeaderMultiselectUI();
        renderSessions();
    };

    const renderSessions = () => {
        // Asegurar que no quede la barra superior de sesión colgada
        try {
            const danglingTopBar = document.getElementById('session-top-bar');
            if (danglingTopBar) {
                danglingTopBar.remove();
            }
        } catch { }
        // Asegurar el estado correcto del botón toggle
        updateToggleViewBtnLabel();
        sessionsList.innerHTML = '';

        const sessions = Object.keys(localStorage)
            .filter(key => key.startsWith(sessionPrefix))
            .sort((a, b) => {
                // Extraer información de ambas claves
                const infoA = parseSessionKey(a);
                const infoB = parseSessionKey(b);

                // Si ambas tienen timestamp, ordenar por fecha y hora
                if (infoA.timestamp && infoB.timestamp) {
                    return infoB.timestamp.localeCompare(infoA.timestamp); // Más reciente primero
                }

                // Si una tiene timestamp y otra no, las que tienen timestamp van primero
                if (infoA.timestamp && !infoB.timestamp) return -1;
                if (!infoA.timestamp && infoB.timestamp) return 1;

                // Si ninguna tiene timestamp, ordenar alfabéticamente por nombre
                return infoA.name.localeCompare(infoB.name);
            });

        // La visibilidad de #sessions-view la controlan toggleView / init;
        // no forzar display:block aquí: rompe flex/altura y anula display:none al iniciar.

        // Rest of renderSessions remains the same
        // Mostrar mensaje vacío cuando no haya sesiones
        if (sessions.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.id = 'sessions-empty-message';
            emptyMsg.textContent = 'No hi ha sessions desades';
            emptyMsg.style.color = '#aaa';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '10px 0';
            sessionsList.appendChild(emptyMsg);
            if (isMultiSelectMode) updateMultiselectSelectAllButtonUI();
            return;
        }

        sessions.forEach((sessionKey, sessionIndex) => {
            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';
            sessionItem.id = `session-item-${sessionIndex}`;

            const info = parseSessionKey(sessionKey);

            const nameSpan = document.createElement('span');
            nameSpan.id = `session-name-span-${sessionIndex}`;
            nameSpan.style.marginTop = '4px';
            nameSpan.style.display = 'block';
            nameSpan.style.fontSize = '0.9em';
            nameSpan.style.opacity = '0.9';
            nameSpan.textContent = info.fileName;

            const detail = document.createElement('div');
            detail.id = `session-detail-${sessionIndex}`;
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
            } catch { }
            const totalStr = lapsCount > 0 ? `  |  ${formatDurationCompact(totalSeconds)}  |  ${lapsCount} voltes` : '';

            // Mostrar fecha y hora correctamente según el tipo de sesión
            let displayInfo;
            if (info.timestamp) {
                // Sesión con timestamp: mostrar fecha y hora formateadas
                displayInfo = `${info.dateStr}  |  ${info.timeStr}${totalStr}`;
            } else {
                // Sesión con nombre personalizado: solo mostrar el nombre sin fecha
                displayInfo = `${info.name}${totalStr}`;
            }

            detail.innerHTML = displayInfo;

            // First line: session name (bold and larger)
            const nameLine = document.createElement('div');
            nameLine.id = `session-name-line-${sessionIndex}`;
            nameLine.textContent = info.name;
            nameLine.style.color = '#f0f0f0';
            nameLine.style.fontSize = '1.3rem';
            nameLine.style.fontWeight = '700';
            nameLine.style.marginBottom = '2px';

            // Left column with two rows (filename, and date | time | name)
            const infoCol = document.createElement('div');
            infoCol.id = `session-info-col-${sessionIndex}`;
            infoCol.style.display = 'flex';
            infoCol.style.flexDirection = 'column';
            infoCol.style.flex = '1 1 auto';
            // Order: name (big/bold), date|time, file name (bottom, smaller)
            infoCol.appendChild(nameLine);
            infoCol.appendChild(detail);
            infoCol.appendChild(nameSpan);

            // Right column with actions
            const buttonsContainer = document.createElement('div');
            buttonsContainer.id = `session-buttons-container-${sessionIndex}`;
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.flexDirection = 'column';
            buttonsContainer.style.gap = '5px';

            const viewBtn = document.createElement('button');
            viewBtn.id = `session-view-btn-${sessionIndex}`;
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
            deleteBtn.id = `session-delete-btn-${sessionIndex}`;
            deleteBtn.setAttribute('aria-label', 'ELIMINAR SESSIÓ');
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
                    id: 'modal-delete-session-confirm',
                    title: 'ELIMINAR SESSIÓ',
                    message: `Segur que vols eliminar la sessió:<br>"${sessionKey.replace(sessionPrefix, '')}"?`,
                    okText: 'CONFIRMAR (Eliminar)',
                    cancelText: 'CANCEL.LAR (Conservar)',
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
                            applySessionsViewLayout();
                            registrationViewEl.style.display = 'none';
                        }
                    }
                    renderSessions();
                }
            });

            // Crear checkbox para modo multiselección
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `checkbox-${sessionKey}`;
            checkbox.className = 'session-checkbox';
            checkbox.style.width = '24px';
            checkbox.style.height = '24px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.marginRight = '10px';
            checkbox.style.display = isMultiSelectMode ? 'block' : 'none';
            checkbox.checked = selectedSessions.has(sessionKey);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSessionSelection(sessionKey);
            });

            // En modo multiselección, el click en el sessionItem también toggle el checkbox
            if (isMultiSelectMode) {
                sessionItem.style.cursor = 'pointer';
                sessionItem.addEventListener('click', (e) => {
                    // Solo si no se hizo click en un botón
                    if (!e.target.closest('button') && !e.target.closest('input')) {
                        toggleSessionSelection(sessionKey);
                    }
                });
                // Ocultar botones de acción en modo multiselección
                deleteBtn.style.display = 'none';
                buttonsContainer.style.display = 'none';
            } else {
                sessionItem.style.cursor = 'default';
            }

            // Append in order: checkbox | delete | info | actions
            sessionItem.appendChild(checkbox);
            sessionItem.appendChild(deleteBtn);
            sessionItem.appendChild(infoCol);
            sessionItem.appendChild(buttonsContainer);
            sessionsList.appendChild(sessionItem);
        });
        if (isMultiSelectMode) updateMultiselectSelectAllButtonUI();
    };

    const viewSession = (sessionKey) => {
        let savedLaps = null;
        try {
            savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        } catch { }
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
        } catch { }
        if (!Array.isArray(savedLaps) || savedLaps.length === 0) {
            showModal({ id: 'modal-empty-session', title: 'Sessió buida', message: 'Aquesta sessió no conté voltes.', type: 'alert', okText: 'Tancar' });
            return;
        }
        if (savedLaps) {
            isReadOnly = true;
            isViewingSession = false; // Inicialmente en modo solo lectura
            currentSessionKey = sessionKey;
            laps = savedLaps.map(lap => ({ ...lap, time: new Date(lap.time) }));
            appState.laps = laps; // Sincronizar con appState
            sessionDirty = false;
            pendingRename = null;

            // Variables de estado para modo edición
            let isEditMode = false;
            let originalLapsState = null;

            // Switch to registration view first
            sessionsView.style.display = 'none';
            registrationView.style.display = 'flex';

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
            topBar.style.padding = '8px';
            topBar.style.backgroundColor = '#333';
            topBar.style.zIndex = '1000';
            topBar.style.display = 'flex';
            topBar.style.justifyContent = 'space-between';
            topBar.style.alignItems = 'flex-start'; // Alinear al inicio
            topBar.style.boxSizing = 'border-box';
            topBar.style.minHeight = '52px'; // Altura mínima en lugar de fija
            topBar.style.transition = 'min-height 0.3s ease'; // Transición suave

            // Crear botón propio para editar/validar en vista de sesión
            const sessionEditBtn = document.createElement('button');
            sessionEditBtn.className = 'session-edit-btn';
            sessionEditBtn.id = 'session-edit-btn';
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
            actions.id = 'session-top-bar-actions';
            actions.style.display = 'flex';
            actions.style.flexDirection = 'column'; // Stack buttons vertically
            actions.style.gap = '5px'; // Gap between button rows
            actions.style.justifyContent = 'flex-start'; // Alinear al inicio para colapsar espacio
            actions.style.alignItems = 'stretch'; // Use full height
            actions.style.flex = '1 1 auto'; // Flexible pero colapsa cuando no hay contenido

            const viewDeleteBtn = document.createElement('button');
            viewDeleteBtn.type = 'button';
            viewDeleteBtn.id = 'session-view-delete-btn';
            viewDeleteBtn.setAttribute('aria-label', 'ELIMINAR SESSIÓ');
            viewDeleteBtn.title = 'Eliminar';
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
                if (isEditMode) {
                    cancelEdit();
                } else {
                    deleteSession(sessionKey);
                }
            });

            const viewShareBtn = document.createElement('button');
            viewShareBtn.id = 'session-view-share-btn';
            // Create larger share icon for better visibility
            const largeShareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
            viewShareBtn.innerHTML = `${largeShareIcon} TXT`;
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
            viewShareCsvBtn.id = 'session-view-share-csv-btn';
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
            viewShareCsvCommaBtn.id = 'session-view-share-csv-comma-btn';
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

            const viewClipboardBtn = document.createElement('button');
            viewClipboardBtn.id = 'session-view-clipboard-btn';
            // Create clipboard icon
            const clipboardIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
            viewClipboardBtn.innerHTML = `${clipboardIcon} PORTAPAPERS`;
            viewClipboardBtn.style.display = 'flex';
            viewClipboardBtn.style.alignItems = 'center';
            viewClipboardBtn.style.justifyContent = 'center';
            viewClipboardBtn.style.gap = '6px';
            viewClipboardBtn.style.flex = '1'; // Take equal portion of space
            viewClipboardBtn.style.height = '36px'; // Fixed height for all buttons
            viewClipboardBtn.style.borderRadius = '8px'; // Rounded corners like lap-type-toggle
            viewClipboardBtn.style.border = `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()}`; // Blue border
            viewClipboardBtn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(); // Blue background
            viewClipboardBtn.style.color = '#fff'; // White text
            viewClipboardBtn.style.fontWeight = '700'; // Bold text
            viewClipboardBtn.style.fontSize = '0.9rem'; // Larger font size
            viewClipboardBtn.style.cursor = 'pointer';
            viewClipboardBtn.style.transition = 'all 0.2s';
            viewClipboardBtn.style.textTransform = 'uppercase';
            viewClipboardBtn.addEventListener('click', () => copySessionToClipboard(sessionKey));

            // Crear botón toggle para mostrar/ocultar opciones de compartir
            const toggleShareBtn = document.createElement('button');
            toggleShareBtn.id = 'session-toggle-share-btn';
            toggleShareBtn.type = 'button';
            toggleShareBtn.setAttribute('aria-label', 'MOSTRAR OPCIONS DE COMPARTIR');
            toggleShareBtn.title = 'Mostrar opcions de compartir';
            const shareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z"/></svg>`;
            toggleShareBtn.innerHTML = `${shareIcon} COMPARTIR`;
            toggleShareBtn.style.display = 'flex';
            toggleShareBtn.style.alignItems = 'center';
            toggleShareBtn.style.justifyContent = 'center';
            toggleShareBtn.style.gap = '6px';
            toggleShareBtn.style.flex = '1';
            toggleShareBtn.style.height = '36px';
            toggleShareBtn.style.borderRadius = '8px';
            toggleShareBtn.style.border = '1px solid #0d6efd';
            toggleShareBtn.style.backgroundColor = '#0d6efd';
            toggleShareBtn.style.color = '#fff';
            toggleShareBtn.style.fontWeight = '700';
            toggleShareBtn.style.fontSize = '0.9rem';
            toggleShareBtn.style.cursor = 'pointer';
            toggleShareBtn.style.transition = 'all 0.2s';
            toggleShareBtn.style.textTransform = 'uppercase';

            // Create top row with Delete, Share Toggle and Edit buttons
            const topRow = document.createElement('div');
            topRow.id = 'session-top-row';
            topRow.style.display = 'flex';
            topRow.style.gap = '5px';
            topRow.style.alignItems = 'stretch';
            topRow.style.height = '36px'; // Altura fija para el top row

            // Create bottom row with Share buttons (inicialmente oculto)
            const bottomRow = document.createElement('div');
            bottomRow.id = 'session-bottom-row';
            bottomRow.style.display = 'none'; // Oculto por defecto
            bottomRow.style.gap = '5px';
            bottomRow.style.alignItems = 'stretch';
            bottomRow.style.height = '36px'; // Altura fija para el bottom row

            // Toggle functionality para mostrar/ocultar opciones de compartir
            // (Se configurará después de insertar el topBar en el DOM)
            let shareOptionsVisible = false;

            // Add buttons to their respective rows
            topRow.appendChild(viewDeleteBtn);
            topRow.appendChild(toggleShareBtn);
            topRow.appendChild(sessionEditBtn);
            bottomRow.appendChild(viewShareBtn);
            bottomRow.appendChild(viewShareCsvBtn);
            bottomRow.appendChild(viewShareCsvCommaBtn);
            bottomRow.appendChild(viewClipboardBtn);

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

                    // Ocultar botón toggle de compartir y las opciones
                    toggleShareBtn.style.display = 'none';
                    bottomRow.style.display = 'none';
                    shareOptionsVisible = false;

                    // Actualizar margen después de ocultar bottomRow
                    setTimeout(updateRegistrationMargin, 50);

                    // Habilitar edición de nombre de sesión
                    const nameLabel = document.querySelector('#session-name-row .nameLabel');
                    if (nameLabel) {
                        nameLabel.contentEditable = 'true';
                        nameLabel.style.border = '1px solid #ffffff';
                        nameLabel.style.borderRadius = '4px';
                        nameLabel.style.padding = '4px';
                        nameLabel.style.backgroundColor = 'rgba(0, 170, 255, 0.1)';
                        nameLabel.style.textAlign = 'left';
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

                    // Mostrar botón toggle de compartir
                    toggleShareBtn.style.display = 'flex';

                    // No mostrar automáticamente los botones de compartir al salir del modo edición
                    // El usuario debe usar el toggle si los quiere ver
                    bottomRow.style.display = 'none';
                    shareOptionsVisible = false;

                    // Actualizar margen después de ajustar bottomRow
                    setTimeout(updateRegistrationMargin, 50);

                    // Deshabilitar edición de nombre de sesión
                    const nameLabel = document.querySelector('#session-name-row .nameLabel');
                    if (nameLabel) {
                        nameLabel.contentEditable = 'false';
                        nameLabel.style.border = '1px solid #808080';
                        nameLabel.style.borderRadius = '4px';
                        nameLabel.style.padding = '4px';
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
                    appState.laps = laps; // Sincronizar con appState
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
                        const parsedInfo = parseSessionKey(currentSessionKey);

                        // Si la sesión original tiene timestamp, mantenerlo para el nuevo nombre
                        // Si no tiene timestamp (nombre personalizado), no añadir timestamp
                        let newFileName;
                        if (parsedInfo.timestamp) {
                            newFileName = `${parsedInfo.timestamp}_${pendingRename}.txt`;
                        } else {
                            newFileName = `${pendingRename}.txt`;
                        }

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
                    await showModal({ id: 'modal-validate-edit-error', title: 'Error', message: 'Error en guardar los cambios.', type: 'alert', okText: 'Tancar' });
                }
            };

            // Add rows to actions container
            actions.appendChild(topRow);
            actions.appendChild(bottomRow);
            topBar.appendChild(actions);
            document.body.insertBefore(topBar, document.body.firstChild);

            // Función para actualizar el margen del registrationView según la altura del topBar
            const updateRegistrationMargin = () => {
                try {
                    // Calcular la altura total: appTitle + topBar - 45px
                    const appTitleHeight = appTitleEl ? appTitleEl.offsetHeight : 44;
                    const topBarHeight = topBar.offsetHeight;
                    const totalMargin = appTitleHeight + topBarHeight - 45; // Reducir 45px
                    registrationView.style.marginTop = `${totalMargin}px`;
                } catch { }
            };

            // Configurar el toggle para ajustar el margen cuando cambia la visibilidad
            toggleShareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                shareOptionsVisible = !shareOptionsVisible;
                bottomRow.style.display = shareOptionsVisible ? 'flex' : 'none';
                toggleShareBtn.setAttribute('aria-label', shareOptionsVisible ? 'OCULTAR OPCIONS DE COMPARTIR' : 'MOSTRAR OPCIONS DE COMPARTIR');
                toggleShareBtn.title = shareOptionsVisible ? 'Ocultar opcions de compartir' : 'Mostrar opcions de compartir';

                // Actualizar margen después de que el DOM se actualice
                setTimeout(updateRegistrationMargin, 50);
            });

            // Ocultar controls-container en vista de sesión guardada
            try {
                const controlsContainerEl = document.getElementById('controls-container');
                if (controlsContainerEl) controlsContainerEl.style.display = 'none';
            } catch { }

            // Calcular margen inicial después de que el DOM se actualice
            setTimeout(updateRegistrationMargin, 100);

            // Hide only the clock text to keep laps list visible
            try { clockElement.style.display = 'none'; } catch { }
            try { clockContainer.style.display = 'none'; } catch { }

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
            sessionInfoContainer.style.padding = '5px';
            sessionInfoContainer.style.borderRadius = '5px';

            const sessionDate = laps.length > 0 ? new Date(laps[0].time) : new Date();
            const dateText = document.createElement('div');
            dateText.id = 'session-info-date';
            dateText.textContent = formatDate(sessionDate);
            dateText.style.fontSize = '1.5em';
            dateText.style.marginBottom = '5px';
            dateText.style.color = '#000000'; // Texto negro
            // Fecha en negrita
            dateText.style.fontWeight = '700';

            const timeText = document.createElement('div');
            timeText.id = 'session-info-time';
            const sessionStartTime = laps.length > 0 ? new Date(laps[0].time) : new Date();
            const sessionEndTime = laps.length > 0 ? new Date(laps[laps.length - 1].time) : sessionStartTime;
            timeText.innerHTML = `Horari: ${formatTime(sessionStartTime)} - ${formatTime(sessionEndTime)}`;
            timeText.style.fontSize = '1.4em';
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
            namePrefix.id = 'session-name-prefix';
            namePrefix.textContent = 'SESSIÓ:';
            namePrefix.style.fontWeight = '400';
            namePrefix.style.opacity = '0.9';
            namePrefix.style.flex = '0 0 auto';
            namePrefix.style.textAlign = 'left';

            const nameLabel = document.createElement('span');
            nameLabel.id = 'session-name-label';
            const parsedNow = parseSessionKey(currentSessionKey || sessionKey);
            nameLabel.textContent = parsedNow.name || 'Sessió';
            nameLabel.style.fontSize = '1.3em';
            nameLabel.style.fontWeight = '600';
            nameLabel.style.flex = '1 1 auto';
            nameLabel.style.textAlign = 'left';
            nameLabel.style.border = '1px solid #808080';
            nameLabel.style.borderRadius = '4px';
            nameLabel.style.padding = '4px';
            nameLabel.contentEditable = 'false'; // Inicialmente no editable

            // Event listener para cambios en el nombre de la sesión
            nameLabel.addEventListener('input', () => {
                if (isEditMode) {
                    pendingRename = nameLabel.textContent.trim();
                    sessionDirty = true;
                }
            });

            const actionsRight = document.createElement('div');
            actionsRight.id = 'session-name-actions';
            actionsRight.style.display = 'flex';
            actionsRight.style.gap = '8px';
            actionsRight.style.alignItems = 'center';
            actionsRight.style.flex = '0 0 auto';

            const editBtn = document.createElement('button');
            editBtn.id = 'session-name-edit-btn';
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
                const newName = await showModal({ id: 'modal-edit-session-name', title: 'Editar nom', type: 'prompt', defaultValue: currentInfo.name || 'Sessió', okText: 'Desar', cancelText: 'Cancel·lar' });
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
            try { stopClock(); } catch { }
            try { renderLaps(); } catch (e) { }
            try { updateSummary(); } catch (e) { }
            try { lapsContainer.style.display = 'flex'; } catch { }
            // Recalcular altura del contenedor de vueltas después de añadir la barra superior
            setTimeout(() => {
                if (typeof window.updateLapsContainerHeight === 'function') {
                    window.updateLapsContainerHeight();
                }
            }, 200);
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
                    // Respetar orden de vueltas
                    if (lapsOrderDescending) {
                        // Insertar al principio invirtiendo el fragmento
                        const children = Array.from(frag.children);
                        children.reverse().forEach(child => lapsContainer.appendChild(child));
                    } else {
                        lapsContainer.appendChild(frag);
                    }
                    // Añadir espaciador al final también en el fallback
                    const spacer = document.createElement('div');
                    spacer.style.height = '50px'; // Mismo tamaño que en renderLaps()
                    spacer.style.flexShrink = '0';
                    spacer.style.width = '100%';
                    spacer.id = 'laps-container-spacer';
                    const existingSpacer = document.getElementById('laps-container-spacer');
                    if (existingSpacer) {
                        existingSpacer.remove();
                    }
                    lapsContainer.appendChild(spacer);
                }
            } catch { }
            // Evitar que, al abrir una sessió guardada, la pantalla haga scroll automático
            // hacia la zona de vueltas ocultando la parte superior (botones y nombre).
            // En su lugar, dejamos la posición actual o, si se requiere, podemos forzar
            // un scroll suave al inicio de la página.
            try {
                if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch { }
        }
    };

    const closeSessionView = async (skipPrompt = false) => {
        try {
            if (!skipPrompt && sessionDirty && currentSessionKey) {
                const ok = await showModal({ id: 'modal-save-changes-confirm', title: 'Desar canvis?', message: 'Vols desar els canvis?', okText: 'DESAR', cancelText: 'NO DESAR', type: 'confirm', buttonLayout: 'horizontal', reverseButtons: false, okButtonStyle: 'background: #4CAF50; color: white; border: 1px solid #4CAF50;', cancelButtonStyle: 'background: #f44336; color: white; border: 1px solid #f44336;' });
                if (ok) {
                    // Guardar cambios (rename + tipos)
                    if (pendingRename && pendingRename.trim() !== '') {
                        const parsedInfo = parseSessionKey(currentSessionKey);

                        // Si la sesión original tiene timestamp, mantenerlo para el nuevo nombre
                        // Si no tiene timestamp (nombre personalizado), no añadir timestamp
                        let newFileName;
                        if (parsedInfo.timestamp) {
                            newFileName = `${parsedInfo.timestamp}_${pendingRename}.txt`;
                        } else {
                            newFileName = `${pendingRename}.txt`;
                        }

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
            await showModal({ id: 'modal-close-session-error', title: 'Error', message: 'Error en desar els canvis.', type: 'alert', okText: 'Tancar' });
        } finally {
            sessionDirty = false;
            pendingRename = null;
        }
        isReadOnly = false;
        appState.isReadOnly = false; // Sincronizar con appState
        isViewingSession = false;
        appState.isViewingSession = false; // Sincronizar con appState
        currentSessionKey = null;
        appState.currentSessionKey = null; // Sincronizar con appState
        laps = [];
        appState.laps = laps; // Sincronizar con appState

        // Remove top bar and reset margins
        const topBar = document.getElementById('session-top-bar');
        if (topBar) {
            topBar.remove();
        }
        try { registrationView.style.marginTop = ''; } catch { }
        registrationView.style.marginTop = '0';
        // Restore finalize button to default behavior and remove view handler
        if (finalizeViewHandler) {
            try { finalizeBtn.removeEventListener('click', finalizeViewHandler); } catch { }
            finalizeViewHandler = null;
        }
        try { finalizeBtn.removeEventListener('click', finalizeSession); } catch { }
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
        finalizeBtn.style.height = 'auto';
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
        try { clockElement.style.display = ''; } catch { }
        renderLaps();
        updateSummary();
        try { updateInstructionText && updateInstructionText(); } catch { }
        try { startClock(); } catch { }
        // Caller decides which view to show next
    };

    const deleteSession = async (sessionKey) => {
        const sessionName = sessionKey.replace(sessionPrefix, '');
        const ok = await showModal({
            id: 'modal-delete-session-confirm',
            title: 'ELIMINAR SESSIÓ',
            message: `Segur que vols eliminar la sessió:<br>"${sessionName}"?`,
            okText: 'CONFIRMAR (Eliminar)',
            cancelText: 'CANCEL.LAR (Conservar)',
            type: 'confirm'
        });
        if (ok) {
            localStorage.removeItem(sessionKey);

            // Si estamos viendo esta sesión (incluida la vista embebida en registration-view), cerrarla y mostrar solo sessions-view
            if (isViewingSession && currentSessionKey === sessionKey) {
                try { await closeSessionView(true); } catch (e) { }
                // Remover explícitamente la top bar si quedó montada
                try {
                    const tb = document.getElementById('session-top-bar');
                    if (tb) { tb.remove(); }
                } catch { }
                try { applySessionsViewLayout(); } catch { }
                try { registrationView.style.display = 'none'; } catch { }
                updateToggleViewBtnLabel();
                // Normalizar flags de vista
                isReadOnly = false;
                appState.isReadOnly = false;
                isViewingSession = false;
                appState.isViewingSession = false;
                currentSessionKey = null;
                appState.currentSessionKey = null;
                try { laps = []; appState.laps = laps; renderLaps(); updateSummary(); } catch { }
            }

            // Asegurar: si estamos en registration-view sin isViewingSession pero con la vista de sesión todavía montada
            // forzar también la vista de sesiones (caso reportado por el usuario)
            if (!isViewingSession) {
                // Cerrar vista de sesión si hubiera estado abierta en modo solo lectura
                try { await closeSessionView(true); } catch (e) { }
                // Remover explícitamente la top bar si quedó montada
                try {
                    const tb = document.getElementById('session-top-bar');
                    if (tb) { tb.remove(); }
                } catch { }
                try { applySessionsViewLayout(); } catch { }
                try { registrationView.style.display = 'none'; } catch { }
                updateToggleViewBtnLabel();
                // Normalizar flags de vista
                isReadOnly = false;
                appState.isReadOnly = false;
                isViewingSession = false;
                appState.isViewingSession = false;
                currentSessionKey = null;
                appState.currentSessionKey = null;
                try { laps = []; appState.laps = laps; renderLaps(); updateSummary(); } catch { }
            }

            // Renderizar la lista actualizada
            renderSessions();
            updateToggleViewBtnLabel();
        }
    };

    const shareSession = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (savedLaps) {
            const info = parseSessionKey(sessionKey);
            const sessionName = info.name; // Usar solo el nombre limpio
            const startDate = new Date(savedLaps[0].time);
            const startDateStr = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:${String(startDate.getSeconds()).padStart(2, '0')}.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

            let totalWorkSeconds = 0;
            let totalRestSeconds = 0;

            let shareText = `Sesión: ${sessionName}\nFecha: ${startDateStr}\nHora inicio: ${startTimeStr}\n\n`;
            // Encabezado (tabulado) - Orden: #, HORA, DURADA, TIPUS, NOM
            shareText += `#\tHora\tDurada\tTipus\tNom` + "\n";

            savedLaps.forEach((lap, index) => {
                const lapTime = new Date(lap.time);
                const lapTimeStr = `${String(lapTime.getHours()).padStart(2, '0')}:${String(lapTime.getMinutes()).padStart(2, '0')}:${String(lapTime.getSeconds()).padStart(2, '0')}.${String(lapTime.getMilliseconds()).padStart(3, '0')}`;
                const lapTypeLabel = lap.type === 'work' ? 'Treball' : 'Descans';
                // Orden: #, HORA, DURADA, TIPUS, NOM
                let line = `${index + 1}\t${lapTimeStr}`;
                // Añadir duración
                if (index < savedLaps.length - 1) {
                    const nextTime = new Date(savedLaps[index + 1].time);
                    const duration = (nextTime - lapTime) / 1000;
                    if (lap.type === 'work') totalWorkSeconds += duration; else totalRestSeconds += duration;
                    line += `\t${formatDurationPlain(duration)}`;
                } else {
                    line += `\t`;
                }
                // Añadir tipo y nombre
                line += `\t${lapTypeLabel}\t${lap.name}`;
                shareText += line + "\n";
            });

            const totalTimeSeconds = totalWorkSeconds + totalRestSeconds;
            shareText += `\nResumen:\n`;
            shareText += `  Treball: ${formatDurationPlain(totalWorkSeconds)}\n`;
            shareText += `  Descans: ${formatDurationPlain(totalRestSeconds)}\n`;
            shareText += `  Total: ${formatDurationPlain(totalTimeSeconds)}\n`;

            // Cordova: Usar plugin de social sharing
            if (window.cordova && window.plugins && window.plugins.socialsharing) {
                window.plugins.socialsharing.share(
                    shareText,
                    `Sesión: ${sessionName}`,
                    null,
                    null
                );
            }
            // Web: Usar Web Share API
            else if (navigator.share) {
                navigator.share({
                    title: `Sesión: ${sessionName}`,
                    text: shareText,
                }).catch(() => { });
            }
            // Fallback
            else {
                alert("La función de compartir no está disponible en este navegador. Puedes copiar el texto manualmente.");
                prompt("Copia este texto:", shareText);
            }
        }
    };

    const shareSessionCSV = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (!savedLaps) return;
        const info = parseSessionKey(sessionKey);
        const sessionName = info.name; // Usar solo el nombre limpio
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
            const lapTypeLabel = lap.type === 'work' ? 'Treball' : 'Descans';
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
        csv += `\nResumen;Treball;${formatDurationPlain(totalWorkSeconds)}\n`;
        csv += `Resumen;Descans;${formatDurationPlain(totalRestSeconds)}\n`;
        csv += `Resumen;Total;${formatDurationPlain(totalTimeSeconds)}\n`;

        // Verificar si se debe exportar como archivo o como texto
        if (appState.settings.csvExportAsFile) {
            const fileName = `${sessionName}_${startDateStr}.csv`;

            // Cordova: Guardar archivo con plugin File
            if (window.cordova && window.resolveLocalFileSystemURL && cordova.file) {
                const dirPath = cordova.file.externalDataDirectory || cordova.file.dataDirectory;
                window.resolveLocalFileSystemURL(dirPath, function (dir) {
                    dir.getFile(fileName, { create: true }, function (file) {
                        file.createWriter(function (fileWriter) {
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            fileWriter.write(blob);
                            fileWriter.onwriteend = function () {
                                // Compartir el archivo si está disponible el plugin
                                if (window.plugins && window.plugins.socialsharing) {
                                    window.plugins.socialsharing.share(
                                        `CSV exportat: ${sessionName}`,
                                        sessionName,
                                        file.toURL(),
                                        null
                                    );
                                } else {
                                    alert(`Arxiu guardat: ${fileName}`);
                                }
                            };
                        }, function (err) {
                            console.error('Error creant writer:', err);
                            prompt('Error guardant arxiu. Copia el CSV:', csv);
                        });
                    }, function (err) {
                        console.error('Error obtenint arxiu:', err);
                        prompt('Error guardant arxiu. Copia el CSV:', csv);
                    });
                }, function (err) {
                    console.error('Error accedint directori:', err);
                    prompt('Error guardant arxiu. Copia el CSV:', csv);
                });
            }
            // Web: Descargar archivo normalmente
            else {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);

                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } else {
            // Compartir como texto
            if (window.cordova && window.plugins && window.plugins.socialsharing) {
                // Cordova: Plugin social sharing
                window.plugins.socialsharing.share(
                    csv,
                    `Sesión CSV: ${sessionName}`,
                    null,
                    null
                );
            } else if (navigator.share && navigator.canShare && navigator.canShare({ text: csv })) {
                // Web: Share API
                navigator.share({ title: `Sesión CSV: ${sessionName}`, text: csv })
                    .catch(() => { });
            } else {
                // Fallback: prompt para copiar
                prompt('Copia el CSV:', csv);
            }
        }
    };

    const shareSessionCSVComma = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (!savedLaps) return;
        const info = parseSessionKey(sessionKey);
        const sessionName = info.name; // Usar solo el nombre limpio
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
            const lapTypeLabel = lap.type === 'work' ? 'Treball' : 'Descans';
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
        csv += `\nResumen,Treball,${formatDurationPlain(totalWorkSeconds)}\n`;
        csv += `Resumen,Descans,${formatDurationPlain(totalRestSeconds)}\n`;
        csv += `Resumen,Total,${formatDurationPlain(totalTimeSeconds)}\n`;

        // Verificar si se debe exportar como archivo o como texto
        if (appState.settings.csvExportAsFile) {
            const fileName = `${sessionName}_${startDateStr}_coma.csv`;

            // Cordova: Guardar archivo con plugin File
            if (window.cordova && window.resolveLocalFileSystemURL && cordova.file) {
                const dirPath = cordova.file.externalDataDirectory || cordova.file.dataDirectory;
                window.resolveLocalFileSystemURL(dirPath, function (dir) {
                    dir.getFile(fileName, { create: true }, function (file) {
                        file.createWriter(function (fileWriter) {
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            fileWriter.write(blob);
                            fileWriter.onwriteend = function () {
                                // Compartir el archivo si está disponible el plugin
                                if (window.plugins && window.plugins.socialsharing) {
                                    window.plugins.socialsharing.share(
                                        `CSV exportat (coma): ${sessionName}`,
                                        sessionName,
                                        file.toURL(),
                                        null
                                    );
                                } else {
                                    alert(`Arxiu guardat: ${fileName}`);
                                }
                            };
                        }, function (err) {
                            console.error('Error creant writer:', err);
                            prompt('Error guardant arxiu. Copia el CSV (Coma):', csv);
                        });
                    }, function (err) {
                        console.error('Error obtenint arxiu:', err);
                        prompt('Error guardant arxiu. Copia el CSV (Coma):', csv);
                    });
                }, function (err) {
                    console.error('Error accedint directori:', err);
                    prompt('Error guardant arxiu. Copia el CSV (Coma):', csv);
                });
            }
            // Web: Descargar archivo normalmente
            else {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);

                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } else {
            // Compartir como texto
            if (window.cordova && window.plugins && window.plugins.socialsharing) {
                // Cordova: Plugin social sharing
                window.plugins.socialsharing.share(
                    csv,
                    `Sesión CSV (Coma): ${sessionName}`,
                    null,
                    null
                );
            } else if (navigator.share && navigator.canShare && navigator.canShare({ text: csv })) {
                // Web: Share API
                navigator.share({ title: `Sesión CSV (Coma): ${sessionName}`, text: csv })
                    .catch(() => { });
            } else {
                // Fallback: prompt para copiar
                prompt('Copia el CSV (Coma):', csv);
            }
        }
    };

    const copySessionToClipboard = (sessionKey) => {
        const savedLaps = JSON.parse(localStorage.getItem(sessionKey));
        if (!savedLaps) return;

        const info = parseSessionKey(sessionKey);
        const sessionName = info.name; // Usar solo el nombre limpio
        const startDate = new Date(savedLaps[0].time);
        const startDateStr = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}:${String(startDate.getSeconds()).padStart(2, '0')}.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

        let totalWorkSeconds = 0;
        let totalRestSeconds = 0;

        let shareText = `Sesión: ${sessionName}\nFecha: ${startDateStr}\nHora inicio: ${startTimeStr}\n\n`;
        // Encabezado (tabulado) - Orden: #, HORA, DURADA, TIPUS, NOM
        shareText += `#\tHora\tDurada\tTipus\tNom` + "\n";

        savedLaps.forEach((lap, index) => {
            const lapTime = new Date(lap.time);
            const lapTimeStr = `${String(lapTime.getHours()).padStart(2, '0')}:${String(lapTime.getMinutes()).padStart(2, '0')}:${String(lapTime.getSeconds()).padStart(2, '0')}.${String(lapTime.getMilliseconds()).padStart(3, '0')}`;
            const lapTypeLabel = lap.type === 'work' ? 'Treball' : 'Descans';
            // Orden: #, HORA, DURADA, TIPUS, NOM
            let line = `${index + 1}\t${lapTimeStr}`;
            // Añadir duración
            if (index < savedLaps.length - 1) {
                const nextTime = new Date(savedLaps[index + 1].time);
                const duration = (nextTime - lapTime) / 1000;
                if (lap.type === 'work') totalWorkSeconds += duration; else totalRestSeconds += duration;
                line += `\t${formatDurationPlain(duration)}`;
            } else {
                line += `\t`;
            }
            // Añadir tipo y nombre
            line += `\t${lapTypeLabel}\t${lap.name}`;
            shareText += line + "\n";
        });

        const totalTimeSeconds = totalWorkSeconds + totalRestSeconds;
        shareText += `\nResumen:\n`;
        shareText += `  Treball: ${formatDurationPlain(totalWorkSeconds)}\n`;
        shareText += `  Descans: ${formatDurationPlain(totalRestSeconds)}\n`;
        shareText += `  Total: ${formatDurationPlain(totalTimeSeconds)}\n`;

        // Intentar copiar al portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText)
                .then(() => {
                    // Mostrar feedback visual de éxito
                    const btn = document.querySelector('#session-view-clipboard-btn');
                    if (btn) {
                        const originalHTML = btn.innerHTML;
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> COPIAT!`;
                        btn.style.backgroundColor = '#28a745';
                        btn.style.borderColor = '#28a745';
                        setTimeout(() => {
                            btn.innerHTML = originalHTML;
                            btn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
                            btn.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
                        }, 2000);
                    }
                })
                .catch((err) => {
                    alert('No se pudo copiar al portapapeles. Por favor, cópialo manualmente.');
                    prompt('Copia este texto:', shareText);
                });
        } else {
            // Fallback para navegadores que no soportan clipboard API
            prompt('Copia este texto al portapapeles:', shareText);
        }
    };

    // --- PWA: Service Worker + Install prompt ---
    (function setupPWA() {
        try {
            // Service Worker solo para Web/PWA, no para Cordova
            if ('serviceWorker' in navigator && !window.cordova) {
                window.addEventListener('load', () => {
                    // Detectar si estamos en GitHub Pages o en local
                    const isGitHubPages = window.location.hostname.includes('github.io');
                    const swPath = isGitHubPages ? '/ControlVoltes/sw.js' : 'sw.js';
                    const swScope = isGitHubPages ? '/ControlVoltes/' : './';

                    navigator.serviceWorker.register(swPath, { scope: swScope })
                        .then((reg) => {

                            // Actualización automática silenciosa
                            // Si hay un SW esperando, activarlo inmediatamente
                            if (reg.waiting) {
                                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                            }

                            // Detectar cuando se encuentra una nueva versión
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                if (!newWorker) return;


                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        // Nueva versión instalada, activar automáticamente
                                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                                    }
                                });
                            });

                            // Cuando el nuevo SW toma control, recargar automáticamente
                            navigator.serviceWorker.addEventListener('controllerchange', () => {
                                window.location.reload();
                            });

                            // Verificar actualizaciones cada vez que se inicia la app
                            reg.update().catch((e) => { });

                            // Verificar actualizaciones periódicamente (cada 30 segundos)
                            setInterval(() => {
                                reg.update().catch(() => { });
                            }, 30000);
                        })
                        .catch((e) => { });
                });
            }
        } catch { }
        // beforeinstallprompt
        let deferredPrompt = null;
        try {
            const installBtn = document.getElementById('install-btn');
            // Fijar botón de instalación a la parte inferior de la pantalla
            if (installBtn) {
                installBtn.style.position = 'fixed';
                installBtn.style.bottom = '20px';
                installBtn.style.left = '50%';
                installBtn.style.transform = 'translateX(-50%)';
                installBtn.style.zIndex = '9999';
                installBtn.style.padding = '12px 24px';
                installBtn.style.fontSize = '1.1rem';
                installBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }
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
                } catch { }
                installBtn.style.display = 'none';
                deferredPrompt = null;
            });
        } catch { }

        // Force install button logic
        try {
            // Flag para evitar re-mostrar instrucciones hasta recarga
            let installInstructionsDismissed = false;
            const forceInstallBtn = document.getElementById('force-install-btn');
            const installBtn = document.getElementById('install-btn');

            // Helper to update visibility based on install state
            const updateInstallButtonsVisibility = () => {
                try {
                    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                    if (isInstalled) {
                        if (forceInstallBtn) forceInstallBtn.style.display = 'none';
                        if (installBtn) installBtn.style.display = 'none';
                    } else {
                        if (forceInstallBtn) forceInstallBtn.style.display = 'block';
                        // installBtn solo se muestra cuando hay deferredPrompt (ya gestionado arriba)
                    }
                } catch { }
            };

            // Initial visibility
            updateInstallButtonsVisibility();

            // React to appinstalled event
            window.addEventListener('appinstalled', () => {
                try {
                    deferredPrompt = null;
                } catch { }
                updateInstallButtonsVisibility();
            });

            // React to display-mode changes
            try {
                const mql = window.matchMedia('(display-mode: standalone)');
                if (typeof mql.addEventListener === 'function') {
                    mql.addEventListener('change', updateInstallButtonsVisibility);
                } else if (typeof mql.addListener === 'function') {
                    mql.addListener(updateInstallButtonsVisibility);
                }
            } catch { }

            if (forceInstallBtn) {
                forceInstallBtn.addEventListener('click', async () => {
                    // If already installed, inform user
                    try {
                        const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                        if (alreadyInstalled) {
                            showToast('La app ya está instalada', [
                                { label: 'Cerrar', onClick: () => { try { document.getElementById('pwa-toast')?.remove(); } catch { } }, variant: 'secondary' }
                            ]);
                            return;
                        }
                    } catch { }

                    if (deferredPrompt) {
                        // Chrome/Android - use deferred prompt
                        forceInstallBtn.disabled = true;
                        try {
                            const result = await deferredPrompt.prompt();
                            if (result.outcome === 'accepted') {
                                forceInstallBtn.style.display = 'none';
                            }
                        } catch (e) {
                        }
                        forceInstallBtn.disabled = false;
                    } else {
                        // iOS/Safari - show instructions
                        if (!installInstructionsDismissed) {
                            showToast('Para instalar: Pulsa el botón compartir → "Añadir a pantalla de inicio"', [
                                {
                                    label: 'Cerrar', onClick: () => {
                                        try { document.getElementById('pwa-toast')?.remove(); } catch { }
                                        installInstructionsDismissed = true;
                                    }, variant: 'secondary'
                                }
                            ]);
                        }
                    }
                });
            }
        } catch { }
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
                btn.addEventListener('click', () => {
                    try {
                        if (onClick) {
                            onClick();
                        } else {
                            // Si no hay onClick definido, cerrar el toast
                            toast.remove();
                        }
                    } catch { }
                });
                toast.appendChild(btn);
            });
            setTimeout(() => { try { toast.remove(); } catch { } }, 8000);
        } catch { }
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

    // --- Capturar botones físicos del móvil (volumen) para marcar vueltas ---
    let lastVolumeKeyTime = 0;
    const volumeKeyDebounce = 300; // ms para evitar registros duplicados

    // Función para manejar la pulsación de botones de volumen (ambos marcan vuelta)
    const handleVolumeButtonPress = () => {
        console.log('[DEBUG] handleVolumeButtonPress() llamado');
        const now = Date.now();

        // Debounce para evitar múltiples registros
        if (now - lastVolumeKeyTime < volumeKeyDebounce) {
            console.log('[DEBUG] handleVolumeButtonPress: bloqueado por debounce');
            return;
        }

        lastVolumeKeyTime = now;

        // Solo marcar vuelta si estamos en la vista de registro
        // La vista puede estar con display 'block' o 'flex', pero no 'none'
        const displayValue = registrationView.style.display;
        const isRegistrationViewVisible = displayValue !== 'none' && displayValue !== '';
        console.log('[DEBUG] handleVolumeButtonPress: registrationView.display =', displayValue, 'isVisible =', isRegistrationViewVisible);
        
        if (isRegistrationViewVisible) {
            console.log('[DEBUG] handleVolumeButtonPress: llamando a addLap()');
            addLap();

            // Feedback visual/háptico opcional
            if (navigator.vibrate) {
                navigator.vibrate(50); // Vibración corta de confirmación
            }

            // Feedback visual en el reloj
            const originalBg = clockContainer.style.backgroundColor;
            clockContainer.style.backgroundColor = '#FFD700'; // Amarillo dorado
            setTimeout(() => {
                clockContainer.style.backgroundColor = originalBg;
            }, 150);
        }
    };

    // Web: Escuchar eventos de teclado
    document.addEventListener('keydown', (e) => {
        // Solo funcionar si la funcionalidad está activada
        if (!appState.settings.volumeButtonsEnabled) return;

        // Capturar botones de volumen (VolumeUp/VolumeDown) y otras teclas útiles
        const validKeys = ['VolumeUp', 'VolumeDown', 'MediaTrackNext', 'MediaTrackPrevious'];

        if (validKeys.includes(e.key)) {
            e.preventDefault(); // Evitar que cambie el volumen
            handleVolumeButtonPress();
        }
    }, true); // useCapture=true para capturar antes que otros handlers

    // Escuchar eventos de botones de volumen
    // MainActivity dispara eventos DOM "volumeup" y "volumedown" directamente
    // También escuchamos eventos estándar de Cordova si están disponibles
    document.addEventListener('volumeup', () => {
        console.log('[DEBUG] Listener volumeup ejecutado, volumeButtonsEnabled =', appState.settings.volumeButtonsEnabled);
        if (appState.settings.volumeButtonsEnabled) {
            handleVolumeButtonPress();
        } else {
            console.log('[DEBUG] Listener volumeup: bloqueado porque volumeButtonsEnabled = false');
        }
    }, false);

    document.addEventListener('volumedown', () => {
        console.log('[DEBUG] Listener volumedown ejecutado, volumeButtonsEnabled =', appState.settings.volumeButtonsEnabled);
        if (appState.settings.volumeButtonsEnabled) {
            handleVolumeButtonPress();
        } else {
            console.log('[DEBUG] Listener volumedown: bloqueado porque volumeButtonsEnabled = false');
        }
    }, false);

    // Eventos estándar de Cordova (si están disponibles)
    if (window.cordova) {
        document.addEventListener('volumeupbutton', () => {
            if (appState.settings.volumeButtonsEnabled) {
                handleVolumeButtonPress();
            }
        }, false);

        document.addEventListener('volumedownbutton', () => {
            if (appState.settings.volumeButtonsEnabled) {
                handleVolumeButtonPress();
            }
        }, false);
    }

    // Punto de entrada directo desde código nativo (MainActivity)
    // para garantizar que siempre podamos marcar vueltas desde los
    // botones de volumen aunque falle algún plugin/evento intermedio.
    window.__voltesHandleNativeVolume = () => {
        console.log('[DEBUG] __voltesHandleNativeVolume() llamado, volumeButtonsEnabled =', appState.settings.volumeButtonsEnabled);
        if (appState.settings.volumeButtonsEnabled) {
            handleVolumeButtonPress();
        } else {
            console.log('[DEBUG] __voltesHandleNativeVolume: bloqueado porque volumeButtonsEnabled = false');
        }
    };

    // Variables globales para el test de botones físicos
    let volumeTestEventCount = 0;
    let volumeTestLogs = [];

    // Función para mostrar modal de prueba de botones físicos
    window.showVolumeButtonsTestModal = function() {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            backdrop-filter: blur(3px);
        `;
        
        // Crear modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 16px 18px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        // Título
        const title = document.createElement('h2');
        title.textContent = '🧪 Test de Botones Físicos';
        title.style.cssText = `
            margin: 0 0 10px 0;
            font-size: 1.2rem;
            color: #333;
            text-align: center;
        `;
        modal.appendChild(title);
        
        // Contenedor compacto para estados de Plugin y Cordova
        const statusContainer = document.createElement('div');
        statusContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
        `;
        modal.appendChild(statusContainer);

        // Estado del Plugin
        const pluginStatus = document.createElement('div');
        pluginStatus.style.cssText = `
            padding: 8px 10px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
        `;
        
        const pluginAvailable = typeof VolumeButtons !== 'undefined';
        const cordovaAvailable = typeof cordova !== 'undefined';
        
        if (pluginAvailable) {
            pluginStatus.style.background = '#d4edda';
            pluginStatus.style.color = '#155724';
            pluginStatus.innerHTML = '✅ Plugin VolumeButtons: <strong>DETECTADO</strong>';
        } else {
            pluginStatus.style.background = '#f8d7da';
            pluginStatus.style.color = '#721c24';
            pluginStatus.innerHTML = '❌ Plugin VolumeButtons: <strong>NO DETECTADO</strong>';
        }
        statusContainer.appendChild(pluginStatus);
        
        // Estado de Cordova
        const cordovaStatus = document.createElement('div');
        cordovaStatus.style.cssText = `
            padding: 8px 10px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
        `;
        
        if (cordovaAvailable) {
            cordovaStatus.style.background = '#d4edda';
            cordovaStatus.style.color = '#155724';
            cordovaStatus.innerHTML = '✅ Cordova: <strong>DETECTADO</strong>';
        } else {
            cordovaStatus.style.background = '#fff3cd';
            cordovaStatus.style.color = '#856404';
            cordovaStatus.innerHTML = '⚠️ Cordova: <strong>NO DETECTADO</strong><br><small>Estás en navegador web</small>';
        }
        statusContainer.appendChild(cordovaStatus);
        
        // Contador de eventos
        const eventCounter = document.createElement('div');
        eventCounter.id = 'volume-test-counter';
        eventCounter.style.cssText = `
            padding: 12px 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.2rem;
            font-weight: bold;
            transition: transform 0.2s, background 0.2s;
        `;
        eventCounter.innerHTML = `
            <div style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 4px; line-height: 1.1;">Eventos Detectados</div>
            <div id="volume-test-count" style="font-size: 2.4rem; line-height: 1.1;">0</div>
            <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 4px; line-height: 1.1;">Presiona Vol+ o Vol-</div>
        `;
        modal.appendChild(eventCounter);
        
        // Botón de test manual
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 Disparar Evento de Prueba';
        testButton.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            margin-bottom: 12px;
        `;
        testButton.addEventListener('click', () => {
            if (typeof VolumeButtons !== 'undefined' && typeof VolumeButtons._fireEvent === 'function') {
                VolumeButtons._fireEvent('volumeup');
                addTestLog('🧪 Test manual: volumeup disparado', '#28a745');
            } else {
                addTestLog('❌ No se puede disparar evento: Plugin no disponible', '#dc3545');
            }
        });
        modal.appendChild(testButton);
        
        // Botón limpiar logs
        const clearButton = document.createElement('button');
        clearButton.textContent = '🗑️ Limpiar Logs';
        clearButton.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 12px;
        `;
        clearButton.addEventListener('click', () => {
            volumeTestEventCount = 0;
            volumeTestLogs = [];
            document.getElementById('volume-test-count').textContent = '0';
            document.getElementById('volume-test-logs').innerHTML = '<div style="color: #6c757d; font-style: italic;">Logs limpiados...</div>';
        });
        modal.appendChild(clearButton);

        // Logs de eventos (al final del contenido del modal)
        const logsContainer = document.createElement('div');
        logsContainer.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 10px;
            margin: 6px 0 10px 0;
            max-height: 160px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
        `;
        
        const logsTitle = document.createElement('div');
        logsTitle.textContent = '📋 Log de Eventos:';
        logsTitle.style.cssText = `
            font-weight: 700;
            margin-bottom: 4px;
            color: #495057;
            font-family: system-ui;
        `;
        logsContainer.appendChild(logsTitle);
        
        const logsList = document.createElement('div');
        logsList.id = 'volume-test-logs';
        logsList.style.cssText = `
            color: #212529;
        `;
        logsList.innerHTML = '<div style="color: #6c757d; font-style: italic;">Esperando eventos...</div>';
        logsContainer.appendChild(logsList);
        modal.appendChild(logsContainer);
        
        // Botón cerrar
        const closeButton = document.createElement('button');
        closeButton.textContent = '❌ Cerrar';
        closeButton.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
        `;
        closeButton.addEventListener('click', () => {
            document.removeEventListener('volumeup', testVolumeUpHandler);
            document.removeEventListener('volumedown', testVolumeDownHandler);
            document.body.removeChild(overlay);
        });
        modal.appendChild(closeButton);
        
        // Función para agregar log
        function addTestLog(message, color = '#333') {
            const now = new Date();
            const time = now.toLocaleTimeString('es-ES', { hour12: false });
            const logEntry = document.createElement('div');
            logEntry.style.cssText = `
                padding: 4px 0;
                border-bottom: 1px solid #e9ecef;
                color: ${color};
            `;
            logEntry.innerHTML = `<strong>${time}</strong> → ${message}`;
            
            const logsList = document.getElementById('volume-test-logs');
            if (logsList.querySelector('[style*="italic"]')) {
                logsList.innerHTML = '';
            }
            logsList.insertBefore(logEntry, logsList.firstChild);
            
            // Mantener solo los últimos 10 logs
            while (logsList.children.length > 10) {
                logsList.removeChild(logsList.lastChild);
            }
        }
        
        // Listeners temporales para el test
        const testVolumeUpHandler = function() {
            volumeTestEventCount++;
            document.getElementById('volume-test-count').textContent = volumeTestEventCount;
            addTestLog('🔊 VOLUMEN+ detectado', '#FFD700');
            
            // Animación del contador
            const counter = document.getElementById('volume-test-counter');
            counter.style.transform = 'scale(1.05)';
            counter.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
            setTimeout(() => {
                counter.style.transform = 'scale(1)';
                counter.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 200);
        };
        
        const testVolumeDownHandler = function() {
            volumeTestEventCount++;
            document.getElementById('volume-test-count').textContent = volumeTestEventCount;
            addTestLog('🔉 VOLUMEN- detectado', '#00BFFF');
            
            // Animación del contador
            const counter = document.getElementById('volume-test-counter');
            counter.style.transform = 'scale(1.05)';
            counter.style.background = 'linear-gradient(135deg, #00BFFF 0%, #0080FF 100%)';
            setTimeout(() => {
                counter.style.transform = 'scale(1)';
                counter.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 200);
        };
        
        document.addEventListener('volumeup', testVolumeUpHandler);
        document.addEventListener('volumedown', testVolumeDownHandler);
        
        // Limpiar listeners al cerrar haciendo click fuera del modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.removeEventListener('volumeup', testVolumeUpHandler);
                document.removeEventListener('volumedown', testVolumeDownHandler);
                document.body.removeChild(overlay);
            }
        });
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        addTestLog('✅ Modal de test iniciado', '#28a745');
    };

    const handleExitAttempt = async () => {
        if (exitConfirmationInProgress) return;
        exitConfirmationInProgress = true;
        try {
            // Guardar estado actual antes de pedir confirmación
            persistActiveRecordingState();

            const ok = await showModal({
                id: 'modal-exit-app-confirm',
                title: 'Sortir de l’app',
                message: 'Vols tancar l’aplicació? La sessió en curs quedarà guardada per reprendre-la en tornar a obrir.',
                type: 'confirm',
                okText: 'SORTIR',
                cancelText: 'CANCEL·LAR',
                buttonLayout: 'horizontal',
                okButtonStyle: 'background: #dc3545; color: white; border: 1px solid #dc3545;',
                cancelButtonStyle: 'background: #4CAF50; color: white; border: 1px solid #4CAF50;'
            });

            if (ok) {
                persistActiveRecordingState();
                if (window.cordova && navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                } else if (window.close) {
                    window.close();
                }
            }
        } catch (err) {
        } finally {
            exitConfirmationInProgress = false;
        }
    };

    // Confirmar salida al pulsar atrás en dispositivo
    if (window.cordova) {
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            handleExitAttempt();
        }, false);

        // Guardar automáticamente al pausar la app
        document.addEventListener('pause', persistActiveRecordingState, false);
    }

    // Web/PWA: confirmar antes de cerrar si hay grabación en curso
    window.addEventListener('beforeunload', (event) => {
        if (isRecording && laps.length > 0) {
            persistActiveRecordingState();
            event.preventDefault();
            event.returnValue = '';
        }
    });

    finalizeBtn.addEventListener('click', async () => {
        await finalizeSession();
    });

    // Inicializar vistas: mostrar registration-view, ocultar sessions-view
    registrationView.style.display = 'block';
    sessionsView.style.display = 'none';

    startClock();
    renderSessions();

    // --- Inicialización modo multiselección (acciones en el header de sessions-header) ---
    (function initMultiSelectMode() {
        const multiselectToggleBtn = document.getElementById('multiselect-toggle-btn');
        const multiselectActionsBar = document.getElementById('multiselect-actions-bar');

        if (!multiselectToggleBtn || !multiselectActionsBar) return;

        multiselectToggleBtn.innerHTML = SESSIONS_MULTISELECT_TOGGLE_ICON;
        multiselectToggleBtn.style.color = 'white';
        multiselectToggleBtn.addEventListener('click', enterMultiSelectMode);

        multiselectActionsBar.style.display = 'none';
    })();

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
            if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} ON`;
        } else {
            wakeToggle.setAttribute('aria-checked', 'false');
            wakeIndicator.style.background = '#666';
            toggle.style.transform = 'translateX(0)';
            toggle.style.background = '#bbb';
            if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} OFF`;
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
        }
    }

    // --- Gestión del orden de las vueltas ---
    const LAPS_ORDER_PREF_KEY = 'lapsOrderDescending';

    // Cargar preferencia de orden de vueltas
    function loadLapsOrderPreference() {
        try {
            const saved = localStorage.getItem(LAPS_ORDER_PREF_KEY);
            if (saved !== null) {
                appState.lapsOrderDescending = saved === 'true';
                lapsOrderDescending = appState.lapsOrderDescending;
            }
        } catch (err) {
        }
    }

    // Guardar preferencia de orden de vueltas
    function saveLapsOrderPreference(descending) {
        try {
            localStorage.setItem(LAPS_ORDER_PREF_KEY, String(descending));
            appState.lapsOrderDescending = descending;
            lapsOrderDescending = descending;
        } catch (err) {
        }
    }

    // --- Import/Export de sesiones ---
    function initImportExportButtons() {
        const importBtn = document.getElementById('import-sessions-btn');
        const exportBtn = document.getElementById('export-sessions-btn');
        const selectAllHeaderBtn = document.getElementById('multiselect-select-all-btn');
        const cancelBtn = document.getElementById('multiselect-cancel-btn');
        const deleteBtn = document.getElementById('multiselect-delete-btn');

        if (importBtn) {
            importBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">IMP</span>`;
            importBtn.style.color = 'white';
            importBtn.addEventListener('click', importSessions);
        }

        if (exportBtn) {
            exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">EXP</span>`;
            exportBtn.style.color = 'white';
            exportBtn.addEventListener('click', exportSessions);
        }

        if (selectAllHeaderBtn) {
            selectAllHeaderBtn.addEventListener('click', toggleSelectAll);
        }

        if (cancelBtn) {
            cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">CANCEL</span>`;
            cancelBtn.style.color = 'white';
            cancelBtn.addEventListener('click', cancelMultiSelect);
        }

        if (deleteBtn) {
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg><span style="font-size: 0.7rem; font-weight: 700; margin-left: 2px;">ELIM</span>`;
            deleteBtn.style.color = 'white';
            deleteBtn.addEventListener('click', deleteSelectedSessions);
        }
    }

    function exportSessions() {
        let sessions;
        
        if (isMultiSelectMode && selectedSessions.size > 0) {
            // Exportar solo las sesiones seleccionadas
            sessions = Array.from(selectedSessions).map(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    return { key, data };
                } catch {
                    return null;
                }
            }).filter(s => s !== null);
        } else {
            // Exportar todas las sesiones
            sessions = Object.keys(localStorage)
                .filter(key => key.startsWith(sessionPrefix))
                .map(key => {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        return { key, data };
                    } catch {
                        return null;
                    }
                })
                .filter(s => s !== null);
        }

        if (sessions.length === 0) {
            alert('No hi ha sessions per exportar');
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            sessions: sessions
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const fileName = `voltes-sessions-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const shareTitle = `Voltes — ${sessions.length} sessió(ns)`;

        function downloadFallback() {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Sense plugin File: compartir el JSON com a text (al WebView de Cordova el "download" i share(files) sovint no fan res)
        function cordovaShareJsonText(onFail) {
            if (!(window.cordova && window.plugins && window.plugins.socialsharing)) {
                if (onFail) onFail();
                return;
            }
            try {
                window.plugins.socialsharing.share(
                    jsonStr,
                    shareTitle,
                    null,
                    null,
                    function () { },
                    function () { if (onFail) onFail(); }
                );
            } catch (e) {
                if (onFail) onFail();
            }
        }

        async function runWebExportFallbacks() {
            // 1) Fitxer adjunt (navegador/PWA; molts WebViews no)
            if (navigator.share && typeof File !== 'undefined') {
                try {
                    const file = new File([blob], fileName, { type: 'application/json' });
                    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: shareTitle });
                        return;
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                }
            }
            // 2) Text complet (funciona en molts Android WebView igual que el CSV sense "arxiu")
            if (navigator.share) {
                try {
                    await navigator.share({ title: shareTitle, text: jsonStr });
                    return;
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                }
            }
            // 3) Porta-retalls
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(jsonStr);
                    alert('JSON copiat al porta-retalls. Pots enganxar-lo a Notes, un correu o desar-lo com a arxiu .json.');
                    return;
                } catch (e) { /* següent */ }
            }
            try {
                downloadFallback();
            } catch (e) { /* */ }
            if (window.cordova) {
                prompt('Si no s\'ha pogut compartir, copia el JSON:', jsonStr);
            }
        }

        // Cordova: si hi ha plugin File, desar i compartir URI; si no, continuar
        if (window.cordova && window.resolveLocalFileSystemURL && cordova.file) {
            const dirPath = cordova.file.externalDataDirectory || cordova.file.dataDirectory;
            window.resolveLocalFileSystemURL(dirPath, function (dir) {
                dir.getFile(fileName, { create: true }, function (fileEntry) {
                    fileEntry.createWriter(function (fileWriter) {
                        fileWriter.onerror = function (ev) {
                            console.error('FileWriter error (export JSON):', ev);
                            cordovaShareJsonText(function () { runWebExportFallbacks(); });
                        };
                        fileWriter.onwriteend = function () {
                            if (window.plugins && window.plugins.socialsharing) {
                                window.plugins.socialsharing.share(
                                    `Export JSON (${sessions.length} sessió(ns))`,
                                    'Voltes',
                                    fileEntry.toURL(),
                                    null
                                );
                            } else {
                                alert(`Arxiu guardat: ${fileName}`);
                            }
                        };
                        fileWriter.write(jsonStr);
                    }, function (err) {
                        console.error('Error creant writer (export JSON):', err);
                        cordovaShareJsonText(function () { runWebExportFallbacks(); });
                    });
                }, function (err) {
                    console.error('Error obtenint arxiu (export JSON):', err);
                    cordovaShareJsonText(function () { runWebExportFallbacks(); });
                });
            }, function (err) {
                console.error('Error accedint directori (export JSON):', err);
                cordovaShareJsonText(function () { runWebExportFallbacks(); });
            });
            return;
        }

        // APK sense plugin File: socialsharing amb text, o Web Share text / porta-retalls
        if (window.cordova) {
            cordovaShareJsonText(function () { runWebExportFallbacks(); });
            return;
        }

        runWebExportFallbacks();
    }

    function normalizeImportLaps(raw) {
        if (raw == null) return null;
        if (Array.isArray(raw)) return raw;
        return null;
    }

    /** ISO string o número -> ms desde epoch (para JSON exportat amb dates en string). */
    function lapTimeToMs(time) {
        if (typeof time === 'number' && Number.isFinite(time)) return time;
        if (typeof time === 'string') {
            const ms = Date.parse(time);
            return Number.isFinite(ms) ? ms : NaN;
        }
        return NaN;
    }

    /** Retorna còpia de voltes amb `time` numèric; null si alguna data és invàlida. */
    function normalizeSessionLapsForImport(rawData) {
        const laps = normalizeImportLaps(rawData);
        if (!laps || laps.length === 0) return null;
        const out = [];
        for (let i = 0; i < laps.length; i++) {
            const lap = laps[i];
            if (!lap || typeof lap !== 'object') return null;
            const ms = lapTimeToMs(lap.time);
            if (!Number.isFinite(ms)) return null;
            out.push({ ...lap, time: ms });
        }
        return out;
    }

    function sessionFingerprintFromImportLaps(laps) {
        if (!Array.isArray(laps) || laps.length === 0) return null;
        const t0 = lapTimeToMs(laps[0].time);
        const t1 = lapTimeToMs(laps[laps.length - 1].time);
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
        return {
            start: t0,
            durationMs: t1 - t0,
            lapCount: laps.length
        };
    }

    function importFingerprintsMatch(a, b) {
        return a.durationMs === b.durationMs && a.lapCount === b.lapCount;
    }

    function findLocalKeyBySessionStartMs(startMs) {
        const keys = Object.keys(localStorage);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (!key.startsWith(sessionPrefix)) continue;
            try {
                const laps = normalizeImportLaps(JSON.parse(localStorage.getItem(key)));
                const fp = sessionFingerprintFromImportLaps(laps);
                if (fp && fp.start === startMs) return key;
            } catch {
            }
        }
        return null;
    }

    /** Missatge HTML per duplicat per hora d'inici (local vs import). */
    function buildImportDuplicateByStartMessage({ startMs, localKey, importKey, exFp, impFp }) {
        const startDate = new Date(startMs);
        const dateStr = formatDate(startDate);
        const timeStr = formatTime(startDate);
        const localName = localKey.replace(sessionPrefix, '');
        const importName = importKey.replace(sessionPrefix, '');
        const exLapsStr = exFp ? String(exFp.lapCount) : '?';
        const exDurStr = exFp ? formatDurationPlain(exFp.durationMs / 1000) : '?';
        const impLapsStr = String(impFp.lapCount);
        const impDurStr = formatDurationPlain(impFp.durationMs / 1000);
        const identical = exFp && importFingerprintsMatch(exFp, impFp);
        const identicalNote = identical
            ? '<br><br><i>Mateixa durada i nombre de voltes en ambdues versions.</i>'
            : '';
        return (
            `<b>Inici de sessió:</b> ${dateStr} — ${timeStr}<br><br>` +
            `<b>Sessió desada (aquest dispositiu)</b><br>` +
            `Clau: <b>${localName}</b><br>` +
            `Voltes: <b>${exLapsStr}</b> · Durada: <b>${exDurStr}</b><br><br>` +
            `<b>Sessió de l’import (fitxer)</b><br>` +
            `Clau: <b>${importName}</b><br>` +
            `Voltes: <b>${impLapsStr}</b> · Durada: <b>${impDurStr}</b>` +
            identicalNote +
            `<br><br><b>Substituir</b> la desada per la de l’import, o <b>conservar</b> la desada?`
        );
    }

    function importSessions() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);
                    if (!importData.sessions || !Array.isArray(importData.sessions)) {
                        alert('Format de fitxer incorrecte');
                        return;
                    }

                    let importedCount = 0;
                    let skippedCount = 0;

                    for (const session of importData.sessions) {
                        if (!session.key || session.data == null) continue;

                        const laps = normalizeSessionLapsForImport(session.data);
                        if (!laps) continue;
                        const impFp = sessionFingerprintFromImportLaps(laps);
                        if (!impFp) continue;

                        const keyByStart = findLocalKeyBySessionStartMs(impFp.start);

                        if (keyByStart) {
                            let exLaps = null;
                            try {
                                exLaps = normalizeImportLaps(JSON.parse(localStorage.getItem(keyByStart)));
                            } catch {
                            }
                            const exFp = sessionFingerprintFromImportLaps(exLaps);

                            const msg = buildImportDuplicateByStartMessage({
                                startMs: impFp.start,
                                localKey: keyByStart,
                                importKey: session.key,
                                exFp,
                                impFp
                            });

                            const replace = await showModal({
                                id: 'modal-import-session-conflict-start',
                                title: 'Sessió amb la mateixa hora d\'inici',
                                message: msg,
                                okText: 'Substituir',
                                cancelText: 'Conservar l\'anterior',
                                type: 'confirm',
                                buttonLayout: 'horizontal'
                            });
                            if (replace) {
                                localStorage.setItem(keyByStart, JSON.stringify(laps));
                                if (session.key !== keyByStart && localStorage.getItem(session.key)) {
                                    try {
                                        const other = normalizeImportLaps(JSON.parse(localStorage.getItem(session.key)));
                                        const oFp = sessionFingerprintFromImportLaps(other);
                                        if (oFp && oFp.start === impFp.start) {
                                            localStorage.removeItem(session.key);
                                        }
                                    } catch {
                                    }
                                }
                                importedCount++;
                            } else {
                                skippedCount++;
                            }
                            continue;
                        }

                        const rawAtKey = localStorage.getItem(session.key);
                        if (rawAtKey != null) {
                            let exLaps2 = null;
                            try {
                                exLaps2 = normalizeImportLaps(JSON.parse(rawAtKey));
                            } catch {
                            }
                            const exFp2 = sessionFingerprintFromImportLaps(exLaps2);
                            if (exFp2 && exFp2.start === impFp.start) {
                                const msg = buildImportDuplicateByStartMessage({
                                    startMs: impFp.start,
                                    localKey: session.key,
                                    importKey: session.key,
                                    exFp: exFp2,
                                    impFp
                                });
                                const replace2 = await showModal({
                                    id: 'modal-import-session-conflict-key',
                                    title: 'Sessió amb la mateixa hora d\'inici',
                                    message: msg,
                                    okText: 'Substituir',
                                    cancelText: 'Conservar l\'anterior',
                                    type: 'confirm',
                                    buttonLayout: 'horizontal'
                                });
                                if (replace2) {
                                    localStorage.setItem(session.key, JSON.stringify(laps));
                                    importedCount++;
                                } else {
                                    skippedCount++;
                                }
                                continue;
                            }

                            const replace3 = await showModal({
                                id: 'modal-import-session-key-collision',
                                title: 'Clau en ús',
                                message:
                                    `La clau <b>${session.key.replace(sessionPrefix, '')}</b> ja existeix amb una altra hora d\'inici.<br><br>` +
                                    `Vols <b>substituir</b> la sessió desada per la importada?`,
                                okText: 'Substituir',
                                cancelText: 'Conservar l\'anterior',
                                type: 'confirm',
                                buttonLayout: 'horizontal'
                            });
                            if (replace3) {
                                localStorage.setItem(session.key, JSON.stringify(laps));
                                importedCount++;
                            } else {
                                skippedCount++;
                            }
                            continue;
                        }

                        localStorage.setItem(session.key, JSON.stringify(laps));
                        importedCount++;
                    }

                    alert(`Importació: ${importedCount} sessions noves o actualitzades; ${skippedCount} conservades o omeses.`);
                    renderSessions();
                } catch (err) {
                    alert('Error en importar les sessions');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    // Toggle Wake Lock
    async function toggleWakeLock() {
        if (!wakeLockManager.isSupported) {
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

    // --- Modal de información al pulsar título VOLTES ---
    const showInfoModal = async () => {
        // Evitar que se abra el modal múltiples veces
        if (document.getElementById('info-modal-overlay')) {
            return;
        }


        // Crear contenedor del modal con opciones
        const modalContent = document.createElement('div');
        modalContent.style.textAlign = 'left';
        modalContent.style.width = '100%';

        const infoText = document.createElement('div');
        infoText.innerHTML = `
            <div style="text-align: center; margin-bottom: 8px;">
                
                <strong style="font-size: 1.9rem; border: 3px solid black; padding: 6px 12px; display: block; border-radius: 6px; background-color: yellow; color: black;">CONTROL VOLTES</strong>
            </div>
            <div style="text-align: center; margin-bottom: 6px; line-height: 1.3;">
                <span style="opacity: 0.8;">Versió: ${appVersion} ( ${appDateVersion} )</span>
            </div>
            <div style="text-align: center; margin-bottom: 8px; line-height: 1.3;">
                <strong>© 2025 - Albert Ruiz Pujol</strong> 
                ( <a href="mailto:ruiggi@gmail.com" style="color:rgb(255, 255, 255); text-decoration: none;">ruiggi@gmail.com</a> ) 
                <p>
                Repositori: <u><a href="https://github.com/ruiggi/ControlVoltes/" target="_blank" style="color:rgb(255, 255, 255); text-decoration: none;">https://github.com/ruiggi/ControlVoltes/</a></u>
                <br>
                Versió web: <u><a href="https://ruiggi.github.io/ControlVoltes/" target="_blank" style="color:rgb(255, 255, 255); text-decoration: none;">https://ruiggi.github.io/ControlVoltes/</a></u>
                <br>
                Descàrregues: <u><a href="https://github.com/ruiggi/ControlVoltes/releases" target="_blank" style="color:rgb(255, 255, 255); text-decoration: none;">https://github.com/ruiggi/ControlVoltes/releases</a></u>
                <br>
            </div>

            `;
        modalContent.appendChild(infoText);

        // Botones de acción
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.flexDirection = 'row';
        actionsContainer.style.gap = '8px';
        actionsContainer.style.marginTop = '10px';

        // Botón Forzar instalación
        const forceInstallBtn = document.createElement('button');
        forceInstallBtn.textContent = '📲  INSTAL·LAR';
        forceInstallBtn.style.padding = '10px';
        forceInstallBtn.style.backgroundColor = '#0d6efd';
        forceInstallBtn.style.color = '#fff';
        forceInstallBtn.style.border = 'none';
        forceInstallBtn.style.borderRadius = '6px';
        forceInstallBtn.style.fontWeight = '700';
        forceInstallBtn.style.cursor = 'pointer';
        forceInstallBtn.style.fontSize = '0.9rem';
        forceInstallBtn.style.flex = '1';
        forceInstallBtn.addEventListener('click', () => {
            const forceBtn = document.getElementById('force-install-btn');
            if (forceBtn) forceBtn.click();
            // Cerrar modal
            document.getElementById('info-modal-overlay')?.remove();
        });

        // Botón Actualizar aplicación
        const updateBtn = document.createElement('button');
        updateBtn.textContent = '🔄  ACTUALITZAR';
        updateBtn.style.padding = '10px';
        updateBtn.style.backgroundColor = '#0d6efd';
        updateBtn.style.color = '#fff';
        updateBtn.style.border = 'none';
        updateBtn.style.borderRadius = '6px';
        updateBtn.style.fontWeight = '700';
        updateBtn.style.cursor = 'pointer';
        updateBtn.style.fontSize = '0.9rem';
        updateBtn.style.flex = '1';
        updateBtn.addEventListener('click', async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    window.location.reload();
                }
            } catch (e) {
                alert('Error actualitzant l\'aplicació');
            }
        });

        actionsContainer.appendChild(forceInstallBtn);
        actionsContainer.appendChild(updateBtn);
        modalContent.appendChild(actionsContainer);

        // Mostrar modal personalizado
        const overlay = document.createElement('div');
        overlay.id = 'info-modal-overlay';
        overlay.className = 'info-modal-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.75)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';

        const modal = document.createElement('div');
        modal.className = 'info-modal';
        modal.style.backgroundColor = 'var(--card-bg-color)';
        modal.style.borderRadius = '12px';
        modal.style.padding = '16px';
        modal.style.maxWidth = '500px';
        modal.style.width = '95vw';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        modal.style.border = '1px solid var(--accent-color)';

        modal.appendChild(modalContent);

        // Switch para el orden de las vueltas
        const orderSwitchContainer = document.createElement('div');
        orderSwitchContainer.style.display = 'flex';
        orderSwitchContainer.style.alignItems = 'center';
        orderSwitchContainer.style.justifyContent = 'space-between';
        orderSwitchContainer.style.gap = '10px';
        orderSwitchContainer.style.padding = '8px';
        orderSwitchContainer.style.marginTop = '12px';
        orderSwitchContainer.style.borderRadius = '8px';
        orderSwitchContainer.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
        orderSwitchContainer.style.border = '1px solid var(--accent-color)';

        const orderLabel = document.createElement('span');
        orderLabel.textContent = 'ORDRE VOLTES:';
        orderLabel.style.fontWeight = '600';
        orderLabel.style.fontSize = '0.9rem';
        orderLabel.style.color = 'var(--text-color)';
        orderLabel.style.whiteSpace = 'nowrap';

        const orderSwitch = document.createElement('div');
        orderSwitch.role = 'switch';
        orderSwitch.tabIndex = 0;
        orderSwitch.setAttribute('aria-checked', String(lapsOrderDescending));
        orderSwitch.style.display = 'inline-flex';
        orderSwitch.style.alignItems = 'center';
        orderSwitch.style.padding = '2px';
        orderSwitch.style.width = '34px';
        orderSwitch.style.height = '20px';
        orderSwitch.style.borderRadius = '999px';
        orderSwitch.style.cursor = 'pointer';
        orderSwitch.style.transition = 'background 0.2s';
        orderSwitch.style.boxSizing = 'border-box';
        orderSwitch.style.background = lapsOrderDescending ? '#0d6efd' : '#666';
        orderSwitch.style.flexShrink = '0';

        const orderDot = document.createElement('span');
        orderDot.style.width = '16px';
        orderDot.style.height = '16px';
        orderDot.style.borderRadius = '50%';
        orderDot.style.background = '#fff';
        orderDot.style.transition = 'transform 0.2s';
        orderDot.style.transform = lapsOrderDescending ? 'translateX(14px)' : 'translateX(0)';

        orderSwitch.appendChild(orderDot);

        const orderStateText = document.createElement('span');
        orderStateText.innerHTML = lapsOrderDescending ? 'DESCENDENT<br>(Més recent a dalt)' : 'ASCENDENT<br>(Més recent al final)';
        orderStateText.style.fontWeight = '500';
        orderStateText.style.fontSize = '0.85rem';
        orderStateText.style.color = 'var(--text-color)';
        orderStateText.style.opacity = '0.9';
        orderStateText.style.textAlign = 'right';
        orderStateText.style.lineHeight = '1.3';

        // Event listener para el switch
        orderSwitch.addEventListener('click', () => {
            const newValue = !lapsOrderDescending;
            saveLapsOrderPreference(newValue);

            // Actualizar UI del switch
            orderSwitch.style.background = newValue ? '#0d6efd' : '#666';
            orderDot.style.transform = newValue ? 'translateX(14px)' : 'translateX(0)';
            orderSwitch.setAttribute('aria-checked', String(newValue));

            // Actualizar texto del estado
            orderStateText.innerHTML = newValue ? 'DESCENDENT<br>(Més recent a dalt)' : 'ASCENDENT<br>(Més recent al final)';

            // Re-renderizar las vueltas con el nuevo orden
            renderLaps();
        });

        // Agregar soporte de teclado
        orderSwitch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                orderSwitch.click();
            }
        });

        orderSwitchContainer.appendChild(orderLabel);
        orderSwitchContainer.appendChild(orderSwitch);
        orderSwitchContainer.appendChild(orderStateText);
        modal.appendChild(orderSwitchContainer);

        // --- Switch para botones de volumen ---
        const volumeButtonsSwitchContainer = document.createElement('div');
        volumeButtonsSwitchContainer.style.display = 'flex';
        volumeButtonsSwitchContainer.style.alignItems = 'center';
        volumeButtonsSwitchContainer.style.justifyContent = 'space-between';
        volumeButtonsSwitchContainer.style.gap = '10px';
        volumeButtonsSwitchContainer.style.padding = '8px';
        volumeButtonsSwitchContainer.style.marginTop = '6px';
        volumeButtonsSwitchContainer.style.borderRadius = '8px';
        volumeButtonsSwitchContainer.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
        volumeButtonsSwitchContainer.style.border = '1px solid var(--accent-color)';

        const volumeButtonsLabel = document.createElement('span');
        volumeButtonsLabel.textContent = '🎚️ BOTONS VOLUM:';
        volumeButtonsLabel.style.fontWeight = '600';
        volumeButtonsLabel.style.fontSize = '0.9rem';
        volumeButtonsLabel.style.color = 'var(--text-color)';
        volumeButtonsLabel.style.whiteSpace = 'nowrap';
        volumeButtonsLabel.style.cursor = 'pointer';
        volumeButtonsLabel.style.userSelect = 'none';
        volumeButtonsLabel.style.transition = 'all 0.2s';
        volumeButtonsLabel.title = 'Click para abrir test de botones físicos';
        
        // Efecto hover
        volumeButtonsLabel.addEventListener('mouseenter', () => {
            volumeButtonsLabel.style.color = '#0d6efd';
            volumeButtonsLabel.style.transform = 'scale(1.05)';
        });
        volumeButtonsLabel.addEventListener('mouseleave', () => {
            volumeButtonsLabel.style.color = 'var(--text-color)';
            volumeButtonsLabel.style.transform = 'scale(1)';
        });
        
        // Abrir modal de test al hacer click
        volumeButtonsLabel.addEventListener('click', () => {
            if (typeof window.showVolumeButtonsTestModal === 'function') {
                window.showVolumeButtonsTestModal();
            } else {
                console.error('Modal de test no disponible');
            }
        });

        const volumeButtonsSwitch = document.createElement('div');
        volumeButtonsSwitch.role = 'switch';
        volumeButtonsSwitch.tabIndex = 0;
        volumeButtonsSwitch.setAttribute('aria-checked', String(appState.settings.volumeButtonsEnabled));
        volumeButtonsSwitch.style.display = 'inline-flex';
        volumeButtonsSwitch.style.alignItems = 'center';
        volumeButtonsSwitch.style.padding = '2px';
        volumeButtonsSwitch.style.width = '34px';
        volumeButtonsSwitch.style.height = '20px';
        volumeButtonsSwitch.style.borderRadius = '999px';
        volumeButtonsSwitch.style.cursor = 'pointer';
        volumeButtonsSwitch.style.transition = 'background 0.2s';
        volumeButtonsSwitch.style.boxSizing = 'border-box';
        volumeButtonsSwitch.style.background = appState.settings.volumeButtonsEnabled ? '#28a745' : '#666';
        volumeButtonsSwitch.style.flexShrink = '0';

        const volumeButtonsDot = document.createElement('span');
        volumeButtonsDot.style.width = '16px';
        volumeButtonsDot.style.height = '16px';
        volumeButtonsDot.style.borderRadius = '50%';
        volumeButtonsDot.style.background = '#fff';
        volumeButtonsDot.style.transition = 'transform 0.2s';
        volumeButtonsDot.style.transform = appState.settings.volumeButtonsEnabled ? 'translateX(14px)' : 'translateX(0)';

        volumeButtonsSwitch.appendChild(volumeButtonsDot);

        const volumeButtonsStateText = document.createElement('span');
        volumeButtonsStateText.innerHTML = appState.settings.volumeButtonsEnabled ? 'ACTIVAT<br>(Marcar voltes)' : 'DESACTIVAT<br>(No usar botons)';
        volumeButtonsStateText.style.fontWeight = '500';
        volumeButtonsStateText.style.fontSize = '0.85rem';
        volumeButtonsStateText.style.color = 'var(--text-color)';
        volumeButtonsStateText.style.opacity = '0.9';
        volumeButtonsStateText.style.textAlign = 'right';
        volumeButtonsStateText.style.lineHeight = '1.3';

        // Event listener para el switch
        volumeButtonsSwitch.addEventListener('click', () => {
            const newValue = !appState.settings.volumeButtonsEnabled;
            appState.settings.volumeButtonsEnabled = newValue;
            saveSettings();

            // Actualizar UI del switch
            volumeButtonsSwitch.style.background = newValue ? '#28a745' : '#666';
            volumeButtonsDot.style.transform = newValue ? 'translateX(14px)' : 'translateX(0)';
            volumeButtonsSwitch.setAttribute('aria-checked', String(newValue));

            // Actualizar texto del estado
            volumeButtonsStateText.innerHTML = newValue ? 'ACTIVAT<br>(Marcar voltes)' : 'DESACTIVAT<br>(No usar botons)';

            // Mostrar mensaje de confirmación
            if (newValue && navigator.vibrate) {
                navigator.vibrate([50, 100, 50]); // Patrón de vibración de confirmación
            }
        });

        // Agregar soporte de teclado
        volumeButtonsSwitch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                volumeButtonsSwitch.click();
            }
        });

        volumeButtonsSwitchContainer.appendChild(volumeButtonsLabel);
        volumeButtonsSwitchContainer.appendChild(volumeButtonsSwitch);
        volumeButtonsSwitchContainer.appendChild(volumeButtonsStateText);
        modal.appendChild(volumeButtonsSwitchContainer);

        // --- Switch para exportación CSV como archivo ---
        const csvExportSwitchContainer = document.createElement('div');
        csvExportSwitchContainer.style.display = 'flex';
        csvExportSwitchContainer.style.alignItems = 'center';
        csvExportSwitchContainer.style.justifyContent = 'space-between';
        csvExportSwitchContainer.style.gap = '10px';
        csvExportSwitchContainer.style.padding = '8px';
        csvExportSwitchContainer.style.marginTop = '6px';
        csvExportSwitchContainer.style.borderRadius = '8px';
        csvExportSwitchContainer.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
        csvExportSwitchContainer.style.border = '1px solid var(--accent-color)';

        const csvExportLabel = document.createElement('span');
        csvExportLabel.textContent = '📄 EXPORTAR CSV:';
        csvExportLabel.style.fontWeight = '600';
        csvExportLabel.style.fontSize = '0.9rem';
        csvExportLabel.style.color = 'var(--text-color)';
        csvExportLabel.style.whiteSpace = 'nowrap';

        const csvExportSwitch = document.createElement('div');
        csvExportSwitch.role = 'switch';
        csvExportSwitch.tabIndex = 0;
        csvExportSwitch.setAttribute('aria-checked', String(appState.settings.csvExportAsFile));
        csvExportSwitch.style.display = 'inline-flex';
        csvExportSwitch.style.alignItems = 'center';
        csvExportSwitch.style.padding = '2px';
        csvExportSwitch.style.width = '34px';
        csvExportSwitch.style.height = '20px';
        csvExportSwitch.style.borderRadius = '999px';
        csvExportSwitch.style.cursor = 'pointer';
        csvExportSwitch.style.transition = 'background 0.2s';
        csvExportSwitch.style.boxSizing = 'border-box';
        csvExportSwitch.style.background = appState.settings.csvExportAsFile ? '#28a745' : '#666';
        csvExportSwitch.style.flexShrink = '0';

        const csvExportDot = document.createElement('span');
        csvExportDot.style.width = '16px';
        csvExportDot.style.height = '16px';
        csvExportDot.style.borderRadius = '50%';
        csvExportDot.style.background = '#fff';
        csvExportDot.style.transition = 'transform 0.2s';
        csvExportDot.style.transform = appState.settings.csvExportAsFile ? 'translateX(14px)' : 'translateX(0)';

        csvExportSwitch.appendChild(csvExportDot);

        const csvExportStateText = document.createElement('span');
        csvExportStateText.innerHTML = appState.settings.csvExportAsFile ? 'ARXIU<br>(Generar arxiu)' : 'TEXT<br>(Compartir text)';
        csvExportStateText.style.fontWeight = '500';
        csvExportStateText.style.fontSize = '0.85rem';
        csvExportStateText.style.color = 'var(--text-color)';
        csvExportStateText.style.opacity = '0.9';
        csvExportStateText.style.textAlign = 'right';
        csvExportStateText.style.lineHeight = '1.3';

        // Event listener para el switch
        csvExportSwitch.addEventListener('click', () => {
            const newValue = !appState.settings.csvExportAsFile;
            appState.settings.csvExportAsFile = newValue;
            saveSettings();

            // Actualizar UI del switch
            csvExportSwitch.style.background = newValue ? '#28a745' : '#666';
            csvExportDot.style.transform = newValue ? 'translateX(14px)' : 'translateX(0)';
            csvExportSwitch.setAttribute('aria-checked', String(newValue));

            // Actualizar texto del estado
            csvExportStateText.innerHTML = newValue ? 'ARXIU<br>(Generar arxiu)' : 'TEXT<br>(Compartir text)';
        });

        // Agregar soporte de teclado
        csvExportSwitch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                csvExportSwitch.click();
            }
        });

        csvExportSwitchContainer.appendChild(csvExportLabel);
        csvExportSwitchContainer.appendChild(csvExportSwitch);
        csvExportSwitchContainer.appendChild(csvExportStateText);
        modal.appendChild(csvExportSwitchContainer);

        // Botón ACEPTAR
        const okButton = document.createElement('button');
        okButton.textContent = 'TANCAR';
        okButton.style.width = '100%';
        okButton.style.padding = '10px';
        okButton.style.marginTop = '10px';
        okButton.style.backgroundColor = '#28a745';
        okButton.style.color = '#fff';
        okButton.style.border = 'none';
        okButton.style.borderRadius = '6px';
        okButton.style.fontWeight = '700';
        okButton.style.cursor = 'pointer';
        okButton.style.fontSize = '1rem';
        okButton.style.textTransform = 'uppercase';
        okButton.addEventListener('click', () => overlay.remove());

        modal.appendChild(okButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Cerrar al hacer clic fuera del modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    };

    // Añadir event listener al contenedor del título (incluye tanto texto como icono)
    const titleLeft = document.getElementById('title-left');
    if (titleLeft) {
        titleLeft.style.cursor = 'pointer';
        titleLeft.addEventListener('click', showInfoModal);
    }

    // Cargar configuración inicial
    loadSettings();

    // Inicializar botones de import/export de sesiones
    initImportExportButtons();

    // Inicializar Wake Lock
    // Establecer texto inicial por defecto
    if (wakeLabel) wakeLabel.innerHTML = `${screenIcon} ON`;
    loadWakeLockPreference();

    // Cargar preferencia de orden de vueltas
    loadLapsOrderPreference();

    // Inicializar botón de bloqueo
    const lockBtn = document.getElementById('lock-btn');
    const lockLabel = document.getElementById('lock-label');
    const lockToggle = document.getElementById('lock-toggle');

    if (lockBtn && lockLabel && lockToggle) {
        // Establecer estado inicial
        lockBtn.innerHTML = appState.settings.isLocked ? lockIcon : unlockIcon;
        lockLabel.textContent = appState.settings.isLocked ? 'BLOCAT' : 'OBERT';
        lockBtn.style.color = appState.settings.isLocked ? '#dc3545' : '#28a745';
        lockLabel.style.color = appState.settings.isLocked ? '#dc3545' : '#28a745';
        lockToggle.style.borderColor = appState.settings.isLocked ? '#dc3545' : '#28a745';

        // Event listener
        lockToggle.addEventListener('click', toggleLock);

        // Aplicar estado inicial
        applyLockState();
    }

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
    timeContainer.style.justifyContent = 'center'; // Centrado para mejor distribución
    timeContainer.style.padding = '0 5px'; // Reducido de 20px a 5px
    timeContainer.style.gap = '5px'; // Pequeño gap entre elementos

    const playIconSpan = document.createElement('span');
    playIconSpan.innerHTML = playIcon;
    playIconSpan.style.display = 'flex';
    playIconSpan.style.alignItems = 'left';
    playIconSpan.style.flexShrink = '0';
    playIconSpan.style.marginRight = '150'; // Sin margen adicional

    clockElement.style.fontSize = '4rem';
    clockElement.style.flex = '1 1 auto'; // Permite que se ajuste
    clockElement.style.textAlign = 'center';
    clockElement.style.margin = '0'; // Sin márgenes
    clockElement.style.fontFamily = '"Arial Narrow", Arial, sans-serif';
    clockElement.style.letterSpacing = '-0.08em'; // Más compacto (de -0.05em a -0.08em)
    clockElement.style.minWidth = '0'; // Permite compresión si es necesario

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

    // Reanudar grabación si quedó activa al salir
    const restoredActiveRecording = restoreActiveRecordingState();
    if (restoredActiveRecording) {
        registrationView.style.display = 'flex';
        sessionsView.style.display = 'none';
    }

    // Afegir estils al clock container
    // Fondo por defecto (no en grabación)
    clockContainer.style.backgroundColor = '#2E7D32';
    clockContainer.style.cursor = 'pointer';
    clockContainer.style.padding = '20px';
    clockContainer.style.borderRadius = '8px';
    clockContainer.style.transition = 'background-color 0.2s ease';

    // Desactivar cambios de fondo por hover para no interferir con grabación
    try { clockContainer.addEventListener && clockContainer.addEventListener('mouseover', () => { }); } catch { }
    try { clockContainer.addEventListener && clockContainer.addEventListener('mouseout', () => { }); } catch { }

    // In the initialization section, modify summary container texts
    const summaryContainer = document.getElementById('summary-container');
    const summaryLabels = [
        { icon: workIcon, text: 'TREBALL' },
        { icon: restIcon, text: 'DESCANS' },
        { icon: totalIcon, text: 'TOTAL' }
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

    // Clock container styles applied via CSS classes
    clockContainer.style.flexDirection = 'column';
    clockContainer.style.alignItems = 'center';
    clockContainer.style.justifyContent = 'center';
    clockContainer.style.padding = '20px';
    clockContainer.style.borderRadius = '8px';
    clockContainer.style.cursor = 'pointer';
    clockContainer.style.transition = 'background-color 0.2s ease';
    clockContainer.style.maxWidth = '100%';
    clockContainer.style.width = '100%';
    clockContainer.style.boxSizing = 'border-box';

    // Note: Modal styles are now in styles.css - no need to create them dynamically

    // CRITICAL: Initialize registration-view with flex display to ensure scrolling works
    // This must be done after DOM is ready to override any inline styles from HTML
    if (registrationView) {
        registrationView.style.display = 'flex';
    }
    if (sessionsView) {
        sessionsView.style.display = 'none';
    }

    // CRITICAL: Dynamic height calculation for laps container
    // This ensures the laps container fills all available vertical space
    // Hacerla global para poder llamarla desde viewSession
    window.updateLapsContainerHeight = () => {
        try {
            if (!lapsContainer) return;

            // Get the heights of all fixed elements
            const appTitle = document.getElementById('app-title');
            const clockContainer = document.getElementById('clock-container');
            const summaryContainer = document.getElementById('summary-container');
            const controlsContainer = document.getElementById('controls-container');
            const sessionTopBar = document.getElementById('session-top-bar'); // Barra superior cuando se visualiza una sesión guardada

            // Calculate total height of fixed elements
            let fixedHeight = 0;
            if (appTitle) fixedHeight += appTitle.offsetHeight;
            if (sessionTopBar) fixedHeight += sessionTopBar.offsetHeight; // Incluir la barra superior si existe
            if (clockContainer) fixedHeight += clockContainer.offsetHeight;
            if (summaryContainer) fixedHeight += summaryContainer.offsetHeight;
            if (controlsContainer) fixedHeight += controlsContainer.offsetHeight;

            // Add gaps and padding (2px gap between elements, 5px padding on main-container)
            const gaps = 2 * 3; // 3 gaps between 4 elements
            const padding = 10; // 5px top + 5px bottom on main-container
            const extraSpace = 20; // Safety margin
            const bottomPadding = 50; // Padding-bottom del contenedor de vueltas para que la última vuelta se vea completa

            // Calculate available height for laps container
            const availableHeight = window.innerHeight - fixedHeight - gaps - padding - extraSpace - bottomPadding;

            // Set the height (minimum 200px)
            const finalHeight = Math.max(200, availableHeight);
            lapsContainer.style.height = `${finalHeight}px`;
            lapsContainer.style.minHeight = `${finalHeight}px`;
            lapsContainer.style.maxHeight = `${finalHeight}px`;
        } catch (e) {
            console.error('Error updating laps container height:', e);
        }
    };

    // Call on initialization
    setTimeout(window.updateLapsContainerHeight, 100);

    // Update on window resize
    window.addEventListener('resize', window.updateLapsContainerHeight);
}

// Detectar entorno y inicializar aplicación
if (window.cordova) {
    // Cordova: Esperar evento deviceready
    document.addEventListener('deviceready', initApp, false);
} else {
    // Web/PWA: Usar DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initApp);
}
