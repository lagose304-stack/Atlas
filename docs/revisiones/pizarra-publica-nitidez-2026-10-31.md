# Pizarra pública: herramientas y nitidez al ampliar

Revisión local del 31 de octubre de 2026. Se utilizó el visor real con una placa SVG ficticia de alta resolución; autenticación y Supabase se sustituyeron por simulaciones, y se bloquearon las conexiones externas. No se consultaron ni modificaron datos de producción.

## Problema y correcciones

La pizarra estaba dentro de la capa CSS que amplía la imagen. El texto creado con aumento usaba una fuente local pequeña que podía quedar rasterizada y estirada por el compositor. También se estimaba el fondo por número de caracteres, lo que producía marcos desajustados.

La pizarra ahora se dibuja en un SVG independiente, junto a la capa de imagen. `useWhiteboardProjection.ts` reproduce la matriz visible de la imagen mediante una transformación SVG nativa, incluyendo giro, paneo, adaptación de tamaño y las transiciones de zoom. Actualiza la matriz antes del repintado, sin solicitar un render de React por cada cuadro de la animación.

`WhiteboardText.tsx` normaliza la fuente dentro del SVG, mide los glifos reales y calcula fondo, zona de selección y límites de movimiento a partir de esas medidas. El fondo cambia de claro a oscuro según la tinta; al guardar se ajusta el texto a los bordes de la placa. Los textos existentes mantienen su anclaje y acompañan el aumento de la imagen.

## Comprobación herramienta por herramienta

| Herramienta | Comprobación y resultado |
| --- | --- |
| Texto | Texto de 22 px creado a 1×, 2× y 6× mantiene tamaño y anchura visual. Sin ancestro HTML/SVG raíz ampliado mediante CSS. Se inspeccionaron capturas del texto en densidades 1 y 2; fondo y selección ajustados a los glifos. |
| Lápiz | Trazo vectorial suavizado; un nuevo trazo con grosor de 3 px conserva ese grosor visual en los tres aumentos. Los trazos existentes acompañan el zoom. |
| Resaltador | Trazo de 16 px, opacidad de 30%, extremos redondeados; no se convierte en una capa opaca al ampliar. |
| Flecha | Grosor elegido, punta y orientación conservados; el marco incluye los extremos reales de la punta, sin un margen excesivo. |
| Línea | Trazo continuo con grosor correcto y coordenadas alineadas con la placa. |
| Elipse | Shift produce un círculo físico en una placa rectangular. Los gestos sin ancho o alto suficiente se descartan. |
| Rectángulo | Shift produce un cuadrado; se descartan figuras aplastadas. Un ajuste que colapsaría la figura conserva la anterior. |
| Selección | Selección desde el interior de las figuras, movimiento, duplicado y ajuste por extremos. Los controles conservan su zona de acierto al ampliar; el marco del texto usa las medidas reales. |
| Borrador | Zona de acierto ampliada sobre los trazos. Tocar el interior vacío de una figura no la borra; tocar su contorno sí. Deshacer recupera el apunte. |
| Láser | Funciona en ambas densidades, no crea apuntes y limpia inmediatamente su rastro al cambiar de herramienta. El bucle de animación solo se ejecuta mientras está activo. |
| Mano | Paneo con alineación entre imagen y pizarra. Se contrastaron límites visibles después del movimiento y del giro de 90° y su reversión. |

La auditoría de escritorio cubre seis escenarios: zoom 1×, 2× y 6× con densidad de píxeles 1 y 2, en Chromium. La diferencia de alineación aceptada entre los límites de la imagen y la superficie de dibujo es inferior a 1 px CSS. Se conservaron las comprobaciones de texto editable, formas, historial, borrado, ciclo temporal, zoom con dos dedos y dibujo táctil en móvil y horizontal.

## Límites y persistencia

Las comprobaciones usan contenido ficticio y no demuestran un despliegue en producción ni una revisión en todos los navegadores y dispositivos físicos. No cambia el formato de señalados o mapas publicados. Los apuntes siguen existiendo únicamente en memoria y se descartan al cambiar de placa o cerrar el visor.

## Seguimiento: corte del láser con movimientos rápidos

Se encontró un reinicio completo de la estela ante saltos mayores de 75 px entre muestras y ante pausas de 200 ms. Salir del lienzo también vaciaba los puntos inmediatamente. `laserTrail.ts` elimina el reinicio por distancia, adapta el seguimiento a la velocidad e interpola el recorrido; las pausas y reentradas conservan los trazos anteriores pero comienzan segmentos separados. La densidad se reduce sin recortar los extremos todavía visibles.

En Chromium con la misma placa ficticia y red externa bloqueada se verificaron saltos de 800–1000 px, inversión rápida de dirección, continuidad de la estela anterior, ausencia de líneas entre posiciones separadas por una pausa, desvanecimiento al salir del lienzo, un punto aislado, caducidad después de 1750 ms y limpieza inmediata al cambiar de herramienta. No cambia la persistencia de apuntes ni la publicación.


## Corrección de interacción táctil

Se detectó que los eventos touch del SVG llegaban también al listener nativo del contenedor, que iniciaba arrastre mientras Pointer Events dibujaba y ejecutaba otro pellizco. El SVG aísla ahora start/move/end/cancel y el contenedor no gestiona gestos mientras está abierta la pizarra. Mano/láser usan listeners touch nativos no pasivos; las actualizaciones de vista se agrupan mediante requestAnimationFrame y se confirman al finalizar. Se espera a levantar todos los dedos antes de reanudar tras un pellizco, sin pausas temporales arbitrarias en mano/láser. Las cancelaciones de trazo descartan el borrador y apoyar un contacto táctil no cancela el lápiz digital activo.

Se conserva el filtro inicial durante el pellizco, se pospone el cambio a srcZoom hasta acabar y el clamp considera placas giradas. Los controles principales de pizarra tienen objetivos de 44 px con pointer:coarse.

Pruebas unitarias añadidas: aislamiento de eventos frente al contenedor y contacto de palma/dedo durante un trazo de lápiz digital. Comprobación aislada en Chromium con Input.dispatchTouchEvent: dibujo sin movimiento de placa, zoom ×2 con ancla entre dedos (incluido desplazamiento del punto medio), transición 2→1→0 sin apuntes ni arrastre accidental, mano con desplazamiento previsto, touchcancel, lápiz/resaltador/flecha/línea/elipse/rectángulo/texto, mover texto con selección, borrar con el dedo y deshacer, láser sin arrastrar ni dejar marcas permanentes y pellizco con placa girada en 390×844 y 768×1024. No se probó hardware físico ni Safari; no se declara compatibilidad certificada. Ninguna escritura remota ni publicación.


## Verificación ampliada del pellizco: visor público y pizarra

El visor normal usa ahora la misma cola de actualización por fotograma y confirma el último valor al terminar o cancelar. Al comenzar el pellizco se descarta el candidato a tap/doble tap o navegación por deslizamiento. Se admite un tercer contacto sin reiniciar el gesto, y al sustituir un dedo se toma una nueva referencia desde la vista actual para evitar saltos. Los dos modos mantienen constantes filtro, matriz de enfoque y opacidad de grano durante el gesto; el cambio a la imagen de alta resolución sigue aplazado hasta finalizar.

Se añadieron pruebas de componente para confirmar el último fotograma al pasar de dos dedos a uno, ignorar el dedo restante y cancelar/reiniciar desde el zoom alcanzado. La prueba aislada en Chromium cubre 24 combinaciones: 390×844, 768×1024 y 1440×1000; visor público, pizarra con lápiz, mano y láser; placa normal y girada 90°. Comprueba escala continua, desplazamiento del punto medio, zoom mínimo, filtros/enfoque y número de capas estables durante el gesto, tercer dedo, sustitución de contacto, zoom hacia fuera, cancelación sin salto tardío y ausencia de apuntes accidentales. Es emulación de eventos táctiles, sin certificación de hardware físico.
