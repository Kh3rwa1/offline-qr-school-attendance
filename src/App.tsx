import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './app/LanguageProvider';
import { SessionProvider } from './app/SessionProvider';
import { ActiveSchoolProvider } from './app/ActiveSchoolProvider';
import { OfflineStatusProvider } from './app/OfflineStatusProvider';
import { QueryProvider } from './app/QueryProvider';
import { AppRouter } from './app/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <QueryProvider>
          <SessionProvider>
            <ActiveSchoolProvider>
              <OfflineStatusProvider>
                <AppRouter />
              </OfflineStatusProvider>
            </ActiveSchoolProvider>
          </SessionProvider>
        </QueryProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
