import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, CheckSquare, Square, X } from "lucide-react";

/**
 * NeighbourhoodChecklist
 *
 * Props:
 *   allNames   – string[]   : all available neighbourhood names
 *   selected   – string[]   : currently selected names (empty = "All")
 *   onChange   – fn(string[]) : called with new selection
 *   label      – string     : optional label shown before the button (default "Filter:")
 *   className  – string     : optional extra classes on the wrapper div
 */
const NeighbourhoodChecklist = ({
  allNames = [],
  selected = [],
  onChange,
  label = "Filter:",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const allSelected = selected.length === 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (name) => {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const selectAll = () => onChange([]);

  const buttonLabel = allSelected
    ? "All Neighbourhoods"
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div className={`flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 ${className}`}>
      {label && (
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{label}</span>
      )}

      <div className="relative" ref={ref}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white hover:border-primary/50 transition min-w-[170px] max-w-[260px] justify-between"
        >
          <span className="truncate text-gray-700">{buttonLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute left-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl w-60 max-h-64 overflow-y-auto">
            {/* Header row */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-primary hover:underline font-medium"
              >
                Select All
              </button>
              {!allSelected && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* "All Neighbourhoods" option */}
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition ${
                allSelected ? "bg-primary/5" : ""
              }`}
              onClick={selectAll}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-gray-700">All Neighbourhoods</span>
            </div>

            <div className="border-t border-gray-100" />

            {/* Individual options */}
            {allNames.map((name) => {
              const checked = selected.includes(name);
              return (
                <div
                  key={name}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition ${
                    checked ? "bg-primary/5" : ""
                  }`}
                  onClick={() => toggle(name)}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 truncate">{name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NeighbourhoodChecklist;