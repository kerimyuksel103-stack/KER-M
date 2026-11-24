import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024; // ~10 MB base64 cap

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : undefined;
      const isTransient = status === 429 || status === 503 || status === 500;
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

interface ParseDocumentRequestBody {
  imageBase64?: string;
  mimeType?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
  knownPlates?: string[];
  defaultBranch?: string;
  todayDate?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.post('/api/parse-document', async (req: Request, res: Response) => {
    try {
      const ai = createAiClient();
      if (!ai) {
        res.status(500).json({
          error:
            'GEMINI_API_KEY yapılandırılmamış. Lütfen Settings > Secrets panelinden API anahtarını kontrol edin.',
        });
        return;
      }

      const body = (req.body ?? {}) as ParseDocumentRequestBody;
      const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';

      if (!imageBase64 || !mimeType || !mimeType.startsWith('image/')) {
        res.status(400).json({
          error: 'Geçerli bir belge fotoğrafı (image/*) gönderilmelidir.',
        });
        return;
      }

      if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
        res.status(413).json({
          error: 'Görsel boyutu çok büyük. Lütfen daha küçük bir fotoğraf yükleyin.',
        });
        return;
      }

      const incomeCategories = Array.isArray(body.incomeCategories)
        ? body.incomeCategories.slice(0, 30)
        : [
            'TV Tamiri',
            'Uydu Montaj / Servis',
            'Kamera / Güvenlik Sistemi',
            'Tv Satış',
            'Malzeme / Parça Satışı',
            'Diğer Gelir',
            'Servis',
          ];

      const expenseCategories = Array.isArray(body.expenseCategories)
        ? body.expenseCategories.slice(0, 40)
        : [
            'Malzeme / Parça Alımı',
            'Kira Gideri',
            'Personel / Maaş',
            'Yakıt / Ulaşım',
            'Bakım / Onarım',
            'Sigorta / Muayene / Vergi',
            'HGS / Otopark',
            'Elektrik Gideri',
            'Vergi / SGK',
            'Yemek Gideri',
            'Hgs Gideri',
            'Su Gideri',
            'İnternet Gideri',
            'Telefon Gideri',
            'Diğer Gider',
          ];

      const knownPlates = Array.isArray(body.knownPlates)
        ? body.knownPlates.slice(0, 20)
        : ['06 GE 3789', '34 NOZ 300'];

      const defaultBranch =
        body.defaultBranch === 'Yenidoğan' ? 'Yenidoğan' : 'Gebze';
      const todayDate =
        typeof body.todayDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.todayDate)
          ? body.todayDate
          : '2026-11-24';

      const prompt = [
        'Sen Yüksel Elektronik (Gebze ve Yenidoğan şubeleri; TV tamiri, uydu montajı, kamera güvenlik sistemleri ve TV satışı) muhasebe ön kayıt asistanısın.',
        'Ekteki fiş, fatura, dekont, servis formu veya belge fotoğrafını dikkatlice oku ve aşağıdaki JSON şemasına uygun olarak alanları çıkar.',
        '',
        'Kurallar:',
        `1. type: Yüksel Elektronik tarafından yapılan harcamalar (akaryakıt fişi, yemek fişi, malzeme alım faturası, elektrik/su/internet/telefon faturası, kira, araç bakım/sigorta/HGS, vergi) için "expense"; Yüksel Elektronik tarafından müşteriye kesilen satış/servis/tamir belgesi için "income" seç. Belirsiz perakende fişlerde "expense" seç.`,
        `2. branch: Belge üzerinde Gebze/Kocaeli adresi varsa "Gebze", Yenidoğan/Sancaktepe/İstanbul adresi varsa "Yenidoğan" seç. Anlaşılmıyorsa "${defaultBranch}" döndür.`,
        `3. date: Belgedeki işlem tarihini YYYY-MM-DD formatında döndür. Tarih okunamıyorsa "${todayDate}" döndür.`,
        `4. category: type "income" ise şu listeden EN UYGUN olanı birebir seç: [${incomeCategories.join(', ')}]. type "expense" ise şu listeden EN UYGUN olanı birebir seç: [${expenseCategories.join(', ')}].`,
        `5. description: Belgedeki iş veya harcamayı özetleyen kısa, anlaşılır Türkçe açıklama yaz (ör. "Shell Motorin Alımı", "55 İnç TV Panel Onarımı", "Kamera Kablosu ve Adaptör Alımı").`,
        `6. amount: Belgedeki KDV HARİÇ tutarı (Matrah / Ara Toplam / Mal Hizmet Toplam Tutarı / KDV Hariç Toplam) pozitif sayı olarak döndür (ör. 1450.5). ÖNEMLİ: KDV DAHİL genel toplamı alma! Eğer belgede KDV hariç tutar doğrudan yazıyorsa onu al. Eğer yalnızca "TOPLAM" (KDV dahil) ve "TOPKDV" / "KDV Tutarı" yazıyorsa TOPLAM - KDV işlemini yaparak KDV hariç tutarı hesapla. Yalnızca KDV oranı (%1, %10, %20) yazıp tutar ayrılmamışsa Genel Toplam / (1 + KDV Oranı) ile KDV hariç tutarı hesapla. Belgede KDV %0 / KDV'siz / muaf ise mevcut toplamı döndür.`,
        `7. vehiclePlate: Gider belgesinde (özellikle yakıt fişi, HGS, otopark, araç bakım/sigorta) Türk araç plakası görünüyorsa büyük harf ve standart boşluklu biçimde döndür (ör. "06 GE 3789", "34 NOZ 300"). Bilinen plakalar: [${knownPlates.join(', ')}]. Plaka yoksa boş string "" döndür.`,
        `8. customerName, customerPhone, warrantyPeriod: Yalnızca gelir belgesiyse müşteri/firma adı, telefon ve garanti süresini (ör. "24 Ay") doldur; yoksa boş string "" döndür.`,
        `9. summaryNote: Belgeden neyin okunduğunu ve KDV hariç tutarın alındığını tek kısa Türkçe cümleyle özetle.`,
      ].join('\n');

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  description: 'Must be "income" or "expense".',
                },
                branch: {
                  type: Type.STRING,
                  description: 'Must be "Gebze" or "Yenidoğan".',
                },
                date: {
                  type: Type.STRING,
                  description: 'Transaction date in YYYY-MM-DD format.',
                },
                category: {
                  type: Type.STRING,
                  description: 'Exact matching category from the provided list.',
                },
                description: {
                  type: Type.STRING,
                  description: 'Short Turkish description of the document.',
                },
                amount: {
                  type: Type.NUMBER,
                  description: 'Positive amount in TRY excluding VAT (KDV hariç / matrah / ara toplam).',
                },
                vehiclePlate: {
                  type: Type.STRING,
                  description: 'Turkish license plate if found, else empty string.',
                },
                customerName: {
                  type: Type.STRING,
                  description: 'Customer or company name if income document, else empty string.',
                },
                customerPhone: {
                  type: Type.STRING,
                  description: 'Customer phone if income document, else empty string.',
                },
                warrantyPeriod: {
                  type: Type.STRING,
                  description: 'Warranty duration if stated on income document, else empty string.',
                },
                summaryNote: {
                  type: Type.STRING,
                  description: 'Brief 1-sentence Turkish summary of extracted details.',
                },
              },
              required: ['type', 'branch', 'date', 'category', 'description', 'amount'],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Belge fotoğrafından veri okunamadı. Lütfen daha net bir fotoğraf deneyin.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      res.json({
        type: parsed.type === 'income' ? 'income' : 'expense',
        branch: parsed.branch === 'Yenidoğan' ? 'Yenidoğan' : 'Gebze',
        date:
          typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : todayDate,
        category: typeof parsed.category === 'string' ? parsed.category.trim() : '',
        description:
          typeof parsed.description === 'string' ? parsed.description.trim() : '',
        amount:
          typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0
            ? Math.round(parsed.amount * 100) / 100
            : null,
        vehiclePlate:
          typeof parsed.vehiclePlate === 'string' ? parsed.vehiclePlate.trim() : '',
        customerName:
          typeof parsed.customerName === 'string' ? parsed.customerName.trim() : '',
        customerPhone:
          typeof parsed.customerPhone === 'string' ? parsed.customerPhone.trim() : '',
        warrantyPeriod:
          typeof parsed.warrantyPeriod === 'string' ? parsed.warrantyPeriod.trim() : '',
        summaryNote:
          typeof parsed.summaryNote === 'string' ? parsed.summaryNote.trim() : '',
      });
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      const message =
        err instanceof Error ? err.message : 'Belge analizi sırasında bir hata oluştu.';

      if (status === 400 || status === 403) {
        res.status(status).json({
          error:
            'API anahtarı doğrulanamadı. Lütfen Settings > Secrets panelinden GEMINI_API_KEY ayarını kontrol edin.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'İstek limiti aşıldı. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yüksel Elektronik sunucusu http://0.0.0.0:${PORT} üzerinde çalışıyor`);
  });
}

startServer();
