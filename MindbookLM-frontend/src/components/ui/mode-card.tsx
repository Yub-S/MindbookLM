import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  variant: 'memory' | 'chat';
}

export function ModeCard({ icon: Icon, title, description, onClick, variant }: ModeCardProps) {
  const gradients = {
    memory: 'from-purple-500 via-pink-500 to-purple-500',
    chat: 'from-purple-500 via-pink-500 to-purple-500'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative w-80"
      onClick={onClick}
    >
      {/* Glow effect */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${gradients[variant]} rounded-2xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity`} />
      
      <div className="relative h-full flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-b from-purple-500/10 to-pink-500/5 dark:from-gray-800 dark:to-gray-900 p-8 border-2 border-purple-500/20 group-hover:border-purple-500/30 transition-all backdrop-blur-sm">
        <div className={`h-20 w-20 rounded-full bg-gradient-to-r ${gradients[variant]} bg-opacity-20 flex items-center justify-center`}>
          <Icon className="w-10 h-10 text-purple-100" />
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-semibold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-200">{title}</h3>
          <p className="text-purple-100/70">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}