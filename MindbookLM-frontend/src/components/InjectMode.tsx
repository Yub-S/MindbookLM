import { motion } from 'framer-motion';
import { Send, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';

type InjectModeProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isInjecting: boolean;
};

export function InjectMode({ value, onChange, onSubmit, onBack, isInjecting }: InjectModeProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Handle success message
  useEffect(() => {
    if (!isInjecting && showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setHasSubmitted(false);
      }, 3000); // Hide success message after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isInjecting, showSuccess]);

  // Update success state only after a submission has happened
  useEffect(() => {
    if (!isInjecting && hasSubmitted) {
      setShowSuccess(true);
    }
  }, [isInjecting, hasSubmitted]);

  const handleSubmit = () => {
    setHasSubmitted(true);
    onSubmit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-3xl mx-auto px-6"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-6 text-gray-600 hover:text-purple-500 transition-colors"
        disabled={isInjecting}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      <div className="relative">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">Share Your Thoughts</h2>
          <p className="text-gray-500 dark:text-gray-400">Your memories are safe with MindbookLM</p>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What's on your mind? Tell me anything..."
          className="min-h-[100px] text-lg p-6 rounded-xl shadow-inner bg-white dark:bg-gray-800 border-2 border-purple-500/20 focus:border-purple-500/40 transition-all resize-none"
          rows={Math.min(10, Math.max(3, value.split('\n').length))}
          disabled={isInjecting}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 space-y-4"
        >
          <Button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl py-6 text-lg font-semibold shadow-lg group"
            disabled={isInjecting}
          >
            <span className="flex items-center gap-2">
              {isInjecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  Tell MindbookLM
                  <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </Button>
          
          {showSuccess && !isInjecting && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center text-green-500 font-medium"
            >
              Memory saved successfully!
            </motion.div>
          )}

          <div className="flex items-center gap-4 justify-center text-sm text-gray-500 dark:text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>Your memories help MindbookLM understand you better</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}