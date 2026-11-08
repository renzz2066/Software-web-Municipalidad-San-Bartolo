# Evaluación del Chat San Bartolo

Mide si el asistente cita la guía correcta para preguntas reales de funcionarios (specs/ia-chat-v1.md).
Meta: llegar a 50 preguntas en `preguntas.json` (`fuentes: []` = fuera de tema, debe responder sin fuentes).

## Cómo correrla
```bash
cd backend && npm run docs:evaluar            # solo recuperación (rápido, sin generar)
cd backend && npm run docs:evaluar -- --llm   # además genera la respuesta para revisarla
```
No escribe en la BD. Un acierto = alguna fuente esperada aparece entre las citadas.

## Resultados
| Fecha | Preguntas | Modo | Aciertos | Notas |
|---|---|---|---|---|
| 2026-11-07 | 20 | recuperación | 19/20 (95 %) | Falla "¿Cómo paso valores a cobranza coactiva?": ambigua (enviar o recibir); el LLM igual responde la transferencia. |
| 2026-11-07 | 20 | con LLM (`gemini-flash-lite-latest`) | 19/20 (95 %) | El fallo fue un 503 pasajero de Gemini, no una respuesta incorrecta. Fuera de tema: 2/2 sin fuentes. |

## Cómo mejorar una respuesta floja
1. Corre la evaluación y mira la pregunta con ✘.
2. Corrige la guía en `docs/ia/` (agrega cómo lo dicen los funcionarios: "pasar", "mandar", "Yape"…).
3. `npm run docs:ingest` (solo re-procesa la guía cambiada) y vuelve a evaluar.
