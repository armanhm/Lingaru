import { useState, useEffect, useRef } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "../api/documents";
import { useToast } from "../contexts/ToastContext";

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
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{doc.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {doc.file_type.toUpperCase()} &middot; {doc.page_count || "?"} page{doc.page_count !== 1 ? "s" : ""}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            doc.processed
              ? doc.processing_error
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {doc.processed
            ? doc.processing_error
              ? "Error"
              : "Indexed"
            : "Processing..."}
        </span>
      </div>

      {doc.processing_error && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {doc.processing_error}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{doc.chunk_count || 0} chunks</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-700 disabled:opacity-50"
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 mt-1">
          Upload your French textbooks and notes. The AI assistant will use them
          to give you more relevant answers.
        </p>
      </div>

      {/* Upload form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">Upload a document</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-0 focus:outline-none"
          />
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt"
            className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Supported formats: PDF, TXT. Max recommended size: 10MB.
        </p>
      </div>

      {/* Document list */}
      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium mb-1">No documents yet</p>
          <p className="text-sm">
            Upload a French textbook or notes to get context-aware AI responses.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} showToast={showToast} />
          ))}
        </div>
      )}
    </div>
  );
}
