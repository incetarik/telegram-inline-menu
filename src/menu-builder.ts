import { nanoid } from 'nanoid'
import { resolve } from 'path'

import { CBHandler } from './callback-handler'
import { Change } from './change.enum'
import { Menu } from './menu'
import { MenuItemBuilder } from './menu-item-builder'

import type { CallbackButton } from 'telegraf'
import type { IMenu, ISubMenu, MenuOpts } from './types'


export class MenuBuilder {
  private _text!: string
  private _path?: string
  private _children?: MenuBuilder[]
  private _menu?: Menu
  private _navigationTarget?: MenuBuilder

  //@ts-ignore
  private readonly _layout!: IMenu = {}
  private readonly _parent!: MenuBuilder
  private readonly _menuById!: Dictionary<MenuBuilder>
  private readonly _menuByIndex!: MenuBuilder[]
  private readonly _menuByPath!: Dictionary<MenuBuilder>

  /**
   * The root menu of this menu group.
   *
   * @readonly
   * @type {MenuBuilder}
   * @memberof MenuBuilder
   */
  readonly rootMenu!: MenuBuilder

  /**
   * The last menu index.
   *
   * @readonly
   * @memberof MenuBuilder
   */
  readonly lastMenuIndex = 0

  /**
   * The index of the current menu.
   *
   * @readonly
   * @memberof MenuBuilder
   */
  readonly index = 0

  /**
   * The ID of the current menu.
   *
   * @readonly
   * @type {string}
   * @memberof MenuBuilder
   */
  readonly id!: string

  /**
   * Indicates whether the menu has no function that should be executed
   * to determine the value of any of its properties.
   *
   * @readonly
   * @type {boolean}
   * @memberof MenuBuilder
   */
  readonly isPure: boolean = true

  /**
   * The buttons of this menu.
   *
   * @readonly
   * @type {Dictionary<MenuItemBuilder>}
   * @memberof MenuBuilder
   */
  readonly buttons: Dictionary<MenuItemBuilder> = {}

  /**
   * The change flags of the menu.
   *
   * @readonly
   * @type {Change}
   * @memberof MenuBuilder
   */
  readonly changeFlags: Change = Change.Draw

  /**
   * The path of the menu.
   *
   * @readonly
   * @type {string}
   * @memberof MenuBuilder
   */
  get path(): string {
    if (this._path) { return this._path }
    return `${this._parent?.path ?? '/'}${this.id}/`
  }

  /**
   * The text of the menu.
   *
   * **NOTE**: If this is being assigned to an empty string, it will be ignored.
   *
   * @memberof MenuBuilder
   */
  get text() { return this._text }
  set text(to: string) {
    to = to.trim()
    if (!to) { return }
    if (this._text === to) { return }

    this._text = to
    this.markChange(Change.Text)
  }

  /**
   * Returns whether this menu has given change or not.
   *
   * @param {Change} change Change to check.
   * @returns `true` if that property of the menu has changed.
   * @memberof MenuBuilder
   */
  hasChange(change: Change) {
    return (this.changeFlags & change) === change
  }

  /**
   * Gets a child menu by its index.
   *
   * @param {number} index The index of the target menu.
   * @param {MenuBuilder} [skipInstance] Instance to skip searching.
   * @returns {(MenuBuilder | undefined)} The menu builder if found.
   * @memberof MenuBuilder
   */
  getChildWithIndex(index: number, skipInstance?: MenuBuilder): MenuBuilder | undefined {
    if (this.index === index) { return this }
    const { _children: children } = this
    if (!children) { return }

    for (const child of children) {
      if (child === skipInstance) { continue }
      const menu = child.getChildWithIndex(index)
      if (menu) { return menu }
    }
  }

  /**
   * Gets a child menu by its path.
   *
   * @param {string} path The path of the target menu.
   * @returns {(MenuBuilder | undefined)} The menu builder if found.
   * @memberof MenuBuilder
   */
  getChildByPath(path: string): MenuBuilder | undefined {
    if (!path.startsWith('/')) { path = `/${path}` }
    if (!path.endsWith('/')) { path += '/' }

    if (path in this._menuByPath) {
      return this._menuByPath[ path ]
    }

    if (path === '/') { return this.rootMenu }

    const { path: thisPath, _parent: parent } = this
    const index = path.indexOf(thisPath)
    let current: MenuBuilder | undefined

    if (index === 0) {
      current = this
      path = path.slice(thisPath.length)

      const segments = path.split('/')
      let children = this._children

      do {
        if (!children) { return }

        const currentPath = segments.shift()
        if (!currentPath) { return current }

        let found = false
        for (const child of children) {
          if (child.id !== currentPath) { continue }
          children = child._children
          current = child
          found = true
        }

        if (!found) { return }
      }
      while (children)
    }
    else if (parent) {
      if (parent.path.indexOf(path) >= 0 || path.indexOf(parent.path) >= 0) {
        return parent.getChildByPath(path)
      }
    }

    return current
  }

  /**
   * Gets a menu item by its path.
   *
   * @param {string} path The path of the target menu item.
   * @returns {(MenuItemBuilder | undefined)} The menu item builder if found.
   * @memberof MenuBuilder
   */
  getMenuItemByPath(path: string): MenuItemBuilder | undefined {
    const separatorIndex = path.lastIndexOf('/')

    const menuPath = path.slice(0, separatorIndex + 1)
    const itemPath = path.slice(separatorIndex + 1)
    const menu = this.getChildByPath(menuPath)
    if (!menu) { return }

    return menu.buttons[ itemPath ]
  }

  constructor (
    text: string,
    id: string = nanoid(10),
    _parent?: MenuBuilder,
    _menuById?: Dictionary<MenuBuilder>,
    _menuByIndex?: MenuBuilder[],
    _menuByPath?: Dictionary<MenuBuilder>,
  ) {
    this.id = id
    this._text = text
    this.rootMenu = this

    if (id === '/') {
      this._path = '/'
    }

    this._parent = _parent!
    this._menuById = _menuById = _parent?._menuById ?? {}
    this._menuByIndex = _menuByIndex = _parent?._menuByIndex ?? []
    this._menuByPath = _menuByPath = _parent?._menuByPath ?? {}

    if (id in this._menuById) {
      throw new Error(`Menu with id "${id}" is previously defined`)
    }

    this._layout = {
      id,
      text,
      buttons: {}
    }

    _menuById[ id ] = this
    _menuByIndex.push(this)
    _menuByPath[ this.path ] = this
  }

  /**
   * Adds a button to the menu and return its builder.
   *
   * @param {string} text Text of the button.
   * @param {string} [id=nanoid(10)] The optional ID of the button.
   * @returns The builder of the button.
   * @memberof MenuBuilder
   */
  button(text: string, id: string = nanoid(10)) {
    const builder = new MenuItemBuilder(this, text, id)
    return builder
  }

  /**
   * Adds a button that navigates to another menu and returns that menu builder.
   *
   * @param {MenuOpts} opts Options of the menu.
   * @returns {MenuBuilder} The builder of the menu.
   * @memberof MenuBuilder
   * @throws When the text, buttonText, id, buttonId is not string or empty.
   */
  menu(opts: MenuOpts): MenuBuilder

  /**
   * Adds a button that navigates to another menu and returns that menu builder.
   *
   * @param {string} menuText The text of the menu itself (message).
   * @param {string} buttonText The text of the button that will navigate to the menu.
   * @param {string} [menuId] The optional ID of the menu.
   * @param {string} [buttonIdOrIsFull] The optional ID of the button.
   * @param {boolean} [isButtonFullOrHidden] Indicates whether the button is full.
   * @param {boolean} [isButtonHidden] Indicates whether the button is hidden.
   * @returns {MenuBuilder} The builder of the menu.
   * @throws When the text, buttonText, id, buttonId is not string or empty.
   * @throws
   */
  menu(
    menuText: string,
    buttonText: string,
    menuId?: string,
    buttonIdOrIsFull?: string | boolean,
    isButtonFullOrHidden?: boolean,
    isButtonHidden?: boolean
  ): MenuBuilder

  menu(
    menuText: string,
    menuId: string,
    isFull: boolean,
    hidden: true,
  ): MenuBuilder

  /**
   * Adds a button that navigates to another menu and returns that menu builder.
   *
   * @param {(string | MenuOpts)} menuText The options or the menu text.
   * @param {string} [buttonTextOrMenuId] The button text or the ID of the menu.
   * @param {(string | boolean)} [menuIdOrIsFull] The menu ID or is full.
   * @param {(string | boolean)} [buttonIdOrHidden] The button ID or is hidden.
   * @param {boolean} [isFullOrHidden] Indicates whether the button is full.
   * @param {boolean} [isHidden] Indicates whether the button is hidden.
   * @returns {MenuBuilder} The builder of the menu.
   * @memberof MenuBuilder
   * @throws When the text, buttonText, id, buttonId is not string or empty.
   */
  menu(
    menuText: string | MenuOpts,
    buttonTextOrMenuId?: string,
    menuIdOrIsFull?: string | boolean,
    buttonIdOrHidden?: string | boolean,
    isFullOrHidden?: boolean,
    isHidden?: boolean
  ): MenuBuilder {
    if (typeof menuText === 'object') {
      const {
        text,
        buttonText = text,
        full = false,
        hide = false,
        id = nanoid(10),
        buttonId = nanoid(10)
      } = menuText

      menuText = text
      buttonTextOrMenuId = buttonText
      menuIdOrIsFull = id
      buttonIdOrHidden = buttonId
      isFullOrHidden = full
      isHidden = hide
    }
    else if (typeof menuIdOrIsFull === 'boolean') {
      if (typeof buttonIdOrHidden === 'boolean') {
        isFullOrHidden = menuIdOrIsFull
        menuIdOrIsFull = buttonTextOrMenuId
        isHidden = buttonIdOrHidden
      }
      else {
        isFullOrHidden = false
        isHidden = false
      }

      buttonIdOrHidden = nanoid(10)
    }
    else if (typeof buttonIdOrHidden === 'boolean') {
      isFullOrHidden = buttonIdOrHidden
      isHidden = false

      buttonIdOrHidden = nanoid(10)
    }

    let text = menuText
    let buttonText = buttonTextOrMenuId
    let id = menuIdOrIsFull ?? nanoid(10)
    let buttonId = buttonIdOrHidden ?? nanoid(10)
    const full = isFullOrHidden ?? false
    const hide = isHidden ?? false

    if (typeof text !== 'string') { throw new Error('The type of the menu text was not a string') }
    else { text = text.trim(); if (!text) throw new Error('The text of the menu was empty') }

    if (typeof buttonText !== 'string') { throw new Error('The type of the button text was not a string') }
    else { buttonText = buttonText.trim(); if (!text) throw new Error('The text of the button text was empty') }

    if (typeof id !== 'string') { id = nanoid(10) }
    else { id = id.trim(); if (!id) throw new Error('The menu id was empty') }

    if (typeof buttonId !== 'string') { buttonId = nanoid(10) }
    else { buttonId = buttonId.trim(); if (!buttonId) throw new Error('The button menu id was empty') }

    const builder = new MenuBuilder(text, id, this, this._menuById, this._menuByIndex, this._menuByPath)
    //@ts-ignore
    builder.rootMenu = this.rootMenu
    //@ts-ignore
    builder.index = ++this.lastMenuIndex

    if (!this._children) {
      this._children = []
    }

    this._children.push(builder)

    if (!(builder.id in this._layout.buttons)) {
      this._layout.buttons[ builder.id ] = builder._layout
      //@ts-ignore
      builder._layout[ 'hide' ] = true
    }

    //@ts-ignore
    builder.lastMenuIndex = builder.index
    let target: MenuBuilder = this
    while (target._parent) {
      //@ts-ignore
      target._parent.lastMenuIndex = target.lastMenuIndex
      target = target._parent
    }

    target = this
    for (const child of this._children) {
      //@ts-ignore
      child.lastMenuIndex = builder.index
    }

    this
      .button(buttonText, buttonId)
      .setOnPress(function navigateToInnerMenu(ctx) {
        //@ts-ignore
        return CBHandler.setMenuActive(ctx, builder)
      })
      .setFull(!!full)
      .setHide(!!hide)
      .end()

    return builder
  }

  /**
   * Adds a navigation button to the menu.
   *
   * @param {string} text The text of the button.
   * @param {string} targetMenuId The target menu ID.
   * @param {string} [id] The optional ID of the button.
   * @returns {MenuItemBuilder} The builder of the navigation button.
   * @memberof MenuBuilder
   * @throws When navigation navigates to the same menu.
   * @throws When navigation navigates to non existent menu.
   */
  navigation(text: string, targetMenuId: string, id?: string): MenuItemBuilder

  /**
   * Adds a navigation button to the menu.
   *
   * @param {string} text The text of the button.
   * @param {string} targetMenuPath The path of the target menu.
   * @param {string} [id] The optional ID of the button.
   * @returns {MenuItemBuilder} The builder of the navigation button.
   * @memberof MenuBuilder
   * @throws When navigation navigates to the same menu.
   * @throws When navigation navigates to non existent menu.
   */
  navigation(text: string, targetMenuPath: string, id?: string): MenuItemBuilder

  /**
   * Adds a navigation button to the menu.
   *
   * @param {string} text The text of the button.
   * @param {number} targetMenuIndex The index of the target menu.
   * @param {string} [id] The optional ID of the button.
   * @returns {MenuItemBuilder} The builder of the navigation button.
   * @memberof MenuBuilder
   * @throws When navigation navigates to the same menu.
   * @throws When navigation navigates to non existent menu.
   */
  navigation(text: string, targetMenuIndex: number, id?: string): MenuItemBuilder

  /**
   * Adds a navigation button to the menu.
   *
   * @param {string} text The text of the button.
   * @param {(string | number)} value The index or the ID or the path of the menu.
   * @param {string} [id] The optional ID of the button.
   * @returns {MenuItemBuilder} The builder of the navigation button.
   * @memberof MenuBuilder
   * @throws When navigation navigates to the same menu.
   * @throws When navigation navigates to non existent menu.
   */
  navigation(text: string, value: string | number, id?: string): MenuItemBuilder {
    const that = this

    return this.button(text, id).setOnPress(function navigate(ctx) {
      if (that._navigationTarget instanceof MenuBuilder) {
        //@ts-ignore
        return CBHandler.setMenuActive(ctx, that._navigationTarget)
      }

      if (typeof value === 'number') {
        let index = value
        if (index < 0 && index >= -that.lastMenuIndex) {
          index %= that.lastMenuIndex
          if (index < 0) { index += that.lastMenuIndex }
        }

        const menu = that._menuByIndex[ index ]

        if (!menu) {
          throw new Error(`Given menu index was out of range: ${value}, menu count: ${that.lastMenuIndex + 1}`)
        }

        //@ts-ignore
        return CBHandler.setMenuActive(ctx, menu)
      }

      if (typeof value === 'string') {
        if (value === that.path || value === that.id) {
          throw new Error('It is not possible to create navigation button for the same menu')
        }

        if (value.indexOf('.') === 0) {
          let fullPath = resolve(that.path, value)
          if (!fullPath.endsWith('/')) { fullPath += '/' }
          value = fullPath
        }

        if (value.indexOf('/') >= 0) {
          const menu = that.getChildByPath(value)
          if (menu) {
            //@ts-ignore
            return CBHandler.setMenuActive(ctx, menu)
          }
          else if (value.endsWith('/')) {
            throw new Error(`Menu by path is not found: "${value}"`)
          }
          else if (value.startsWith('/')) {
            const partIndex = value.indexOf('/', 1)
            const menuId = value.slice(1, partIndex < 0 ? undefined : partIndex)
            const menu = CBHandler.getMenuById(menuId)
            if (menu) {
              const child = menu.getChildByPath(value)
              if (child) {
                //@ts-ignore
                return CBHandler.setMenuActive(ctx, child)
              }
            }
          }

          throw new Error(`Menu with path ${value} is not found`)
        }

        if (value in that._menuById) {
          const menu = that._menuById[ value ]
          //@ts-ignore
          return CBHandler.setMenuActive(ctx, menu)
        }

        throw new Error(`Menu with id "${value}" is not found`)
      }

      throw new Error('Invalid parameter type for navigation button')
    })
  }

  /**
   * Builds the menu and returns it.
   *
   * @param {boolean} [soft=false] Indicator determines whether the `changeFlags`
   * of the menu should be set to 0 or not.
   * If this is `true` then the `changeFlags` will not be reset.
   *
   * @returns {Promise<Menu>} The promise of the menu.
   * @memberof MenuBuilder
   */
  async toMenu(soft: boolean = false): Promise<Menu> {
    if (this.changeFlags === Change.None) {
      if (this._menu) {
        return this._menu
      }
    }

    const { text, id, buttons } = this

    const items: CallbackButton[][] = []
    let currentRow: CallbackButton[] | undefined

    for (const buttonId in buttons) {
      const item = buttons[ buttonId ]
      const menuItem = await item.toMenuItem()
      if (menuItem.full) {
        if (currentRow?.length) {
          items.push(currentRow)
          currentRow = []
        }

        items.push([ menuItem as CallbackButton ])
      }
      else {
        (currentRow || (currentRow = [])).push(menuItem as CallbackButton)
      }
    }

    if (currentRow?.length) {
      items.push(currentRow)
    }

    const parentMenu = await this._parent?.toMenu()
    const menu = new Menu(parentMenu, text, id, items, this.path, this.isPure, this.index)

    if (!soft) {
      //@ts-ignore
      this.changeFlags = Change.None
      this._menu = menu
    }

    return menu
  }

  /**
   * Ends of this building of the menu and returns the parent (or itself).
   *
   * @returns The parent builder or itself if there is no parent.
   * @memberof MenuBuilder
   */
  end() {
    return this._parent ?? this
  }

  /**
   * Ends of this building of the menu and returns the parent (or itself).
   *
   * @returns The parent builder or itself if there is no parent.
   * @memberof MenuBuilder
   */
  endMenu() {
    return this.end()
  }

  private markChange(change: Change) {
    //@ts-ignore
    this.changeFlags |= change
  }

  /**
   * Builds the menu from an `IMenu` object.
   *
   * @static
   * @param {IMenu | MenuBuilder} source The source object of the menu.
   * @param {MenuBuilder} [builder] The optional parent builder.
   * @param {string} [subMenuId] The optional menu ID given by the parent.
   * @param {ISubMenu} [subMenu] The optional sub-menu options given by the parent.
   * @returns The builder of the root menu.
   * @memberof MenuBuilder
   * @throws When any relative navigation by negative index is not found.
   */
  static fromObject(source: IMenu | MenuBuilder, builder?: MenuBuilder, subMenuId?: string, subMenu?: ISubMenu): MenuBuilder {
    if (source instanceof MenuBuilder) {
      source = source._layout
    }

    if (typeof source !== 'object') {
      throw new Error(`Unexpected type of menu source: "${typeof source}"`)
    }

    const { buttons, text, id: customMenuId = 'main' } = source
    let isSubMenu = false
    if (builder) {
      builder = builder.menu(
        subMenu!.text,
        subMenu!.buttonText ?? subMenu!.text,
        subMenuId,
        subMenu!.buttonId ?? `nav.${builder.id}.${subMenuId}`,
        subMenu!.full,
        subMenu!.hide
      )

      isSubMenu = true
    }
    else {
      //@ts-ignore
      builder = new MenuBuilder(text, customMenuId)
    }

    for (const id in buttons) {
      const button = buttons[ id ]
      if (typeof button === 'string') {
        builder!.button(button, id).end()
      }
      else {
        if ('buttons' in button) {
          MenuBuilder.fromObject(button, builder, button.id ?? id, button).end()
          builder.end()
        }
        else {
          const { text, full = false, hide = false, onPress, url } = button
          let { navigate } = button

          if (typeof navigate === 'number') {
            if (navigate < 0) {
              const targetIndex = builder!.index + navigate
              const targetMenu = builder!.rootMenu.getChildWithIndex(targetIndex)
              if (targetMenu) {
                navigate = targetMenu.path
              }
              else {
                throw new Error(`Menu with relative index "${navigate}" could not be found from button "${builder.path}${id}"`)
              }
            }
            else if (navigate === builder.index) {
              throw new Error(`It is not possible to create navigation button for the same menu (${builder.path}${id})`)
            }
          }
          else if (typeof navigate === 'string') {
            if (navigate.indexOf('.') === 0) {
              let fullPath = resolve(builder!.path, navigate)
              if (!fullPath.endsWith('/')) { fullPath += '/' }
              navigate = fullPath
              if (fullPath === builder.path) {
                throw new Error(`It is not possible to create navigation button for the same menu (${builder.path}${id})`)
              }
            }
          }

          if (typeof navigate === 'string' || typeof navigate === 'number') {
            builder!
              .navigation(text, navigate as string, id)
              .setFull(full)
              .setHide(hide)
              .end()
          }
          else {
            const btn = builder!.button(text, id).setFull(full).setHide(hide)

            if (typeof url === 'string') {
              btn.setUrl(url)
            }

            if (typeof onPress === 'function') {
              btn.setOnPress(onPress)
            }

            btn.end()
          }
        }
      }
    }

    if (isSubMenu) {
      return builder!?.end()! ?? builder
    }

    return builder!
  }
}
