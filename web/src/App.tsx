import './index.css'
import ChatApp from './pages/chat.tsx'
import { ThemeProvider } from "@/components/theme/theme-provider"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="rag-ui-theme">
      <ChatApp />
    </ThemeProvider>
  )
}

export default App
