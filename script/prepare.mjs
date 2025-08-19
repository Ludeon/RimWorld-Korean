import * as fs from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'
import { ensureDir } from 'jsr:@std/fs'

import { AVAILABLE_DLCS } from './consts.mjs'

// Get RimWorld base path from environment (mirrors index.mjs behavior).
const getRimworldBasePath = () => {
  const rimworldPath = Deno.env.get('RIMWORLD_PATH')
  if (!rimworldPath) {
    console.warn(
      'RIMWORLD_PATH not set: skipping copy of English Strings from RimWorld installation. Set RIMWORLD_PATH to your RimWorld install directory if you want English sources copied.'
    )
    return null
  }

  return rimworldPath
}

/**
 * Copy English Strings from a real RimWorld installation into the prepared output
 * so out/<DLC>/Strings/English contains the original English files.
 */
const copyEnglishStringsForDLC = async (dlcName, outputDlcPath) => {
  const rimworldBase = getRimworldBasePath()
  if (!rimworldBase) return

  const gameDataPath = path.join(rimworldBase, 'Data')
  const englishStringsPath = path.join(gameDataPath, dlcName, 'Languages', 'English', 'Strings')
  const destPath = path.join(outputDlcPath, 'Strings')

  try {
    const stat = await Deno.stat(englishStringsPath)
    if (!stat.isDirectory) {
      console.warn(`${dlcName}: English Strings path exists but is not a directory: ${englishStringsPath}`)
      return
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.warn(`${dlcName}: English Strings not found at RimWorld install, skipping: ${englishStringsPath}`)
      return
    }
    throw e
  }

  try {
    await ensureDir(path.dirname(destPath))
    await fs.copy(englishStringsPath, destPath, { overwrite: true })
    console.log(`${dlcName}📥: Copied English Strings from game into ${path.relative(Deno.cwd(), destPath)}`)
  } catch (error) {
    console.error(`${dlcName}❌: Failed to copy English Strings:`, error)
  }
}

/**
 * Move <!-- EN: ... --> content into node's and remove <!-- UNUSED --> content
 */
const processXMLContent = (content, isKeyedFile = false) => {
  // First, remove everything after <!-- UNUSED --> comment, including preceding whitespace
  let result = content.replace(/\s*<!--\s*UNUSED\s*-->\s*[\s\S]*?(<\/LanguageData>)/, '\n\n$1')
  // Then process EN comments
  result = result.replace(
    /<!--\s*EN:\s*([\s\S]*?)\s*-->\s*\n(\s*)(<([^>\s]+)(?:\s[^>]*)?>)([\s\S]*?)(<\/\4>)/g,
    (_, enContent, indent, openTag, _tagName, __, closeTag) => {
      const trimmedEnContent = enContent.trim()

      const lines = trimmedEnContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l)
      const isList = lines.length > 0 && lines.every((line) => line.startsWith('<li>') && line.endsWith('</li>'))

      if (isList) {
        const processedLines = trimmedEnContent.split('\n').map((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return ''

          let finalLine
          if (isKeyedFile) {
            finalLine = trimmedLine.replace(/</g, '&lt;')
          } else {
            const content = trimmedLine.substring(4, trimmedLine.length - 5)
            const newContent = content.replace(/</g, '&lt;')
            finalLine = `<li>${newContent}</li>`
          }
          return `${indent}  ${finalLine}`
        })
        const indentedEnContent = processedLines.join('\n')

        return `<!-- EN: ${enContent.trim()} -->\n${indent}${openTag}\n${indentedEnContent}\n${indent}${closeTag}`
      }

      // For non-list content, collapse newlines into spaces and then apply XML escaping.
      const singleLineContent = trimmedEnContent.replace(/\s*\n\s*/g, ' ').trim()
      const finalContent = isKeyedFile
        ? singleLineContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : singleLineContent
      return `<!-- EN: ${trimmedEnContent} -->\n${indent}${openTag}${finalContent}${closeTag}`
    }
  )

  return result
}

/**
 * Process a single DLC
 */
const processDLCXMLFiles = async (dlcName, outputDir, basePath) => {
  const dlcPath = path.join(basePath, dlcName)
  const outputDlcPath = path.join(outputDir, dlcName)
  const startTime = Date.now()

  try {
    await Deno.stat(dlcPath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`${dlcName}⚠️: DLC folder not found, skipping`)
      return { dlc: dlcName, processed: 0, skipped: true, duration: 0 }
    }
    throw error
  }

  await ensureDir(outputDlcPath)
  let processedCount = 0

  console.log(`${dlcName}: Starting processing...`)

  for await (const entry of fs.walk(dlcPath, { includeFiles: true, includeDirs: false })) {
    if (!entry.path.endsWith('.xml')) {
      continue
    }

    const relativePath = path.relative(dlcPath, entry.path)

    // Skip XML files directly in the root folder (like LanguageInfo.xml)
    // Only files with no directory separator (directly in root)
    if (!relativePath.includes('/') && !relativePath.includes('\\')) {
      continue
    }

    const outputFilePath = path.join(outputDlcPath, relativePath)

    await ensureDir(path.dirname(outputFilePath))

    try {
      const content = await Deno.readTextFile(entry.path)
      // Check if this is a Keyed file
      const isKeyedFile = relativePath.includes('Keyed')
      const processedContent = processXMLContent(content, isKeyedFile)
      await Deno.writeTextFile(outputFilePath, processedContent)
      processedCount++

      if (processedCount % 100 === 0) {
        console.log(`${dlcName}📄: Processed ${processedCount} files...`)
      }
    } catch (error) {
      console.error(`${dlcName}❌: Error processing ${entry.path}:`, error)
    }
  }

  const stringsPath = path.join(dlcPath, 'Strings')
  const outputStringsPath = path.join(outputDlcPath, 'Strings')

  try {
    const stringsStats = await Deno.stat(stringsPath)
    if (stringsStats.isDirectory) {
      await fs.copy(stringsPath, outputStringsPath, { overwrite: true })
      // Also try to copy the game's English Strings into the output (if RIMWORLD_PATH is set)
      await copyEnglishStringsForDLC(dlcName, outputDlcPath)
    }
  } catch {
    //
  }

  const endTime = Date.now()
  const duration = endTime - startTime

  console.log(`${dlcName}✅: Completed - ${processedCount} files processed in ${duration}ms`)

  return { dlc: dlcName, processed: processedCount, skipped: false, duration }
}

export const prepare = async () => {
  const outputDir = path.join(Deno.cwd(), 'out')
  const basePath = Deno.cwd()

  // Clean and prepare output directory
  try {
    await Deno.remove(outputDir, { recursive: true })
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error
    }
  }
  await ensureDir(outputDir)

  try {
    const processingPromises = AVAILABLE_DLCS.map((dlc) => processDLCXMLFiles(dlc, outputDir, basePath))

    const results = await Promise.all(processingPromises)

    const totalProcessed = results.reduce((sum, result) => sum + result.processed, 0)

    console.log(`Total files processed: ${totalProcessed}`)
    results.forEach((result) => {
      if (result.skipped) {
        console.log(`  ${result.dlc}: Skipped`)
      } else {
        console.log(`  ${result.dlc}: ${result.processed} files`)
      }
    })
  } catch (error) {
    console.error('Error during processing:', error)
    throw error
  }
}
