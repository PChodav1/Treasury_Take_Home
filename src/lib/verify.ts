import Fuse from "fuse.js";
import { GOVERNMENT_WARNING, type ApplicationFields } from "./constants";

export type FieldStatus = "pass" | "fail" | "review";

export type FieldResult = {
  field: string;
  label: string;
  expected: string;
  found: string;
  status: FieldStatus;
  note: string;
};

export type VerificationResult = {
  overall: FieldStatus;
  fields: FieldResult[];
  extractedText: string;
  elapsedMs: number;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9%./()\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string): string {
  return normalize(text).replace(/\s+/g, "");
}

export function extractAbvPercent(text: string): number | null {
  const proof = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  if (proof) return Number(proof[1]) / 2;

  const alc = text.match(
    /(\d+(?:\.\d+)?)\s*%?\s*(?:alc(?:ohol)?\.?\s*(?:by\s*)?(?:vol(?:ume)?\.?)?|abv)/i,
  );
  if (alc) return Number(alc[1]);

  const bare = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (bare) return Number(bare[1]);

  return null;
}

function fuzzyContains(
  haystack: string,
  needle: string,
  threshold = 0.35,
): boolean {
  if (!needle.trim()) return true;
  const nHay = normalize(haystack);
  const nNeedle = normalize(needle);
  if (!nNeedle) return true;
  if (nHay.includes(nNeedle)) return true;
  if (compact(nHay).includes(compact(nNeedle))) return true;

  const fuse = new Fuse(
    nHay
      .split(" ")
      .filter(Boolean)
      .map((token) => ({ token })),
    { keys: ["token"], threshold, includeScore: true },
  );
  const words = nNeedle.split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const hits = words.filter((w) => fuse.search(w).length > 0).length;
  return hits / words.length >= 0.75;
}

function findNetContents(text: string): string {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(mL|ml|ML|L|l|oz|fl\.?\s*oz)\b/i);
  return m ? m[0].replace(/\s+/g, " ") : "";
}

function checkGovernmentWarning(ocrText: string): FieldResult {
  const compactOcr = compact(ocrText);
  const compactExpected = compact(GOVERNMENT_WARNING);
  const hasAllCapsHeader = /GOVERNMENT\s+WARNING\s*:/.test(ocrText);
  const hasTitleCaseHeader =
    /Government\s+Warning\s*:/i.test(ocrText) && !hasAllCapsHeader;
  const body = compact(
    GOVERNMENT_WARNING.replace(/^GOVERNMENT WARNING:\s*/i, ""),
  );
  const bodyPresent =
    compactOcr.includes(body.slice(0, 80)) ||
    compactOcr.includes(compactExpected.slice(0, 100));

  if (hasAllCapsHeader && bodyPresent) {
    return {
      field: "governmentWarning",
      label: "Government warning",
      expected: "Exact TTB wording with GOVERNMENT WARNING: in all caps",
      found: "Present with required header",
      status: "pass",
      note: "All-caps header and warning body found.",
    };
  }

  if (hasTitleCaseHeader || (bodyPresent && !hasAllCapsHeader)) {
    return {
      field: "governmentWarning",
      label: "Government warning",
      expected: "GOVERNMENT WARNING: (all caps) + full statement",
      found: hasTitleCaseHeader
        ? "Warning present but header is not all caps"
        : "Warning body found but GOVERNMENT WARNING: header missing/incorrect",
      status: "fail",
      note: "TTB requires the header in all caps.",
    };
  }

  return {
    field: "governmentWarning",
    label: "Government warning",
    expected: "Exact TTB wording with GOVERNMENT WARNING: in all caps",
    found: "Not found in OCR text",
    status: "fail",
    note: "Could not locate the mandatory government warning on the label.",
  };
}

export function verifyLabel(
  ocrText: string,
  application: ApplicationFields,
  elapsedMs: number,
): VerificationResult {
  const fields: FieldResult[] = [];

  const brandOk = fuzzyContains(ocrText, application.brandName);
  fields.push({
    field: "brandName",
    label: "Brand name",
    expected: application.brandName,
    found: brandOk
      ? "Found on label (allowing minor casing/OCR differences)"
      : "Not clearly found",
    status: brandOk ? "pass" : "fail",
    note: brandOk
      ? "Matched with tolerant comparison (case / punctuation)."
      : "Brand name from the application was not found on the label.",
  });

  const classOk = fuzzyContains(ocrText, application.classType, 0.4);
  fields.push({
    field: "classType",
    label: "Class / type",
    expected: application.classType,
    found: classOk ? "Found on label" : "Not clearly found",
    status: classOk ? "pass" : "fail",
    note: classOk
      ? "Class/type designation appears on the label."
      : "Class/type from the application was not found on the label.",
  });

  const expectedAbv = extractAbvPercent(application.alcoholContent);
  const foundAbv = extractAbvPercent(ocrText);
  let abvStatus: FieldStatus = "fail";
  let abvNote = "Could not compare alcohol content.";
  const foundAbvText =
    foundAbv != null ? `${foundAbv}% Alc./Vol.` : "Not found";

  if (expectedAbv != null && foundAbv != null) {
    if (Math.abs(expectedAbv - foundAbv) < 0.15) {
      abvStatus = "pass";
      abvNote = "Alcohol content matches the application.";
    } else {
      abvStatus = "fail";
      abvNote = `Label shows ~${foundAbv}% but application lists ~${expectedAbv}%.`;
    }
  } else if (expectedAbv == null) {
    abvStatus = "review";
    abvNote = "Could not parse ABV from the application field.";
  } else {
    abvStatus = "fail";
    abvNote = "Could not read ABV from the label image.";
  }

  fields.push({
    field: "alcoholContent",
    label: "Alcohol content",
    expected: application.alcoholContent,
    found: foundAbvText,
    status: abvStatus,
    note: abvNote,
  });

  const foundNet = findNetContents(ocrText);
  const expectedNetCompact = compact(application.netContents);
  const netOk =
    !!expectedNetCompact &&
    !!foundNet &&
    (compact(foundNet).includes(expectedNetCompact) ||
      expectedNetCompact.includes(compact(foundNet)) ||
      fuzzyContains(foundNet, application.netContents, 0.3));

  fields.push({
    field: "netContents",
    label: "Net contents",
    expected: application.netContents,
    found: foundNet || "Not found",
    status: netOk ? "pass" : "fail",
    note: netOk
      ? "Net contents match."
      : "Net contents from the application were not found on the label.",
  });

  fields.push(checkGovernmentWarning(ocrText));

  const anyFail = fields.some((f) => f.status === "fail");
  const anyReview = fields.some((f) => f.status === "review");
  const overall: FieldStatus = anyFail ? "fail" : anyReview ? "review" : "pass";

  return { overall, fields, extractedText: ocrText, elapsedMs };
}
