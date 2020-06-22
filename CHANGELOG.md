# 0.1.7
## Added
- `extra` as `ExtraEditMessage` to menus and their builders and button actions
for updating the `extra` of the message related to the menu.

# 0.1.6
## Fixed
- The buttons may not work after a several navigations.

# 0.1.5
## Added
- `CallbackQueryHandler.{setQueryHandler,setOnUnhandledQueryHandler}` functions
to let other structures use/pipe the `.on('callback_query')` handler set by the
`CBHandler.attach(ref)`. So that there would still be a way to process the
context of the message while still letting the `CBHandler` do its work.

# 0.1.4
## Added
- `MenuBuilder.buildAnotherInstance()` function to build another instance of
the same menu if the menu itself is created by a function. This will cause the
function to be executed again to generate the same menu through the function.

## Fixed
- Dynamically generated menus (by a function) might not be updated if any of
its buttons of the menu returns `{ update: true }`.

## Changed
- Improved change detection of a dynamically generated menu.

# 0.1.2
## Fixed
- Updating a dynamic menu from a button is not updating the menu due to the
updates on the same object, so the changes can't be tracked.

# 0.1.1
## Added
- Documentation for `full` and `hide` properties of menu buttons.
- Dynamic menu creation at the beginning. Now `inlineMenu` may take a function
that generates a menu and when a button inside of that menu returns an object
with its `update` property is `true`, the function will be executed again to
re-draw the menu to replace.

## Fixed
- The ID of dynamically generated button was not used in comparison of change
detection.


# 0.1.0
## Added
- `CallbackQueryHandler.setOnError` function to catch errors.
- Updated the type definitions of `hide` and `full` properties of a button.
Now the can be a function returning a boolean value indicating their states.
- `menu: IMenu` property to buttons. When a button returns a menu layout, that
menu will be created and added to the tracking menus dictionary and be shown
to the user. The menu will be created dynamically.
- `menu: (id: string, values: any[]) => IMenu | Promise<IMenu>` property to
buttons. This is a function that creates a menu dynamically and the dynamically
generated id can be reached by the parameter for using it for navigation
purposes. And the `values` parameter having the previously returned `value`-s
of the parent buttons to build the menu according to them.

- `value: any` property to buttons. This will be used when building menus
dynamically.
- `MenuBuilder.isChanged` property indicating whether a menu has any change
after it has been shown previously.
- `update: boolean` property to buttons. Set this to `true` if you want your
menu be built again by the provided menu builder function.

---

# 0.0.5
## Added
- `setOnError(handler: (e: Error) => void)` function to
`CallbackQueryHandler`.

## Changed
- The return type of the `CallbackQueryHandler.attach()` function. Now, returns
`true` if the attaching to a `Telegraf` instance is done for the first time.
`false` if it is already attached.

---

# 0.0.4
## Added
- `setOnMenuDelete(handler: (id: string) => void)` and
`setOnMenuClose(handler: (menuBuilder: MenuBuilder | undefined) => void)`
functions to `CallbackQueryHandler` class.
