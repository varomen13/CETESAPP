package com.cetessmartmobile

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONArray
import org.json.JSONObject

class WearSyncModule(
  private val appContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(appContext), MessageClient.OnMessageReceivedListener {
  private var listenerCount = 0

  override fun getName() = "WearSync"

  override fun initialize() {
    super.initialize()
    Wearable.getMessageClient(appContext).addListener(this)
  }

  override fun invalidate() {
    Wearable.getMessageClient(appContext).removeListener(this)
    super.invalidate()
  }

  override fun onMessageReceived(event: MessageEvent) {
    if (event.path == SNAPSHOT_REQUEST_PATH) {
      Log.i(TAG, "Solicitud de instantánea recibida")
      return
    }
    Log.i(TAG, "Mensaje recibido desde el reloj: ${event.path}")
    val payload = String(event.data, Charsets.UTF_8)
    if (event.path == SIMULATION_PATH || event.path == DISMISS_PATH) {
      savePendingAction(payload)
    }
    val body = Arguments.createMap().apply {
      putString("path", event.path)
      putString("payload", payload)
    }
    if (listenerCount > 0) {
      appContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("WearableMessage", body)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
  }

  @ReactMethod
  fun logDebugSync(message: String, isError: Boolean) {
    if (!BuildConfig.DEBUG) return
    if (isError) Log.e(TAG, "Conexión local: $message")
    else Log.i(TAG, "Conexión local: $message")
  }

  @ReactMethod
  fun getConnectionStatus(promise: Promise) {
    Wearable.getNodeClient(appContext).connectedNodes
      .addOnSuccessListener { nodes ->
        if (nodes.isEmpty()) {
          promise.resolve(STATUS_WATCH_UNAVAILABLE)
          return@addOnSuccessListener
        }
        Wearable.getCapabilityClient(appContext)
          .getCapability(WATCH_CAPABILITY, CapabilityClient.FILTER_ALL)
          .addOnSuccessListener { capability ->
            val connectedNodeIds = nodes.map { it.id }.toSet()
            val hasWatchApp = capability.nodes.any { it.id in connectedNodeIds }
            promise.resolve(if (hasWatchApp) STATUS_CONNECTED else STATUS_APP_NOT_INSTALLED)
          }
          .addOnFailureListener {
            promise.reject("WEAR_CAPABILITY_FAILED", it)
          }
      }
      .addOnFailureListener { promise.reject("WEAR_CONNECTION_FAILED", it) }
  }

  @ReactMethod
  fun syncSnapshot(payload: String, promise: Promise) {
    appContext.getSharedPreferences(PREFERENCES, 0)
      .edit()
      .putString(LAST_SNAPSHOT, payload)
      .apply()
    val request = PutDataMapRequest.create(SNAPSHOT_PATH).apply {
      dataMap.putString("payload", payload)
      dataMap.putLong("updatedAt", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()
    Wearable.getDataClient(appContext).putDataItem(request)
      .addOnSuccessListener {
        Log.i(TAG, "Instantánea publicada en Data Layer")
        promise.resolve(true)
      }
      .addOnFailureListener {
        Log.e(TAG, "No se pudo publicar la instantánea en Data Layer", it)
        promise.reject("WEAR_SYNC_FAILED", it)
      }
  }

  @ReactMethod
  fun getPendingActions(promise: Promise) {
    val saved = appContext.getSharedPreferences(PREFERENCES, 0)
      .getString(PENDING_ACTIONS, "[]") ?: "[]"
    val result = Arguments.createArray()
    val actions = JSONArray(saved)
    for (index in 0 until actions.length()) {
      result.pushString(actions.getString(index))
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun acknowledgeAction(id: String, promise: Promise) {
    val preferences = appContext.getSharedPreferences(PREFERENCES, 0)
    val saved = preferences.getString(PENDING_ACTIONS, "[]") ?: "[]"
    val current = JSONArray(saved)
    val remaining = JSONArray()
    for (index in 0 until current.length()) {
      val action = current.getString(index)
      if (JSONObject(action).optString("id") != id) {
        remaining.put(action)
      }
    }
    preferences.edit().putString(PENDING_ACTIONS, remaining.toString()).apply()
    promise.resolve(true)
  }

  private fun savePendingAction(payload: String) {
    val id = JSONObject(payload).optString("id")
    if (id.isBlank()) return
    val preferences = appContext.getSharedPreferences(PREFERENCES, 0)
    val saved = preferences.getString(PENDING_ACTIONS, "[]") ?: "[]"
    val actions = JSONArray(saved)
    for (index in 0 until actions.length()) {
      if (JSONObject(actions.getString(index)).optString("id") == id) return
    }
    actions.put(payload)
    preferences.edit().putString(PENDING_ACTIONS, actions.toString()).apply()
  }

  companion object {
    const val PREFERENCES = "cetes_wear_sync"
    const val PENDING_ACTIONS = "pending_actions"
    const val LAST_SNAPSHOT = "last_snapshot"
    const val SNAPSHOT_PATH = "/cetes/snapshot"
    const val SNAPSHOT_REQUEST_PATH = "/cetes/request-snapshot"
    const val SIMULATION_PATH = "/cetes/simulation"
    const val DISMISS_PATH = "/cetes/notification-dismissed"
    const val WATCH_CAPABILITY = "cetes_smart_sync"
    const val STATUS_CONNECTED = "connected"
    const val STATUS_WATCH_UNAVAILABLE = "watch_unavailable"
    const val STATUS_APP_NOT_INSTALLED = "watch_app_not_installed"
    private const val TAG = "CetesSync"
  }
}
