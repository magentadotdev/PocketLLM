# PocketLLM

A local-first AI chat app prototype for iPhone, built with React Native + Expo.

## Included in this starter

- Dark chat interface prototype
- Editable base system prompt
- Individual instruction toggles
- Local persistence with AsyncStorage
- Hidden personality: **The Archivist**
- GitHub Actions workflow for iOS Simulator builds

## Secret personality

Tap the PocketLLM wordmark in the top-left corner **seven times** to unlock The Archivist. Then open Settings and enable it under Hidden Personality.

## Run from Windows / WSL

Install Node.js 22 and npm in your WSL distribution, then:

```bash
npm install
npm run typecheck
npx expo start
```

You can scan the Expo QR code with Expo Go for an initial UI preview. Some native features may later require a development build.

## GitHub Actions

Push this repository to GitHub. The workflow at `.github/workflows/ios-build.yml` runs on pushes to `main` or `master`, pull requests, and manual dispatch.

It creates an iOS Simulator build on a GitHub-hosted macOS runner and uploads the `.app` as an artifact.

**Important:** This workflow builds for the iOS Simulator, not a signed iPhone-installable IPA. Installing on a physical iPhone requires an appropriate Apple signing and distribution path. Do not put Apple certificates or private keys directly in the repository.

## Current limitation

The chat screen is a UI prototype. It does not run a model yet. The next milestone is integrating an on-device inference engine (for example, llama.cpp) and passing `buildSystemPrompt(settings)` to the model's chat-template/system-message interface.

## App identifier

The starter uses `com.example.pocketllm`. Change this to a unique bundle identifier before device distribution.
