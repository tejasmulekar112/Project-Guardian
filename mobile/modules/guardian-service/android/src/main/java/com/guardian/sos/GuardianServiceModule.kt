package com.guardian.sos

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class GuardianServiceModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    override fun definition() = ModuleDefinition {
        Name("GuardianServiceModule")

        Events("onBackgroundSOSTriggered")

        AsyncFunction("startService") { promise: Promise ->
            try {
                val token = prefs.getString("auth_token", null)
                if (token.isNullOrEmpty()) {
                    promise.reject("NO_AUTH", "No auth token found. Please sign in first.", null)
                    return@AsyncFunction
                }
                val intent = Intent(context, GuardianForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }

        AsyncFunction("stopService") { promise: Promise ->
            try {
                val intent = Intent(context, GuardianForegroundService::class.java)
                context.stopService(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("STOP_FAILED", e.message, e)
            }
        }

        AsyncFunction("isRunning") { promise: Promise ->
            promise.resolve(GuardianForegroundService.isRunning)
        }

        AsyncFunction("setEnabled") { enabled: Boolean, promise: Promise ->
            prefs.edit().putBoolean("service_enabled", enabled).apply()
            if (enabled) {
                val token = prefs.getString("auth_token", null)
                if (!token.isNullOrEmpty()) {
                    val intent = Intent(context, GuardianForegroundService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(intent)
                    } else {
                        context.startService(intent)
                    }
                }
            } else {
                val intent = Intent(context, GuardianForegroundService::class.java)
                context.stopService(intent)
            }
            promise.resolve(null)
        }

        AsyncFunction("isEnabled") { promise: Promise ->
            promise.resolve(prefs.getBoolean("service_enabled", true))
        }

        AsyncFunction("setAuthCredentials") { token: String, userId: String, apiUrl: String, promise: Promise ->
            prefs.edit()
                .putString("auth_token", token)
                .putString("user_id", userId)
                .putString("api_url", apiUrl)
                .apply()
            promise.resolve(null)
        }

        AsyncFunction("clearAuthCredentials") { promise: Promise ->
            prefs.edit()
                .remove("auth_token")
                .remove("user_id")
                .remove("api_url")
                .apply()
            // Stop the service when credentials are cleared
            val intent = Intent(context, GuardianForegroundService::class.java)
            context.stopService(intent)
            promise.resolve(null)
        }
    }
}
