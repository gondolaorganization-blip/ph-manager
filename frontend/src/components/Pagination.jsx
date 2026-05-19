/**
 * Props:
 *   page    — current page (1-based)
 *   pages   — total pages
 *   total   — total records
 *   limit   — records per page
 *   onChange(newPage) — callback
 */
export default function Pagination({ page, pages, total, limit, onChange }) {
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Show up to 5 page numbers around current
  const nums = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
    nums.push(i);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', marginTop: 8, flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
        {from}–{to} de {total} registros
      </span>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === 1}
          onClick={() => onChange(1)}
          style={{ minWidth: 32 }}
        >«</button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          style={{ minWidth: 32 }}
        >‹</button>

        {nums[0] > 1 && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ minWidth: 32 }} onClick={() => onChange(1)}>1</button>
            {nums[0] > 2 && <span style={{ color: 'var(--slate-400)', padding: '0 2px' }}>…</span>}
          </>
        )}

        {nums.map(n => (
          <button
            key={n}
            className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minWidth: 32 }}
            onClick={() => onChange(n)}
          >{n}</button>
        ))}

        {nums[nums.length - 1] < pages && (
          <>
            {nums[nums.length - 1] < pages - 1 && <span style={{ color: 'var(--slate-400)', padding: '0 2px' }}>…</span>}
            <button className="btn btn-ghost btn-sm" style={{ minWidth: 32 }} onClick={() => onChange(pages)}>{pages}</button>
          </>
        )}

        <button
          className="btn btn-ghost btn-sm"
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
          style={{ minWidth: 32 }}
        >›</button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === pages}
          onClick={() => onChange(pages)}
          style={{ minWidth: 32 }}
        >»</button>
      </div>
    </div>
  );
}
