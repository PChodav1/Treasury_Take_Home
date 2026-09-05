'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  EMPTY_APPLICATION,
  SAMPLE_CASES,
  type ApplicationFields,
} from "@/lib/constants";
import { extractTextFromImage, warmOcr } from "@/lib/ocr";
import { verifyLabel, type VerificationResult } from "@/lib/verify";

type Job = {
  id: string;
  name: string;
  previewUrl: string;
  file: File | null;
  imageSource: File | string;
  status: "queued" | "running" | "done" | "error";
  error?: string;
  result?: VerificationResult;
};

function statusColor(status: string) {
  if (status === "pass") return "bg-emerald-700 text-white";
  if (status === "fail") return "bg-rose-700 text-white";
  if (status === "review") return "bg-amber-600 text-white";
  return "bg-slate-600 text-white";
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-base text-ink shadow-sm outline-none ring-teal-700/30 placeholder:text-ink/35 focus:border-teal-700 focus:ring-2"
      />
    </label>
  );
}

export function LabelVerifier() {
  const [application, setApplication] =
    useState<ApplicationFields>(EMPTY_APPLICATION);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ocrReady, setOcrReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    warmOcr()
      .then(() => {
        if (!cancelled) setOcrReady(true);
      })
      .catch(() => {
        if (!cancelled) setOcrReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      jobs.forEach((j) => {
        if (j.previewUrl.startsWith("blob:")) URL.revokeObjectURL(j.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canVerify = useMemo(() => {
    return (
      jobs.length > 0 &&
      !!application.brandName.trim() &&
      !!application.classType.trim() &&
      !!application.alcoholContent.trim() &&
      !!application.netContents.trim() &&
      !busy
    );
  }, [jobs, application, busy]);

  function updateField<K extends keyof ApplicationFields>(
    key: K,
    value: ApplicationFields[K],
  ) {
    setApplication((prev) => ({ ...prev, [key]: value }));
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: Job[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      file,
      imageSource: file,
      status: "queued" as const,
    }));
    startTransition(() => {
      setJobs((prev) => [...prev, ...next]);
    });
  }

  async function loadSample(sampleId: string) {
    const sample = SAMPLE_CASES.find((s) => s.id === sampleId);
    if (!sample) return;
    setApplication(sample.application);
    const res = await fetch(sample.imagePath);
    const blob = await res.blob();
    const file = new File([blob], sample.imagePath.split("/").pop()!, {
      type: blob.type || "image/png",
    });
    const job: Job = {
      id: `sample-${sample.id}-${crypto.randomUUID()}`,
      name: sample.title,
      previewUrl: sample.imagePath,
      file,
      imageSource: sample.imagePath,
      status: "queued",
    };
    setJobs((prev) => [...prev, job]);
  }

  function clearJobs() {
    jobs.forEach((j) => {
      if (j.previewUrl.startsWith("blob:")) URL.revokeObjectURL(j.previewUrl);
    });
    setJobs([]);
  }

  async function runVerification() {
    if (!canVerify) return;
    setBusy(true);
    const snapshot = [...jobs];
    for (const job of snapshot) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: "running", error: undefined } : j,
        ),
      );
      try {
        const { text, elapsedMs } = await extractTextFromImage(job.imageSource);
        const result = verifyLabel(text, application, elapsedMs);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "done", result } : j,
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not read this image.";
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "error", error: message } : j,
          ),
        );
      }
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="mb-10 max-w-3xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-teal-800">
          Label Check
        </p>
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
          Alcohol label verification
        </h1>
        <p className="mt-3 text-lg text-ink/70">
          Enter the application fields, upload one or more label images, and
          compare them for a clear pass or fail.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-ink/10 bg-paper/80 p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-2xl text-ink">1. Application</h2>
          <p className="mt-1 text-sm text-ink/60">
            Fields from the submitted application.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FieldInput
              label="Brand name"
              value={application.brandName}
              onChange={(v) => updateField("brandName", v)}
              placeholder="OLD TOM DISTILLERY"
            />
            <FieldInput
              label="Class / type"
              value={application.classType}
              onChange={(v) => updateField("classType", v)}
              placeholder="Kentucky Straight Bourbon Whiskey"
            />
            <FieldInput
              label="Alcohol content"
              value={application.alcoholContent}
              onChange={(v) => updateField("alcoholContent", v)}
              placeholder="45% Alc./Vol. (90 Proof)"
            />
            <FieldInput
              label="Net contents"
              value={application.netContents}
              onChange={(v) => updateField("netContents", v)}
              placeholder="750 mL"
            />
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-ink">Try a sample</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_CASES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => loadSample(sample.id)}
                  className="rounded-md border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink hover:border-teal-700 hover:text-teal-900"
                  title={sample.description}
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-ink/10 bg-paper/80 p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-2xl text-ink">2. Label images</h2>
          <p className="mt-1 text-sm text-ink/60">
            Upload one label or a batch. PNG or JPG works best.
          </p>
          <div
            className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ink/20 bg-white/70 px-4 py-8 text-center transition hover:border-teal-700"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
          >
            <p className="text-base font-medium text-ink">
              Drop labels here, or click to choose files
            </p>
            <p className="mt-1 text-sm text-ink/50">Batch upload supported</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {jobs.length > 0 && (
            <div className="mt-4 space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-md border border-ink/10 bg-white p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={job.previewUrl}
                    alt={job.name}
                    className="h-14 w-14 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {job.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-ink/50">
                      {job.status}
                    </p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={clearJobs}
                className="text-sm text-ink/60 underline-offset-2 hover:text-ink hover:underline"
              >
                Clear images
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canVerify}
          onClick={runVerification}
          className="rounded-md bg-teal-800 px-5 py-3 text-base font-semibold text-white shadow-sm transition enabled:hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-ink/25"
        >
          {busy || isPending ? "Checking labels…" : "Verify labels"}
        </button>
        <p className="text-sm text-ink/55">
          Typical runtime is a few seconds per label after the first load.
        </p>
      </div>

      {jobs.some((j) => j.result || j.error) && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">3. Results</h2>
          <div className="mt-4 space-y-5">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-paper/60 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.previewUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div>
                      <h3 className="font-medium text-ink">{job.name}</h3>
                      {job.result && (
                        <p className="text-xs text-ink/50">
                          {job.result.elapsedMs} ms
                        </p>
                      )}
                    </div>
                  </div>
                  {job.result && (
                    <span
                      className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusColor(job.result.overall)}`}
                    >
                      {job.result.overall}
                    </span>
                  )}
                  {job.error && (
                    <span className="rounded bg-rose-700 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      error
                    </span>
                  )}
                </div>
                {job.error && (
                  <p className="px-4 py-4 text-sm text-rose-800 sm:px-5">
                    {job.error}
                  </p>
                )}
                {job.result && (
                  <div className="divide-y divide-ink/8">
                    {job.result.fields.map((field) => (
                      <div
                        key={field.field}
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr] sm:px-5"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(field.status)}`}
                          >
                            {field.status}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {field.label}
                          </span>
                        </div>
                        <div className="text-sm text-ink/75">
                          <p>
                            <span className="text-ink/45">Expected: </span>
                            {field.expected}
                          </p>
                          <p>
                            <span className="text-ink/45">Found: </span>
                            {field.found}
                          </p>
                          <p className="mt-1 text-ink/55">{field.note}</p>
                        </div>
                      </div>
                    ))}
                    <details className="px-4 py-3 sm:px-5">
                      <summary className="cursor-pointer text-sm font-medium text-ink/70">
                        Show extracted text
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-ink/5 p-3 text-xs text-ink/80">
                        {job.result.extractedText || "(empty)"}
                      </pre>
                    </details>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
