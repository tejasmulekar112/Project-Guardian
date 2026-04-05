package com.guardian.sos

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("service_enabled", true)
        val hasAuth = !prefs.getString("auth_token", null).isNullOrEmpty()

        Log.i(TAG, "Boot completed. Service enabled: $enabled, has auth: $hasAuth")

        if (enabled && hasAuth) {
            val serviceIntent = Intent(context, GuardianForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.i(TAG, "Guardian service started on boot")
        }
    }
}
