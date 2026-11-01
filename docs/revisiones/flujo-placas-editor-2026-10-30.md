# Recorrido de placas y editor de señalados — 30 de octubre de 2026

**Estado: corrección local verificada. No se desplegó código ni se crearon, clasificaron, editaron o borraron imágenes reales como prueba.**

## Recorrido comprobado en navegador

Se usó el frontend de `localhost:5173` con sesión ficticia, catálogos, imágenes, API de archivos y almacenamiento de registros simulados. Todas las peticiones externas y las operaciones `/api/` quedaron interceptadas; únicamente se permitió leer los recursos del frontend local. La conexión en tiempo real también se simuló.

1. Abrir Gestión de Placas.
2. Elegir subida sin clasificar y seleccionar una imagen de prueba local.
3. Convertir y enviar la imagen a la API simulada.
4. Confirmar la fila de lista de espera.
5. Abrir Lista de espera, elegir la tarjeta y asignar tema/subtema.
6. Abrir el panel y clasificar.
7. Confirmar que existe una placa clasificada y que ya no existe su fila en espera.
8. Abrir Editar placas (`MoverPlaca`), filtrar y seleccionar la placa.
9. Abrir el editor visual de señalados.
10. Elegir herramienta Individual, escribir un nombre y colocar el punto.
11. Aplicar los señalados al panel y pulsar Guardar cambios de la placa.
12. Recargar, reabrir la placa y comprobar que el nombre y las coordenadas se conservan.

## Escenarios y resultados

| Escenario | Resultado observado |
| --- | --- |
| Subida sin clasificar → clasificación → señalado → guardado → recarga | Completo, coordenadas conservadas, sin errores JavaScript. |
| Miniatura disponible y original con HTTP 404 al abrir el editor | Antes de la corrección, el editor mostraba una imagen rota y ninguna explicación; permitía guardar. Después muestra el aviso y bloquea el guardado. |
| Original vuelve a estar disponible al reintentar | Recupera la imagen y permite colocar, guardar y recuperar el señalado tras recargar. |
| Falla la copia física y se usa la firma anterior de clasificación | Conserva la referencia de origen, clasifica mediante la alternativa simulada y completa edición, guardado y reapertura. |
| Subida ya clasificada, sin pasar por espera | Completa alta, edición visual, guardado del señalado y reapertura tras recargar. |

Estos resultados reproducen un editor vacío por fallo del original; no demuestran que toda pantalla negra informada por un usuario tenga esa misma causa. En los recorridos completados no se observó una excepción JavaScript que derribara toda la aplicación.

## Corrección

En `PlateAnnotationViewerEditor.tsx`:

- Se usan los candidatos de imagen original de R2; no se sustituye el original por una miniatura para editar.
- Se distinguen carga, imagen lista y error, incluyendo una espera máxima de 15 segundos.
- El fallo muestra una explicación, reintento y salida al panel anterior, conservando los señalados del editor.
- Reintentar evita reutilizar la respuesta fallida de caché. Al cambiar el origen se reinicia el estado de carga y se comprueban imágenes ya cargadas en caché.
- Se bloquean el guardado y la colocación de coordenadas mientras no está listo el original.
- El mensaje de éxito del editor visual describe que los señalados se aplicaron al editor; no afirma que ya se hayan guardado en la base. En `MoverPlaca` todavía hay que confirmar con Guardar cambios.

Se conservaron las 18 pruebas previas de edición y se añadieron seis de carga/error: bloqueo inicial, fallo y reintento sin pérdida de marcadores, salida disponible, alternativa R2, límite de espera y cambio de imagen. La suite completa tiene 390 pruebas aprobadas; la revisión de tipos y la compilación del frontend fueron correctas.

## Límites y continuación

Los servicios remotos de producción no se ejercitaron con escrituras; sus resultados reales, disponibilidad y latencias pueden diferir de las respuestas simuladas. El navegador se comprobó en escritorio a 1440 × 1000. Esta revisión cubre los recorridos de placas enumerados, no certifica todos los flujos de evaluaciones, bloques, mapas o eliminaciones.

Las pruebas de navegador se ejecutaron desde un archivo temporal conforme a la habilidad Playwright. Los casos permanentes están en `src/components/PlateAnnotationViewerEditor.imageLoading.test.tsx` y `src/components/PlateAnnotationViewerEditor.test.tsx`.
