package com.controlvoltes.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.util.Log;
import org.apache.cordova.CordovaActivity;

public class MainActivity extends CordovaActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "=== MainActivity onCreate ===");
        loadUrl(launchUrl);
    }
    
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        
        // Solo procesar eventos de botones de volumen
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            Log.d(TAG, "dispatchKeyEvent - keyCode: " + keyCode + ", action: " + event.getAction());
            
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                String eventType = (keyCode == KeyEvent.KEYCODE_VOLUME_UP) ? "volumeup" : "volumedown";
                Log.d(TAG, "!!! " + eventType + " DETECTADO en MainActivity !!!");
                
                // Disparar evento JavaScript directamente
                final String js = "javascript:(function() { " +
                    "if (typeof VolumeButtons !== 'undefined' && typeof VolumeButtons._fireEvent === 'function') { " +
                    "VolumeButtons._fireEvent('" + eventType + "'); " +
                    "} else { " +
                    "var event = new Event('" + eventType + "'); " +
                    "document.dispatchEvent(event); " +
                    "} " +
                    "})();";
                
                Log.d(TAG, "Ejecutando JavaScript: " + js);
                
                runOnUiThread(new Runnable() {
                    public void run() {
                        if (appView != null && appView.getView() != null) {
                            appView.loadUrl(js);
                        }
                    }
                });
                
                // Retornar true para consumir el evento (no cambia el volumen)
                return true;
            }
        }
        
        // Para otros eventos, usar el comportamiento por defecto
        return super.dispatchKeyEvent(event);
    }
}
