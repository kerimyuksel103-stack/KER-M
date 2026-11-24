import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BRANCHES,
  Branch,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  Transaction,
  TransactionType,
  VEHICLE_PLATES,
} from '../types/finance';
import { normalizePlate, parseVehicleCategory } from '../utils/finance';

interface TransactionFormProps {
  mode: 'inline' | 'modal';
  initialData?: Transaction | null;
  defaultMonthKey?: string;
  defaultBranch?: 'all' | Branch;
  defaultType?: TransactionType;
  defaultCategory?: string;
  defaultVehiclePlate?: string;
  knownPlates?: string[];
  customCategories: { income: string[]; expense: string[] };
  onSubmit: (data: Omit<Transaction, 'id'>, editId?: string) => void;
  onCancel?: () => void;
}

interface ParsedDocumentResponse {
  type?: TransactionType;
  branch?: Branch;
  date?: string;
  category?: string;
  description?: string;
  amount?: number | null;
  vehiclePlate?: string;
  customerName?: string;
  customerPhone?: string;
  warrantyPeriod?: string;
  summaryNote?: string;
  error?: string;
}

interface PreparedImagePayload {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

const MAX_IMAGE_DIM = 1600;

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Görsel okunamadı.'));
        return;
      }
      resolve({
        base64: result.slice(commaIdx + 1),
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = () => reject(new Error('Görsel dosyası okunurken hata oluştu.'));
    reader.readAsDataURL(file);
  });
}

async function prepareImageForUpload(file: File): Promise<PreparedImagePayload> {
  const previewUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error('Görsel çözümlenemedi.'));
      imageEl.src = previewUrl;
    });

    const maxSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const scale = maxSide > MAX_IMAGE_DIM ? MAX_IMAGE_DIM / maxSide : 1;
    const targetWidth = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const targetHeight = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = await readFileAsBase64(file);
      return { ...fallback, previewUrl };
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      const fallback = await readFileAsBase64(file);
      return { ...fallback, previewUrl };
    }

    return {
      base64: dataUrl.slice(commaIdx + 1),
      mimeType: 'image/jpeg',
      previewUrl,
    };
  } catch {
    const fallback = await readFileAsBase64(file);
    return { ...fallback, previewUrl };
  }
}

function getDefaultDate(defaultMonthKey?: string): string {
  const today = '2026-11-24';
  if (!defaultMonthKey || defaultMonthKey === 'all') {
    return today;
  }
  if (today.startsWith(defaultMonthKey)) {
    return today;
  }
  return `${defaultMonthKey}-15`;
}

function formatIntegerWithDots(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNumberForInput(amount: number): string {
  const [intPart, decPart] = String(amount).split('.');
  const formattedInt = formatIntegerWithDots(intPart || '0');
  return decPart ? `${formattedInt},${decPart.slice(0, 2)}` : formattedInt;
}

function formatTurkishAmountInput(rawNext: string, prevFormatted: string): string {
  let working = rawNext;

  // Allow numpad '.' as decimal comma when typed at the end without an existing comma
  if (
    working.length === prevFormatted.length + 1 &&
    working.endsWith('.') &&
    !prevFormatted.includes(',')
  ) {
    working = working.slice(0, -1) + ',';
  } else if (!working.includes(',') && /\.\d{1,2}$/.test(working)) {
    // Handle pasted values like "2000000.50" or "12.5"
    const lastDot = working.lastIndexOf('.');
    const beforeLastDot = working.slice(0, lastDot);
    const afterLastDot = working.slice(lastDot + 1);
    if (!beforeLastDot.includes('.') || afterLastDot.length <= 2) {
      working = `${beforeLastDot.replace(/\./g, '')},${afterLastDot}`;
    }
  }

  // Keep only digits and commas (dots are recalculated thousands separators)
  const cleaned = working.replace(/[^\d,]/g, '');
  if (!cleaned) return '';

  const commaIndex = cleaned.indexOf(',');
  const hasComma = commaIndex !== -1;
  const rawInt = (hasComma ? cleaned.slice(0, commaIndex) : cleaned).replace(/\D/g, '');
  const rawDec = hasComma ? cleaned.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 2) : '';

  const normalizedInt = rawInt.replace(/^0+(?=\d)/, '');
  const intDisplay = normalizedInt
    ? formatIntegerWithDots(normalizedInt)
    : hasComma
    ? '0'
    : '';

  if (hasComma) {
    return `${intDisplay},${rawDec}`;
  }
  return intDisplay;
}

function parseTurkishAmount(formatted: string): number {
  if (!formatted.trim()) return NaN;
  const normalized = formatted.replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  mode,
  initialData,
  defaultMonthKey,
  defaultBranch,
  defaultType,
  defaultCategory,
  defaultVehiclePlate,
  knownPlates,
  customCategories,
  onSubmit,
  onCancel,
}) => {
  const warrantyListId = useId();
  const plateListId = useId();
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const lastImagePayloadRef = useRef<{ base64: string; mimeType: string } | null>(null);

  const resolvedDefaultBranch: Branch =
    defaultBranch && defaultBranch !== 'all' ? defaultBranch : 'Gebze';
  const resolvedInitialType: TransactionType =
    initialData?.type ?? defaultType ?? 'income';

  const legacyPlateInfo = initialData ? parseVehicleCategory(initialData.category) : null;

  const [type, setType] = useState<TransactionType>(resolvedInitialType);
  const [branch, setBranch] = useState<Branch>(
    initialData?.branch ?? resolvedDefaultBranch
  );
  const [date, setDate] = useState<string>(
    initialData?.date ?? getDefaultDate(defaultMonthKey)
  );
  const [category, setCategory] = useState<string>(
    initialData?.category ??
      defaultCategory ??
      (resolvedInitialType === 'income'
        ? DEFAULT_INCOME_CATEGORIES[0]
        : DEFAULT_EXPENSE_CATEGORIES[0])
  );
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [description, setDescription] = useState<string>(initialData?.description ?? '');
  const [amountStr, setAmountStr] = useState<string>(
    initialData ? formatNumberForInput(initialData.amount) : ''
  );
  const [vehiclePlate, setVehiclePlate] = useState<string>(
    initialData?.vehiclePlate ?? legacyPlateInfo?.plate ?? defaultVehiclePlate ?? ''
  );
  const [customerName, setCustomerName] = useState<string>(
    initialData?.customerName ?? ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialData?.customerPhone ?? ''
  );
  const [warrantyPeriod, setWarrantyPeriod] = useState<string>(
    initialData?.warrantyPeriod ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Document photo upload & parsing state
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState<boolean>(false);
  const [isParsingDoc, setIsParsingDoc] = useState<boolean>(false);
  const [docParsedReady, setDocParsedReady] = useState<boolean>(false);
  const [docSummaryNote, setDocSummaryNote] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const allIncomeCategories = Array.from(
    new Set([...DEFAULT_INCOME_CATEGORIES, ...customCategories.income])
  );
  const allExpenseCategories = Array.from(
    new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.expense])
  );

  const availableCategories =
    type === 'income' ? allIncomeCategories : allExpenseCategories;

  const plateSuggestions = Array.from(
    new Set([...VEHICLE_PLATES, ...(knownPlates ?? [])])
  );

  useEffect(() => {
    return () => {
      if (docPreviewUrl) {
        URL.revokeObjectURL(docPreviewUrl);
      }
    };
  }, [docPreviewUrl]);

  useEffect(() => {
    if (initialData) {
      const legacy = parseVehicleCategory(initialData.category);
      setType(initialData.type);
      setBranch(initialData.branch ?? 'Gebze');
      setDate(initialData.date);
      setCategory(initialData.category);
      setDescription(initialData.description);
      setAmountStr(formatNumberForInput(initialData.amount));
      setVehiclePlate(initialData.vehiclePlate ?? legacy?.plate ?? '');
      setCustomerName(initialData.customerName ?? '');
      setCustomerPhone(initialData.customerPhone ?? '');
      setWarrantyPeriod(initialData.warrantyPeriod ?? '');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setError(null);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData && defaultBranch && defaultBranch !== 'all') {
      setBranch(defaultBranch);
    }
  }, [defaultBranch, initialData]);

  useEffect(() => {
    if (!initialData && defaultMonthKey && defaultMonthKey !== 'all') {
      if (!date.startsWith(defaultMonthKey)) {
        setDate(getDefaultDate(defaultMonthKey));
      }
    }
  }, [defaultMonthKey, initialData]);

  const clearDocumentState = () => {
    if (docPreviewUrl) {
      URL.revokeObjectURL(docPreviewUrl);
    }
    lastImagePayloadRef.current = null;
    setDocPreviewUrl(null);
    setIsParsingDoc(false);
    setDocParsedReady(false);
    setDocSummaryNote(null);
    setDocError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const applyParsedDocument = (parsed: ParsedDocumentResponse) => {
    const nextType: TransactionType = parsed.type === 'income' ? 'income' : 'expense';
    const nextBranch: Branch = parsed.branch === 'Yenidoğan' ? 'Yenidoğan' : 'Gebze';
    const targetCategoryList =
      nextType === 'income' ? allIncomeCategories : allExpenseCategories;

    setType(nextType);
    setBranch(nextBranch);

    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      setDate(parsed.date);
    }

    const parsedCategory = (parsed.category ?? '').trim();
    if (parsedCategory && targetCategoryList.includes(parsedCategory)) {
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setCategory(parsedCategory);
    } else if (parsedCategory) {
      setIsCustomCategory(true);
      setCustomCategoryInput(parsedCategory);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setCategory(targetCategoryList[0]);
    }

    if (parsed.description) {
      setDescription(parsed.description);
    }

    if (typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0) {
      setAmountStr(formatNumberForInput(parsed.amount));
    }

    if (nextType === 'expense') {
      setVehiclePlate(parsed.vehiclePlate ? normalizePlate(parsed.vehiclePlate) : '');
      setCustomerName('');
      setCustomerPhone('');
      setWarrantyPeriod('');
    } else {
      setVehiclePlate('');
      setCustomerName(parsed.customerName ?? '');
      setCustomerPhone(parsed.customerPhone ?? '');
      setWarrantyPeriod(parsed.warrantyPeriod ?? '');
    }

    setError(null);
    setDocParsedReady(true);
    setDocSummaryNote(
      parsed.summaryNote?.trim() ||
        'Belgedeki KDV hariç tutar ve bilgiler forma aktarıldı. Kontrol edip kayıt oluşturabilirsiniz.'
    );
  };

  const analyzeImagePayload = async (payload: { base64: string; mimeType: string }) => {
    setIsParsingDoc(true);
    setDocError(null);
    setDocParsedReady(false);
    setDocSummaryNote(null);

    try {
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: payload.base64,
          mimeType: payload.mimeType,
          incomeCategories: allIncomeCategories,
          expenseCategories: allExpenseCategories,
          knownPlates: plateSuggestions,
          defaultBranch: branch,
          todayDate: date,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ParsedDocumentResponse;
      if (!response.ok) {
        throw new Error(
          data.error || 'Belge fotoğrafı okunamadı. Lütfen tekrar deneyin.'
        );
      }

      applyParsedDocument(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Belge fotoğrafı işlenirken beklenmeyen bir hata oluştu.';
      setDocError(message);
      setDocParsedReady(false);
    } finally {
      setIsParsingDoc(false);
    }
  };

  const handleDocumentFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setDocError('Lütfen yalnızca fotoğraf veya görsel dosyası (JPG, PNG, WEBP) seçin.');
      return;
    }

    setDocError(null);
    setDocParsedReady(false);
    setDocSummaryNote(null);
    setIsParsingDoc(true);

    try {
      const prepared = await prepareImageForUpload(file);
      if (docPreviewUrl) {
        URL.revokeObjectURL(docPreviewUrl);
      }
      setDocPreviewUrl(prepared.previewUrl);
      lastImagePayloadRef.current = {
        base64: prepared.base64,
        mimeType: prepared.mimeType,
      };
      await analyzeImagePayload(lastImagePayloadRef.current);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Fotoğraf yüklenirken bir hata oluştu.';
      setDocError(message);
      setIsParsingDoc(false);
    }
  };

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    const nextList =
      nextType === 'income' ? allIncomeCategories : allExpenseCategories;
    if (!nextList.includes(category)) {
      setCategory(nextList[0]);
    }
  };

  const submitFormValues = (): boolean => {
    setError(null);

    const parsedAmount = parseTurkishAmount(amountStr);
    if (!date) {
      setError('Lütfen geçerli bir tarih seçin.');
      return false;
    }
    const finalCategory = isCustomCategory
      ? customCategoryInput.trim()
      : category.trim();
    if (!finalCategory) {
      setError('Lütfen bir kategori seçin veya yazın.');
      return false;
    }
    if (!description.trim()) {
      setError('Lütfen işlem açıklaması girin.');
      return false;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Tutar 0’dan büyük geçerli bir sayı olmalıdır.');
      return false;
    }

    const cleanedPlate =
      type === 'expense' && vehiclePlate.trim()
        ? normalizePlate(vehiclePlate)
        : undefined;

    onSubmit(
      {
        date,
        branch,
        type,
        category: finalCategory,
        description: description.trim(),
        amount: Math.round(parsedAmount * 100) / 100,
        vehiclePlate: cleanedPlate,
        customerName:
          type === 'income' && customerName.trim() ? customerName.trim() : undefined,
        customerPhone:
          type === 'income' && customerPhone.trim() ? customerPhone.trim() : undefined,
        warrantyPeriod:
          type === 'income' && warrantyPeriod.trim() ? warrantyPeriod.trim() : undefined,
      },
      initialData?.id
    );

    if (!initialData && mode === 'inline') {
      setDescription('');
      setAmountStr('');
      setVehiclePlate('');
      setCustomerName('');
      setCustomerPhone('');
      setWarrantyPeriod('');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      clearDocumentState();
      setSavedNotice(`${branch} şubesi için kayıt eklendi`);
      window.setTimeout(() => setSavedNotice(null), 2400);
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFormValues();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initialData && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingDoc(true);
          }}
          onDragLeave={() => setIsDraggingDoc(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingDoc(false);
            const droppedFile = e.dataTransfer.files?.[0];
            void handleDocumentFile(droppedFile);
          }}
          className={`rounded-xl border transition-colors ${
            isDraggingDoc
              ? 'border-[#0F1D36] bg-slate-100/80 border-dashed'
              : docPreviewUrl
              ? 'border-slate-200 bg-slate-50/70'
              : 'border-dashed border-slate-300 bg-slate-50/60 hover:border-slate-400'
          } p-3 sm:p-3.5`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleDocumentFile(e.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleDocumentFile(e.target.files?.[0])}
          />

          {!docPreviewUrl ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#0F1D36] shrink-0">
                  <FileImage className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900">
                    Belge Fotoğrafından Kayıt Oluştur
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Fiş, fatura veya servis formu fotoğrafı yükleyin; KDV hariç tutar ve alanlar otomatik doldurulsun.
                  </p>
                  {docError && (
                    <p role="alert" className="text-xs font-medium text-rose-700 mt-1">
                      {docError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Fotoğraf Seç</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamerayla Çek</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={docPreviewUrl}
                  alt="Yüklenen belge önizlemesi"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  {isParsingDoc ? (
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0F1D36]">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Belge fotoğrafı okunuyor, alanlar dolduruluyor...</span>
                    </div>
                  ) : docError ? (
                    <>
                      <p className="text-xs font-semibold text-rose-700">
                        Belge okunamadı
                      </p>
                      <p role="alert" className="text-xs text-rose-700 leading-relaxed">
                        {docError}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Belgeden bilgiler çıkarıldı</span>
                      </div>
                      {docSummaryNote && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {docSummaryNote}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        Aşağıdaki alanları kontrol edip doğrudan kayıt oluşturabilirsiniz.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {docParsedReady && !isParsingDoc && (
                  <button
                    type="button"
                    onClick={() => submitFormValues()}
                    className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Fotoğraftan Kayıt Oluştur</span>
                  </button>
                )}
                {docError && lastImagePayloadRef.current && !isParsingDoc && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lastImagePayloadRef.current) {
                        void analyzeImagePayload(lastImagePayloadRef.current);
                      }
                    }}
                    className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Tekrar Dene</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingDoc}
                  className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Değiştir</span>
                </button>
                <button
                  type="button"
                  onClick={clearDocumentState}
                  disabled={isParsingDoc}
                  aria-label="Belge fotoğrafını kaldır"
                  className="h-9 px-2.5 inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-rose-700 hover:border-rose-200 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Temizle</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="İşlem Türü"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Gelir Kaydı
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              - Gider Kaydı
            </button>
          </div>

          <div
            role="group"
            aria-label="Şube Seçimi"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            {BRANCHES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBranch(b)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  branch === b
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b} Şubesi
              </button>
            ))}
          </div>

          {savedNotice && (
            <span className="text-xs font-medium text-emerald-700">
              {savedNotice}
            </span>
          )}
        </div>

        {mode === 'modal' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Kapat"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Tarih
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
          />
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-600">
              Kategori
            </label>
            <button
              type="button"
              onClick={() => setIsCustomCategory((prev) => !prev)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
            >
              {isCustomCategory ? 'Listeden seç' : 'Özel yaz'}
            </button>
          </div>
          {isCustomCategory ? (
            <input
              type="text"
              value={customCategoryInput}
              onChange={(e) => setCustomCategoryInput(e.target.value)}
              placeholder="Yeni kategori adı..."
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
          ) : (
            <select
              value={availableCategories.includes(category) ? category : availableCategories[0]}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={type === 'income' ? 'lg:col-span-5' : 'lg:col-span-3'}>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Açıklama
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === 'income'
                ? 'Örn. TV panel tamiri veya uydu montajı'
                : 'Örn. Yakıt dolumu, parça alımı veya kira'
            }
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Tutar (₺)
          </label>
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              const rawNext = e.target.value;
              const cursorPos = e.target.selectionStart ?? rawNext.length;
              const significantBeforeCursor = rawNext
                .slice(0, cursorPos)
                .replace(/[^\d,]/g, '').length;

              const formatted = formatTurkishAmountInput(rawNext, amountStr);
              setAmountStr(formatted);

              window.requestAnimationFrame(() => {
                const el = amountInputRef.current;
                if (!el || document.activeElement !== el) return;
                let seen = 0;
                let nextCursor = formatted.length;
                for (let i = 0; i < formatted.length; i += 1) {
                  if (seen >= significantBeforeCursor) {
                    nextCursor = i;
                    break;
                  }
                  if (/[\d,]/.test(formatted[i])) {
                    seen += 1;
                  }
                }
                if (seen >= significantBeforeCursor && significantBeforeCursor > 0) {
                  let count = 0;
                  for (let i = 0; i < formatted.length; i += 1) {
                    if (/[\d,]/.test(formatted[i])) {
                      count += 1;
                      if (count === significantBeforeCursor) {
                        nextCursor = i + 1;
                        break;
                      }
                    }
                  }
                } else if (significantBeforeCursor === 0) {
                  nextCursor = 0;
                }
                el.setSelectionRange(nextCursor, nextCursor);
              });
            }}
            placeholder="0,00"
            className="w-full h-10 px-3 text-sm font-mono tabular-nums text-right bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
          />
        </div>

        {type === 'expense' && (
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Plaka{' '}
              <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <input
              type="text"
              list={plateListId}
              value={vehiclePlate}
              onChange={(e) =>
                setVehiclePlate(e.target.value.toLocaleUpperCase('tr-TR'))
              }
              placeholder="Örn. 06 GE 3789"
              className="w-full h-10 px-3 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
            <datalist id={plateListId}>
              {plateSuggestions.map((plate) => (
                <option key={plate} value={plate} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {/* Optional Customer Fields for Income */}
      {type === 'income' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Müşteri / Firma Adı{' '}
              <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Örn. Marmara Yapı A.Ş."
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Telefon{' '}
              <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Örn. 0532 123 45 67"
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Garanti Süresi{' '}
              <span className="font-normal text-slate-400">(opsiyonel)</span>
            </label>
            <input
              type="text"
              list={warrantyListId}
              value={warrantyPeriod}
              onChange={(e) => setWarrantyPeriod(e.target.value)}
              placeholder="Örn. 24 Ay"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
            <datalist id={warrantyListId}>
              <option value="6 Ay" />
              <option value="12 Ay" />
              <option value="24 Ay" />
              <option value="36 Ay" />
              <option value="Garanti Yok" />
            </datalist>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {mode === 'modal' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Vazgeç
          </button>
        )}
        <button
          type="submit"
          className="h-10 px-5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#0F1D36] rounded-lg hover:bg-[#172b4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F1D36]"
        >
          {initialData ? (
            <>
              <Save className="w-4 h-4" />
              <span>Değişiklikleri Kaydet</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Tabloya Ekle</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-rose-700 pt-1">
          {error}
        </p>
      )}
    </form>
  );
};
