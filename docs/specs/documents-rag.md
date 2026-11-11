# Spec: Documents & RAG

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Documents and RAG](../wiki/Documents-and-RAG.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/documents/`: `Document` and `DocumentChunk` models, the upload/list/delete/chunks API, the Celery task.
- `backend/services/rag/`: text extraction, chunking, Gemini embeddings, similarity ranking, context retrieval for chat.

**Out of scope:**
- How `ChatView` injects the context ([assistant.md](assistant.md) FR-6 step 4).
- The `rag_conversation` prompt text ([llm-layer.md](llm-layer.md)).

## 2. Requirements

**Upload & processing**
- **FR-1** An authenticated user can upload a `.pdf` or `.txt` file (extension checked case-insensitively) with a title (≤ 300). `file_type` is derived from the extension.
- **FR-2** On upload, a `Document` row is created and processing is queued with `process_document_task.delay(id)`. If queueing raises, processing runs synchronously in the request, and processing errors are logged without failing the upload.
- **FR-3** The upload responds 201 with the serialized document as it was when the response was built.
- **FR-4** Processing (`process_document(document_id)`):
  1. Extract text: TXT decoded as UTF-8 (`page_count=1`); PDF via PyPDF2, pages joined by `\n\n` (`page_count = number of pages`).
  2. If the extracted text is blank, set `processed=True` with `processing_error="No text could be extracted from the file."` and stop.
  3. Chunk with `chunk_text(text, chunk_size=2000, overlap=200)`: fixed character windows advancing by 1800, indexed from 0.
  4. Embed each chunk with Gemini (`RETRIEVAL_DOCUMENT`), at most 100 texts per API call.
  5. `bulk_create` the chunks with their embeddings.
  6. Set `processed=True` and `processing_error=None`.
- **FR-5** On any processing exception, set `processed=False` and `processing_error=str(exc)`, then re-raise.

**Retrieval**
- **FR-6** `retrieve_context_for_query(user_id, query)` returns `None` without any API call when the user has no chunks from processed documents with a non-empty embedding.
- **FR-7** Otherwise it embeds the query (`RETRIEVAL_QUERY`). An embedding failure returns `None` (ERROR log).
- **FR-8** It ranks all of the user's chunks by cosine similarity, keeps those ≥ `RAG_MIN_SIMILARITY`, sorts them in descending order and takes the top `RAG_TOP_K`. If none qualify, it returns `None`.
- **FR-9** It returns the excerpts formatted as `[Excerpt {i} from "{document title}"]:\n{content}` joined by `\n\n`, with `i` starting at 1.
- **FR-10** It is only called by `ChatView` for `mode == "conversation"` with no agent. Its failure never fails the chat turn.

**Management**
- **FR-11** Users can list their documents with chunk counts, delete their own documents (cascading to chunks), and list the chunks of their own documents.

## 3. Data model

### `Document` (`documents_document`)
| Field | Type | Notes |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `documents` |
| `title` | CharField(300) | |
| `file` | FileField `documents/` | |
| `file_type` | CharField(10) | `pdf` \| `txt` |
| `page_count` | PositiveIntegerField | default 0 |
| `uploaded_at` | DateTimeField auto_now_add | |
| `processed` | BooleanField | default False |
| `processing_error` | TextField, null | |

Ordering `-uploaded_at`.

### `DocumentChunk` (`documents_chunk`)
| Field | Type | Notes |
|---|---|---|
| `document` | FK `Document`, CASCADE | related_name `chunks` |
| `content` | TextField | ≤ 2000 chars |
| `chunk_index` | PositiveIntegerField | 0-based |
| `page_number` | PositiveIntegerField, null | not populated |
| `embedding` | JSONField list[float] | default `[]`; 768 floats for `text-embedding-004` |

Ordering `chunk_index`. There is no vector index and no record of which embedding model produced each vector.

Documents carry no `language` discriminator. Retrieval is scoped by user only.

## 4. API contract

Base `/api/documents/`. Auth: JWT `IsAuthenticated`.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `upload/` | multipart `file` (`.pdf` / `.txt`), `title` (≤ 300) | 201 `Document`; 400 `{"file": ["Unsupported file type: .<ext>. Supported: .pdf, .txt"]}` |
| GET | `` | | 200 paginated (20) `{count, next, previous, results: [Document]}` |
| DELETE | `<id>/` | | 204; 404 if not owned |
| GET | `<document_id>/chunks/` | | 200 paginated `[{id, content, chunk_index, page_number}]`; empty if not owned |

`Document` = `{id, title, file_type, page_count, uploaded_at, processed, processing_error, chunk_count}`. `chunk_count` is annotated on the list and defaults to 0 elsewhere.

The request body size is capped at 10 MB by the nginx `client_max_body_size`.

## 5. Business rules & invariants

- Retrieval only ever reads chunks whose `document.user_id` is the caller.
- A document counts as searchable when `processed=True` and its chunks have a non-empty `embedding`.
- `processed=True` with a non-null `processing_error` means "processed, but no usable text".
- Defaults: `RAG_TOP_K=5`, `RAG_MIN_SIMILARITY=0.3`. Chunk size and overlap are fixed at 2000/200 in `pipeline.py`.
- Context is injected into the system prompt only for default conversation mode without an agent, and sets `rag_used=true` in the chat response.

## 6. Background jobs

| Task | Name | Trigger | Behaviour |
|---|---|---|---|
| `apps.documents.tasks.process_document_task` | `documents.process_document` | `.delay()` on upload | Calls `services.rag.pipeline.process_document`. No automatic retry. |

In `config/settings/local.py`, `CELERY_TASK_ALWAYS_EAGER=True`, so the task runs inline.

## 7. Dependencies

| Dependency | Use |
|---|---|
| `google-genai` (`genai.Client().models.embed_content`) | embeddings |
| `PyPDF2>=3,<4` | PDF text extraction (deprecated upstream; successor `pypdf`) |
| Celery + Redis broker | async processing |
| Settings | `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL` (default `models/text-embedding-004`), `RAG_TOP_K`, `RAG_MIN_SIMILARITY`, `RAG_CHUNK_SIZE`/`RAG_CHUNK_OVERLAP` (defined but unused) |

## 8. Deviations / open questions

- `RAG_CHUNK_SIZE` and `RAG_CHUNK_OVERLAP` are defined in settings but not read. `chunk_text` does not guard against `overlap >= chunk_size`.
- Chunking ignores word, sentence and page boundaries, and `page_number` is never set.
- Re-running `process_document` on a document appends a second set of chunks (no delete-before-insert).
- Retrieval loads every chunk embedding of the user into Python and computes cosine similarity in pure Python on each eligible chat turn. Open question: move to pgvector with an ANN index.
- Every eligible chat turn makes a query-embedding API call, including trivial messages.
- `RAG_MIN_SIMILARITY=0.3` is permissive for this embedding model. Up to about 10k chars of context may be added to most turns.
- The RAG prompt replaces the composed system prompt, dropping the agentic footer ([assistant.md](assistant.md)).
- Non-UTF-8 text files fail processing. `processing_error` holds raw exception text rather than a user-facing message.
- Deleting a `Document` does not delete the stored file.
- When the Celery broker is unavailable, upload latency includes the broker connection retries before the synchronous fallback runs.
- The upload response reflects the pre-processing state even when processing ran synchronously.
- The document list (`annotate(Count)`) does not apply `Meta.ordering` (Django drops model ordering in GROUP BY queries), so its order is unspecified.
- `services/rag/tests/test_embedder.py` targets the legacy `google.generativeai` API and fails against the current `genai.Client` implementation. It is not run in CI because `pytest.ini` has `testpaths = apps`.
- The embedding model is not recorded per chunk, so changing `GEMINI_EMBEDDING_MODEL` requires re-embedding everything. The default model should be checked against Google's deprecation schedule.
