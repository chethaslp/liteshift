"use client";

import React from 'react';
import Image from 'next/image';

interface LoadingProps {
  message?: string;
  show?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

const Loading: React.FC<LoadingProps> = ({ 
  message = "Loading...", 
  show = true, 
  className = "",
  size = 'md',
  overlay = true
}) => {
  if (!show) return null;

  const sizeClasses = {
    sm: {
      logo: 'w-8 h-8',
      spinner: 'w-6 h-6 border-2',
      text: 'text-xs',
      dots: 'w-1 h-1'
    },
    md: {
      logo: 'w-12 h-12',
      spinner: 'w-8 h-8 border-3',
      text: 'text-sm',
      dots: 'w-1.5 h-1.5'
    },
    lg: {
      logo: 'w-16 h-16',
      spinner: 'w-12 h-12 border-4',
      text: 'text-base',
      dots: 'w-2 h-2'
    }
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div className="flex flex-col items-center space-y-4">
      {/* Logo */}
      <div className="flex flex-col items-center">
        <Image
          width={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          height={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          src="/images/logo/logo-icon.png"
          alt="Logo"
          className="mb-2"
        />
        <span className={`font-semibold text-gray-800 dark:text-white ${
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-xl'
        }`}>
          liteshift
        </span>
      </div>

      {/* Loading Message */}
      {message && (
        <p className={`${currentSize.text} text-gray-600 dark:text-gray-400 font-medium text-center`}>
          {message}
        </p>
      )}

      {/* Pulsing dots */}
      <div className="flex space-x-1">
        <div className={`${currentSize.dots} bg-brand-500 rounded-full animate-pulse-dots`}></div>
        <div 
          className={`${currentSize.dots} bg-brand-500 rounded-full animate-pulse-dots-delay-1`}
        ></div>
        <div 
          className={`${currentSize.dots} bg-brand-500 rounded-full animate-pulse-dots-delay-2`}
        ></div>
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      {content}
    </div>
  );
};

export default Loading;
