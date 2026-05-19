import { useRef, useState } from 'react';
import api from '../api/client';

/**
 * Props:
 *   value      — current URL string (from DB)
 *   onChange   — (url | null) => void
 *   accept     — input accept attribute  (default: images + pdf)
 *   label      — button label (default: "Adjuntar archivo")
 */
export default function FileUpload({
  value,
  onChange,
  accept = 'image/*,.pdf',
  label = 'Adjuntar archivo',
}) {
  const inputRef  = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    try {
      await api.delete('/upload', { data: { url: value } });
    } catch (_) { /* file may already be gone */ }
    onChange(null);
  }

  function nombreArchivo(url) {
    if (!url) return '';
    const raw = url.split('/').pop();            // "1716723200000-factura.pdf"
    const idx = raw.indexOf('-');
    return idx !== -1 ? raw.slice(idx + 1) : raw; // strip timestamp prefix
  }

  const isPdf = value?.toLowerCase().endsWith('.pdf');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {value ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          background: 'var(--slate-50)',
          border: '1px solid var(--slate-200)',
          borderRadius: 6,
        }}>
          <span style={{ fontSize: 18 }}>{isPdf ? '📄' : '🖼️'}</span>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, fontSize: '0.875rem', color: 'var(--blue-700)', wordBreak: 'break-all' }}
          >
            {nombreArchivo(value)}
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--red-600)', padding: '2px 6px' }}
            onClick={handleRemove}
            title="Eliminar archivo"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Subiendo…' : `📎 ${label}`}
        </button>
      )}
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--red-600)' }}>{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}
