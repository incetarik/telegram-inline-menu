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
