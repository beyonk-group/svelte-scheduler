import Scheduler from '../src/Scheduler.svelte'
import { render, cleanup } from '@testing-library/svelte'
import '@testing-library/jest-dom/extend-expect'
import fetchMock from 'fetch-mock'
import dayjs from 'dayjs'

describe('App', () => {
  beforeEach(() => {
    cleanup()
    mockAdventure()
  })

  afterEach(() => {
    fetchMock.reset()
  })

  test('should render greeting', () => {
    const { getByText } = render(Scheduler, { props: {} })

    expect(getByText('Book Now!'))
  })
})
