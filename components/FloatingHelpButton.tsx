"use client";
import { useState } from 'react';

export default function FloatingHelpButton() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <button 
      onClick={() => setIsVisible(false)}
      className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-10"
      title="ヘルプ（クリックで非表示）"
    >
      <span className="text-lg font-bold">?</span>
    </button>
  );
}