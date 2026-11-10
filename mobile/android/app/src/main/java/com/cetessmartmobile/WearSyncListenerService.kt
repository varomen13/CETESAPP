package com.cetessmartmobile

import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONArray
import org.json.JSONObject

class WearSyncListenerService : WearableListenerService() {
  override fun onMessageReceived(event: MessageEvent) {
    if (event.path == WearSyncModule.SNAPSHOT_REQUEST_PATH) {
      Log.i(TAG, "Solicitud de instantánea recibida del reloj")
      sendLatestSnapshot(event.sourceNodeId)
      return
    }
    if (event.path != WearSyncModule.SIMULATION_PATH &&
      event.path != WearSyncModule.DISMISS_PATH
    ) return
    val payload = String(event.data, Charsets.UTF_8)
    val id = JSONObject(payload).optString("id")
    if (id.isBlank()) return

    val preferences = getSharedPreferences(WearSyncModule.PREFERENCES, 0)
    val actions = JSONArray(preferences.getString(WearSyncModule.PENDING_ACTIONS, "[]") ?: "[]")
    for (index in 0 until actions.length()) {
      if (JSONObject(actions.getString(index)).optString("id") == id) return
    }
    actions.put(payload)
    preferences.edit().putString(WearSyncModule.PENDING_ACTIONS, actions.toString()).apply()
  }

  override fun onDataChanged(events: DataEventBuffer) {
    events.forEach { event ->
      if (event.type == DataEvent.TYPE_CHANGED &&
        event.dataItem.uri.path == WearSyncModule.SNAPSHOT_PATH
      ) {
        val payload = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("payload")
        if (payload != null) {
          getSharedPreferences(WearSyncModule.PREFERENCES, 0)
            .edit()
            .putString(WearSyncModule.LAST_SNAPSHOT, payload)
            .apply()
          Log.i(TAG, "Instantánea de tasas almacenada para responder sin conexión")
        }
      }
    }
  }

  private fun sendLatestSnapshot(nodeId: String) {
    val payload = getSharedPreferences(WearSyncModule.PREFERENCES, 0)
      .getString(WearSyncModule.LAST_SNAPSHOT, null)
    if (payload == null) {
      Log.w(TAG, "El teléfono todavía no tiene una instantánea para enviar")
      return
    }
    Wearable.getMessageClient(this)
      .sendMessage(nodeId, WearSyncModule.SNAPSHOT_PATH, payload.toByteArray(Charsets.UTF_8))
      .addOnSuccessListener { Log.i(TAG, "Instantánea enviada al reloj") }
      .addOnFailureListener { error -> Log.e(TAG, "No se pudo responder al reloj", error) }
  }

  companion object {
    private const val TAG = "CetesSync"
  }
}
