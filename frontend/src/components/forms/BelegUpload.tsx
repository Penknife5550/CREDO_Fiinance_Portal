import { useRef, useState } from 'react';
import { Upload, X, FileText, Image } from 'lucide-react';

interface Props {
  dateien: File[];
  onChange: (dateien: File[]) => void;
  maxSize?: number; // MB
  label?: string;
}

const ERLAUBTE_TYPEN = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

export function BelegUpload({ dateien, onChange, maxSize = 10, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setFehler(null);

    const neueDateien: File[] = [];
    for (const file of Array.from(files)) {
      if (!ERLAUBTE_TYPEN.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
        setFehler(`"${file.name}" hat ein ungültiges Format. Erlaubt: PDF, JPG, PNG, HEIC`);
        continue;
      }
      if (file.size > maxSize * 1024 * 1024) {
        setFehler(`"${file.name}" ist zu groß (max. ${maxSize} MB)`);
        continue;
      }
      neueDateien.push(file);
    }

    onChange([...dateien, ...neueDateien]);
  };

  const entfernen = (index: number) => {
    onChange(dateien.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {label && <label className="label">{label}</label>}

      {/* Drop-Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-credo-500 bg-credo-50'
            : 'border-credo-300 hover:border-credo-400'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-8 h-8 text-credo-400 mx-auto mb-2" />
        <p className="text-sm text-credo-600">
          Belege hier ablegen oder <span className="text-credo-800 font-medium underline">klicken zum Hochladen</span>
        </p>
        <p className="text-xs text-credo-500 mt-1">PDF, JPG, PNG, HEIC — Max. {maxSize} MB pro Beleg</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Fehler */}
      {fehler && (
        <p className="text-xs text-red-500">{fehler}</p>
      )}

      {/* Dateiliste */}
      {dateien.length > 0 && (
        <div className="space-y-2">
          {dateien.map((datei, index) => (
            <div
              key={`${datei.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-credo-50 rounded-lg"
            >
              {datei.type === 'application/pdf' ? (
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
              ) : (
                <Image className="w-5 h-5 text-blue-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-credo-800 truncate">{datei.name}</p>
                <p className="text-xs text-credo-500">{formatSize(datei.size)}</p>
              </div>
              <button
                onClick={() => entfernen(index)}
                className="p-1 text-credo-400 hover:text-red-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
