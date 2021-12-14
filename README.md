<a href="https://beyonk.com">
    <br />
    <br />
    <img src="https://user-images.githubusercontent.com/218949/144224348-1b3a20d5-d68e-4a7a-b6ac-6946f19f4a86.png" width="198" />
    <br />
    <br />
</a>

## Svelte Scheduler

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com) [![CircleCI](https://circleci.com/gh/beyonk-adventures/svelte-scheduler.svg?style=shield)](https://circleci.com/gh/beyonk-adventures/svelte-scheduler) [![svelte-v3](https://img.shields.io/badge/svelte-v3-blueviolet.svg)](https://svelte.dev)

Calendaring component in Svelte

**This project is a work-in-progress. It doesn't work as advertised right now, we're just assessing the shape of things. You might consider avoiding it entirely, or opening a lot of PRs :)**

## Installation

`npm install --save-dev @beyonk/svelte-scheduler`

## Usage

Create an instance of the Scheduler, and pass it a method to fetch your monthly schedules.

In the example below this is a simple JSON file which has nested years, months, and days.

Inside each day is a reference to a component which should be rendered for that day, and a series of props to pass to it.

```jsx
Basic usage

// App.svelte
<Scheduler bind:fetchSchedule />

<script>
  import Scheduler from '@beyonk/svelte-scheduler'
  import Popdown from './Popdown.svelte'
  import get from 'just-safe-get'

  async function fetchSchedule (year, month) {
    return get(schedules, [ year, month ])
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: EventList,
          props: {}
        }
      }
    }
  }
</script>
```

Our EventList component responsively shows a quick day overview.

```jsx
// EventList.svelte
<p>
  ... whatever you want here.
</p>
```

Each render, and each time the month is changed, the fetchSchedule method will be called again. fetchSchedule returns a simple json object of days of the month.

## Events

```jsx
The scheduler fires a select event when a valid day is clicked, and sets the class 'is-selected' on that day in the calendar.

// App.svelte
<Scheduler on:select={select} />

<script>
  import Scheduler from '@beyonk/svelte-scheduler'
  import get from 'just-safe-get'

  function select (e) {
    const { year, month, day } = e.details
    // You can use year/month/day to fetch full information about an event.
  }
</script>
```
## Overview

```jsx
The scheduler can show a day-overview component when a day is clicked. Specify the 'overview' property on your month data.

The overview component receives the same props as your day component.

// App.svelte
<Scheduler bind:fetchSchedule />

<script>
  import Scheduler from '@beyonk/svelte-scheduler'
  import Popdown from './Popdown.svelte'
  import EventList from './EventList.svelte'
  import get from 'just-safe-get'

  async function fetchSchedule (year, month) {
    return get(schedules, [ year, month ])
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: EventList,
          overview: Popdown
          props: {}
        }
      }
    }
  }
</script>
```

Our Popdown component lists full event detail.

```jsx
// Popdown.svelte
<p>
  ... whatever you want here.
</p>
```
