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
    private static VolumeButtons instance;
    
    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        instance = this;
        Log.d(TAG, "=== Plugin VolumeButtons inicializado ===");
        
        // Configurar listener en la actividad
        final Activity activity = cordova.getActivity();
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                setupVolumeButtonListener(activity);
            }
        });
    }
    
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        Log.d(TAG, "execute() llamado con action: " + action);
        // Método necesario para que el plugin se inicialice correctamente
        return false;
    }
    
    private void setupVolumeButtonListener(final Activity activity) {
        Log.d(TAG, "setupVolumeButtonListener() iniciado");
        
        View decorView = activity.getWindow().getDecorView();
        Log.d(TAG, "decorView obtenido: " + decorView);
        
        decorView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                Log.d(TAG, "onKey() - keyCode: " + keyCode + ", action: " + event.getAction());
                
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                        Log.d(TAG, "!!! VOLUMEN+ DETECTADO !!!");
                        fireEvent("volumeup");
                        return true; // Consumir el evento para evitar que cambie el volumen
                    } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                        Log.d(TAG, "!!! VOLUMEN- DETECTADO !!!");
                        fireEvent("volumedown");
                        return true; // Consumir el evento para evitar que cambie el volumen
                    }
                }
                return false;
            }
        });
        
        // Hacer que la vista sea focusable para recibir eventos de teclado
        decorView.setFocusableInTouchMode(true);
        boolean hasFocus = decorView.requestFocus();
        
        Log.d(TAG, "=== Listener de botones de volumen configurado ===");
        Log.d(TAG, "decorView focusable: " + decorView.isFocusable());
        Log.d(TAG, "decorView tiene foco: " + hasFocus);
    }
    
    private void fireEvent(final String eventType) {
        Log.d(TAG, "fireEvent() llamado con: " + eventType);
        cordova.getActivity().runOnUiThread(new Runnable() {
            public void run() {
                String js = "javascript:VolumeButtons._fireEvent('" + eventType + "');";
                Log.d(TAG, "Ejecutando JavaScript: " + js);
                webView.loadUrl(js);
                Log.d(TAG, "=== Evento disparado: " + eventType + " ===");
            }
        });
    }
    
    // Método estático para ser llamado desde MainActivity si es necesario
    public static boolean handleVolumeKey(int keyCode, KeyEvent event) {
        if (instance != null && event.getAction() == KeyEvent.ACTION_DOWN) {
            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                Log.d(TAG, "handleVolumeKey: VOLUME_UP");
                instance.fireEvent("volumeup");
                return true;
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                Log.d(TAG, "handleVolumeKey: VOLUME_DOWN");
                instance.fireEvent("volumedown");
                return true;
            }
        }
        return false;
    }
}

