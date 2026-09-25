# Repaso rápido de 5to

Grado: 6 EGB | Clase 4 | 45 minutos sugeridos

## Objetivos

- Recuperar el uso de la matriz LED, los botones y los condicionales en micro:bit.
- Construir y probar un programa que muestre dos respuestas según el estado de un botón.

## Competencias

- Pensamiento lógico y resolución de problemas
- Comunicación de decisiones y trabajo colaborativo

## Destrezas

- Relacionar una entrada digital con una decisión y una salida visible, anticipando resultados.

## Indicadores Evaluacion

- Reconoce botón, matriz LED y función del programa.
- Implementa una condición con dos respuestas distintas.
- Comprueba los estados verdadero y falso y explica un ajuste.

## Recursos Necesarios

- Tiempo sugerido: 45 minutos
- Espacio de trabajo organizado y apoyos visuales

## Materiales

- Computador por pareja
- micro:bit y cable USB de datos, si están disponibles
- Hoja de registro

## Kits

- VirtiBit / micro:bit

## Software Requerido

- MakeCode para micro:bit y su simulador

## 1. Bienvenida

(5 min) Recupera lo que recuerdan de quinto: matriz LED, botones A y B, y decisiones. Usa las respuestas para ajustar el repaso, sin calificación diagnóstica punitiva.

## 2. Motivacion

En el simulador, mantén pulsado A para mostrar un corazón; suéltalo para mostrar una cara. Pide describir entrada y salida.

## 3. Preguntas Iniciales

¿Qué parte recibe nuestra acción? ¿Qué parte muestra el resultado? ¿Qué debería verse cuando nadie pulsa el botón?

## 4. Explicacion Teorica

(8 min) Un botón es una entrada, la matriz LED una salida y el programa decide qué mostrar. En para siempre se revisa continuamente si el botón A está presionado; si no, se ejecuta la alternativa. Distingue la condición de estado del botón del evento al presionar.

## 5. Analogias

Como un letrero con dos mensajes: el programa revisa si se cumple una condición y elige cuál mostrar.

## 6. Construccion Robot

No corresponde construir un robot en esta sesión. Programa de dos respuestas y tabla con condición, predicción y resultado observado.

## 7. Conexiones Electronicas

Si se usa la placa real, el docente comprueba el cable USB de datos y conecta únicamente micro:bit al computador. No se añaden motores ni circuitos externos en este repaso. El simulador permite completar toda la actividad.

## 8. Programacion

En MakeCode: para siempre → si botón A está presionado, mostrar icono corazón; si no, mostrar icono cara feliz. Predecir el resultado antes de pulsar A. Como ampliación, cambiar la condición al botón B y volver a probar.

## 9. Pruebas

Sin pulsar A aparece la cara; manteniendo A aparece el corazón; al soltarlo vuelve la cara. Comprueben además que B no active la condición configurada para A.

## 10. Posibles Errores

Confundir botón A y B; usar solo un evento cuando se quiere detectar el estado sostenido; colocar las salidas fuera del condicional; cable que solo carga.

## 11. Como Solucionarlos

Revisar el nombre de la entrada, usar si/si no dentro de para siempre y contrastar con el simulador. Si falla la conexión física, continuar en simulación y revisar el cable con el docente.

## 12. Preguntas Estudiantes

¿Dónde está la entrada? ¿Qué ocurre si la condición es falsa? ¿Qué comportamiento debería ser igual en la pantalla y en la placa?

## 13. Actividad Practica

(22 min) En parejas construyan el programa, prueben A presionado y liberado, y registren las salidas. Intercambien roles y modifiquen un icono sin alterar la condición. Si hay placas disponibles y el docente valida la conexión, transfieran el programa y comparen simulador y placa.

## 14. Proyecto Final

Programa de dos respuestas y tabla con condición, predicción y resultado observado.

## 15. Evaluacion Paso

Lista de cotejo formativa: logrado, en proceso o requiere apoyo. Observar: Reconoce botón, matriz LED y función del programa. Implementa una condición con dos respuestas distintas. Comprueba los estados verdadero y falso y explica un ajuste. Registrar la evidencia y una mejora; no calificar por rapidez.

## 16. Cierre Clase

(10 min) Guardar el proyecto y compartir una prueba. Registrar qué concepto necesita refuerzo antes de trabajar con sensores y variables.

## 17. Reflexion

La Esperanza se practica fijando una meta posible y avanzando con pruebas pequeñas, incluso cuando el primer intento no funciona.

## Tarea

Sin tarea obligatoria. Opcional: describir otro objeto cotidiano que responda a un botón.

## Orientaciones para el docente

- Duración sugerida: 45 minutos; ajustar al horario del paralelo.
- Usar el simulador ampliado, una plantilla de bloques y una tabla con iconos. Aceptar la demostración oral de los dos estados.
- Fechas y docente: completar según el paralelo.
- La destreza está formulada para esta sesión de Virtus; no se asigna un código ministerial no verificado.
- Evaluación formativa con evidencia, sin calificar por rapidez.

Referencia técnica: https://makecode.microbit.org/reference/input/button-is-pressed
