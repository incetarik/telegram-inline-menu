import { nanoid } from 'nanoid'
import { MenuBuilder } from './menu-builder'
import { IMenu } from './types'
import { SYM_DYNAMIC_MENU_BUILDER, SYM_FIRST_DYNAMIC_DRAW } from './commons'

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
export async function inlineMenu(source: IMenu | MenuBuilder | (() => IMenu | Promise<IMenu>)): Promise<MenuBuilder> {
  if (typeof source === 'function') {
    const builtMenuSource = await source()
    const menu = await inlineMenu(builtMenuSource)
    if (!(SYM_DYNAMIC_MENU_BUILDER in menu)) {
      Object.defineProperties(menu, {
        [ SYM_DYNAMIC_MENU_BUILDER ]: {
          configurable: false,
          enumerable: false,
          value: source
        },
        [ SYM_FIRST_DYNAMIC_DRAW ]: {
          configurable: true,
          writable: true,
          enumerable: false,
          value: true
        }
      })
    }

    return menu
  }

  if (typeof source.id !== 'string') {
    //@ts-ignore
    source.id = nanoid(8)
  }

  return MenuBuilder.fromObject(source)
}
