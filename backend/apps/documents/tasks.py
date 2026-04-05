import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="documents.process_document")
def process_document_task(document_id: int) -> None:
    """Celery task to process an uploaded document through the RAG pipeline.

    Args:
        document_id: Primary key of the Document to process.
    """
    from services.rag.pipeline import process_document

    logger.info("Starting async processing for document %d", document_id)
    process_document(document_id)
    logger.info("Finished processing document %d", document_id)
