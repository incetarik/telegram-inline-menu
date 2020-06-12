interface Dictionary<T = any> {
  [ key: string ]: T
  [ key: number ]: T
}

declare type Func<TReturn = any, TArgs extends any[] = any[]> = (...args: TArgs) => TReturn
