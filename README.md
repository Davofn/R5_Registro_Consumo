# 🚗 R5 Registro de Consumo

Aplicación web progresiva (PWA) para registrar y analizar el consumo real del **Renault 5 E-Tech 52 kWh**, con integración en tiempo real con **MyRenault** para mostrar estado de batería, autonomía y carga.

🌍 **Disponible online:** 👉 [https://davofn.github.io/R5_Registro_Consumo/](https://davofn.github.io/R5_Registro_Consumo/)

---

## 📌 ¿Qué es?

R5 Registro de Consumo es una herramienta diseñada para el uso diario real con el Renault 5 E-Tech. Permite:

- 📊 Registrar cada trayecto manualmente
- 🔋 Calcular consumo medio real (kWh/100 km)
- 💶 Estimar coste por trayecto y por ciclo de batería
- 📈 Analizar eficiencia por tipo de conducción
- 🔌 Ver en tiempo real el estado del vehículo (batería, autonomía, carga) vía MyRenault
- 📱 Instalarse como app nativa en el móvil (PWA)

Los datos se almacenan en **Supabase** (PostgreSQL en la nube) y se sincronizan en tiempo real entre dispositivos.

---

## 🏗 Arquitectura

```
Frontend (GitHub Pages)          Backend (Render)           Servicios externos
─────────────────────────        ──────────────────         ──────────────────
index.html                  →    FastAPI (Python)       →   MyRenault API (Gigya)
app.js                           /renault/status             Kamereon API
style.css                        /health
manifest.json               ←    Estado del vehículo    →   Supabase (Auth + DB)
service-worker.js
```

### Frontend
- HTML5 + CSS3 + JavaScript puro (sin frameworks)
- PWA instalable en Android e iOS
- Desplegado en **GitHub Pages**

### Backend
- **FastAPI** + **renault-api** en Python
- Desplegado en **Render**
- Sesión Gigya persistente (un solo login al arrancar)
- Caché de 5 minutos para no saturar la API de Renault
- Autenticación via token Supabase o header `x-app-secret`

### Base de datos
- **Supabase** (PostgreSQL) para almacenamiento de trayectos
- Autenticación de usuarios con Supabase Auth
- Sincronización en tiempo real entre dispositivos

---

## 🔋 Estado del vehículo en tiempo real

La app consulta el backend cada **5 minutos** y muestra:

| Dato | Fuente |
|------|--------|
| % batería | MyRenault API |
| Autonomía estimada (km) | MyRenault API |
| Estado enchufe | MyRenault API |
| Estado carga | MyRenault API |
| Tiempo restante de carga | MyRenault API |
| Potencia de carga estimada (~kW) | Calculada (52 kWh, objetivo 80%) |
| Odómetro | MyRenault API |

> La potencia de carga se estima porque Renault no expone `chargingInstantaneousPower` en tiempo real. Se calcula como: `kWh restantes hasta 80% / horas restantes`.

Al **abrir la app** siempre se fuerza un refresco real (`?refresh=true`). Al **volver a la pestaña** tras más de 5 minutos, también se refresca automáticamente.

---

## 🧠 Modelo de cálculo

### 🔋 Energía consumida por trayecto

```
Energía (kWh) = (% batería inicio − % batería final) × 52 kWh
```

### 📊 Consumo medio

```
Consumo (kWh/100 km) = (kWh consumidos / km recorridos) × 100
```

Se calcula:
- Por trayecto individual
- Media global acumulada
- Media por tipo: 🏙 Ciudad · 🔄 Mixto · 🛣 Autopista

### 💶 Coste estimado

| Tipo de carga | Precio por defecto |
|--------------|-------------------|
| 🏠 Doméstica | 0,1176 €/kWh |
| 🔌 Exterior | Precio personalizable por trayecto |

---

## 📁 Ciclos de batería

Los trayectos se agrupan automáticamente en **ciclos de batería** detectando saltos de SoC (State of Charge). Cada ciclo muestra:

- Rango de batería (ej: `82% → 35%`)
- Km totales recorridos
- Energía consumida
- Consumo medio del ciclo
- Coste total
- Número de trayectos

---

## 📊 Pestañas de análisis

### Resumen
- Uso general (energía total, coste total)
- Ciclo de batería actual
- Consumo medio por tipo de trayecto

### Histórico
- Lista de ciclos con trayectos expandibles
- Filtros por tipo de trayecto y extras (climatización, asientos)
- Edición y eliminación de trayectos

### Insights
- Consumo mensual
- Eficiencia por tipo (ciudad / mixto / autopista) con autonomía estimada
- Frecuencia de carga en casa vs fuera

### Costes
- Resumen general y precio medio €/kWh
- Comparativa casa vs fuera
- Desglose por mes

---

## ❄️ Variables adicionales por trayecto

Cada trayecto puede registrar:

- **Climatización** (Sí/No) → impacto en consumo
- **Asientos calefactables** (Sí/No) → impacto en consumo
- **Carga exterior** → activa campo de precio personalizado
- **Notas libres**

---

## 📱 Instalación como App

Al ser una PWA, puede instalarse sin tienda de apps:

- **Android (Chrome)** → menú `···` → "Instalar app"
- **iPhone (Safari)** → botón compartir → "Añadir a pantalla de inicio"

Funciona offline tras la primera carga (Service Worker).

---

## 🛠 Tecnologías utilizadas

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Python 3.12, FastAPI, renault-api |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| API vehículo | renault-api (Gigya + Kamereon) |
| Hosting frontend | GitHub Pages |
| Hosting backend | Render |
| PWA | Service Worker + Web App Manifest |

---

## 🔧 Configuración del backend

Variables de entorno necesarias en Render:

```
MYRENAULT_EMAIL          # Cuenta MyRenault
MYRENAULT_PASSWORD       # Contraseña MyRenault
MYRENAULT_LOCALE         # es_ES
MYRENAULT_ACCOUNT_ID     # ID de cuenta Renault
MYRENAULT_VIN            # VIN del vehículo
SUPABASE_URL             # URL del proyecto Supabase
SUPABASE_ANON_KEY        # Clave anónima Supabase
ALLOWED_SUPABASE_USER_ID # UID del usuario autorizado
APP_SHARED_SECRET        # Secret para acceso directo (curl/tests)
CACHE_SECONDS            # Tiempo de caché en segundos (default: 300)
```

### Endpoints principales

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Estado del servidor y sesión |
| `GET /renault/status` | Estado del vehículo (con caché) |
| `GET /renault/status?refresh=true` | Fuerza consulta real a MyRenault |
| `GET /debug/config` | Verifica variables de entorno |
| `GET /debug/login` | Prueba login Gigya en aislamiento |

---

## 📦 Historial de versiones

| Versión | Cambios |
|---------|---------|
| v1.0 | Registro básico de trayectos |
| v1.1 | Histórico + medias globales |
| v1.2 | Exportación / Importación CSV |
| v1.3 | Climatización + Asientos calefactables |
| v1.4 | Filtros inteligentes y estadísticas dinámicas |
| v2.0 | Migración a Supabase, autenticación, multi-dispositivo |
| v3.0 | Backend FastAPI + integración MyRenault en tiempo real |
| v3.9 | Rediseño completo UI (dark slate), ciclos de batería, insights avanzados |

---

## 🎯 Objetivo del proyecto

Pasar de un Excel manual a una herramienta móvil pensada para el uso diario real:

- ⚡ Datos en tiempo real del vehículo sin abrir la app de Renault
- 📊 Análisis de consumo real vs estimaciones del fabricante
- 💶 Control exacto del coste por kilómetro
- 📱 Siempre disponible, instalada como app en el móvil

---

## 👨‍💻 Autor

Proyecto personal desarrollado por **David** — Administrador de Sistemas

🚗 Renault 5 E-Tech · Datos reales · Ingeniería práctica
