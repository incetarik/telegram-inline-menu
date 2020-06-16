import { ButtonActionResult } from './types'

/**
 * Indicates whether the given object is generator-like or not.
 *
 * @export
 * @param {*} thing The object to check.
 * @returns {thing is AsyncGenerator} `true` if the given object is generator.
 */
export function isGenerator(thing: any): thing is AsyncGenerator {
  if (typeof thing !== 'object') { return false }
  if (typeof thing.next !== 'function') { return false }
  if (typeof thing.return !== 'function') { return false }
  if (typeof thing.throw !== 'function') { return false }
  return true
}

/**
 * Indicates whether the given object is promise-like or not.
 *
 * @export
 * @template T The type of the promise.
 * @param {*} thing The object to check.
 * @returns {thing is Promise<T>} `true` if the given object is a promise.
 */
export function isPromise<T = any>(thing: any): thing is Promise<T> {
  if (typeof thing !== 'object') { return false }
  if (typeof thing.then !== 'function') { return false }
  if (typeof thing.catch !== 'function') { return false }
  return true
}

/**
 * Indicates whether the given object is button action result like or not.
 *
 * @export
 * @param {*} value The object to check.
 * @returns {value is ButtonActionResult} `true` if the given object is
 * `ButtonActionResult`.
 */
export function isButtonActionResultLike(value: any): value is ButtonActionResult & object {
  if (typeof value !== 'object') { return false }
  if (typeof value.navigate === 'string' || typeof value.navigate === 'number') { return true }
  if (typeof value.hide === 'boolean') { return true }
  if (typeof value.text === 'string') { return true }
  if (typeof value.full === 'boolean') { return true }
  if (typeof value.message === 'string') { return true }
  if (typeof value.closeWith === 'string') { return true }
  if (typeof value.close === 'boolean') { return true }
  if (typeof value.value !== 'undefined') { return true }
  return false
}
