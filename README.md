# Telegraf Inline Menu (telegram-inline-menu)

A package to build and handle telegraf inline keyboard menus.

This package provides you a way of structuring the menus as Javascript objects.
You can define `onPress` actions of the buttons, navigate through the menus
by setting `navigate` property to a `path` of a menu or using relative
navigation such as "`..`" to go to parent menu, or numberic index indicating
the creation order of the menu or relative negative index.

The example has many examples of usages inside.

# Examples
```ts
import { CBHandler, inlineMenu, IMenu } from 'telegram-inline-menu'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const menuLayout: IMenu = {
  id: 'main',
  text: 'Main menu, this menu has random ID.',
  buttons: {
    hello: 'Hello!',
    url: {
      text: 'GitHub',
      url: 'https://github.com',
    },
    countdown: {
      text: 'Countdown from 5',
      async * onPress(ctx, id, text, menu) {
        yield { message: 'About to countdown…' }
        await sleep(1000)
        yield { message: 'See the button text now' }
        for (let i = 5; i > 0; --i) {
          yield { text: `Last ${i}...` }
          await sleep(1000)
        }

        yield { closeWith: 'Operation is completed' }
      }
    },
    subMenu: {
      text: 'This is the inner menu after main',
      buttonText: 'Sub Menu',
      full: true,
      buttons: {
        back: { text: 'Go Back', navigate: '..' },
        nextMenu: { text: 'Go Next', navigate: '../thirdMenu' }
      }
    },
    thirdMenu: {
      text: 'This is the third menu belonging to the main, but not from main',
      hide: true,
      buttons: {
        back: { text: 'Back', navigate: -1 },
        update: {
          text: 'Update Text',
          onPress() {
            return { message: 'Third menu text is updated' }
          }
        },
        close: {
          text: 'Close',
          full: true,
          onPress() {
            return {
              close: true
            }
          }
        }
      }
    }
  }
}

// Optionally you can register a method missing handler if any of your buttons
// do not have `onPress` property.
CBHandler.onMethodMissing((text, path, query) => {
  console.log('A button with text', text, 'on', path, 'is pressed')
})

const telegraf = new Telegraf('YOUR_TOKEN')
CBHandler.attach(telegraf)

telegraf.on('text', async ctx => {
  await CBHandler.showMenu(ctx, inlineMenu(layout))
})

telegraf.startPolling()
telegraf.launch().catch(console.error)
```

# Setup
Setup is as it is shown in the example.
- Import the components of this package.
- Optionally use `CBHandler.onMethodMissing`.
- Get a menu builder instance by `inlineMenu(layout)` function by giving the
menu layout.

- Register the menu to CBHandler to allow other registered menus use each others
path and IDs.
- Attach the `CBHandler` to the `Telegraf` instance. This will use
`callback_query` handler to show the related menu or take the action.
- Show menu by `CBHandler.showMenu(context, menuBuilder)` to send the menu
as a separate message.

# Components
The library has several components inside, which all should have their own part
to interact with user and the other components.

## CallbackQueryHandler
A `CallbackQueryHandler` class is to keep/track the menus inside attached to a
Telegraf instance so that it could manage the transitions between menus, like
when a menu button has a navigation path such as `/secondary/` so that another
menu should appear, and also the class uses a "`keeper`" object which is used
to relate the menu instances with it in a `WeakMap`. Hence, if you have another
library or some other object keeping the data of your bot, you can use it as
the `keeper` of the class instance so that whenever that `keeper` is garbage
collected, the other menu instances will also be able to be garbage collected.
To set a custom keeper, you can use `CallbackQueryHandler.setMenuKeeper(obj)`
function. By default, the given instance by the library uses itself as a
`keeper`.

Likewise this component has `onMethodMissing` function which has
`buttonText`, `buttonPath`, and the `CallbackQuery` object of the Telegraf.
This function could be used when your layout does not define a `onPress`
function for your button. You can get the `ID` of the button from its path.

You should attach your `CallbackQueryHandler` instance to your `Telegraf`
instance. If you want to have more instance, just create with `new`. Normally,
this library provides you an instance already named `CBHandler`.

## MenuBuilder
This class provides another way of building menus, you will have functions
like `button()`, `menu()`, `navigate()` and such. With these functions you
can build your menu likewise.

Don't forget that you should `end()` your button builders before building
another one and also you should `end()`/`endMenu()` your menu before building
some other menu.

Building a menu inside a menu is actually just having another button navigating
to another menu builder.

There is also a `inlineMenu(layout)` function provided by the library that
takes a layout object and returns a builder. It returns a builder because
you may also want to continue building the menu from that part or pass the
instance around your functions. Or, you can change a several parts of your menu
every time, for example, a function is called.

It is why the library functions wants `MenuBuilder` instances instead of the
built `Menu` instance.

### The same menu layout of above with MenuBuilder
```ts
new MenuBuilder('Main menu, this menu has "main" id', 'main')
  .button('Hello!', 'hello').end()
  .button('GitHub', 'url').setUrl('https://github.com').end()
  .button('Countdown from 5', 'countdown').setOnPress(async function* () {
    yield { message: 'About to countdown…' }
    await sleep(1000)
    yield { message: 'See the button text now' }
    for (let i = 5; i > 0; --i) {
      yield { text: `Last ${i}...` }
      await sleep(1000)
    }

    yield { closeWith: 'Operation is completed' }
  }).end()

  .menu('This is the inner menu after main', 'Sub Menu', 'subMenu', true)
  .navigation('Go Back', '..', 'back').end()
  .navigation('Go Next', '../thirdMenu', 'nextMenu').end()
  .endMenu()

  .menu('This is the third menu belonging to the main, but not froun main', 'thirdMenu', false, true)
  .navigation('Back', -1, 'back').end()
  .button('Update Text', 'update').setOnPress(() => ({ message: 'Third menu text is updated' })).end()
  .button('Close', 'close').setFull(true).setOnPress(() => ({ close: true })).end()
  .endMenu()

  .endMenu()
```

# Notes
- Any object having `buttons` object property will be assumed as a menu.
- `text` property of a menu indicates the `message` that will be shown to user.
- `onPress()` functions might be async, generator-returning or async generator
functions. If the function is (async) generator, an object affecting the next
step could be returned every time, as you can see in the example.
- `navigate` property may be a string indicating the `id` of the menu, which
is simply the property name of the menu, or a `path` of a menu such as
`/main/subMenu/` or a relative path such as `../siblingMenu` or an index such
as `-1` indicating the one previous from the menu that the button is in.
- `full` property of buttons indicates whether the button should be full-width.
- `full` and `hide` properties may have a (async) function determining the
state of the button.

# Caveats
- Since the `ContextMessageUpdate` of the Telegraf may be used in async function
it will be blocked/prevented to do changes on the Telegram. So be careful about
your async functions, if possible use them with timeouts possibly with
`Promise.race`.

- To prevent collisions when any of the menus sent closed, the menus without
their `id` property is set, will be set automatically. So if you want to use
absolute paths to open a menu, be sure that you set a unique `id` for that menu.
Or, simply use relative paths.

- If your menu is not closed, it is still kept in map so that if you send the
same menu again, the buttons and the message might not be shown as expected.

---

If you want to support to the project:

```md
- Bitcoin     : 153jv3MQVNSvyi2i9UFr9L4ogFyJh2SNt6
- Bitcoin Cash: qqkx22yyjqy4jz9nvzd3wfcvet6yazeaxq2k756hhf
- Ether       : 0xf542BED91d0218D9c195286e660da2275EF8eC84
- Stellar     : GATF6DAKFCYY3MLNAIWVISARP52EWPOPFFZT4JMFENPNPERCMTSDFNY5
```

Thank You.
