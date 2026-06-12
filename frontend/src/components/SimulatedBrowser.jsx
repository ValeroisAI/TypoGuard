import React, { useState } from 'react';
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search } from "lucide-react";

const SimulatedBrowser = ({ onNavigate, currentUrl }) => {
  const [url, setUrl] = useState(currentUrl || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onNavigate(url);
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-4 border-b dark:border-gray-800 flex items-center gap-2 mb-4">
        <div className="text-xs font-bold text-gray-500 uppercase mr-2 hidden sm:block">Debug Modu</div>
      <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
        <Input 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="bg-white dark:bg-black font-mono text-sm h-9"
        />
        <Button type="submit" size="sm" className="h-9">
          <Search className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default SimulatedBrowser;
