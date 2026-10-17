import * as fs from 'jsr:@std/fs'
import { ensureDir } from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'

import { AVAILABLE_DLCS } from './consts.mjs'

const MOD_FOLDER_NAME = 'KoreanTranslationCleaner'
const MOD_PACKAGE_ID = 'latta.koreantranslationcleaner'
const LANG_FOLDER_NAME = 'Korean (한국어)'
const RESULT_FILE_NAME = 'ko-cleanup-result.txt'
const TIMEOUT_MS = 15 * 60 * 1000

const DLC_PACKAGE_IDS = AVAILABLE_DLCS.map((dlc) =>
  dlc === 'Core' ? 'ludeon.rimworld' : `ludeon.rimworld.${dlc.toLowerCase()}`
)

const buildMod = async (rimworldBasePath) => {
  const command = new Deno.Command('dotnet', {
    args: ['build', 'Cleaner', `-p:RimWorldPath=${rimworldBasePath}`],
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const { code } = await command.output()
  if (code !== 0) {
    throw new Error(`dotnet build failed with code ${code}`)
  }
}

const buildModsConfig = (version) => `<?xml version="1.0" encoding="utf-8"?>
<ModsConfigData>
  <version>${version}</version>
  <activeMods>
${[...DLC_PACKAGE_IDS, MOD_PACKAGE_ID].map((id) => `    <li>${id}</li>`).join('\n')}
  </activeMods>
  <knownExpansions>
${DLC_PACKAGE_IDS.slice(1).map((id) => `    <li>${id}</li>`).join('\n')}
  </knownExpansions>
</ModsConfigData>
`

// Reuse the user's own Prefs.xml (window size, etc.) but force the language to Korean
const buildPrefs = async () => {
  const userConfigPath = path.join(
    Deno.env.get('USERPROFILE') ?? '',
    'AppData/LocalLow/Ludeon Studios/RimWorld by Ludeon Studios/Config/Prefs.xml'
  )
  const langNode = `<langFolderName>${LANG_FOLDER_NAME}</langFolderName>`

  try {
    const prefs = await Deno.readTextFile(userConfigPath)
    if (/<langFolderName>.*?<\/langFolderName>/.test(prefs)) {
      return prefs.replace(/<langFolderName>.*?<\/langFolderName>/, langNode)
    }
    return prefs.replace('</PrefsData>', `  ${langNode}\n</PrefsData>`)
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e
    return `<?xml version="1.0" encoding="utf-8"?>\n<PrefsData>\n  ${langNode}\n</PrefsData>\n`
  }
}

const runGame = async (rimworldBasePath, saveDataPath) => {
  const child = new Deno.Command(path.join(rimworldBasePath, 'RimWorld.exe'), {
    args: [`-savedatafolder=${saveDataPath}`, '-ko-cleanup'],
    cwd: rimworldBasePath,
    stdout: 'null',
    stderr: 'null',
  }).spawn()

  const timer = setTimeout(() => {
    console.error(`RimWorld did not exit within ${TIMEOUT_MS / 60000} minutes, killing it`)
    child.kill()
  }, TIMEOUT_MS)

  try {
    return await child.status
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run RimWorld's "Clean up translation files" on the pushed translation without touching the game manually.
 * Installs a tiny helper mod, launches the game with an isolated save data folder, and waits for it to quit.
 */
export const cleanup = async (rimworldBasePath) => {
  console.log('Building cleaner mod...')
  await buildMod(rimworldBasePath)

  const modPath = path.join(rimworldBasePath, 'Mods', MOD_FOLDER_NAME)
  const saveDataPath = await Deno.makeTempDir({ prefix: 'rimworld_cleanup_' })

  try {
    await fs.copy(path.join(Deno.cwd(), 'Cleaner/Mod'), modPath, { overwrite: true })

    const version = (await Deno.readTextFile(path.join(rimworldBasePath, 'Version.txt'))).trim()
    const configPath = path.join(saveDataPath, 'Config')
    await ensureDir(configPath)
    await Deno.writeTextFile(path.join(configPath, 'ModsConfig.xml'), buildModsConfig(version))
    await Deno.writeTextFile(path.join(configPath, 'Prefs.xml'), await buildPrefs())

    console.log('Launching RimWorld for cleanup, the game will quit by itself when done...')
    const startTime = Date.now()
    const status = await runGame(rimworldBasePath, saveDataPath)
    console.log(`RimWorld exited with code ${status.code} after ${Math.round((Date.now() - startTime) / 1000)}s`)

    let result
    try {
      result = (await Deno.readTextFile(path.join(saveDataPath, RESULT_FILE_NAME))).trim()
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e
      throw new Error(`Cleanup did not report a result. Check the log in ${saveDataPath}`)
    }

    if (!result.startsWith('ok')) {
      throw new Error(`Cleanup failed: ${result}`)
    }
    console.log(`Cleanup done (${result})`)

    await Deno.remove(saveDataPath, { recursive: true })
  } finally {
    await Deno.remove(modPath, { recursive: true }).catch((e) => {
      if (!(e instanceof Deno.errors.NotFound)) throw e
    })
  }
}
