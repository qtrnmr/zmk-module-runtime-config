import { useEffect } from "react";

export default function Toast({ message, onDone }: { message: string | null; onDone(): void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-zinc-700 bg-zinc-800/95 px-4 py-2 text-sm text-zinc-100 shadow-lg">
      {message}
    </div>
  );
}
