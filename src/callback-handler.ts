import Telegraf, { ContextMessageUpdate, Extra, Markup } from 'telegraf'

import { Change } from './change.enum'
import { isButtonActionResultLike, isGenerator, isPromise } from './helpers'
import { MenuBuilder } from './menu-builder'
import { MenuItemBuilder } from './menu-item-builder'

import { nanoid } from 'nanoid'
import { SYM_VALUE_STACK } from './commons'

const SYM_EXEC_SUCCESS = Symbol('@@buttonActionSuccess')
const SYM_EXEC_FAIL = Symbol('@@buttonActionFailure')

class CallbackQueryHandler {
  private _isAttached = false
  private _menuMap: WeakMap<any, Dictionary<MenuBuilder>> = new WeakMap()
  private _activeMenuMap: WeakMap<any, MenuBuilder> = new WeakMap()
  private _keeper: any
  private _onMethodMissing?: OnMethodMissingHandler
  private _onGeneratorValueHandler?: OnGeneratorStepHandler
  private _generatorHandler?: OnGeneratorStepHandler
  private _activeMenu?: MenuBuilder
  private _onError?: (e: Error) => void
  private _onMenuDelete?: (id: string) => void
  private _onMenuClose?: (menuBuilder: MenuBuilder | undefined) => void

  /**
   * Determines whether this callback query handler is strict or not.
   *
   * When this property is set to `true`, then any value returned from any
   * generator function was not an object nor `ButtonActionResult`, and
   * no generator value handler is registered, then an error will be thrown.
   *
   * Otherwise any value other than `ButtonActionResult` will be ignored
   * silently and not be processed if no generator vlaue handler is registered.
   *
   * @memberof CallbackQueryHandler
   */
  isStrict = false

  /**
   * The active menu map by the keeper.
   *
   * **Intended for internal usage.**
   *
   * @type {(MenuBuilder | undefined)}
   * @memberof CallbackQueryHandler
   */
  get activeMenuMap(): MenuBuilder | undefined {
    return this._activeMenuMap.get(this._keeper)
  }

  set activeMenuMap(to: MenuBuilder | undefined) {
    if (!to) {
      this._activeMenuMap.delete(this._keeper)
      return
    }

    this._activeMenuMap.set(this._keeper, to)
  }

  /**
   * Attachs this callback query handler to a Telegraf instance.
   *
   * _Attaching is done only once per `CallbackQueryHandler`._
   *
   * @param {Telegraf<ContextMessageUpdate>} telegraf Telegraf instance.
   * @returns {boolean} `true` if the attaching is done.
   * @memberof CallbackQueryHandler
   */
  attach(telegraf: Telegraf<ContextMessageUpdate>): boolean {
    if (this._isAttached) { return false }

    this._isAttached = true
    const that = this
    telegraf.on('callback_query', async function onCallbackQuery(ctx) {
      const { callbackQuery } = ctx
      if (!callbackQuery) { return }

      const { data } = callbackQuery
      if (!data) { return }

      const menuDict = that._menuMap.get(that._keeper)
      if (!menuDict) { return }

      const segments = data.split('/').slice(1)
      const menuId = segments.shift()!

      let targetMenu: MenuBuilder | undefined = menuDict[ menuId ]
      const button = targetMenu?.getMenuItemByPath(data)
      if (!button) { return }

      targetMenu = button.parent
      that._activeMenu = targetMenu

      try {
        const fun = button[ 'onPress' ] as OnButtonPressFunction
        //@ts-ignore
        const previousValues = targetMenu[ '_getValueStack' ]()
        let value: ButtonActionResult
        if (typeof fun !== 'function') {
          value = await that._onMethodMissing?.(button.text, button.path, callbackQuery, previousValues)
        }
        else {
          const menu = await targetMenu.toMenu(true)
          //@ts-ignore
          value = await fun.call(button, { ctx, id: button.id, text: button.text, menu, previousValues })
        }

        if (isPromise(value)) {
          value = await value
        }
        else if (isGenerator(value)) {
          if (typeof that._generatorHandler === 'function') {
            await that._generatorHandler(ctx, value, async function onButtonAction() {
              return await that.execButtonAction(value, ctx, button, targetMenu!)
            })
          }
          else {
            await that.handleGenerator(ctx, value, button, targetMenu)
          }

          that._activeMenu = undefined
          return
        }

        const returnValue = await that.execButtonAction(value, ctx, button, targetMenu)
        that._activeMenu = undefined
        return returnValue
      }
      catch (e) {
        that._activeMenu = undefined
        if (typeof that._onError === 'function') {
          that._onError(e)
        }
        else {
          throw e
        }
      }
    })

    return true
  }

  /**
   * Registers a menu for the current keeper.
   *
   * @param {MenuBuilder} menuBuilder Menu Builder.
   * @memberof CallbackQueryHandler
   */
  registerMenu(menuBuilder: MenuBuilder) {
    let previous = this._menuMap.get(this._keeper)
    if (!previous) {
      this._menuMap.set(this._keeper, previous = {})
    }

    previous[ menuBuilder.id ] = menuBuilder
  }

  /**
   * Removes a menu for the current keeper.
   *
   * @param {(string | MenuBuilder)} id Id of the menu or menu itself.
   * @returns `false` if could not be removed.
   * @memberof CallbackQueryHandler
   */
  deleteMenu(id: string | MenuBuilder) {
    const previous = this._menuMap.get(this._keeper)
    if (!previous) { return false }
    if (typeof id === 'object') { id = id.id }
    if (!(id in previous)) { return false }
    const state = delete previous[ id ]
    this._onMenuDelete?.(id)
    return state
  }

  /**
   * Gets menu by its ID.
   *
   * @param {string} id ID of the menu.
   * @returns The menu registered to current keeper by id.
   * @memberof CallbackQueryHandler
   */
  getMenuById(id: string): MenuBuilder | undefined {
    const value = this._menuMap.get(this._keeper)
    if (!value) { return }
    return value[ id ]
  }

  /**
   * Shows a menu as a separate message.
   *
   * @param {ContextMessageUpdate} ctx Context.
   * @param {MenuBuilder} menuBuilder MenuBuilder to build the menu.
   * @returns The value returned from `ctx.reply`.
   * @memberof CallbackQueryHandler
   */
  async showMenu(ctx: ContextMessageUpdate, menuBuilder: MenuBuilder) {
    const menu = await menuBuilder.toMenu()
    this.registerMenu(menuBuilder)
    return await ctx.reply(menuBuilder.text, Extra.markup(Markup.inlineKeyboard(menu.buttons)))
  }

  /**
   * Closes/removes a menu with an optionally given text.
   *
   * @param {ContextMessageUpdate} ctx Context.
   * @param {string} withText The text to update the message.
   * @param {boolean} [justRemoveMarkup=false] Indicates whether only the
   * markup should be removed or not.
   * @memberof CallbackQueryHandler
   */
  async closeMenu(ctx: ContextMessageUpdate, withText: string, justRemoveMarkup: boolean = false) {
    this.activeMenuMap = undefined

    if (withText) {
      if (justRemoveMarkup) {
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
      }
      else {
        await ctx.editMessageText(withText, Extra.markup(Markup.inlineKeyboard([])))
      }
    }
    else if (!justRemoveMarkup) {
      const id = ctx.callbackQuery?.message?.message_id
      if (id) {
        await ctx.deleteMessage(ctx.callbackQuery!.message!.message_id)
      }
    }
    else {
      await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
    }

    this._onMenuClose?.(this._activeMenu)
  }

  /**
   * A function to register a handler when a button does not have `onPress`
   * function property. So that it could be caught here and processed.
   *
   * The handler will take the text of the button, the path of the button
   * and the callback query object.
   *
   * The handler may return a value to determine what will happen in these
   * conditions.
   *
   * @param {OnMethodMissingHandler} handler The handler function.
   * @memberof CallbackQueryHandler
   */
  onMethodMissing(handler: OnMethodMissingHandler) {
    this._onMethodMissing = handler
  }

  /**
   * Sets a custom handler for generator functions.
   *
   * @param {OnGeneratorStepHandler} fun Function that will handle generator.
   * @memberof CallbackQueryHandler
   */
  setGeneratorHandler(fun: OnGeneratorStepHandler) {
    this._generatorHandler = fun
  }

  /**
   * Sets a function to execute when the generator function of any button
   * returns an object other that `ButtonActionResult`.
   *
   * @param {OnGeneratorStepHandler} fun Function to be executed.
   * @memberof CallbackQueryHandler
   */
  onGeneratorValue(fun: OnGeneratorStepHandler) {
    this._onGeneratorValueHandler = fun
  }

  /**
   * Sets an object to relate the built menus with.
   *
   * For this purpose, a weak-map is used. It is why this function exists.
   * If, this library is used with another library which handles the bot
   * interactions, may set itself as menu keeper so that when the instance
   * is garbage-collected, the menus built during the life-time of the instance
   * will be able to be garbage collected as well.
   *
   * @param {*} keeper A keeper object for the built menus.
   * @memberof CallbackQueryHandler
   */
  setMenuKeeper(keeper: any) {
    this._keeper = keeper
  }

  /**
   * Sets a handler to be executed when a menu is deleted.
   *
   * @param {(id: string) => void} handler Handler function.
   * @memberof CallbackQueryHandler
   */
  setOnMenuDelete(handler: (id: string) => void) {
    this._onMenuDelete = handler
  }

  /**
   * Sets an error handler.
   *
   * @param {(e: Error) => void} handler Handler function.
   * @memberof CallbackQueryHandler
   */
  setOnError(handler: (e: Error) => void) {
    this._onError = handler
  }

  /**
   * Sets a handler to be executed when a menu is closed.
   *
   * @param {((menuBuilder: MenuBuilder | undefined) => void)} handler Handler
   * function.
   *
   * @memberof CallbackQueryHandler
   */
  setOnMenuClose(handler: (menuBuilder: MenuBuilder | undefined) => void) {
    this._onMenuClose = handler
  }

  private async handleGenerator(ctx: ContextMessageUpdate, generator: Generator | AsyncGenerator, button: MenuItemBuilder, targetMenu: MenuBuilder) {
    if (typeof generator.next !== 'function') { return generator }
    if (typeof generator.return !== 'function') { return generator }
    if (typeof generator.throw !== 'function') { return generator }

    let nextValue: any
    while (true) {
      const iterationResult = await generator.next(nextValue)
      nextValue = undefined
      const { value, done } = iterationResult

      if (done) {
        return value ?? nextValue
      }

      if (typeof value === 'undefined') { continue }
      if (typeof value !== 'object') {
        if (typeof this._onGeneratorValueHandler === 'function') {
          nextValue = await this._onGeneratorValueHandler(ctx, value, async (value) => {
            return await this.execButtonAction(value, ctx, button, targetMenu)
          })

          continue
        }
      }
      else if (isButtonActionResultLike(value)) {
        await this.execButtonAction(value, ctx, button, targetMenu)
        continue
      }
      else if (typeof this._onGeneratorValueHandler === 'function') {
        nextValue = await this._onGeneratorValueHandler(ctx, value, async (value) => {
          return await this.execButtonAction(value, ctx, button, targetMenu)
        })
        continue
      }

      if (this.isStrict) {
        throw new Error(`Unexpected value is yielded from a generator function: (type: ${typeof value}) "${String(value)}"`)
      }
    }
  }

  private async setMenuActive(ctx: ContextMessageUpdate, menu: MenuBuilder) {
    if (menu.changeFlags && !menu.hasChange(Change.Draw) && !menu.hasChange(Change.Text)) {
      await this.updateMenuContent(ctx, menu)
      return
    }

    const builtMenu = await menu.toMenu()
    this.activeMenuMap = menu

    await ctx.editMessageText(builtMenu.text, Extra.markup(Markup.inlineKeyboard(builtMenu.buttons)))
  }

  private async updateMenuContent(ctx: ContextMessageUpdate, menu: MenuBuilder) {
    const builtMenu = await menu.toMenu()
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(builtMenu.buttons))
  }

  private async execButtonAction(action: ButtonActionResult, ctx: ContextMessageUpdate, button: MenuItemBuilder, targetMenu: MenuBuilder) {
    if (!isButtonActionResultLike(action)) { return SYM_EXEC_FAIL }
    const menuDict = this._menuMap.get(this._keeper)!

    const {
      navigate,
      hide = button.hide,
      message = targetMenu.text,
      text = button.text,
      full = button.full,
      close = false,
      closeWith,
      keepPreviousValue = true,
    } = action

    let { value } = action

    button.setText(text).setHide(hide as any).setFull(full as any)
    button.parent.text = message

    let isValueAdded = false

    if (navigate) {
      let target
      if (typeof navigate === 'string') {
        const rootPath = targetMenu.rootMenu.path
        if (navigate.startsWith(rootPath)) {
          target = targetMenu.rootMenu.getChildByPath(navigate)
        }
        else if (navigate.startsWith('/')) {
          const firstPart = navigate.slice(1, navigate.indexOf('/', 1))
          const menu = menuDict[ firstPart ]
          target = menu?.getChildByPath(navigate)
        }
        else {
          target = menuDict[ navigate ]
        }
      }
      else if (typeof navigate === 'number') {
        target = targetMenu.rootMenu.getChildWithIndex(navigate)
      }

      if (target) {
        await CBHandler.setMenuActive(ctx, target)
      }
    }
    else if (close || typeof closeWith === 'string') {
      let closeMessage
      if (closeWith) {
        closeMessage = closeWith.trim()
      }
      else if (close) {
        closeMessage = ''
      }

      if (closeMessage) {
        const justMarkup = button.parent.text === closeMessage
        await CBHandler.closeMenu(ctx, closeMessage, justMarkup)
        this.deleteMenu(button.parent)
      }
      else {
        await CBHandler.closeMenu(ctx, '')
        this.deleteMenu(button.parent)
      }
    }
    else if ((button.parent.changeFlags & Change.Text) === Change.Text) {
      await CBHandler.setMenuActive(ctx, button.parent)
    }
    else if (targetMenu.changeFlags) {
      await CBHandler.setMenuActive(ctx, targetMenu)
    }
    else if (button.changeFlags) {
      await CBHandler.updateMenuContent(ctx, button.parent)
    }

    if (typeof value !== 'undefined') {
      if (keepPreviousValue) {
        if (!isValueAdded) {
          //@ts-ignore
          const valueStack = button.parent[ SYM_VALUE_STACK ]
          valueStack.pushValue(button.id, value)
        }
      }

      //@ts-ignore
      return button.parent[ SYM_VALUE_STACK ] ?? value
    }

    return SYM_EXEC_SUCCESS
  }

  /**
   * The instance of the `CallbackQueryHandler` class. It is recommended
   * to be only one instance of this, since a normal usage would have one
   * bot handler instance during the life time of the application.
   *
   * If you need to use more bots at the same time and will build menus
   * for each of them, you can have different instances of this class.
   *
   * @static
   * @type {CallbackQueryHandler}
   * @memberof CallbackQueryHandler
   */
  static readonly instance: CallbackQueryHandler
}

export const CBHandler = new CallbackQueryHandler()

//@ts-ignore
CallbackQueryHandler.instance = CBHandler
CBHandler.setMenuKeeper(CBHandler)
