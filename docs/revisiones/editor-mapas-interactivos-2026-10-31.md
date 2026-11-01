# Revisión funcional del editor de mapas interactivos

Revisión local del 31 de octubre de 2026, continuación de la iniciada el día anterior. Se revisaron `MapasInteractivos.tsx`, su guardado de secciones y ambos visores públicos: `InteractiveMapViewerModal` e `ImageViewerModal`.

## Entorno y alcance

Se inició el frontend en `http://localhost:5173/` y el backend opcional en el puerto 3001. Las pruebas usaron otro navegador con sesión, placas, mapas y respuestas de API simuladas en memoria. Se interceptaron las peticiones de imágenes y datos; no se ejecutaron escrituras en Supabase/R2 reales, SQL, migraciones ni despliegues.

Se usaron las habilidades de desarrollo de Atlas y Playwright. Las pruebas de navegador se mantuvieron en un archivo temporal según esta última habilidad.

## Herramientas y recorridos comprobados

| Área | Comprobación y resultado |
| --- | --- |
| Abrir mapa existente | Recupera placa, secciones y metadatos; abrir un registro antiguo con subtema vacío ya no realiza una actualización automática. |
| Lazo / Nueva selección | Dibujo libre, descarte del trazo y confirmación mediante el formulario. Se creó una selección dentro de otra sin capturar la región exterior. |
| Editar | Seleccionar la región interior, arrastrar un nodo y añadir un nodo sobre el borde. |
| Información | Título obligatorio, espacios repetidos, acentos, ñ, varias líneas, corrector español, menú contextual y negritas. Un título compuesto solo de espacios con formato no se acepta como válido. |
| Colores | Se recorrieron las opciones del formulario y se comprobó el color guardado. |
| Mover todo | Pasos de 1, 5 y 20 px, las cuatro direcciones, arrastre global y aumento/reducción de escala. |
| Lupa | Las tres sensibilidades, acercamiento y alejamiento por arrastre. El zoom transforma la presentación sin marcar por sí mismo el mapa como modificado. |
| Escape | No cierra ni borra el texto mientras se escribe. Fuera de formularios limpia la selección activa sin restaurar todos los cambios del mapa. |
| Limpiar no guardadas | Conserva el descarte explícito y restaura la placa original si había una sustitución pendiente. |
| Cambiar placa | Elegir la placa actual no interrumpe la imagen. Otra placa con distinta proporción conserva ID, número, textos y coordenadas normalizadas. Se comprobaron tanto descarte como guardado y reapertura. |
| Actualizar mapa | Se comprobaron guardado, error simulado, conservación de cambios tras el error y reintento exitoso. |
| Carga de imagen | Error visible, guardado bloqueado sin imagen válida y reintento que conserva las secciones. Una prueba de componente cubre el límite de espera de 15 segundos por candidato. |
| Salir | Confirmación de cambios pendientes, continuar editando y guardar/cerrar/reabrir. |
| Eliminar | Cancelar borrado, eliminar una zona y eliminar la última zona; se verificó la eliminación del mapa simulado al quedar sin secciones. |
| Visores públicos | Título y descripción muestran negritas en ambos visores. Las etiquetas de canvas/SVG y anuncios muestran el texto legible sin las marcas `**`. |
| Pantalla pequeña | A 390 × 844 se dibujó mediante eventos táctiles de Chromium, se escribió título e información con espacios y saltos de línea y se confirmó la zona. No equivale a una prueba en un teléfono físico. |

El recorrido completo terminó sin errores JavaScript. Los fallos HTTP de imagen y guardado se provocaron deliberadamente en las respuestas simuladas.

## Correcciones

- Se reutiliza `BoldField` para título e información: mismo formato `**texto**` del editor de señalados, corrector en español, negritas con botón y atajos, conservación de espacios y líneas. Se añadieron asociación accesible de etiquetas y desplazamiento del formulario en pantallas pequeñas.
- Escape ignora campos editables, composición de texto y diálogos abiertos; la limpieza de selección se separó del descarte completo del mapa.
- Al cambiar de placa se conserva el estado del mapa y se proyectan las coordenadas sobre las dimensiones de la imagen nueva. El cambio se guarda explícitamente; descartarlo recupera la referencia anterior. El selector bloquea placas identificadas como pertenecientes a otro mapa.
- La lista del administrador se vuelve a consultar al salir del editor para evitar reabrir la placa anterior desde datos desactualizados. El guardado también actualiza las marcas locales de placas con mapa e invalida la caché correspondiente.
- La carga de originales tiene límite de espera, limpieza de intentos antiguos y reintento sin reutilizar la respuesta fallida de caché. No se permite actualizar un mapa mientras falta una imagen válida.
- Abrir mapas con subtema antiguo completa únicamente el contexto local; la actualización del registro queda para un guardado explícito.
- La eliminación de una zona mantiene coherentes las secciones y la vinculación de placa cuando existía un cambio de imagen pendiente.

No se cambiaron el esquema ni el formato de coordenadas `image_uv_v1`. Los textos simples existentes siguen siendo compatibles; el formato de negrita se guarda en las mismas cadenas, sin columnas nuevas.

## Comportamientos existentes que conviene conocer

La primera selección de un mapa nuevo crea su registro al confirmar sus datos. En un mapa existente, las ediciones de información y geometría requieren «Actualizar mapa». Confirmar el borrado de una selección guarda esa eliminación; si era la última, elimina el registro del mapa, sin borrar la imagen de la placa. Estos recorridos de persistencia ya existían y se comprobaron únicamente con datos simulados.

Las sugerencias ortográficas dependen también del diccionario y configuración del navegador. Esta revisión no certifica el guardado remoto, las políticas de acceso ni todos los navegadores o dispositivos.

## Verificación permanente

`src/pages/MapasInteractivos.test.tsx` cubre siete casos de apertura sin escritura, Escape, formato/espacios, guardado, cambio de placa con distinta proporción y reapertura, descarte, error de imagen y límite de espera. `src/utils/boldTextContent.test.ts` comprueba los títulos legibles para canvas y anuncios. Las suites anteriores de `BoldField` y teclado del visor se conservaron.

La suite completa aprobó 411 pruebas en 43 archivos. Las pruebas relacionadas se volvieron a ejecutar tras afinar la validación de títulos vacíos con formato. La comprobación de tipos y la compilación del frontend fueron correctas.
