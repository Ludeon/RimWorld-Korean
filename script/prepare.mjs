import * as fs from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'
import { ensureDir } from 'jsr:@std/fs'

import { AVAILABLE_DLCS } from './consts.mjs'

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

      // If EN contains XML tags (<li>s)
      if (trimmedEnContent.includes('\n')) {
        const lines = trimmedEnContent.split('\n')
        const processedLines = lines.map((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return ''

          // Only escape XML characters if this is a Keyed file
          const finalLine = isKeyedFile ? trimmedLine.replace(/</g, '&lt;').replace(/>/g, '&gt;') : trimmedLine
          return `${indent}  ${finalLine}`
        })
        const indentedEnContent = processedLines.join('\n')

        return `<!-- EN: ${enContent.trim()} -->\n${indent}${openTag}\n${indentedEnContent}\n${indent}${closeTag}`
      }

      // Only escape XML characters for simple content if this is a Keyed file
      const finalContent = isKeyedFile ? trimmedEnContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') : trimmedEnContent
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
