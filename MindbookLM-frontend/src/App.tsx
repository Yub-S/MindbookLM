import { useState } from 'react';
import { ClerkProvider, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useAuth, useSignUp } from '@clerk/clerk-react';
import { LandingHero } from '@/components/LandingHero';
import { ModeSelector } from '@/components/ModeSelector';
import { InjectMode } from '@/components/InjectMode';
import { ChatMode } from '@/components/ChatMode';
import { cn } from '@/lib/utils';
import { querySystem, addNote } from '@/lib/api';
import type { Message } from '@/types';

// Separate component that uses useAuth
function AuthenticatedApp() {
  const { isSignedIn, getToken } = useAuth(); 
  const signUp = useSignUp();
  const [mode, setMode] = useState<'landing' | 'inject' | 'chat'>('landing');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);

  const handleModeSelection = (newMode: 'landing' | 'inject' | 'chat') => {
    if (!isSignedIn && newMode !== 'landing') {
      if (signUp.setActive) {
        signUp.setActive({});
      }
      return;
    }
    setMode(newMode);
  };

  const handleTell = async () => {
    if (!inputText.trim() || isInjecting) return;
    
    setIsInjecting(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token is null");
      }
      const response = await addNote(inputText, () => Promise.resolve(token));
      if (response.error) {
        console.error('Error adding note:', response.error);
      } else {
        setInputText('');
      }
    } catch (error) {
      console.error('Error in handleTell:', error);
    } finally {
      setIsInjecting(false);
    }
  };

  const handleChat = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    const newMessages = [
      ...messages,
      { id: Date.now().toString(), content: message, sender: 'user' as const },
    ];
    
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Token is null");
      }
      const response = await querySystem(message, () => Promise.resolve(token));
      
      if (response.error) {
        setMessages([
          ...newMessages,
          {
            id: (Date.now() + 1).toString(),
            content: "Sorry, I encountered an error while processing your message.",
            sender: 'assistant',
          },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            id: (Date.now() + 1).toString(),
            content: response.data.querySystem,
            sender: 'assistant',
          },
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([
        ...newMessages,
        {
          id: (Date.now() + 1).toString(),
          content: "Sorry, something went wrong while processing your message.",
          sender: 'assistant',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className={cn(
        "w-full mx-auto",
        mode === 'landing' ? 'max-w-7xl min-h-screen flex flex-col ' : ''
      )}>
        <LandingHero minimal={mode !== 'landing'} />
        
        {mode === 'landing' && (
          <div className="flex-1 flex items-center justify-center ">
            <ModeSelector onSelectMode={handleModeSelection} />
          </div>
        )}
        
        <SignedIn>
          {mode === 'inject' && (
            <InjectMode
              value={inputText}
              onChange={setInputText}
              onSubmit={handleTell}
              onBack={() => handleModeSelection('landing')}
              isInjecting={isInjecting}  
            />
          )}

          {mode === 'chat' && (
            <ChatMode
              messages={messages}
              inputValue={inputText}
              onInputChange={setInputText}
              onSendMessage={handleChat}
              onBack={() => handleModeSelection('landing')}
              isLoading={isLoading}
            />
          )}
        </SignedIn>
      </div>

      <SignedIn>
        <div className="fixed bottom-4 left-4">
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-10 h-10 rounded-full border-2 border-purple-500 hover:border-blue-500 transition-colors duration-200"
              }
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
}

// Main App component with ClerkProvider
function App() {
  return (
    <ClerkProvider 
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative pb-16">
        <header className="w-full px-4 py-4">
          <div className="max-w-7xl mx-auto flex justify-end items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button 
                  data-signin-button="true"
                  className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:opacity-90 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:opacity-90 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </header>

        <AuthenticatedApp />
      </div>
    </ClerkProvider>
  );
}

export default App;