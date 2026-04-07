package com.guardian.sos

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class SOSCancelReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SOSCancelReceiver"
        const val ACTION_CANCEL_SOS = "com.guardian.sos.CANCEL_SOS_COUNTDOWN"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_CANCEL_SOS) {
            Log.i(TAG, "SOS countdown cancelled by user")
            GuardianForegroundService.cancelCountdown()
        }
    }
}
