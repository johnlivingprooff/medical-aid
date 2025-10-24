import { AlertCircle } from 'lucide-react';

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <AlertCircle size={32} className="mb-2" />
      <span>{message}</span>
    </div>
  );
}
