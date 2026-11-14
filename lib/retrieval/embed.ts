import { GoogleGenAI } from '@google/genai';

/**
 * Checks whether an error is a transient rate-limit (429) or service unavailable (503) error.
 */
function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status =
    err?.status ??
    err?.statusCode ??
    err?.code ??
    err?.response?.status ??
    err?.status_code;
  if (status === 429 || status === 503) {
    return true;
  }
  const msg = typeof err?.message === 'string' ? err.message : '';
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE')
  );
}

/**
 * Embeds an array of texts using Gemini embedding models via @google/genai.
 *
 * @param texts Array of strings to embed (batched at max 50 per call)
 * @param kind 'document' for content to be indexed, 'query' for search queries
 * @returns Array of 768-dimensional number vectors
 */
export async function embedTexts(
  texts: string[],
  kind: 'document' | 'query',
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = process.env.GEMINI_EMBEDDING_MODEL;
  if (!model) {
    throw new Error('GEMINI_EMBEDDING_MODEL is not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Only pass taskType when model name is gemini-embedding-001
  const isEmbedding001 =
    model === 'gemini-embedding-001' ||
    model.endsWith('/gemini-embedding-001');

  const config: { outputDimensionality: number; taskType?: string } = {
    outputDimensionality: 768,
  };

  if (isEmbedding001) {
    config.taskType =
      kind === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY';
  }

  const BATCH_SIZE = 50;
  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    let lastError: unknown;
    let batchVectors: number[][] | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.embedContent({
          model,
          contents: batch,
          config,
        });

        const rawList =
          response.embeddings ??
          ((response as any).embedding ? [(response as any).embedding] : []);

        if (!Array.isArray(rawList) || rawList.length !== batch.length) {
          throw new Error(
            `Embedding count mismatch: expected ${batch.length} vectors, got ${
              Array.isArray(rawList) ? rawList.length : 'none'
            }`,
          );
        }

        const vectors: number[][] = [];
        for (let idx = 0; idx < rawList.length; idx++) {
          const values = rawList[idx]?.values;
          if (!Array.isArray(values) || values.length !== 768) {
            throw new Error(
              `Embedding vector dimension mismatch: expected exactly 768 numbers, got ${
                Array.isArray(values) ? values.length : typeof values
              }`,
            );
          }

          for (let dim = 0; dim < values.length; dim++) {
            if (typeof values[dim] !== 'number' || Number.isNaN(values[dim])) {
              throw new Error(
                `Embedding vector dimension ${dim} is not a valid number`,
              );
            }
          }
          vectors.push(values);
        }

        batchVectors = vectors;
        break;
      } catch (err: any) {
        lastError = err;
        if (attempt === 1 && isRetryableError(err)) {
          // Retry once after 1.5 seconds on 429 or 503
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        // Do not log the key or the texts
        throw err;
      }
    }

    if (!batchVectors) {
      throw lastError;
    }

    allVectors.push(...batchVectors);
  }

  return allVectors;
}
