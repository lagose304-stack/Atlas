type AnnotationTool = 'pointer' | 'batch' | 'border' | 'batch-border';

/** Representa la marca que crea cada herramienta sobre la placa. */
export default function AnnotationToolIcon({ tool }: { tool: AnnotationTool }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {tool === 'pointer' && <>
      <path d="M4 4 15 15M3 6l3-3" />
      <circle cx="17" cy="17" r="2.7" fill="currentColor" fillOpacity=".14" />
    </>}
    {tool === 'batch' && <>
      <path d="m3 4 5 5m5-5 5 5M4 14l5 5" />
      <circle cx="9" cy="10" r="1.8" fill="currentColor" fillOpacity=".14" />
      <circle cx="19" cy="10" r="1.8" fill="currentColor" fillOpacity=".14" />
      <circle cx="10" cy="20" r="1.8" fill="currentColor" fillOpacity=".14" />
    </>}
    {tool === 'border' && <path d="M5 5C8 2 12 4 15 3c4 0 6 4 5 8-1 3 2 6-2 9-3 2-6-1-9 0-4 1-7-2-6-6 1-3-1-6 2-9Z" strokeDasharray="2.8 2.6" fill="currentColor" fillOpacity=".07" />}
    {tool === 'batch-border' && <>
      <path d="M3 4c3-3 8-1 8 3 0 3-2 5-5 5-4 0-6-5-3-8Z" strokeDasharray="2.1 2.1" fill="currentColor" fillOpacity=".07" />
      <path d="M14 13c3-2 7 0 7 3 1 4-3 6-6 5-4-1-4-6-1-8Z" strokeDasharray="2.1 2.1" fill="currentColor" fillOpacity=".07" />
    </>}
  </svg>;
}
