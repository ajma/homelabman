import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { ConfigFileEditor } from "./ConfigFileEditor";

interface ConfigFile {
  filename: string;
  content: string;
}

interface ConfigFilesSectionProps {
  files: ConfigFile[];
  onChange: (files: ConfigFile[]) => void;
}

const RESERVED_NAMES = new Set([
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
]);

export function ConfigFilesSection({
  files,
  onChange,
}: ConfigFilesSectionProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const toggleExpand = (filename: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleAdd = () => {
    const trimmed = newFilename.trim();
    if (!trimmed) {
      setAddError("Filename is required");
      return;
    }
    if (trimmed.includes("/") || trimmed.includes("..")) {
      setAddError("Filename must not contain / or ..");
      return;
    }
    if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
      setAddError("Reserved filename");
      return;
    }
    if (files.some((f) => f.filename === trimmed)) {
      setAddError("File already exists");
      return;
    }
    onChange([...files, { filename: trimmed, content: "" }]);
    setExpandedFiles((prev) => new Set([...prev, trimmed]));
    setNewFilename("");
    setAddError(null);
    setIsAdding(false);
  };

  const handleDelete = (filename: string) => {
    onChange(files.filter((f) => f.filename !== filename));
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      next.delete(filename);
      return next;
    });
  };

  const handleContentChange = (filename: string, content: string) => {
    onChange(
      files.map((f) => (f.filename === filename ? { ...f, content } : f)),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-rubik text-xs font-medium text-muted-foreground">
          Config Files
        </label>
        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            setNewFilename("");
            setAddError(null);
          }}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Add File
        </button>
      </div>

      {isAdding && (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={newFilename}
              onChange={(e) => {
                setNewFilename(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
                if (e.key === "Escape") setIsAdding(false);
              }}
              placeholder="filename.conf"
              autoFocus
              className="flex h-8 w-full rounded-lg border border-white/[0.26] bg-muted px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/[0.5]"
            />
            {addError && (
              <p className="mt-1 text-xs text-[rgba(254,202,202,0.85)]">
                {addError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}

      {files.length === 0 && !isAdding && (
        <p className="text-2xs text-muted-foreground/70">
          No config files yet. Add files that your compose services bind-mount.
        </p>
      )}

      {files.map((file) => {
        const isExpanded = expandedFiles.has(file.filename);
        return (
          <div
            key={file.filename}
            className="rounded-xl border border-white/[0.20] overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleExpand(file.filename)}
                className="flex items-center gap-1.5 text-sm text-foreground transition-colors hover:text-primary"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-mono text-xs">{file.filename}</span>
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => handleDelete(file.filename)}
                className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-[rgba(127,29,29,0.15)] hover:text-[rgba(254,202,202,0.75)]"
                aria-label={`Delete ${file.filename}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {isExpanded && (
              <div className="border-t border-white/[0.20] p-2">
                <ConfigFileEditor
                  value={file.content}
                  onChange={(content) =>
                    handleContentChange(file.filename, content)
                  }
                  minHeight="150px"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
