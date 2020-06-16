import { ContextMessageUpdate } from 'telegraf'
import { CallbackQuery } from 'telegraf/typings/telegram-types'

import { Menu } from './menu'

export type ButtonActionResult = undefined | void | {
  /**
   * The absolute or relative path, id or the relative negative index
   * of the target menu to navigate.
   *
   * @type {(string | number)}
   */
  navigate?: string | number

  /**
   * Indicates that the button should be hidden or not in next frame.
   *
   * @type {boolean | Func<Promise<boolean> | boolean>}
   */
  hide?: boolean | Func<Promise<boolean> | boolean>

  /**
   * The new text of the button to update in next frame.
   *
   * @type {string}
   */
  text?: string

  /**
   * Indicates whether the button should be full-wide (row) or not in the
   * next frame.
   *
   * @type {boolean | Func<Promise<boolean> | boolean>}
   */
  full?: boolean | Func<Promise<boolean> | boolean>

  /**
   * The new message to update in next frame of the related markup.
   *
   * @type {string}
   */
  message?: string

  /**
   * The message to be sent after closing the inline keyboard.
   *
   * @type {string}
   */
  closeWith?: string

  /**
   * Indicates whether the inline keyboard will be closed in next frame or not.
   *
   * @type {boolean}
   */
  close?: boolean
  /**
   * Indicates whether the previous value should be kept in return if another
   * menu will be shown by the `menu` property.
   *
   * `true` by default.
   *
   * @type {boolean}
   */
  keepPreviousValue?: boolean

  /**
   * Any extra value to carry to next calls or to return with.
   *
   * @type {*}
   */
  value?: any
}

export type MenuOpts = { text: string, buttonText: string, id?: string, buttonId?: string, full: boolean, hide: boolean }

export type OnButtonPressFunction<T extends ButtonActionResult = ButtonActionResult> = (params: {
  /**
   * The Context.
   */
  ctx: ContextMessageUpdate,

  /**
   * The ID of the button.
   */
  id: string,

  /**
   * The text of the button.
   */
  text: string,

  /**
   * The menu containing the button.
   */
  menu: Readonly<Menu>,

  /**
   * The previous values returned from the previous calls.
   *
   * @type {any[]}
   */
  previousValues?: any[]
}) => ButtonActionResult | Promise<ButtonActionResult> | Generator<T> | AsyncGenerator<T>

export interface IMenuButtonState {
  full?: boolean
  hide?: boolean
}

export type IMenuButton = IMenuButtonState & {
  /**
   * The text of the button.
   *
   * @type {string}
   * @memberof IMenuButton
   */
  text: string

  /**
   * The URL address for the button.
   *
   * @type {string}
   * @memberof IMenuButton
   */
  url?: string

  /**
   * The absolute or relative path, id or the relative negative index
   * of the target menu to navigate.
   *
   * @type {(string | number)}
   * @memberof IMenuButton
   */
  navigate?: string | number

  /**
   * Function to execute when the button is pressed.
   *
   * If the function is not given, then it will be forwarded to
   * onMethodMissing function handler with the `text` of the button,
   * the `path` of the button and the `callback_query` data.
   *
   * @type {OnButtonPressFunction}
   * @memberof IMenuButton
   */
  onPress?: OnButtonPressFunction
}

export interface IMenuButtons {
  [ id: string ]: string | IMenuButton | ISubMenu
}

export type ISubMenu = IMenu & IMenuButtonState & {
  /**
   * The text of the navigation/menu button.
   *
   * @type {string}
   */
  buttonText: string

  /**
   * The id of the navigation/menu button.
   *
   * @type {string}
   */
  buttonId?: string
}

export interface IMenu {
  /**
   * The custom ID of the menu.
   *
   * @type {string}
   * @memberof IMenu
   */
  id?: string

  /**
   * The text of the button.
   *
   * @type {string}
   * @memberof IMenu
   */
  text: string

  /**
   * The buttons of the menu.
   *
   * @type {IMenuButtons}
   * @memberof IMenu
   */
  buttons: IMenuButtons
}

/**
 * A handler when a method is missing/not registered.
 */
export type OnMethodMissingHandler = (
  /**
   * The text of the button.
   * @type {string}
  */
  buttonText: string,

  /**
   * The path of the button.
   * @type {string}
  */
  path: string,

  /**
   * The callback query object.
   * @type {CallbackQuery}
   */
  callbackQuery: CallbackQuery,

  /**
   * The previous values of the calls.
   */
  previousValues: any[]
) => ButtonActionResult | Promise<ButtonActionResult>

/**
 * A handler when a value is passed/returned to the generator.
 */
export type OnGeneratorStepHandler = (
  ctx: ContextMessageUpdate,
  value: any,
  buttonActionExecuter: (value: ButtonActionResult) => Promise<boolean>
) => any
