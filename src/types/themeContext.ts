export enum Theme {
  ShelvDark = 'shelv-dark',
  ShelvLight = 'shelv-light',
  Black = 'black',
}

export interface IThemeContext {
  theme: Theme
  setTheme: (theme: Theme) => void
}
