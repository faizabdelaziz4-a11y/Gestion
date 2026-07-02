/**
 * Point d'intégration IA / OCR.
 *
 * Utilise l'API Claude (vision) si ANTHROPIC_API_KEY est défini, pour :
 *  - lire le kilométrage sur une photo de tableau de bord ;
 *  - extraire un horaire depuis une photo de planning.
 *
 * Sans clé, renvoie un résultat « manuel » : l'utilisateur confirme/saisit
 * la valeur à la main. L'app reste 100 % fonctionnelle sans IA.
 */

const MODEL = "claude-opus-4-8";

type ImageInput = { base64: string; mediaType: string };

async function callVision(prompt: string, image: ImageInput): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.base64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

export interface KmReadResult {
  km: number | null;
  confidence: "ia" | "manuel";
  raw?: string;
}

/** Lit le kilométrage total affiché sur une photo de tableau de bord. */
export async function readDashboardKm(image: ImageInput): Promise<KmReadResult> {
  const text = await callVision(
    "Tu lis le compteur kilométrique (odomètre total) d'un tableau de bord de voiture. " +
      "Réponds UNIQUEMENT par le nombre de kilomètres total affiché, sans unité ni texte. " +
      "Si illisible, réponds 'NA'.",
    image
  );
  if (!text) return { km: null, confidence: "manuel" };
  const match = text.replace(/[^0-9.]/g, "");
  const km = match ? parseFloat(match) : NaN;
  return Number.isFinite(km)
    ? { km, confidence: "ia", raw: text }
    : { km: null, confidence: "manuel", raw: text };
}

export interface ScheduleEntry {
  date?: string;
  start?: string;
  end?: string;
}

/** Extrait des créneaux horaires depuis une photo de planning. */
export async function readSchedule(image: ImageInput): Promise<ScheduleEntry[]> {
  const text = await callVision(
    "Voici la photo d'un planning/horaire de travail. Extrais les créneaux. " +
      'Réponds UNIQUEMENT en JSON: [{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}]. ' +
      "Sans texte autour.",
    image
  );
  if (!text) return [];
  try {
    const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
