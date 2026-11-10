package com.cetessmart.wear

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

private val Context.watchDataStore by preferencesDataStore(name = "cetes_watch")

data class WatchRate(val term: Int, val annualRate: Double)

data class WatchCalculation(
  val capital: Double,
  val term: Int,
  val annualRate: Double,
  val estimatedReturn: Double,
  val maturityValue: Double,
  val maturityDate: String,
)

data class WatchNotifications(
  val maturityRemindersEnabled: Boolean = false,
  val favoriteRateChangesEnabled: Boolean = false,
)

data class WatchSnapshot(
  val rates: List<WatchRate> = emptyList(),
  val marketUpdatedAt: String? = null,
  val bestTerm: Int? = null,
  val lastCalculation: WatchCalculation? = null,
  val favorites: List<Int> = emptyList(),
  val notifications: WatchNotifications = WatchNotifications(),
  val lastSyncedAt: Long? = null,
  val hasData: Boolean = false,
  val error: String? = null,
)

object WatchStorage {
  private val payloadKey = stringPreferencesKey("snapshot")
  private val syncedAtKey = longPreferencesKey("synced_at")

  fun observe(context: Context): Flow<WatchSnapshot> =
    context.watchDataStore.data.map { preferences ->
      val payload = preferences[payloadKey] ?: return@map WatchSnapshot()
      try {
        parseSnapshot(payload, preferences[syncedAtKey])
      } catch (error: JSONException) {
        Log.e(TAG, "La instantánea guardada no tiene un formato válido", error)
        WatchSnapshot(
          lastSyncedAt = preferences[syncedAtKey],
          error = "No se pudieron leer los datos sincronizados.",
        )
      }
    }

  suspend fun saveSnapshot(
    context: Context,
    payload: String,
    receivedAt: Long? = System.currentTimeMillis(),
  ) {
    val snapshot = JSONObject(payload)
    if (snapshot.optJSONArray("rates") == null) {
      throw JSONException("La instantánea no contiene las tasas.")
    }
    context.watchDataStore.edit { preferences ->
      preferences[payloadKey] = payload
      if (receivedAt == null) preferences.remove(syncedAtKey)
      else preferences[syncedAtKey] = receivedAt
    }
    Log.i(TAG, "Instantánea guardada sin conexión")
  }

  suspend fun readPayload(context: Context): String? {
    val stored = context.watchDataStore.data.first()[payloadKey]
    if (stored != null) return stored
    val legacy = context.getSharedPreferences("cetes_watch", Context.MODE_PRIVATE)
      .getString("snapshot", null)
    if (legacy != null) saveSnapshot(context, legacy, receivedAt = null)
    return legacy
  }

  private fun parseSnapshot(payload: String, syncedAt: Long?): WatchSnapshot {
    val root = JSONObject(payload)
    val ratesJson = root.optJSONArray("rates") ?: JSONArray()
    val rates = (0 until ratesJson.length()).mapNotNull { index ->
      val item = ratesJson.optJSONObject(index) ?: return@mapNotNull null
      val term = item.optInt("term")
      val rate = item.optDouble("annualRate", Double.NaN)
      if (term in TERMS && rate.isFinite()) WatchRate(term, rate) else null
    }.sortedBy { it.term }

    val calculationJson = root.optJSONObject("lastCalculation")
    val calculation = calculationJson?.let {
      val term = it.optInt("term")
      val capital = it.optDouble("principal", Double.NaN)
      val annualRate = it.optDouble("annualRate", Double.NaN)
      val estimatedReturn = it.optDouble("estimatedReturn", Double.NaN)
      val maturityDate = it.optString("maturityDate")
      if (
        term in TERMS && capital.isFinite() && annualRate.isFinite() &&
        estimatedReturn.isFinite() && maturityDate.isNotBlank()
      ) {
        WatchCalculation(
          capital = capital,
          term = term,
          annualRate = annualRate,
          estimatedReturn = estimatedReturn,
          maturityValue = it.optDouble("maturityValue", capital + estimatedReturn),
          maturityDate = maturityDate,
        )
      } else {
        null
      }
    }

    val favoritesJson = root.optJSONArray("favorites") ?: JSONArray()
    val favorites = (0 until favoritesJson.length())
      .map { favoritesJson.optInt(it) }
      .filter { it in TERMS }
    val notificationsJson = root.optJSONObject("notifications") ?: JSONObject()
    val notifications = WatchNotifications(
      maturityRemindersEnabled = notificationsJson.optBoolean("maturityRemindersEnabled"),
      favoriteRateChangesEnabled = notificationsJson.optBoolean("favoriteRateChangesEnabled"),
    )
    val highestRate = rates.maxByOrNull { it.annualRate }

    return WatchSnapshot(
      rates = rates,
      marketUpdatedAt = root.optNullableString("ratesFetchedAt"),
      bestTerm = root.optInt("bestTerm").takeIf { it in TERMS } ?: highestRate?.term,
      lastCalculation = calculation,
      favorites = favorites,
      notifications = notifications,
      lastSyncedAt = syncedAt,
      hasData = rates.isNotEmpty() || calculation != null,
    )
  }

  private fun JSONObject.optNullableString(name: String): String? =
    optString(name).takeIf { it.isNotBlank() && it != "null" }

  private val TERMS = setOf(28, 91, 182, 364)
  private const val TAG = "CetesSync"
}
