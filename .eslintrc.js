'use strict'

module.exports = {
  "extends": "@beyonk",
  "globals": {
    "describe": "readonly",
    "context": "readonly",
    "it": "readonly",
    "beforeEach": "readonly",
    "afterEach": "readonly",
    "before": "readonly",
    "after": "readonly"
  },
  "parserOptions": {
    "ecmaVersion": 2019,
    "sourceType": "module"
  },
  "env": {
    "es6": true,
    "browser": true
  },
  "plugins": [
    "svelte3"
  ],
  "overrides": [
    {
      "files": [
        "**/*.svelte",
        "**/*.html",
      ],
      "rules": {
        "import/first": "off",
        "import/no-duplicates": "off",
        "import/no-mutable-exports": "off",
        "import/no-unresolved": "off",
        "no-multiple-empty-lines": "off"
      },
      "settings": {
        "svelte3/ignore-styles": attrs => attrs.lang === 'scss'
      },
      "processor": "svelte3/svelte3"
    }
  ]
}
