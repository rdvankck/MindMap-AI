import React from 'react'

const HomePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome to LLM Interface</h1>
      <p className="text-lg text-muted-foreground">
        Start building workflows with AI-powered language models.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-2">Workflow Editor</h2>
          <p className="text-muted-foreground">Create and edit AI-powered workflows</p>
        </div>
        
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-2">Chat Interface</h2>
          <p className="text-muted-foreground">Interact with AI models in real-time</p>
        </div>
        
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-2">Settings</h2>
          <p className="text-muted-foreground">Configure your preferences and API keys</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage