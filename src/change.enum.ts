/**
 * Flag of a change of a menu butotn.
 *
 * @export
 * @enum {number}
 */
export const enum Change {
  /**
   * Indicates no change.
   */
  None = 0,

  /**
   * Indicates a change on text property.
   */
  Text = 1 << 0,

  /**
   * Indicates a change on hide property.
   */
  Visibility = 1 << 1,

  /**
   * Indicates a change on full property.
   */
  Layout = 1 << 2,

  /**
   * Indicates that the item is not built yet and needs to be drawn first.
   */
  Draw = 1 << 3,

  /**
   * Indicates that the item should be updated, hence it will check whether
   * the text and/or buttons are changed or not.
   */
  Update = 1 << 4,
}
