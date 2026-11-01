# Rendimiento del visor público y modo pizarra

Cambios y comprobaciones locales del 1 de noviembre de 2026. No se publicaron cambios ni se escribieron datos en Supabase o R2.

## Cambios

- La previsualización del dibujo tiene estado independiente: mover el lápiz no vuelve a renderizar barras, paneles ni el listado de apuntes. El gesto conserva las muestras en un buffer propio; cada fotograma recibe una copia y al confirmar se guarda otra copia para no mutar el historial.
- Los puntos agrupados del dispositivo usan una sola matriz de coordenadas por evento. Se mantienen el suavizado, el umbral de distancia, los puntos intermedios y el extremo del trazo.
- `WhiteboardMark.tsx` memoriza cada apunte y su curva, evitando reconstruir trazos terminados al añadir otros. Se conservan superficies de selección, texto, flechas, formas y tamaños.
- Rueda, arrastre y minimapa usan el mismo agrupado por fotograma que el control táctil. Soltar confirma el último estado; cambiar de placa descarta cambios de vista pendientes.
- El láser prepara una sola curva y sus normales para las cuatro capas de luz, y reutiliza esa geometría mientras no cambie el recorrido. Mantiene colores, grosores, interpolación y duración de la estela. La punta sigue directamente al cursor mientras la estela conserva su suavizado.
- El láser deja de repintar al terminar la estela, reanuda al mover o retirar el puntero y observa el tamaño de su canvas. La proyección SVG evita escrituras de transformaciones idénticas y no reinicia su efecto por recibir otro objeto con las mismas dimensiones.

No se cambian filtros ópticos, fuentes de imagen, límites de zoom, formatos persistidos, APIs, exportación ni almacenamiento.

## Medición comparativa

Edge/Chromium en desarrollo local, viewport de 1440 × 1000, DPR 1 y ralentización de CPU por cuatro mediante CDP. Una placa SVG ficticia de 1200 × 800 sustituye las imágenes remotas. La sesión del navegador es nueva, el acceso está simulado y se bloquean peticiones a cualquier origen externo.

Se compara el dibujo anterior de `64ba7c6` con la versión optimizada mediante 80 grupos de ocho eventos de movimiento. Cada evento aporta cuatro muestras agrupadas y su posición final. React Profiler mide el trabajo de renderizado durante ese recorrido; no mide la latencia completa entre el dispositivo y la pantalla.

| Medida durante el recorrido de lápiz | Antes | Después |
| --- | ---: | ---: |
| Tiempo acumulado de renderizado de React | 249,2 ms | 58,9 ms |
| Llamadas a `getScreenCTM` | 3891 | 640 |
| Percentil 95 del intervalo entre fotogramas del recorrido | 9,1 ms | 6,3 ms |

La reducción del tiempo de React fue aproximadamente del 76 % en esta comparación. Se mantienen 78 commits de React, ahora concentrados en el dibujo activo. Los resultados dependen del equipo, del navegador, de la carga y del contenido; no equivalen a una reducción del 76 % de la latencia total del visor.

En el recorrido de láser, el percentil 95 fue 28,8 ms antes y 29 ms después: no se observó una mejora concluyente de fluidez en esa medición. Se verificaron por separado la eliminación del desfase de la punta y la suspensión del repintado al quedar inactivo. No se redujeron capas ni resolución del efecto para mejorar esa cifra.

## Comprobación funcional

- Suite completa: 51 archivos y 475 pruebas correctas. Después del ajuste final de observación del canvas se repitieron las siete pruebas de teclado, gestos y respuesta del visor.
- Comprobación de tipos y compilación de producción correctas.
- Regresiones nuevas: conservación de muestras agrupadas y extremo antes del siguiente fotograma; historial sin mutaciones; previsualización sin reinstalar controles; zoom acumulado de rueda; última posición de arrastre; cambio de placa con zoom pendiente; punta e inactividad/reactivación del láser; geometría interpolada de su estela.
- Recorrido real de navegador con contenido ficticio: lápiz, resaltador, flecha, línea, elipse, rectángulo, texto, selección, duplicado, eliminación, borrador, deshacer y rehacer.
- Zoom y giro con comprobación de alineación entre imagen y pizarra; exportación real de vista actual y placa completa a PNG. Se inspeccionaron los archivos y las capturas.
- Viewport móvil de 390 × 844 y contactos táctiles mediante CDP: pellizco sin conservar el dibujo provisional.
- Sin errores JavaScript en los recorridos de navegador.

Las comprobaciones móviles son emuladas. Quedan pendientes la valoración perceptual en el dispositivo donde se detectó el retraso, una prueba física de lápiz digital/iOS/Android y la validación de producción después de un despliegue autorizado.
