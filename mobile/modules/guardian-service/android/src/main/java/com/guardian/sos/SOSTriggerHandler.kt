package com.guardian.sos

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

data class SOSTriggerRequest(
    val userId: String,
    val location: SOSLocation?,
    val triggerType: String = "voice_background",
    val message: String = "Background voice SOS triggered"
)

data class SOSLocation(
    val latitude: Double,
    val longitude: Double
)

data class SOSTriggerResponse(
    val eventId: String,
    val status: String
)

class SOSTriggerHandler(private val context: Context) {

    companion object {
        private const val TAG = "SOSTriggerHandler"
        private const val QUEUED_SOS_KEY = "queued_sos_requests"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("guardian_service", Context.MODE_PRIVATE)

    fun triggerSOS(location: SOSLocation?): SOSTriggerResponse? {
        val apiUrl = prefs.getString("api_url", null) ?: run {
            Log.e(TAG, "No API URL configured")
            return null
        }
        val authToken = prefs.getString("auth_token", null) ?: run {
            Log.e(TAG, "No auth token")
            return null
        }
        val userId = prefs.getString("user_id", null) ?: run {
            Log.e(TAG, "No user ID")
            return null
        }

        val request = SOSTriggerRequest(
            userId = userId,
            location = location,
            triggerType = "voice_background",
            message = "Background voice SOS triggered"
        )

        val json = gson.toJson(request)
        val body = json.toRequestBody("application/json".toMediaType())

        val httpRequest = Request.Builder()
            .url("$apiUrl/sos/trigger")
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        return try {
            val response = client.newCall(httpRequest).execute()
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                Log.i(TAG, "SOS triggered successfully: $responseBody")
                responseBody?.let { gson.fromJson(it, SOSTriggerResponse::class.java) }
            } else {
                Log.e(TAG, "SOS trigger failed: ${response.code} ${response.body?.string()}")
                queueRequest(json)
                null
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network error, queuing SOS request", e)
            queueRequest(json)
            null
        }
    }

    private fun queueRequest(json: String) {
        val queued = prefs.getStringSet(QUEUED_SOS_KEY, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        queued.add(json)
        prefs.edit().putStringSet(QUEUED_SOS_KEY, queued).apply()
        Log.i(TAG, "SOS request queued for retry. Queue size: ${queued.size}")
    }

    fun retryQueuedRequests() {
        val queued = prefs.getStringSet(QUEUED_SOS_KEY, null)?.toMutableSet() ?: return
        if (queued.isEmpty()) return

        Log.i(TAG, "Retrying ${queued.size} queued SOS requests")
        val apiUrl = prefs.getString("api_url", null) ?: return
        val authToken = prefs.getString("auth_token", null) ?: return
        val succeeded = mutableSetOf<String>()

        for (json in queued) {
            val body = json.toRequestBody("application/json".toMediaType())
            val httpRequest = Request.Builder()
                .url("$apiUrl/sos/trigger")
                .addHeader("Authorization", "Bearer $authToken")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            try {
                val response = client.newCall(httpRequest).execute()
                if (response.isSuccessful) {
                    succeeded.add(json)
                    Log.i(TAG, "Queued SOS request sent successfully")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Retry failed, will try again later", e)
            }
        }

        if (succeeded.isNotEmpty()) {
            queued.removeAll(succeeded)
            prefs.edit().putStringSet(QUEUED_SOS_KEY, queued).apply()
        }
    }
}
