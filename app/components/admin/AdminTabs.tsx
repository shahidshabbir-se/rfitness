import React from 'react';

interface AdminTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminTabs({ activeTab, setActiveTab }: AdminTabsProps) {
  return (
    <nav className="flex space-x-8">
      {['checkIns', 'members', 'membership', 'analytics'].map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`relative py-4 text-sm font-medium capitalize transition-colors duration-200 ${
            activeTab === tab
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
          {activeTab === tab && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transform origin-left transition-transform duration-200" />
          )}
        </button>
      ))}
    </nav>
  );
}
