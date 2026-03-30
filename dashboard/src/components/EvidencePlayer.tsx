interface EvidenceFile {
  type: string;
  url: string;
  filename: string;
  createdAt: number;
}

interface EvidencePlayerProps {
  evidence: EvidenceFile[];
}

export function EvidencePlayer({ evidence }: EvidencePlayerProps) {
  if (evidence.length === 0) {
    return <p className="text-gray-400 text-sm">No evidence files.</p>;
  }

  return (
    <div className="space-y-4">
      {evidence.map((item) => (
        <div key={item.filename} className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">{item.filename}</span>
            <span className="text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>
          {item.type === 'audio' && (
            <audio controls className="w-full" preload="metadata">
              <source src={item.url} />
            </audio>
          )}
          {item.type === 'video' && (
            <video controls className="w-full rounded" preload="metadata">
              <source src={item.url} />
            </video>
          )}
          {item.type === 'photo' && (
            <img
              src={item.url}
              alt={item.filename}
              className="w-full max-h-96 object-contain rounded cursor-pointer"
              onClick={() => window.open(item.url, '_blank')}
            />
          )}
        </div>
      ))}
    </div>
  );
}
