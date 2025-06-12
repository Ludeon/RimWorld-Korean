import 'jsr:@std/dotenv/load'

import { parseArgs } from 'jsr:@std/cli'
import * as fs from 'jsr:@std/fs'
import { ensureDir } from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'
import * as zip from 'jsr:@zip-js/zip-js'

const AVAILABLE_DLCS = ['Core', 'Royalty', 'Ideology', 'Biotech', 'Anomaly']

const getRimworldBasePath = () => {
  const rimworldPath = Deno.env.get('RIMWORLD_PATH')
  if (!rimworldPath) {
    console.error(
      'Error: Could not determine RimWorld game path. Please ensure Steam is running and RimWorld is installed, or set the RIMWORLD_PATH environment variable to your RimWorld installation directory (e.g., C:\\\\Program Files (x86)\\\\Steam\\\\steamapps\\\\common\\\\RimWorld).'
    )
    Deno.exit(1)
  }

  return rimworldPath
}

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const clearTranslations = () => {
  const rimworldBasePath = getRimworldBasePath()
  const gameDataPath = path.join(rimworldBasePath, 'Data')

  return Promise.all(
    AVAILABLE_DLCS.map(async (dlc) => {
      const dlcLangPath = path.join(gameDataPath, dlc, 'Languages')

      for await (const dirEntry of Deno.readDir(dlcLangPath)) {
        if (dirEntry.name === 'Korean (한국어)' || dirEntry.isFile) {
          await Deno.remove(path.join(dlcLangPath, dirEntry.name), { recursive: true })
        }
      }
    })
  )
}

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

const writeCredits = async (names) => {
  await Deno.writeTextFile(path.join(Deno.cwd(), 'CREDITS'), names.join('\n'))
}

const writeLanguageInfo = async (names) => {
  const creditEntries = names.map(buildCredit).join('')
  const builtLanguageInfo = buildLanguageInfo(creditEntries)
  await ensureDir(path.dirname(path.join(Deno.cwd(), 'Core/LanguageInfo.xml')))
  await Deno.writeTextFile(path.join(Deno.cwd(), 'Core/LanguageInfo.xml'), builtLanguageInfo)
}

const downloadReport = async (host, token, identifier) => {
  const response = await fetch(`${host}/api/v2/projects/2/reports/${identifier}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()
  return data.data.url
}

const fetchReportStatus = async (host, token, identifier) => {
  const response = await fetch(`${host}/api/v2/projects/2/reports/${identifier}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()
  return data.data.status
}

const generateReport = async (host, token) => {
  const response = await fetch(`${host}/api/v2/projects/2/reports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'top-members',
      schema: {
        languageId: 'ko',
        format: 'json',
      },
    }),
  })
  const data = await response.json()
  return data.data.identifier
}

const downloadBuild = async (host, token, buildID) => {
  const response = await fetch(`${host}/api/v2/projects/2/translations/builds/${buildID}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()
  return data.data.url
}

const fetchBuildStatus = async (host, token, buildID) => {
  const response = await fetch(`${host}/api/v2/projects/2/translations/builds/${buildID}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()
  return data.data.status
}

const requestBuild = async (host, token) => {
  const response = await fetch(`${host}/api/v2/projects/2/translations/builds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetLanguageIds: ['ko'],
    }),
  })
  const data = await response.json()
  return data.data.id
}

const pullLanguageData = async (dlc) => {
  const rimworldBasePath = getRimworldBasePath()
  const gameDataPath = path.join(rimworldBasePath, 'Data')
  const sourcePath = path.join(gameDataPath, dlc, 'Languages/Korean (한국어)')
  const translationPath = path.join(Deno.cwd(), dlc)

  await Deno.remove(translationPath, { recursive: true }).catch((e) => {
    if (!(e instanceof Deno.errors.NotFound)) throw e
  })
  await Deno.mkdir(translationPath, { recursive: true })

  const entries = []
  try {
    for await (const dirEntry of Deno.readDir(sourcePath)) {
      entries.push(dirEntry.name)
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`Source directory not found, skipping pull for DLC ${dlc}: ${sourcePath}`)
      return
    }
    throw error
  }

  return Promise.all(
    entries.map((name) => fs.copy(path.join(sourcePath, name), path.join(translationPath, name), { overwrite: true }))
  )
}

const pushLanguageData = async (dlc) => {
  const rimworldBasePath = getRimworldBasePath()
  const gameDataPath = path.join(rimworldBasePath, 'Data')
  const sourcePath = path.join(Deno.cwd(), dlc)
  const dlcLangPath = path.join(gameDataPath, dlc, 'Languages/Korean (한국어)')

  await Deno.remove(dlcLangPath, { recursive: true }).catch((e) => {
    if (!(e instanceof Deno.errors.NotFound)) throw e
  })
  await Deno.mkdir(dlcLangPath, { recursive: true })

  const entries = []
  try {
    for await (const dirEntry of Deno.readDir(sourcePath)) {
      entries.push(dirEntry.name)
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`Source directory not found, skipping push for DLC ${dlc}: ${sourcePath}`)
      return
    }
    throw error
  }

  return Promise.all(
    entries.map((name) => fs.copy(path.join(sourcePath, name), path.join(dlcLangPath, name), { overwrite: true }))
  )
}

const buildWorker = async () => {
  const command = new Deno.Command('dotnet', {
    args: ['build', 'LanguageWorker'],
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const { code } = await command.output()
  if (code !== 0) {
    throw new Error(`dotnet build failed with code ${code}`)
  }

  const src = path.join(Deno.cwd(), 'LanguageWorker/bin/Debug/net472/LanguageWorker.dll')
  const dest = path.join(Deno.cwd(), 'LanguageWorker.dll')
  await Deno.copyFile(src, dest)
}

const main = async () => {
  const crowdinHost = Deno.env.get('CROWDIN_HOST')
  const crowdinToken = Deno.env.get('CROWDIN_TOKEN')
  if (!crowdinHost || !crowdinToken) {
    console.error('Error: CROWDIN_HOST and CROWDIN_TOKEN environment variables must be set.')
    Deno.exit(1)
  }

  const args = parseArgs(Deno.args)

  const command = args._[0]

  if (command === 'credit') {
    if (args.report) {
      const identifier = await generateReport(crowdinHost, crowdinToken)

      console.log(`Waiting for report ${identifier} to generate...`)

      while ((await timeout(1000), true)) {
        const status = await fetchReportStatus(crowdinHost, crowdinToken, identifier)
        if (status === 'finished') break
      }

      console.log(`Downloading report ${identifier}...`)

      const downloadURL = await downloadReport(crowdinHost, crowdinToken, identifier)
      const reportResponse = await fetch(downloadURL)
      const reportData = await reportResponse.json()
      const names = reportData.data.map((data) => data.user.fullName.replace(/\s\(.+\)/, ''))

      await writeCredits(names)
    }

    const creditsContent = await Deno.readTextFile(path.join(Deno.cwd(), 'CREDITS'))
    const namesFromCredits = creditsContent.split('\n')
    await writeLanguageInfo(namesFromCredits)
  } else if (command === 'clear') {
    await clearTranslations()
  } else if (command === 'download') {
    let lastBuildID

    if (args.build) {
      console.log('Requesting new build...')
      lastBuildID = await requestBuild(crowdinHost, crowdinToken)
    } else {
      console.log('Fetching existing builds...')
      const buildsResponse = await fetch(`${crowdinHost}/api/v2/projects/2/translations/builds`, {
        headers: { Authorization: `Bearer ${crowdinToken}` },
      })
      const buildsData = await buildsResponse.json()
      const latestBuild = buildsData.data.find((build) => build.data.attributes.targetLanguageIds.length === 1)
      if (latestBuild) {
        lastBuildID = latestBuild.data.id
      } else {
        console.log('No previous build found. Requesting a new build...')
        lastBuildID = await requestBuild(crowdinHost, crowdinToken)
      }
    }

    console.log(`Using build ID: ${lastBuildID}. Waiting for build to finish...`)

    let downloadURL
    while (true) {
      await timeout(2000)
      const buildStatusResponse = await fetch(
        `${crowdinHost}/api/v2/projects/2/translations/builds/${lastBuildID}/download`,
        {
          headers: { Authorization: `Bearer ${crowdinToken}` },
        }
      )
      const statusData = await buildStatusResponse.json()

      if (buildStatusResponse.status === 202 || (statusData.data && statusData.data.progress < 100)) {
        console.log(`Build progress: ${statusData.data.progress}%...`)
        continue
      }

      if (buildStatusResponse.status === 200 && statusData.data && statusData.data.url) {
        downloadURL = statusData.data.url
        break
      }

      console.log('Unexpected build status response:', statusData)
      throw new Error('Failed to get download URL for the build.')
    }

    const corePath = path.join(Deno.cwd(), 'Core')
    for await (const entry of Deno.readDir(corePath)) {
      const entryPath = path.join(corePath, entry.name)
      if (entry.name !== 'LangIcon.png' && entry.name !== 'LanguageInfo.xml') {
        await Deno.remove(entryPath, { recursive: true })
      }
    }

    await Promise.all(
      AVAILABLE_DLCS.slice(1).map(async (dlc) => {
        try {
          await Deno.remove(path.join(Deno.cwd(), dlc), { recursive: true })
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e
        }
      })
    )

    console.log('Downloading and extracting archive...')
    const zipResponse = await fetch(downloadURL)
    if (!zipResponse.body) {
      throw new Error('Failed to get readable stream from download URL')
    }

    const tempZipFilePath = await Deno.makeTempFile({ prefix: 'rimworld_translation_', suffix: '.zip' })
    const tempZipFile = await Deno.open(tempZipFilePath, { write: true, create: true })
    await zipResponse.body.pipeTo(tempZipFile.writable)

    const zipFileData = await Deno.readFile(tempZipFilePath)
    const blobReader = new zip.BlobReader(new Blob([zipFileData]))
    const zipReader = new zip.ZipReader(blobReader)
    const entries = await zipReader.getEntries()
    const destinationPath = Deno.cwd()

    for (const entry of entries) {
      const entryPath = path.join(destinationPath, entry.filename)
      if (entry.directory) {
        await ensureDir(entryPath)
      } else {
        await ensureDir(path.dirname(entryPath))
        const writer = new zip.Uint8ArrayWriter()
        const data = await entry.getData(writer)
        await Deno.writeFile(entryPath, data)
      }
    }
    await zipReader.close()
    await Deno.remove(tempZipFilePath)
  } else if (command === 'pull') {
    await Promise.all(
      AVAILABLE_DLCS.map(async (dlc) => {
        console.log(`Pulling for ${dlc}`)
        await pullLanguageData(dlc)
      })
    )
  } else if (command === 'push') {
    await clearTranslations()
    await Promise.all(
      AVAILABLE_DLCS.map(async (dlc) => {
        console.log(`Pushing for ${dlc}`)
        await pushLanguageData(dlc)
      })
    )
  } else if (command === 'worker') {
    await buildWorker()
  } else {
    console.log('Available commands: credit, clear, download, pull, push, worker')
  }
}

main().catch((err) => {
  console.error('Script failed:', err)
  Deno.exit(1)
})
