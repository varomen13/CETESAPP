package com.cetessmart.wear

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class DebugSnapshotReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!BuildConfig.DEBUG || intent.action != ACTION) return

    val payload = try {
      val encoded = intent.getStringExtra(EXTRA_PAYLOAD_BASE64)
      if (encoded != null) {
        String(Base64.decode(encoded, Base64.DEFAULT), Charsets.UTF_8)
      } else {
        intent.getStringExtra(EXTRA_PAYLOAD)
      }
    } catch (error: IllegalArgumentException) {
      Log.e(TAG, "La instantánea de debug no tiene una codificación válida", error)
      return
    }

    if (payload == null) {
      Log.e(TAG, "El broadcast de debug no contiene una instantánea")
      return
    }

    val pendingResult = goAsync()
    CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
      try {
        WatchStorage.saveSnapshot(context.applicationContext, payload)
        Log.i(TAG, "Instantánea de debug guardada")
      } catch (error: Exception) {
        Log.e(TAG, "No se pudo guardar la instantánea de debug", error)
      } finally {
        pendingResult.finish()
      }
    }
  }

  companion object {
    const val ACTION = "com.cetessmart.wear.DEBUG_SNAPSHOT"
    const val EXTRA_PAYLOAD = "payload"
    const val EXTRA_PAYLOAD_BASE64 = "payloadBase64"
    private const val TAG = "CetesDebugSnapshot"
  }
}
