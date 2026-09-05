## What it does

1. Enter application fields (brand, class/type, alcohol content, net contents)
2. Upload one or many label images
3. Extract text from each image
4. Compare fields and the government warning statement

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm run test:verify
npm run build && npm start
```

## Approach

| Choice | Why |
|--------|-----|
| Next.js + TypeScript + Tailwind | Straightforward UI and easy deploy |
| Tesseract.js | Local text extraction with no API keys |
| Fuse.js for brand / class | Handles minor casing and punctuation differences |
| Strict warning check | Header must be `GOVERNMENT WARNING:` in all caps |
| Numeric ABV compare | Treats `90 Proof` and `45% Alc./Vol.` as the same |

### Limits

- Text extraction quality depends on image clarity
- First load may take a few seconds while language data downloads
- Built for clear, upright label photos
- Does not connect to COLA or other government systems
