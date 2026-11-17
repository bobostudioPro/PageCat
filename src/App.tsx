import { HashRouter, Route, Routes } from 'react-router-dom';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderPage } from './pages/ReaderPage';
import { Toasts } from './components/ui/Toasts';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/read/:bookId" element={<ReaderPage />} />
        <Route path="*" element={<LibraryPage />} />
      </Routes>
      <Toasts />
    </HashRouter>
  );
}
