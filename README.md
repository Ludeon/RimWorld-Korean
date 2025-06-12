# RimWorld-Korean

See this page for license info: http://ludeon.com/forums/index.php?topic=2933.0

See [CREDITS](./CREDITS) for list of current contributors. Contact [@alattalatta](https://github.com/alattalatta) for any inquiries.

## Discord

https://discord.gg/6PyAxGU

## Deno 스크립트

### 준비물

- [Deno](https://deno.land/)

### 번역 업데이트

1. `deno task cli download [--no-build]`로 다운로드
1. `deno task cli push`로 설치
1. RimWorld 실행 후 번역 파일 정리
1. `deno task cli pull`로 정리된 파일 가져오기

### 크레딧 업데이트

1. Crowdin 액세스 토큰 발급 (Reports 권한 필요, https://support.crowdin.com/enterprise/personal-access-tokens/)
1. `.crowdin.json`: `{ "host": "Crowdin 호스트 (마지막 슬래시 제외)", "token": "액세스 토큰" }`
1. `deno task cli credit [--no-report]`

### `LanguageWorker` 빌드

1. [.NET Framework 4.7.2 Developer Pack](https://dotnet.microsoft.com/download/dotnet-framework/net472)
1. [.NET CLI](https://docs.microsoft.com/ko-kr/dotnet/core/tools/)
1. `./LanguageWorker/libs/Assembly-CSharp.dll`
1. `deno task cli worker`
1. `./LanguageWorker.dll`

## Deno 없이 `LanguageWorker` 빌드 방법

1. [.NET Framework 4.7.2 Developer Pack](https://dotnet.microsoft.com/download/dotnet-framework/net472)
1. [.NET CLI](https://docs.microsoft.com/ko-kr/dotnet/core/tools/)
1. `./LanguageWorker/libs/Assembly-CSharp.dll`
1. `./LanguageWorker > dotnet build`
1. `./LanguageWorker/bin/Debug/net472/LanguageWorker.dll`
