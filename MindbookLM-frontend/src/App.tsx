import { useState } from 'react';
import { LandingHero } from '@/components/LandingHero';
import { ModeSelector } from '@/components/ModeSelector';
import { InjectMode } from '@/components/InjectMode';
import { ChatMode } from '@/components/ChatMode';
import { cn } from '@/lib/utils';
import { querySystem, addNote } from '@/lib/api';
import type { Message } from '@/types';
//import { toast } from '@/components/ui/use-toast';

function App() {
  const [mode, setMode] = useState<'landing' | 'inject' | 'chat'>('landing');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);

  const handleTell = async () => {
    if (!inputText.trim() || isInjecting) return;
    
    setIsInjecting(true);
    try {
      const response = await addNote(inputText);
      if (response.error) {
        console.error('Error adding note:', response.error);;
      } else {;
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
      const response = await querySystem(message);
      
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
        mode === 'landing' ? 'max-w-7xl min-h-screen flex flex-col' : ''
      )}>
        <LandingHero minimal={mode !== 'landing'} />
        
        {mode === 'landing' && (
          <div className="flex-1 flex items-center justify-center">
            <ModeSelector onSelectMode={(newMode) => setMode(newMode)} />
          </div>
        )}

        {mode === 'inject' && (
          <InjectMode
            value={inputText}
            onChange={setInputText}
            onSubmit={handleTell}
            onBack={() => setMode('landing')}
            isInjecting={isInjecting}  
          />
        )}

        {mode === 'chat' && (
          <ChatMode
            messages={messages}
            inputValue={inputText}
            onInputChange={setInputText}
            onSendMessage={handleChat}
            onBack={() => setMode('landing')}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default App;