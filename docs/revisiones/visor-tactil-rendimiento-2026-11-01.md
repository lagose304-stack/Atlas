# Respuesta táctil del visor y la pizarra

Cambio local del 1 de noviembre de 2026, posterior a `44d4748`. El usuario sigue percibiendo retraso en tablet con diferentes navegadores. La mejora anterior de renderizado no equivalía a una comprobación de latencia táctil en su dispositivo.

## Recorrido modificado

Durante un arrastre o pellizco táctil, la imagen se transforma directamente por fotograma, sin actualizar el estado de React en cada movimiento. También se actualizan el porcentaje accesible y la ventana del minimapa. El evento interno `atlas-direct-view-transform` sincroniza la proyección SVG de la pizarra antes del mismo repintado y cancela el seguimiento de transiciones que no se necesita durante el gesto.

Al terminar/cancelar, cambiar de herramienta o perder foco se confirma el último estado, incluidos los movimientos pendientes del siguiente fotograma. Los rótulos de señalados/mapas y paneles que dependen de zoom se recalculan al confirmar. Cambiar de placa o restablecer la vista también restablece explícitamente el DOM, porque su posición durante el gesto puede diferir del estado de React todavía sin confirmar. Ratón y rueda mantienen su recorrido anterior.

La previsualización del lápiz y resaltador escribe directamente en SVG, sin esperar un render de React. La curva incremental conserva exactamente los mismos puntos medios y extremo que `strokePath`; añade solo los segmentos nuevos. El historial recibe una copia inmutable al confirmar. La matriz inversa se reutiliza mientras la transformación de la escena sea la misma y se invalida al redimensionar.

No se reducen resolución, filtros ópticos, capas del láser ni muestras de entrada. Se conservan herramientas, límites, exportación y almacenamiento; no hay escrituras en Supabase/R2 ni publicación.

## Comparación controlada

Edge/Chromium en desarrollo local, tablet emulada de 1024 × 768, DPR 2, contactos táctiles habilitados y CPU ralentizada por cuatro. Imagen SVG ficticia de 4096 × 3072 con patrón repetido y zoom al 250 %. Se bloquean las peticiones externas y se simula el acceso. Se compara `44d4748` con el cambio local.

Recorrido de 100 fotogramas de arrastre con eventos Touch y otro de 100 fotogramas con cuatro muestras Pointer por fotograma para escritura. Las cifras excluyen el inicio y la confirmación del gesto.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Commits de React durante el arrastre | 100 | 0 |
| Tiempo acumulado de React durante el arrastre | 254,7 ms | 0 ms |
| P95 del intervalo entre fotogramas durante el arrastre | 15,1 ms | 6,4 ms |
| Commits de React durante la escritura | 100 | 0 |
| Lecturas de `getScreenCTM` durante la escritura | 400 | 0 |
| P95 del intervalo entre fotogramas durante la escritura | 6,4 ms | 6,3 ms |

La ausencia de commits durante el gesto no significa ausencia de trabajo: siguen ejecutándose los controladores, la composición y el pintado nativo. La medición de escritura no demuestra una mejora concluyente de FPS; el cambio elimina la espera del render de React para mostrar la tinta. Estas cifras no miden el tiempo completo entre sensor y pantalla ni sustituyen una tablet física.

## Comprobación

- Suite completa: 51 archivos y 479 pruebas correctas; tipos y compilación de producción correctos.
- Pruebas nuevas de gesto directo sin commits, porcentaje/minimapa en movimiento, mano de pizarra, confirmación/cancelación y reinicio/cambio de placa durante el gesto.
- Comparación exacta de la curva incremental con el trazado completo al crecer, repetir un fotograma, cambiar dimensiones, acortar y empezar otro trazo.
- La previsualización escribe en SVG sin commits de React; se conserva el extremo aunque termine antes del siguiente fotograma.
- Recorrido de navegador con contactos CDP: pellizco y arrastre normal, mano, escritura, cancelación del trazo provisional al pellizcar y reapertura de navegación. Diferencia de alineación entre imagen y pizarra inferior a 0,002 px en el recorrido; la punta coincide con el contacto dentro de 1 px y la geometría antes/después de confirmar es idéntica.
- Se descargaron PNG de vista actual y placa completa después de navegar y escribir. Se repitió el recorrido de formas, texto, selección, duplicado, borrador, deshacer/rehacer, giro y exportación del ajuste anterior. Sin errores JavaScript.

Pendiente: probar en la tablet del usuario, con sus imágenes habituales, y en hardware iPad/Android con dedo y lápiz digital. Este cambio todavía no está publicado.
