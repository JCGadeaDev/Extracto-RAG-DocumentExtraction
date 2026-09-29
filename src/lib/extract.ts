import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { TIPOS, type Extraction } from "@/lib/schemas";

export type { Extraction };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELO_POR_DEFECTO = "deepseek/deepseek-v4.1-flash";
// Los PDF se rasterizan aquí y se envían como imágenes: el modelo hace el OCR
// y no dependemos de los plugins de ficheros de OpenRouter (que exigen saldo mínimo).
const MAX_PDF_PAGES = 10;
const PDF_RENDER_SCALE = 2;

const SYSTEM = `Eres un sistema de OCR y extracción de datos de documentos.
Lee todo el texto del documento, clasifícalo como "factura", "recibo", "contrato" u "otro" y extrae sus datos.

Responde SOLO con un objeto JSON con esta forma:
{"tipo": "factura|recibo|contrato|otro", "confianza": 0-1, "resumen": "una frase",
 "texto": "transcripción completa del documento, respetando saltos de línea", "datos": {...}}

Campos esperados en "datos" según el tipo (omite los que no aparezcan, no inventes valores):
- factura: numero, fecha_emision, fecha_vencimiento, emisor {nombre, id_fiscal, direccion},
  receptor {nombre, id_fiscal, direccion}, conceptos [{descripcion, cantidad, precio_unitario, importe}],
  subtotal, impuestos [{tipo, tasa, importe}], total, moneda, forma_pago
- recibo: numero, fecha, comercio {nombre, id_fiscal, direccion}, conceptos [{descripcion, cantidad, importe}],
  subtotal, impuestos, total, moneda, metodo_pago
- contrato: titulo, tipo_contrato, fecha_firma, fecha_inicio, fecha_fin, partes [{nombre, rol, id_fiscal}],
  objeto, importe, moneda, condiciones_pago, duracion, clausulas_clave [string], jurisdiccion
- otro: los datos más relevantes que encuentres

Formatos: fechas en ISO 8601 (AAAA-MM-DD), importes como números sin símbolo de moneda,
moneda como código ISO 4217 cuando se pueda deducir.`;

const SCHEMA = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: TIPOS },
    confianza: { type: "number" },
    resumen: { type: "string" },
    texto: { type: "string" },
    datos: { type: "object" },
  },
  required: ["tipo", "confianza", "resumen", "texto", "datos"],
};

type ImagePart = { type: "image_url"; image_url: { url: string } };

function imagePart(bytes: Buffer, mimeType: string): ImagePart {
  return {
    type: "image_url",
    image_url: { url: `data:${mimeType};base64,${bytes.toString("base64")}` },
  };
}

async function pdfToImageParts(bytes: Buffer): Promise<ImagePart[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: ImagePart[] = [];
  for (let n = 1; n <= pages; n++) {
    const png = await renderPageAsImage(pdf, n, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: PDF_RENDER_SCALE,
    });
    parts.push(imagePart(Buffer.from(png), "image/png"));
  }
  await pdf.cleanup();
  return parts;
}

export async function extractDocument(
  bytes: Buffer,
  mimeType: string,
): Promise<Extraction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta OPENROUTER_API_KEY");

  const fileParts =
    mimeType === "application/pdf"
      ? await pdfToImageParts(bytes)
      : [imagePart(bytes, mimeType)];

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Extracto",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || MODELO_POR_DEFECTO,
      // Sin límite, OpenRouter reserva el máximo del modelo (131k) contra el saldo
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            ...fileParts,
            {
              type: "text",
              text:
                fileParts.length > 1
                  ? `Estas ${fileParts.length} imágenes son las páginas de un mismo documento, en orden. Clasifícalo y extrae sus datos.`
                  : "Clasifica este documento y extrae sus datos.",
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "extraccion", strict: false, schema: SCHEMA },
      },
      // Solo enruta a proveedores que respeten response_format
      provider: { require_parameters: true },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `OpenRouter respondió ${res.status}`);
  }

  const content: string | undefined = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("El modelo no devolvió contenido");

  return parseExtraction(content);
}

function parseExtraction(content: string): Extraction {
  // Algunos modelos envuelven el JSON en ```json ... ```
  const json = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  let parsed: Partial<Extraction>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("El modelo devolvió un JSON no válido");
  }
  return {
    tipo: TIPOS.includes(parsed.tipo as Extraction["tipo"])
      ? (parsed.tipo as Extraction["tipo"])
      : "otro",
    confianza: typeof parsed.confianza === "number" ? parsed.confianza : 0,
    resumen: parsed.resumen ?? "",
    texto: parsed.texto ?? "",
    datos: parsed.datos ?? {},
  };
}
