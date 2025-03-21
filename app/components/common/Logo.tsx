import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = 'w-48' }: LogoProps) {
  return (
    <div className={className}>
      <img src="/logo-light.png" alt="Gym Logo" className="w-full" />
    </div>
  );
} 