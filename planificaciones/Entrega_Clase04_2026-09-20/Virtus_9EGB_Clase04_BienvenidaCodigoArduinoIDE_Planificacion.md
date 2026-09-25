# Bienvenida a 9no: código real en Arduino IDE

Grado: 9 EGB | Clase 4 | 45 minutos sugeridos

## Objetivos

- Relacionar una secuencia de bloques con instrucciones de un programa de Arduino.
- Distinguir setup y loop y explicar el comportamiento de un ejemplo sencillo.

## Competencias

- Pensamiento lógico y resolución de problemas
- Comunicación de decisiones y trabajo colaborativo

## Destrezas

- Interpretar una secuencia textual de control y relacionarla con acciones observables, localizando errores simples.

## Indicadores Evaluacion

- Distingue setup de loop.
- Relaciona cada instrucción principal con una acción.
- Predice el efecto de cambiar una espera y localiza un error de sintaxis sencillo.

## Recursos Necesarios

- Tiempo sugerido: 45 minutos
- Espacio de trabajo organizado y apoyos visuales

## Materiales

- Computador y proyector
- Tarjetas de bloques y código
- Arduino Uno y USB para demostración opcional

## Kits

- Arduino Uno, opcional para demostración

## Software Requerido

- Arduino IDE previamente instalado, o ejemplo impreso

## 1. Bienvenida

(5 min) Recupera las ideas de secuencia, repetición y condición conocidas en bloques. Presenta el paso al texto como otra forma de expresar esa lógica.

## 2. Motivacion

Muestra dos representaciones del mismo parpadeo: bloques y código. Pide encontrar acciones conocidas antes de explicar símbolos nuevos.

## 3. Preguntas Iniciales

¿Qué parte se hace una sola vez? ¿Qué debe repetirse? ¿Qué cambia al escribir instrucciones en lugar de arrastrarlas?

## 4. Explicacion Teorica

(8 min) setup se ejecuta una vez al iniciar o reiniciar; loop se repite. Las llaves delimitan bloques y muchas instrucciones terminan con punto y coma. El ejemplo configura el LED integrado como salida y alterna encendido, espera, apagado y espera.

## 5. Analogias

setup es preparar el espacio antes de una actividad; loop es la rutina que se repite una vez que todo está preparado.

## 6. Construccion Robot

No corresponde construir un robot en esta sesión. Programa anotado con funciones y acciones, predicción sobre las esperas y corrección justificada de un error simple.

## 7. Conexiones Electronicas

Demostración opcional con Arduino Uno conectado por USB y su LED integrado; no se monta circuito externo. La interpretación del código puede hacerse por completo en papel.

## 8. Programacion

Ejemplo docente: void setup() { pinMode(LED_BUILTIN, OUTPUT); } void loop() { digitalWrite(LED_BUILTIN, HIGH); delay(1000); digitalWrite(LED_BUILTIN, LOW); delay(1000); }. Leer cada línea antes de ejecutarla. Cambiar ambas esperas a 500 para comparar, si el entorno está preparado.

## 9. Pruebas

Seguir un ciclo con el dedo y comprobar encendido-espera-apagado-espera. Comparar la predicción con la demostración o una representación temporal en papel.

## 10. Posibles Errores

Creer que setup se repite; omitir punto y coma o llave; confundir compilar con cargar a una placa; cambiar varias cosas a la vez.

## 11. Como Solucionarlos

Delimitar las dos funciones, revisar el primer error señalado y corregir un cambio por vez. Explicar que verificar revisa el programa y cargar lo transfiere cuando hay una placa configurada.

## 12. Preguntas Estudiantes

¿Qué parte se ejecuta solo al comenzar? ¿Por qué hay dos esperas? ¿Qué conocimiento de bloques te ayudó a leer este programa?

## 13. Actividad Practica

(22 min) En parejas emparejen tarjetas de acciones con líneas del programa. Marquen setup y loop con colores y describan un ciclo completo. Predigan qué cambia al reducir la espera. Revisen una copia con un punto y coma omitido y expliquen cómo la repararían. El docente puede verificar y demostrar el programa; la instalación del IDE se aborda en la clase prevista.

## 14. Proyecto Final

Programa anotado con funciones y acciones, predicción sobre las esperas y corrección justificada de un error simple.

## 15. Evaluacion Paso

Lista de cotejo formativa: logrado, en proceso o requiere apoyo. Observar: Distingue setup de loop. Relaciona cada instrucción principal con una acción. Predice el efecto de cambiar una espera y localiza un error de sintaxis sencillo. Registrar la evidencia y una mejora; no calificar por rapidez.

## 16. Cierre Clase

(10 min) Compartir una lectura del programa y una corrección. Registrar las dudas para la exploración posterior del IDE.

## 17. Reflexion

Trabajar con Excelencia significa explicar lo que se hace, revisar evidencias y mejorar una versión; copiar código sin comprenderlo no permite verificarlo.

## Tarea

Sin tarea obligatoria. Opcional: escribir una rutina cotidiana separando preparación y acciones repetidas.

## Orientaciones para el docente

- Duración sugerida: 45 minutos; ajustar al horario del paralelo.
- Ofrecer código impreso con letra grande, líneas numeradas y tarjetas de acciones. Permitir la explicación oral sin exigir teclear.
- Fechas y docente: completar según el paralelo.
- La destreza está formulada para esta sesión de Virtus; no se asigna un código ministerial no verificado.
- Evaluación formativa con evidencia, sin calificar por rapidez.

Referencia técnica: https://docs.arduino.cc/built-in-examples/basics/Blink/
