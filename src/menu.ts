import { CallbackButton } from 'telegraf'

export class Menu {
  private _rootMenu?: Menu

  /**
   * Creates an instance of Menu.
   * @param {(Menu | undefined)} parent The parent menu instance.
   * @param {string} text The text/message of the menu.
   * @param {string} id The id of the menu.
   * @param {CallbackButton[][]} buttons The buttons of the menu.
   * @param {string} path The path of the menu.
   * @param {boolean} isPure Indicates whether the menu is pure or not.
   * @param {number} index The index of the menu.
   * @memberof Menu
   */
  constructor (
    public readonly parent: Menu | undefined,
    public readonly text: string,
    public readonly id: string,
    public readonly buttons: CallbackButton[][],
    public readonly path: string,
    public readonly isPure: boolean,
    public readonly index: number,
  ) { }

  /**
   * Gets the root menu of this menu tree.
   *
   * @readonly
   * @type {Menu}
   * @memberof Menu
   */
  get rootMenu(): Menu {
    if (this._rootMenu) { return this._rootMenu }

    let target: Menu = this
    while (target.parent) {
      target = target.parent
    }

    const root = target

    target = this
    while (target.parent) {
      target._rootMenu = root
      target = target.parent
    }

    return root
  }
}
