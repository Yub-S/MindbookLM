import { motion } from 'framer-motion';
import { Brain, MessageCircle } from 'lucide-react';

type ModeSelectorProps = {
  onSelectMode: (mode: 'inject' | 'chat') => void;
};

export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-8 justify-center px-4 mt-8"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-80"
          onClick={() => onSelectMode('inject')}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
          
          <div className="relative h-full flex flex-col items-center gap-6 rounded-2xl bg-white dark:bg-gray-900 p-8 border border-purple-500/30">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Brain className="w-10 h-10 text-purple-500" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-semibold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">Inject Memory</h3>
              <p className="text-gray-600 dark:text-gray-300">Store your thoughts and memories</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-80"
          onClick={() => onSelectMode('chat')}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
          
          <div className="relative h-full flex flex-col items-center gap-6 rounded-2xl bg-white dark:bg-gray-900 p-8 border border-pink-500/30">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-pink-500" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-semibold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">Chat Mode</h3>
              <p className="text-gray-600 dark:text-gray-300">Interact with your stored memories</p>
            </div>
          </div>
        </motion.button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-12 text-base text-center max-w-2xl mx-auto text-gray-500 dark:text-gray-400"
      >
        MindbookLM serves as your digital memory companion, allowing you to preserve and interact with your thoughts naturally. 
        Whether you're documenting ideas, storing memories, or seeking insights from past experiences, 
        MindbookLM helps you maintain a searchable, interactive archive of your mental landscape.
      </motion.p>
    </div>
  );
}