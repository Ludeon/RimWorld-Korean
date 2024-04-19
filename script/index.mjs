#!/usr/bin/node
import { createRequire } from 'node:module'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import { execa } from 'execa'
import fs from 'fs-extra'
import got from 'got'
import { rimraf } from 'rimraf'
import { getGamePath } from 'steam-game-path'
import unzipper from 'unzipper'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const AVAILABLE_DLCS = ['Core', 'Royalty', 'Ideology', 'Biotech', 'Anomaly']

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const clearTranslations = async () => {
  const gamePath = path.join(getGamePath(294100).game.path, 'Data')

  return Promise.all(
    AVAILABLE_DLCS.map((dlc) => {
      const dlcLangPath = path.join(gamePath, dlc, 'Languages')

      return rimraf(`${dlcLangPath}/*.tar`, { glob: true })
    })
  )
}

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
  .command('clear', 'clear all language files from RimWorld', (ins) => ins.help(), clearTranslations)
  .command(
    'download',
    'download Crowdin build',
    (ins) =>
      ins
        .option('build', {
          boolean: true,
          default: true,
          description: 'Generate a new build. Set this to false to use existing builds.',
        })
        .help(),
    async (argv) => {
      const require = createRequire(import.meta.url)
      const { host, token } = require(path.join(process.cwd(), '.crowdin.json'))

      let needNewBuild = argv.build
      let lastBuildID

      while (true) {
        if (needNewBuild) {
          console.log('Requesting build...')

          lastBuildID = await got
            .post(`${host}/api/v2/projects/2/translations/builds`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              json: {
                targetLanguageIds: ['ko'],
              },
            })
            .json()
            .then((res) => res.data.id)
          break
        }

        const maybeLastBuildID = await got
          .get(`${host}/api/v2/projects/2/translations/builds`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .json()
          .then((res) => res.data.find((build) => build.data.attributes.targetLanguageIds.length === 1)?.data.id)

        if (maybeLastBuildID) {
          lastBuildID = maybeLastBuildID
          break
        }

        console.log('No previous build found.')
        needNewBuild = true
      }

      console.log(`Build ID was ${lastBuildID}.`)

      while ((await timeout(1000), true)) {
        const response = await got.get(`${host}/api/v2/projects/2/translations/builds/${lastBuildID}/download`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const body = JSON.parse(response.body)

        if (response.statusCode === 202) {
          const progress = body.data.progress
          console.log(`${progress}%...`)
          continue
        }

        const downloadURL = body.data.url

        console.log('Clearing existing files...')
        await Promise.all([
          rimraf(path.join(process.cwd(), 'Core'), {
            filter: (p) => !p.endsWith('LanguageInfo.xml') && !p.endsWith('LangIcon.png'),
          }),
          ...AVAILABLE_DLCS.slice(1).map((dlc) => rimraf(path.join(process.cwd(), dlc))),
        ])

        console.log('Extracting...')

        // unzipper.Extract is broken (at least on Windows), need to Parse and write manually
        const stream = got.stream(downloadURL).pipe(unzipper.Parse({ forceStream: true }))
        for await (const entry of stream) {
          const fileName = entry.path
          const type = entry.type

          if (type === 'Directory') {
            await fs.ensureDir(path.join(process.cwd(), fileName))
            continue
          }

          await pipeline(entry, fs.createWriteStream(path.join(process.cwd(), fileName)))
        }

        break
      }
    }
  )
  .command(
    'pull',
    'pull language data from RimWorld installation path',
    (ins) => ins.help(),
    () => {
      const gamePath = path.join(getGamePath(294100).game.path, 'Data')

      return Promise.all(
        AVAILABLE_DLCS.map(async (dlc) => {
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
    'push',
    'push language data to RimWorld installation path',
    (ins) => ins.help(),
    async () => {
      await clearTranslations()

      const gamePath = path.join(getGamePath(294100).game.path, 'Data')

      return Promise.all(
        AVAILABLE_DLCS.map(async (dlc) => {
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
