import { nanoid } from 'nanoid'
import { MenuBuilder } from './menu-builder'
import { IMenu } from './types'


export { CBHandler } from './callback-handler'
export { MenuBuilder } from './menu-builder'
export * from './types'

/**
 * Creates an inline menu from an `IMenu` source.
 *
 * @export
 * @param {IMenu | MenuBuilder} source Source of the menu.
 * @returns A menu builder.
 */
export function inlineMenu(source: IMenu | MenuBuilder) {
  if (typeof source.id !== 'string') {
    //@ts-ignore
    source.id = nanoid(8)
  }

  return MenuBuilder.fromObject(source)
}
