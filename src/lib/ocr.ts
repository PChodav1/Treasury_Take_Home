import { createWorker, PSM, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function warmOcr(): Promise<void> {
  await getWorker();
}

export async function extractTextFromImage(
  image: File | Blob | string,
): Promise<{ text: string; elapsedMs: number }> {
  const start = performance.now();
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return {
    text: data.text ?? "",
    elapsedMs: Math.round(performance.now() - start),
  };
}
