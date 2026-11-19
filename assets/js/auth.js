/**
 * PMO FIBEX TELECOM - MÓDULO DE AUTENTICACIÓN Y SEGURIDAD (FIREBASE AUTH)
 * Controla el acceso al Dashboard, bloquea la descarga de datos sin sesión
 * y limpia la caché sensible al cerrar sesión.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURACIÓN DE FIREBASE (PEGA AQUÍ TUS CREDENCIALES DEL PASO 1)
     ========================================================================== */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCUgdndb6sy3f2S9OJTLpbO7K841Cwhlds",
    authDomain: "pmo-fibex-seguro.firebaseapp.com",
    projectId: "pmo-fibex-seguro",
    storageBucket: "pmo-fibex-seguro.firebasestorage.app",
    messagingSenderId: "874188194384",
    appId: "1:874188194384:web:9654ac4ef56b197c6b8755"
  };

  // Claves de localStorage que se limpian al cerrar sesión por seguridad
  const SENSITIVE_STORAGE_KEYS = [
    'pmo_sheets_url',
    'pmo_cached_sheets_data',
    'pmo_last_sync_time',
    'pmo_last_modified_date'
  ];

  let authInstance = null;
  let dashboardBooted = false;

  /* ==========================================================================
     2. UTILIDADES DE INTERFAZ DE LOGIN
     ========================================================================== */

  function isConfigPlaceholder() {
    return (
      !FIREBASE_CONFIG.apiKey ||
      FIREBASE_CONFIG.apiKey.includes('PEGAR_TU_') ||
      FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY'
    );
  }

  function showAlert(type, message) {
    const alertBox = document.getElementById('auth-alert-box');
    const alertText = document.getElementById('auth-alert-text');
    if (!alertBox || !alertText) return;

    alertBox.className = `auth-alert show auth-alert-${type}`;
    alertText.textContent = message;
  }

  function hideAlert() {
    const alertBox = document.getElementById('auth-alert-box');
    if (alertBox) {
      alertBox.className = 'auth-alert';
    }
  }

  function setCheckingState(isChecking) {
    const checkingEl = document.getElementById('auth-checking-state');
    const formEl = document.getElementById('pmo-login-form');
    if (checkingEl) checkingEl.style.display = isChecking ? 'flex' : 'none';
    if (formEl) formEl.style.display = isChecking ? 'none' : 'block';
  }

  function setSubmitLoading(isLoading) {
    const btn = document.getElementById('btn-auth-submit');
    const btnText = document.getElementById('btn-auth-submit-text');
    if (!btn || !btnText) return;
    btn.disabled = isLoading;
    btnText.textContent = isLoading ? 'Verificando acceso...' : 'Iniciar Sesión';
  }

  function translateFirebaseError(error) {
    const code = (error && error.code) ? error.code : '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos. Verifica tus credenciales.';
      case 'auth/invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada por el administrador PMO.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Por seguridad, espera unos minutos o restablece tu contraseña.';
      case 'auth/network-request-failed':
        return 'Error de red. Verifica tu conexión a Internet.';
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      case 'auth/invalid-api-key':
        return 'La API Key de Firebase en assets/js/auth.js no es válida.';
      default:
        return error && error.message
          ? `Error de autenticación (${code || 'desconocido'})`
          : 'No se pudo iniciar sesión. Intenta nuevamente.';
    }
  }

  function purgeSensitiveCache() {
    try {
      SENSITIVE_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (e) {}
  }

  /* ==========================================================================
     3. CONTROL DE SESIÓN Y ARRANQUE PROTEGIDO DEL DASHBOARD
     ========================================================================== */

  async function loadProtectedSheetsUrlFromFirestore() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
      return;
    }
    try {
      const db = firebase.firestore();
      const docSnap = await db.collection('config').doc('pmo').get();
      if (docSnap.exists) {
        const data = docSnap.data() || {};
        if (data.sheetsUrl && typeof data.sheetsUrl === 'string') {
          const cleanUrl = data.sheetsUrl.trim();
          window.PMO_SECURE_SHEETS_URL = cleanUrl;
          try {
            localStorage.setItem('pmo_sheets_url', cleanUrl);
          } catch (e) {}
        }
      } else {
        console.warn('Firestore: No se encontró el documento config/pmo con el campo sheetsUrl.');
      }
    } catch (err) {
      console.warn('No se pudo obtener sheetsUrl desde Cloud Firestore:', err);
    }
  }

  async function onUserAuthenticated(user) {
    // 1. Mostrar correo del usuario en la barra superior
    const emailEl = document.getElementById('auth-user-email');
    if (emailEl) {
      emailEl.textContent = user.email || 'Usuario Autorizado';
      emailEl.title = `Sesión activa: ${user.email || ''}`;
    }

    // 2. Obtener la URL protegida de Google Sheets desde Cloud Firestore antes de arrancar app.js
    await loadProtectedSheetsUrlFromFirestore();

    // 3. Desbloquear visualmente el Dashboard
    document.body.classList.add('pmo-authenticated');

    // 4. Arrancar la lógica de app.js una única vez (ahora que el DOM es visible y tenemos la URL)
    if (!dashboardBooted && typeof window.PMO_START_APP === 'function') {
      dashboardBooted = true;
      window.PMO_START_APP();
    }
  }

  function onUserSignedOut() {
    window.PMO_SECURE_SHEETS_URL = '';
    document.body.classList.remove('pmo-authenticated');
    purgeSensitiveCache();
    setCheckingState(false);
    setSubmitLoading(false);
  }

  /* ==========================================================================
     4. EVENTOS DEL FORMULARIO Y BOTONES
     ========================================================================== */

  function setupAuthUIEvents() {
    const form = document.getElementById('pmo-login-form');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const togglePassBtn = document.getElementById('btn-toggle-password');
    const forgotPassBtn = document.getElementById('btn-forgot-password');
    const logoutBtn = document.getElementById('btn-auth-logout');

    // Mostrar / Ocultar contraseña
    if (togglePassBtn && passwordInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePassBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    }

    // Envío de formulario de Login
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        if (isConfigPlaceholder()) {
          showAlert(
            'warning',
            'Falta pegar tu firebaseConfig en el archivo assets/js/auth.js (líneas 13-20).'
          );
          return;
        }

        if (!authInstance) {
          showAlert('error', 'El SDK de Firebase no pudo inicializarse.');
          return;
        }

        const email = (emailInput ? emailInput.value : '').trim();
        const password = passwordInput ? passwordInput.value : '';

        if (!email || !password) {
          showAlert('warning', 'Por favor ingresa tu correo corporativo y contraseña.');
          return;
        }

        setSubmitLoading(true);
        try {
          await authInstance.signInWithEmailAndPassword(email, password);
          if (passwordInput) passwordInput.value = '';
        } catch (err) {
          setSubmitLoading(false);
          showAlert('error', translateFirebaseError(err));
        }
      });
    }

    // Recuperación de contraseña por correo
    if (forgotPassBtn) {
      forgotPassBtn.addEventListener('click', async () => {
        hideAlert();

        if (isConfigPlaceholder() || !authInstance) {
          showAlert('warning', 'Configura primero tus credenciales de Firebase en assets/js/auth.js.');
          return;
        }

        const email = (emailInput ? emailInput.value : '').trim();
        if (!email) {
          showAlert('warning', 'Escribe tu correo electrónico en el campo superior y vuelve a hacer clic en "¿Olvidaste tu contraseña?".');
          if (emailInput) emailInput.focus();
          return;
        }

        try {
          await authInstance.sendPasswordResetEmail(email);
          showAlert('success', `Se envió un enlace de recuperación a ${email}. Revisa tu bandeja de entrada o spam.`);
        } catch (err) {
          showAlert('error', translateFirebaseError(err));
        }
      });
    }

    // Botón Cerrar Sesión en la Navbar
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        purgeSensitiveCache();
        if (authInstance) {
          try {
            await authInstance.signOut();
          } catch (e) {}
        }
        // Recargar página en limpio para vaciar memoria RAM y gráficas de Chart.js
        window.location.reload();
      });
    }
  }

  /* ==========================================================================
     5. INICIALIZACIÓN DE FIREBASE
     ========================================================================== */

  function initFirebaseAuth() {
    setupAuthUIEvents();

    if (isConfigPlaceholder()) {
      setCheckingState(false);
      showAlert(
        'warning',
        'Configuración pendiente: Pega tu bloque firebaseConfig en assets/js/auth.js para activar el inicio de sesión.'
      );
      return;
    }

    if (typeof firebase === 'undefined' || !firebase.auth) {
      setCheckingState(false);
      showAlert('error', 'No se pudo cargar el SDK de Firebase. Verifica tu conexión a Internet.');
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      authInstance = firebase.auth();

      // Persistencia de sesión en la pestaña/navegador actual
      authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      authInstance.onAuthStateChanged((user) => {
        if (user) {
          onUserAuthenticated(user);
        } else {
          onUserSignedOut();
        }
      });
    } catch (err) {
      setCheckingState(false);
      showAlert('error', 'Error al inicializar Firebase: ' + (err.message || err));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseAuth);
  } else {
    initFirebaseAuth();
  }
})();
