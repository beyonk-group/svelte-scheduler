<p align="center">
  <img width="186" height="90" src="https://user-images.githubusercontent.com/218949/44782765-377e7c80-ab80-11e8-9dd8-fce0e37c235b.png" alt="Beyonk" />
</p>

## Svelte Scheduler

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com) [![CircleCI](https://circleci.com/gh/beyonk-adventures/svelte-mapbox.svg?style=shield)](https://circleci.com/gh/beyonk-adventures/svelte-mapbox) [![svelte-v3](https://img.shields.io/badge/svelte-v3-blueviolet.svg)](https://svelte.dev)

Calendaring component in Svelte

## Installation

`npm install --save-dev @beyonk/svelte-scheduler`

## Usage

Create an instance of the Scheduler, and pass it a method to fetch your monthly schedules.

In the example below this is a simple JSON file which has nested years, months, and days.

Inside each day is a reference to a component which should be rendered for that day, and a series of props to pass to it.

```jsx
// App.svelte
<Scheduler bind:fetchSchedule />

<script>
  import Scheduler from '@beyonk/svelte-scheduler'
  import Smiley from './Smiley.svelte'
  import get from 'just-safe-get'

  async function fetchSchedule (year, month) {
    return get(schedules, [ year, month ])
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: Smiley,
          props: {}
        }
      }
    }
  }
</script>
```

Our Smiley component is just a smiley.

```jsx
// Smiley.svelte
<p>
😊
</p>
```

Each render, and each time the month is changed, the fetchSchedule method will be called again. fetchSchedule returns a simple json object of days of the month.
