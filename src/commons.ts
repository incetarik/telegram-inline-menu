/**
 * Symbol used as a key for accessing value stack that is used for dynamic
 * menu generation through the buttons. So the values returned as a property
 * of an object returned from the button to generate a menu, are collected into
 * an array that is called "value stack". This symbol is used for accessing this
 * array to provide previous values for further (dynamically generated) menus.
 */
export const SYM_VALUE_STACK = Symbol('@@buttonActionValueStack')

/**
 * Symbol used as a key for accessing the dynamic menu builder that is set
 * for the first time the menu is created by a function.
 *
 * When a menu is created by a function at the beginning, this builder function
 * is set as an internal property with this symbol so that if any button returns
 * an object with its `update` property is set, then this function will be used
 * again to generate the same menu and replace with the current menu.
 */
export const SYM_DYNAMIC_MENU_BUILDER = Symbol('@@dynamicMenuBuilder')

/**
 * Symbol used as a key for keeping an internal information of indicating
 * whether the menu is built by a function for the first time, but not yet
 * being drawn, hence, this property will automatically be set for the first
 * time and then it will **NOT** cause re-draws because of the symbol used
 * above.
 */
export const SYM_FIRST_DYNAMIC_DRAW = Symbol('@@firstDynamicDraw')
