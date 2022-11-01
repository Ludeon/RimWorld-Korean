#!/usr/bin/node
import path from 'node:path'
import readline from 'node:readline'

import { execa } from 'execa'
import fs from 'fs-extra'
import got from 'got'
import { getGamePath } from 'steam-game-path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createRequire } from 'node:module'

const AVAILABLE_DLCS = ['Core', 'Royalty', 'Ideology', 'Biotech']
const AVAILABLE_TRANSLATIONS = ['Core', 'Royalty', 'Ideology']

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

yargs(hideBin(process.argv))
  .scriptName('cli')
  .command(
    'credit',
    'automatically populate CREDITS and LanguageInfo.xml',
    (ins) =>
      ins
        .option('report', {
          boolean: true,
          default: true,
          description: 'Generate a new report. Set this to false to use existing CREDITS.',
        })
        .help(),
    async (argv) => {
      const require = createRequire(import.meta.url)
      const { host, token } = require(path.join(process.cwd(), '.crowdin.json'))

      if (argv.report) {
        console.log('Requesting report generation...')

        const identifier = await got
          .post(`${host}/api/v2/projects/2/reports`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            json: {
              name: 'top-members',
              schema: {
                languageId: 'ko',
                format: 'json',
              },
            },
          })
          .json()
          .then((res) => res.data.identifier)

        console.log(`Waiting for report ${identifier} to generate...`)

        while ((await timeout(1000), true)) {
          const status = await got
            .get(`${host}/api/v2/projects/2/reports/${identifier}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
            .json()
            .then((res) => res.data.status)

          if (status === 'finished') {
            break
          }

          console.log('retrying...')
        }

        console.log(`Downloading report ${identifier}...`)

        const downloadURL = await got
          .get(`${host}/api/v2/projects/2/reports/${identifier}/download`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .json()
          .then((res) => res.data.url)

        const names = await got
          .get(downloadURL)
          .json()
          // Holy Moly (holymoly) => Holy Moly
          .then((res) => res.data.map((data) => data.user.fullName.replace(/\s\(.+\)/, '')))

        console.log('Writing CREDITS...')

        await fs.writeFile(path.join(process.cwd(), 'CREDITS'), names.join('\n'))
      }

      console.log('Writing LanguageInfo.xml...')

      const names = await fs.readFile(path.join(process.cwd(), 'CREDITS'), 'utf-8').then((res) => res.split('\n'))

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

      const creditEntries = names.map(buildCredit).join('')
      const builtLanguageInfo = buildLanguageInfo(creditEntries)

      return fs.writeFile(path.join(process.cwd(), 'Core/LanguageInfo.xml'), builtLanguageInfo)
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
          return Promise.all(tarFiles.map((tarFile) => fs.remove(path.join(dlcLangPath, tarFile))))
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
          return Promise.all(
            entries.map((name) => fs.copy(path.join(sourcePath, name), path.join(translationPath, name)))
          )
        })
      )
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
