import { nanoid } from 'nanoid'
import Telegraf, { ContextMessageUpdate, Extra, Markup } from 'telegraf'
import { ExtraEditMessage } from 'telegraf/typings/telegram-types'

import { Change } from './change.enum'
import { SYM_DYNAMIC_MENU_BUILDER, SYM_VALUE_STACK } from './commons'
import { isButtonActionResultLike, isGenerator, isPromise } from './helpers'
import { MenuBuilder } from './menu-builder'
import { MenuItemBuilder } from './menu-item-builder'

import type { ButtonActionResult, IDynamicMenuContext, OnButtonPressFunction, OnGeneratorStepHandler, OnMethodMissingHandler } from './types'

const SYM_EXEC_SUCCESS = Symbol('@@buttonActionSuccess')
const SYM_EXEC_FAIL = Symbol('@@buttonActionFailure')

type IParamCloseMenu = {
  /**
   * The Context.
   *
   * @type {ContextMessageUpdate}
   */
  ctx: ContextMessageUpdate,

  /**
   * The text to be shown after closing the menu.
   *
   * @type {string}
   */
  withText?: string,

  /**
   * The extras of the text.
   *
   * @type {ExtraEditMessage}
   */
  extra?: ExtraEditMessage,

  /**
   * Indicates whether to remove the markup only or not.
   *
   * @type {boolean}
   */
  justRemoveMarkup?: boolean
}

class CallbackQueryHandler {
  private _isAttached = false
  private _menuMap: WeakMap<any, Dictionary<MenuBuilder>> = new WeakMap()
  private _activeMenusOfKeepers: WeakMap<any, MenuBuilder> = new WeakMap()

  private _keeper: any
  private _activeMenu?: MenuBuilder
  private _generatorHandler?: OnGeneratorStepHandler

  private _onError?: (e: Error) => void
  private _onMenuDelete?: (id: string) => void
  private _onMethodMissing?: OnMethodMissingHandler
  private _onGeneratorValueHandler?: OnGeneratorStepHandler
  private _onCallbackQuery?: (ctx: ContextMessageUpdate) => void
  private _onMenuClose?: (menuBuilder: MenuBuilder | undefined) => void
  private _onUnhandledCallbackQuery?: (ctx: ContextMessageUpdate) => void

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
  get activeMenu(): MenuBuilder | undefined {
    return this._activeMenusOfKeepers.get(this._keeper)
  }

  set activeMenu(to: MenuBuilder | undefined) {
    if (!to) {
      this._activeMenusOfKeepers.delete(this._keeper)
      return
    }

    this._activeMenusOfKeepers.set(this._keeper, to)

    if (!to.isCreatedByFunction) { return }
    if (!this._menuMap.has(this._keeper)) { return }
    const menuDict = this._menuMap.get(this._keeper)!
    if (to.id in menuDict) {
      menuDict[ to.id ] = to
    }
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
      that._onCallbackQuery?.(ctx)
      const { callbackQuery } = ctx
      if (!callbackQuery) { return }

      const { data } = callbackQuery
      if (!data) { return }

      const menuDict = that._menuMap.get(that._keeper)
      if (!menuDict) {
        that._onUnhandledCallbackQuery?.(ctx)
        return
      }

      const segments = data.split('/').slice(1)
      const menuId = segments.shift()!

      const previousMenu: MenuBuilder | undefined = menuDict[ menuId ]
      const button = previousMenu?.getMenuItemByPath(data)
      if (!button) {
        that._onUnhandledCallbackQuery?.(ctx)
        return
      }

      const targetMenu = button.parent
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
        if (menuId === targetMenu.id) {
          if (previousMenu.buttons !== targetMenu.buttons) {
            menuDict[ menuId ] = targetMenu
          }
        }

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
   * @param {ExtraEditMessage} [extra] Extras of the menu.
   * @returns The value returned from `ctx.reply`.
   * @memberof CallbackQueryHandler
   */
  async showMenu(ctx: ContextMessageUpdate, menuBuilder: MenuBuilder, extra?: ExtraEditMessage) {
    const menu = await menuBuilder.toMenu()
    this.registerMenu(menuBuilder)
    extra = mergeObjects(menuBuilder[ '_extra' ], extra, Extra.markup(Markup.inlineKeyboard(menu.buttons)))
    return await ctx.reply(menuBuilder.text, extra)
  }

  /**
   * Closes/removes a menu with an optionally given text.
   *
   * @param {ContextMessageUpdate} ctx Context.
   * @param {string} [withText] The text to update the message.
   * @param {boolean} [justRemoveMarkup=false] Indicates whether only the
   * markup should be removed or not.
   *
   * @param {ExtraEditMessage} [extra] The extra message to be applied only if
   * `withText` is given.
   *
   * @returns {Promise<void>} The promise of this action.
   * @memberof CallbackQueryHandler
   */
  async closeMenu(ctx: ContextMessageUpdate, withText?: string, justRemoveMarkup?: boolean, extra?: ExtraEditMessage): Promise<void>;

  /**
   * Closes/removes a menu with an optionally given text.
   *
   * @param {ContextMessageUpdate} ctx Context.
   * @param {string} [withText] the text to update the message.
   * @param {ExtraEditMessage} [extra] The extra of the message to be applied
   * only if `withText` is given.
   *
   * @returns {Promise<void>} The promise of this action.
   * @memberof CallbackQueryHandler
   */
  async closeMenu(ctx: ContextMessageUpdate, withText?: string, extra?: ExtraEditMessage): Promise<void>;

  /**
   * Closes/removes a menu with given option parameter.
   *
   * @param {IParamCloseMenu} params The option parameter.
   * @returns {Promise<void>} The promise of this action.
   * @memberof CallbackQueryHandler
   */
  async closeMenu(params: IParamCloseMenu): Promise<void>

  async closeMenu(ctxOrOpts: ContextMessageUpdate | IParamCloseMenu, withText?: string, extraOrJustRemoveMarkup?: boolean | ExtraEditMessage, extra?: ExtraEditMessage) {
    let currentText = this.activeMenu?.text

    let ctx: ContextMessageUpdate
    let justRemoveMarkup = false

    if ('ctx' in ctxOrOpts) {
      ctx = ctxOrOpts.ctx
      withText = ctxOrOpts.withText
      justRemoveMarkup = ctxOrOpts.justRemoveMarkup ?? false
      extra = ctxOrOpts.extra
    }
    else if (typeof extraOrJustRemoveMarkup === 'boolean') {
      ctx = ctxOrOpts
      justRemoveMarkup = extraOrJustRemoveMarkup
    }
    else if (typeof extraOrJustRemoveMarkup === 'object') {
      ctx = ctxOrOpts
      extra = extraOrJustRemoveMarkup
    }
    else {
      ctx = ctxOrOpts
    }

    if (withText) {
      if (justRemoveMarkup) {
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
      }
      else {
        withText = withText.trim()
        if (withText === currentText) {
          await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
        }
        else {
          extra = mergeObjects(extra, Extra.markup(Markup.inlineKeyboard([])))
          await ctx.editMessageText(withText, extra)
        }
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

    this.activeMenu = undefined
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

  /**
   * Sets a handler whenever the `callback_query` occurs even if it is handled
   * by this instance or not.
   *
   * @param {(ctx: ContextMessageUpdate) => void} handler The handler.
   * @memberof CallbackQueryHandler
   */
  setQueryHandler(handler: (ctx: ContextMessageUpdate) => void) {
    this._onCallbackQuery = handler
  }

  /**
   * Sets a handler whenever the `callback_query` occurs and it is not handled
   * by this instance.
   *
   * @param {(ctx: ContextMessageUpdate) => void} handler The handler.
   * @memberof CallbackQueryHandler
   */
  setUnhandledQueryHandler(handler: (ctx: ContextMessageUpdate) => void) {
    this._onUnhandledCallbackQuery = handler
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
    if (menu.isChanged && !menu.hasAnyChange(Change.Draw, Change.Text, Change.Update)) {
      await this.updateMenuContent(ctx, menu)
      return
    }

    let isUpdating = menu.hasChange(Change.Update)
    const { buttons: oldButtons, text: oldText } = menu
    const builtMenu = await menu.toMenu()

    if (isUpdating) {
      if (this._activeMenu) {
        if (oldText === builtMenu.text) {
          for (const key in oldButtons) {
            const button = oldButtons[ key ]

            const hasChange = builtMenu.buttons.some(cols => {
              return cols.some(item => {
                const idFromCallback = item.callback_data.split('/').pop()
                if (button.id !== idFromCallback) { return false }
                if (button.text !== item.text) { return true }
                if (!button.isPure) { return true }
                if (button.hide !== item.hide) { return true }
                return false
              })
            })

            if (hasChange) {
              await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(builtMenu.buttons))
              return
            }
          }

          const dynamicMenuBuilder = await menu.buildAnotherInstance()
          if (dynamicMenuBuilder) {
            const dynamicMenu = await dynamicMenuBuilder.toMenu(true)
            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(dynamicMenu.buttons))
            this.activeMenu = dynamicMenuBuilder
            return
          }
        }
      }
    }

    this.activeMenu = menu
    const extra = mergeObjects(menu[ '_extra' ], Extra.markup(Markup.inlineKeyboard(builtMenu.buttons)))
    await ctx.editMessageText(builtMenu.text, extra)
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
      menu,
      update = false,
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
    else if (typeof menu === 'object') {
      const { parent } = button
      let builtMenu = button[ 'dynamicMenu' ]

      if (builtMenu) {
        builtMenu[ '_detach' ]()
        builtMenu = undefined
      }

      if (!builtMenu) {
        if (!menu.id) {
          menu.id = nanoid(8)
        }

        builtMenu = MenuBuilder.fromObject(menu)
        button[ 'dynamicMenu' ] = builtMenu
        builtMenu[ '_attach' ](parent)

        if (keepPreviousValue) {
          const valueStack = parent[ '_getValueStack' ]()
          valueStack.pushValue(button.id, value)
          isValueAdded = true

          builtMenu[ '_getValueStack' ](valueStack)
        }
      }

      await CBHandler.setMenuActive(ctx, builtMenu)
    }
    else if (typeof menu === 'function') {
      const { parent } = button
      //@ts-ignore
      const currentValues: any[] = parent[ '_getValueStack' ]()
      const dynamicContext = makeDynamicMenuContext(parent, button[ 'dynamicMenu' ]?.id)
      const menuLayout = await menu.call(dynamicContext, dynamicContext.id, currentValues)
      menuLayout.id = dynamicContext.id

      let builtMenu = button[ 'dynamicMenu' ]
      if (builtMenu) {
        builtMenu[ '_detach' ]()
        builtMenu = undefined
      }

      builtMenu = MenuBuilder.fromObject(menuLayout)

      //@ts-ignore
      builtMenu[ SYM_DYNAMIC_MENU_BUILDER ] = async function dynamicMenuBuilder() {
        const newLayout = await menu.call(dynamicContext, dynamicContext.id, currentValues)
        newLayout.id = dynamicContext.id

        const newMenu = MenuBuilder.fromObject(newLayout)

        //@ts-ignore
        newMenu[ 'changeFlags' ] = Change.Draw
        //@ts-ignore
        newMenu[ SYM_DYNAMIC_MENU_BUILDER ] = dynamicMenuBuilder

        button[ 'dynamicMenu' ] = newMenu
        newMenu[ '_attach' ](parent)

        return newMenu
      }

      //@ts-ignore
      builtMenu[ 'changeFlags' ] = Change.Draw
      button[ 'dynamicMenu' ] = builtMenu
      builtMenu[ '_attach' ](parent)

      if (keepPreviousValue) {
        const valueStack = parent[ '_getValueStack' ]()
        valueStack.push(value)
        isValueAdded = true

        builtMenu[ '_getValueStack' ](valueStack)
      }

      await CBHandler.setMenuActive(ctx, builtMenu)
    }
    else if (update) {
      //@ts-ignore
      targetMenu.changeFlags = Change.Update
      await CBHandler.setMenuActive(ctx, targetMenu)
    }
    else if ((button.parent.changeFlags & Change.Text) === Change.Text) {
      if ('extra' in action) {
        button.parent.setExtra(action.extra)
      }

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

function makeDynamicMenuContext(parent: MenuBuilder, id = nanoid(12)): IDynamicMenuContext {
  return {
    id,
    path: `${parent.path}${id}/`,
    parent: {
      id: parent.id,
      index: parent.index,
      isPure: parent.isPure,
      text: parent.text,
      path: parent.path,
    },
    willDetach: true,
  }
}

function mergeObjects<T = any>(...extras: (T | undefined)[]) {
  return extras.reduce<T>((prev, curr) => {
    if (typeof curr !== 'object') { return prev }

    for (const key in curr) {
      if (typeof curr[ key ] === 'object') {
        if (typeof prev[ key ] === 'object') {
          if (Array.isArray(curr[ key ])) {
            prev[ key ] = curr[ key ]
          }
          else {
            prev[ key ] = mergeObjects(prev[ key ], curr[ key ])
          }

          continue
        }
      }

      prev[ key ] = curr[ key ]
    }

    return prev!
  }, {} as T)
}
