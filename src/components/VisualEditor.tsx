import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Move,
  Sliders,
  Eye,
  Crosshair,
  User,
  Edit2,
  Check,
} from 'lucide-react';
import {
  CertificateTemplate,
  FieldConfig,
  DynamicFieldType,
  SupportedFontFamily,
  RecipientRecord,
} from '../types/certificate';

interface VisualEditorProps {
  template: CertificateTemplate;
  fields: FieldConfig[];
  availableColumns: string[];
  onChangeFields: (fields: FieldConfig[]) => void;
  recipients?: RecipientRecord[];
  sampleRecipientData?: Record<string, string>;
  onUpdateRecipientData?: (updatedRecipientData: Record<string, string>) => void;
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
  template,
  fields,
  availableColumns,
  onChangeFields,
  recipients = [],
  sampleRecipientData,
  onUpdateRecipientData,
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    fields[0]?.id || null
  );

  // Inline editing on canvas
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);

  // Recipient Switcher
  const [activeRecipientIndex, setActiveRecipientIndex] = useState<number>(0);

  // Dragging & Resizing state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStartWidth, setResizeStartWidth] = useState<number>(50);
  const [resizeStartX, setResizeStartX] = useState<number>(0);

  // Canvas settings
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [snapToGuides, setSnapToGuides] = useState<boolean>(true);
  const [showFieldBorders, setShowFieldBorders] = useState<boolean>(true);
  const [containerWidthPx, setContainerWidthPx] = useState<number>(1200);

  // Active guide indicators
  const [activeSnapLines, setActiveSnapLines] = useState<{
    verticalCenter: boolean;
    horizontalCenter: boolean;
  }>({ verticalCenter: false, horizontalCenter: false });

  // History stacks
  const [history, setHistory] = useState<FieldConfig[][]>([fields]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Measure container width for 1:1 font scale calculation
  useEffect(() => {
    const updateContainerWidth = () => {
      if (canvasContainerRef.current) {
        setContainerWidthPx(canvasContainerRef.current.clientWidth);
      }
    };
    updateContainerWidth();

    const observer = new ResizeObserver(updateContainerWidth);
    if (canvasContainerRef.current) {
      observer.observe(canvasContainerRef.current);
    }
    return () => observer.disconnect();
  }, [zoomLevel]);

  // Scale factor: screen pixels per template point
  const templateBaseWidth = template.width || 1200;
  const scaleFactor = containerWidthPx / templateBaseWidth;

  // Active recipient
  const activeRecipient =
    recipients.length > 0
      ? recipients[activeRecipientIndex]?.data
      : sampleRecipientData;

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const pushHistory = useCallback(
    (newFields: FieldConfig[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newFields);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      onChangeFields(newFields);
    },
    [history, historyIndex, onChangeFields]
  );

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChangeFields(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChangeFields(next);
    }
  };

  const handleAddField = (type: DynamicFieldType = 'custom') => {
    const typeDefaults: Record<
      DynamicFieldType,
      { label: string; sample: string; size: number; bold: boolean }
    > = {
      full_name: { label: 'Recipient Full Name', sample: 'Rahul Patil', size: 36, bold: true },
      cert_id: { label: 'Certificate ID', sample: 'CERT-2026-001', size: 14, bold: false },
      course_name: { label: 'Course or Event Name', sample: 'Advanced Software Engineering', size: 22, bold: true },
      org_name: { label: 'Organization Name', sample: 'Apex Learning Institute', size: 18, bold: true },
      issue_date: { label: 'Issue Date', sample: '10 Oct 2026', size: 14, bold: false },
      completion_date: { label: 'Completion Date', sample: '10 Oct 2026', size: 14, bold: false },
      designation: { label: 'Designation / Role', sample: 'Software Engineer', size: 16, bold: false },
      email: { label: 'Recipient Email', sample: 'recipient@example.com', size: 14, bold: false },
      custom: { label: 'Custom Text Field', sample: 'Distinction with Honors', size: 18, bold: false },
    };

    const def = typeDefaults[type];
    const newField: FieldConfig = {
      id: `field_${Date.now()}`,
      label: def.label,
      type,
      mappedColumn: availableColumns.find((c) => c.toLowerCase().includes(type.split('_')[0])) || '',
      sampleValue: def.sample,
      xPercent: 25,
      yPercent: 40 + (fields.length % 5) * 6,
      widthPercent: 50,
      fontFamily: 'Helvetica',
      fontSize: def.size,
      fontColor: '#0f172a',
      textAlign: 'center',
      isBold: def.bold,
      isItalic: false,
      textTransform: 'none',
      autoScale: true,
    };

    pushHistory([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleDuplicateField = (fieldToDup: FieldConfig) => {
    const dup: FieldConfig = {
      ...fieldToDup,
      id: `field_${Date.now()}`,
      label: `${fieldToDup.label} (Copy)`,
      xPercent: Math.min(90, fieldToDup.xPercent + 4),
      yPercent: Math.min(90, fieldToDup.yPercent + 4),
    };
    pushHistory([...fields, dup]);
    setSelectedFieldId(dup.id);
  };

  const handleResetPosition = (id: string) => {
    const updated = fields.map((f) =>
      f.id === id ? { ...f, xPercent: 25, yPercent: 45, widthPercent: 50 } : f
    );
    pushHistory(updated);
  };

  const updateSelectedField = (patch: Partial<FieldConfig>, recordHistory = true) => {
    if (!selectedFieldId) return;
    const updated = fields.map((f) => (f.id === selectedFieldId ? { ...f, ...patch } : f));
    if (recordHistory) {
      pushHistory(updated);
    } else {
      onChangeFields(updated);
    }
  };

  const handleDeleteField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    pushHistory(updated);
    if (selectedFieldId === id) {
      setSelectedFieldId(updated[0]?.id || null);
    }
  };

  // Inline value change directly on canvas
  const handleInlineTextChange = (field: FieldConfig, newValue: string) => {
    if (field.mappedColumn && activeRecipient) {
      const updatedData = { ...activeRecipient, [field.mappedColumn]: newValue };
      if (onUpdateRecipientData) {
        onUpdateRecipientData(updatedData);
      }
    } else {
      updateSelectedField({ sampleValue: newValue });
    }
  };

  const getCanvasCoordinates = (
    clientX: number,
    clientY: number
  ): { xPercent: number; yPercent: number } | null => {
    if (!canvasContainerRef.current) return null;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    return { xPercent, yPercent };
  };

  const handleStartDrag = (
    clientX: number,
    clientY: number,
    field: FieldConfig
  ) => {
    if (inlineEditingId === field.id) return;
    setSelectedFieldId(field.id);
    setIsDragging(true);

    const coords = getCanvasCoordinates(clientX, clientY);
    if (coords) {
      setDragOffset({
        x: coords.xPercent - field.xPercent,
        y: coords.yPercent - field.yPercent,
      });
    }
  };

  const handleStartResize = (
    e: React.MouseEvent | React.TouchEvent,
    field: FieldConfig
  ) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setIsResizing(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const coords = getCanvasCoordinates(clientX, 0);
    if (coords) {
      setResizeStartX(coords.xPercent);
      setResizeStartWidth(field.widthPercent);
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!selectedFieldId) return;

    const coords = getCanvasCoordinates(clientX, clientY);
    if (!coords) return;

    if (isDragging) {
      let newX = Math.round((coords.xPercent - dragOffset.x) * 10) / 10;
      let newY = Math.round((coords.yPercent - dragOffset.y) * 10) / 10;

      let snapV = false;
      let snapH = false;

      if (snapToGuides) {
        const fieldWidthHalf = (selectedField?.widthPercent || 50) / 2;
        const fieldCenterX = newX + fieldWidthHalf;

        if (Math.abs(fieldCenterX - 50) < 1.8) {
          newX = 50 - fieldWidthHalf;
          snapV = true;
        }

        if (Math.abs(newY - 50) < 1.8) {
          newY = 50;
          snapH = true;
        }
      }

      setActiveSnapLines({ verticalCenter: snapV, horizontalCenter: snapH });

      newX = Math.max(0, Math.min(newX, 95));
      newY = Math.max(0, Math.min(newY, 95));

      updateSelectedField({ xPercent: newX, yPercent: newY }, false);
    } else if (isResizing) {
      const deltaX = coords.xPercent - resizeStartX;
      let newWidth = Math.round(resizeStartWidth + deltaX);
      newWidth = Math.max(10, Math.min(newWidth, 100 - (selectedField?.xPercent || 0)));

      updateSelectedField({ widthPercent: newWidth }, false);
    }
  };

  const handlePointerUp = () => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setActiveSnapLines({ verticalCenter: false, horizontalCenter: false });
      pushHistory(fields);
    }
  };

  useEffect(() => {
    const handleGlobalUp = () => handlePointerUp();
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, isResizing, fields, pushHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Visual Canvas Area */}
      <div className="lg:col-span-8 space-y-4">
        {/* Top Control Bar */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* History Undo / Redo */}
          <div className="flex items-center space-x-1 border-r border-slate-200 pr-3">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1.5 border-r border-slate-200 pr-3">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(50, prev - 15))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 min-w-[36px] text-center font-mono">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(200, prev + 15))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Snap & Border Toggles */}
          <div className="flex items-center space-x-2 border-r border-slate-200 pr-3">
            <button
              type="button"
              onClick={() => setSnapToGuides(!snapToGuides)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-medium transition ${
                snapToGuides
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFieldBorders(!showFieldBorders)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-medium transition ${
                showFieldBorders
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Borders</span>
            </button>
          </div>

          {/* Recipient Selector for Live Preview inside Editor */}
          {recipients.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold text-slate-700">Preview:</span>
              <select
                value={activeRecipientIndex}
                onChange={(e) => setActiveRecipientIndex(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-indigo-500 max-w-[160px] truncate"
              >
                {recipients.map((rec, i) => {
                  const nameVal =
                    rec.data['Full Name'] ||
                    rec.data['Name'] ||
                    Object.values(rec.data)[0] ||
                    `Recipient ${i + 1}`;
                  return (
                    <option key={rec.id} value={i}>
                      #{i + 1}: {nameVal}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Canvas Container Wrapper */}
        <div className="w-full overflow-auto p-2 bg-slate-950/5 rounded-2xl border border-slate-200 flex justify-center">
          <div
            ref={canvasContainerRef}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onTouchMove={(e) =>
              e.touches[0] && handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
            }
            className="relative rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 shadow-xl select-none transition-transform origin-top"
            style={{
              width: `${zoomLevel}%`,
              aspectRatio: `${template.width || 1200} / ${template.height || 850}`,
            }}
          >
            {/* Background Template */}
            {template.dataUrl ? (
              <img
                src={template.dataUrl}
                alt="Certificate Template Background"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                Template Preview
              </div>
            )}

            {/* Alignment Snap Center Lines */}
            {activeSnapLines.verticalCenter && (
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-indigo-500 z-50 pointer-events-none shadow-sm" />
            )}
            {activeSnapLines.horizontalCenter && (
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-indigo-500 z-50 pointer-events-none shadow-sm" />
            )}

            {/* Dynamic Text Field Overlays */}
            {fields.map((field) => {
              const isSelected = field.id === selectedFieldId;
              const isInlineEditing = inlineEditingId === field.id;

              let textVal = '';
              if (activeRecipient && field.mappedColumn && activeRecipient[field.mappedColumn] !== undefined) {
                textVal = activeRecipient[field.mappedColumn];
              } else {
                textVal = field.sampleValue || field.label;
              }

              if (field.textTransform === 'uppercase') textVal = textVal.toUpperCase();
              if (field.textTransform === 'capitalize') {
                textVal = textVal.replace(/\b\w/g, (c) => c.toUpperCase());
              }

              const cssFontFamily =
                field.fontFamily === 'TimesRoman'
                  ? "'Times New Roman', Times, serif"
                  : field.fontFamily === 'Courier'
                  ? "'Courier New', Courier, monospace"
                  : "system-ui, -apple-system, 'Helvetica Neue', sans-serif";

              // 1:1 Exact Scaled Font Size in CSS pixels
              const computedCssFontSize = Math.max(10, field.fontSize * scaleFactor * (zoomLevel / 100));

              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY, field)}
                  onTouchStart={(e) =>
                    e.touches[0] &&
                    handleStartDrag(e.touches[0].clientX, e.touches[0].clientY, field)
                  }
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setInlineEditingId(field.id);
                  }}
                  style={{
                    left: `${field.xPercent}%`,
                    top: `${field.yPercent}%`,
                    width: `${field.widthPercent}%`,
                    color: field.fontColor,
                    fontFamily: cssFontFamily,
                    fontSize: `${computedCssFontSize}px`,
                    fontWeight: field.isBold ? 700 : 400,
                    fontStyle: field.isItalic ? 'italic' : 'normal',
                    textAlign: field.textAlign,
                  }}
                  className={`absolute transform -translate-y-1/2 cursor-move touch-none transition-shadow ${
                    showFieldBorders || isSelected
                      ? isSelected
                        ? 'ring-2 ring-indigo-500 bg-indigo-500/10 rounded-md shadow-md z-30'
                        : 'border border-dashed border-amber-400/80 bg-amber-400/5 hover:bg-amber-400/10 rounded-md z-20'
                      : 'z-10'
                  }`}
                >
                  {/* Selected Badge Header */}
                  {isSelected && (
                    <div className="absolute -top-6 left-0 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-sans font-medium shadow-xs whitespace-nowrap z-40 pointer-events-none">
                      <Move className="w-2.5 h-2.5" />
                      <span>{field.label}</span>
                      <span className="opacity-75">
                        ({field.xPercent}%, {field.yPercent}%)
                      </span>
                      <span className="opacity-75">• Double-click to edit text</span>
                    </div>
                  )}

                  {/* Inline Editable Text Input or Display */}
                  {isInlineEditing ? (
                    <div className="flex items-center space-x-1 bg-white p-1 rounded-md ring-2 ring-indigo-600 z-50 shadow-lg">
                      <input
                        type="text"
                        autoFocus
                        value={textVal}
                        onChange={(e) => handleInlineTextChange(field, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingId(null);
                        }}
                        onBlur={() => setInlineEditingId(null)}
                        className="w-full bg-transparent focus:outline-hidden text-slate-900 font-bold px-1"
                      />
                      <button
                        type="button"
                        onClick={() => setInlineEditingId(null)}
                        className="p-1 rounded bg-indigo-600 text-white"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="px-1.5 py-0.5 truncate leading-tight pointer-events-none">
                      {textVal || <span className="opacity-40 italic">Double-click to type text...</span>}
                    </div>
                  )}

                  {/* Resizing Handle on Selected Box Right Edge */}
                  {isSelected && !isInlineEditing && (
                    <div
                      onMouseDown={(e) => handleStartResize(e, field)}
                      onTouchStart={(e) => handleStartResize(e, field)}
                      className="absolute right-0 top-0 bottom-0 w-3 bg-indigo-600 hover:bg-indigo-700 cursor-ew-resize rounded-r-md flex items-center justify-center text-white shadow-md z-50"
                      title="Drag to resize text box width"
                    >
                      <div className="w-0.5 h-3 bg-white/80 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Field Inspector Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        {/* Add Dynamic Field Presets */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Type className="w-4 h-4 text-indigo-600" />
              <span>Add Dynamic Field</span>
            </h5>
            <span className="text-[11px] text-slate-500">{fields.length} active</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleAddField('full_name')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Full Name</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('cert_id')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Certificate ID</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('course_name')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Course / Event</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('issue_date')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Issue Date</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('org_name')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Organization</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('email')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Recipient Email</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddField('custom')}
              className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-left font-medium flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Custom Field</span>
            </button>
          </div>
        </div>

        {/* Selected Field Property Inspector */}
        {selectedField ? (
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Field Inspector
                </h5>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setInlineEditingId(selectedField.id)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  title="Edit text inline"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDuplicateField(selectedField)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  title="Duplicate field"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResetPosition(selectedField.id)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  title="Reset position"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteField(selectedField.id)}
                  className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition"
                  title="Delete field"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Field Label</label>
                <input
                  type="text"
                  value={selectedField.label}
                  onChange={(e) => updateSelectedField({ label: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Map to Spreadsheet Column
                </label>
                <select
                  value={selectedField.mappedColumn}
                  onChange={(e) => updateSelectedField({ mappedColumn: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                >
                  <option value="">-- Select spreadsheet column --</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Text Value / Sample</label>
                <input
                  type="text"
                  value={selectedField.sampleValue}
                  onChange={(e) => updateSelectedField({ sampleValue: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Normalized Coordinates */}
              <div className="pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700 block mb-2">Normalized Position</span>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block">X Position: {selectedField.xPercent}%</label>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={selectedField.xPercent}
                      onChange={(e) => updateSelectedField({ xPercent: Number(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Y Position: {selectedField.yPercent}%</label>
                    <input
                      type="range"
                      min="0"
                      max="95"
                      value={selectedField.yPercent}
                      onChange={(e) => updateSelectedField({ yPercent: Number(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block">
                    Container Width: {selectedField.widthPercent}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={selectedField.widthPercent}
                    onChange={(e) => updateSelectedField({ widthPercent: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Typography */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="font-semibold text-slate-700 block">Typography & Styling</span>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Font Family</label>
                  <select
                    value={selectedField.fontFamily}
                    onChange={(e) =>
                      updateSelectedField({
                        fontFamily: e.target.value as SupportedFontFamily,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                  >
                    <option value="Helvetica">Helvetica (Clean Sans-Serif)</option>
                    <option value="TimesRoman">Times New Roman (Classic Serif)</option>
                    <option value="Courier">Courier (Monospace Code)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">
                      Font Size: {selectedField.fontSize}pt
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="72"
                      value={selectedField.fontSize}
                      onChange={(e) => updateSelectedField({ fontSize: Number(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Font Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={selectedField.fontColor}
                        onChange={(e) => updateSelectedField({ fontColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={selectedField.fontColor}
                        onChange={(e) => updateSelectedField({ fontColor: e.target.value })}
                        className="w-20 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Alignment & Styles */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ textAlign: 'left' })}
                      className={`p-1.5 rounded ${
                        selectedField.textAlign === 'left' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ textAlign: 'center' })}
                      className={`p-1.5 rounded ${
                        selectedField.textAlign === 'center' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ textAlign: 'right' })}
                      className={`p-1.5 rounded ${
                        selectedField.textAlign === 'right' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ isBold: !selectedField.isBold })}
                      className={`p-1.5 rounded-lg border ${
                        selectedField.isBold
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                      className={`p-1.5 rounded-lg border ${
                        selectedField.isItalic
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoScale"
                      checked={selectedField.autoScale}
                      onChange={(e) => updateSelectedField({ autoScale: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="autoScale" className="text-slate-700 cursor-pointer">
                      Auto-shrink font to fit
                    </label>
                  </div>

                  <select
                    value={selectedField.textTransform}
                    onChange={(e) =>
                      updateSelectedField({
                        textTransform: e.target.value as 'none' | 'uppercase' | 'capitalize',
                      })
                    }
                    className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px]"
                  >
                    <option value="none">Normal</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            <Move className="w-6 h-6 mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700">No field selected</p>
            <p className="mt-1 text-slate-500">Click any field on the certificate to inspect or double-click to edit text inline.</p>
          </div>
        )}
      </div>
    </div>
  );
};
