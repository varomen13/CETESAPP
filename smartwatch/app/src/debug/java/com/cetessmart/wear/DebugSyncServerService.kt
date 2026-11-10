package com.cetessmart.wear

import android.app.Service
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException

class DebugSyncServerService : Service() {
  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  @Volatile private var serverSocket: ServerSocket? = null

  override fun onCreate() {
    super.onCreate()
    serviceScope.launch {
      try {
        ServerSocket(PORT).use { server ->
          serverSocket = server
          Log.i(TAG, "Servidor de sincronización iniciado en el puerto $PORT")
          while (true) {
            val client = server.accept()
            serviceScope.launch { handleClient(client) }
          }
        }
      } catch (error: SocketException) {
        if (serviceScope.isActive) {
          Log.e(TAG, "El servidor de sincronización se detuvo por un error de socket", error)
        }
      } catch (error: IOException) {
        Log.e(TAG, "No se pudo iniciar el servidor de sincronización", error)
      } finally {
        serverSocket = null
      }
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
    START_STICKY

  override fun onDestroy() {
    serverSocket?.close()
    serviceScope.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?) = null

  private suspend fun handleClient(client: Socket) {
    client.use { socket ->
      socket.soTimeout = CLIENT_TIMEOUT_MS
      val input = BufferedInputStream(socket.getInputStream())
      val output = socket.getOutputStream()
      try {
        val requestLine = readHeaderLine(input)
          ?: return respond(output, 400, "Solicitud HTTP vacía.")
        val request = requestLine.split(' ')
        if (request.size < 2) return respond(output, 400, "Línea de solicitud inválida.")
        if (request[0] != "POST") return respond(output, 405, "Solo se permite POST.")
        if (request[1] != ENDPOINT) return respond(output, 404, "Ruta no encontrada.")

        val headers = mutableMapOf<String, String>()
        var headerBytes = requestLine.length
        while (true) {
          val line = readHeaderLine(input)
            ?: return respond(output, 400, "Encabezados HTTP incompletos.")
          headerBytes += line.length
          if (headerBytes > MAX_HEADER_BYTES) {
            return respond(output, 431, "Los encabezados HTTP son demasiado grandes.")
          }
          if (line.isEmpty()) break
          val separator = line.indexOf(':')
          if (separator <= 0) return respond(output, 400, "Encabezado HTTP inválido.")
          headers[line.substring(0, separator).trim().lowercase()] =
            line.substring(separator + 1).trim()
        }

        val contentLength = headers["content-length"]?.toIntOrNull()
          ?: return respond(output, 411, "Se requiere Content-Length.")
        if (contentLength < 0 || contentLength > MAX_PAYLOAD_BYTES) {
          return respond(output, 413, "La instantánea supera el tamaño permitido.")
        }
        val payloadBytes = ByteArray(contentLength)
        var offset = 0
        while (offset < payloadBytes.size) {
          val count = input.read(payloadBytes, offset, payloadBytes.size - offset)
          if (count < 0) return respond(output, 400, "El cuerpo HTTP está incompleto.")
          offset += count
        }
        val payload = String(payloadBytes, Charsets.UTF_8)
        validateSnapshot(payload)
        WatchStorage.saveSnapshot(applicationContext, payload)
        Log.i(TAG, "Instantánea recibida y guardada por conexión local (${payloadBytes.size} bytes)")
        respond(output, 200, "Instantánea guardada.")
      } catch (error: JSONException) {
        Log.w(TAG, "Instantánea inválida: ${error.message}")
        respond(output, 400, error.message ?: "El JSON de la instantánea no es válido.")
      } catch (error: CancellationException) {
        throw error
      } catch (error: Exception) {
        Log.e(TAG, "No se pudo guardar la instantánea recibida", error)
        respond(output, 500, "No se pudo guardar la instantánea.")
      }
    }
  }

  private fun validateSnapshot(payload: String) {
    val snapshot = JSONObject(payload)
    val rates = snapshot.optJSONArray("rates")
      ?: throw JSONException("La instantánea debe incluir un arreglo de tasas.")
    val allowedTerms = setOf(28, 91, 182, 364)
    for (index in 0 until rates.length()) {
      val rate = rates.optJSONObject(index)
        ?: throw JSONException("La tasa ${index + 1} no es un objeto válido.")
      val term = rate.optInt("term", -1)
      val annualRate = rate.optDouble("annualRate", Double.NaN)
      if (term !in allowedTerms || !annualRate.isFinite()) {
        throw JSONException("La tasa ${index + 1} tiene plazo o valor inválido.")
      }
    }
    if (containsTokenField(snapshot)) {
      throw JSONException("La instantánea no debe incluir tokens.")
    }
  }

  private fun containsTokenField(value: JSONObject): Boolean {
    val keys = value.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      if (key.contains("token", ignoreCase = true)) return true
      when (val child = value.opt(key)) {
        is JSONObject -> if (containsTokenField(child)) return true
        is JSONArray -> {
          for (index in 0 until child.length()) {
            if (child.opt(index) is JSONObject &&
              containsTokenField(child.getJSONObject(index))
            ) return true
          }
        }
      }
    }
    return false
  }

  private fun readHeaderLine(input: BufferedInputStream): String? {
    val bytes = ByteArrayOutputStream()
    var previous = -1
    while (bytes.size() <= MAX_HEADER_LINE_BYTES) {
      val next = input.read()
      if (next < 0) return if (bytes.size() == 0) null else throw IOException("Encabezado HTTP incompleto.")
      if (previous == '\r'.code && next == '\n'.code) {
        val line = bytes.toByteArray()
        return String(line, 0, (line.size - 1).coerceAtLeast(0), Charsets.US_ASCII)
      }
      bytes.write(next)
      previous = next
    }
    throw IOException("La línea de encabezado HTTP es demasiado larga.")
  }

  private fun respond(output: java.io.OutputStream, status: Int, message: String) {
    val reason = when (status) {
      200 -> "OK"
      400 -> "Bad Request"
      404 -> "Not Found"
      405 -> "Method Not Allowed"
      411 -> "Length Required"
      413 -> "Payload Too Large"
      431 -> "Request Header Fields Too Large"
      else -> "Internal Server Error"
    }
    val body = JSONObject().put(if (status == 200) "message" else "error", message)
      .toString().toByteArray(Charsets.UTF_8)
    val headers = "HTTP/1.1 $status $reason\r\n" +
      "Content-Type: application/json; charset=utf-8\r\n" +
      "Content-Length: ${body.size}\r\n" +
      "Connection: close\r\n\r\n"
    output.write(headers.toByteArray(Charsets.US_ASCII))
    output.write(body)
    output.flush()
  }

  companion object {
    private const val TAG = "CetesSync"
    private const val PORT = 8765
    private const val ENDPOINT = "/sync"
    private const val MAX_HEADER_LINE_BYTES = 8192
    private const val MAX_HEADER_BYTES = 32768
    private const val MAX_PAYLOAD_BYTES = 256 * 1024
    private const val CLIENT_TIMEOUT_MS = 10000
  }
}
