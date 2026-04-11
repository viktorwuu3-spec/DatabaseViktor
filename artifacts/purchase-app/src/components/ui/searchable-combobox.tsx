import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus } from "lucide-react";

interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  allowCustom?: boolean;
  onSelectOption?: (option: ComboboxOption) => void;
  onAddNew?: (value: string) => void;
  addNewLabel?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = "Pilih atau ketik...",
  allowCustom = true,
  onSelectOption,
  onAddNew,
  addNewLabel = "Tambah baru",
  disabled = false,
  className,
  "data-testid": testId,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const showAddNew =
    search.trim() !== "" &&
    !options.some((o) => o.label.toLowerCase() === search.toLowerCase()) &&
    onAddNew;

  const totalItems = filtered.length + (showAddNew ? 1 : 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch(value);
      setHighlightIndex(-1);
    }
  }, [isOpen]);

  const selectOption = useCallback(
    (option: ComboboxOption) => {
      onChange(option.value);
      onSelectOption?.(option);
      setIsOpen(false);
      setSearch("");
    },
    [onChange, onSelectOption]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % totalItems);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectOption(filtered[highlightIndex]);
        } else if (showAddNew && highlightIndex === filtered.length) {
          onAddNew?.(search.trim());
          setIsOpen(false);
        } else if (allowCustom && search.trim()) {
          onChange(search.trim());
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        if (allowCustom && search.trim()) {
          onChange(search.trim());
        }
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-combobox-item]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const displayValue = isOpen ? search : value;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            if (allowCustom) onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-14 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {filtered.length === 0 && !showAddNew && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {allowCustom ? "Tidak ada pilihan, ketik untuk nilai baru" : "Tidak ada pilihan"}
            </div>
          )}
          {filtered.map((option, idx) => (
            <div
              key={option.value}
              data-combobox-item
              onClick={() => selectOption(option)}
              className={cn(
                "px-3 py-1.5 cursor-pointer text-sm hover:bg-accent",
                highlightIndex === idx && "bg-accent",
                option.value === value && !isOpen && "font-medium"
              )}
            >
              <div>{option.label}</div>
              {option.sublabel && (
                <div className="text-xs text-muted-foreground">{option.sublabel}</div>
              )}
            </div>
          ))}
          {showAddNew && (
            <div
              data-combobox-item
              onClick={() => {
                onAddNew?.(search.trim());
                setIsOpen(false);
              }}
              className={cn(
                "px-3 py-1.5 cursor-pointer text-sm hover:bg-accent flex items-center gap-1.5 text-primary border-t",
                highlightIndex === filtered.length && "bg-accent"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              {addNewLabel}: &quot;{search.trim()}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
