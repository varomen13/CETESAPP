# CETES Smart

Aplicación local para consultar y entender tasas de CETES, estimar rendimientos y dar seguimiento a registros propios. Incluye una app Android en React Native y una app Wear OS en Kotlin/Jetpack Compose, comunicadas con Google Play Services Wearable Data Layer.

No registra gastos personales, no se conecta a cuentas financieras y no compra ni vende títulos.

## Arquitectura

```text
mobile/       React Native 0.83 + TypeScript; Android y almacenamiento local
smartwatch/   App Wear OS independiente con Kotlin y Jetpack Compose
```

La app móvil centraliza las tasas, inversiones, simulaciones, plazos favoritos y preferencias en AsyncStorage. Cuando el reloj está conectado, publica una instantánea mediante un DataItem. El reloj puede enviar simulaciones y avisos atendidos mediante mensajes; si está desconectado, conserva acciones pendientes para intentar enviarlas al restablecer la conexión. La app móvil registra las acciones recibidas aunque estuviera cerrada.

## Requisitos

- Node.js 20.19 o posterior y npm.
- JDK 17.
- Android Studio y Android SDK Platform 36.
- Un emulador o dispositivo Android para la app móvil.
- Un emulador Wear OS o reloj compatible, emparejado con el teléfono, para probar la sincronización.

Los proyectos Android usan Gradle Wrapper, por lo que no se requiere una instalación global de Gradle. Se requiere conexión a Internet la primera vez para descargar dependencias y Gradle.

Si Gradle no encuentra el SDK en Windows, configura su ruta para la sesión actual de PowerShell (ajusta la ruta si Android Studio usa otra ubicación):

```powershell
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

## Instalación

Desde PowerShell, en la carpeta raíz:

```powershell
Set-Location mobile
npm install
Copy-Item .env.example .env
```

Agrega un token SIE de Banco de México a `mobile/.env`:

```dotenv
BANXICO_API_TOKEN=tu_token
```

`mobile/.env` está excluido del control de versiones. React Native incorpora las variables de entorno en el paquete cliente; por lo tanto, un token compilado en el APK puede extraerse. Esta configuración es solo para desarrollo. Para distribuir la aplicación, usa un servicio intermedio que proteja el token y aplique límites de uso.

Verifica el código TypeScript y las pruebas:

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
```

## Banco de México SIE

La app usa la [documentación oficial de la API SIE](https://www.banxico.org.mx/SieAPIRest/swagger/index.html), solicita metadatos y observaciones históricas con `Bmx-Token`, y comprueba que el identificador, el título y el plazo coincidan antes de mostrar una serie:

| Plazo | Serie SIE |
|---|---|
| 28 días | `SF43936` |
| 91 días | `SF43939` |
| 182 días | `SF43942` |
| 364 días | `SF43945` |

Una consulta usa los endpoints `/v1/series/{id}` y `/v1/series/{id}/datos/{fechaInicial}/{fechaFinal}`. Cada plazo se valida de forma independiente: si una serie no responde, se conserva su observación anterior y se informa qué plazos no se actualizaron; las demás tasas válidas sí se guardan. Se ignoran observaciones `N/E`, se rechazan fechas o tasas inválidas y las consultas parciales no sustituyen datos oficiales por datos ficticios. Si no hay datos oficiales guardados, la interfaz puede mostrar tasas ficticias de demostración, siempre rotuladas como tales y nunca guardadas como datos de mercado. Las observaciones con más de siete días se identifican como desactualizadas.

## Aplicación móvil

1. Inicia o abre un emulador Android en Android Studio.
2. Desde PowerShell:

   ```powershell
   Set-Location mobile
   npm start
   ```

3. Desde otra PowerShell abierta en la raíz del proyecto (usa una letra libre en lugar de `T:` si hace falta):

   ```powershell
   $projectRoot = (Get-Location).Path
   $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
   $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
   subst T: $projectRoot
   Set-Location T:\mobile
   npm run android
   Set-Location $projectRoot
   subst T: /d
   ```

En Windows, el alias de unidad corto evita el límite de rutas de Ninja durante Android Codegen sin copiar el proyecto ni activar rutas largas con privilegios administrativos. Usa una letra libre si `T:` ya está ocupada. Se validó la compilación móvil para `armeabi-v7a`, `arm64-v8a`, `x86` y `x86_64`.

La navegación principal conserva cinco pestañas: Inicio, Radar, Calcular, Portafolio y Ajustes. El menú usa iconos y resalta la pestaña activa. “Conoce más sobre CETES” desde Inicio abre una pantalla educativa secundaria con acordeones para los conceptos existentes; Educación no es una pestaña independiente.

Calcular presenta una calculadora de rendimientos. Usa el precio a descuento `10 / (1 + tasa × días / 360)`, cuenta títulos enteros y estima el valor nominal al vencimiento. Los resultados son estimaciones, antes de impuestos, y no significan que se haya realizado una compra.

Mi portafolio distingue registros locales, cálculos guardados y datos verificados. Los registros manuales son opcionales, se etiquetan como no verificados y no se mezclan con cálculos guardados. Sin registros, se muestra un estado vacío; no se incluyen inversiones ficticias. La vista presenta capital declarado en registros activos, rendimientos estimados, vencimientos e historial.

El portal público de [CETESdirecto](https://www.cetesdirecto.com/sites/portal/inicio) describe su servicio para invertir en valores gubernamentales. CETES Smart no tiene verificada una API pública oficial para consultar operaciones personales, por lo que no solicita credenciales ni intenta consultar cuentas. `mobile/src/services/portfolioProvider.ts` deja un contrato tipado para conectar una fuente autorizada si se documenta y habilita en el futuro; actualmente no hay proveedor conectado.

Las notificaciones locales de vencimiento se habilitan desde Ajustes. Android puede solicitar permiso para mostrarlas. Los cambios de tasas favoritas pueden notificar variaciones de al menos 0.10 puntos porcentuales.

Las notificaciones de vencimiento incluyen un aviso previo y otro el día del vencimiento. Para desactivarlas, se cancelan únicamente los avisos programados por CETES Smart.

## Aplicación Wear OS

Desde PowerShell:

```powershell
Set-Location smartwatch
.\gradlew.bat :app:assembleDebug
```

Instala el APK en un emulador Wear OS:

```powershell
adb install .\app\build\outputs\apk\debug\app-debug.apk
```

Empareja el emulador Wear OS con el emulador de teléfono desde Device Manager de Android Studio. Instala y ejecuta ambas apps con la misma firma de depuración. El reloj ofrece un resumen, Radar, simulador rápido con cantidades predefinidas, la última simulación recibida y el siguiente vencimiento. También muestra si los recordatorios están activados en el teléfono. Una simulación se guarda en el teléfono al sincronizarse; marcar un vencimiento como atendido actualiza las preferencias locales.

Para probar dos emuladores sin la app complementaria Wear OS ni emparejamiento de Google Play, abre CETES Smart en el reloj y ejecuta `.\sync-puente.ps1` desde la raíz. El script detecta el emulador Wear OS y crea el reenvío ADB del puerto 8765. Al no encontrar un reloj disponible por Data Layer, la app móvil debug envía la instantánea al servidor local de la app del reloj. Esta ruta y el permiso HTTP solo se incluyen en debug; la versión release conserva Data Layer como único transporte. La instantánea contiene tasas oficiales filtradas y nunca incluye el token de Banxico.

Para mostrar los datos en el reloj sin emparejarlo con un teléfono, compila la variante debug, inicia el emulador Wear OS y ejecuta `.\demo-reloj.bat` desde la raíz. El script consulta en Banxico las mismas cuatro series oficiales que la app móvil y envía la instantánea al almacenamiento del reloj. Requiere un token en `mobile\.env` (o `BANXICO_API_TOKEN` en el entorno); el receptor solo existe en debug y no cambia la sincronización normal.

## Pruebas y límites conocidos

- Las pruebas unitarias cubren el cálculo de descuento, vencimiento aproximado, recordatorios, validación de respuestas Banxico y vigencia de observaciones.
- El proyecto se preparó para compilar con Android SDK 36 y JDK 17. El APK móvil de depuración está en `mobile/android/app/build/outputs/apk/debug/app-debug.apk`; incluye `armeabi-v7a`, `arm64-v8a`, `x86` y `x86_64`. El APK Wear OS está en `smartwatch/app/build/outputs/apk/debug/app-debug.apk`.
- La sincronización principal usa Wear Data Layer y requiere un teléfono y un emulador/reloj Wear OS emparejados. En debug, si no hay reloj disponible, se puede usar el puente local descrito arriba; release no abre ese servidor ni permite HTTP en claro.
- En Windows, Android Codegen puede generar rutas C++ más largas que el límite MAX_PATH de Ninja desde carpetas profundas. El alias `subst` documentado compila desde la ubicación original sin copia temporal ni cambios globales del sistema.
- La integración autenticada se verificó contra Banxico para los cuatro plazos: `SF43936`, `SF43939`, `SF43942` y `SF43945`. Para repetir la consulta se necesita un token SIE vigente en el `.env` local.
- `npm audit` reporta 22 avisos bajos/moderados (8 bajos, 14 moderados; ninguno alto o crítico), principalmente en herramientas del CLI y pruebas. `npm audit fix --dry-run` no encontró actualizaciones compatibles; no se aplicaron overrides ni actualizaciones incompatibles.
- El rendimiento, la cantidad de títulos, los días de vencimiento y el precio final son aproximados; no incorporan calendarios de subastas, días inhábiles, impuestos ni datos de CETESdirecto.
- Las preferencias y registros permanecen en el dispositivo. AsyncStorage no es una base de datos cifrada.
- El token SIE no debe distribuirse en el cliente móvil; usa un backend para un despliegue público.
