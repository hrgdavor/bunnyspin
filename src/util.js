import { $ } from "bun";
import { existsSync } from "node:fs";

export const isDocker = existsSync('/.dockerenv')
export const WELCOME_FILE_FISH = '/root/.config/fish/functions/fish_greeting.fish'

/**
 * @template T
 * @param {T[]} arr - The source array
 * @param {number} index - The starting index
 * @param {number} deleteCount - Number of elements to remove
 * @param {...T} toAdd - Variadic string arguments to insert
 * @returns {T[]} A new array of the same type as the input
 */
function cloneSplice(arr, index, deleteCount, ...toAdd) {
  let out = arr.slice()
  out.splice(index,deleteCount,...toAdd)
  return out;
}

/** Change a value in config file
 *
 * @param {Array<string>} lines
 * @param {object} values
 * @returns {Array<string>}
 */
export function changeConfigValues(lines, values, comment = '#') {
  for (let key in values) {
    lines = changeConfigValue(lines, key, values[key], comment)
  }
  return lines
}

export function changeConfigLines(lines, values, comment = '#', commentValues = []) {
  let arr = changeConfigValues(lines, values, comment)
  commentValues?.forEach?.(key=>arr = commentConfigValue(arr,key,comment))
  return arr
}

export async function changeConfigFile(path, values, comment = '#', commentValues = []) {
  let lines = changeConfigLines(await readLines(path),values, comment, commentValues)
  await Bun.write(path, lines.join('\n'))
}

/** Change a value in config file
 *
 * @param {Array<string>} lines
 * @param {string} key
 * @param {string} value
 * @returns {Array<string>}
 */
export function changeConfigValue(lines, key, value, comment = ';') {
  let {valuePos, isComment} = findConfigKey(lines, key, comment)
  const line = `${key}=${value}`
  if (valuePos == -1) valuePos = lines.length
  return cloneSplice(lines, valuePos, isComment ? 0 : 1, line)
}

export function findConfigKey(lines, key, comment=';') {
  let valuePos = -1;
  let isComment = false;
  let out = []
  for (let i = 0; i < lines.length; i++){
    let line = lines[i].trim()
    const isCommentTmp = line.startsWith(comment)
    if (isCommentTmp) {
      line = line.substring(1).trim()
    }
    if(line.startsWith(key)){
      line = line.substring(key.length).trim()
      if (line.startsWith('=')) {
        isComment = isCommentTmp
        valuePos = isComment ? i+1 : i
        if (!isComment) break
      }
    }
  }
  return {valuePos, isComment}
}

/** Change a value in config file
 *
 * @param {Array<string>} lines
 * @param {string} key
 * @param {string} value
 * @returns {Array<string>}
 */
export function commentConfigValue(lines, key, comment = '#') {
  let {valuePos, isComment} = findConfigKey(lines, key, comment)
  if (valuePos == -1) return lines
  if (isComment) return lines
  return cloneSplice(lines, valuePos, 1, comment + lines[valuePos])
}

export function addWelcomeMessage(lines, newText) {
  let valuePos = -1;

  for (let i = 0; i < lines.length; i++){
    let line = lines[i].trim()
    if(line.includes('change this welcome message') ) valuePos = i-1
  }
  if (valuePos == -1) valuePos = lines.length
  return cloneSplice(lines, valuePos, 0, ...newText.split('\n'))
}

/** Read file into Array<string>
 * @param {string} path
 * @returns {Promise<Array<string>>} file content as array when split by newline
 */
export async function readLines(path) {
  const file = Bun.file(path);
  const content = await file.text();
  return content.split("\n");
}

export async function prependFile(path, before, after) {
  const file = Bun.file(path);
  const content = await file.text();
  await Bun.write(path, (before || '') + content + (after || ''))
}
