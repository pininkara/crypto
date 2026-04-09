import { useEffect, useState } from 'react'
import GridCalculator from './components/GridCalculator'
import ClosePositionCalculator from './components/ClosePositionCalculator'

const extraStyles = `
@keyframes gradientBg {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.dynamic-bg {
  background: linear-gradient(-45deg, #bae6fd, #c7d2fe, #e9d5ff, #fbcfe8, #fecdd3, #fed7aa, #fef08a, #99f6e4);
  background-size: 600% 600%;
  animation: gradientBg 30s ease infinite;
}
html.dark .dynamic-bg {
  background: linear-gradient(-45deg, #0c4a6e, #312e81, #581c87, #831843, #881337, #7c2d12, #713f12, #134e4a);
  background-size: 600% 600%;
}
`;

function App() {
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'close_calc'>('grid');

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen pt-12 pb-24 px-4 sm:px-6 dynamic-bg transition-colors">
      <style>{extraStyles}</style>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-blue-900 dark:text-blue-100 flex items-center tracking-tight">
          Crypto<span className="text-blue-600 dark:text-blue-400 ml-2">Toolbox</span>
        </h1>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('grid')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'grid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}
            >
              网格计算器
            </button>
            <button
              onClick={() => setActiveTab('close_calc')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'close_calc' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}
            >
              平仓计算器
            </button>
          </div>
          <button 
            onClick={toggleDarkMode} 
            className="p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 transition focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Toggle dark mode"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
      
      {activeTab === 'grid' && <GridCalculator />}
      {activeTab === 'close_calc' && <ClosePositionCalculator />}
    </div>
  )
}

export default App
