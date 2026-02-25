🚗 R5 Registro de Consumo

Aplicación web progresiva (PWA) para registrar y analizar el consumo real del Renault 5 E-Tech 52 kWh.

🌍 Disponible online:
👉 https://davofn.github.io/R5_Registro_Consumo/

📌 ¿Qué es?

R5 Registro de Consumo es una herramienta diseñada para:

📊 Registrar cada trayecto

🔋 Calcular consumo medio real (kWh/100 km)

💶 Estimar coste por trayecto

📈 Analizar medias por tipo de conducción

📁 Exportar e importar datos en CSV

📱 Usarse como app instalada en el móvil

Todo funciona 100% en local (localStorage), sin servidores externos.

🧠 Modelo de cálculo
🔋 Energía consumida

Se calcula automáticamente según:

(% batería inicio − % batería final) × 52 kWh

La batería útil considerada es de 52 kWh.

📊 Consumo medio
(kWh consumidos / km recorridos) × 100

Se calcula:

Consumo por trayecto

Media global

Media por tipo:

🏙 Ciudad

🛣 Autopista

🔄 Mixto

💶 Coste estimado

Por defecto:

🏠 Carga doméstica → 0,1176 €/kWh

Si se activa:

🔌 “Carga exterior” → permite introducir precio personalizado

❄️ Variables adicionales registradas

Cada trayecto puede incluir:

Climatización activada (Sí/No)

Asientos calefactables (Sí/No)

Notas libres

Esto permite analizar el impacto de confort en el consumo real.

🔎 Filtros inteligentes

El histórico permite filtrar por:

Tipo de trayecto

Uso de climatización

Uso de asientos calefactables

Las estadísticas se recalculan automáticamente según el filtro aplicado.

📱 Instalación como App

Al ser una PWA, puede instalarse como aplicación:

Android → “Instalar app”

iPhone → “Añadir a pantalla de inicio”

Funciona offline tras la primera carga.

💾 Exportación y copia de seguridad

Permite:

📤 Exportar histórico completo en CSV

📥 Importar CSV

🔄 Reemplazar o fusionar histórico

🗑 Limpiar histórico

Los datos se almacenan en:

localStorage → r5_consumo_log_history
🛠 Tecnologías utilizadas

HTML5

CSS3

JavaScript (Vanilla)

Service Worker

Web App Manifest

GitHub Pages

🎯 Objetivo del proyecto

Pasar de un Excel manual a una herramienta móvil:

Más rápida

Siempre disponible

Sin duplicar datos

Pensada para uso diario real

📦 Versiones

v1.0 → Registro básico

v1.1 → Histórico + medias globales

v1.2 → Exportación / Importación CSV

v1.3 → Climatización + Asientos calefactables

v1.4 → Filtros inteligentes y estadísticas dinámicas

👨‍💻 Autor

Proyecto personal desarrollado por David
Administrador de Sistemas

🚗 Renault 5 E-Tech · Datos reales · Ingeniería práctica
