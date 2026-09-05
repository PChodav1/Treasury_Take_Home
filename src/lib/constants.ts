export const GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export type ApplicationFields = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
};

export type SampleCase = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  application: ApplicationFields;
  expectedOutcome: "pass" | "fail";
};

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "old-tom",
    title: "Old Tom Bourbon (match)",
    description: "Label matches the application — should pass.",
    imagePath: "/samples/old-tom-bourbon.png",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
    expectedOutcome: "pass",
  },
  {
    id: "stones-throw",
    title: "Stone's Throw (casing)",
    description:
      "Brand casing differs (STONE'S THROW vs Stone's Throw) — should still pass.",
    imagePath: "/samples/stones-throw-rye.png",
    application: {
      brandName: "Stone's Throw",
      classType: "Straight Rye Whiskey",
      alcoholContent: "46% Alc./Vol. (92 Proof)",
      netContents: "750 mL",
    },
    expectedOutcome: "pass",
  },
  {
    id: "bad-warning",
    title: "Harbor Mist (bad warning)",
    description:
      "Warning uses title case instead of GOVERNMENT WARNING — should fail.",
    imagePath: "/samples/harbor-mist-gin-bad-warning.png",
    application: {
      brandName: "HARBOR MIST",
      classType: "London Dry Gin",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
    },
    expectedOutcome: "fail",
  },
  {
    id: "abv-mismatch",
    title: "Old Tom (ABV mismatch)",
    description: "Application says 45%; label shows 40% — should fail.",
    imagePath: "/samples/mismatch-abv.png",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
    expectedOutcome: "fail",
  },
];

export const EMPTY_APPLICATION: ApplicationFields = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
};
