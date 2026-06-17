// Standalone layout for printable views (receipts, etc).
// Skips the dashboard sidebar/topbar so the page opens in a new tab as a
// clean white sheet ready to print.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-slate-900">{children}</div>;
}
