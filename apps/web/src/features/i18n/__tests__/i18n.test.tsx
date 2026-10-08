import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from '../i18n-provider'

function TestComponent() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div>
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="translated-title">{t('settings.title')}</span>
      <span data-testid="translated-greeting">{t('common.save')}</span>
      <button onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}>Toggle Language</button>
    </div>
  )
}

describe('i18n provider & hook', () => {
  it('defaults to vi and translates keys correctly', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    )

    expect(screen.getByTestId('current-locale')).toHaveTextContent('vi')
    expect(screen.getByTestId('translated-title')).toHaveTextContent('Cài đặt tài khoản')
    expect(screen.getByTestId('translated-greeting')).toHaveTextContent('Lưu thay đổi')
  })

  it('switches locale dynamically when setLocale is called', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    )

    await user.click(screen.getByRole('button', { name: /toggle language/i }))

    expect(screen.getByTestId('current-locale')).toHaveTextContent('en')
    expect(screen.getByTestId('translated-title')).toHaveTextContent('Account Settings')
    expect(screen.getByTestId('translated-greeting')).toHaveTextContent('Save changes')
  })

  it('renders gracefully even without provider wrapping', () => {
    render(<TestComponent />)
    expect(screen.getByTestId('current-locale')).toHaveTextContent('vi')
    expect(screen.getByTestId('translated-title')).toHaveTextContent('Cài đặt tài khoản')
  })
})
