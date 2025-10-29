# 🎛️ Guía: Usar Botones Físicos de Volumen en Android Cordova

**Propósito:** Esta guía contiene toda la información necesaria para implementar la detección de botones físicos de volumen en aplicaciones Android Cordova, lista para usar como prompt en Cursor.ai u otras herramientas de IA.

---

## 📋 Contexto del Problema

En Android 5.0+, los eventos nativos de Cordova (`volumeupbutton` y `volumedownbutton`) **NO funcionan** debido a cambios en la API de Android relacionados con seguridad y privacidad.

### ❌ No Funciona (Método Nativo)
```javascript
// Estos eventos NO funcionan en Android moderno
document.addEventListener('volumeupbutton', callback, false);
document.addEventListener('volumedownbutton', callback, false);
```

### ✅ Solución
Crear un **plugin personalizado de Cordova** que intercepte los eventos de teclado a nivel nativo (Java) antes de que el sistema los procese.

---

## 🏗️ Arquitectura de la Solución

### Componentes del Plugin

```
VolumeButtonsPlugin/
├── plugin.xml                  # Configuración del plugin Cordova
├── package.json                # Metadatos del plugin
├── www/
│   └── VolumeButtons.js        # Interface JavaScript (bridge)
└── src/
    └── android/
        └── VolumeButtons.java  # Implementación nativa Android
```

---

## 📄 Archivos Completos del Plugin

### 1. `plugin.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plugin xmlns="http://apache.org/cordova/ns/plugins/1.0"
    id="cordova-plugin-volume-buttons"
    version="1.0.0">
    
    <name>Volume Buttons</name>
    <description>Captura eventos de botones de volumen físicos en Android</description>
    
    <js-module src="www/VolumeButtons.js" name="VolumeButtons">
        <clobbers target="VolumeButtons" />
    </js-module>
    
    <platform name="android">
        <config-file target="res/xml/config.xml" parent="/*">
            <feature name="VolumeButtons">
                <param name="android-package" value="com.test.volumebuttons.VolumeButtons"/>
                <param name="onload" value="true" />
            </feature>
        </config-file>
        
        <source-file src="src/android/VolumeButtons.java" target-dir="src/com/test/volumebuttons" />
    </platform>
</plugin>
```

**Puntos clave:**
- `onload="true"` → El plugin se inicializa automáticamente al arrancar la app
- `clobbers target="VolumeButtons"` → Expone `VolumeButtons` como objeto global JavaScript

---

### 2. `package.json`

```json
{
  "name": "cordova-plugin-volume-buttons",
  "version": "1.0.0",
  "description": "Captura eventos de botones de volumen en Android",
  "cordova": {
    "id": "cordova-plugin-volume-buttons",
    "platforms": [
      "android"
    ]
  },
  "keywords": [
    "cordova",
    "volume",
    "buttons",
    "hardware",
    "ecosystem:cordova",
    "cordova-android"
  ],
  "author": "Test Team",
  "license": "MIT"
}
```

---

### 3. `www/VolumeButtons.js`

```javascript
var exec = require('cordova/exec');

var VolumeButtons = {
    onVolumeUp: function(callback) {
        document.addEventListener('volumeup', callback, false);
    },
    onVolumeDown: function(callback) {
        document.addEventListener('volumedown', callback, false);
    },
    _fireEvent: function(type) {
        var event = new Event(type);
        document.dispatchEvent(event);
    }
};

module.exports = VolumeButtons;
```

**Puntos clave:**
- Interface JavaScript simple que facilita el uso desde la app
- `_fireEvent` es llamado desde el código Java nativo para disparar eventos DOM
- Los eventos son: `'volumeup'` y `'volumedown'`

---

### 4. `src/android/VolumeButtons.java`

```java
package com.test.volumebuttons;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.CordovaInterface;
import org.json.JSONArray;
import org.json.JSONException;
import android.view.KeyEvent;
import android.view.View;
import android.util.Log;
import android.app.Activity;

public class VolumeButtons extends CordovaPlugin {
    
    private static final String TAG = "VolumeButtons";
    
    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Log.d(TAG, "Plugin VolumeButtons inicializado");
        
        // Configurar listener en la actividad
        final Activity activity = cordova.getActivity();
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                setupVolumeButtonListener(activity);
            }
        });
    }
    
    private void setupVolumeButtonListener(final Activity activity) {
        View decorView = activity.getWindow().getDecorView();
        
        decorView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                        Log.d(TAG, "VOLUMEN+ detectado");
                        fireEvent("volumeup");
                        return true; // Consumir el evento para evitar que cambie el volumen
                    } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                        Log.d(TAG, "VOLUMEN- detectado");
                        fireEvent("volumedown");
                        return true; // Consumir el evento para evitar que cambie el volumen
                    }
                }
                return false;
            }
        });
        
        // Hacer que la vista sea focusable para recibir eventos de teclado
        decorView.setFocusableInTouchMode(true);
        decorView.requestFocus();
        
        Log.d(TAG, "Listener de botones de volumen configurado");
    }
    
    private void fireEvent(final String eventType) {
        cordova.getActivity().runOnUiThread(new Runnable() {
            public void run() {
                webView.loadUrl("javascript:VolumeButtons._fireEvent('" + eventType + "');");
                Log.d(TAG, "Evento disparado: " + eventType);
            }
        });
    }
}
```

**Puntos clave técnicos:**

1. **`initialize()`**: Se ejecuta automáticamente al iniciar la app (gracias a `onload="true"`)
2. **`setupVolumeButtonListener()`**: Configura el listener en la vista decorativa (root view)
3. **`onKey()`**: Intercepta eventos de teclado
   - `KEYCODE_VOLUME_UP` y `KEYCODE_VOLUME_DOWN` → Botones físicos de volumen
   - `return true` → Consume el evento (evita que cambie el volumen)
   - `return false` → Deja pasar el evento (comportamiento normal)
4. **`fireEvent()`**: Ejecuta JavaScript en el WebView para disparar eventos DOM
5. **`setFocusableInTouchMode(true)` + `requestFocus()`**: Necesario para recibir eventos de teclado

---

## 🚀 Instalación del Plugin

### Paso 1: Crear la estructura del plugin

```bash
# En tu proyecto Cordova, crear carpeta del plugin
cd tu-proyecto-cordova
mkdir -p VolumeButtonsPlugin/www
mkdir -p VolumeButtonsPlugin/src/android

# Crear los archivos (copiar contenido de arriba):
# - VolumeButtonsPlugin/plugin.xml
# - VolumeButtonsPlugin/package.json
# - VolumeButtonsPlugin/www/VolumeButtons.js
# - VolumeButtonsPlugin/src/android/VolumeButtons.java
```

### Paso 2: Instalar el plugin

```bash
cd tu-proyecto-cordova

# Instalar plugin desde directorio local
cordova plugin add ./VolumeButtonsPlugin

# Verificar instalación
cordova plugin list
# Debe mostrar: cordova-plugin-volume-buttons 1.0.0 "Volume Buttons"
```

### Paso 3: Compilar la app

```bash
# Limpiar builds anteriores
cordova clean android

# Compilar
cordova build android

# Instalar en dispositivo (conectado por USB)
cordova run android
```

---

## 💻 Uso en JavaScript

### Opción 1: Listeners directos (recomendado)

```javascript
document.addEventListener('deviceready', function() {
    console.log('Cordova listo');
    
    // Verificar que el plugin está disponible
    if (typeof VolumeButtons !== 'undefined') {
        console.log('✅ Plugin VolumeButtons detectado');
    } else {
        console.log('❌ Plugin VolumeButtons NO detectado');
    }
    
    // Registrar listeners
    document.addEventListener('volumeup', function() {
        console.log('🔊 VOLUMEN ARRIBA presionado');
        // Tu código aquí
    }, false);
    
    document.addEventListener('volumedown', function() {
        console.log('🔉 VOLUMEN ABAJO presionado');
        // Tu código aquí
    }, false);
}, false);
```

### Opción 2: Usando la API del plugin

```javascript
document.addEventListener('deviceready', function() {
    VolumeButtons.onVolumeUp(function() {
        console.log('🔊 VOLUMEN ARRIBA presionado');
        // Tu código aquí
    });
    
    VolumeButtons.onVolumeDown(function() {
        console.log('🔉 VOLUMEN ABAJO presionado');
        // Tu código aquí
    });
}, false);
```

### Opción 3: Con compatibilidad (plugin + eventos nativos como fallback)

```javascript
document.addEventListener('deviceready', function() {
    // Plugin personalizado (preferido)
    document.addEventListener('volumeup', handleVolumeUp, false);
    document.addEventListener('volumedown', handleVolumeDown, false);
    
    // Eventos nativos de Cordova (fallback para dispositivos compatibles)
    document.addEventListener('volumeupbutton', handleVolumeUp, false);
    document.addEventListener('volumedownbutton', handleVolumeDown, false);
}, false);

function handleVolumeUp() {
    console.log('🔊 VOLUMEN ARRIBA');
    // Tu lógica aquí
}

function handleVolumeDown() {
    console.log('🔉 VOLUMEN ABAJO');
    // Tu lógica aquí
}
```

---

## 🧪 Verificar que Funciona

### Método 1: Chrome DevTools (Remote Debugging)

1. Conecta tu dispositivo Android por USB
2. Habilita "Depuración USB" en el dispositivo
3. En Chrome Desktop, abre: `chrome://inspect`
4. Busca tu app y haz clic en **"inspect"**
5. Ve a la pestaña **Console**
6. Presiona los botones de volumen en el dispositivo
7. Deberías ver los logs en la consola

**Logs esperados:**
```
✅ Plugin VolumeButtons detectado
🔊 VOLUMEN ARRIBA presionado
🔉 VOLUMEN ABAJO presionado
```

### Método 2: Logcat (logs nativos de Android)

```bash
# Ver logs del plugin en tiempo real
adb logcat | grep VolumeButtons

# O filtrar por tu app (cambia com.tuapp por tu package ID)
adb logcat | grep -E "VolumeButtons|chromium"
```

**Logs esperados:**
```
D/VolumeButtons: Plugin VolumeButtons inicializado
D/VolumeButtons: Listener de botones de volumen configurado
D/VolumeButtons: VOLUMEN+ detectado
D/VolumeButtons: Evento disparado: volumeup
```

### Método 3: Indicadores visuales en la app

```javascript
// Agregar indicador visual en tu HTML
document.addEventListener('volumeup', function() {
    document.body.style.backgroundColor = '#00ff00'; // Verde
    setTimeout(() => {
        document.body.style.backgroundColor = '';
    }, 200);
});

document.addEventListener('volumedown', function() {
    document.body.style.backgroundColor = '#0000ff'; // Azul
    setTimeout(() => {
        document.body.style.backgroundColor = '';
    }, 200);
});
```

---

## 🎯 Casos de Uso Reales

### 1. Cronómetro deportivo (marcar vueltas)

```javascript
let lapCount = 0;

document.addEventListener('deviceready', function() {
    document.addEventListener('volumeup', markLap, false);
    document.addEventListener('volumedown', markLap, false);
}, false);

function markLap() {
    lapCount++;
    console.log(`Vuelta ${lapCount} registrada`);
    
    // Feedback visual
    document.getElementById('lap-counter').textContent = lapCount;
    
    // Feedback háptico (vibración)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    
    // Registrar timestamp
    const timestamp = new Date().getTime();
    saveLap(lapCount, timestamp);
}
```

### 2. Control de reproducción de audio/video

```javascript
let isPlaying = false;
let audioPlayer = document.getElementById('audioPlayer');

document.addEventListener('deviceready', function() {
    document.addEventListener('volumeup', function() {
        // Volumen+ = Siguiente pista
        nextTrack();
    }, false);
    
    document.addEventListener('volumedown', function() {
        // Volumen- = Pista anterior
        previousTrack();
    }, false);
}, false);
```

### 3. Navegación discreta (sin tocar pantalla)

```javascript
document.addEventListener('deviceready', function() {
    document.addEventListener('volumeup', function() {
        // Desplazarse hacia abajo
        window.scrollBy(0, 100);
    }, false);
    
    document.addEventListener('volumedown', function() {
        // Desplazarse hacia arriba
        window.scrollBy(0, -100);
    }, false);
}, false);
```

### 4. Captura rápida de datos

```javascript
document.addEventListener('deviceready', function() {
    document.addEventListener('volumeup', function() {
        // Incrementar contador
        currentValue++;
        updateDisplay();
    }, false);
    
    document.addEventListener('volumedown', function() {
        // Decrementar contador
        currentValue--;
        updateDisplay();
    }, false);
}, false);
```

---

## 🐛 Solución de Problemas

### ❌ "VolumeButtons is not defined"

**Causa:** El plugin no está instalado o no se cargó correctamente.

**Solución:**
```bash
# Verificar plugins instalados
cordova plugin list

# Si no aparece, instalarlo
cordova plugin add ./VolumeButtonsPlugin

# Recompilar completamente
cordova clean android
cordova build android
```

---

### ❌ El volumen SÍ cambia al presionar los botones

**Causa:** El plugin no está interceptando los eventos correctamente.

**Diagnóstico:**
1. Verifica que estás probando en la **APK instalada**, no en el navegador
2. Verifica logs: `adb logcat | grep VolumeButtons`
3. Si no ves logs → El plugin no se inicializó

**Solución:**
```bash
# Eliminar y reinstalar el plugin
cordova plugin remove cordova-plugin-volume-buttons
cordova plugin add ./VolumeButtonsPlugin

# Limpiar completamente
cordova clean android
rm -rf platforms/android/build

# Recompilar
cordova build android
cordova run android
```

---

### ❌ Los eventos no se disparan

**Checklist de diagnóstico:**

```javascript
// En la consola de Chrome DevTools (chrome://inspect)

// 1. Verificar que Cordova está listo
console.log(typeof cordova); // Debe ser "object"

// 2. Verificar que el plugin está cargado
console.log(typeof VolumeButtons); // Debe ser "object"

// 3. Verificar que los listeners están registrados
getEventListeners(document).volumeup; // Debe mostrar array con listeners
getEventListeners(document).volumedown; // Debe mostrar array con listeners

// 4. Disparar evento manualmente (test)
VolumeButtons._fireEvent('volumeup'); // Debería ejecutar tu callback
```

**Si el test manual funciona pero los botones físicos no:**
- El problema está en el código Java
- Verifica permisos en `AndroidManifest.xml` (no deberían ser necesarios)
- Verifica versión de Android del dispositivo (debe ser 5.0+)

---

### ❌ Error al compilar: "package com.test.volumebuttons does not exist"

**Causa:** El archivo Java no se copió correctamente al proyecto.

**Solución:**
```bash
# Verificar que el archivo Java existe
cat VolumeButtonsPlugin/src/android/VolumeButtons.java

# Eliminar y reinstalar plugin
cordova plugin remove cordova-plugin-volume-buttons
cordova plugin add ./VolumeButtonsPlugin

# Verificar que se copió a platforms/android
ls -la platforms/android/app/src/main/java/com/test/volumebuttons/

# Si no existe, hay un problema con el plugin.xml
# Verifica que el path en plugin.xml es correcto:
# <source-file src="src/android/VolumeButtons.java" target-dir="src/com/test/volumebuttons" />
```

---

### ❌ Plugin se inicializa pero no responde a botones

**Causa:** La vista no tiene foco o el listener no se configuró correctamente.

**Diagnóstico en logs:**
```bash
adb logcat | grep VolumeButtons
```

**Deberías ver:**
```
D/VolumeButtons: Plugin VolumeButtons inicializado
D/VolumeButtons: Listener de botones de volumen configurado
```

**Si solo ves la primera línea pero no la segunda:**
- El `setupVolumeButtonListener()` no se ejecutó
- Puede ser un problema de threading en Android

**Solución alternativa (modificar VolumeButtons.java):**
```java
// En el método initialize(), añadir delay
activity.runOnUiThread(new Runnable() {
    @Override
    public void run() {
        // Esperar a que la actividad esté completamente cargada
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        setupVolumeButtonListener(activity);
    }
});
```

---

## 📊 Comparación: Nativo vs Plugin

| Característica | Eventos Nativos Cordova | Plugin Personalizado |
|----------------|-------------------------|----------------------|
| **Eventos** | `volumeupbutton`, `volumedownbutton` | `volumeup`, `volumedown` |
| **Android 5.0+** | ❌ No funciona | ✅ Funciona |
| **Android 4.x** | ✅ Funciona | ✅ Funciona |
| **Previene cambio de volumen** | ❌ No | ✅ Sí |
| **Instalación** | Incluido en Cordova | Requiere plugin |
| **Mantenimiento** | Ninguno (obsoleto) | Manual |
| **Complejidad** | Simple | Media |
| **Recomendación** | ❌ No usar | ✅ Usar para Android moderno |

---

## 🔧 Personalización Avanzada

### Permitir cambio de volumen en ciertas condiciones

```java
// Modificar VolumeButtons.java
@Override
public boolean onKey(View v, int keyCode, KeyEvent event) {
    if (event.getAction() == KeyEvent.ACTION_DOWN) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            Log.d(TAG, "VOLUMEN+ detectado");
            fireEvent("volumeup");
            
            // Solo prevenir cambio de volumen si está en modo específico
            return shouldPreventVolumeChange(); // true o false
        }
    }
    return false;
}

private boolean shouldPreventVolumeChange() {
    // Implementar tu lógica aquí
    // Por ejemplo, leer configuración desde JavaScript
    return true; // Por defecto, prevenir
}
```

### Distinguir entre pulsación corta y larga

```java
private long volumeButtonPressTime = 0;

@Override
public boolean onKey(View v, int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            volumeButtonPressTime = System.currentTimeMillis();
        } else if (event.getAction() == KeyEvent.ACTION_UP) {
            long duration = System.currentTimeMillis() - volumeButtonPressTime;
            
            String eventType = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "volumeup" : "volumedown";
            
            if (duration > 1000) {
                fireEvent(eventType + "long"); // Pulsación larga
            } else {
                fireEvent(eventType); // Pulsación corta
            }
            
            return true;
        }
    }
    return false;
}
```

---

## 📚 Requisitos del Sistema

### Cordova
- **Cordova CLI**: 10.0.0 o superior
- **cordova-android**: 12.0.0 o superior (para Java 17)
- **Android SDK**: API Level 22+ (Android 5.0+)

### Java
- **JDK**: 17 (requerido para cordova-android 12+)

### Verificar requisitos
```bash
cordova requirements android
```

**Salida esperada:**
```
Android Studio project detected
Android target: android-33
Gradle version: 8.x
Java JDK: version 17.x.x
```

---

## ✅ Checklist de Implementación

Antes de considerar la implementación completa, verifica:

- [ ] Plugin creado con estructura correcta (4 archivos)
- [ ] Plugin instalado: `cordova plugin list` muestra `cordova-plugin-volume-buttons`
- [ ] App compilada sin errores: `cordova build android`
- [ ] Listeners registrados en el código JavaScript
- [ ] App instalada en dispositivo Android físico (no emulador)
- [ ] Probado en dispositivo: presionar botones de volumen
- [ ] Verificado que el volumen NO cambia
- [ ] Verificado que los eventos se disparan (logs o feedback visual)
- [ ] Documentado el uso en tu aplicación

---

## 🎯 Resumen Rápido para IA

**Si estás usando esto como prompt para Cursor.ai u otra IA:**

> "Necesito implementar detección de botones físicos de volumen en mi app Android Cordova. Los eventos nativos no funcionan en Android moderno. Crea un plugin personalizado con esta estructura:
>
> 1. **Plugin Cordova** llamado `cordova-plugin-volume-buttons`
> 2. **Archivos necesarios**: `plugin.xml`, `package.json`, `www/VolumeButtons.js`, `src/android/VolumeButtons.java`
> 3. **Código Java**: Usar `View.OnKeyListener` en `decorView` para interceptar `KEYCODE_VOLUME_UP` y `KEYCODE_VOLUME_DOWN`
> 4. **Return true** para consumir eventos (evitar cambio de volumen)
> 5. **Disparar eventos DOM**: `volumeup` y `volumedown` desde JavaScript
> 6. **Instalar**: `cordova plugin add ./VolumeButtonsPlugin`
> 7. **Usar**: `document.addEventListener('volumeup', callback, false);`
>
> Usa el código completo de esta guía como referencia."

---

## 📖 Referencias y Documentación

- **Apache Cordova Plugin Development**: https://cordova.apache.org/docs/en/latest/guide/hybrid/plugins/
- **Android KeyEvent API**: https://developer.android.com/reference/android/view/KeyEvent
- **Cordova Android Platform**: https://cordova.apache.org/docs/en/latest/guide/platforms/android/

---

## 📝 Notas Finales

### Limitaciones conocidas
- ✅ Funciona en dispositivos Android físicos con Android 5.0+
- ❌ NO funciona en emuladores (los emuladores no tienen botones de volumen físicos)
- ❌ NO funciona en navegadores web (solo en APK nativa)
- ⚠️ Algunos fabricantes (Samsung, Xiaomi) pueden modificar el comportamiento de botones físicos

### Buenas prácticas
- Siempre proporciona **feedback visual** (flash, cambio de color) cuando se detecta un botón
- Proporciona **feedback háptico** (vibración) si está disponible
- Permite a los usuarios **activar/desactivar** la funcionalidad (puede ser molesto)
- Documenta claramente que los botones de volumen **no cambiarán el volumen** cuando la función está activa
- Proporciona métodos alternativos de interacción (no todos los usuarios querrán usar botones físicos)

### Seguridad y privacidad
- ✅ Este plugin NO requiere permisos especiales de Android
- ✅ Solo intercepta eventos cuando la app está en primer plano
- ✅ No puede interceptar eventos cuando la app está en background
- ✅ No accede a datos privados ni hardware sensible

---

**Versión:** 1.0  
**Fecha:** 29 de octubre de 2025  
**Autor:** Basado en implementación funcional probada  
**Licencia:** MIT

---

## 🎉 ¡Todo Listo!

Con esta guía tienes toda la información necesaria para implementar detección de botones físicos en cualquier aplicación Android Cordova. 

**¿Próximos pasos?**
1. Copia los archivos del plugin (4 archivos completos arriba)
2. Instala el plugin: `cordova plugin add ./VolumeButtonsPlugin`
3. Registra los listeners en tu JavaScript
4. Compila y prueba en un dispositivo Android físico
5. ¡Disfruta de los botones físicos funcionando! 🚀

