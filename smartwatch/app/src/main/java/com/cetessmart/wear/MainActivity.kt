package com.cetessmart.wear

import android.content.Intent
import android.os.Bundle
import android.util.Log
import kotlinx.coroutines.delay
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val Navy = Color(0xFF0B192B)
private val SurfaceBlue = Color(0xFF17314D)
private val SurfaceLightBlue = Color(0xFF203D5B)
private val White = Color(0xFFF7FAFE)
private val Muted = Color(0xFFC1CEDD)
private val Green = Color(0xFF51D69A)
private val Red = Color(0xFFFF7777)
private val SpanishLocale = Locale.forLanguageTag("es-MX")

private const val PAGE_COUNT = 5
private const val TAG = "CetesSync"
private const val SYNC_FRESHNESS_MS = 60 * 60 * 1000L

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (BuildConfig.DEBUG) {
      startService(
        Intent().setClassName(this, "com.cetessmart.wear.DebugSyncServerService"),
      )
    }
    setContent { CetesWatchApp() }
  }
}

@Composable
private fun CetesWatchApp() {
  val context = LocalContext.current
  val activity = context as ComponentActivity
  val pagerState = rememberPagerState(pageCount = { PAGE_COUNT })
  var snapshot by remember { mutableStateOf(WatchSnapshot()) }
  var connected by remember { mutableStateOf(false) }
  var syncStatus by remember { mutableStateOf("") }
  var isSyncing by remember { mutableStateOf(false) }

  fun requestSnapshot() {
    if (isSyncing) return
    isSyncing = true
    syncStatus = "Sincronizando…"
    Wearable.getNodeClient(activity).connectedNodes
      .addOnSuccessListener { nodes ->
        if (nodes.isEmpty()) {
          connected = false
          isSyncing = false
          syncStatus = "Pulsa Sincronizar ahora en el teléfono"
          Log.w(TAG, "No hay teléfonos conectados")
          return@addOnSuccessListener
        }
        connected = true
        sendSnapshotRequest(activity, nodes, onSuccess = {
          syncStatus = "Sincronizando…"
          Log.i(TAG, "Solicitud de datos enviada al teléfono")
        }, onFailure = { message ->
          isSyncing = false
          syncStatus = message
        })
      }
      .addOnFailureListener { error ->
        connected = false
        isSyncing = false
        syncStatus = "No se pudo comprobar la conexión"
        Log.e(TAG, "No se pudo consultar la conexión con el teléfono", error)
      }
  }

  LaunchedEffect(activity) {
    try {
      WatchStorage.readPayload(activity)
    } catch (error: Exception) {
      Log.e(TAG, "No se pudo recuperar la última instantánea guardada", error)
      syncStatus = "No se pudieron recuperar los datos guardados"
    }
    WatchStorage.observe(activity).collect { received ->
      snapshot = received
      if (received.lastSyncedAt != null) {
        isSyncing = false
        syncStatus = ""
      }
      if (received.error != null) {
        syncStatus = received.error
      }
    }
  }

  LaunchedEffect(isSyncing) {
    if (isSyncing) {
      delay(12_000)
      isSyncing = false
      syncStatus = if (connected) {
        "No se recibió respuesta del teléfono"
      } else {
        "Pulsa Sincronizar ahora en el teléfono"
      }
      Log.w(TAG, "La solicitud de sincronización expiró")
    }
  }

  LaunchedEffect(activity) {
    while (true) {
      Wearable.getNodeClient(activity).connectedNodes
        .addOnSuccessListener { nodes ->
          val wasConnected = connected
          connected = nodes.isNotEmpty()
          if (nodes.isNotEmpty()) {
            if (!wasConnected) requestSnapshot()
          }
        }
        .addOnFailureListener { error ->
          connected = false
          syncStatus = "No se pudo comprobar la conexión"
          Log.e(TAG, "No se pudo comprobar la conexión", error)
        }
      delay(5_000)
    }
  }

  MaterialTheme(
    colorScheme = darkColorScheme(
      primary = Green,
      onPrimary = Navy,
      secondary = Green,
      background = Navy,
      onBackground = White,
      surface = SurfaceBlue,
      onSurface = White,
      error = Red,
    ),
  ) {
    Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(horizontal = 22.dp, vertical = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        HorizontalPager(
          state = pagerState,
          modifier = Modifier.weight(1f).fillMaxWidth(),
          contentPadding = PaddingValues(horizontal = 3.dp),
          pageSpacing = 6.dp,
        ) { page ->
          Box(
            modifier = Modifier.fillMaxSize().padding(horizontal = 3.dp),
            contentAlignment = Alignment.Center,
          ) {
            when (page) {
              0 -> HomePage(snapshot)
              1 -> RadarPage(snapshot)
              2 -> CalculationPage(snapshot)
              3 -> NotificationsPage(snapshot)
              4 -> ConnectionPage(
                snapshot = snapshot,
                status = syncStatus,
                isSyncing = isSyncing,
                onSync = { requestSnapshot() },
              )
            }
          }
        }
        Row(
          modifier = Modifier.padding(top = 3.dp, bottom = 5.dp),
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          repeat(PAGE_COUNT) { index ->
            Box(
              modifier = Modifier
                .size(if (index == pagerState.currentPage) 7.dp else 5.dp)
                .clip(CircleShape)
                .background(if (index == pagerState.currentPage) Green else Muted.copy(alpha = 0.45f)),
            )
          }
        }
      }
    }
  }
}

@Composable
private fun HomePage(snapshot: WatchSnapshot) {
  val best = snapshot.rates.maxByOrNull { it.annualRate }
  Column(
    modifier = Modifier.fillMaxWidth().widthIn(max = 190.dp).padding(horizontal = 5.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PageHeading("INICIO", "Tasa más alta")
    Spacer(Modifier.height(5.dp))
    Text(
      text = best?.let { formatRate(it.annualRate) } ?: "Sin datos",
      color = if (best == null) Muted else Green,
      fontSize = if (best == null) 24.sp else 38.sp,
      lineHeight = 42.sp,
      fontWeight = FontWeight.Bold,
      textAlign = TextAlign.Center,
    )
    Text(
      text = best?.let { "CETES ${it.term} días · anual" } ?: "Abre CETES Smart en tu teléfono para sincronizar",
      color = Muted,
      fontSize = 11.sp,
      lineHeight = 14.sp,
      textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(9.dp))
    SyncTime(snapshot.lastSyncedAt)
    snapshot.marketUpdatedAt?.let {
      Text("Tasas: ${formatMarketDate(it)}", color = Muted, fontSize = 9.sp, textAlign = TextAlign.Center)
    }
  }
}

@Composable
private fun RadarPage(snapshot: WatchSnapshot) {
  Column(
    modifier = Modifier.fillMaxWidth().widthIn(max = 190.dp).padding(horizontal = 1.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PageHeading("RADAR", "Tasas oficiales")
    Spacer(Modifier.height(5.dp))
    if (snapshot.rates.isEmpty()) {
      EmptyState("Abre CETES Smart en tu teléfono para sincronizar")
    } else {
      snapshot.rates.chunked(2).forEach { rowRates ->
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          rowRates.forEach { rate ->
            RateTile(rate, Modifier.weight(1f))
          }
          if (rowRates.size == 1) Spacer(Modifier.weight(1f))
        }
        Spacer(Modifier.height(5.dp))
      }
      snapshot.marketUpdatedAt?.let {
        Text("Actualización: ${formatMarketDate(it)}", color = Muted, fontSize = 9.sp)
      }
    }
  }
}

@Composable
private fun RateTile(rate: WatchRate, modifier: Modifier = Modifier) {
  Card(
    modifier = modifier.height(47.dp),
    shape = RoundedCornerShape(14.dp),
    colors = CardDefaults.cardColors(containerColor = SurfaceBlue),
  ) {
    Column(
      modifier = Modifier.fillMaxSize().padding(horizontal = 4.dp, vertical = 4.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Text("${rate.term} días", color = Muted, fontSize = 9.sp, lineHeight = 11.sp)
      Text(formatRate(rate.annualRate), color = Green, fontSize = 16.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold)
    }
  }
}

@Composable
private fun CalculationPage(snapshot: WatchSnapshot) {
  val calculation = snapshot.lastCalculation
  Column(
    modifier = Modifier.fillMaxWidth().widthIn(max = 190.dp).padding(horizontal = 3.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PageHeading("CALCULAR", "Rendimiento estimado")
    Spacer(Modifier.height(6.dp))
    if (calculation == null) {
      EmptyState("Haz un cálculo en tu teléfono")
    } else {
      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceBlue),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
          verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
          DetailRow("Capital", formatMoney(calculation.capital))
          DetailRow("Plazo", "${calculation.term} días")
          DetailRow("Rendimiento", formatMoney(calculation.estimatedReturn), Green)
          DetailRow("Al vencimiento", formatMoney(calculation.maturityValue), White)
          Text(
            "Vence ${formatMarketDate(calculation.maturityDate)}",
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
            color = Muted,
            fontSize = 9.sp,
            textAlign = TextAlign.Center,
          )
        }
      }
    }
  }
}

@Composable
private fun NotificationsPage(snapshot: WatchSnapshot) {
  Column(
    modifier = Modifier.fillMaxWidth().widthIn(max = 190.dp).padding(horizontal = 3.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PageHeading("AVISOS", "Tus preferencias")
    Spacer(Modifier.height(8.dp))
    NotificationCard(
      title = "Vencimientos",
      enabled = snapshot.notifications.maturityRemindersEnabled,
    )
    Spacer(Modifier.height(6.dp))
    NotificationCard(
      title = "Tasas favoritas",
      enabled = snapshot.notifications.favoriteRateChangesEnabled,
    )
    Spacer(Modifier.height(5.dp))
    Text("Consulta tu portafolio en el teléfono", color = Muted, fontSize = 9.sp, textAlign = TextAlign.Center)
  }
}

@Composable
private fun NotificationCard(title: String, enabled: Boolean) {
  Card(
    modifier = Modifier.fillMaxWidth().height(43.dp),
    shape = RoundedCornerShape(14.dp),
    colors = CardDefaults.cardColors(containerColor = SurfaceBlue),
  ) {
    Row(
      modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween,
    ) {
      Text(title, color = White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
      Text(
        if (enabled) "Activo" else "Inactivo",
        color = if (enabled) Green else Muted,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
      )
    }
  }
}

@Composable
private fun ConnectionPage(
  snapshot: WatchSnapshot,
  status: String,
  isSyncing: Boolean,
  onSync: () -> Unit,
) {
  var currentTime by remember { mutableLongStateOf(System.currentTimeMillis()) }
  LaunchedEffect(snapshot.lastSyncedAt) {
    while (true) {
      delay(60_000)
      currentTime = System.currentTimeMillis()
    }
  }
  val lastSyncedAt = snapshot.lastSyncedAt
  val hasRecentSnapshot =
    lastSyncedAt != null && currentTime - lastSyncedAt < SYNC_FRESHNESS_MS

  Column(
    modifier = Modifier.fillMaxWidth().widthIn(max = 190.dp).padding(horizontal = 3.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    PageHeading("CONEXIÓN", "Teléfono")
    Spacer(Modifier.height(5.dp))
    Text(
      text = when {
        lastSyncedAt == null -> "Sin conexión con el teléfono"
        hasRecentSnapshot -> "Sincronizado"
        else -> "Datos sin actualizar"
      },
      color = when {
        hasRecentSnapshot -> Green
        else -> Muted
      },
      fontSize = 13.sp,
      lineHeight = 16.sp,
      fontWeight = FontWeight.SemiBold,
      textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(4.dp))
    Text(
      text = when {
        lastSyncedAt == null -> "Aún sin datos"
        hasRecentSnapshot -> "Actualizado a las ${formatTime(lastSyncedAt)}"
        else -> "Última sincronización: ${formatTime(lastSyncedAt)}"
      },
      color = Muted,
      fontSize = 9.sp,
      textAlign = TextAlign.Center,
    )
    if (status.isNotBlank() && status != "Sincronizando…") {
      Spacer(Modifier.height(3.dp))
      Text(
        status,
        color = if (status.startsWith("No se pudo")) Red else Muted,
        fontSize = 9.sp,
        lineHeight = 11.sp,
        textAlign = TextAlign.Center,
      )
    }
    if (snapshot.error != null) {
      Text(snapshot.error, color = Red, fontSize = 9.sp, textAlign = TextAlign.Center)
    }
    Spacer(Modifier.height(8.dp))
    Button(
      onClick = onSync,
      enabled = !isSyncing,
      modifier = Modifier.fillMaxWidth().height(42.dp),
      shape = RoundedCornerShape(22.dp),
      colors = ButtonDefaults.buttonColors(
        containerColor = Green,
        contentColor = Navy,
        disabledContainerColor = SurfaceLightBlue,
        disabledContentColor = Muted,
      ),
      contentPadding = PaddingValues(horizontal = 10.dp, vertical = 5.dp),
    ) {
      Text(if (isSyncing) "Sincronizando…" else "Sincronizar", fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
  }
}

@Composable
private fun PageHeading(section: String, title: String) {
  Text(section, color = Green, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
  Text(
    title,
    color = White,
    fontSize = 14.sp,
    lineHeight = 17.sp,
    fontWeight = FontWeight.SemiBold,
    textAlign = TextAlign.Center,
  )
}

@Composable
private fun EmptyState(message: String) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(15.dp),
    colors = CardDefaults.cardColors(containerColor = SurfaceBlue),
  ) {
    Text(
      message,
      modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 12.dp),
      color = Muted,
      fontSize = 11.sp,
      lineHeight = 14.sp,
      textAlign = TextAlign.Center,
    )
  }
}

@Composable
private fun DetailRow(label: String, value: String, valueColor: Color = White) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(label, color = Muted, fontSize = 10.sp)
    Spacer(Modifier.width(4.dp))
    Text(value, color = valueColor, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
  }
}

@Composable
private fun SyncTime(timestamp: Long?) {
  Text(
    text =     timestamp?.let { "Sincronizado a las ${formatTime(it)}" } ?: "Todavía sin sincronizar",
    color = Muted,
    fontSize = 9.sp,
    textAlign = TextAlign.Center,
  )
}

private fun sendSnapshotRequest(
  activity: ComponentActivity,
  nodes: List<Node>,
  onSuccess: () -> Unit,
  onFailure: (String) -> Unit,
) {
  val node = nodes.firstOrNull()
  if (node == null) {
    onFailure("No hay un teléfono disponible")
    return
  }
  Wearable.getMessageClient(activity)
    .sendMessage(node.id, WearDataListenerService.SNAPSHOT_REQUEST_PATH, ByteArray(0))
    .addOnSuccessListener { onSuccess() }
    .addOnFailureListener { error ->
      Log.e(TAG, "No se pudo solicitar la instantánea al teléfono", error)
      onFailure("No se pudo solicitar la sincronización")
    }
}

private fun formatRate(rate: Double): String = String.format(SpanishLocale, "%.2f%%", rate)

private fun formatMoney(value: Double): String =
  NumberFormat.getCurrencyInstance(SpanishLocale).format(value)

private fun formatTime(timestamp: Long): String =
  DateTimeFormatter.ofPattern("HH:mm", SpanishLocale)
    .withZone(ZoneId.systemDefault())
    .format(Instant.ofEpochMilli(timestamp))

private fun formatMarketDate(value: String): String {
  val date = value.take(10)
  return try {
    val parsed = DateTimeFormatter.ISO_LOCAL_DATE.parse(date)
    DateTimeFormatter.ofPattern("d MMM", SpanishLocale).format(parsed)
  } catch (_: Exception) {
    date
  }
}
