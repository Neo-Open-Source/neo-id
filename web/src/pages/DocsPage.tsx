export default function DocsPage() {
  return (
    <div style={{ height: '100vh', background: 'var(--neo-bg-canvas)' }}>
      <iframe
        src="/scalar.html"
        title="Neo ID API Docs"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  )
}
