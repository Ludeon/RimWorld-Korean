#!/usr/bin/node
import path from 'node:path'
import readline from 'node:readline'

import { execa } from 'execa'
import fs from 'fs-extra'
import { getGamePath } from 'steam-game-path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const AVAILABLE_DLCS = ['Core', 'Royalty', 'Ideology', 'Biotech']
const AVAILABLE_TRANSLATIONS = ['Core', 'Royalty', 'Ideology']

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
    'clear',
    'clear all language files from RimWorld',
    (ins) => ins.help(),
    () => {
      const gamePath = path.join(getGamePath(294100).game.path, 'Data')

      return Promise.all(
        AVAILABLE_DLCS.map((dlc) => {
          const dlcLangPath = path.join(gamePath, dlc, 'Languages')

          // get all tar files
          const tarFiles = fs.readdirSync(dlcLangPath).filter((file) => file.endsWith('.tar'))

          // remove them all
          return Promise.all(
            tarFiles.map((tarFile) => fs.remove(path.join(dlcLangPath, tarFile)))
          )
        })
      )
    }
  )
  .command(
    'deploy',
    'deploy language data to RimWorld installation path',
    (ins) => ins.help(),
    () => {
      const gamePath = path.join(getGamePath(294100).game.path, 'Data')

      return Promise.all(
        AVAILABLE_TRANSLATIONS.map(async (dlc) => {
          const sourcePath = path.join(process.cwd(), dlc)
          const dlcLangPath = path.join(gamePath, dlc, 'Languages/Korean (한국어)')

          await fs.remove(dlcLangPath)
          await fs.ensureDir(dlcLangPath)

          // get all files and directories of sourcePath
          const entries = fs.readdirSync(sourcePath)

          // copy them under dlcLangPath
          return Promise.all(entries.map((name) => fs.copy(path.join(sourcePath, name), path.join(dlcLangPath, name))))
        })
      )
    }
  )
  .command(
    'pull',
    'pull language data from RimWorld installation path',
    (ins) => ins.help(),
    () => {
      const gamePath = path.join(getGamePath(294100).game.path, 'Data')

      return Promise.all(
        AVAILABLE_TRANSLATIONS.map(async (dlc) => {
          const sourcePath = path.join(gamePath, dlc, 'Languages/Korean (한국어)')
          const translationPath = path.join(process.cwd(), dlc)

          await fs.remove(translationPath)
          await fs.ensureDir(translationPath)

          // get all files and directories of sourcePath
          const entries = fs.readdirSync(sourcePath)

          // copy them under translationPath
          return Promise.all(entries.map((name) => fs.copy(path.join(sourcePath, name), path.join(translationPath, name))))
        }
      ))
    }
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
