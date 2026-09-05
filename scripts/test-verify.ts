import assert from "node:assert/strict";
import { GOVERNMENT_WARNING } from "../src/lib/constants";
import { extractAbvPercent, verifyLabel } from "../src/lib/verify";

const app = {
  brandName: "Stone's Throw",
  classType: "Straight Rye Whiskey",
  alcoholContent: "46% Alc./Vol. (92 Proof)",
  netContents: "750 mL",
};

const good = verifyLabel(
  `
STONE'S THROW
Straight Rye Whiskey
46% Alc./Vol. (92 Proof)
750 mL
${GOVERNMENT_WARNING}
`,
  app,
  100,
);
assert.equal(good.overall, "pass");

const badWarning = verifyLabel(
  `
HARBOR MIST
London Dry Gin
40% Alc./Vol. (80 Proof)
750 mL
Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.
`,
  {
    brandName: "HARBOR MIST",
    classType: "London Dry Gin",
    alcoholContent: "40% Alc./Vol. (80 Proof)",
    netContents: "750 mL",
  },
  100,
);
assert.equal(badWarning.overall, "fail");
assert.equal(
  badWarning.fields.find((f) => f.field === "governmentWarning")?.status,
  "fail",
);

assert.equal(extractAbvPercent("90 Proof"), 45);
assert.equal(extractAbvPercent("45% Alc./Vol."), 45);

const mismatch = verifyLabel(
  `
OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
40% Alc./Vol. (80 Proof)
750 mL
${GOVERNMENT_WARNING}
`,
  {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
  },
  50,
);
assert.equal(mismatch.overall, "fail");
assert.equal(
  mismatch.fields.find((f) => f.field === "alcoholContent")?.status,
  "fail",
);

console.log("verify tests passed");
