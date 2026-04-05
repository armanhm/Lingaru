import logging

from django.conf import settings

from apps.documents.models import Document, DocumentChunk
from services.rag.extractor import extract_text
from services.rag.chunker import chunk_text
from services.rag.embedder import GeminiEmbedder

logger = logging.getLogger(__name__)


def process_document(document_id: int) -> None:
    """Process a document: extract text, chunk, embed, store.

    This is the main RAG pipeline orchestrator. Called by Celery task
    or synchronously in dev/test.

    Args:
        document_id: Primary key of the Document to process.

    Raises:
        Document.DoesNotExist: If document not found.
    """
    document = Document.objects.get(pk=document_id)

    try:
        logger.info("Processing document %d: %s", document.id, document.title)

        # 1. Extract text
        document.file.open("rb")
        text, page_count = extract_text(
            document.file, file_type=document.file_type, return_page_count=True,
        )
        document.file.close()
        document.page_count = page_count

        if not text.strip():
            document.processing_error = "No text could be extracted from the file."
            document.processed = True
            document.save()
            return

        # 2. Chunk text
        chunks = chunk_text(text, chunk_size=2000, overlap=200)

        if not chunks:
            document.processing_error = "Text extraction produced no usable chunks."
            document.processed = True
            document.save()
            return

        # 3. Generate embeddings
        embedder = GeminiEmbedder(
            api_key=settings.GEMINI_API_KEY,
            model=getattr(
                settings, "GEMINI_EMBEDDING_MODEL", "models/text-embedding-004",
            ),
        )

        # Batch embed all chunks (Gemini supports batch embedding)
        chunk_texts = [c.content for c in chunks]

        # Process in batches of 100 to avoid API limits
        batch_size = 100
        all_embeddings = []
        for i in range(0, len(chunk_texts), batch_size):
            batch = chunk_texts[i : i + batch_size]
            batch_embeddings = embedder.embed_batch(batch)
            all_embeddings.extend(batch_embeddings)

        # 4. Store chunks with embeddings
        chunk_objects = []
        for chunk, embedding in zip(chunks, all_embeddings):
            chunk_objects.append(
                DocumentChunk(
                    document=document,
                    content=chunk.content,
                    chunk_index=chunk.index,
                    embedding=embedding,
                )
            )

        DocumentChunk.objects.bulk_create(chunk_objects)

        document.processed = True
        document.processing_error = None
        document.save()

        logger.info(
            "Document %d processed: %d chunks created",
            document.id, len(chunk_objects),
        )

    except Exception as exc:
        logger.error("Failed to process document %d: %s", document.id, exc)
        document.processing_error = str(exc)
        document.processed = False
        document.save()
        raise
