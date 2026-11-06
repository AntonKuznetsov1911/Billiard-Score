package io.github.antonkuznetsov1911.billiard;

import android.view.HapticFeedbackConstants;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BilliardUX")
public class NativeUXPlugin extends Plugin {
    @PluginMethod
    public void tap(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
            call.resolve(new JSObject());
        });
    }
}
