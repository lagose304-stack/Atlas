# Corrección de layout y pintura en tablets

Cambio local del 1 de noviembre de 2026, posterior a `d8cc85d`. El usuario informa que el último ajuste se siente peor en tablet. Las pruebas anteriores de commits de React no demostraban una mejora de latencia táctil y no evaluaban suficientemente el trabajo de layout/pintura.

## Investigación y causas

Se consultaron fuentes primarias sobre entrada, layout y pintura:

- [web.dev: evitar layout síncrono](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing) describe el coste de alternar escrituras de estilos y lecturas geométricas. En el recorrido anterior, `paintTouchView` movía la imagen y disparaba un evento cuya proyección volvía a consultar estilo y rectángulos. El minimapa también reemplazaba el texto de porcentaje aunque no cambiara y escribía coordenadas de layout en cada movimiento.
- [web.dev: animaciones de alto rendimiento](https://web.dev/articles/animations-guide) recomienda inspeccionar pintura y composición, además de JavaScript. Atlas aplica convolución SVG, sombra y grano a la fotografía y desenfoque al fondo de algunas tarjetas. Su coste depende del navegador y la superficie; no se ha demostrado qué parte dominaba en la tablet del usuario.
- [Chrome: Canvas de baja latencia](https://developer.chrome.com/blog/desynchronized) y [MDN: opciones de getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) documentan Canvas y la sugerencia `desynchronized`. Es una sugerencia al navegador, no una garantía de implementación ni de latencia en Safari.
- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) explica cómo declarar la intención de gestionar gestos. Se conserva `touch-action: none` en las superficies interactivas y el tratamiento existente de cancelaciones; el listener global del minimapa, que no cancela eventos, pasa a ser pasivo.

## Implementación

La proyección directa prepara centro, dimensiones y origen fuera del movimiento, y calcula la matriz con los parámetros del gesto. No consulta medidas ni estilos después de transformar la imagen. El tamaño del contenedor se mantiene mediante ResizeObserver. El porcentaje solo cambia de nodo cuando cambia su valor. El minimapa usa traslación, comparte esa representación con React y contiene su layout/pintura. La escena SVG no se monta cuando está vacía y la pizarra cerrada.

La escritura en curso utiliza un Canvas independiente, a la densidad de píxeles de la pantalla, con una curva `Path2D` incremental y el mismo recorte y transparencia. Se solicita `desynchronized: true` cuando se crea el contexto; el navegador puede ignorarlo. Sin Canvas/Path2D/contexto disponible se conserva la alternativa SVG. Al confirmar, se retira la capa y se genera el apunte SVG original desde la copia del mismo buffer. Selección, edición, deshacer/rehacer, guardado PNG y datos permanecen en su recorrido habitual. No se rasterizan los apuntes terminados.

Durante contactos/arrastres se pausan convolución de enfoque, sombra, grano y desenfoque de tarjetas; se conservan el original a resolución completa y los filtros de color. Los efectos se restauran al levantar todos los contactos, cancelar, perder foco o desmontar. No se modifica R2, Supabase ni el archivo de imagen.

## Comparación controlada

Se compara `d8cc85d` con la corrección local en Edge/Chromium, viewport de tablet 1024 × 768, DPR 2 y CPU ralentizada por cuatro. Una imagen WebP ficticia de 4096 × 3072 sustituye la anterior imagen SVG de las pruebas. Se bloquean conexiones externas y se simula el acceso. Se realizan 100 fotogramas de arrastre a zoom 250 % y 100 de escritura, con cuatro muestras Pointer por fotograma.

Las métricas de Performance del navegador incluyen preparación/finalización próxima al recorrido; no miden el tiempo físico desde el sensor hasta la pantalla.

| Trabajo del navegador | Versión anterior | Corrección |
| --- | ---: | ---: |
| Layouts durante el arrastre | 102 | 3 |
| Tiempo acumulado de layout, arrastre | 30,7 ms | 0,8 ms |
| Recálculos de estilo, arrastre | 212 | 106 |
| Layouts durante la escritura | 100 | 0 |
| Tiempo acumulado de layout, escritura | 7,2 ms | 0 ms |
| Recálculos de estilo, escritura | 100 | 2 |

Los intervalos P95 entre fotogramas de este equipo permanecieron próximos a 6–7 ms. No se afirma una mejora de FPS ni de latencia física basada en esas cifras. Lo confirmado es la eliminación del layout repetido del recorrido y del SVG creciente durante la tinta provisional.

## Validación y límites

- 53 archivos y 483 pruebas aprobadas; tipos y compilación correctos. Se comprobó de nuevo la confirmación del minimapa tras la comparación completa.
- Pruebas de proyección con zoom/giro/desplazamiento, conservación de transparencia y recorte de la curva Canvas, y restauración del modo de interacción con varios contactos, cancelación y pérdida de foco.
- Recorrido con contactos CDP: arrastre/pellizco normal, mano, escritura y cancelación del trazo provisional al pellizcar. Se comprobó tinta visible en el píxel bajo el contacto, coincidencia del extremo final dentro de 1 px y alineación imagen/pizarra inferior a 0,002 px.
- En navegador se comprobó que enfoque/sombra/grano se pausen durante la escritura y vuelvan al soltar.
- Se descargaron PNG de vista actual y placa completa. Se repitieron formas, texto, selección, duplicado, borrador, deshacer/rehacer y giro. Sin errores JavaScript.
- SVG como alternativa sin Canvas se comprueba en jsdom. No se instaló ni ejecutó WebKit; el navegador de emulación es Chromium. No equivale a probar iPad/Safari o una tablet Android física.

Esta primera corrección se subió a `main` en `9b0d2d3`. Posteriormente, el usuario confirmó gestos y escritura fluidos en celular Android, pero retraso persistente en tablet Android con el mismo navegador y tanto con dedo como con lápiz. No se conoce el modelo concreto ni se ha medido ese hardware.

## Ajuste posterior para superficies grandes (local)

La limpieza de la tinta provisional abarcaba toda la capa en cada actualización. Ahora se acumulan los límites del trazo y se limpia su huella completa, proyectada a píxeles físicos con margen de grosor y antialias. Se conserva el repintado completo del propio trazo para no acumular opacidad en los cruces. Cambiar proyección, estilo o tamaño invalida la región y limpia toda la capa. ResizeObserver evita reasignar dimensiones idénticas, operación que reinicia el Canvas. Se conservan resolución, curva y formato persistido. [MDN sobre optimización de Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) describe limitar trabajo de dibujo y separar capas.

También faltaba pausar el desenfoque de ocho controles del visor, incluida la barra de herramientas. Se marcan con `data-viewer-backdrop` y su desenfoque se desactiva sin transición durante el contacto; vuelve al terminar. [WebKit sobre backdrop-filter](https://webkit.org/blog/3632/introducing-backdrop-filters/) explica los pasos de renderizado adicionales de estos efectos. Su contribución al retraso de la tablet concreta sigue siendo una hipótesis.

Verificación local: 20 pruebas relacionadas aprobadas, tipos y compilación correctos. En Chromium se comparó la salida Canvas con un repintado completo independiente, incluyendo muestras agrupadas, cruces, zoom, giro, lápiz y resaltador a DPR 2 y 3: ninguna diferencia de píxeles en las capturas comparadas. También se comprobaron contactos táctiles, alineación, cancelación por pellizco, pausa de desenfoques y exportación de vista/placa completa, sin errores JavaScript. No se interpreta la menor superficie limpiada como una medición de FPS o de latencia física.

Este ajuste posterior permanece local y no permite dar por resuelto el retraso de la tablet.
