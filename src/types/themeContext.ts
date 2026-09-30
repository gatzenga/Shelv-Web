export enum Theme {
  Black = 'black',
  ShelvDark = 'shelv-dark',
  ShelvLight = 'shelv-light',
  Vesper = 'vesper',
  Mirage = 'mirage',
  MonokaiPro = 'monokai-pro',
  VueDark = 'vue-dark',
  NuclearDark = 'nuclear-dark',
  ShadesOfPurple = 'shades-of-purple',
  MarmaladeBeaver = 'marmalade-beaver',
}

export interface IThemeContext {
  theme: Theme
  setTheme: (theme: Theme) => void
}
