import * as fs from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'
import { ensureDir } from 'jsr:@std/fs'

import { AVAILABLE_DLCS } from './consts.mjs'

/**
 * XML 파일에서 <!-- EN: ... --> 주석의 내용을 바로 아래 XML 노드에 적용
 */
const processXMLContent = (content) => {
  const result = content.replace(
    /<!--\s*EN:\s*([\s\S]*?)\s*-->\s*\n(\s*)(<[^>\s]+(?:\s[^>]*)?>)([\s\S]*?)(<\/[^>]+>)/g,
    (_, enContent, indent, openTag, __, closeTag) => {
      const trimmedEnContent = enContent.trim()

      // If EN contains XML tags (<li>s)
      if (trimmedEnContent.includes('<') && trimmedEnContent.includes('>')) {
        const lines = trimmedEnContent.split('\n')
        const processedLines = lines.map((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return ''
          return `${indent}  ${trimmedLine}`
        })
        const indentedEnContent = processedLines.join('\n')

        return `<!-- EN: ${enContent.trim()} -->\n${indent}${openTag}\n${indentedEnContent}\n${indent}${closeTag}`
      }

      return `<!-- EN: ${trimmedEnContent} -->\n${indent}${openTag}${trimmedEnContent}${closeTag}`
    }
  )

  return result
}

const processDLCXMLFiles = async (dlcName, outputDir) => {
  const dlcPath = path.join(Deno.cwd(), dlcName)
  const outputDlcPath = path.join(outputDir, dlcName)

  try {
    await Deno.stat(dlcPath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`DLC folder not found, skipping: ${dlcName}`)
      return
    }
    throw error
  }

  await ensureDir(outputDlcPath)

  for await (const entry of fs.walk(dlcPath, { includeFiles: true, includeDirs: false })) {
    if (!entry.path.endsWith('.xml')) {
      continue
    }

    const relativePath = path.relative(dlcPath, entry.path)
    const outputFilePath = path.join(outputDlcPath, relativePath)

    await ensureDir(path.dirname(outputFilePath))

    try {
      const content = await Deno.readTextFile(entry.path)
      const processedContent = processXMLContent(content)
      await Deno.writeTextFile(outputFilePath, processedContent)

      console.log(`Processed: ${relativePath}`)
    } catch (error) {
      console.error(`Error processing ${entry.path}:`, error)
    }
  }
}

export const prepare = async () => {
  const outputDir = path.join(Deno.cwd(), 'out')

  try {
    await Deno.remove(outputDir, { recursive: true })
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error
    }
  }
  await ensureDir(outputDir)

  for (const dlc of AVAILABLE_DLCS) {
    console.log(`Processing DLC: ${dlc}`)
    await processDLCXMLFiles(dlc, outputDir)
  }
}
