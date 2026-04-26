import { useState, useEffect, useRef } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "../api/documents";
import { useToast } from "../contexts/ToastContext";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

function DocumentCard({ doc, onDelete, showToast }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      onDelete(doc.id);
      showToast("Document deleted!", "success");
    } catch {
      showToast("Failed to delete document.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-3 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">{doc.title}</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {doc.file_type.toUpperCase()} &middot; {doc.page_count || "?"} page{doc.page_count !== 1 ? "s" : ""}
          </p>
        </div>
        <span className={
          doc.processed
            ? doc.processing_error ? "badge-danger" : "badge-success"
            : "badge-warn"
        }>
          {doc.processed
            ? doc.processing_error ? "Error" : "Indexed"
            : "Processing..."}
        </span>
      </div>

      {doc.processing_error && (
        <p className="text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-700/20 p-2 rounded-lg">
          {doc.processing_error}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-surface-400 dark:text-surface-500">
        <span>{doc.chunk_count || 0} chunks</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-danger-500 hover:text-danger-700 dark:hover:text-danger-400 disabled:opacity-50 text-xs font-medium transition-colors"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default function Documents() {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await getDocuments();
      setDocuments(res.data.results || []);
    } catch {
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (!title.trim()) {
      setError("Please enter a title for the document.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await uploadDocument(file, title.trim());
      setDocuments((prev) => [res.data, ...prev]);
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("Document uploaded!", "success");
    } catch (err) {
      setError(
        err.response?.data?.file?.[0] ||
        err.response?.data?.detail ||
        "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Your library"
        title="Documents"
        subtitle="Upload your French textbooks and notes — the AI assistant will use them for grounded answers."
        icon="📄"
        gradient
      />

      {/* Upload form */}
      <div className="card p-6 mb-8">
        <h2 className="font-bold text-surface-900 dark:text-surface-100 mb-4">Upload a document</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="input flex-1"
          />
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt"
            className="text-sm text-surface-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/30 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary btn-md"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-danger-600 dark:text-danger-400 mt-3">{error}</p>
        )}

        <p className="text-xs text-surface-400 dark:text-surface-500 mt-3">
          Supported formats: PDF, TXT. Max recommended size: 10MB.
        </p>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <span className="text-5xl mb-3 block">📄</span>
          <p className="text-lg font-medium text-surface-600 dark:text-surface-400 mb-1">No documents yet</p>
          <p className="text-sm text-surface-400 dark:text-surface-500">
            Upload a French textbook or notes to get context-aware AI responses.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, i) => (
            <div key={doc.id} className="animate-fade-in-up" style={staggerDelay(i, 50)}>
              <DocumentCard doc={doc} onDelete={handleDelete} showToast={showToast} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
