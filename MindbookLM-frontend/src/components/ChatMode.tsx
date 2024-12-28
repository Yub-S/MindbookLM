import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
};

type ChatModeProps = {
  messages: Message[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: (message: string) => void;
  onBack: () => void;
};

export function ChatMode({ messages, inputValue, onInputChange, onSendMessage, onBack }: ChatModeProps) {
  const [showFullChat, setShowFullChat] = useState(false);

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    setShowFullChat(true);
    onSendMessage(inputValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto px-6"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-6 text-gray-600 hover:text-purple-500 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {!showFullChat ? (
        <>
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">Chat with Your Memories</h2>
            <p className="text-gray-500 dark:text-gray-400">Ask anything about your stored memories</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group"
          >
            <div className="absolute inset-x-0 h-16 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-2xl -top-2 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <div className="relative flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-2 border-purple-500/30 group-hover:border-purple-500/50 transition-all">
              <Search className="w-6 h-6 text-gray-400 group-hover:text-purple-500 transition-colors" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                placeholder="Ask me anything about your memories..."
                className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-gray-400"
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg group"
              >
                <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          <div className="mt-12 flex items-center gap-4 justify-center text-sm text-gray-500 dark:text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>Your memories are ready to be explored</span>
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl shadow-xl p-6 h-[600px] flex flex-col border-2 border-purple-500/20"
        >
          <ScrollArea className="flex-1 pr-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mb-4 max-w-[80%]",
                    message.sender === 'user' ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "p-4 rounded-2xl",
                      message.sender === 'user'
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none"
                        : "bg-gray-100 dark:bg-gray-700 rounded-bl-none"
                    )}
                  >
                    {message.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </ScrollArea>

          <div className="mt-4 flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Type your message..."
              className="resize-none bg-white dark:bg-gray-800 border-2 border-purple-500/30 focus:border-purple-500/50 rounded-xl transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              onClick={handleSubmit}
              size="icon"
              className="h-auto aspect-square bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl group"
            >
              <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}