import type { EpisodeType } from '../types';

interface TabsProps {
  tabs: Array<{ id: EpisodeType; label: string }>;
  activeTab: EpisodeType;
  onTabChange: (tab: EpisodeType) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <nav className="flex -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-6 py-3 text-sm font-medium transition-colors duration-200
              ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
