import React, { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
}

const ModelSelector: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/models');
      const data = await response.json();
      setModels(data.available);
      setCurrentModel(data.current);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/models/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentModel(data.model);
      }
    } catch (error) {
      console.error('Error changing model:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModelDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      'FLASH': 'Gemini 2.0 Flash',
      'PRO': 'Gemini 1.5 Pro',
      'FLASH_LITE': 'Gemini 1.5 Flash-8B',
    };
    return displayNames[name] || name;
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">AI Model</h3>
        {loading && <div className="text-xs text-blue-400">Updating...</div>}
      </div>
      <div className="space-y-2">
        {models.map((model) => (
          <label
            key={model.id}
            className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${
              currentModel === model.id
                ? 'bg-blue-600/30 border border-blue-500'
                : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
            }`}
          >
            <input
              type="radio"
              name="model"
              value={model.id}
              checked={currentModel === model.id}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loading}
              className="mr-3"
            />
            <span className="text-sm text-gray-200">{getModelDisplayName(model.name)}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Selected model will be used for all new WhatsApp message analysis
      </p>
    </div>
  );
};

export default ModelSelector;
