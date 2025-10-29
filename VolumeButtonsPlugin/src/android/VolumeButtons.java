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

