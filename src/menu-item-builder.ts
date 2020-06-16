import { nanoid } from 'nanoid'
import { CallbackButton, UrlButton } from 'telegraf'

import { Change } from './change.enum'
import { MenuBuilder } from './menu-builder'
import { IMenuButton, OnButtonPressFunction } from './types'

export class MenuItemBuilder {
  private _text!: string
  private _hidden: boolean = false
  private _full: boolean = false
  private _url?: string
  private _fullFunction?: Func<Promise<boolean> | boolean>
  private _hideFunction?: Func<Promise<boolean> | boolean>
  private _builtItem?: (CallbackButton | UrlButton) & { full: boolean }
  private _dynamicMenu?: MenuBuilder

  private readonly _layout!: IMenuButton

  //@ts-ignore It is used externally, not in this class.
  private onPress?: Func

  private get dynamicMenu() {
    return this._dynamicMenu
  }

  private set dynamicMenu(to: MenuBuilder | undefined) {
    //@ts-ignore
    this._dynamicMenu?._detach()
    this._dynamicMenu = to
  }

  /**
   * Indicates whether the button is pure, none of its properties are depending
   * on a result of any function.
   *
   * @readonly
   * @type {boolean}
   * @memberof MenuItemBuilder
   */
  readonly isPure: boolean = true

  /**
   * The ID of the button
   *
   * @readonly
   * @type {string}
   * @memberof MenuItemBuilder
   */
  readonly id!: string

  /**
   * The parent menu builder of the button.
   *
   * @readonly
   * @type {MenuBuilder}
   * @memberof MenuItemBuilder
   */
  readonly parent!: MenuBuilder

  /**
   * The change flags of the button.
   *
   * @readonly
   * @type {Change}
   * @memberof MenuItemBuilder
   */
  readonly changeFlags: Change = Change.None

  /**
   * The path of the button.
   *
   * @readonly
   * @memberof MenuItemBuilder
   */
  get path() {
    return `${this.parent.path}${this.id}`
  }

  /**
   * The text of the button.
   *
   * Assigning this to an empty string will be ignored silently.
   *
   * @memberof MenuItemBuilder
   */
  get text() { return this._text }
  set text(to: string) {
    if (typeof to !== 'string') { return }
    to = to.trim()
    if (!to) { return }
    if (this._text === to) { return }

    if (typeof this._layout.text === 'undefined') {
      this._layout.text = to
    }

    this._text = to
    this.markChange(Change.Text)
  }

  /**
   * Indicates whether the button is hidden or not..
   *
   * @memberof MenuItemBuilder
   */
  get hide() { return this._hidden }
  set hide(to: boolean) {
    if (this._hidden === to) { return }

    if (typeof this._layout.hide === 'undefined') {
      this._layout.hide = to
    }

    this._hidden = to
    this.markChange(Change.Visibility)
  }

  /**
   * Indicates whether the button is full/row-width or not.
   *
   * @memberof MenuItemBuilder
   */
  get full() { return this._full }
  set full(to: boolean) {
    if (this._full === to) { return }

    if (typeof this._layout.full === 'undefined') {
      this._layout.full = to
    }

    this._full = to
    this.markChange(Change.Layout)
  }

  constructor (parent: MenuBuilder, text: string, id: string = nanoid(10)) {
    this.parent = parent
    this._text = text
    this.id = id

    this._layout = {
      text,
    }
  }

  /**
   * Sets the button text.
   *
   * _Setting to empty string will be ignored silently._
   *
   * @param {string} text The new text of the button.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setText(text: string): MenuItemBuilder {
    if (typeof text !== 'string') { return this }
    text = text.trim()
    if (!text) { return this }
    if (this.text === text) { return this }

    this.text = text
    this.markChange(Change.Text)
    return this
  }

  /**
   * Sets the hide state of the button.
   *
   * @param {boolean} to The new hide state of the button.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setHide(to: boolean): MenuItemBuilder

  /**
   * Sets a function to determine the hide state of the button during building.
   *
   * @param {(Func<Promise<boolean> | boolean>)} when Function to determine
   * the new hide state.
   *
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setHide(when: Func<Promise<boolean> | boolean>): MenuItemBuilder

  /**
   * Sets the hide state of the button.
   *
   * @param {(boolean | Func)} toOrWhen The function to determine or state.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setHide(toOrWhen: boolean | Func): MenuItemBuilder {
    if (typeof toOrWhen == 'boolean') {
      if (this.hide === toOrWhen) {
        return this
      }

      this.hide = toOrWhen
    }
    else {
      this._hideFunction = toOrWhen
      //@ts-ignore
      this.isPure = false
      //@ts-ignore
      this.parent.isPure = false
    }

    if (typeof this._layout.hide === 'undefined') {
      //@ts-ignore
      this._layout.hide = toOrWhen
    }

    this.markChange(Change.Visibility)
    return this
  }

  /**
   * Sets the full width state of the button.
   *
   * @param {boolean} to The new state of the button.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setFull(to: boolean): MenuItemBuilder

  /**
   * Sets a function to determine the full width state of the button during
   * building.
   *
   * @param {Func<Promise<boolean> | boolean>} when Function to determine
   * the new full width state.
   *
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setFull(when: Func<Promise<boolean> | boolean>): MenuItemBuilder

  /**
   * Sets the full width state of the button.
   *
   * @param {(boolean | Func<Promise<boolean> | boolean>)} toOrWhen The new
   * state or the function to determine.
   *
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setFull(toOrWhen: boolean | Func<Promise<boolean> | boolean>): MenuItemBuilder {
    if (typeof toOrWhen == 'boolean') {
      if (this.full === toOrWhen) {
        return this
      }

      this.full = toOrWhen
    }
    else {
      this._fullFunction = toOrWhen
      //@ts-ignore
      this.isPure = false
      //@ts-ignore
      this.parent.isPure = false
    }

    if (typeof this._layout.full === 'undefined') {
      //@ts-ignore
      this._layout.full = toOrWhen
    }

    this.markChange(Change.Layout)
    return this
  }

  /**
   * Sets a function to be executed when the button is pressed.
   *
   * @param {OnButtonPressFunction} fun The on press function.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setOnPress(fun: OnButtonPressFunction): MenuItemBuilder {
    this.onPress = fun

    if (typeof this._layout.onPress === 'undefined') {
      this._layout.onPress = fun
    }

    return this
  }

  /**
   * Sets a link to this button.
   *
   * @param {string} url URL to be set for this button.
   * @returns {MenuItemBuilder} The menu item builder.
   * @memberof MenuItemBuilder
   */
  setUrl(url: string): MenuItemBuilder {
    this._url = url

    if (typeof this._layout.url === 'undefined') {
      this._layout.url = url
    }

    return this
  }

  /**
   * Ends the building of the current button and retuns the menu builder.
   *
   * @returns {MenuBuilder} The parent menu builder of this button builder.
   * @memberof MenuItemBuilder
   */
  end(): MenuBuilder {
    const { parent } = this
    parent.buttons[ this.id ] = this
    parent[ '_layout' ].buttons[ this.id ] = this._layout
    return parent
  }

  /**
   * Builds the button and returns a `CallbackButton` instance.
   *
   * @returns {(Promise<(CallbackButton | UrlButton) & { full: boolean }>)} The
   * built `CallbackButton` instance with additional `full: boolean` property.
   *
   * @memberof MenuItemBuilder
   */
  async toMenuItem(): Promise<(CallbackButton | UrlButton) & { full: boolean }> {
    if (this.isPure) {
      if (this.changeFlags === 0) {
        if (this._builtItem) {
          return this._builtItem
        }
      }
    }

    if (typeof this._fullFunction === 'function') {
      this.full = await this._fullFunction()
    }

    if (typeof this._hideFunction === 'function') {
      this.hide = await this._hideFunction()
    }

    //@ts-ignore
    this.changeFlags = Change.None

    if (this._url) {
      return this._builtItem = {
        url: this._url,
        full: this.full,
        hide: this.hide,
        text: this.text
      }
    }

    return this._builtItem = {
      callback_data: `${this.parent.path}${this.id}`,
      hide: this.hide,
      text: this.text,
      full: this.full
    }
  }

  private markChange(change: Change) {
    //@ts-ignore
    this.changeFlags |= change

    this.parent[ 'markChange' ](change)
  }
}
