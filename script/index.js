#!/usr/bin/node
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { execa } from 'execa'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
  .scriptName('cli')
  .command(
    'credit',
    'build a new LanguageInfo.xml with credits populated',
    (ins) => ins.help(),
    async () => {
      const buildLanguageInfo = (credits) => `<?xml version="1.0" encoding="utf-8"?>
<LanguageInfo>
  <friendlyNameNative>한국어</friendlyNameNative>
  <friendlyNameEnglish>Korean</friendlyNameEnglish>
  <canBeTiny>true</canBeTiny>
  <languageWorkerClass>LanguageWorker_Korean</languageWorkerClass>
  <credits>${credits}
  </credits>
</LanguageInfo>
`

      const buildCredit = (name) => `
    <li Class="CreditRecord_Role">
      <roleKey>Credit_Translator</roleKey>
      <creditee>${name}</creditee>
    </li>`

      const creditStream = fs.createReadStream(path.join(process.cwd(), 'CREDITS'))
      const rl = readline.createInterface({ input: creditStream, crlfDelay: Infinity })

      const builtCredits = []
      for await (const line of rl) {
        builtCredits.push(buildCredit(line))
      }

      const builtLanguageInfo = buildLanguageInfo(builtCredits.join(''))

      fs.writeFileSync(path.join(process.cwd(), 'Core/LanguageInfo.xml'), builtLanguageInfo)
    }
  )
  .command(
    'deploy',
    'deploy language data to RimWorld installation path',
    (ins) => ins.help(),
    async () => {}
  )
  .command(
    'worker',
    'build LanguageWorker_Korean',
    (ins) => ins.help(),
    async () => {
      await execa('dotnet', ['build', 'LanguageWorker'], { stdio: 'inherit' })

      const src = path.join(process.cwd(), 'LanguageWorker/bin/Debug/net472/LanguageWorker.dll')
      const dest = path.join(process.cwd(), 'LanguageWorker.dll')
      fs.copyFileSync(src, dest)
    }
  ).argv
