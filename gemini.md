# Deno Refactor TODO List for index.mjs

## Phase 1: Initial Setup & Core Changes

- [x] Initialize `gemini.md` with this TODO list.
- [x] Change shebang from `#!/usr/bin/node` to `#!/usr/bin/env -S deno run --allow-all` (또는 더 구체적인 권한 사용).
- [x] Replace Node.js specific global objects:
  - [x] `process.argv` -> Deno argument parsing (e.g. `Deno.args` or `std/cli`).
  - [x] `process.cwd()` -> `Deno.cwd()`.
- [x] Replace `createRequire(import.meta.url)` for JSON imports with Deno's direct JSON import (`import data from './file.json' assert { type: 'json' }`) or `JSON.parse(await Deno.readTextFile(...))`.

## Phase 2: Dependency Replacement

- [x] `node:path` (`path`) -> `https://deno.land/std/path/mod.ts`.
- [x] `node:stream/promises` (`pipeline`) -> Deno stream APIs (e.g., `readableStream.pipeTo(writableStream)` or `copy` from `https://deno.land/std/streams/copy.ts`).
- [x] `execa` -> `Deno.Command`.
- [x] `fs-extra` -> `https://deno.land/std/fs/mod.ts`.
- [x] `got` -> `fetch`.
- [x] `rimraf` -> `Deno.remove(path, { recursive: true })`.
- [ ] `steam-game-path` -> Deno에서 사용 가능한 대안 조사 및 교체:
  - [ ] **LATEST:** Attempting to import directly using `npm:steam-game-path`.
- [x] `unzipper` -> Deno 압축 해제 라이브러리:
  - [x] **LATEST:** Used `https://deno.land/std/archive/unzip.ts`. This involves fetching the zip, saving to a temporary file, and then extracting.
- [x] `yargs` and `yargs/helpers` -> `https://deno.land/std/cli/mod.ts` (specifically `parseArgs` from `https://deno.land/std/cli/parse_args.ts`).

## Phase 3: Command Logic Refactoring

- [ ] `clearTranslations` 함수 리팩토링:
  - [ ] `steam-game-path` 교체 적용 (using `npm:steam-game-path`).
- [x] `yargs` 명령어 구조를 `std/cli`를 사용하도록 리팩토링:
  - [x] Define command structure and argument parsing using `parseArgs`.
  - [x] Implement main command dispatcher (if/else or switch on parsed command).
  - [x] **`credit` 명령어:**
    - [x] 인자 파싱 업데이트 (user has already refactored internals).
    - [x] `.crowdin.json` 파일 import 방식 변경 (user has already refactored).
    - [x] `got` 호출을 `fetch`로 교체 (user has already refactored).
    - [x] `fs.writeFile` 및 `fs.readFile`을 Deno API로 교체 (user has already refactored).
    - [x] Adapt to `std/cli` argument passing.
  - [x] **`clear` 명령어:**
    - [x] 리팩토링된 `clearTranslations`를 올바르게 호출하는지 확인.
    - [x] Adapt to `std/cli` argument passing.
  - [x] **`download` 명령어:**
    - [x] 인자 파싱 업데이트 (user has already refactored internals).
    - [x] `.crowdin.json` 파일 import 방식 변경 (user has already refactored).
    - [x] `got` 호출을 `fetch`로 교체 (user has already refactored).
    - [x] `rimraf` 호출 교체: Implemented selective deletion for `Core` directory (preserve `LanguageInfo.xml`, `LangIcon.png`).
    - [x] `unzipper` 로직 교체 (스트리밍 다운로드 및 압축 해제 using `std/archive/unzip.ts`).
    - [x] Adapt to `std/cli` argument passing.
  - [ ] **`pull` 명령어:**
    - [ ] `steam-game-path` 교체 적용 (using `npm:steam-game-path`).
    - [x] `fs.remove`, `fs.ensureDir`, `fs.readdirSync`, `fs.copy`를 Deno API로 교체 (user has already refactored).
    - [x] Adapt to `std/cli` argument passing.
  - [ ] **`push` 명령어:**
    - [ ] 리팩토링된 `clearTranslations`를 올바르게 호출하는지 확인.
    - [ ] `steam-game-path` 교체 적용 (using `npm:steam-game-path`).
    - [x] `fs.remove`, `fs.ensureDir`, `fs.readdirSync`, `fs.copy`를 Deno API로 교체 (user has already refactored).
    - [x] Adapt to `std/cli` argument passing.
  - [x] **`worker` 명령어:**
    - [x] 인자 파싱 업데이트 (user has already refactored internals).
    - [x] `execa`를 `Deno.Command`로 교체 (user has already refactored).
    - [x] `fs.copyFileSync`를 Deno API로 교체 (user has already refactored).
    - [x] Adapt to `std/cli` argument passing.

## Phase 4: Finalization & Testing

- [ ] 모든 변경 사항의 정확성 및 Deno 권장 사항 준수 여부 검토.
- [x] Shebang 또는 실행 명령어에 필요한 Deno 권한 추가 (`--allow-all` 사용 중, 필요한 경우 더 구체적인 권한 검토).
- [ ] 각 명령어 철저히 테스트.
- [ ] 새로운 발견 사항이나 완료된 작업으로 `gemini.md` 업데이트.
