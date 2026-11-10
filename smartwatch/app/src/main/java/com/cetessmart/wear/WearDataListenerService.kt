package com.cetessmart.wear

import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class WearDataListenerService : WearableListenerService() {
  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun onDataChanged(events: DataEventBuffer) {
    events.forEach { event ->
      if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == SNAPSHOT_PATH) {
        val payload = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("payload")
        if (payload != null) saveSnapshot(payload)
      }
    }
  }

  override fun onMessageReceived(event: MessageEvent) {
    when (event.path) {
      SNAPSHOT_MESSAGE_PATH -> saveSnapshot(String(event.data, Charsets.UTF_8))
    }
  }

  override fun onPeerConnected(node: Node) {
    super.onPeerConnected(node)
    Log.i(TAG, "Teléfono conectado: ${node.displayName}")
    flushPendingActions(node.id)
    requestSnapshotFromPhone(node.id)
  }

  override fun onDestroy() {
    serviceScope.cancel()
    super.onDestroy()
  }

  private fun saveSnapshot(payload: String) {
    serviceScope.launch {
      try {
        WatchStorage.saveSnapshot(applicationContext, payload)
        Log.i(TAG, "Instantánea recibida")
      } catch (error: Exception) {
        Log.e(TAG, "No se pudo guardar la instantánea", error)
      }
    }
  }

  private fun requestSnapshotFromPhone(nodeId: String) {
    serviceScope.launch {
      try {
        Tasks.await(
          Wearable.getMessageClient(this@WearDataListenerService)
            .sendMessage(nodeId, SNAPSHOT_REQUEST_PATH, ByteArray(0)),
        )
        Log.i(TAG, "Solicitud de instantánea enviada al teléfono")
      } catch (error: Exception) {
        Log.e(TAG, "No se pudo enviar la instantánea guardada", error)
      }
    }
  }

  private fun flushPendingActions(nodeId: String) {
    val preferences = getSharedPreferences(PREFERENCES, 0)
    val actions = JSONArray(preferences.getString(PENDING_ACTIONS, "[]") ?: "[]")
    val pending = mutableListOf<JSONObject>()
    val tasks = mutableListOf<com.google.android.gms.tasks.Task<Int>>()
    for (index in 0 until actions.length()) {
      val action = actions.optJSONObject(index) ?: continue
      val id = action.optString("id")
      val path = action.optString("path")
      val payload = action.optJSONObject("payload")?.toString() ?: continue
      if (id.isBlank() || path.isBlank()) continue
      pending.add(action)
      tasks.add(Wearable.getMessageClient(this).sendMessage(nodeId, path, payload.toByteArray()))
    }
    if (tasks.isEmpty()) return

    Tasks.whenAllComplete(tasks).addOnSuccessListener {
      val delivered = pending.indices
        .filter { index -> tasks[index].isSuccessful }
        .map { index -> pending[index].optString("id") }
        .toSet()
      val latest = JSONArray(preferences.getString(PENDING_ACTIONS, "[]") ?: "[]")
      val remaining = JSONArray()
      for (index in 0 until latest.length()) {
        val action = latest.optJSONObject(index) ?: continue
        if (!delivered.contains(action.optString("id"))) remaining.put(action)
      }
      preferences.edit().putString(PENDING_ACTIONS, remaining.toString()).apply()
    }
  }

  companion object {
    const val PREFERENCES = "cetes_watch"
    const val SNAPSHOT = "snapshot"
    const val PENDING_ACTIONS = "pending_actions"
    const val SNAPSHOT_PATH = "/cetes/snapshot"
    const val SNAPSHOT_MESSAGE_PATH = "/cetes/snapshot"
    const val SNAPSHOT_REQUEST_PATH = "/cetes/request-snapshot"
    private const val TAG = "CetesSync"
  }
}
