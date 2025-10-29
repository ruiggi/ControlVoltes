package com.test.botones;

import android.os.Bundle;
import android.view.KeyEvent;
import org.apache.cordova.*;

public class MainActivity extends CordovaActivity
{
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        loadUrl(launchUrl);
    }
    
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            // Notificar al plugin
            appView.getPluginManager().postMessage("onKeyDown", keyCode);
            // Retornar true para evitar que el volumen cambie
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
    
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            // Notificar al plugin
            appView.getPluginManager().postMessage("onKeyUp", keyCode);
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }
}

