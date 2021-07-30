# RimWorld-Korean

See this page for license info: http://ludeon.com/forums/index.php?topic=2933.0

See [CREDITS](./CREDITS) for list of current contributors. Contact [@alattalatta](https://github.com/alattalatta) for any inquiries.

## Discord

https://discord.gg/6PyAxGU

## 크레딧 업데이트 방법

1. [Node.js](https://nodejs.org/en/)
1. `> npm i`
1. `CREDITS` 편집
1. `> npm run cli credit`

## `LanguageWorker` 빌드 방법

1. [.NET Framework 4.7.2 Developer Pack](https://dotnet.microsoft.com/download/dotnet-framework/net472)
1. [.NET CLI](https://docs.microsoft.com/ko-kr/dotnet/core/tools/)
1. `./LanguageWorker/libs/Assembly-CSharp.dll`
1. `./LanguageWorker > dotnet build`
1. `./LanguageWorker/bin/Debug/net472/LanguageWorker.dll`

### Node.js 설치했을 때

1. `> npm run cli worker`
1. `./LanguageWorker.dll`