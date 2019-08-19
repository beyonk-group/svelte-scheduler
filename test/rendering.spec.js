import Widget from '../src/Widget.svelte'
import { render, cleanup } from '@testing-library/svelte'
import '@testing-library/jest-dom/extend-expect'
import fetchMock from 'fetch-mock'

describe('App', () => {
  beforeEach(() => {
    cleanup()
    mockAdventure()
  })

  afterEach(() => {
    fetchMock.reset()
  })

  test('should render greeting', () => {
    const { getByText } = render(Widget, { props: { id: 'beyo12' } })

    expect(getByText('Book Now!'))
  })
})
