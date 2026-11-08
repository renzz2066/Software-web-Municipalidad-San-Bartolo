# Spec: Chat San Bartolo — asistente IA de trámites (v1)
<!-- Formato fijo 5 secciones. Plan aprobado "Chat San Bartolo" (7-nov-2026). Las `*-v1.md` cerradas no se editan. -->

Base: `app-shell-v1` (AppShell, tokens `@theme`) y `modulos-esqueleto-v1` (niveles). Rama `chat`: sin commits ni PR
hasta orden del líder. Fuera de v1: streaming SSE, consultas de datos de contribuyentes (Ley 29733), alertas
gerenciales, `ai-service` Python, subida de documentos por UI, TUPA desde SIMUN, chat ciudadano.

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR/CAJERO con acceso `ayuda.chat`, quiero preguntar cómo hacer un trámite (OP, cobro, fraccionamiento,
  transferencia a coactivo…) y recibir pasos con la guía citada, para no depender de otro funcionario.
- [x] C1 `POST /ia/chat {convId?, mensaje}` → `{convId, mensaje:{rol:'IA', contenido, fuentes[]}}`; guarda pregunta y respuesta.
- [x] C2 `GET /ia/chat/conversaciones` (solo las del usuario) y `GET /ia/chat/conversaciones/:id` (404 si es ajena o no existe).
- [x] C3 Responde solo con fragmentos de `docs/ia/`; si no hay, dice "no tengo información" y a quién consultar. Cita guía +
  sección como fuentes bajo la respuesta (máx. 3, a ≤0.08 de la mejor; ninguna si el LLM dice "no tengo información").
- [x] C4 Al LLM solo va la pregunta + fragmentos; nunca datos de contribuyentes (DNI/RUC/celular/correo se anonimizan
  antes de embeber y de guardar). La IA no escribe en tablas de negocio.
- [ ] C5 Sin `ayuda.chat`: no se ve el botón y la API responde 403. Sin token: 401 (verificado). **Falta el chequeo en vivo
  con un rol sin el nivel** (guard y `tiene()` son los mismos de los demás módulos).
- [x] C6 Sin key / sin red / cuota agotada → 503 `{message}` claro en el drawer; el resto del sistema sigue funcionando.
  Ante 5xx reintenta una vez y luego usa `GEMINI_MODEL_RESPALDO`.
- [x] C7 Al recargar, el drawer reabre la última conversación con su historial.

## 2. Archivos afectados
- Backend: `src/ia/**` (nuevo: `ia.module`, `chat.controller`, `chat.service`, `rag.service`, `prompt.ts`,
  `llm/llm.provider.ts`, `llm/gemini.provider.ts`, DTOs), `src/app.module.ts`, `src/niveles/niveles.catalogo.ts`,
  `prisma/schema.prisma` + `prisma/migrations/<fecha>_ia_chat_v1/`, `scripts/ingest-docs.ts`, `package.json` (`docs:ingest`),
  `.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`).
- Frontend: `src/components/chat/ChatDrawer.tsx` (nuevo), `src/lib/chatApi.ts` (nuevo), `src/components/layout/AppShell.tsx`.
- Corpus: `docs/ia/*.md` (11 guías redactadas desde specs y código, versionadas en git).

## 3. Diseño (máx 10 líneas)
Flujo: `Drawer -> POST /ia/chat -> JwtAuthGuard+NivelGuard -> embed(pregunta) -> top-k pgvector -> prompt -> Gemini -> chat_mensaje`.
BD (1 migración): `CREATE EXTENSION vector` (0.8.2 disponible en Supabase) + `ia_documento(archivo,titulo,hash)`,
`ia_fragmento(documentoId,titulo,seccion,posicion,contenido,embedding vector(768))`, `chat_conversacion(usuarioId,titulo,
ultimoMensajeEn)`, `chat_mensaje(conversacionId,rol USER|IA,contenido,fragmentosJson,tokens)`. `embedding` es `Unsupported`
en Prisma: lectura/escritura vía `$queryRaw`. Guardar pregunta+respuesta en `$transaction`.
`LlmProvider` (interfaz `embed`/`generar`) → `GeminiProvider` con `fetch` nativo (sin npm nuevas); cambiar a Ollama = otra clase.
Ingesta `npm run docs:ingest`: parte cada `.md` por `##` (~800–1200 car.), re-embebe solo si cambió el hash y borra los
documentos cuyo archivo ya no existe. Nivel: `modulo('ayuda', …, [['chat','Chat IA']])`; no va al sidebar (este sale de
`pages/modulos/catalogo.ts`), solo controla el botón flotante (`useAccesos().tiene('ayuda.chat')`). Sin streaming: axios.

## 4. Tareas
- [x] Rama `chat` desde `main`. `GEMINI_API_KEY`/`GEMINI_MODEL` solo en `backend/.env`.
- [x] Migración `20261107120000_ia_chat_v1` + nivel `ayuda.chat` + `prisma db seed`. Solo `chat_*` se auditan
  (`ia_*` se regeneran con la ingesta). Embeddings `gemini-embedding-001` a 768.
- [x] Módulo `ia` + ingesta + tests (mock BD/LLM: fragmentación, prompt, chat con/sin RAG, errores del proveedor).
- [x] 11 guías `docs/ia/` + `docs:ingest`. Drawer (~380px, tokens, `bi-chat-dots`, sin sombras, errores `text-ladrillo`).
- [x] Prueba con 20 preguntas reales (`npm run docs:evaluar`, `docs/ia-evaluacion/`): 95 % de fuente correcta.
  Umbral de similitud 0.60 (fuera de tema ≈0.52–0.55). Con la key actual `gemini-flash-latest` se cuelga: usar `-lite-`.
- [x] `lint` + `build` + `test` finales (backend 229/229, frontend 56/56). **Paro** antes de commit/PR.

## 5. Verificación
`cd backend && npm run lint && npm run build && npm run test` · `cd frontend && npm run lint && npm run build` ·
`npx prisma migrate status` · login `admin/admin123` (`:5173` + `:3000`): botón visible, pregunta de trámite → respuesta con
fuente y en historial, F5 conserva historial · usuario sin `ayuda.chat` → sin botón y 403 · sin key → error controlado.
